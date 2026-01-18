import {
  users, agents, affiliates, games, transactions, complaints, promoCodes,
  gameSessions, agentPaymentMethods, complaintMessages, complaintAttachments,
  auditLogs, financialLimits, systemSettings, linkAnalytics, promoCodeUsages,
  passwordResetTokens, countryPaymentMethods,
  notifications, userSessions, loginHistory, announcements, announcementViews, userPreferences,
  userRelationships, socialPlatforms,
  liveGameSessions, gameMoves, gameSpectators, giftItems, spectatorGifts, gameChatMessages,
  achievements, userAchievements, seasons, seasonalStats, seasonRewards,
  p2pTrades, p2pOffers, p2pTradeMessages, p2pTraderRatings, p2pTraderMetrics, p2pSettings,
  multiplayerGames, systemConfig, adminAuditLogs, challenges,
  projectCurrencySettings, projectCurrencyWallets, projectCurrencyConversions, projectCurrencyLedger,
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
  type MultiplayerGame, type InsertMultiplayerGame,
  type SystemConfig, type InsertSystemConfig,
  type ScheduledConfigChange, type InsertScheduledConfigChange,
  type AdminAlert, type InsertAdminAlert,
  type ProjectCurrencySettings, type InsertProjectCurrencySettings,
  type ProjectCurrencyWallet, type InsertProjectCurrencyWallet,
  type ProjectCurrencyConversion, type InsertProjectCurrencyConversion,
  type ProjectCurrencyLedger, type InsertProjectCurrencyLedger,
  scheduledConfigChanges,
  adminAlerts,
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
  settleProjectCurrencyGamePayout(sessionId: string, winnerId: string, loserId: string, stakeAmount: string, platformFeePercent?: number, gameType?: string): Promise<{ success: boolean; error?: string }>;
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

  // P2P Trading
  createP2PTrade(trade: any): Promise<any>;
  getP2PTrade(id: string): Promise<any | undefined>;
  updateP2PTrade(id: string, data: any): Promise<any | undefined>;
  getUserP2PTrades(userId: string): Promise<any[]>;
  createP2PTradeMessage(message: any): Promise<any>;
  getP2PTradeMessages(tradeId: string): Promise<any[]>;
  createP2PTraderRating(rating: any): Promise<any>;
  getP2PTraderRatings(userId: string): Promise<any[]>;
  updateP2PTraderMetrics(userId: string, data: any): Promise<any>;
  getP2PTraderMetrics(userId: string): Promise<any | undefined>;
  getP2POffer(id: string): Promise<any | undefined>;
  updateP2POffer(id: string, data: any): Promise<any | undefined>;

  // Multiplayer Games (Single Source of Truth)
  getMultiplayerGame(id: string): Promise<MultiplayerGame | undefined>;
  getMultiplayerGameByKey(key: string): Promise<MultiplayerGame | undefined>;
  listMultiplayerGames(activeOnly?: boolean): Promise<MultiplayerGame[]>;
  createMultiplayerGame(game: InsertMultiplayerGame): Promise<MultiplayerGame>;
  updateMultiplayerGame(id: string, data: Partial<InsertMultiplayerGame>): Promise<MultiplayerGame | undefined>;
  deleteMultiplayerGame(id: string): Promise<boolean>;
  incrementMultiplayerGameStats(key: string, volume: string): Promise<void>;
  validateGameConfig(gameKey: string, stakeAmount: string): Promise<{ valid: boolean; error?: string; game?: MultiplayerGame }>;

  // System Config
  getSystemConfig(key: string): Promise<SystemConfig | undefined>;
  setSystemConfig(key: string, value: string, updatedBy?: string): Promise<SystemConfig>;
  getConfigVersion(key: string): Promise<number>;
  
  // Admin Audit Logging
  createAdminAuditLog(log: { adminId: string; action: string; entityType: string; entityId?: string; oldValue?: any; newValue?: any; ipAddress?: string; userAgent?: string }): Promise<void>;

  // Scheduled Config Changes
  createScheduledConfigChange(change: InsertScheduledConfigChange): Promise<ScheduledConfigChange>;
  getScheduledConfigChange(id: string): Promise<ScheduledConfigChange | undefined>;
  listScheduledConfigChanges(gameId?: string, status?: string): Promise<ScheduledConfigChange[]>;
  getPendingScheduledChanges(): Promise<ScheduledConfigChange[]>;
  updateScheduledConfigChange(id: string, data: Partial<ScheduledConfigChange>): Promise<ScheduledConfigChange | undefined>;
  cancelScheduledConfigChange(id: string): Promise<boolean>;
  applyScheduledConfigChange(id: string): Promise<{ success: boolean; error?: string }>;

  // Admin Alerts (Real-time Admin Notifications)
  createAdminAlert(alert: InsertAdminAlert): Promise<AdminAlert>;
  getAdminAlert(id: string): Promise<AdminAlert | undefined>;
  listAdminAlerts(options?: { unreadOnly?: boolean; type?: string; severity?: string; limit?: number }): Promise<AdminAlert[]>;
  markAdminAlertAsRead(id: string, readBy: string): Promise<AdminAlert | undefined>;
  markAllAdminAlertsAsRead(readBy: string): Promise<number>;
  getUnreadAdminAlertCount(): Promise<number>;
  deleteAdminAlert(id: string): Promise<boolean>;

  // Project Currency
  getProjectCurrencySettings(): Promise<ProjectCurrencySettings | undefined>;
  updateProjectCurrencySettings(data: Partial<InsertProjectCurrencySettings>): Promise<ProjectCurrencySettings>;
  getProjectCurrencyWallet(userId: string): Promise<ProjectCurrencyWallet | undefined>;
  createProjectCurrencyWallet(userId: string): Promise<ProjectCurrencyWallet>;
  getOrCreateProjectCurrencyWallet(userId: string): Promise<ProjectCurrencyWallet>;
  updateProjectCurrencyWalletBalance(walletId: string, amount: string, operation: 'add' | 'subtract', balanceType: 'purchased' | 'earned'): Promise<{ success: boolean; wallet?: ProjectCurrencyWallet; error?: string }>;
  lockProjectCurrencyBalance(walletId: string, amount: string): Promise<{ success: boolean; error?: string }>;
  unlockProjectCurrencyBalance(walletId: string, amount: string): Promise<{ success: boolean; error?: string }>;
  createProjectCurrencyConversion(conversion: InsertProjectCurrencyConversion): Promise<ProjectCurrencyConversion>;
  getProjectCurrencyConversion(id: string): Promise<ProjectCurrencyConversion | undefined>;
  listProjectCurrencyConversions(options?: { userId?: string; status?: string; limit?: number }): Promise<ProjectCurrencyConversion[]>;
  updateProjectCurrencyConversion(id: string, data: Partial<ProjectCurrencyConversion>): Promise<ProjectCurrencyConversion | undefined>;
  approveProjectCurrencyConversion(conversionId: string, adminId: string): Promise<{ success: boolean; error?: string }>;
  rejectProjectCurrencyConversion(conversionId: string, adminId: string, reason: string): Promise<{ success: boolean; error?: string }>;
  createProjectCurrencyLedgerEntry(entry: InsertProjectCurrencyLedger): Promise<ProjectCurrencyLedger>;
  getProjectCurrencyLedger(options?: { userId?: string; walletId?: string; type?: string; limit?: number; offset?: number }): Promise<ProjectCurrencyLedger[]>;
  convertToProjectCurrencyAtomic(userId: string, baseCurrencyAmount: string): Promise<{ success: boolean; conversion?: ProjectCurrencyConversion; error?: string }>;
  spendProjectCurrencyAtomic(userId: string, amount: string, type: string, referenceId?: string, description?: string): Promise<{ success: boolean; error?: string }>;
  earnProjectCurrencyAtomic(userId: string, amount: string, type: string, referenceId?: string, description?: string): Promise<{ success: boolean; error?: string }>;
  getUserDailyConversionTotal(userId: string): Promise<string>;
  getPlatformDailyConversionTotal(): Promise<string>;

  // Challenges
  getAvailableChallenges(excludeUserId?: string): Promise<any[]>;
  getActiveChallenges(): Promise<any[]>;
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

  async settleProjectCurrencyGamePayout(
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
      
      const [wallet1] = await tx.select().from(projectCurrencyWallets)
        .where(eq(projectCurrencyWallets.userId, id1)).for('update');
      const [wallet2] = await tx.select().from(projectCurrencyWallets)
        .where(eq(projectCurrencyWallets.userId, id2)).for('update');

      const winnerWallet = id1 === winnerId ? wallet1 : wallet2;
      const loserWallet = id1 === winnerId ? wallet2 : wallet1;

      if (!winnerWallet || !loserWallet) {
        return { success: false, error: 'Project currency wallet not found' };
      }

      const winnerEarned = parseFloat(winnerWallet.earnedBalance);
      const winnerNewEarned = (winnerEarned + winnerPayout).toFixed(8);

      await tx.update(projectCurrencyWallets).set({
        earnedBalance: winnerNewEarned,
        updatedAt: new Date()
      }).where(eq(projectCurrencyWallets.userId, winnerId));

      await tx.insert(projectCurrencyLedger).values({
        walletId: winnerWallet.id,
        userId: winnerId,
        transactionType: 'game_win',
        amount: winnerPayout.toFixed(8),
        balanceType: 'earned',
        balanceBefore: winnerEarned.toFixed(8),
        balanceAfter: winnerNewEarned,
        description: `${gameType} game win from session ${sessionId}`,
        referenceId: sessionId
      });

      const [winnerUser] = await tx.select().from(users).where(eq(users.id, winnerId)).for('update');
      const [loserUser] = await tx.select().from(users).where(eq(users.id, loserId)).for('update');

      if (winnerUser && loserUser) {
        const winnerStatsUpdates: any = {
          gamesPlayed: winnerUser.gamesPlayed + 1,
          gamesWon: winnerUser.gamesWon + 1,
          currentWinStreak: winnerUser.currentWinStreak + 1,
          longestWinStreak: Math.max(winnerUser.longestWinStreak, winnerUser.currentWinStreak + 1),
          updatedAt: new Date()
        };

        if (validGameTypes.includes(gameType)) {
          const playedField = `${gameType}Played`;
          const wonField = `${gameType}Won`;
          winnerStatsUpdates[playedField] = (winnerUser as any)[playedField] + 1;
          winnerStatsUpdates[wonField] = (winnerUser as any)[wonField] + 1;
        }

        await tx.update(users).set(winnerStatsUpdates).where(eq(users.id, winnerId));

        const loserStatsUpdates: any = {
          gamesPlayed: loserUser.gamesPlayed + 1,
          gamesLost: loserUser.gamesLost + 1,
          currentWinStreak: 0,
          updatedAt: new Date()
        };

        if (validGameTypes.includes(gameType)) {
          const playedField = `${gameType}Played`;
          loserStatsUpdates[playedField] = (loserUser as any)[playedField] + 1;
        }

        await tx.update(users).set(loserStatsUpdates).where(eq(users.id, loserId));
      }

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

  // ==================== P2P TRADING ====================

  async createP2PTrade(trade: any): Promise<any> {
    const [created] = await db.insert(p2pTrades).values(trade).returning();
    return created;
  }

  async getP2PTrade(id: string): Promise<any | undefined> {
    const [trade] = await db.select().from(p2pTrades).where(eq(p2pTrades.id, id));
    return trade || undefined;
  }

  async updateP2PTrade(id: string, data: any): Promise<any | undefined> {
    const [updated] = await db.update(p2pTrades)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(p2pTrades.id, id))
      .returning();
    return updated || undefined;
  }

  async getUserP2PTrades(userId: string): Promise<any[]> {
    return db.select().from(p2pTrades)
      .where(or(eq(p2pTrades.buyerId, userId), eq(p2pTrades.sellerId, userId)))
      .orderBy(desc(p2pTrades.createdAt));
  }

  async createP2PTradeMessage(message: any): Promise<any> {
    const [created] = await db.insert(p2pTradeMessages).values(message).returning();
    return created;
  }

  async getP2PTradeMessages(tradeId: string): Promise<any[]> {
    return db.select().from(p2pTradeMessages)
      .where(eq(p2pTradeMessages.tradeId, tradeId))
      .orderBy(asc(p2pTradeMessages.createdAt));
  }

  async createP2PTraderRating(rating: any): Promise<any> {
    const [created] = await db.insert(p2pTraderRatings).values(rating).returning();
    return created;
  }

  async getP2PTraderRatings(userId: string): Promise<any[]> {
    return db.select().from(p2pTraderRatings)
      .where(eq(p2pTraderRatings.ratedUserId, userId))
      .orderBy(desc(p2pTraderRatings.createdAt));
  }

  async updateP2PTraderMetrics(userId: string, data: any): Promise<any> {
    const existing = await this.getP2PTraderMetrics(userId);
    if (existing) {
      const [updated] = await db.update(p2pTraderMetrics)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(p2pTraderMetrics.userId, userId))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(p2pTraderMetrics)
        .values({ userId, ...data })
        .returning();
      return created;
    }
  }

  async getP2PTraderMetrics(userId: string): Promise<any | undefined> {
    const [metrics] = await db.select().from(p2pTraderMetrics)
      .where(eq(p2pTraderMetrics.userId, userId));
    return metrics || undefined;
  }

  async getP2POffer(id: string): Promise<any | undefined> {
    const [offer] = await db.select().from(p2pOffers).where(eq(p2pOffers.id, id));
    return offer || undefined;
  }

  async updateP2POffer(id: string, data: any): Promise<any | undefined> {
    const [updated] = await db.update(p2pOffers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(p2pOffers.id, id))
      .returning();
    return updated || undefined;
  }

  // ATOMIC P2P trade creation with escrow and offer reservation
  async createP2PTradeAtomic(params: {
    offerId: string;
    buyerId: string;
    sellerId: string;
    amount: string;
    fiatAmount: string;
    price: string;
    paymentMethod: string;
    platformFee: string;
    expiresAt: Date;
  }): Promise<{ success: boolean; trade?: any; error?: string }> {
    const tradeAmount = parseFloat(params.amount);
    if (isNaN(tradeAmount) || tradeAmount <= 0) {
      return { success: false, error: 'Invalid amount' };
    }

    return await db.transaction(async (tx) => {
      // 1. Lock the offer row and verify availability
      const [offer] = await tx
        .select()
        .from(p2pOffers)
        .where(eq(p2pOffers.id, params.offerId))
        .for('update');

      if (!offer) {
        return { success: false, error: 'Offer not found' };
      }

      if (offer.status !== 'active') {
        return { success: false, error: 'Offer is no longer active' };
      }

      const availableAmount = parseFloat(offer.availableAmount);
      if (tradeAmount > availableAmount) {
        return { success: false, error: `Insufficient available amount. Maximum: ${availableAmount}` };
      }

      // 2. Lock seller's balance and debit escrow
      const [seller] = await tx
        .select()
        .from(users)
        .where(eq(users.id, params.sellerId))
        .for('update');

      if (!seller) {
        return { success: false, error: 'Seller not found' };
      }

      const sellerBalance = parseFloat(seller.balance);
      if (sellerBalance < tradeAmount) {
        return { success: false, error: 'Seller has insufficient balance for escrow' };
      }

      // 3. Debit seller's balance (escrow hold)
      const newSellerBalance = (sellerBalance - tradeAmount).toFixed(2);
      await tx.update(users)
        .set({ balance: newSellerBalance, updatedAt: new Date() })
        .where(eq(users.id, params.sellerId));

      // 4. Update offer availability
      const newAvailable = (availableAmount - tradeAmount).toFixed(8);
      await tx.update(p2pOffers)
        .set({
          availableAmount: newAvailable,
          status: parseFloat(newAvailable) <= 0 ? 'completed' : 'active',
          updatedAt: new Date()
        })
        .where(eq(p2pOffers.id, params.offerId));

      // 5. Create the trade record
      const [trade] = await tx.insert(p2pTrades).values({
        offerId: params.offerId,
        buyerId: params.buyerId,
        sellerId: params.sellerId,
        status: 'pending',
        amount: params.amount,
        fiatAmount: params.fiatAmount,
        price: params.price,
        paymentMethod: params.paymentMethod,
        escrowAmount: params.amount,
        platformFee: params.platformFee,
        expiresAt: params.expiresAt,
      }).returning();

      // 6. Create escrow transaction record for audit
      await tx.insert(transactions).values({
        userId: params.sellerId,
        type: 'withdrawal',
        amount: params.amount,
        balanceBefore: sellerBalance.toFixed(2),
        balanceAfter: newSellerBalance,
        status: 'completed',
        description: `P2P trade ${trade.id} - escrow hold`,
        processedAt: new Date()
      });

      return { success: true, trade };
    });
  }

  // ATOMIC P2P trade completion with escrow release
  async completeP2PTradeAtomic(tradeId: string, completedByUserId: string): Promise<{ success: boolean; trade?: any; error?: string }> {
    return await db.transaction(async (tx) => {
      // 1. Lock and verify trade
      const [trade] = await tx
        .select()
        .from(p2pTrades)
        .where(eq(p2pTrades.id, tradeId))
        .for('update');

      if (!trade) {
        return { success: false, error: 'Trade not found' };
      }

      // Idempotency: already completed - return success
      if (trade.status === 'completed') {
        return { success: true, trade };
      }

      if (trade.sellerId !== completedByUserId) {
        return { success: false, error: 'Only the seller can complete the trade' };
      }

      if (trade.status !== 'confirmed') {
        return { success: false, error: 'Trade payment not confirmed yet' };
      }

      const escrowAmount = parseFloat(trade.escrowAmount);
      const platformFee = parseFloat(trade.platformFee || '0');
      const releaseAmount = escrowAmount - platformFee;

      // 2. Lock buyer's balance and credit
      const [buyer] = await tx
        .select()
        .from(users)
        .where(eq(users.id, trade.buyerId))
        .for('update');

      if (!buyer) {
        return { success: false, error: 'Buyer not found' };
      }

      const buyerBalance = parseFloat(buyer.balance);
      const newBuyerBalance = (buyerBalance + releaseAmount).toFixed(2);

      await tx.update(users)
        .set({ balance: newBuyerBalance, updatedAt: new Date() })
        .where(eq(users.id, trade.buyerId));

      // 3. Update trade status
      const [updatedTrade] = await tx.update(p2pTrades)
        .set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
        .where(eq(p2pTrades.id, tradeId))
        .returning();

      // 4. Create transaction record for audit
      await tx.insert(transactions).values({
        userId: trade.buyerId,
        type: 'deposit',
        amount: releaseAmount.toFixed(2),
        balanceBefore: buyerBalance.toFixed(2),
        balanceAfter: newBuyerBalance,
        status: 'completed',
        description: `P2P trade ${tradeId} - funds received`,
        processedAt: new Date()
      });

      return { success: true, trade: updatedTrade };
    });
  }

  // ATOMIC P2P trade cancellation with escrow refund and offer restoration
  async cancelP2PTradeAtomic(tradeId: string, cancelledByUserId: string, reason?: string): Promise<{ success: boolean; trade?: any; error?: string }> {
    return await db.transaction(async (tx) => {
      // 1. Lock and verify trade
      const [trade] = await tx
        .select()
        .from(p2pTrades)
        .where(eq(p2pTrades.id, tradeId))
        .for('update');

      if (!trade) {
        return { success: false, error: 'Trade not found' };
      }

      // Idempotency: already cancelled - return success
      if (trade.status === 'cancelled') {
        return { success: true, trade };
      }

      if (trade.buyerId !== cancelledByUserId && trade.sellerId !== cancelledByUserId) {
        return { success: false, error: 'Not authorized to cancel this trade' };
      }

      if (trade.status === 'completed') {
        return { success: false, error: 'Cannot cancel a completed trade' };
      }

      const escrowAmount = parseFloat(trade.escrowAmount);
      const tradeAmount = parseFloat(trade.amount);

      // 2. Refund escrow to seller if funds were held
      if (escrowAmount > 0) {
        const [seller] = await tx
          .select()
          .from(users)
          .where(eq(users.id, trade.sellerId))
          .for('update');

        if (seller) {
          const sellerBalance = parseFloat(seller.balance);
          const newSellerBalance = (sellerBalance + escrowAmount).toFixed(2);

          await tx.update(users)
            .set({ balance: newSellerBalance, updatedAt: new Date() })
            .where(eq(users.id, trade.sellerId));

          // Create refund transaction record
          await tx.insert(transactions).values({
            userId: trade.sellerId,
            type: 'deposit',
            amount: trade.escrowAmount,
            balanceBefore: sellerBalance.toFixed(2),
            balanceAfter: newSellerBalance,
            status: 'completed',
            description: `P2P trade ${tradeId} - escrow refund`,
            processedAt: new Date()
          });
        }
      }

      // 3. Restore offer availability
      if (trade.offerId && tradeAmount > 0) {
        const [offer] = await tx
          .select()
          .from(p2pOffers)
          .where(eq(p2pOffers.id, trade.offerId))
          .for('update');

        if (offer) {
          const currentAvailable = parseFloat(offer.availableAmount);
          const restoredAvailable = (currentAvailable + tradeAmount).toFixed(8);

          await tx.update(p2pOffers)
            .set({
              availableAmount: restoredAvailable,
              status: 'active', // Re-activate offer if it was marked completed
              updatedAt: new Date()
            })
            .where(eq(p2pOffers.id, trade.offerId));
        }
      }

      // 4. Update trade status
      const [updatedTrade] = await tx.update(p2pTrades)
        .set({
          status: 'cancelled',
          cancelReason: reason || 'Cancelled by user',
          cancelledAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(p2pTrades.id, tradeId))
        .returning();

      return { success: true, trade: updatedTrade };
    });
  }

  // ATOMIC P2P trade creation with PROJECT CURRENCY escrow
  async createP2PTradeProjectCurrencyAtomic(params: {
    offerId: string;
    buyerId: string;
    sellerId: string;
    amount: string;
    fiatAmount: string;
    price: string;
    paymentMethod: string;
    platformFee: string;
    expiresAt: Date;
  }): Promise<{ success: boolean; trade?: any; error?: string }> {
    const tradeAmount = parseFloat(params.amount);
    if (isNaN(tradeAmount) || tradeAmount <= 0) {
      return { success: false, error: 'Invalid amount' };
    }

    return await db.transaction(async (tx) => {
      // 1. Lock the offer row and verify availability
      const [offer] = await tx
        .select()
        .from(p2pOffers)
        .where(eq(p2pOffers.id, params.offerId))
        .for('update');

      if (!offer) {
        return { success: false, error: 'Offer not found' };
      }

      if (offer.status !== 'active') {
        return { success: false, error: 'Offer is no longer active' };
      }

      const availableAmount = parseFloat(offer.availableAmount);
      if (tradeAmount > availableAmount) {
        return { success: false, error: `Insufficient available amount. Maximum: ${availableAmount}` };
      }

      // 2. Lock seller's PROJECT CURRENCY wallet and debit escrow
      const [sellerWallet] = await tx
        .select()
        .from(projectCurrencyWallets)
        .where(eq(projectCurrencyWallets.userId, params.sellerId))
        .for('update');

      if (!sellerWallet) {
        return { success: false, error: 'Seller project currency wallet not found' };
      }

      // Calculate total balance (deduct from earned first)
      let earnedBalance = parseFloat(sellerWallet.earnedBalance);
      let purchasedBalance = parseFloat(sellerWallet.purchasedBalance);
      const totalBalance = earnedBalance + purchasedBalance;

      if (totalBalance < tradeAmount) {
        return { success: false, error: 'Seller has insufficient project currency for escrow' };
      }

      // Deduct from earned first, then purchased - track amounts for accurate refunds
      let remaining = tradeAmount;
      let earnedDeducted = 0;
      let purchasedDeducted = 0;
      
      if (earnedBalance >= remaining) {
        earnedDeducted = remaining;
        earnedBalance -= remaining;
        remaining = 0;
      } else {
        earnedDeducted = earnedBalance;
        remaining -= earnedBalance;
        earnedBalance = 0;
        purchasedDeducted = remaining;
        purchasedBalance -= remaining;
      }

      // 3. Debit seller's project currency (escrow hold)
      await tx.update(projectCurrencyWallets)
        .set({ 
          earnedBalance: earnedBalance.toFixed(8),
          purchasedBalance: purchasedBalance.toFixed(8),
          updatedAt: new Date() 
        })
        .where(eq(projectCurrencyWallets.userId, params.sellerId));

      // 4. Update offer availability
      const newAvailable = (availableAmount - tradeAmount).toFixed(8);
      await tx.update(p2pOffers)
        .set({
          availableAmount: newAvailable,
          status: parseFloat(newAvailable) <= 0 ? 'completed' : 'active',
          updatedAt: new Date()
        })
        .where(eq(p2pOffers.id, params.offerId));

      // 5. Create the trade record with currencyType='project' - track escrow split for accurate refunds
      const [trade] = await tx.insert(p2pTrades).values({
        offerId: params.offerId,
        buyerId: params.buyerId,
        sellerId: params.sellerId,
        status: 'pending',
        amount: params.amount,
        fiatAmount: params.fiatAmount,
        price: params.price,
        paymentMethod: params.paymentMethod,
        escrowAmount: params.amount,
        escrowEarnedAmount: earnedDeducted.toFixed(8), // Track earned portion for refunds
        escrowPurchasedAmount: purchasedDeducted.toFixed(8), // Track purchased portion for refunds
        platformFee: params.platformFee,
        currencyType: 'project',
        expiresAt: params.expiresAt,
      }).returning();

      // 6. Create ledger entries for audit - separate entries for earned and purchased
      if (earnedDeducted > 0) {
        await tx.insert(projectCurrencyLedger).values({
          walletId: sellerWallet.id,
          userId: params.sellerId,
          transactionType: 'p2p_escrow',
          amount: (-earnedDeducted).toFixed(8),
          balanceType: 'earned',
          balanceBefore: (parseFloat(sellerWallet.earnedBalance)).toFixed(8),
          balanceAfter: earnedBalance.toFixed(8),
          description: `P2P trade ${trade.id} - escrow hold (earned)`,
          referenceId: trade.id
        });
      }
      
      if (purchasedDeducted > 0) {
        await tx.insert(projectCurrencyLedger).values({
          walletId: sellerWallet.id,
          userId: params.sellerId,
          transactionType: 'p2p_escrow',
          amount: (-purchasedDeducted).toFixed(8),
          balanceType: 'purchased',
          balanceBefore: (parseFloat(sellerWallet.purchasedBalance)).toFixed(8),
          balanceAfter: purchasedBalance.toFixed(8),
          description: `P2P trade ${trade.id} - escrow hold (purchased)`,
          referenceId: trade.id
        });
      }

      return { success: true, trade };
    });
  }

  // ATOMIC P2P trade completion with PROJECT CURRENCY escrow release
  async completeP2PTradeProjectCurrencyAtomic(tradeId: string, completedByUserId: string): Promise<{ success: boolean; trade?: any; error?: string }> {
    return await db.transaction(async (tx) => {
      // 1. Lock and verify trade
      const [trade] = await tx
        .select()
        .from(p2pTrades)
        .where(eq(p2pTrades.id, tradeId))
        .for('update');

      if (!trade) {
        return { success: false, error: 'Trade not found' };
      }

      // Idempotency: already completed - return success
      if (trade.status === 'completed') {
        return { success: true, trade };
      }

      if (trade.sellerId !== completedByUserId) {
        return { success: false, error: 'Only the seller can complete the trade' };
      }

      if (trade.status !== 'confirmed') {
        return { success: false, error: 'Trade payment not confirmed yet' };
      }

      const escrowAmount = parseFloat(trade.escrowAmount);
      const platformFee = parseFloat(trade.platformFee || '0');
      const releaseAmount = escrowAmount - platformFee;

      // 2. Get or create buyer's project currency wallet
      let [buyerWallet] = await tx
        .select()
        .from(projectCurrencyWallets)
        .where(eq(projectCurrencyWallets.userId, trade.buyerId))
        .for('update');

      if (!buyerWallet) {
        const [created] = await tx.insert(projectCurrencyWallets)
          .values({ userId: trade.buyerId })
          .returning();
        buyerWallet = created;
      }

      const buyerTotalBefore = parseFloat(buyerWallet.earnedBalance) + parseFloat(buyerWallet.purchasedBalance);
      const newEarnedBalance = (parseFloat(buyerWallet.earnedBalance) + releaseAmount).toFixed(8);

      await tx.update(projectCurrencyWallets)
        .set({ earnedBalance: newEarnedBalance, updatedAt: new Date() })
        .where(eq(projectCurrencyWallets.userId, trade.buyerId));

      // 3. Update trade status
      const [updatedTrade] = await tx.update(p2pTrades)
        .set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
        .where(eq(p2pTrades.id, tradeId))
        .returning();

      // 4. Create ledger entry for audit
      await tx.insert(projectCurrencyLedger).values({
        walletId: buyerWallet.id,
        userId: trade.buyerId,
        transactionType: 'p2p_received',
        amount: releaseAmount.toFixed(8),
        balanceType: 'earned',
        balanceBefore: buyerTotalBefore.toFixed(8),
        balanceAfter: (buyerTotalBefore + releaseAmount).toFixed(8),
        description: `P2P trade ${tradeId} - funds received`,
        referenceId: tradeId
      });

      return { success: true, trade: updatedTrade };
    });
  }

  // ATOMIC P2P trade cancellation with PROJECT CURRENCY escrow refund
  async cancelP2PTradeProjectCurrencyAtomic(tradeId: string, cancelledByUserId: string, reason?: string): Promise<{ success: boolean; trade?: any; error?: string }> {
    return await db.transaction(async (tx) => {
      // 1. Lock and verify trade
      const [trade] = await tx
        .select()
        .from(p2pTrades)
        .where(eq(p2pTrades.id, tradeId))
        .for('update');

      if (!trade) {
        return { success: false, error: 'Trade not found' };
      }

      // Idempotency: already cancelled - return success
      if (trade.status === 'cancelled') {
        return { success: true, trade };
      }

      if (trade.buyerId !== cancelledByUserId && trade.sellerId !== cancelledByUserId) {
        return { success: false, error: 'Not authorized to cancel this trade' };
      }

      if (trade.status === 'completed') {
        return { success: false, error: 'Cannot cancel a completed trade' };
      }

      const escrowAmount = parseFloat(trade.escrowAmount);
      const tradeAmount = parseFloat(trade.amount);
      
      // Get tracked escrow split for accurate refunds
      const escrowEarnedAmount = parseFloat(trade.escrowEarnedAmount || '0');
      const escrowPurchasedAmount = parseFloat(trade.escrowPurchasedAmount || '0');

      // 2. Refund escrow to seller if funds were held - using tracked split for accuracy
      if (escrowAmount > 0) {
        const [sellerWallet] = await tx
          .select()
          .from(projectCurrencyWallets)
          .where(eq(projectCurrencyWallets.userId, trade.sellerId))
          .for('update');

        if (sellerWallet) {
          const currentEarned = parseFloat(sellerWallet.earnedBalance);
          const currentPurchased = parseFloat(sellerWallet.purchasedBalance);
          
          // Refund to correct balance types using tracked split
          const newEarnedBalance = (currentEarned + escrowEarnedAmount).toFixed(8);
          const newPurchasedBalance = (currentPurchased + escrowPurchasedAmount).toFixed(8);

          await tx.update(projectCurrencyWallets)
            .set({ 
              earnedBalance: newEarnedBalance,
              purchasedBalance: newPurchasedBalance,
              updatedAt: new Date() 
            })
            .where(eq(projectCurrencyWallets.userId, trade.sellerId));

          // Create separate refund ledger entries for earned and purchased
          if (escrowEarnedAmount > 0) {
            await tx.insert(projectCurrencyLedger).values({
              walletId: sellerWallet.id,
              userId: trade.sellerId,
              transactionType: 'p2p_refund',
              amount: escrowEarnedAmount.toFixed(8),
              balanceType: 'earned',
              balanceBefore: currentEarned.toFixed(8),
              balanceAfter: newEarnedBalance,
              description: `P2P trade ${tradeId} - escrow refund (earned)`,
              referenceId: tradeId
            });
          }
          
          if (escrowPurchasedAmount > 0) {
            await tx.insert(projectCurrencyLedger).values({
              walletId: sellerWallet.id,
              userId: trade.sellerId,
              transactionType: 'p2p_refund',
              amount: escrowPurchasedAmount.toFixed(8),
              balanceType: 'purchased',
              balanceBefore: currentPurchased.toFixed(8),
              balanceAfter: newPurchasedBalance,
              description: `P2P trade ${tradeId} - escrow refund (purchased)`,
              referenceId: tradeId
            });
          }
        }
      }

      // 3. Restore offer availability
      if (trade.offerId && tradeAmount > 0) {
        const [offer] = await tx
          .select()
          .from(p2pOffers)
          .where(eq(p2pOffers.id, trade.offerId))
          .for('update');

        if (offer) {
          const currentAvailable = parseFloat(offer.availableAmount);
          const restoredAvailable = (currentAvailable + tradeAmount).toFixed(8);

          await tx.update(p2pOffers)
            .set({
              availableAmount: restoredAvailable,
              status: 'active',
              updatedAt: new Date()
            })
            .where(eq(p2pOffers.id, trade.offerId));
        }
      }

      // 4. Update trade status
      const [updatedTrade] = await tx.update(p2pTrades)
        .set({
          status: 'cancelled',
          cancelReason: reason || 'Cancelled by user',
          cancelledAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(p2pTrades.id, tradeId))
        .returning();

      return { success: true, trade: updatedTrade };
    });
  }

  // ==================== MULTIPLAYER GAMES (Single Source of Truth) ====================

  async getMultiplayerGame(id: string): Promise<MultiplayerGame | undefined> {
    const [game] = await db.select().from(multiplayerGames).where(eq(multiplayerGames.id, id));
    return game || undefined;
  }

  async getMultiplayerGameByKey(key: string): Promise<MultiplayerGame | undefined> {
    const [game] = await db.select().from(multiplayerGames).where(eq(multiplayerGames.key, key));
    return game || undefined;
  }

  async listMultiplayerGames(activeOnly: boolean = false): Promise<MultiplayerGame[]> {
    if (activeOnly) {
      return db.select().from(multiplayerGames)
        .where(eq(multiplayerGames.isActive, true))
        .orderBy(asc(multiplayerGames.sortOrder), asc(multiplayerGames.key));
    }
    return db.select().from(multiplayerGames).orderBy(asc(multiplayerGames.sortOrder), asc(multiplayerGames.key));
  }

  async createMultiplayerGame(game: InsertMultiplayerGame): Promise<MultiplayerGame> {
    const [created] = await db.insert(multiplayerGames).values(game).returning();
    return created;
  }

  async updateMultiplayerGame(id: string, data: Partial<InsertMultiplayerGame>): Promise<MultiplayerGame | undefined> {
    const [updated] = await db.update(multiplayerGames)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(multiplayerGames.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteMultiplayerGame(id: string): Promise<boolean> {
    const result = await db.delete(multiplayerGames).where(eq(multiplayerGames.id, id));
    return true;
  }

  async incrementMultiplayerGameStats(key: string, volume: string): Promise<void> {
    await db.update(multiplayerGames)
      .set({
        totalGamesPlayed: sql`${multiplayerGames.totalGamesPlayed} + 1`,
        totalVolume: sql`${multiplayerGames.totalVolume} + ${parseFloat(volume)}`,
        updatedAt: new Date()
      })
      .where(eq(multiplayerGames.key, key));
  }

  async validateGameConfig(gameKey: string, stakeAmount: string): Promise<{ valid: boolean; error?: string; game?: MultiplayerGame }> {
    const game = await this.getMultiplayerGameByKey(gameKey);
    
    if (!game) {
      return { valid: false, error: `Game '${gameKey}' does not exist` };
    }
    
    if (!game.isActive) {
      return { valid: false, error: `Game '${gameKey}' is currently inactive` };
    }
    
    const stake = parseFloat(stakeAmount);
    const minStake = parseFloat(game.minStake);
    const maxStake = parseFloat(game.maxStake);
    
    if (stake < minStake) {
      return { valid: false, error: `Stake ${stake} is below minimum ${minStake}`, game };
    }
    
    if (stake > maxStake) {
      return { valid: false, error: `Stake ${stake} exceeds maximum ${maxStake}`, game };
    }
    
    return { valid: true, game };
  }

  // ==================== SYSTEM CONFIG ====================

  async getSystemConfig(key: string): Promise<SystemConfig | undefined> {
    const [config] = await db.select().from(systemConfig).where(eq(systemConfig.key, key));
    return config || undefined;
  }

  async setSystemConfig(key: string, value: string, updatedBy?: string): Promise<SystemConfig> {
    const existing = await this.getSystemConfig(key);
    
    if (existing) {
      const [updated] = await db.update(systemConfig)
        .set({
          value,
          version: sql`${systemConfig.version} + 1`,
          updatedAt: new Date(),
          updatedBy: updatedBy || null
        })
        .where(eq(systemConfig.key, key))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(systemConfig).values({
        key,
        value,
        version: 1,
        updatedBy
      }).returning();
      return created;
    }
  }

  async getConfigVersion(key: string): Promise<number> {
    const config = await this.getSystemConfig(key);
    return config?.version || 0;
  }

  // ==================== ADMIN AUDIT LOGGING ====================

  async createAdminAuditLog(log: { adminId: string; action: string; entityType: string; entityId?: string; oldValue?: any; newValue?: any; ipAddress?: string; userAgent?: string }): Promise<void> {
    await db.insert(adminAuditLogs).values({
      adminId: log.adminId,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId || null,
      oldValue: log.oldValue ? JSON.stringify(log.oldValue) : null,
      newValue: log.newValue ? JSON.stringify(log.newValue) : null,
      ipAddress: log.ipAddress || null,
      userAgent: log.userAgent || null,
    });
  }

  // ==================== SCHEDULED CONFIG CHANGES ====================

  async createScheduledConfigChange(change: InsertScheduledConfigChange): Promise<ScheduledConfigChange> {
    const [created] = await db.insert(scheduledConfigChanges).values(change).returning();
    return created;
  }

  async getScheduledConfigChange(id: string): Promise<ScheduledConfigChange | undefined> {
    const [change] = await db.select().from(scheduledConfigChanges).where(eq(scheduledConfigChanges.id, id));
    return change || undefined;
  }

  async listScheduledConfigChanges(gameId?: string, status?: string): Promise<ScheduledConfigChange[]> {
    const conditions = [];
    if (gameId) conditions.push(eq(scheduledConfigChanges.gameId, gameId));
    if (status) conditions.push(eq(scheduledConfigChanges.status, status as any));

    if (conditions.length > 0) {
      return db.select().from(scheduledConfigChanges)
        .where(and(...conditions))
        .orderBy(desc(scheduledConfigChanges.scheduledAt));
    }
    return db.select().from(scheduledConfigChanges).orderBy(desc(scheduledConfigChanges.scheduledAt));
  }

  async getPendingScheduledChanges(): Promise<ScheduledConfigChange[]> {
    const now = new Date();
    return db.select().from(scheduledConfigChanges)
      .where(and(
        eq(scheduledConfigChanges.status, 'pending'),
        lte(scheduledConfigChanges.scheduledAt, now)
      ))
      .orderBy(asc(scheduledConfigChanges.scheduledAt));
  }

  async updateScheduledConfigChange(id: string, data: Partial<ScheduledConfigChange>): Promise<ScheduledConfigChange | undefined> {
    const [updated] = await db.update(scheduledConfigChanges)
      .set(data)
      .where(eq(scheduledConfigChanges.id, id))
      .returning();
    return updated || undefined;
  }

  async cancelScheduledConfigChange(id: string): Promise<boolean> {
    const change = await this.getScheduledConfigChange(id);
    if (!change || change.status !== 'pending') {
      return false;
    }
    await db.update(scheduledConfigChanges)
      .set({ status: 'cancelled' })
      .where(eq(scheduledConfigChanges.id, id));
    return true;
  }

  async applyScheduledConfigChange(id: string): Promise<{ success: boolean; error?: string }> {
    const change = await this.getScheduledConfigChange(id);
    if (!change) {
      return { success: false, error: 'Scheduled change not found' };
    }
    if (change.status !== 'pending') {
      return { success: false, error: `Change is not pending (status: ${change.status})` };
    }

    try {
      const game = await this.getMultiplayerGame(change.gameId);
      if (!game) {
        await this.updateScheduledConfigChange(id, { status: 'failed', failureReason: 'Game not found', appliedAt: new Date() });
        return { success: false, error: 'Game not found' };
      }

      // Apply the change based on action type
      switch (change.action) {
        case 'activate':
          await this.updateMultiplayerGame(change.gameId, { isActive: true });
          break;
        case 'deactivate':
          await this.updateMultiplayerGame(change.gameId, { isActive: false });
          break;
        case 'update_settings':
          if (change.changes) {
            const settings = JSON.parse(change.changes);
            await this.updateMultiplayerGame(change.gameId, settings);
          }
          break;
      }

      // Mark as applied
      await this.updateScheduledConfigChange(id, { status: 'applied', appliedAt: new Date() });

      // Update config version to trigger real-time sync
      await this.setSystemConfig('multiplayer_games_version', Date.now().toString());

      return { success: true };
    } catch (error: any) {
      await this.updateScheduledConfigChange(id, { status: 'failed', failureReason: error.message, appliedAt: new Date() });
      return { success: false, error: error.message };
    }
  }

  // ==================== ADMIN ALERTS ====================

  async createAdminAlert(alert: InsertAdminAlert): Promise<AdminAlert> {
    const [created] = await db.insert(adminAlerts).values(alert).returning();
    return created;
  }

  async getAdminAlert(id: string): Promise<AdminAlert | undefined> {
    const [alert] = await db.select().from(adminAlerts).where(eq(adminAlerts.id, id));
    return alert || undefined;
  }

  async listAdminAlerts(options?: { unreadOnly?: boolean; type?: string; severity?: string; limit?: number }): Promise<AdminAlert[]> {
    const conditions = [];
    if (options?.unreadOnly) {
      conditions.push(eq(adminAlerts.isRead, false));
    }
    if (options?.type) {
      conditions.push(eq(adminAlerts.type, options.type as any));
    }
    if (options?.severity) {
      conditions.push(eq(adminAlerts.severity, options.severity as any));
    }

    let query = db.select().from(adminAlerts);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    query = query.orderBy(desc(adminAlerts.createdAt)) as typeof query;
    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }
    return query;
  }

  async markAdminAlertAsRead(id: string, readBy: string): Promise<AdminAlert | undefined> {
    const [updated] = await db.update(adminAlerts)
      .set({ isRead: true, readAt: new Date(), readBy })
      .where(eq(adminAlerts.id, id))
      .returning();
    return updated || undefined;
  }

  async markAllAdminAlertsAsRead(readBy: string): Promise<number> {
    const result = await db.update(adminAlerts)
      .set({ isRead: true, readAt: new Date(), readBy })
      .where(eq(adminAlerts.isRead, false));
    return result.rowCount || 0;
  }

  async getUnreadAdminAlertCount(): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(adminAlerts)
      .where(eq(adminAlerts.isRead, false));
    return Number(result?.count || 0);
  }

  async deleteAdminAlert(id: string): Promise<boolean> {
    const result = await db.delete(adminAlerts).where(eq(adminAlerts.id, id));
    return (result.rowCount || 0) > 0;
  }

  // ==================== PROJECT CURRENCY ====================

  async getProjectCurrencySettings(): Promise<ProjectCurrencySettings | undefined> {
    const [settings] = await db.select().from(projectCurrencySettings).limit(1);
    return settings || undefined;
  }

  async updateProjectCurrencySettings(data: Partial<InsertProjectCurrencySettings>): Promise<ProjectCurrencySettings> {
    const existing = await this.getProjectCurrencySettings();
    if (existing) {
      const [updated] = await db.update(projectCurrencySettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(projectCurrencySettings.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(projectCurrencySettings).values(data as any).returning();
    return created;
  }

  async getProjectCurrencyWallet(userId: string): Promise<ProjectCurrencyWallet | undefined> {
    const [wallet] = await db.select().from(projectCurrencyWallets).where(eq(projectCurrencyWallets.userId, userId));
    return wallet || undefined;
  }

  async createProjectCurrencyWallet(userId: string): Promise<ProjectCurrencyWallet> {
    const [wallet] = await db.insert(projectCurrencyWallets).values({ userId }).returning();
    return wallet;
  }

  async getOrCreateProjectCurrencyWallet(userId: string): Promise<ProjectCurrencyWallet> {
    const existing = await this.getProjectCurrencyWallet(userId);
    if (existing) return existing;
    return this.createProjectCurrencyWallet(userId);
  }

  async updateProjectCurrencyWalletBalance(
    walletId: string, 
    amount: string, 
    operation: 'add' | 'subtract', 
    balanceType: 'purchased' | 'earned'
  ): Promise<{ success: boolean; wallet?: ProjectCurrencyWallet; error?: string }> {
    const changeAmount = parseFloat(amount);
    if (isNaN(changeAmount) || changeAmount < 0) {
      return { success: false, error: 'Invalid amount' };
    }

    try {
      const balanceColumn = balanceType === 'purchased' ? 'purchased_balance' : 'earned_balance';
      const sqlOp = operation === 'add' ? sql`+` : sql`-`;

      if (operation === 'subtract') {
        const [result] = await db.execute(sql`
          UPDATE project_currency_wallets
          SET 
            ${sql.raw(balanceColumn)} = ${sql.raw(balanceColumn)} - ${changeAmount},
            total_balance = total_balance - ${changeAmount},
            total_spent = total_spent + ${changeAmount},
            updated_at = NOW()
          WHERE id = ${walletId}
            AND ${sql.raw(balanceColumn)} >= ${changeAmount}
          RETURNING *
        `);
        if (!result) {
          return { success: false, error: 'Insufficient balance' };
        }
        return { success: true, wallet: result as unknown as ProjectCurrencyWallet };
      } else {
        const [result] = await db.execute(sql`
          UPDATE project_currency_wallets
          SET 
            ${sql.raw(balanceColumn)} = ${sql.raw(balanceColumn)} + ${changeAmount},
            total_balance = total_balance + ${changeAmount},
            ${sql.raw(balanceType === 'purchased' ? 'total_converted' : 'total_earned')} = ${sql.raw(balanceType === 'purchased' ? 'total_converted' : 'total_earned')} + ${changeAmount},
            updated_at = NOW()
          WHERE id = ${walletId}
          RETURNING *
        `);
        return { success: true, wallet: result as unknown as ProjectCurrencyWallet };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async lockProjectCurrencyBalance(walletId: string, amount: string): Promise<{ success: boolean; error?: string }> {
    const lockAmount = parseFloat(amount);
    try {
      const result = await db.execute(sql`
        UPDATE project_currency_wallets
        SET 
          total_balance = total_balance - ${lockAmount},
          locked_balance = locked_balance + ${lockAmount},
          updated_at = NOW()
        WHERE id = ${walletId}
          AND total_balance >= ${lockAmount}
        RETURNING id
      `);
      if ((result as any).length === 0) {
        return { success: false, error: 'Insufficient balance to lock' };
      }
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async unlockProjectCurrencyBalance(walletId: string, amount: string): Promise<{ success: boolean; error?: string }> {
    const unlockAmount = parseFloat(amount);
    try {
      const result = await db.execute(sql`
        UPDATE project_currency_wallets
        SET 
          total_balance = total_balance + ${unlockAmount},
          locked_balance = locked_balance - ${unlockAmount},
          updated_at = NOW()
        WHERE id = ${walletId}
          AND locked_balance >= ${unlockAmount}
        RETURNING id
      `);
      if ((result as any).length === 0) {
        return { success: false, error: 'Insufficient locked balance' };
      }
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async createProjectCurrencyConversion(conversion: InsertProjectCurrencyConversion): Promise<ProjectCurrencyConversion> {
    const [created] = await db.insert(projectCurrencyConversions).values(conversion).returning();
    return created;
  }

  async getProjectCurrencyConversion(id: string): Promise<ProjectCurrencyConversion | undefined> {
    const [conversion] = await db.select().from(projectCurrencyConversions).where(eq(projectCurrencyConversions.id, id));
    return conversion || undefined;
  }

  async listProjectCurrencyConversions(options?: { userId?: string; status?: string; limit?: number }): Promise<ProjectCurrencyConversion[]> {
    let query = db.select().from(projectCurrencyConversions);
    const conditions: any[] = [];
    
    if (options?.userId) conditions.push(eq(projectCurrencyConversions.userId, options.userId));
    if (options?.status) conditions.push(eq(projectCurrencyConversions.status, options.status as any));
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return query.orderBy(desc(projectCurrencyConversions.createdAt)).limit(options?.limit || 100);
  }

  async updateProjectCurrencyConversion(id: string, data: Partial<ProjectCurrencyConversion>): Promise<ProjectCurrencyConversion | undefined> {
    const [updated] = await db.update(projectCurrencyConversions)
      .set(data)
      .where(eq(projectCurrencyConversions.id, id))
      .returning();
    return updated || undefined;
  }

  async approveProjectCurrencyConversion(conversionId: string, adminId: string): Promise<{ success: boolean; error?: string }> {
    try {
      return await db.transaction(async (tx) => {
        const [conversion] = await tx.execute(sql`
          SELECT * FROM project_currency_conversions 
          WHERE id = ${conversionId} AND status = 'pending'
          FOR UPDATE
        `);
        
        if (!conversion) {
          return { success: false, error: 'Conversion not found or already processed' };
        }

        const conv = conversion as unknown as ProjectCurrencyConversion;
        const wallet = await this.getOrCreateProjectCurrencyWallet(conv.userId);

        await tx.execute(sql`
          UPDATE project_currency_wallets
          SET 
            purchased_balance = purchased_balance + ${parseFloat(conv.netAmount)},
            total_balance = total_balance + ${parseFloat(conv.netAmount)},
            total_converted = total_converted + ${parseFloat(conv.netAmount)},
            updated_at = NOW()
          WHERE id = ${wallet.id}
        `);

        await tx.execute(sql`
          UPDATE project_currency_conversions
          SET 
            status = 'completed',
            approved_by_id = ${adminId},
            approved_at = NOW(),
            completed_at = NOW()
          WHERE id = ${conversionId}
        `);

        await tx.insert(projectCurrencyLedger).values({
          userId: conv.userId,
          walletId: wallet.id,
          type: 'conversion',
          amount: conv.netAmount,
          balanceBefore: wallet.totalBalance,
          balanceAfter: (parseFloat(wallet.totalBalance) + parseFloat(conv.netAmount)).toFixed(2),
          referenceId: conversionId,
          referenceType: 'conversion',
          description: `Converted ${conv.baseCurrencyAmount} to project currency`,
        });

        return { success: true };
      });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async rejectProjectCurrencyConversion(conversionId: string, adminId: string, reason: string): Promise<{ success: boolean; error?: string }> {
    try {
      return await db.transaction(async (tx) => {
        const [conversion] = await tx.execute(sql`
          SELECT * FROM project_currency_conversions 
          WHERE id = ${conversionId} AND status = 'pending'
          FOR UPDATE
        `);
        
        if (!conversion) {
          return { success: false, error: 'Conversion not found or already processed' };
        }

        const conv = conversion as unknown as ProjectCurrencyConversion;

        await tx.execute(sql`
          UPDATE users
          SET balance = balance + ${parseFloat(conv.baseCurrencyAmount)}
          WHERE id = ${conv.userId}
        `);

        await tx.execute(sql`
          UPDATE project_currency_conversions
          SET 
            status = 'rejected',
            approved_by_id = ${adminId},
            rejection_reason = ${reason}
          WHERE id = ${conversionId}
        `);

        return { success: true };
      });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async createProjectCurrencyLedgerEntry(entry: InsertProjectCurrencyLedger): Promise<ProjectCurrencyLedger> {
    const [created] = await db.insert(projectCurrencyLedger).values(entry).returning();
    return created;
  }

  async getProjectCurrencyLedger(options?: { userId?: string; walletId?: string; type?: string; limit?: number; offset?: number }): Promise<ProjectCurrencyLedger[]> {
    let query = db.select().from(projectCurrencyLedger);
    const conditions: any[] = [];
    
    if (options?.userId) conditions.push(eq(projectCurrencyLedger.userId, options.userId));
    if (options?.walletId) conditions.push(eq(projectCurrencyLedger.walletId, options.walletId));
    if (options?.type) conditions.push(eq(projectCurrencyLedger.type, options.type as any));
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return query
      .orderBy(desc(projectCurrencyLedger.createdAt))
      .limit(options?.limit || 100)
      .offset(options?.offset || 0);
  }

  async convertToProjectCurrencyAtomic(userId: string, baseCurrencyAmount: string): Promise<{ success: boolean; conversion?: ProjectCurrencyConversion; error?: string }> {
    try {
      return await db.transaction(async (tx) => {
        const settings = await this.getProjectCurrencySettings();
        if (!settings || !settings.isActive) {
          return { success: false, error: 'Project currency is not active' };
        }

        const amount = parseFloat(baseCurrencyAmount);
        if (amount < parseFloat(settings.minConversionAmount)) {
          return { success: false, error: `Minimum conversion is ${settings.minConversionAmount}` };
        }
        if (amount > parseFloat(settings.maxConversionAmount)) {
          return { success: false, error: `Maximum conversion is ${settings.maxConversionAmount}` };
        }

        const dailyTotal = await this.getUserDailyConversionTotal(userId);
        const newDailyTotal = parseFloat(dailyTotal) + amount;
        if (newDailyTotal > parseFloat(settings.dailyConversionLimitPerUser)) {
          return { success: false, error: 'Daily conversion limit exceeded' };
        }

        const [lockResult] = await tx.execute(sql`
          UPDATE users
          SET balance = balance - ${amount}
          WHERE id = ${userId} AND balance >= ${amount}
          RETURNING id
        `);

        if (!lockResult) {
          return { success: false, error: 'Insufficient balance' };
        }

        const exchangeRate = parseFloat(settings.exchangeRate);
        const commissionRate = parseFloat(settings.conversionCommissionRate);
        const grossAmount = amount * exchangeRate;
        const commissionAmount = grossAmount * commissionRate;
        const netAmount = grossAmount - commissionAmount;

        const [conversion] = await tx.insert(projectCurrencyConversions).values({
          userId,
          baseCurrencyAmount: amount.toFixed(2),
          projectCurrencyAmount: grossAmount.toFixed(2),
          exchangeRateUsed: settings.exchangeRate,
          commissionAmount: commissionAmount.toFixed(2),
          netAmount: netAmount.toFixed(2),
          status: settings.approvalMode === 'automatic' ? 'completed' : 'pending',
        }).returning();

        if (settings.approvalMode === 'automatic') {
          const wallet = await this.getOrCreateProjectCurrencyWallet(userId);
          await tx.execute(sql`
            UPDATE project_currency_wallets
            SET 
              purchased_balance = purchased_balance + ${netAmount},
              total_balance = total_balance + ${netAmount},
              total_converted = total_converted + ${netAmount},
              updated_at = NOW()
            WHERE id = ${wallet.id}
          `);

          await tx.insert(projectCurrencyLedger).values({
            userId,
            walletId: wallet.id,
            type: 'conversion',
            amount: netAmount.toFixed(2),
            balanceBefore: wallet.totalBalance,
            balanceAfter: (parseFloat(wallet.totalBalance) + netAmount).toFixed(2),
            referenceId: conversion.id,
            referenceType: 'conversion',
            description: `Converted ${amount} to project currency`,
          });

          await tx.execute(sql`
            UPDATE project_currency_conversions
            SET completed_at = NOW()
            WHERE id = ${conversion.id}
          `);
        }

        return { success: true, conversion };
      });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async spendProjectCurrencyAtomic(userId: string, amount: string, type: string, referenceId?: string, description?: string): Promise<{ success: boolean; error?: string }> {
    try {
      return await db.transaction(async (tx) => {
        const wallet = await this.getProjectCurrencyWallet(userId);
        if (!wallet) {
          return { success: false, error: 'Wallet not found' };
        }

        const spendAmount = parseFloat(amount);
        if (spendAmount > parseFloat(wallet.totalBalance)) {
          return { success: false, error: 'Insufficient project currency balance' };
        }

        const earnedBalance = parseFloat(wallet.earnedBalance);
        const purchasedBalance = parseFloat(wallet.purchasedBalance);
        
        let fromEarned = Math.min(earnedBalance, spendAmount);
        let fromPurchased = spendAmount - fromEarned;

        await tx.execute(sql`
          UPDATE project_currency_wallets
          SET 
            earned_balance = earned_balance - ${fromEarned},
            purchased_balance = purchased_balance - ${fromPurchased},
            total_balance = total_balance - ${spendAmount},
            total_spent = total_spent + ${spendAmount},
            updated_at = NOW()
          WHERE id = ${wallet.id}
            AND total_balance >= ${spendAmount}
        `);

        await tx.insert(projectCurrencyLedger).values({
          userId,
          walletId: wallet.id,
          type: type as any,
          amount: (-spendAmount).toFixed(2),
          balanceBefore: wallet.totalBalance,
          balanceAfter: (parseFloat(wallet.totalBalance) - spendAmount).toFixed(2),
          referenceId,
          referenceType: type,
          description,
        });

        return { success: true };
      });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async earnProjectCurrencyAtomic(userId: string, amount: string, type: string, referenceId?: string, description?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const wallet = await this.getOrCreateProjectCurrencyWallet(userId);
      const earnAmount = parseFloat(amount);

      await db.execute(sql`
        UPDATE project_currency_wallets
        SET 
          earned_balance = earned_balance + ${earnAmount},
          total_balance = total_balance + ${earnAmount},
          total_earned = total_earned + ${earnAmount},
          updated_at = NOW()
        WHERE id = ${wallet.id}
      `);

      await db.insert(projectCurrencyLedger).values({
        userId,
        walletId: wallet.id,
        type: type as any,
        amount: earnAmount.toFixed(2),
        balanceBefore: wallet.totalBalance,
        balanceAfter: (parseFloat(wallet.totalBalance) + earnAmount).toFixed(2),
        referenceId,
        referenceType: type,
        description,
      });

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async getUserDailyConversionTotal(userId: string): Promise<string> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [result] = await db.execute(sql`
      SELECT COALESCE(SUM(CAST(base_currency_amount AS DECIMAL)), 0) as total
      FROM project_currency_conversions
      WHERE user_id = ${userId}
        AND created_at >= ${today}
        AND status != 'rejected'
    `);
    
    return (result as any)?.total?.toString() || '0';
  }

  async getPlatformDailyConversionTotal(): Promise<string> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [result] = await db.execute(sql`
      SELECT COALESCE(SUM(CAST(base_currency_amount AS DECIMAL)), 0) as total
      FROM project_currency_conversions
      WHERE created_at >= ${today}
        AND status = 'completed'
    `);
    
    return (result as any)?.total?.toString() || '0';
  }

  // ==================== CHALLENGES ====================

  async getAvailableChallenges(excludeUserId?: string): Promise<any[]> {
    const result = await db.select().from(challenges)
      .where(
        and(
          eq(challenges.status, 'waiting'),
          eq(challenges.visibility, 'public'),
          excludeUserId ? ne(challenges.player1Id, excludeUserId) : sql`1=1`
        )
      )
      .orderBy(desc(challenges.createdAt))
      .limit(20);
    return result;
  }

  async getActiveChallenges(): Promise<any[]> {
    const result = await db.select().from(challenges)
      .where(
        and(
          eq(challenges.status, 'active'),
          eq(challenges.visibility, 'public')
        )
      )
      .orderBy(desc(challenges.startedAt))
      .limit(20);
    return result;
  }
}

export const storage = new DatabaseStorage();

// ==================== SEED MULTIPLAYER GAMES ====================

async function seedMultiplayerGames() {
  const existingGames = await storage.listMultiplayerGames();
  if (existingGames.length > 0) {
    console.log('Multiplayer games already seeded');
    return;
  }

  const defaultGames: InsertMultiplayerGame[] = [
    {
      key: 'chess',
      nameEn: 'Chess',
      nameAr: 'شطرنج',
      descriptionEn: 'The classic game of strategy',
      descriptionAr: 'لعبة الإستراتيجية الكلاسيكية',
      iconName: 'Crown',
      colorClass: 'bg-amber-500/20 text-amber-500 border-amber-500/30',
      gradientClass: 'from-amber-500/20 to-amber-600/10',
      isActive: true,
      minStake: '1.00',
      maxStake: '1000.00',
      houseFee: '0.05',
      minPlayers: 2,
      maxPlayers: 2,
      defaultTimeLimit: 600,
      isFeatured: true,
      sortOrder: 1,
    },
    {
      key: 'backgammon',
      nameEn: 'Backgammon',
      nameAr: 'طاولة',
      descriptionEn: 'Ancient game of dice and strategy',
      descriptionAr: 'لعبة النرد والإستراتيجية القديمة',
      iconName: 'Shuffle',
      colorClass: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30',
      gradientClass: 'from-emerald-500/20 to-emerald-600/10',
      isActive: true,
      minStake: '1.00',
      maxStake: '1000.00',
      houseFee: '0.05',
      minPlayers: 2,
      maxPlayers: 2,
      defaultTimeLimit: 600,
      isFeatured: true,
      sortOrder: 2,
    },
    {
      key: 'domino',
      nameEn: 'Domino',
      nameAr: 'دومينو',
      descriptionEn: 'Classic tile matching game',
      descriptionAr: 'لعبة مطابقة البلاط الكلاسيكية',
      iconName: 'Target',
      colorClass: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
      gradientClass: 'from-blue-500/20 to-blue-600/10',
      isActive: true,
      minStake: '1.00',
      maxStake: '1000.00',
      houseFee: '0.05',
      minPlayers: 2,
      maxPlayers: 4,
      defaultTimeLimit: 600,
      isFeatured: false,
      sortOrder: 3,
    },
    {
      key: 'tarneeb',
      nameEn: 'Tarneeb',
      nameAr: 'طرنيب',
      descriptionEn: 'Popular Middle Eastern trick-taking card game',
      descriptionAr: 'لعبة الورق الشرق أوسطية الشهيرة',
      iconName: 'Gem',
      colorClass: 'bg-purple-500/20 text-purple-500 border-purple-500/30',
      gradientClass: 'from-purple-500/20 to-purple-600/10',
      isActive: true,
      minStake: '1.00',
      maxStake: '1000.00',
      houseFee: '0.05',
      minPlayers: 4,
      maxPlayers: 4,
      defaultTimeLimit: 900,
      isFeatured: false,
      sortOrder: 4,
    },
    {
      key: 'baloot',
      nameEn: 'Baloot',
      nameAr: 'بلوت',
      descriptionEn: 'Traditional Saudi Arabian card game',
      descriptionAr: 'لعبة الورق السعودية التقليدية',
      iconName: 'Gem',
      colorClass: 'bg-rose-500/20 text-rose-500 border-rose-500/30',
      gradientClass: 'from-rose-500/20 to-rose-600/10',
      isActive: true,
      minStake: '1.00',
      maxStake: '1000.00',
      houseFee: '0.05',
      minPlayers: 4,
      maxPlayers: 4,
      defaultTimeLimit: 900,
      isFeatured: false,
      sortOrder: 5,
    },
  ];

  for (const game of defaultGames) {
    await storage.createMultiplayerGame(game);
  }

  // Set initial config version for multiplayer games
  await storage.setSystemConfig('multiplayer_games_version', '1');
  
  console.log('Seeded multiplayer games successfully');
}

// Run seed on module load
seedMultiplayerGames().catch(console.error);
