/**
 * Challenge Creation Service
 * Handles all logic for creating new challenges
 */

import { v4 as uuidv4 } from 'uuid';
import { db } from "../../../db";
import { storage } from "../../../storage";
import {
  challenges as challengesTable,
  games,
  liveGameSessions,
} from "@shared/schema";
import { eq, or, ne, desc, and, sql } from "drizzle-orm";
import {
  deductUSDBalance,
  deductProjectCurrency,
} from "../currency/currency-service";
import {
  validateChallengeCreation,
  ChallengeValidationData,
} from "../validation/challenge-validator";
import {
  notifyFollowersAboutChallenge,
  notifyGameEnthusiastsAboutChallenge,
} from "../notifications/notification-service";

export interface CreateChallengeRequest {
  gameType: string;
  betAmount: number;
  currencyType: 'usd' | 'project';
  visibility: 'public' | 'private';
  opponentType: 'random' | 'friend';
  friendAccountId?: string;
  userId: string;
  timeLimit?: number;
}

export interface ChallengeCreatedResponse {
  success: boolean;
  challengeId?: string;
  challenge?: any;
  error?: string;
  errorCode?: string;
}

/**
 * Create a new challenge with all validations and notifications
 */
export async function createChallenge(
  request: CreateChallengeRequest
): Promise<ChallengeCreatedResponse> {
  const {
    gameType,
    betAmount,
    currencyType,
    visibility,
    opponentType,
    friendAccountId,
    userId,
    timeLimit = 300,
  } = request;

  try {
    // 1. Validate request
    const validation = await validateChallengeCreation({
      gameType,
      betAmount,
      currencyType,
      userId,
    } as ChallengeValidationData);

    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        errorCode: validation.errorCode,
      };
    }

    // 2. Get game configuration
    const gameRecord = await db.query.games.findFirst({
      where: (g) => sql`LOWER(${g.name}) = LOWER(${gameType})`,
    });

    if (!gameRecord) {
      return {
        success: false,
        error: `Game "${gameType}" not found`,
        errorCode: 'GAME_NOT_FOUND',
      };
    }

    // 3. Deduct bet amount in atomic transaction
    let deductionResult;
    if (currencyType === 'usd') {
      deductionResult = await deductUSDBalance(
        userId,
        betAmount,
        `Challenge creation for ${gameType}`
      );
    } else {
      deductionResult = await deductProjectCurrency(
        userId,
        betAmount,
        `Challenge creation for ${gameType}`
      );
    }

    if (!deductionResult.success) {
      return {
        success: false,
        error: deductionResult.error,
        errorCode: 'DEDUCTION_FAILED',
      };
    }

    // 4. Create challenge in database
    const challengeId = uuidv4();
    const now = new Date();

    const [newChallenge] = await db
      .insert(challengesTable)
      .values({
        id: challengeId,
        gameType,
        betAmount: betAmount.toString(),
        currencyType,
        visibility,
        status: 'waiting',
        player1Id: userId,
        player2Id: null,
        timeLimit,
        player1Score: 0,
        player2Score: 0,
        startedAt: null,
        endedAt: null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // 5. Get player details for notifications
    const player1 = await storage.getUser(userId);
    const playerName = player1?.nickname || player1?.username || 'Unknown';

    // 6. Send notifications (async, don't block response)
    // Notify followers
    notifyFollowersAboutChallenge(
      userId,
      challengeId,
      gameType,
      betAmount
    ).catch((err) => {
      console.error('[Challenge Creation] Error notifying followers:', err);
    });

    // Notify game enthusiasts
    notifyGameEnthusiastsAboutChallenge(
      gameType,
      challengeId,
      playerName,
      betAmount,
      userId
    ).catch((err) => {
      console.error('[Challenge Creation] Error notifying enthusiasts:', err);
    });

    return {
      success: true,
      challengeId,
      challenge: {
        id: newChallenge.id,
        gameType: newChallenge.gameType,
        betAmount: parseFloat(newChallenge.betAmount || '0'),
        currencyType: newChallenge.currencyType,
        visibility: newChallenge.visibility,
        status: newChallenge.status,
        player1Id: newChallenge.player1Id,
        player1Name: playerName,
        timeLimit: newChallenge.timeLimit,
        createdAt: newChallenge.createdAt?.toISOString(),
      },
    };
  } catch (error: any) {
    console.error('[Challenge Creation Error]', error);
    return {
      success: false,
      error: error.message || 'Failed to create challenge',
      errorCode: 'CREATION_ERROR',
    };
  }
}

/**
 * Get available challenges for a user
 */
export async function getAvailableChallenges(userId: string) {
  try {
    const challenges = await db
      .select()
      .from(challengesTable)
      .where(
        and(
          eq(challengesTable.status, 'waiting'),
          ne(challengesTable.player1Id, userId),
          eq(challengesTable.visibility, 'public')
        )
      )
      .orderBy(desc(challengesTable.createdAt))
      .limit(20);

    // Enrich with player details
    const enriched = await Promise.all(
      challenges.map(async (c) => {
        const player1 = await storage.getUser(c.player1Id);
        return {
          id: c.id,
          gameType: c.gameType,
          betAmount: parseFloat(c.betAmount || '0'),
          visibility: c.visibility,
          status: c.status,
          player1Id: c.player1Id,
          player1Name: player1?.nickname || player1?.username || 'Unknown',
          timeLimit: c.timeLimit,
          createdAt: c.createdAt?.toISOString(),
          spectatorCount: Math.floor(Math.random() * 50) + 5, // TODO: Get real count
          totalBets: Math.floor(Math.random() * 500) + 50, // TODO: Get real sum
        };
      })
    );

    return enriched;
  } catch (error: any) {
    console.error('[Get Available Challenges Error]', error);
    return [];
  }
}

/**
 * Get public challenges (for Arena view)
 */
export async function getPublicChallenges() {
  try {
    const challenges = await db
      .select()
      .from(challengesTable)
      .where(
        eq(challengesTable.visibility, 'public')
      )
      .orderBy(desc(challengesTable.createdAt))
      .limit(10);

    return challenges;
  } catch (error: any) {
    console.error('[Get Public Challenges Error]', error);
    return [];
  }
}

/**
 * Get user's challenges (MY CHALLENGES tab)
 */
export async function getUserChallenges(userId: string) {
  try {
    const myChallenges = await db
      .select()
      .from(challengesTable)
      .where(
        or(
          eq(challengesTable.player1Id, userId),
          eq(challengesTable.player2Id, userId)
        )
      )
      .orderBy(desc(challengesTable.createdAt))
      .limit(50);

    // Enrich with player details
    const enriched = await Promise.all(
      myChallenges.map(async (c) => {
        const player1 = await storage.getUser(c.player1Id);
        const player2 = c.player2Id
          ? await storage.getUser(c.player2Id)
          : null;

        return {
          ...c,
          betAmount: parseFloat(c.betAmount || '0'),
          player1Name: player1?.nickname || player1?.username,
          player2Name: player2?.nickname || player2?.username,
        };
      })
    );

    return enriched;
  } catch (error: any) {
    console.error('[Get User Challenges Error]', error);
    return [];
  }
}
