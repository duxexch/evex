import {
  users, agents, affiliates, games, transactions, complaints, promoCodes,
  gameSessions, agentPaymentMethods, complaintMessages, complaintAttachments,
  auditLogs, financialLimits, systemSettings, linkAnalytics, promoCodeUsages,
  passwordResetTokens, countryPaymentMethods,
  notifications, userSessions, loginHistory, announcements, announcementViews, userPreferences,
  userRelationships, socialPlatforms,
  liveGameSessions, gameMoves, gameSpectators, giftItems, spectatorGifts, gameChatMessages,
  achievements, userAchievements, seasons, seasonalStats, seasonRewards,
  type User, type InsertUser, type Agent, type InsertAgent,
  type Affiliate, type InsertAffiliate, type Game, type InsertGame,
  type Transaction, type InsertTransaction, type Complaint, type InsertComplaint,
  type PromoCode, type InsertPromoCode, type GameSession, type InsertGameSession,
  type AgentPaymentMethod, type InsertAgentPaymentMethod,
  type ComplaintMessage, type InsertComplaintMessage, type AuditLog, type InsertAuditLog,
  type FinancialLimit, type InsertFinancialLimit, type SystemSetting, type InsertSystemSetting,
  type PasswordResetToken, type InsertPasswordResetToken,
  type CountryPaymentMethod, type InsertCountryPaymentMethod,
  type Notification, type InsertNotification,
  type UserSession, type InsertUserSession,
  type LoginHistory, type InsertLoginHistory,
  type Announcement, type InsertAnnouncement,
  type AnnouncementView,
  type UserPreferences, type InsertUserPreferences,
  type UserRelationship, type InsertUserRelationship,
  type SocialPlatform, type InsertSocialPlatform,
  type LiveGameSession, type InsertLiveGameSession,
  type GameMove, type InsertGameMove,
  type GameSpectator, type InsertGameSpectator,
  type GiftItem, type InsertGiftItem,
  type SpectatorGift, type InsertSpectatorGift,
  type GameChatMessage, type InsertGameChatMessage,
  type Achievement, type InsertAchievement,
  type UserAchievement, type InsertUserAchievement,
  type Season, type InsertSeason,
  type SeasonalStats, type InsertSeasonalStats,
  type SeasonReward, type InsertSeasonReward,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql, asc, or, like, ne } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  listUsers(role?: string): Promise<User[]>;
  updateUserBalance(id: string, amount: string, operation: 'add' | 'subtract'): Promise<User | undefined>;
  updateUserBalanceWithCheck(id: string, amount: string, operation: 'add' | 'subtract'): Promise<{ success: boolean; user?: User; error?: string }>;
  transferBalance(fromUserId: string, toUserId: string, amount: string, options?: { createTransactionRecords?: boolean; transactionType?: 'game_payout' | 'gift' | 'p2p_transfer'; description?: string; sessionId?: string }): Promise<{ success: boolean; fromUser?: User; toUser?: User; error?: string }>;
  settleGamePayout(sessionId: string, winnerId: string, loserId: string, stakeAmount: string, platformFeePercent?: number, gameType?: string): Promise<{ success: boolean; error?: string }>;
  updateGameStats(sessionId: string, gameType: string, winnerId: string | null, player1Id: string, player2Id: string | null, isDraw?: boolean, winAmount?: string): Promise<{ success: boolean; error?: string }>;

  // Agents
  getAgent(id: string): Promise<Agent | undefined>;
  getAgentByUserId(userId: string): Promise<Agent | undefined>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: string, data: Partial<InsertAgent>): Promise<Agent | undefined>;
  listAgents(activeOnly?: boolean): Promise<Agent[]>;
  getAvailableAgentForAssignment(): Promise<Agent | undefined>;

  // Agent Payment Methods
  getAgentPaymentMethods(agentId: string): Promise<AgentPaymentMethod[]>;
  createAgentPaymentMethod(method: InsertAgentPaymentMethod): Promise<AgentPaymentMethod>;
  deleteAgentPaymentMethod(id: string): Promise<boolean>;

  // Affiliates
  getAffiliate(id: string): Promise<Affiliate | undefined>;
  getAffiliateByCode(code: string): Promise<Affiliate | undefined>;
  createAffiliate(affiliate: InsertAffiliate): Promise<Affiliate>;
  updateAffiliate(id: string, data: Partial<InsertAffiliate>): Promise<Affiliate | undefined>;
  listAffiliates(): Promise<Affiliate[]>;

  // Promo Codes
  getPromoCode(id: string): Promise<PromoCode | undefined>;
  getPromoCodeByCode(code: string): Promise<PromoCode | undefined>;
  createPromoCode(promo: InsertPromoCode): Promise<PromoCode>;
  updatePromoCode(id: string, data: Partial<InsertPromoCode>): Promise<PromoCode | undefined>;
  listPromoCodes(affiliateId?: string): Promise<PromoCode[]>;
  incrementPromoCodeUsage(id: string): Promise<void>;

  // Games
  getGame(id: string): Promise<Game | undefined>;
  createGame(game: InsertGame): Promise<Game>;
  updateGame(id: string, data: Partial<InsertGame>): Promise<Game | undefined>;
  deleteGame(id: string): Promise<boolean>;
  listGames(status?: string, section?: string): Promise<Game[]>;
  incrementGamePlayCount(id: string, volume: string): Promise<void>;

  // Game Sessions
  createGameSession(session: InsertGameSession): Promise<GameSession>;
  getGameSessionsByUser(userId: string, limit?: number): Promise<GameSession[]>;
  getGameSessionsByGame(gameId: string, limit?: number): Promise<GameSession[]>;

  // Transactions
  getTransaction(id: string): Promise<Transaction | undefined>;
  createTransaction(tx: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: string, data: Partial<InsertTransaction>): Promise<Transaction | undefined>;
  listTransactions(userId?: string, type?: string, status?: string): Promise<Transaction[]>;
  getPendingTransactions(): Promise<Transaction[]>;

  // Complaints
  getComplaint(id: string): Promise<Complaint | undefined>;
  createComplaint(complaint: InsertComplaint): Promise<Complaint>;
  updateComplaint(id: string, data: Partial<InsertComplaint>): Promise<Complaint | undefined>;
  listComplaints(userId?: string, status?: string): Promise<Complaint[]>;
  getComplaintsByAgent(agentId: string): Promise<Complaint[]>;
  addComplaintMessage(message: InsertComplaintMessage): Promise<ComplaintMessage>;
  getComplaintMessages(complaintId: string): Promise<ComplaintMessage[]>;

  // Audit Logs
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(userId?: string, action?: string): Promise<AuditLog[]>;

  // Financial Limits
  getFinancialLimits(vipLevel?: number): Promise<FinancialLimit[]>;
  createFinancialLimit(limit: InsertFinancialLimit): Promise<FinancialLimit>;
  updateFinancialLimit(id: string, data: Partial<InsertFinancialLimit>): Promise<FinancialLimit | undefined>;

  // System Settings
  getSetting(key: string): Promise<SystemSetting | undefined>;
  setSetting(key: string, value: string, category?: string): Promise<SystemSetting>;
  getSettingsByCategory(category: string): Promise<SystemSetting[]>;

  // Password Reset Tokens
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markTokenAsUsed(id: string): Promise<void>;

  // User lookups
  getUserByAccountId(accountId: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByNickname(nickname: string): Promise<User | undefined>;
  generateUniqueAccountId(): Promise<string>;

  // Country Payment Methods
  listCountryPaymentMethods(): Promise<CountryPaymentMethod[]>;
  createCountryPaymentMethod(method: InsertCountryPaymentMethod): Promise<CountryPaymentMethod>;
  updateCountryPaymentMethod(id: string, data: Partial<InsertCountryPaymentMethod>): Promise<CountryPaymentMethod | undefined>;
  deleteCountryPaymentMethod(id: string): Promise<boolean>;

  // Notifications
  createNotification(notification: InsertNotification): Promise<Notification>;
  getUserNotifications(userId: string, limit?: number): Promise<Notification[]>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  markNotificationAsRead(id: string): Promise<void>;
  markAllNotificationsAsRead(userId: string): Promise<void>;

  // User Sessions
  createUserSession(session: InsertUserSession): Promise<UserSession>;
  getUserSessions(userId: string): Promise<UserSession[]>;
  revokeUserSession(id: string): Promise<void>;
  revokeAllUserSessions(userId: string, exceptSessionId?: string): Promise<void>;

  // Login History
  createLoginHistory(entry: InsertLoginHistory): Promise<LoginHistory>;
  getUserLoginHistory(userId: string, limit?: number): Promise<LoginHistory[]>;

  // Announcements
  createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement>;
  updateAnnouncement(id: string, data: Partial<InsertAnnouncement>): Promise<Announcement | undefined>;
  getAnnouncement(id: string): Promise<Announcement | undefined>;
  listAnnouncements(status?: string): Promise<Announcement[]>;
  getPublishedAnnouncements(target?: string): Promise<Announcement[]>;
  markAnnouncementViewed(announcementId: string, userId: string): Promise<void>;
  getViewedAnnouncementIds(userId: string): Promise<string[]>;

  // User Preferences
  getUserPreferences(userId: string): Promise<UserPreferences | undefined>;
  createOrUpdateUserPreferences(userId: string, prefs: Partial<InsertUserPreferences>): Promise<UserPreferences>;

  // User Relationships
  createUserRelationship(relationship: InsertUserRelationship): Promise<UserRelationship>;
  deleteUserRelationship(userId: string, targetUserId: string, type: string): Promise<boolean>;
  getUserRelationship(userId: string, targetUserId: string, type: string): Promise<UserRelationship | undefined>;
  getUserFollowing(userId: string): Promise<UserRelationship[]>;
  getUserFollowers(userId: string): Promise<UserRelationship[]>;
  getUserBlocked(userId: string): Promise<UserRelationship[]>;
  searchUsers(query: string, excludeUserId: string): Promise<User[]>;
}

export class DatabaseStorage implements IStorage {
  // ==================== USERS ====================
  
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async listUsers(role?: string): Promise<User[]> {
    if (role) {
      return db.select().from(users).where(eq(users.role, role as any)).orderBy(desc(users.createdAt));
    }
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUserBalance(id: string, amount: string, operation: 'add' | 'subtract'): Promise<User | undefined> {
    // ATOMIC balance update using SQL to prevent race conditions
    const changeAmount = parseFloat(amount);
    if (isNaN(changeAmount) || changeAmount < 0) {
      throw new Error('Invalid amount');
    }

    const sqlOp = operation === 'add'
      ? sql`CAST(${users.balance} AS DECIMAL) + ${changeAmount}`
      : sql`CAST(${users.balance} AS DECIMAL) - ${changeAmount}`;

    const [updated] = await db.update(users)
      .set({ 
        balance: sql`CAST(${sqlOp} AS TEXT)`,
        updatedAt: new Date()
      })
      .where(eq(users.id, id))
      .returning();

    return updated || undefined;
  }

  // Atomic balance update with minimum balance check (prevents negative balance)
  async updateUserBalanceWithCheck(id: string, amount: string, operation: 'add' | 'subtract'): Promise<{ success: boolean; user?: User; error?: string }> {
    const changeAmount = parseFloat(amount);
    if (isNaN(changeAmount) || changeAmount < 0) {
      return { success: false, error: 'Invalid amount' };
    }

    return await db.transaction(async (tx) => {
      // Lock the row for update
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, id))
        .for('update');

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      const currentBalance = parseFloat(user.balance);
      
      if (operation === 'subtract' && currentBalance < changeAmount) {
        return { success: false, error: 'Insufficient balance' };
      }

      const newBalance = operation === 'add'
        ? (currentBalance + changeAmount).toFixed(2)
        : (currentBalance - changeAmount).toFixed(2);

      const [updated] = await tx.update(users)
        .set({ balance: newBalance, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();

      return { success: true, user: updated as User };
    });
  }

  // Transactional transfer between two users (for game payouts, gifts, P2P)
  async transferBalance(
    fromUserId: string, 
    toUserId: string, 
    amount: string,
    options?: { 
      createTransactionRecords?: boolean;
      transactionType?: 'game_payout' | 'gift' | 'p2p_transfer';
      description?: string;
      sessionId?: string;
    }
  ): Promise<{ success: boolean; fromUser?: User; toUser?: User; error?: string }> {
    // SECURITY: Prevent self-transfers which could corrupt balance
    if (fromUserId === toUserId) {
      return { success: false, error: 'Cannot transfer to self' };
    }
    
    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return { success: false, error: 'Invalid amount' };
    }

    return await db.transaction(async (tx) => {
      // Lock both rows in consistent order to prevent deadlocks
      const [fromId, toId] = [fromUserId, toUserId].sort();
      
      const [user1] = await tx.select().from(users).where(eq(users.id, fromId)).for('update');
      const [user2] = await tx.select().from(users).where(eq(users.id, toId)).for('update');

      const fromUser = fromId === fromUserId ? user1 : user2;
      const toUser = fromId === fromUserId ? user2 : user1;

      if (!fromUser || !toUser) {
        return { success: false, error: 'User not found' };
      }

      const fromBalance = parseFloat(fromUser.balance);
      const toBalance = parseFloat(toUser.balance);
      
      if (fromBalance < transferAmount) {
        return { success: false, error: 'Insufficient balance' };
      }

      const fromNewBalance = (fromBalance - transferAmount).toFixed(2);
      const toNewBalance = (toBalance + transferAmount).toFixed(2);

      // Update balances atomically
      const [updatedFrom] = await tx.update(users)
        .set({ balance: fromNewBalance, updatedAt: new Date() })
        .where(eq(users.id, fromUserId))
        .returning();

      const [updatedTo] = await tx.update(users)
        .set({ balance: toNewBalance, updatedAt: new Date() })
        .where(eq(users.id, toUserId))
        .returning();

      // Optionally create transaction records for audit trail
      if (options?.createTransactionRecords) {
        await tx.insert(transactions).values({
          userId: fromUserId,
          type: 'withdrawal',
          amount: amount,
          balanceBefore: fromBalance.toFixed(2),
          balanceAfter: fromNewBalance,
          status: 'completed',
          description: options.description || `Transfer to user ${toUserId}`,
          processedAt: new Date()
        });

        await tx.insert(transactions).values({
          userId: toUserId,
          type: 'deposit',
          amount: amount,
          balanceBefore: toBalance.toFixed(2),
          balanceAfter: toNewBalance,
          status: 'completed',
          description: options.description || `Transfer from user ${fromUserId}`,
          processedAt: new Date()
        });
      }

      return { success: true, fromUser: updatedFrom as User, toUser: updatedTo as User };
    });
  }

  // Settle game payout with full transactional integrity (includes stats update)
  async settleGamePayout(
    sessionId: string,
    winnerId: string,
    loserId: string,
    stakeAmount: string,
    platformFeePercent: number = 0,
    gameType: string = 'chess'
  ): Promise<{ success: boolean; error?: string }> {
    const stake = parseFloat(stakeAmount);
    if (isNaN(stake) || stake <= 0) {
      return { success: false, error: 'Invalid stake amount' };
    }

    const platformFee = stake * (platformFeePercent / 100);
    const winnerPayout = stake - platformFee;
    const validGameTypes = ['chess', 'backgammon', 'domino', 'tarneeb', 'baloot'];

    return await db.transaction(async (tx) => {
      const [id1, id2] = [winnerId, loserId].sort();
      const [user1] = await tx.select().from(users).where(eq(users.id, id1)).for('update');
      const [user2] = await tx.select().from(users).where(eq(users.id, id2)).for('update');

      const winner = id1 === winnerId ? user1 : user2;
      const loser = id1 === winnerId ? user2 : user1;

      if (!winner || !loser) {
        return { success: false, error: 'User not found' };
      }

      const winnerBalance = parseFloat(winner.balance);
      const winnerNewBalance = (winnerBalance + winnerPayout).toFixed(2);

      const winnerStatsUpdates: any = {
        balance: winnerNewBalance,
        gamesPlayed: winner.gamesPlayed + 1,
        gamesWon: winner.gamesWon + 1,
        currentWinStreak: winner.currentWinStreak + 1,
        longestWinStreak: Math.max(winner.longestWinStreak, winner.currentWinStreak + 1),
        totalEarnings: (parseFloat(winner.totalEarnings) + winnerPayout).toFixed(2),
        updatedAt: new Date()
      };

      if (validGameTypes.includes(gameType)) {
        const playedField = `${gameType}Played`;
        const wonField = `${gameType}Won`;
        winnerStatsUpdates[playedField] = (winner as any)[playedField] + 1;
        winnerStatsUpdates[wonField] = (winner as any)[wonField] + 1;
      }

      await tx.update(users).set(winnerStatsUpdates).where(eq(users.id, winnerId));

      const loserStatsUpdates: any = {
        gamesPlayed: loser.gamesPlayed + 1,
        gamesLost: loser.gamesLost + 1,
        currentWinStreak: 0,
        updatedAt: new Date()
      };

      if (validGameTypes.includes(gameType)) {
        const playedField = `${gameType}Played`;
        loserStatsUpdates[playedField] = (loser as any)[playedField] + 1;
      }

      await tx.update(users).set(loserStatsUpdates).where(eq(users.id, loserId));

      await tx.insert(transactions).values({
        userId: winnerId,
        type: 'win',
        amount: winnerPayout.toFixed(2),
        balanceBefore: winnerBalance.toFixed(2),
        balanceAfter: winnerNewBalance,
        status: 'completed',
        description: `Game winnings from session ${sessionId}`,
        referenceId: sessionId,
        processedAt: new Date()
      });

      const loserBalance = parseFloat(loser.balance);
      await tx.insert(transactions).values({
        userId: loserId,
        type: 'stake',
        amount: stakeAmount,
        balanceBefore: (loserBalance + stake).toFixed(2),
        balanceAfter: loserBalance.toFixed(2),
        status: 'completed',
        description: `Game stake loss in session ${sessionId}`,
        referenceId: sessionId,
        processedAt: new Date()
      });

      await tx.update(liveGameSessions)
        .set({
          status: 'completed',
          winnerId: winnerId,
          endedAt: new Date()
        })
        .where(eq(liveGameSessions.id, sessionId));

      return { success: true };
    });
  }

  async updateGameStats(
    sessionId: string,
    gameType: string,
    winnerId: string | null,
    player1Id: string,
    player2Id: string | null,
    isDraw: boolean = false,
    winAmount: string = "0"
  ): Promise<{ success: boolean; error?: string }> {
    const playerIds = [player1Id, player2Id].filter(Boolean) as string[];
    if (playerIds.length === 0) {
      return { success: false, error: 'No players to update' };
    }

    const validGameTypes = ['chess', 'backgammon', 'domino', 'tarneeb', 'baloot'];
    const isValidGameType = validGameTypes.includes(gameType);

    return await db.transaction(async (tx) => {
      const sortedIds = [...playerIds].sort();
      const lockedUsers: Record<string, any> = {};
      
      for (const id of sortedIds) {
        const [user] = await tx.select().from(users).where(eq(users.id, id)).for('update');
        if (user) lockedUsers[id] = user;
      }

      for (const playerId of playerIds) {
        const user = lockedUsers[playerId];
        if (!user) continue;

        const isWinner = winnerId === playerId;
        const isLoser = winnerId && winnerId !== playerId && !isDraw;
        
        const updates: any = {
          gamesPlayed: user.gamesPlayed + 1,
          updatedAt: new Date()
        };

        if (isValidGameType) {
          const playedField = `${gameType}Played`;
          updates[playedField] = (user as any)[playedField] + 1;
        }

        if (isWinner) {
          updates.gamesWon = user.gamesWon + 1;
          updates.currentWinStreak = user.currentWinStreak + 1;
          updates.longestWinStreak = Math.max(user.longestWinStreak, user.currentWinStreak + 1);
          
          if (isValidGameType) {
            const wonField = `${gameType}Won`;
            updates[wonField] = (user as any)[wonField] + 1;
          }
          
          if (winAmount && parseFloat(winAmount) > 0) {
            updates.totalEarnings = (parseFloat(user.totalEarnings) + parseFloat(winAmount)).toFixed(2);
          }
        } else if (isLoser) {
          updates.gamesLost = user.gamesLost + 1;
          updates.currentWinStreak = 0;
        } else if (isDraw) {
          updates.gamesDraw = user.gamesDraw + 1;
          updates.currentWinStreak = 0;
        }

        await tx.update(users).set(updates).where(eq(users.id, playerId));
      }

      return { success: true };
    });
  }

  // ==================== AGENTS ====================

  async getAgent(id: string): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.id, id));
    return agent || undefined;
  }

  async getAgentByUserId(userId: string): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.userId, userId));
    return agent || undefined;
  }

  async createAgent(insertAgent: InsertAgent): Promise<Agent> {
    const [agent] = await db.insert(agents).values(insertAgent).returning();
    return agent;
  }

  async updateAgent(id: string, data: Partial<InsertAgent>): Promise<Agent | undefined> {
    const [agent] = await db.update(agents).set({ ...data, updatedAt: new Date() }).where(eq(agents.id, id)).returning();
    return agent || undefined;
  }

  async listAgents(activeOnly = false): Promise<Agent[]> {
    if (activeOnly) {
      return db.select().from(agents).where(eq(agents.isActive, true)).orderBy(desc(agents.createdAt));
    }
    return db.select().from(agents).orderBy(desc(agents.createdAt));
  }

  async getAvailableAgentForAssignment(): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents)
      .where(and(eq(agents.isActive, true), eq(agents.isOnline, true)))
      .orderBy(asc(agents.assignedCustomersCount), desc(agents.performanceScore))
      .limit(1);
    return agent || undefined;
  }

  // ==================== AGENT PAYMENT METHODS ====================

  async getAgentPaymentMethods(agentId: string): Promise<AgentPaymentMethod[]> {
    return db.select().from(agentPaymentMethods).where(eq(agentPaymentMethods.agentId, agentId));
  }

  async createAgentPaymentMethod(method: InsertAgentPaymentMethod): Promise<AgentPaymentMethod> {
    const [pm] = await db.insert(agentPaymentMethods).values(method).returning();
    return pm;
  }

  async deleteAgentPaymentMethod(id: string): Promise<boolean> {
    const result = await db.delete(agentPaymentMethods).where(eq(agentPaymentMethods.id, id));
    return true;
  }

  // ==================== AFFILIATES ====================

  async getAffiliate(id: string): Promise<Affiliate | undefined> {
    const [affiliate] = await db.select().from(affiliates).where(eq(affiliates.id, id));
    return affiliate || undefined;
  }

  async getAffiliateByCode(code: string): Promise<Affiliate | undefined> {
    const [affiliate] = await db.select().from(affiliates).where(eq(affiliates.affiliateCode, code));
    return affiliate || undefined;
  }

  async createAffiliate(insertAffiliate: InsertAffiliate): Promise<Affiliate> {
    const [affiliate] = await db.insert(affiliates).values(insertAffiliate).returning();
    return affiliate;
  }

  async updateAffiliate(id: string, data: Partial<InsertAffiliate>): Promise<Affiliate | undefined> {
    const [affiliate] = await db.update(affiliates).set({ ...data, updatedAt: new Date() }).where(eq(affiliates.id, id)).returning();
    return affiliate || undefined;
  }

  async listAffiliates(): Promise<Affiliate[]> {
    return db.select().from(affiliates).orderBy(desc(affiliates.createdAt));
  }

  // ==================== PROMO CODES ====================

  async getPromoCode(id: string): Promise<PromoCode | undefined> {
    const [promo] = await db.select().from(promoCodes).where(eq(promoCodes.id, id));
    return promo || undefined;
  }

  async getPromoCodeByCode(code: string): Promise<PromoCode | undefined> {
    const [promo] = await db.select().from(promoCodes).where(eq(promoCodes.code, code.toUpperCase()));
    return promo || undefined;
  }

  async createPromoCode(insertPromo: InsertPromoCode): Promise<PromoCode> {
    const [promo] = await db.insert(promoCodes).values({ ...insertPromo, code: insertPromo.code.toUpperCase() }).returning();
    return promo;
  }

  async updatePromoCode(id: string, data: Partial<InsertPromoCode>): Promise<PromoCode | undefined> {
    const [promo] = await db.update(promoCodes).set(data).where(eq(promoCodes.id, id)).returning();
    return promo || undefined;
  }

  async listPromoCodes(affiliateId?: string): Promise<PromoCode[]> {
    if (affiliateId) {
      return db.select().from(promoCodes).where(eq(promoCodes.affiliateId, affiliateId)).orderBy(desc(promoCodes.createdAt));
    }
    return db.select().from(promoCodes).orderBy(desc(promoCodes.createdAt));
  }

  async incrementPromoCodeUsage(id: string): Promise<void> {
    await db.update(promoCodes).set({ usageCount: sql`${promoCodes.usageCount} + 1` }).where(eq(promoCodes.id, id));
  }

  // ==================== GAMES ====================

  async getGame(id: string): Promise<Game | undefined> {
    const [game] = await db.select().from(games).where(eq(games.id, id));
    return game || undefined;
  }

  async createGame(insertGame: InsertGame): Promise<Game> {
    const [game] = await db.insert(games).values(insertGame).returning();
    return game;
  }

  async updateGame(id: string, data: Partial<InsertGame>): Promise<Game | undefined> {
    const [game] = await db.update(games).set({ ...data, updatedAt: new Date() }).where(eq(games.id, id)).returning();
    return game || undefined;
  }

  async deleteGame(id: string): Promise<boolean> {
    await db.delete(games).where(eq(games.id, id));
    return true;
  }

  async listGames(status?: string, section?: string): Promise<Game[]> {
    const conditions = [];
    if (status) {
      conditions.push(eq(games.status, status as any));
    }
    if (section) {
      conditions.push(sql`${section} = ANY(${games.sections})`);
    }
    if (conditions.length > 0) {
      return db.select().from(games).where(and(...conditions)).orderBy(asc(games.sortOrder));
    }
    return db.select().from(games).orderBy(asc(games.sortOrder));
  }

  async incrementGamePlayCount(id: string, volume: string): Promise<void> {
    await db.update(games).set({ 
      playCount: sql`${games.playCount} + 1`,
      totalVolume: sql`${games.totalVolume} + ${volume}`
    }).where(eq(games.id, id));
  }

  // ==================== GAME SESSIONS ====================

  async createGameSession(session: InsertGameSession): Promise<GameSession> {
    const [gs] = await db.insert(gameSessions).values(session).returning();
    return gs;
  }

  async getGameSessionsByUser(userId: string, limit = 50): Promise<GameSession[]> {
    return db.select().from(gameSessions).where(eq(gameSessions.userId, userId)).orderBy(desc(gameSessions.createdAt)).limit(limit);
  }

  async getGameSessionsByGame(gameId: string, limit = 50): Promise<GameSession[]> {
    return db.select().from(gameSessions).where(eq(gameSessions.gameId, gameId)).orderBy(desc(gameSessions.createdAt)).limit(limit);
  }

  // ==================== TRANSACTIONS ====================

  async getTransaction(id: string): Promise<Transaction | undefined> {
    const [tx] = await db.select().from(transactions).where(eq(transactions.id, id));
    return tx || undefined;
  }

  async createTransaction(insertTx: InsertTransaction): Promise<Transaction> {
    const [tx] = await db.insert(transactions).values(insertTx).returning();
    return tx;
  }

  async updateTransaction(id: string, data: Partial<InsertTransaction>): Promise<Transaction | undefined> {
    const [tx] = await db.update(transactions).set({ ...data, updatedAt: new Date() }).where(eq(transactions.id, id)).returning();
    return tx || undefined;
  }

  async listTransactions(userId?: string, type?: string, status?: string): Promise<Transaction[]> {
    let query = db.select().from(transactions);
    const conditions = [];
    if (userId) conditions.push(eq(transactions.userId, userId));
    if (type) conditions.push(eq(transactions.type, type as any));
    if (status) conditions.push(eq(transactions.status, status as any));
    
    if (conditions.length > 0) {
      return db.select().from(transactions).where(and(...conditions)).orderBy(desc(transactions.createdAt));
    }
    return db.select().from(transactions).orderBy(desc(transactions.createdAt));
  }

  async getPendingTransactions(): Promise<Transaction[]> {
    return db.select().from(transactions).where(eq(transactions.status, 'pending')).orderBy(asc(transactions.createdAt));
  }

  // ==================== COMPLAINTS ====================

  async getComplaint(id: string): Promise<Complaint | undefined> {
    const [complaint] = await db.select().from(complaints).where(eq(complaints.id, id));
    return complaint || undefined;
  }

  async createComplaint(insertComplaint: InsertComplaint): Promise<Complaint> {
    const ticketNumber = `TKT-${Date.now().toString(36).toUpperCase()}`;
    const [complaint] = await db.insert(complaints).values({ ...insertComplaint, ticketNumber }).returning();
    return complaint;
  }

  async updateComplaint(id: string, data: Partial<InsertComplaint>): Promise<Complaint | undefined> {
    const [complaint] = await db.update(complaints).set({ ...data, updatedAt: new Date() }).where(eq(complaints.id, id)).returning();
    return complaint || undefined;
  }

  async listComplaints(userId?: string, status?: string): Promise<Complaint[]> {
    const conditions = [];
    if (userId) conditions.push(eq(complaints.userId, userId));
    if (status) conditions.push(eq(complaints.status, status as any));
    
    if (conditions.length > 0) {
      return db.select().from(complaints).where(and(...conditions)).orderBy(desc(complaints.createdAt));
    }
    return db.select().from(complaints).orderBy(desc(complaints.createdAt));
  }

  async getComplaintsByAgent(agentId: string): Promise<Complaint[]> {
    return db.select().from(complaints).where(eq(complaints.assignedAgentId, agentId)).orderBy(desc(complaints.createdAt));
  }

  async addComplaintMessage(message: InsertComplaintMessage): Promise<ComplaintMessage> {
    const [msg] = await db.insert(complaintMessages).values(message).returning();
    return msg;
  }

  async getComplaintMessages(complaintId: string): Promise<ComplaintMessage[]> {
    return db.select().from(complaintMessages).where(eq(complaintMessages.complaintId, complaintId)).orderBy(asc(complaintMessages.createdAt));
  }

  // ==================== AUDIT LOGS ====================

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [auditLog] = await db.insert(auditLogs).values(log).returning();
    return auditLog;
  }

  async getAuditLogs(userId?: string, action?: string): Promise<AuditLog[]> {
    const conditions = [];
    if (userId) conditions.push(eq(auditLogs.userId, userId));
    if (action) conditions.push(eq(auditLogs.action, action as any));
    
    if (conditions.length > 0) {
      return db.select().from(auditLogs).where(and(...conditions)).orderBy(desc(auditLogs.createdAt)).limit(100);
    }
    return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100);
  }

  // ==================== FINANCIAL LIMITS ====================

  async getFinancialLimits(vipLevel?: number): Promise<FinancialLimit[]> {
    if (vipLevel !== undefined) {
      return db.select().from(financialLimits).where(eq(financialLimits.vipLevel, vipLevel));
    }
    return db.select().from(financialLimits).orderBy(asc(financialLimits.vipLevel));
  }

  async createFinancialLimit(limit: InsertFinancialLimit): Promise<FinancialLimit> {
    const [fl] = await db.insert(financialLimits).values(limit).returning();
    return fl;
  }

  async updateFinancialLimit(id: string, data: Partial<InsertFinancialLimit>): Promise<FinancialLimit | undefined> {
    const [fl] = await db.update(financialLimits).set({ ...data, updatedAt: new Date() }).where(eq(financialLimits.id, id)).returning();
    return fl || undefined;
  }

  // ==================== SYSTEM SETTINGS ====================

  async getSetting(key: string): Promise<SystemSetting | undefined> {
    const [setting] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    return setting || undefined;
  }

  async setSetting(key: string, value: string, category?: string): Promise<SystemSetting> {
    const existing = await this.getSetting(key);
    if (existing) {
      const [updated] = await db.update(systemSettings)
        .set({ value, category, updatedAt: new Date() })
        .where(eq(systemSettings.key, key))
        .returning();
      return updated;
    }
    const [created] = await db.insert(systemSettings).values({ key, value, category }).returning();
    return created;
  }

  async getSettingsByCategory(category: string): Promise<SystemSetting[]> {
    return db.select().from(systemSettings).where(eq(systemSettings.category, category));
  }

  // ==================== PASSWORD RESET TOKENS ====================

  async createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const [resetToken] = await db.insert(passwordResetTokens).values(token).returning();
    return resetToken;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [resetToken] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token));
    return resetToken || undefined;
  }

  async markTokenAsUsed(id: string): Promise<void> {
    await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, id));
  }

  // ==================== USER LOOKUPS ====================

  async getUserByAccountId(accountId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.accountId, accountId));
    return user || undefined;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByNickname(nickname: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.nickname, nickname));
    return user || undefined;
  }

  async generateUniqueAccountId(): Promise<string> {
    let accountId: string;
    let exists = true;
    while (exists) {
      accountId = Math.floor(100000000 + Math.random() * 900000000).toString();
      const user = await this.getUserByAccountId(accountId);
      exists = !!user;
    }
    return accountId!;
  }

  // ==================== COUNTRY PAYMENT METHODS ====================

  async listCountryPaymentMethods(): Promise<CountryPaymentMethod[]> {
    return db.select().from(countryPaymentMethods).orderBy(asc(countryPaymentMethods.sortOrder), asc(countryPaymentMethods.name));
  }

  async createCountryPaymentMethod(method: InsertCountryPaymentMethod): Promise<CountryPaymentMethod> {
    const [created] = await db.insert(countryPaymentMethods).values(method).returning();
    return created;
  }

  async updateCountryPaymentMethod(id: string, data: Partial<InsertCountryPaymentMethod>): Promise<CountryPaymentMethod | undefined> {
    const [updated] = await db.update(countryPaymentMethods).set(data).where(eq(countryPaymentMethods.id, id)).returning();
    return updated;
  }

  async deleteCountryPaymentMethod(id: string): Promise<boolean> {
    const existing = await db.select().from(countryPaymentMethods).where(eq(countryPaymentMethods.id, id));
    if (existing.length === 0) {
      return false;
    }
    await db.delete(countryPaymentMethods).where(eq(countryPaymentMethods.id, id));
    return true;
  }

  // ==================== NOTIFICATIONS ====================

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notification).returning();
    return created;
  }

  async getUserNotifications(userId: string, limit = 50): Promise<Notification[]> {
    return db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return result[0]?.count || 0;
  }

  async markNotificationAsRead(id: string): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(notifications.id, id));
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  }

  // ==================== USER SESSIONS ====================

  async createUserSession(session: InsertUserSession): Promise<UserSession> {
    const [created] = await db.insert(userSessions).values(session).returning();
    return created;
  }

  async getUserSessions(userId: string): Promise<UserSession[]> {
    return db.select().from(userSessions)
      .where(and(eq(userSessions.userId, userId), eq(userSessions.isActive, true)))
      .orderBy(desc(userSessions.lastActiveAt));
  }

  async revokeUserSession(id: string): Promise<void> {
    await db.update(userSessions).set({ isActive: false }).where(eq(userSessions.id, id));
  }

  async revokeAllUserSessions(userId: string, exceptSessionId?: string): Promise<void> {
    if (exceptSessionId) {
      await db.update(userSessions)
        .set({ isActive: false })
        .where(and(
          eq(userSessions.userId, userId),
          eq(userSessions.isActive, true),
          sql`${userSessions.id} != ${exceptSessionId}`
        ));
    } else {
      await db.update(userSessions)
        .set({ isActive: false })
        .where(and(eq(userSessions.userId, userId), eq(userSessions.isActive, true)));
    }
  }

  // ==================== LOGIN HISTORY ====================

  async createLoginHistory(entry: InsertLoginHistory): Promise<LoginHistory> {
    const [created] = await db.insert(loginHistory).values(entry).returning();
    return created;
  }

  async getUserLoginHistory(userId: string, limit = 20): Promise<LoginHistory[]> {
    return db.select().from(loginHistory)
      .where(eq(loginHistory.userId, userId))
      .orderBy(desc(loginHistory.createdAt))
      .limit(limit);
  }

  // ==================== ANNOUNCEMENTS ====================

  async createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement> {
    const [created] = await db.insert(announcements).values(announcement).returning();
    return created;
  }

  async updateAnnouncement(id: string, data: Partial<InsertAnnouncement>): Promise<Announcement | undefined> {
    const [updated] = await db.update(announcements)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(announcements.id, id))
      .returning();
    return updated || undefined;
  }

  async getAnnouncement(id: string): Promise<Announcement | undefined> {
    const [announcement] = await db.select().from(announcements).where(eq(announcements.id, id));
    return announcement || undefined;
  }

  async listAnnouncements(status?: string): Promise<Announcement[]> {
    if (status) {
      return db.select().from(announcements)
        .where(eq(announcements.status, status as any))
        .orderBy(desc(announcements.createdAt));
    }
    return db.select().from(announcements).orderBy(desc(announcements.createdAt));
  }

  async getPublishedAnnouncements(target?: string): Promise<Announcement[]> {
    const now = new Date();
    let query = db.select().from(announcements)
      .where(and(
        eq(announcements.status, "published"),
        sql`(${announcements.expiresAt} IS NULL OR ${announcements.expiresAt} > ${now})`
      ))
      .orderBy(desc(announcements.isPinned), desc(announcements.publishedAt));
    
    return query;
  }

  async markAnnouncementViewed(announcementId: string, userId: string): Promise<void> {
    await db.insert(announcementViews).values({ announcementId, userId }).onConflictDoNothing();
    await db.update(announcements)
      .set({ viewCount: sql`${announcements.viewCount} + 1` })
      .where(eq(announcements.id, announcementId));
  }

  async getViewedAnnouncementIds(userId: string): Promise<string[]> {
    const views = await db.select({ announcementId: announcementViews.announcementId })
      .from(announcementViews)
      .where(eq(announcementViews.userId, userId));
    return views.map(v => v.announcementId);
  }

  // ==================== USER PREFERENCES ====================

  async getUserPreferences(userId: string): Promise<UserPreferences | undefined> {
    const [prefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    return prefs || undefined;
  }

  async createOrUpdateUserPreferences(userId: string, prefs: Partial<InsertUserPreferences>): Promise<UserPreferences> {
    const existing = await this.getUserPreferences(userId);
    if (existing) {
      const [updated] = await db.update(userPreferences)
        .set({ ...prefs, updatedAt: new Date() })
        .where(eq(userPreferences.userId, userId))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(userPreferences)
        .values({ userId, ...prefs } as InsertUserPreferences)
        .returning();
      return created;
    }
  }

  // ==================== USER RELATIONSHIPS ====================

  async createUserRelationship(relationship: InsertUserRelationship): Promise<UserRelationship> {
    const [created] = await db.insert(userRelationships).values(relationship).returning();
    return created;
  }

  async deleteUserRelationship(userId: string, targetUserId: string, type: string): Promise<boolean> {
    const result = await db.delete(userRelationships)
      .where(and(
        eq(userRelationships.userId, userId),
        eq(userRelationships.targetUserId, targetUserId),
        eq(userRelationships.type, type)
      ));
    return true;
  }

  async getUserRelationship(userId: string, targetUserId: string, type: string): Promise<UserRelationship | undefined> {
    const [relationship] = await db.select().from(userRelationships)
      .where(and(
        eq(userRelationships.userId, userId),
        eq(userRelationships.targetUserId, targetUserId),
        eq(userRelationships.type, type)
      ));
    return relationship || undefined;
  }

  async getUserFollowing(userId: string): Promise<UserRelationship[]> {
    return db.select().from(userRelationships)
      .where(and(
        eq(userRelationships.userId, userId),
        eq(userRelationships.type, "follow")
      ))
      .orderBy(desc(userRelationships.createdAt));
  }

  async getUserFollowers(userId: string): Promise<UserRelationship[]> {
    return db.select().from(userRelationships)
      .where(and(
        eq(userRelationships.targetUserId, userId),
        eq(userRelationships.type, "follow")
      ))
      .orderBy(desc(userRelationships.createdAt));
  }

  async getUserBlocked(userId: string): Promise<UserRelationship[]> {
    return db.select().from(userRelationships)
      .where(and(
        eq(userRelationships.userId, userId),
        eq(userRelationships.type, "block")
      ))
      .orderBy(desc(userRelationships.createdAt));
  }

  async searchUsers(query: string, excludeUserId: string): Promise<User[]> {
    const searchQuery = `%${query}%`;
    return db.select().from(users)
      .where(and(
        ne(users.id, excludeUserId),
        eq(users.status, "active"),
        or(
          like(users.username, searchQuery),
          like(users.accountId, searchQuery)
        )
      ))
      .orderBy(users.username)
      .limit(50);
  }

  async listSocialPlatforms(): Promise<SocialPlatform[]> {
    return db.select().from(socialPlatforms).orderBy(asc(socialPlatforms.sortOrder));
  }

  async getEnabledSocialPlatforms(): Promise<SocialPlatform[]> {
    return db.select().from(socialPlatforms)
      .where(eq(socialPlatforms.isEnabled, true))
      .orderBy(asc(socialPlatforms.sortOrder));
  }

  async getSocialPlatform(id: string): Promise<SocialPlatform | undefined> {
    const [platform] = await db.select().from(socialPlatforms).where(eq(socialPlatforms.id, id));
    return platform || undefined;
  }

  async getSocialPlatformByName(name: string): Promise<SocialPlatform | undefined> {
    const [platform] = await db.select().from(socialPlatforms).where(eq(socialPlatforms.name, name));
    return platform || undefined;
  }

  async createSocialPlatform(platform: InsertSocialPlatform): Promise<SocialPlatform> {
    const [created] = await db.insert(socialPlatforms).values(platform).returning();
    return created;
  }

  async updateSocialPlatform(id: string, data: Partial<InsertSocialPlatform>): Promise<SocialPlatform | undefined> {
    const [updated] = await db.update(socialPlatforms)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(socialPlatforms.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteSocialPlatform(id: string): Promise<boolean> {
    const result = await db.delete(socialPlatforms).where(eq(socialPlatforms.id, id));
    return true;
  }

  // Live Game Sessions
  async createLiveGameSession(session: InsertLiveGameSession): Promise<LiveGameSession> {
    const [created] = await db.insert(liveGameSessions).values(session).returning();
    return created;
  }

  async getLiveGameSession(id: string): Promise<LiveGameSession | undefined> {
    const [session] = await db.select().from(liveGameSessions).where(eq(liveGameSessions.id, id));
    return session || undefined;
  }

  async updateLiveGameSession(id: string, data: Partial<InsertLiveGameSession>): Promise<LiveGameSession | undefined> {
    const [updated] = await db.update(liveGameSessions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(liveGameSessions.id, id))
      .returning();
    return updated || undefined;
  }

  async listLiveGameSessions(status?: string, gameType?: string): Promise<LiveGameSession[]> {
    let query = db.select().from(liveGameSessions);
    const conditions = [];
    if (status) conditions.push(eq(liveGameSessions.status, status as any));
    if (gameType) conditions.push(eq(liveGameSessions.gameType, gameType));
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    return query.orderBy(desc(liveGameSessions.createdAt));
  }

  async getActiveLiveGamesByPlayer(playerId: string): Promise<LiveGameSession[]> {
    return db.select().from(liveGameSessions)
      .where(and(
        or(
          eq(liveGameSessions.player1Id, playerId),
          eq(liveGameSessions.player2Id, playerId),
          eq(liveGameSessions.player3Id, playerId),
          eq(liveGameSessions.player4Id, playerId)
        ),
        or(
          eq(liveGameSessions.status, 'waiting'),
          eq(liveGameSessions.status, 'starting'),
          eq(liveGameSessions.status, 'in_progress')
        )
      ))
      .orderBy(desc(liveGameSessions.createdAt));
  }

  // Game Moves
  async addGameMove(move: InsertGameMove): Promise<GameMove> {
    const [created] = await db.insert(gameMoves).values(move).returning();
    return created;
  }

  async getGameMoves(sessionId: string): Promise<GameMove[]> {
    return db.select().from(gameMoves)
      .where(eq(gameMoves.sessionId, sessionId))
      .orderBy(asc(gameMoves.moveNumber));
  }

  // Game Spectators
  async addGameSpectator(spectator: InsertGameSpectator): Promise<GameSpectator> {
    const [created] = await db.insert(gameSpectators).values(spectator).returning();
    return created;
  }

  async removeGameSpectator(sessionId: string, userId: string): Promise<void> {
    await db.update(gameSpectators)
      .set({ leftAt: new Date() })
      .where(and(
        eq(gameSpectators.sessionId, sessionId),
        eq(gameSpectators.userId, userId)
      ));
  }

  async getSessionSpectators(sessionId: string): Promise<GameSpectator[]> {
    return db.select().from(gameSpectators)
      .where(and(
        eq(gameSpectators.sessionId, sessionId),
        sql`${gameSpectators.leftAt} IS NULL`
      ));
  }

  // Gift Items
  async createGiftItem(item: InsertGiftItem): Promise<GiftItem> {
    const [created] = await db.insert(giftItems).values(item).returning();
    return created;
  }

  async getGiftItem(id: string): Promise<GiftItem | undefined> {
    const [item] = await db.select().from(giftItems).where(eq(giftItems.id, id));
    return item || undefined;
  }

  async listGiftItems(activeOnly: boolean = true): Promise<GiftItem[]> {
    let query = db.select().from(giftItems);
    if (activeOnly) {
      query = query.where(eq(giftItems.isActive, true)) as any;
    }
    return query.orderBy(asc(giftItems.sortOrder));
  }

  async updateGiftItem(id: string, data: Partial<InsertGiftItem>): Promise<GiftItem | undefined> {
    const [updated] = await db.update(giftItems)
      .set(data)
      .where(eq(giftItems.id, id))
      .returning();
    return updated || undefined;
  }

  // Spectator Gifts
  async addSpectatorGift(gift: InsertSpectatorGift): Promise<SpectatorGift> {
    const [created] = await db.insert(spectatorGifts).values(gift).returning();
    return created;
  }

  async getSessionGifts(sessionId: string): Promise<SpectatorGift[]> {
    return db.select().from(spectatorGifts)
      .where(eq(spectatorGifts.sessionId, sessionId))
      .orderBy(desc(spectatorGifts.createdAt));
  }

  async getPlayerReceivedGifts(playerId: string): Promise<SpectatorGift[]> {
    return db.select().from(spectatorGifts)
      .where(eq(spectatorGifts.recipientId, playerId))
      .orderBy(desc(spectatorGifts.createdAt));
  }

  // Game Chat Messages
  async addGameChatMessage(message: InsertGameChatMessage): Promise<GameChatMessage> {
    const [created] = await db.insert(gameChatMessages).values(message).returning();
    return created;
  }

  async getGameChatMessages(sessionId: string, limit: number = 100): Promise<GameChatMessage[]> {
    return db.select().from(gameChatMessages)
      .where(eq(gameChatMessages.sessionId, sessionId))
      .orderBy(desc(gameChatMessages.createdAt))
      .limit(limit);
  }

  // ==================== ACHIEVEMENTS ====================

  async getAchievements(category?: string): Promise<Achievement[]> {
    if (category) {
      return db.select().from(achievements)
        .where(and(eq(achievements.isActive, true), eq(achievements.category, category as any)))
        .orderBy(asc(achievements.sortOrder));
    }
    return db.select().from(achievements)
      .where(eq(achievements.isActive, true))
      .orderBy(asc(achievements.sortOrder));
  }

  async getAchievement(id: string): Promise<Achievement | undefined> {
    const [achievement] = await db.select().from(achievements).where(eq(achievements.id, id));
    return achievement || undefined;
  }

  async getAchievementByKey(key: string): Promise<Achievement | undefined> {
    const [achievement] = await db.select().from(achievements).where(eq(achievements.key, key));
    return achievement || undefined;
  }

  async createAchievement(achievement: InsertAchievement): Promise<Achievement> {
    const [created] = await db.insert(achievements).values(achievement).returning();
    return created;
  }

  async getUserAchievements(userId: string): Promise<(UserAchievement & { achievement: Achievement })[]> {
    const results = await db.select({
      userAchievement: userAchievements,
      achievement: achievements,
    }).from(userAchievements)
      .innerJoin(achievements, eq(userAchievements.achievementId, achievements.id))
      .where(eq(userAchievements.userId, userId))
      .orderBy(desc(userAchievements.unlockedAt));
    
    return results.map(r => ({
      ...r.userAchievement,
      achievement: r.achievement,
    }));
  }

  async getUserAchievement(userId: string, achievementId: string): Promise<UserAchievement | undefined> {
    const [ua] = await db.select().from(userAchievements)
      .where(and(eq(userAchievements.userId, userId), eq(userAchievements.achievementId, achievementId)));
    return ua || undefined;
  }

  async updateAchievementProgress(userId: string, achievementKey: string, progress: number): Promise<{ unlocked: boolean; achievement?: Achievement }> {
    const achievement = await this.getAchievementByKey(achievementKey);
    if (!achievement) return { unlocked: false };

    let userAchievement = await this.getUserAchievement(userId, achievement.id);
    
    if (!userAchievement) {
      const [created] = await db.insert(userAchievements).values({
        userId,
        achievementId: achievement.id,
        progress: 0,
      }).returning();
      userAchievement = created;
    }

    if (userAchievement.unlockedAt) {
      return { unlocked: false };
    }

    const newProgress = Math.max(userAchievement.progress, progress);
    const unlocked = newProgress >= achievement.requirement;

    await db.update(userAchievements)
      .set({
        progress: newProgress,
        unlockedAt: unlocked ? new Date() : null,
      })
      .where(eq(userAchievements.id, userAchievement.id));

    return { unlocked, achievement: unlocked ? achievement : undefined };
  }

  async claimAchievementReward(userId: string, achievementId: string): Promise<{ success: boolean; amount?: string; error?: string }> {
    return db.transaction(async (tx) => {
      const [ua] = await tx.select().from(userAchievements)
        .where(and(eq(userAchievements.userId, userId), eq(userAchievements.achievementId, achievementId)))
        .for('update');

      if (!ua || !ua.unlockedAt) {
        return { success: false, error: 'Achievement not unlocked' };
      }

      if (ua.rewardClaimed) {
        return { success: false, error: 'Reward already claimed' };
      }

      const [achievement] = await tx.select().from(achievements).where(eq(achievements.id, achievementId));
      if (!achievement || parseFloat(achievement.rewardAmount) <= 0) {
        return { success: false, error: 'No reward for this achievement' };
      }

      await tx.update(users)
        .set({ balance: sql`${users.balance} + ${achievement.rewardAmount}` })
        .where(eq(users.id, userId));

      await tx.update(userAchievements)
        .set({ rewardClaimed: true, rewardClaimedAt: new Date() })
        .where(eq(userAchievements.id, ua.id));

      return { success: true, amount: achievement.rewardAmount };
    });
  }

  // ==================== SEASONS ====================

  async getSeasons(): Promise<Season[]> {
    return db.select().from(seasons).orderBy(desc(seasons.number));
  }

  async getActiveSeason(): Promise<Season | undefined> {
    const [season] = await db.select().from(seasons).where(eq(seasons.status, 'active'));
    return season || undefined;
  }

  async getSeason(id: string): Promise<Season | undefined> {
    const [season] = await db.select().from(seasons).where(eq(seasons.id, id));
    return season || undefined;
  }

  async getSeasonByNumber(number: number): Promise<Season | undefined> {
    const [season] = await db.select().from(seasons).where(eq(seasons.number, number));
    return season || undefined;
  }

  async createSeason(season: InsertSeason): Promise<Season> {
    const [created] = await db.insert(seasons).values(season).returning();
    return created;
  }

  async updateSeason(id: string, data: Partial<InsertSeason>): Promise<Season | undefined> {
    const [updated] = await db.update(seasons).set(data).where(eq(seasons.id, id)).returning();
    return updated || undefined;
  }

  async getSeasonalStats(seasonId: string, limit: number = 100, gameType?: string): Promise<(SeasonalStats & { user: Pick<User, 'id' | 'username' | 'nickname' | 'profilePicture'> })[]> {
    let orderColumn = seasonalStats.gamesWon;
    
    const results = await db.select({
      stats: seasonalStats,
      user: {
        id: users.id,
        username: users.username,
        nickname: users.nickname,
        profilePicture: users.profilePicture,
      },
    }).from(seasonalStats)
      .innerJoin(users, eq(seasonalStats.userId, users.id))
      .where(eq(seasonalStats.seasonId, seasonId))
      .orderBy(desc(orderColumn))
      .limit(limit);

    return results.map(r => ({
      ...r.stats,
      user: r.user,
    }));
  }

  async getUserSeasonalStats(userId: string, seasonId: string): Promise<SeasonalStats | undefined> {
    const [stats] = await db.select().from(seasonalStats)
      .where(and(eq(seasonalStats.userId, userId), eq(seasonalStats.seasonId, seasonId)));
    return stats || undefined;
  }

  async getOrCreateSeasonalStats(userId: string, seasonId: string): Promise<SeasonalStats> {
    let stats = await this.getUserSeasonalStats(userId, seasonId);
    if (!stats) {
      const [created] = await db.insert(seasonalStats).values({
        userId,
        seasonId,
      }).returning();
      stats = created;
    }
    return stats;
  }

  async updateSeasonalStatsForGame(
    userId: string, 
    seasonId: string, 
    gameType: string, 
    won: boolean, 
    isDraw: boolean,
    earnings: string = '0'
  ): Promise<void> {
    const validGameTypes = ['chess', 'backgammon', 'domino', 'tarneeb', 'baloot'];
    const isValidGameType = validGameTypes.includes(gameType);

    await db.transaction(async (tx) => {
      const [stats] = await tx.select().from(seasonalStats)
        .where(and(eq(seasonalStats.userId, userId), eq(seasonalStats.seasonId, seasonId)))
        .for('update');

      if (!stats) {
        const insertData: any = {
          userId,
          seasonId,
          gamesPlayed: 1,
          gamesWon: won ? 1 : 0,
          gamesLost: !won && !isDraw ? 1 : 0,
          gamesDraw: isDraw ? 1 : 0,
          totalEarnings: earnings,
          currentWinStreak: won ? 1 : 0,
          longestWinStreak: won ? 1 : 0,
        };

        if (isValidGameType) {
          insertData[`${gameType}Played`] = 1;
          insertData[`${gameType}Won`] = won ? 1 : 0;
        }

        await tx.insert(seasonalStats).values(insertData);
        return;
      }

      const newStreak = won ? stats.currentWinStreak + 1 : 0;
      const updateData: any = {
        gamesPlayed: stats.gamesPlayed + 1,
        gamesWon: stats.gamesWon + (won ? 1 : 0),
        gamesLost: stats.gamesLost + (!won && !isDraw ? 1 : 0),
        gamesDraw: stats.gamesDraw + (isDraw ? 1 : 0),
        totalEarnings: sql`${seasonalStats.totalEarnings} + ${earnings}`,
        currentWinStreak: newStreak,
        longestWinStreak: Math.max(stats.longestWinStreak, newStreak),
        updatedAt: new Date(),
      };

      if (isValidGameType) {
        const playedField = `${gameType}Played` as keyof typeof stats;
        const wonField = `${gameType}Won` as keyof typeof stats;
        updateData[playedField] = (stats[playedField] as number) + 1;
        if (won) {
          updateData[wonField] = (stats[wonField] as number) + 1;
        }
      }

      await tx.update(seasonalStats).set(updateData).where(eq(seasonalStats.id, stats.id));
    });
  }

  async getSeasonRewards(seasonId: string): Promise<SeasonReward[]> {
    return db.select().from(seasonRewards)
      .where(eq(seasonRewards.seasonId, seasonId))
      .orderBy(asc(seasonRewards.rankFrom));
  }

  async createSeasonReward(reward: InsertSeasonReward): Promise<SeasonReward> {
    const [created] = await db.insert(seasonRewards).values(reward).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
