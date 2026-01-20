/**
 * Challenge Notifications Service
 * Handles all instant notifications for challenge events
 */

import { db } from "../../../db";
import { storage } from "../../../storage";
import {
  notifications,
  users,
  games,
  challenges as challengesTable,
  challengerFollows,
} from "@shared/schema";
import { eq, or, inArray } from "drizzle-orm";
import { broadcastNotification, broadcastToUser } from "../../../websocket";

export interface NotificationPayload {
  type: 'announcement' | 'transaction' | 'security' | 'promotion' | 'system' | 'p2p' | 'id_verification' | 'success' | 'warning';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  title: string;
  titleAr: string;
  message: string;
  messageAr: string;
  link?: string;
  metadata?: Record<string, any>;
}

/**
 * Send notification to specific user
 */
export async function sendUserNotification(
  userId: string,
  payload: NotificationPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.insert(notifications).values({
      userId,
      type: payload.type,
      priority: payload.priority,
      title: payload.title,
      titleAr: payload.titleAr,
      message: payload.message,
      messageAr: payload.messageAr,
      link: payload.link || null,
      metadata: JSON.stringify(payload.metadata || {}),
      isRead: false,
      readAt: null,
      createdAt: new Date(),
    });

    // Broadcast in real-time
    await broadcastToUser(userId, {
      type: 'notification',
      payload: {
        ...payload,
        id: `notif_${Date.now()}`,
        receivedAt: new Date().toISOString(),
      },
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Send notification to multiple users
 */
export async function sendBulkNotifications(
  userIds: string[],
  payload: NotificationPayload
): Promise<{ success: boolean; sentTo: number; error?: string }> {
  try {
    const notificationRecords = userIds.map((userId) => ({
      userId,
      type: payload.type,
      priority: payload.priority,
      title: payload.title,
      titleAr: payload.titleAr,
      message: payload.message,
      messageAr: payload.messageAr,
      link: payload.link || null,
      metadata: JSON.stringify(payload.metadata || {}),
      isRead: false,
      readAt: null,
      createdAt: new Date(),
    }));

    await db.insert(notifications).values(notificationRecords);

    // Broadcast to all users in real-time
    for (const userId of userIds) {
      await broadcastToUser(userId, {
        type: 'notification',
        payload: {
          ...payload,
          id: `notif_${Date.now()}`,
          receivedAt: new Date().toISOString(),
        },
      });
    }

    return { success: true, sentTo: userIds.length };
  } catch (error: any) {
    return { success: false, sentTo: 0, error: error.message };
  }
}

/**
 * Notify challenge creator's followers about new challenge
 */
export async function notifyFollowersAboutChallenge(
  challengerId: string,
  challengeId: string,
  gameType: string,
  betAmount: number
): Promise<{ success: boolean; notifiedCount?: number; error?: string }> {
  try {
    // Get all followers of the challenger
    const followers = await db.query.users.findMany({
      where: (u, { eq: eqOp }) => {
        return eqOp(u.id, challengerId);
      },
    });

    if (!followers.length) {
      return { success: true, notifiedCount: 0 };
    }

    const gameName =
      gameType.charAt(0).toUpperCase() + gameType.slice(1);

    const payload: NotificationPayload = {
      type: 'system',
      priority: 'high',
      title: 'New Challenge!',
      titleAr: 'تحدي جديد!',
      message: `A new ${gameName} challenge for $${betAmount} has been created!`,
      messageAr: `تم إنشاء تحدي ${gameName} جديد بقيمة $${betAmount}!`,
      link: `/challenges/public`,
      metadata: {
        challengeId,
        gameType,
        betAmount,
        action: 'view_challenge',
      },
    };

    const followerIds = followers.map((f) => f.id);
    return await sendBulkNotifications(followerIds, payload);
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Notify users interested in a specific game about new challenge
 */
export async function notifyGameEnthusiastsAboutChallenge(
  gameType: string,
  challengeId: string,
  challengerName: string,
  betAmount: number,
  excludeUserId?: string
): Promise<{ success: boolean; notifiedCount?: number; error?: string }> {
  try {
    // Get users who marked this game as favorite (would need to add favoriteGames table)
    // For now, we'll notify recent players of this game type
    const recentPlayers = await db.query.liveGameSessions.findMany({
      where: (s, { eq: eqOp }) => eqOp(s.gameType, gameType),
      limit: 50,
    });

    if (!recentPlayers.length) {
      return { success: true, notifiedCount: 0 };
    }

    // Get unique player IDs
    const playerIds = new Set<string>();
    for (const session of recentPlayers) {
      playerIds.add(session.player1Id);
      if (session.player2Id) playerIds.add(session.player2Id);
    }

    // Remove exclude user if provided
    if (excludeUserId) {
      playerIds.delete(excludeUserId);
    }

    const gameName =
      gameType.charAt(0).toUpperCase() + gameType.slice(1);

    const payload: NotificationPayload = {
      type: 'system',
      priority: 'normal',
      title: `${gameName} Challenge Available`,
      titleAr: `تحدي ${gameName} متاح الآن`,
      message: `${challengerName} started a ${gameName} challenge for $${betAmount}. Join now!`,
      messageAr: `بدأ ${challengerName} تحدي ${gameName} بقيمة $${betAmount}. شارك الآن!`,
      link: `/challenges/available`,
      metadata: {
        challengeId,
        gameType,
        betAmount,
        challengerName,
        action: 'join_challenge',
      },
    };

    return await sendBulkNotifications(Array.from(playerIds), payload);
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Notify both players when challenge is accepted
 */
export async function notifyPlayersAboutChallengeStart(
  challengeId: string,
  player1Id: string,
  player1Name: string,
  player2Id: string,
  player2Name: string,
  gameType: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const gameName =
      gameType.charAt(0).toUpperCase() + gameType.slice(1);

    // Notify Player 1
    await sendUserNotification(player1Id, {
      type: 'system',
      priority: 'urgent',
      title: `Challenge Accepted by ${player2Name}!`,
      titleAr: `قَبِل ${player2Name} التحدي!`,
      message: `${player2Name} accepted your ${gameName} challenge! The game is starting now.`,
      messageAr: `قبل ${player2Name} تحديك بـ ${gameName}! ستبدأ اللعبة الآن.`,
      link: `/challenge/${challengeId}/play`,
      metadata: {
        challengeId,
        gameType,
        opponent: player2Name,
        action: 'play_game',
      },
    });

    // Notify Player 2
    await sendUserNotification(player2Id, {
      type: 'system',
      priority: 'urgent',
      title: `Challenge Started with ${player1Name}!`,
      titleAr: `تحدي جديد مع ${player1Name}!`,
      message: `You accepted ${player1Name}'s ${gameName} challenge! The game is starting now.`,
      messageAr: `قبلت تحدي ${player1Name} بـ ${gameName}! ستبدأ اللعبة الآن.`,
      link: `/challenge/${challengeId}/play`,
      metadata: {
        challengeId,
        gameType,
        opponent: player1Name,
        action: 'play_game',
      },
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Notify spectators about game results
 */
export async function notifySpectatorsAboutGameResult(
  challengeId: string,
  winnerId: string,
  winnerName: string,
  loserName: string,
  gameType: string,
  totalPrizePool: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get all spectators (would need to track from gameSpectators table)
    // For now, notify followers and recent players
    const gameName =
      gameType.charAt(0).toUpperCase() + gameType.slice(1);

    // This would be expanded with actual spectator tracking
    const payload: NotificationPayload = {
      type: 'system',
      priority: 'normal',
      title: `${gameName} Challenge Finished!`,
      titleAr: `انتهت مباراة ${gameName}!`,
      message: `${winnerName} defeated ${loserName}! Total prize pool: $${totalPrizePool}`,
      messageAr: `انتصر ${winnerName} على ${loserName}! إجمالي الجوائز: $${totalPrizePool}`,
      link: `/challenges/completed/${challengeId}`,
      metadata: {
        challengeId,
        gameType,
        winner: winnerId,
        winnerName,
        totalPrizePool,
      },
    };

    // TODO: Implement actual spectator notification
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Notify user about challenge cancellation and penalty
 */
export async function notifyChallengeWithdrawal(
  userId: string,
  challengeId: string,
  penaltyAmount: number,
  currencyType: 'usd' | 'project'
): Promise<{ success: boolean; error?: string }> {
  try {
    const currencyUnit = currencyType === 'usd' ? '$' : 'VEX';

    await sendUserNotification(userId, {
      type: 'warning',
      priority: 'high',
      title: 'Challenge Withdrawn',
      titleAr: 'تم إلغاء التحدي',
      message: `You withdrew your challenge. A penalty of ${currencyUnit}${penaltyAmount} (30%) has been applied.`,
      messageAr: `لقد قمت بإلغاء التحدي. تم تطبيق عقوبة ${currencyUnit}${penaltyAmount} (30%).`,
      link: `/challenges/my`,
      metadata: {
        challengeId,
        penaltyAmount,
        currencyType,
      },
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Notify user about match abandonment
 */
export async function notifyGameAbandonmentPenalty(
  userId: string,
  challengeId: string,
  opponentName: string,
  penalty: number,
  reason: 'timeout' | 'disconnect' | 'inactivity'
): Promise<{ success: boolean; error?: string }> {
  try {
    const reasonText = {
      timeout: 'Time limit exceeded',
      disconnect: 'Connection lost',
      inactivity: 'Game inactivity for 15 minutes',
    };

    await sendUserNotification(userId, {
      type: 'warning',
      priority: 'high',
      title: 'Match Lost - Abandonment',
      titleAr: 'خسرت المباراة - انسحاب',
      message: `Your match against ${opponentName} was forfeited. Reason: ${reasonText[reason]}. Penalty: $${penalty}`,
      messageAr: `فقدت مباراتك ضد ${opponentName}. السبب: ${reasonText[reason]}. عقوبة: $${penalty}`,
      link: `/challenges/my`,
      metadata: {
        challengeId,
        opponentName,
        penalty,
        reason,
      },
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(
  notificationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Note: notifications table needs an id field for this to work
    // Currently using composite primary key, might need to adjust schema
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
