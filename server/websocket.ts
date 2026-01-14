import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import jwt from "jsonwebtoken";
import { db } from "./db";
import { 
  notifications, chatMessages, chatSettings, users, matchmakingQueue, gameMatches, games,
  challengeGameSessions, challengeChatMessages, challenges
} from "@shared/schema";
import { eq, desc, and, or, sql } from "drizzle-orm";
import * as ChessEngine from "./game-engines/chess-engine";
import * as DominoEngine from "./game-engines/domino-engine";
import * as BackgammonEngine from "./game-engines/backgammon-engine";
import * as CardGameEngine from "./game-engines/card-game-engine";

const JWT_SECRET = process.env.SESSION_SECRET || "pwm-secret-key-change-in-production";

interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

const clients = new Map<string, Set<AuthenticatedSocket>>();

// Voice chat rooms for WebRTC signaling
const voiceRooms = new Map<string, Map<string, AuthenticatedSocket>>();

// Challenge game rooms
const challengeGameRooms = new Map<string, {
  players: Map<string, AuthenticatedSocket>;
  spectators: Map<string, AuthenticatedSocket>;
}>();

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
          const { receiverId, content, messageType = "text", attachmentUrl, isDisappearing = false, disappearAfterRead = false } = data;
          
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
            isDisappearing: Boolean(isDisappearing),
            disappearAfterRead: Boolean(disappearAfterRead),
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
              and(
                or(
                  and(eq(chatMessages.senderId, ws.userId), eq(chatMessages.receiverId, otherUserId)),
                  and(eq(chatMessages.senderId, otherUserId), eq(chatMessages.receiverId, ws.userId))
                ),
                sql`${chatMessages.deletedAt} IS NULL`
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
            // If message should disappear after being read, mark it as deleted
            if (updated.disappearAfterRead) {
              await db.update(chatMessages)
                .set({ deletedAt: new Date() })
                .where(eq(chatMessages.id, messageId));
            }
            
            // Notify sender that message was read
            const senderSockets = clients.get(updated.senderId);
            if (senderSockets) {
              const outgoing = JSON.stringify({ 
                type: "message_read_receipt", 
                data: { messageId, readAt: updated.readAt, disappeared: updated.disappearAfterRead } 
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

        // ========== CHALLENGE GAME HANDLERS ==========

        // Join challenge game room
        if (data.type === "join_challenge_game" && ws.userId) {
          const { challengeId, isSpectator } = data;
          
          // Verify challenge exists
          const [challenge] = await db.select().from(challenges).where(eq(challenges.id, challengeId));
          if (!challenge) {
            ws.send(JSON.stringify({ type: "challenge_error", error: "Challenge not found" }));
            return;
          }

          // Initialize room if needed
          if (!challengeGameRooms.has(challengeId)) {
            challengeGameRooms.set(challengeId, {
              players: new Map(),
              spectators: new Map(),
            });
          }

          const room = challengeGameRooms.get(challengeId)!;

          if (isSpectator) {
            room.spectators.set(ws.userId, ws);
            
            // Notify players about new spectator
            const [spectatorUser] = await db.select({
              id: users.id,
              username: users.username,
              avatarUrl: users.avatarUrl,
            }).from(users).where(eq(users.id, ws.userId));

            room.players.forEach((socket) => {
              if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ 
                  type: "spectator_joined", 
                  spectator: spectatorUser 
                }));
              }
            });
          } else {
            room.players.set(ws.userId, ws);
          }

          // Broadcast spectator count
          const spectatorCount = room.spectators.size;
          [...room.players.values(), ...room.spectators.values()].forEach((socket) => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ type: "spectator_count", count: spectatorCount }));
            }
          });

          // Send current game state
          const [session] = await db.select().from(challengeGameSessions)
            .where(eq(challengeGameSessions.challengeId, challengeId))
            .orderBy(desc(challengeGameSessions.createdAt))
            .limit(1);

          if (session) {
            ws.send(JSON.stringify({ type: "game_state_sync", session }));
          }

          ws.send(JSON.stringify({ type: "joined_challenge_game", challengeId }));
        }

        // Leave challenge game room
        if (data.type === "leave_challenge_game" && ws.userId) {
          const { challengeId } = data;
          const room = challengeGameRooms.get(challengeId);
          
          if (room) {
            if (room.spectators.has(ws.userId)) {
              room.spectators.delete(ws.userId);
              
              // Notify players about spectator leaving
              room.players.forEach((socket) => {
                if (socket.readyState === WebSocket.OPEN) {
                  socket.send(JSON.stringify({ 
                    type: "spectator_left", 
                    spectatorId: ws.userId 
                  }));
                }
              });

              // Broadcast updated spectator count
              const spectatorCount = room.spectators.size;
              [...room.players.values(), ...room.spectators.values()].forEach((socket) => {
                if (socket.readyState === WebSocket.OPEN) {
                  socket.send(JSON.stringify({ type: "spectator_count", count: spectatorCount }));
                }
              });
            } else {
              room.players.delete(ws.userId);
            }

            // Clean up empty room
            if (room.players.size === 0 && room.spectators.size === 0) {
              challengeGameRooms.delete(challengeId);
            }
          }
        }

        // Handle game move
        if (data.type === "game_move" && ws.userId) {
          const { challengeId, move } = data;
          const room = challengeGameRooms.get(challengeId);
          
          if (!room || !room.players.has(ws.userId)) {
            ws.send(JSON.stringify({ type: "challenge_error", error: "Not a player in this game" }));
            return;
          }

          // Get current session
          const [session] = await db.select().from(challengeGameSessions)
            .where(eq(challengeGameSessions.challengeId, challengeId))
            .orderBy(desc(challengeGameSessions.createdAt))
            .limit(1);

          if (!session || session.status !== "playing") {
            ws.send(JSON.stringify({ type: "challenge_error", error: "Game not in progress" }));
            return;
          }

          if (session.currentTurn !== ws.userId) {
            ws.send(JSON.stringify({ type: "challenge_error", error: "Not your turn" }));
            return;
          }

          // Get challenge to find opponent
          const [challenge] = await db.select().from(challenges).where(eq(challenges.id, challengeId));
          if (!challenge) return;

          const opponentId = challenge.player1Id === ws.userId ? challenge.player2Id : challenge.player1Id;
          
          // Get game type and validate move using appropriate engine
          let gameState;
          try {
            gameState = session.gameState ? JSON.parse(session.gameState) : null;
          } catch {
            gameState = null;
          }
          
          const gameType = session.gameType;
          let moveResult: any = { valid: false, error: 'Unknown game type' };
          let isGameOver = false;
          let winnerId: string | null = null;

          // Validate and apply move based on game type
          if (gameType === 'chess') {
            const position = gameState ? ChessEngine.fenToPosition(gameState.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') : ChessEngine.createInitialPosition();
            moveResult = ChessEngine.validateAndMakeMove(position, move);
            
            if (moveResult.valid && moveResult.newPosition) {
              gameState = {
                fen: ChessEngine.positionToFEN(moveResult.newPosition),
                lastMove: move,
                notation: moveResult.notation,
                isCheck: moveResult.isCheck,
                moveCount: (gameState?.moveCount || 0) + 1,
              };
              
              if (moveResult.isCheckmate || moveResult.isDraw) {
                isGameOver = true;
                winnerId = moveResult.isCheckmate ? ws.userId : null;
              }
            }
          } else if (gameType === 'domino') {
            if (!gameState) {
              gameState = DominoEngine.createInitialState([challenge.player1Id, challenge.player2Id!]);
            }
            moveResult = DominoEngine.makeMove(gameState, ws.userId, move);
            
            if (moveResult.valid && moveResult.newState) {
              gameState = moveResult.newState;
              const status = DominoEngine.getGameStatus(gameState);
              if (status.isGameOver) {
                isGameOver = true;
                winnerId = status.winner || null;
              }
            }
          } else if (gameType === 'backgammon') {
            if (!gameState) {
              gameState = BackgammonEngine.createInitialState();
            }
            moveResult = BackgammonEngine.makeMove(gameState, move);
            
            if (moveResult.valid && moveResult.newState) {
              gameState = moveResult.newState;
              const status = BackgammonEngine.getGameStatus(gameState);
              if (status.isGameOver) {
                isGameOver = true;
                winnerId = status.winner === 'white' ? challenge.player1Id : challenge.player2Id;
              }
            }
          } else if (gameType === 'tarneeb') {
            if (!gameState) {
              gameState = CardGameEngine.createTarneebState([challenge.player1Id, challenge.player2Id!, '', '']);
            }
            
            if (move.type === 'bid') {
              moveResult = CardGameEngine.tarneebBid(gameState, ws.userId, move.bid);
            } else if (move.type === 'setTrump') {
              moveResult = CardGameEngine.tarneebSetTrump(gameState, ws.userId, move.suit);
            } else if (move.type === 'playCard') {
              moveResult = CardGameEngine.tarneebPlayCard(gameState, ws.userId, move.card);
            }
            
            if (moveResult.valid && moveResult.newState) {
              gameState = moveResult.newState;
              if (gameState.phase === 'finished') {
                isGameOver = true;
                winnerId = gameState.totalScores.team0 > gameState.totalScores.team1 ? challenge.player1Id : challenge.player2Id;
              }
            }
          } else if (gameType === 'baloot') {
            if (!gameState) {
              gameState = CardGameEngine.createBalootState([challenge.player1Id, challenge.player2Id!, '', '']);
            }
            
            if (move.type === 'choose') {
              moveResult = CardGameEngine.balootChoose(gameState, ws.userId, move.gameType, move.trumpSuit);
            } else if (move.type === 'pass') {
              moveResult = CardGameEngine.balootPass(gameState, ws.userId);
            } else if (move.type === 'playCard') {
              moveResult = CardGameEngine.balootPlayCard(gameState, ws.userId, move.card);
            }
            
            if (moveResult.valid && moveResult.newState) {
              gameState = moveResult.newState;
              if (gameState.phase === 'finished') {
                isGameOver = true;
                winnerId = gameState.totalPoints.team0 > gameState.totalPoints.team1 ? challenge.player1Id : challenge.player2Id;
              }
            }
          }

          if (!moveResult.valid) {
            ws.send(JSON.stringify({ type: "move_error", error: moveResult.error || 'Invalid move' }));
            return;
          }

          // Determine next player
          let nextTurn = opponentId;
          if (gameType === 'domino' && gameState?.currentPlayer) {
            nextTurn = gameState.currentPlayer;
          } else if (gameType === 'backgammon' && gameState?.currentPlayer) {
            nextTurn = gameState.currentPlayer === 'white' ? challenge.player1Id : challenge.player2Id!;
          } else if ((gameType === 'tarneeb' || gameType === 'baloot') && gameState?.currentPlayer) {
            nextTurn = gameState.currentPlayer;
          }

          const [updatedSession] = await db.update(challengeGameSessions)
            .set({
              gameState: JSON.stringify(gameState),
              currentTurn: isGameOver ? null : nextTurn,
              totalMoves: (session.totalMoves || 0) + 1,
              lastMoveAt: new Date(),
              updatedAt: new Date(),
              status: isGameOver ? 'completed' : 'playing',
              winnerId: winnerId,
              endedAt: isGameOver ? new Date() : null,
            })
            .where(eq(challengeGameSessions.id, session.id))
            .returning();

          // Broadcast to all in room
          [...room.players.values(), ...room.spectators.values()].forEach((socket) => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ 
                type: "game_move", 
                session: updatedSession,
                move,
                playerId: ws.userId,
              }));
            }
          });
        }

        // Handle dice roll for backgammon
        if (data.type === "roll_dice" && ws.userId) {
          const { challengeId } = data;
          const room = challengeGameRooms.get(challengeId);
          
          if (!room || !room.players.has(ws.userId)) {
            ws.send(JSON.stringify({ type: "challenge_error", error: "Not a player in this game" }));
            return;
          }

          const [session] = await db.select().from(challengeGameSessions)
            .where(eq(challengeGameSessions.challengeId, challengeId))
            .orderBy(desc(challengeGameSessions.createdAt))
            .limit(1);

          if (!session || session.status !== "playing" || session.gameType !== "backgammon") {
            ws.send(JSON.stringify({ type: "challenge_error", error: "Cannot roll dice now" }));
            return;
          }

          let gameState = session.gameState ? JSON.parse(session.gameState) : BackgammonEngine.createInitialState();
          
          const dice = BackgammonEngine.rollDice();
          gameState = BackgammonEngine.setDice(gameState, dice);

          await db.update(challengeGameSessions)
            .set({
              gameState: JSON.stringify(gameState),
              updatedAt: new Date(),
            })
            .where(eq(challengeGameSessions.id, session.id));

          [...room.players.values(), ...room.spectators.values()].forEach((socket) => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ 
                type: "dice_rolled", 
                dice,
                playerId: ws.userId,
                gameState,
              }));
            }
          });
        }

        // Handle end turn for backgammon
        if (data.type === "end_turn" && ws.userId) {
          const { challengeId } = data;
          const room = challengeGameRooms.get(challengeId);
          
          if (!room || !room.players.has(ws.userId)) return;

          const [session] = await db.select().from(challengeGameSessions)
            .where(eq(challengeGameSessions.challengeId, challengeId))
            .limit(1);

          if (!session || session.gameType !== "backgammon") return;

          let gameState = session.gameState ? JSON.parse(session.gameState) : null;
          if (!gameState) return;

          gameState = BackgammonEngine.endTurn(gameState);

          const [challenge] = await db.select().from(challenges).where(eq(challenges.id, challengeId));
          const nextTurn = gameState.currentPlayer === 'white' ? challenge.player1Id : challenge.player2Id;

          await db.update(challengeGameSessions)
            .set({
              gameState: JSON.stringify(gameState),
              currentTurn: nextTurn,
              updatedAt: new Date(),
            })
            .where(eq(challengeGameSessions.id, session.id));

          [...room.players.values(), ...room.spectators.values()].forEach((socket) => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ 
                type: "turn_ended", 
                gameState,
                nextPlayer: nextTurn,
              }));
            }
          });
        }

        // Handle challenge chat
        if (data.type === "challenge_chat" && ws.userId) {
          const { challengeId, message, isQuickMessage, quickMessageKey } = data;
          const room = challengeGameRooms.get(challengeId);
          
          if (!room) {
            ws.send(JSON.stringify({ type: "challenge_error", error: "Room not found" }));
            return;
          }

          const isSpectator = room.spectators.has(ws.userId);

          // Get session
          const [session] = await db.select().from(challengeGameSessions)
            .where(eq(challengeGameSessions.challengeId, challengeId))
            .limit(1);

          if (!session) return;

          // Get sender info
          const [sender] = await db.select({
            id: users.id,
            username: users.username,
            avatarUrl: users.avatarUrl,
          }).from(users).where(eq(users.id, ws.userId));

          // Save message
          const [savedMessage] = await db.insert(challengeChatMessages).values({
            sessionId: session.id,
            senderId: ws.userId,
            message,
            isQuickMessage: isQuickMessage || false,
            quickMessageKey,
            isSpectator,
          }).returning();

          const messageWithSender = {
            ...savedMessage,
            senderName: sender.username,
            senderAvatar: sender.avatarUrl,
          };

          // Broadcast to all (players can see spectator messages too)
          [...room.players.values(), ...room.spectators.values()].forEach((socket) => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ 
                type: "chat_message", 
                message: messageWithSender 
              }));
            }
          });
        }

        // Handle resign
        if (data.type === "game_resign" && ws.userId) {
          const { challengeId } = data;
          const room = challengeGameRooms.get(challengeId);
          
          if (!room || !room.players.has(ws.userId)) {
            ws.send(JSON.stringify({ type: "challenge_error", error: "Not a player" }));
            return;
          }

          // Get challenge
          const [challenge] = await db.select().from(challenges).where(eq(challenges.id, challengeId));
          if (!challenge) return;

          const winnerId = challenge.player1Id === ws.userId ? challenge.player2Id : challenge.player1Id;

          // Update session
          const [session] = await db.select().from(challengeGameSessions)
            .where(eq(challengeGameSessions.challengeId, challengeId))
            .limit(1);

          if (session) {
            await db.update(challengeGameSessions)
              .set({
                status: "finished",
                winnerId,
                winReason: "resignation",
                updatedAt: new Date(),
              })
              .where(eq(challengeGameSessions.id, session.id));
          }

          // Update challenge
          await db.update(challenges)
            .set({
              status: "completed",
              winnerId,
              completedAt: new Date(),
            })
            .where(eq(challenges.id, challengeId));

          // Broadcast game ended
          [...room.players.values(), ...room.spectators.values()].forEach((socket) => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ 
                type: "game_ended", 
                winnerId,
                reason: "resignation",
              }));
            }
          });
        }

        // Gift sent notification to players
        if (data.type === "gift_to_player" && ws.userId) {
          const { challengeId, recipientId, giftId, giftName, amount } = data;
          const room = challengeGameRooms.get(challengeId);
          
          if (!room) return;

          // Get sender info
          const [sender] = await db.select({
            id: users.id,
            username: users.username,
          }).from(users).where(eq(users.id, ws.userId));

          // Broadcast gift animation
          [...room.players.values(), ...room.spectators.values()].forEach((socket) => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ 
                type: "gift_received",
                gift: {
                  id: giftId,
                  senderId: ws.userId,
                  senderName: sender.username,
                  recipientId,
                  giftName,
                  amount,
                }
              }));
            }
          });
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
