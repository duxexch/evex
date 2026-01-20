/**
 * Wallet Repository - Centralized wallet operations with type safety
 */

import { db } from '../db';
import { projectCurrencyWallets } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { WalletBalanceSchema, type WalletBalance } from '../validators/wallet-schemas';

export class WalletRepository {
  /**
   * Get wallet with auto-parsed numbers and computed fields
   */
  async getWallet(userId: string): Promise<WalletBalance | null> {
    const wallet = await db.query.projectCurrencyWallets.findFirst({
      where: eq(projectCurrencyWallets.userId, userId),
    });
    
    if (!wallet) return null;
    
    // Zod transforms string decimals to numbers automatically
    return WalletBalanceSchema.parse(wallet);
  }

  /**
   * Get or create wallet for user
   */
  async getOrCreateWallet(userId: string): Promise<WalletBalance> {
    let wallet = await this.getWallet(userId);
    
    if (!wallet) {
      await db.insert(projectCurrencyWallets).values({
        userId,
        purchasedBalance: '0.00',
        earnedBalance: '0.00',
        totalBalance: '0.00',
        lockedBalance: '0.00',
        totalSpent: '0.00',
        totalEarned: '0.00',
        totalConverted: '0.00',
      });
      
      wallet = await this.getWallet(userId);
      if (!wallet) throw new Error('Failed to create wallet');
    }
    
    return wallet;
  }

  /**
   * Check if user has sufficient balance
   */
  async hasSufficientBalance(
    userId: string, 
    requiredAmount: number
  ): Promise<{ sufficient: boolean; available: number; required: number }> {
    const wallet = await this.getOrCreateWallet(userId);

    return {
      sufficient: wallet.availableBalance >= requiredAmount,
      available: wallet.availableBalance,
      required: requiredAmount,
    };
  }

  /**
   * Deduct balance atomically (earned first, then purchased)
   */
  async deductBalance(
    userId: string,
    amount: number
  ): Promise<WalletBalance> {
    const wallet = await this.getOrCreateWallet(userId);

    if (wallet.availableBalance < amount) {
      throw new Error(
        `Insufficient balance. Available: ${wallet.availableBalance}, Required: ${amount}`
      );
    }

    // Calculate deductions (earned balance used first)
    const earnedDeduction = Math.min(amount, wallet.earnedBalance);
    const purchasedDeduction = amount - earnedDeduction;

    const newEarned = wallet.earnedBalance - earnedDeduction;
    const newPurchased = wallet.purchasedBalance - purchasedDeduction;
    const newTotal = wallet.totalBalance - amount;
    const newSpent = wallet.totalSpent + amount;

    // Update database
    await db.update(projectCurrencyWallets)
      .set({
        earnedBalance: newEarned.toFixed(2),
        purchasedBalance: newPurchased.toFixed(2),
        totalBalance: newTotal.toFixed(2),
        totalSpent: newSpent.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(projectCurrencyWallets.userId, userId));

    // Return updated wallet
    const updated = await this.getWallet(userId);
    if (!updated) throw new Error('Failed to update wallet');
    return updated;
  }

  /**
   * Add balance (earned or purchased)
   */
  async addBalance(
    userId: string,
    amount: number,
    type: 'earned' | 'purchased' = 'earned'
  ): Promise<WalletBalance> {
    const wallet = await this.getOrCreateWallet(userId);

    const updates: any = {
      totalBalance: (wallet.totalBalance + amount).toFixed(2),
      updatedAt: new Date(),
    };

    if (type === 'earned') {
      updates.earnedBalance = (wallet.earnedBalance + amount).toFixed(2);
      updates.totalEarned = (wallet.totalEarned + amount).toFixed(2);
    } else {
      updates.purchasedBalance = (wallet.purchasedBalance + amount).toFixed(2);
    }

    await db.update(projectCurrencyWallets)
      .set(updates)
      .where(eq(projectCurrencyWallets.userId, userId));

    const updated = await this.getWallet(userId);
    if (!updated) throw new Error('Failed to update wallet');
    return updated;
  }

  /**
   * Lock balance for pending transactions
   */
  async lockBalance(userId: string, amount: number): Promise<void> {
    const wallet = await this.getOrCreateWallet(userId);

    if (wallet.availableBalance < amount) {
      throw new Error('Insufficient balance to lock');
    }

    await db.update(projectCurrencyWallets)
      .set({
        lockedBalance: (wallet.lockedBalance + amount).toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(projectCurrencyWallets.userId, userId));
  }

  /**
   * Unlock balance after transaction completion/cancellation
   */
  async unlockBalance(userId: string, amount: number): Promise<void> {
    const wallet = await this.getOrCreateWallet(userId);

    const newLocked = Math.max(0, wallet.lockedBalance - amount);

    await db.update(projectCurrencyWallets)
      .set({
        lockedBalance: newLocked.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(projectCurrencyWallets.userId, userId));
  }
}

// Singleton instance
export const walletRepository = new WalletRepository();
