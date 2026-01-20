/**
 * Zod validation schemas with automatic decimal to number transformation
 */

import { z } from 'zod';

// Transform string decimal to number with validation
const decimalToNumber = z.union([
  z.string().transform(val => parseFloat(val || '0')),
  z.number(),
]).pipe(z.number());

/**
 * Wallet balance schema with auto-transformation and computed fields
 */
export const WalletBalanceSchema = z.object({
  id: z.string(),
  userId: z.string(),
  purchasedBalance: decimalToNumber,
  earnedBalance: decimalToNumber,
  totalBalance: decimalToNumber,
  lockedBalance: decimalToNumber,
  totalSpent: decimalToNumber,
  totalEarned: decimalToNumber,
  totalConverted: decimalToNumber,
  createdAt: z.date(),
  updatedAt: z.date(),
}).transform(wallet => ({
  ...wallet,
  availableBalance: wallet.totalBalance - wallet.lockedBalance,
}));

export type WalletBalance = z.infer<typeof WalletBalanceSchema>;

/**
 * User balance schema
 */
export const UserBalanceSchema = z.object({
  balance: decimalToNumber,
  totalDeposited: decimalToNumber,
  totalWithdrawn: decimalToNumber,
  totalWagered: decimalToNumber,
  totalWon: decimalToNumber,
});

export type UserBalance = z.infer<typeof UserBalanceSchema>;

/**
 * Challenge stake validation schema
 */
export const ChallengeStakeSchema = z.object({
  amount: decimalToNumber,
  minStake: decimalToNumber,
  maxStake: decimalToNumber,
  houseFee: decimalToNumber.optional().default(0.05),
});

export type ChallengeStake = z.infer<typeof ChallengeStakeSchema>;

/**
 * Transaction amount schema
 */
export const TransactionAmountSchema = z.object({
  amount: decimalToNumber,
  balanceBefore: decimalToNumber,
  balanceAfter: decimalToNumber,
});

export type TransactionAmount = z.infer<typeof TransactionAmountSchema>;
