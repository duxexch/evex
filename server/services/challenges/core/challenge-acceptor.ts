/**
 * Challenge Acceptance Service
 * Handles challenge acceptance and automatic game opening
 */

import { db } from "../../../db";
import { storage } from "../../../storage";
import {
  challenges as challengesTable,
  liveGameSessions,
  games,
  projectCurrencyWallets,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  deductUSDBalance,
  deductProjectCurrency,
  lockProjectCurrency,
} from "../currency/currency-service";
import {
  validateChallengeAcceptance,
} from "../validation/challenge-validator";
import {
  notifyPlayersAboutChallengeStart,
} from "../notifications/notification-service";
import { broadcastToUser } from "../../../websocket";
import { 
  queueGameStartMessage, 
  markMessageAsDelivered,
  type GameStartMessage 
} from "./game-start-queue";
import { initiateGameStart } from "./game-start-manager";

export interface AcceptChallengeRequest {
  challengeId: string;
  userId: string;
}

export interface ChallengeAcceptanceResponse {
  success: boolean;
  challenge?: any;
  redirectUrl?: string;
  error?: string;
  errorCode?: string;
}

// In-memory lock to prevent race conditions
const challengeAcceptanceLocks = new Set<string>();

/**
 * Accept a challenge and automatically open game for both players
 */
export async function acceptChallenge(
  request: AcceptChallengeRequest
): Promise<ChallengeAcceptanceResponse> {
  const { challengeId, userId } = request;

  // Prevent concurrent acceptances
  if (challengeAcceptanceLocks.has(challengeId)) {
    return {
      success: false,
      error: 'Challenge is being processed',
      errorCode: 'RACE_CONDITION',
    };
  }

  challengeAcceptanceLocks.add(challengeId);

  try {
    // 1. Validate acceptance
    const validation = await validateChallengeAcceptance(challengeId, userId);
    if (!validation.valid) {
      challengeAcceptanceLocks.delete(challengeId);
      return {
        success: false,
        error: validation.error,
        errorCode: validation.errorCode,
      };
    }

    // 2. Get challenge details
    const [challenge] = await db
      .select()
      .from(challengesTable)
      .where(eq(challengesTable.id, challengeId))
      .limit(1);

    if (!challenge) {
      challengeAcceptanceLocks.delete(challengeId);
      return {
        success: false,
        error: 'Challenge not found',
        errorCode: 'CHALLENGE_NOT_FOUND',
      };
    }

    const betAmount = parseFloat(challenge.betAmount || '0');
    const currencyType = challenge.currencyType as 'usd' | 'project';

    // 3. Deduct bet amount from player2
    let deductionResult;
    if (currencyType === 'usd') {
      deductionResult = await deductUSDBalance(
        userId,
        betAmount,
        `Challenge acceptance for ${challenge.gameType}`
      );
    } else {
      deductionResult = await deductProjectCurrency(
        userId,
        betAmount,
        `Challenge acceptance for ${challenge.gameType}`,
        challengeId
      );
    }

    if (!deductionResult.success) {
      challengeAcceptanceLocks.delete(challengeId);
      return {
        success: false,
        error: deductionResult.error,
        errorCode: 'DEDUCTION_FAILED',
      };
    }

    // 4. Update challenge with player2 and mark as active
    const now = new Date();
    const [updatedChallenge] = await db
      .update(challengesTable)
      .set({
        player2Id: userId,
        status: 'active',
        startedAt: now,
        updatedAt: now,
      })
      .where(eq(challengesTable.id, challengeId))
      .returning();

    // 5. Get game record to link to live session
    const gameRecord = await db.query.games.findFirst({
      where: (g) => sql`LOWER(${g.name}) = LOWER(${challenge.gameType})`,
    });

    if (!gameRecord) {
      challengeAcceptanceLocks.delete(challengeId);
      return {
        success: false,
        error: `Game "${challenge.gameType}" not found`,
        errorCode: 'GAME_NOT_FOUND',
      };
    }

    // 6. Create live game session
    const [gameSession] = await db
      .insert(liveGameSessions)
      .values({
        gameId: gameRecord.id,
        gameType: challenge.gameType,
        player1Id: challenge.player1Id,
        player2Id: userId,
        status: 'waiting',
        gameState: JSON.stringify({
          initialized: true,
          createdAt: now.toISOString(),
        }),
        player1Score: 0,
        player2Score: 0,
        spectatorCount: 0,
        totalGiftsValue: '0',
        startedAt: now,
      })
      .returning();

    // 7. Get player details
    const player1 = await storage.getUser(challenge.player1Id);
    const player2 = await storage.getUser(userId);

    const player1Name = player1?.nickname || player1?.username || 'Player 1';
    const player2Name = player2?.nickname || player2?.username || 'Player 2';

    // 8. Send notifications to both players (async)
    notifyPlayersAboutChallengeStart(
      challengeId,
      challenge.player1Id,
      player1Name,
      userId,
      player2Name,
      challenge.gameType
    ).catch((err) => {
      console.error('[Challenge Acceptance] Error notifying players:', err);
    });

    // 9. Initiate game start with professional delivery system
    const gameStartResult = await initiateGameStart(
      challengeId,
      gameSession.id,
      challenge.gameType,
      challenge.player1Id,
      player1Name,
      userId,
      player2Name
    );

    if (!gameStartResult.success) {
      console.error('[Challenge Acceptance] Failed to initiate game start:', gameStartResult.message);
      // Continue anyway - at minimum the game session is created
    }

    challengeAcceptanceLocks.delete(challengeId);

    return {
      success: true,
      redirectUrl: `/challenge/${challengeId}/play`,
      challenge: {
        id: updatedChallenge.id,
        gameType: updatedChallenge.gameType,
        betAmount: parseFloat(updatedChallenge.betAmount || '0'),
        status: updatedChallenge.status,
        player1Id: updatedChallenge.player1Id,
        player2Id: updatedChallenge.player2Id,
        sessionId: gameSession.id,
      },
    };
  } catch (error: any) {
    console.error('[Challenge Acceptance Error]', error);
    challengeAcceptanceLocks.delete(challengeId);
    return {
      success: false,
      error: error.message || 'Failed to accept challenge',
      errorCode: 'ACCEPTANCE_ERROR',
    };
  }
}

/**
 * Handle automatic game window opening on client side via WebSocket
 * This message is received by both players and triggers navigation
 */
export function handleChallengeAcceptedMessage(
  message: {
    type: 'challenge_accepted';
    payload: {
      challengeId: string;
      sessionId: string;
      gameType: string;
      player1Id: string;
      player2Id: string;
      redirectUrl: string;
    };
  }
) {
  // This runs on client side in challenge-game.tsx
  // Automatically navigates to /challenge/{id}/play
  // Triggers WebSocket connection to game room
  return {
    autoNavigate: true,
    targetPath: message.payload.redirectUrl,
  };
}

/**
 * Get challenge details with player information
 */
export async function getChallengeDetails(challengeId: string) {
  try {
    const [challenge] = await db
      .select()
      .from(challengesTable)
      .where(eq(challengesTable.id, challengeId))
      .limit(1);

    if (!challenge) {
      return null;
    }

    const player1 = await storage.getUser(challenge.player1Id);
    const player2 = challenge.player2Id
      ? await storage.getUser(challenge.player2Id)
      : null;

    return {
      ...challenge,
      betAmount: parseFloat(challenge.betAmount || '0'),
      player1Name: player1?.nickname || player1?.username,
      player2Name: player2?.nickname || player2?.username,
      player1: {
        id: challenge.player1Id,
        username: player1?.username,
        nickname: player1?.nickname,
        profilePicture: player1?.profilePicture,
        vipLevel: player1?.vipLevel,
      },
      player2: player2
        ? {
            id: challenge.player2Id,
            username: player2?.username,
            nickname: player2?.nickname,
            profilePicture: player2?.profilePicture,
            vipLevel: player2?.vipLevel,
          }
        : null,
    };
  } catch (error: any) {
    console.error('[Get Challenge Details Error]', error);
    return null;
  }
}
