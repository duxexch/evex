/**
 * Challenge Validation Service
 * Handles all validation logic for challenge creation and acceptance
 */

import { db } from "../../../db";
import { storage } from "../../../storage";
import { challenges as challengesTable, projectCurrencyWallets, users } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { safeMath, toNum } from "../../../utils/safe-math";
import { walletRepository } from "../../../repositories/wallet-repository";

export interface ValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: string;
}

export interface ChallengeValidationData {
  gameType: string;
  betAmount: number;
  currencyType: 'usd' | 'project';
  userId: string;
}

/**
 * Validate challenge creation request
 */
export async function validateChallengeCreation(
  data: ChallengeValidationData
): Promise<ValidationResult> {
  const { gameType, betAmount, currencyType, userId } = data;

  // 1. Validate game exists
  const gameExists = await db.query.games.findFirst({
    where: (games) => eq(games.name, gameType),
  });

  if (!gameExists) {
    return {
      valid: false,
      error: `Game type "${gameType}" not found`,
      errorCode: 'GAME_NOT_FOUND',
    };
  }

  // 2. Validate bet amount
  if (!betAmount || betAmount <= 0) {
    return {
      valid: false,
      error: 'Bet amount must be greater than 0',
      errorCode: 'INVALID_BET_AMOUNT',
    };
  }

  // 3. Validate user exists
  const user = await storage.getUser(userId);
  if (!user) {
    return {
      valid: false,
      error: 'User not found',
      errorCode: 'USER_NOT_FOUND',
    };
  }

  // 4. Check user balance based on currency type
  if (currencyType === 'usd') {
    const balance = toNum(user.balance);
    if (safeMath.isLessThan(balance, betAmount)) {
      return {
        valid: false,
        error: `Insufficient USD balance. Required: $${betAmount}, Available: $${safeMath.format(balance)}`,
        errorCode: 'INSUFFICIENT_USD_BALANCE',
      };
    }
  } else if (currencyType === 'project') {
    // Use wallet repository for type-safe access
    const wallet = await walletRepository.getOrCreateWallet(userId);

    if (safeMath.isLessThan(wallet.availableBalance, betAmount)) {
      return {
        valid: false,
        error: `Insufficient project currency balance. Required: ${betAmount} VEX, Available: ${safeMath.format(wallet.availableBalance)} VEX`,
        errorCode: 'INSUFFICIENT_PROJECT_BALANCE',
      };
    }
  }

  // 5. Validate user has not exceeded challenge limit (optional)
  const userChallenges = await db
    .select()
    .from(challengesTable)
    .where(
      eq(challengesTable.player1Id, userId)
    );

  if (userChallenges.length > 10) {
    return {
      valid: false,
      error: 'Maximum number of active challenges exceeded',
      errorCode: 'CHALLENGE_LIMIT_EXCEEDED',
    };
  }

  return { valid: true };
}

/**
 * Validate challenge acceptance request
 */
export async function validateChallengeAcceptance(
  challengeId: string,
  userId: string
): Promise<ValidationResult> {
  // 1. Challenge exists
  const [challenge] = await db
    .select()
    .from(challengesTable)
    .where(eq(challengesTable.id, challengeId))
    .limit(1);

  if (!challenge) {
    return {
      valid: false,
      error: 'Challenge not found',
      errorCode: 'CHALLENGE_NOT_FOUND',
    };
  }

  // 2. Challenge is in waiting status
  if (challenge.status !== 'waiting') {
    return {
      valid: false,
      error: `Challenge is not available (status: ${challenge.status})`,
      errorCode: 'CHALLENGE_NOT_AVAILABLE',
    };
  }

  // 3. User is not player1
  if (challenge.player1Id === userId) {
    return {
      valid: false,
      error: 'Cannot accept your own challenge',
      errorCode: 'CANNOT_ACCEPT_OWN_CHALLENGE',
    };
  }

  // 4. User is not already player2
  if (challenge.player2Id === userId) {
    return {
      valid: false,
      error: 'You already accepted this challenge',
      errorCode: 'ALREADY_ACCEPTED',
    };
  }

  // 5. Check user balance
  const betAmount = parseFloat(challenge.betAmount || '0');
  const currencyType = challenge.currencyType as 'usd' | 'project';
  const user = await storage.getUser(userId);

  if (!user) {
    return {
      valid: false,
      error: 'User not found',
      errorCode: 'USER_NOT_FOUND',
    };
  }

  if (currencyType === 'usd') {
    const balance = user.usdBalance || 0;
    if (balance < betAmount) {
      return {
        valid: false,
        error: `Insufficient USD balance. Required: $${betAmount}, Available: $${balance}`,
        errorCode: 'INSUFFICIENT_USD_BALANCE',
      };
    }
  } else if (currencyType === 'project') {
    // Use wallet repository
    const wallet = await walletRepository.getOrCreateWallet(userId);

    if (safeMath.isLessThan(wallet.availableBalance, betAmount)) {
      return {
        valid: false,
        error: `Insufficient project currency balance. Required: ${betAmount} VEX, Available: ${safeMath.format(wallet.availableBalance)} VEX`,
        errorCode: 'INSUFFICIENT_PROJECT_BALANCE',
      };
    }
  }

  return { valid: true };
}

/**
 * Validate withdrawal request
 */
export async function validateWithdrawal(
  challengeId: string,
  userId: string
): Promise<ValidationResult> {
  const [challenge] = await db
    .select()
    .from(challengesTable)
    .where(eq(challengesTable.id, challengeId))
    .limit(1);

  if (!challenge) {
    return {
      valid: false,
      error: 'Challenge not found',
      errorCode: 'CHALLENGE_NOT_FOUND',
    };
  }

  if (challenge.status !== 'waiting') {
    return {
      valid: false,
      error: 'Can only withdraw challenges in waiting status',
      errorCode: 'INVALID_STATUS_FOR_WITHDRAWAL',
    };
  }

  if (challenge.player1Id !== userId) {
    return {
      valid: false,
      error: 'Only the challenge creator can withdraw',
      errorCode: 'NOT_CHALLENGE_CREATOR',
    };
  }

  return { valid: true };
}
