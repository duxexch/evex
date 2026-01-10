import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import jwt from "jsonwebtoken";
import { db } from "./db";
import { notifications, chatMessages, chatSettings, users, matchmakingQueue, gameMatches, games } from "@shared/schema";
import { eq, desc, and, or, sql } from "drizzle-orm";

const JWT_SECRET = process.env.SESSION_SECRET || "pwm-secret-key-change-in-production";

interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

const clients = new Map<string, Set<AuthenticatedSocket>>();

// Voice chat rooms for WebRTC signaling
const voiceRooms = new Map<string, Map<string, AuthenticatedSocket>>();

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: AuthenticatedSocket, req) => {
    ws.isAlive = true;

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === "auth") {
          try {
            const decoded = jwt.verify(data.token, JWT_SECRET) as any;
            ws.userId = decoded.id;
            
            if (!clients.has(decoded.id)) {
              clients.set(decoded.id, new Set());
            }
            clients.get(decoded.id)!.add(ws);

            ws.send(JSON.stringify({ type: "auth_success", userId: decoded.id }));
            
            const unreadNotifications = await db.select()
              .from(notifications)
              .where(and(
                eq(notifications.userId, decoded.id),
                eq(notifications.isRead, false)
              ))
              .orderBy(desc(notifications.createdAt))
              .limit(20);

            ws.send(JSON.stringify({ 
              type: "unread_notifications", 
              data: unreadNotifications 
            }));
          } catch {
            ws.send(JSON.stringify({ type: "auth_error", error: "Invalid token" }));
          }
        }

        if (data.type === "mark_read" && ws.userId) {
          await db.update(notifications)
            .set({ isRead: true, readAt: new Date() })
            .where(and(
              eq(notifications.id, data.notificationId),
              eq(notifications.userId, ws.userId)
            ));
        }

        if (data.type === "mark_all_read" && ws.userId) {
          await db.update(notifications)
            .set({ isRead: true, readAt: new Date() })
            .where(and(
              eq(notifications.userId, ws.userId),
              eq(notifications.isRead, false)
            ));
        }

        // Chat message handler
        if (data.type === "chat_message" && ws.userId) {
          const { receiverId, content, messageType = "text", attachmentUrl } = data;
          
          // Check if chat is enabled
          const chatEnabledSetting = await db.select().from(chatSettings).where(eq(chatSettings.key, "isEnabled")).limit(1);
          if (chatEnabledSetting.length > 0 && chatEnabledSetting[0].value === "false") {
            ws.send(JSON.stringify({ type: "chat_error", error: "Chat is currently disabled" }));
            return;
          }
          
          // Save message to database
          const [message] = await db.insert(chatMessages).values({
            senderId: ws.userId,
            receiverId,
            content,
            messageType,
            attachmentUrl,
          }).returning();
          
          // Get sender info
          const [sender] = await db.select({
            id: users.id,
            username: users.username,
            firstName: users.firstName,
            lastName: users.lastName,
            avatarUrl: users.avatarUrl,
          }).from(users).where(eq(users.id, ws.userId));
          
          const messageWithSender = { ...message, sender };
          
          // Send to recipient if online
          const recipientSockets = clients.get(receiverId);
          if (recipientSockets) {
            const outgoing = JSON.stringify({ type: "new_chat_message", data: messageWithSender });
            recipientSockets.forEach(socket => {
              if (socket.readyState === WebSocket.OPEN) {
                socket.send(outgoing);
              }
            });
          }
          
          // Confirm to sender
          ws.send(JSON.stringify({ type: "chat_message_sent", data: messageWithSender }));
        }

        // Typing indicator handler
        if (data.type === "typing" && ws.userId) {
          const { receiverId, isTyping } = data;
          const recipientSockets = clients.get(receiverId);
          if (recipientSockets) {
            const outgoing = JSON.stringify({ 
              type: "typing_indicator", 
              data: { senderId: ws.userId, isTyping } 
            });
            recipientSockets.forEach(socket => {
              if (socket.readyState === WebSocket.OPEN) {
                socket.send(outgoing);
              }
            });
          }
        }

        // Get chat history handler
        if (data.type === "get_chat_history" && ws.userId) {
          const { otherUserId, limit = 50, offset = 0 } = data;
          
          const messages = await db.select()
            .from(chatMessages)
            .where(
              or(
                and(eq(chatMessages.senderId, ws.userId), eq(chatMessages.receiverId, otherUserId)),
                and(eq(chatMessages.senderId, otherUserId), eq(chatMessages.receiverId, ws.userId))
              )
            )
            .orderBy(desc(chatMessages.createdAt))
            .limit(limit)
            .offset(offset);
          
          ws.send(JSON.stringify({ 
            type: "chat_history", 
            data: { otherUserId, messages: messages.reverse() } 
          }));
        }

        // Mark message as read handler
        if (data.type === "message_read" && ws.userId) {
          const { messageId } = data;
          
          const [updated] = await db.update(chatMessages)
            .set({ isRead: true, readAt: new Date() })
            .where(and(
              eq(chatMessages.id, messageId),
              eq(chatMessages.receiverId, ws.userId)
            ))
            .returning();
          
          if (updated) {
            // Notify sender that message was read
            const senderSockets = clients.get(updated.senderId);
            if (senderSockets) {
              const outgoing = JSON.stringify({ 
                type: "message_read_receipt", 
                data: { messageId, readAt: updated.readAt } 
              });
              senderSockets.forEach(socket => {
                if (socket.readyState === WebSocket.OPEN) {
                  socket.send(outgoing);
                }
              });
            }
          }
        }

        // Mark all messages with a user as read
        if (data.type === "mark_chat_read" && ws.userId) {
          const { otherUserId } = data;
          
          await db.update(chatMessages)
            .set({ isRead: true, readAt: new Date() })
            .where(and(
              eq(chatMessages.senderId, otherUserId),
              eq(chatMessages.receiverId, ws.userId),
              eq(chatMessages.isRead, false)
            ));
          
          // Notify the other user
          const otherSockets = clients.get(otherUserId);
          if (otherSockets) {
            const outgoing = JSON.stringify({ 
              type: "messages_marked_read", 
              data: { byUserId: ws.userId } 
            });
            otherSockets.forEach(socket => {
              if (socket.readyState === WebSocket.OPEN) {
                socket.send(outgoing);
              }
            });
          }
        }

        // ==================== MATCHMAKING HANDLERS ====================

        // Join random match queue
        if (data.type === "join_random_match" && ws.userId) {
          const { gameId } = data;
          
          // Check if already in queue
          const existingQueue = await db.select().from(matchmakingQueue)
            .where(and(
              eq(matchmakingQueue.userId, ws.userId),
              eq(matchmakingQueue.status, "waiting")
            ));
          
          if (existingQueue.length > 0) {
            ws.send(JSON.stringify({ type: "matchmaking_error", error: "Already in queue" }));
            return;
          }

          // Try to find a match
          const waitingPlayers = await db.select().from(matchmakingQueue)
            .where(and(
              eq(matchmakingQueue.gameId, gameId),
              eq(matchmakingQueue.matchType, "random"),
              eq(matchmakingQueue.status, "waiting"),
              sql`${matchmakingQueue.userId} != ${ws.userId}`
            ))
            .limit(1);

          if (waitingPlayers.length > 0) {
            const opponent = waitingPlayers[0];
            
            // Update opponent's queue status
            await db.update(matchmakingQueue)
              .set({ status: "matched" })
              .where(eq(matchmakingQueue.id, opponent.id));

            // Create match
            const [match] = await db.insert(gameMatches).values({
              gameId,
              player1Id: opponent.userId,
              player2Id: ws.userId,
              status: "in_progress",
              startedAt: new Date(),
            }).returning();

            // Get player info
            const [player1] = await db.select({
              id: users.id,
              username: users.username,
              avatarUrl: users.avatarUrl,
              vipLevel: users.vipLevel,
            }).from(users).where(eq(users.id, opponent.userId));
            
            const [player2] = await db.select({
              id: users.id,
              username: users.username,
              avatarUrl: users.avatarUrl,
              vipLevel: users.vipLevel,
            }).from(users).where(eq(users.id, ws.userId));

            const [game] = await db.select().from(games).where(eq(games.id, gameId));

            const matchData = { ...match, player1, player2, game };

            // Notify both players
            ws.send(JSON.stringify({ type: "match_found", data: matchData }));
            
            const opponentSockets = clients.get(opponent.userId);
            if (opponentSockets) {
              opponentSockets.forEach(socket => {
                if (socket.readyState === WebSocket.OPEN) {
                  socket.send(JSON.stringify({ type: "match_found", data: matchData }));
                }
              });
            }
          } else {
            // Join queue
            const [queueEntry] = await db.insert(matchmakingQueue).values({
              gameId,
              userId: ws.userId,
              matchType: "random",
              status: "waiting",
            }).returning();

            ws.send(JSON.stringify({ type: "matchmaking_queued", data: queueEntry }));
          }
        }

        // Invite friend to match
        if (data.type === "invite_friend" && ws.userId) {
          const { gameId, friendAccountId } = data;

          // Find friend by account ID
          const [friend] = await db.select().from(users).where(eq(users.accountId, friendAccountId));
          if (!friend) {
            ws.send(JSON.stringify({ type: "matchmaking_error", error: "Friend not found" }));
            return;
          }

          if (friend.id === ws.userId) {
            ws.send(JSON.stringify({ type: "matchmaking_error", error: "Cannot invite yourself" }));
            return;
          }

          // Create pending match
          const [match] = await db.insert(gameMatches).values({
            gameId,
            player1Id: ws.userId,
            player2Id: friend.id,
            status: "pending",
          }).returning();

          // Get sender info
          const [sender] = await db.select({
            id: users.id,
            username: users.username,
            avatarUrl: users.avatarUrl,
            vipLevel: users.vipLevel,
          }).from(users).where(eq(users.id, ws.userId));

          const [game] = await db.select().from(games).where(eq(games.id, gameId));

          // Notify friend
          const friendSockets = clients.get(friend.id);
          if (friendSockets) {
            friendSockets.forEach(socket => {
              if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ 
                  type: "game_invite", 
                  data: { match, sender, game } 
                }));
              }
            });
          }

          ws.send(JSON.stringify({ type: "invite_sent", data: { match, friendId: friend.id } }));
        }

        // Accept friend invite
        if (data.type === "accept_invite" && ws.userId) {
          const { matchId } = data;

          const [match] = await db.select().from(gameMatches).where(eq(gameMatches.id, matchId));
          if (!match || match.player2Id !== ws.userId || match.status !== "pending") {
            ws.send(JSON.stringify({ type: "matchmaking_error", error: "Invalid invite" }));
            return;
          }

          const [updated] = await db.update(gameMatches)
            .set({ status: "in_progress", startedAt: new Date() })
            .where(eq(gameMatches.id, matchId))
            .returning();

          // Get player info
          const [player1] = await db.select({
            id: users.id,
            username: users.username,
            avatarUrl: users.avatarUrl,
            vipLevel: users.vipLevel,
          }).from(users).where(eq(users.id, match.player1Id));
          
          const [player2] = await db.select({
            id: users.id,
            username: users.username,
            avatarUrl: users.avatarUrl,
            vipLevel: users.vipLevel,
          }).from(users).where(eq(users.id, ws.userId));

          const [game] = await db.select().from(games).where(eq(games.id, match.gameId));

          const matchData = { ...updated, player1, player2, game };

          // Notify both players
          ws.send(JSON.stringify({ type: "match_found", data: matchData }));
          
          const senderSockets = clients.get(match.player1Id);
          if (senderSockets) {
            senderSockets.forEach(socket => {
              if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ 
                  type: "invite_response", 
                  data: { accepted: true, match: matchData } 
                }));
              }
            });
          }
        }

        // Decline friend invite
        if (data.type === "decline_invite" && ws.userId) {
          const { matchId } = data;

          const [match] = await db.select().from(gameMatches).where(eq(gameMatches.id, matchId));
          if (!match || match.player2Id !== ws.userId || match.status !== "pending") {
            ws.send(JSON.stringify({ type: "matchmaking_error", error: "Invalid invite" }));
            return;
          }

          await db.update(gameMatches)
            .set({ status: "cancelled" })
            .where(eq(gameMatches.id, matchId));

          // Notify sender
          const senderSockets = clients.get(match.player1Id);
          if (senderSockets) {
            senderSockets.forEach(socket => {
              if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ 
                  type: "invite_response", 
                  data: { accepted: false, matchId } 
                }));
              }
            });
          }

          ws.send(JSON.stringify({ type: "invite_declined", data: { matchId } }));
        }

        // Cancel matchmaking
        if (data.type === "cancel_matchmaking" && ws.userId) {
          await db.update(matchmakingQueue)
            .set({ status: "cancelled" })
            .where(and(
              eq(matchmakingQueue.userId, ws.userId),
              eq(matchmakingQueue.status, "waiting")
            ));

          ws.send(JSON.stringify({ type: "matchmaking_cancelled" }));
        }

        // Voice chat signaling handlers
        if (data.type === "voice_join" && ws.userId) {
          const { matchId } = data;
          
          // Verify user is participant in this match
          const [match] = await db.select().from(gameMatches).where(eq(gameMatches.id, matchId));
          if (!match || (match.player1Id !== ws.userId && match.player2Id !== ws.userId)) {
            ws.send(JSON.stringify({ type: "voice_error", error: "Not authorized for this match" }));
            return;
          }

          // Add to voice room
          if (!voiceRooms.has(matchId)) {
            voiceRooms.set(matchId, new Map());
          }
          voiceRooms.get(matchId)!.set(ws.userId, ws);

          // Notify other participant that peer joined
          const otherPlayerId = match.player1Id === ws.userId ? match.player2Id : match.player1Id;
          const otherPlayerRoom = voiceRooms.get(matchId)?.get(otherPlayerId);
          if (otherPlayerRoom && otherPlayerRoom.readyState === WebSocket.OPEN) {
            otherPlayerRoom.send(JSON.stringify({ type: "voice_peer_joined", matchId }));
          }

          ws.send(JSON.stringify({ type: "voice_joined", matchId }));
        }

        if (data.type === "voice_offer" && ws.userId) {
          const { matchId, offer } = data;
          
          // Verify sender is in the voice room before forwarding
          const room = voiceRooms.get(matchId);
          if (room && room.has(ws.userId)) {
            room.forEach((socket, oderId) => {
              if (oderId !== ws.userId && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: "voice_offer", matchId, offer }));
              }
            });
          } else {
            ws.send(JSON.stringify({ type: "voice_error", error: "Not in voice room" }));
          }
        }

        if (data.type === "voice_answer" && ws.userId) {
          const { matchId, answer } = data;
          
          // Verify sender is in the voice room before forwarding
          const room = voiceRooms.get(matchId);
          if (room && room.has(ws.userId)) {
            room.forEach((socket, oderId) => {
              if (oderId !== ws.userId && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: "voice_answer", matchId, answer }));
              }
            });
          } else {
            ws.send(JSON.stringify({ type: "voice_error", error: "Not in voice room" }));
          }
        }

        if (data.type === "voice_ice_candidate" && ws.userId) {
          const { matchId, candidate } = data;
          
          // Verify sender is in the voice room before forwarding
          const room = voiceRooms.get(matchId);
          if (room && room.has(ws.userId)) {
            room.forEach((socket, oderId) => {
              if (oderId !== ws.userId && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: "voice_ice_candidate", matchId, candidate }));
              }
            });
          }
        }

        if (data.type === "voice_leave" && ws.userId) {
          const { matchId } = data;
          
          const room = voiceRooms.get(matchId);
          if (room) {
            room.delete(ws.userId);
            // Notify peer that user left
            room.forEach((socket) => {
              if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: "voice_peer_left", matchId }));
              }
            });
            // Clean up empty room
            if (room.size === 0) {
              voiceRooms.delete(matchId);
            }
          }
        }

      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });

    ws.on("close", () => {
      if (ws.userId && clients.has(ws.userId)) {
        clients.get(ws.userId)!.delete(ws);
        if (clients.get(ws.userId)!.size === 0) {
          clients.delete(ws.userId);
        }
      }
      
      // Clean up voice rooms on disconnect
      if (ws.userId) {
        voiceRooms.forEach((room, matchId) => {
          if (room.has(ws.userId!)) {
            room.delete(ws.userId!);
            // Notify remaining peers
            room.forEach((socket) => {
              if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: "voice_peer_left", matchId }));
              }
            });
            // Clean up empty room
            if (room.size === 0) {
              voiceRooms.delete(matchId);
            }
          }
        });
      }
    });
  });

  const interval = setInterval(() => {
    wss.clients.forEach((ws: AuthenticatedSocket) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(interval);
  });

  return wss;
}

export async function sendNotification(userId: string, notification: {
  type: "announcement" | "transaction" | "security" | "promotion" | "system" | "p2p";
  priority?: "low" | "normal" | "high" | "urgent";
  title: string;
  titleAr?: string;
  message: string;
  messageAr?: string;
  link?: string;
  metadata?: string;
}) {
  const [created] = await db.insert(notifications).values({
    userId,
    type: notification.type,
    priority: notification.priority || "normal",
    title: notification.title,
    titleAr: notification.titleAr,
    message: notification.message,
    messageAr: notification.messageAr,
    link: notification.link,
    metadata: notification.metadata,
  }).returning();

  const userSockets = clients.get(userId);
  if (userSockets) {
    const message = JSON.stringify({ type: "new_notification", data: created });
    userSockets.forEach(socket => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(message);
      }
    });
  }

  return created;
}

export async function broadcastNotification(notification: {
  type: "announcement" | "transaction" | "security" | "promotion" | "system" | "p2p";
  priority?: "low" | "normal" | "high" | "urgent";
  title: string;
  titleAr?: string;
  message: string;
  messageAr?: string;
  link?: string;
  metadata?: string;
}, userIds: string[]) {
  const results = [];
  for (const userId of userIds) {
    const result = await sendNotification(userId, notification);
    results.push(result);
  }
  return results;
}

export function getConnectedClients() {
  return clients;
}
