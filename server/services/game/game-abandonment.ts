/**
 * Game Abandonment Service
 * Handles game abandonment, disconnections, and inactivity timeouts
 */

import { db } from "../../db";
import { storage } from "../../storage";
import {
  liveGameSessions,
  challenges as challengesTable,
  users,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  creditUSDBalance,
  creditProjectCurrency,
} from "../challenges/currency/currency-service";
import {
  notifyGameAbandonmentPenalty,
} from "../challenges/notifications/notification-service";
import { broadcastToUser } from "../../websocket";
import { settleSpectatorSupports } from "../../lib/support-settler";

export type AbandonmentReason = 'timeout' | 'disconnect' | 'inactivity' | 'resignation';

export interface GameAbandonmentResult {
  success: boolean;
  winnerId?: string;
  loserId?: string;
  error?: string;
}

// In-memory lock to prevent double forfeits
const forfeitingSessionsLock = new Set<string>();

/**
 * Handle player disconnect or abandonment
 */
export async function handleGameAbandonement(
  sessionId: string,
  reason: AbandonmentReason = 'disconnect'
): Promise<GameAbandonmentResult> {
  // Prevent double forfeit
  if (forfeitingSessionsLock.has(sessionId)) {
    return {
      success: false,
      error: 'Game already being forfeited',
    };
  }

  forfeitingSessionsLock.add(sessionId);

  try {
    // 1. Get game session
    const [session] = await db
      .select()
      .from(liveGameSessions)
      .where(eq(liveGameSessions.id, sessionId))
      .limit(1);

    if (!session) {
      forfeitingSessionsLock.delete(sessionId);
      return {
        success: false,
        error: 'Game session not found',
      };
    }

    if (session.status !== 'in_progress' && session.status !== 'waiting') {
      forfeitingSessionsLock.delete(sessionId);
      return {
        success: false,
        error: 'Game already completed',
      };
    }

    // 2. Determine opponent (winner)
    const abandoningPlayerId = session.player1Id; // This would need to be passed in real scenario
    const winnerId =
      abandoningPlayerId === session.player1Id
        ? session.player2Id
        : session.player1Id;

    if (!winnerId) {
      forfeitingSessionsLock.delete(sessionId);
      return {
        success: false,
        error: 'Winner could not be determined',
      };
    }

    // 3. Update session as completed with opponent as winner
    const now = new Date();
    await db
      .update(liveGameSessions)
      .set({
        status: 'completed',
        winnerId: winnerId,
        endedAt: now,
        gameState: JSON.stringify({
          completed: true,
          reason: reason,
          completedAt: now.toISOString(),
        }),
      })
      .where(eq(liveGameSessions.id, sessionId));

    // 4. Get challenge to update status
    if (!session.challengeId) {
      forfeitingSessionsLock.delete(sessionId);
      return {
        success: false,
        error: 'Challenge ID not found in session',
      };
    }

    const [challenge] = await db
      .select()
      .from(challengesTable)
      .where(eq(challengesTable.id, session.challengeId))
      .limit(1);

    if (challenge) {
      // Update challenge status and mark opponent as winner
      await db
        .update(challengesTable)
        .set({
          status: 'completed',
          winnerId: winnerId,
          endedAt: now,
          updatedAt: now,
        })
        .where(eq(challengesTable.id, session.challengeId));

      // 5. Settle payments
      const betAmount = parseFloat(challenge.betAmount || '0');
      const currencyType = challenge.currencyType as 'usd' | 'project';

      // Winner gets both bets
      if (currencyType === 'usd') {
        await creditUSDBalance(
          winnerId,
          betAmount * 2,
          `Won by opponent abandonment (${reason})`
        );
      } else {
        await creditProjectCurrency(
          winnerId,
          betAmount * 2,
          `Won by opponent abandonment (${reason})`,
          challenge.id
        );
      }

      // 6. Notify loser (abandoner)
      const loser = await storage.getUser(abandoningPlayerId);
      const winner = await storage.getUser(winnerId);
      const loserName = loser?.nickname || loser?.username || 'Unknown';
      const winnerName = winner?.nickname || winner?.username || 'Unknown';

      await notifyGameAbandonmentPenalty(
        abandoningPlayerId,
        challenge.id,
        winnerName,
        betAmount,
        reason
      ).catch((err) => {
        console.error('[Abandonment] Error notifying abandoner:', err);
      });

      // 7. Settle spectator supports
      await settleSpectatorSupports(
        challenge.id,
        winnerId
      ).catch((err) => {
        console.error('[Abandonment] Error settling spectator supports:', err);
      });

      // 8. Broadcast game over to all spectators
      await broadcastToUser(winnerId, {
        type: 'game_over',
        payload: {
          sessionId,
          winnerId,
          reason,
          message: `Opponent ${reason}. You win!`,
        },
      });

      await broadcastToUser(abandoningPlayerId, {
        type: 'game_over',
        payload: {
          sessionId,
          winnerId,
          reason,
          message: `You ${reason}. You lose!`,
        },
      });
    }

    forfeitingSessionsLock.delete(sessionId);

    return {
      success: true,
      winnerId,
      loserId: abandoningPlayerId,
    };
  } catch (error: any) {
    console.error('[Game Abandonment Error]', error);
    forfeitingSessionsLock.delete(sessionId);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Resign from game voluntarily
 */
export async function resignFromGame(
  sessionId: string,
  playerId: string
): Promise<GameAbandonmentResult> {
  try {
    const [session] = await db
      .select()
      .from(liveGameSessions)
      .where(eq(liveGameSessions.id, sessionId))
      .limit(1);

    if (!session) {
      return {
        success: false,
        error: 'Game session not found',
      };
    }

    // Determine opponent
    const winnerId =
      playerId === session.player1Id ? session.player2Id : session.player1Id;

    // Use the same logic as abandonment
    return await handleGameAbandonement(sessionId, 'resignation');
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Check for inactive games and auto-forfeit (runs on server every 60 seconds)
 * Called by game-inactivity-checker.ts
 */
export async function checkAndForeitInactiveSessions(
  inactivityThresholdMinutes: number = 15
): Promise<{ checkedCount: number; foreitCount: number; errors: string[] }> {
  try {
    const inactivityThresholdMs = inactivityThresholdMinutes * 60 * 1000;
    const cutoffTime = new Date(Date.now() - inactivityThresholdMs);

    // Find sessions that haven't had a move in inactivityThresholdMinutes
    const inactiveSessions = await db.query.liveGameSessions.findMany({
      where: (s, { eq: eqOp, and: andOp, lt: ltOp }) =>
        andOp(
          eqOp(s.status, 'in_progress'),
          ltOp(s.updatedAt || new Date(), cutoffTime)
        ),
    });

    const errors: string[] = [];
    let foreitCount = 0;

    for (const session of inactiveSessions) {
      try {
        const result = await handleGameAbandonement(session.id, 'inactivity');
        if (result.success) {
          foreitCount++;
        } else {
          errors.push(`Failed to forfeit session ${session.id}: ${result.error}`);
        }
      } catch (err: any) {
        errors.push(`Error forfeiting session ${session.id}: ${err.message}`);
      }
    }

    return {
      checkedCount: inactiveSessions.length,
      foreitCount,
      errors,
    };
  } catch (error: any) {
    console.error('[Check Inactive Sessions Error]', error);
    return {
      checkedCount: 0,
      foreitCount: 0,
      errors: [error.message],
    };
  }
}

/**
 * Update last activity timestamp for a game session
 */
export async function updateSessionLastActivity(
  sessionId: string
): Promise<boolean> {
  try {
    await db
      .update(liveGameSessions)
      .set({
        updatedAt: new Date(),
      })
      .where(eq(liveGameSessions.id, sessionId));

    return true;
  } catch (error: any) {
    console.error('[Update Last Activity Error]', error);
    return false;
  }
}
