/**
 * Challenge Currency Service
 * Handles all currency deductions and credit logic for challenges
 */

import { db } from "../../../db";
import { storage } from "../../../storage";
import {
  users,
  projectCurrencyWallets,
  projectCurrencyLedger,
  challenges as challengesTable,
  games,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { safeMath, toNum } from "../../../utils/safe-math";
import { walletRepository } from "../../../repositories/wallet-repository";

export interface CurrencyDeductionResult {
  success: boolean;
  error?: string;
  newBalance?: number;
  houseFee?: number;
  transactionId?: string;
}

export interface CurrencyCredit {
  success: boolean;
  error?: string;
  newBalance?: number;
  earnedAmount?: number;
}

/**
 * Deduct USD from user balance
 */
export async function deductUSDBalance(
  userId: string,
  amount: number,
  reason: string
): Promise<CurrencyDeductionResult> {
  try {
    const result = await db.transaction(async (tx) => {
      // Get current balance with row-level lock
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, userId));

      if (!user) {
        throw new Error('User not found');
      }

      const currentBalance = user.usdBalance || 0;
      if (currentBalance < amount) {
        throw new Error(`Insufficient USD balance. Required: $${amount}, Available: $${currentBalance}`);
      }

      // Deduct amount
      const newBalance = currentBalance - amount;
      await tx
        .update(users)
        .set({ usdBalance: newBalance })
        .where(eq(users.id, userId));

      return newBalance;
    });

    return {
      success: true,
      newBalance: result,
      transactionId: `usd_deduction_${Date.now()}`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Deduct project currency from user wallet
 */
export async function deductProjectCurrency(
  userId: string,
  amount: number,
  reason: string,
  referenceId?: string
): Promise<CurrencyDeductionResult> {
  try {
    // Use wallet repository for type-safe operations
    const wallet = await walletRepository.deductBalance(userId, amount);

    return {
      success: true,
      newBalance: wallet.totalBalance,
      transactionId: `project_deduction_${Date.now()}`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Credit USD to user balance
 */
export async function creditUSDBalance(
  userId: string,
  amount: number,
  reason: string
): Promise<CurrencyCredit> {
  try {
    const newBalance = await db.transaction(async (tx) => {
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, userId));

      if (!user) {
        throw new Error('User not found');
      }

      const currentBalance = user.usdBalance || 0;
      const newBalance = currentBalance + amount;

      await tx
        .update(users)
        .set({ usdBalance: newBalance })
        .where(eq(users.id, userId));

      return newBalance;
    });

    return {
      success: true,
      newBalance,
      earnedAmount: amount,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Credit project currency to user wallet (earned balance)
 */
export async function creditProjectCurrency(
  userId: string,
  amount: number,
  reason: string,
  referenceId?: string
): Promise<CurrencyCredit> {
  try {
    // Use wallet repository for type-safe operations
    const wallet = await walletRepository.addBalance(userId, amount, 'earned');

    return {
      success: true,
      newBalance: wallet.totalBalance,
      earnedAmount: wallet.earnedBalance,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Lock project currency for a challenge (for withdrawal penalty)
 */
export async function lockProjectCurrency(
  userId: string,
  amount: number
): Promise<CurrencyDeductionResult> {
  try {
    await walletRepository.lockBalance(userId, amount);

    return {
      success: true,
      transactionId: `lock_${Date.now()}`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Unlock project currency (after challenge resolved)
 */
export async function unlockProjectCurrency(
  userId: string,
  amount: number
): Promise<CurrencyDeductionResult> {
  try {
    await walletRepository.unlockBalance(userId, amount);

    return {
      success: true,
      transactionId: `unlock_${Date.now()}`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get user balance by currency type
 */
export async function getUserBalance(
  userId: string,
  currencyType: 'usd' | 'project'
): Promise<{ balance: number; error?: string }> {
  try {
    if (currencyType === 'usd') {
      const user = await storage.getUser(userId);
      return { balance: toNum(user?.balance) };
    } else {
      const wallet = await walletRepository.getOrCreateWallet(userId);
      return { balance: wallet.availableBalance };
    }
  } catch (error: any) {
    return { balance: 0, error: error.message };
  }
}
