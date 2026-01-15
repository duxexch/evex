import {
  users, agents, affiliates, games, transactions, complaints, promoCodes,
  gameSessions, agentPaymentMethods, complaintMessages, complaintAttachments,
  auditLogs, financialLimits, systemSettings, linkAnalytics, promoCodeUsages,
  passwordResetTokens, countryPaymentMethods,
  notifications, userSessions, loginHistory, announcements, announcementViews, userPreferences,
  userRelationships, socialPlatforms,
  gameReplays, replayEvents, replayPlayers,
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
  type GameReplay, type InsertGameReplay,
  type ReplayEvent, type InsertReplayEvent,
  type ReplayPlayer, type InsertReplayPlayer,
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
  listGames(status?: string): Promise<Game[]>;
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

  // Game Replays
  createGameReplay(replay: InsertGameReplay): Promise<GameReplay>;
  getGameReplay(id: string): Promise<GameReplay | undefined>;
  getGameReplayByMatch(matchId: string): Promise<GameReplay | undefined>;
  updateGameReplay(id: string, data: Partial<InsertGameReplay>): Promise<GameReplay | undefined>;
  listGameReplays(options?: { gameId?: string; userId?: string; isPublic?: boolean; isFeatured?: boolean; limit?: number }): Promise<GameReplay[]>;
  incrementReplayViewCount(id: string): Promise<void>;
  deleteGameReplay(id: string): Promise<boolean>;

  // Replay Events
  createReplayEvent(event: InsertReplayEvent): Promise<ReplayEvent>;
  getReplayEvents(replayId: string): Promise<ReplayEvent[]>;
  bulkCreateReplayEvents(events: InsertReplayEvent[]): Promise<ReplayEvent[]>;

  // Replay Players
  createReplayPlayer(player: InsertReplayPlayer): Promise<ReplayPlayer>;
  getReplayPlayers(replayId: string): Promise<ReplayPlayer[]>;
  getUserReplays(userId: string, limit?: number): Promise<GameReplay[]>;
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
    const user = await this.getUser(id);
    if (!user) return undefined;
    
    const currentBalance = parseFloat(user.balance);
    const changeAmount = parseFloat(amount);
    const newBalance = operation === 'add' 
      ? (currentBalance + changeAmount).toFixed(2)
      : (currentBalance - changeAmount).toFixed(2);
    
    return this.updateUser(id, { balance: newBalance });
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

  async listGames(status?: string): Promise<Game[]> {
    if (status) {
      return db.select().from(games).where(eq(games.status, status as any)).orderBy(asc(games.sortOrder));
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

  // ==================== GAME REPLAYS ====================

  async createGameReplay(replay: InsertGameReplay): Promise<GameReplay> {
    const [created] = await db.insert(gameReplays).values(replay).returning();
    return created;
  }

  async getGameReplay(id: string): Promise<GameReplay | undefined> {
    const [replay] = await db.select().from(gameReplays).where(eq(gameReplays.id, id));
    return replay || undefined;
  }

  async getGameReplayByMatch(matchId: string): Promise<GameReplay | undefined> {
    const [replay] = await db.select().from(gameReplays).where(eq(gameReplays.matchId, matchId));
    return replay || undefined;
  }

  async updateGameReplay(id: string, data: Partial<InsertGameReplay>): Promise<GameReplay | undefined> {
    const [updated] = await db.update(gameReplays)
      .set(data)
      .where(eq(gameReplays.id, id))
      .returning();
    return updated || undefined;
  }

  async listGameReplays(options?: { 
    gameId?: string; 
    userId?: string; 
    isPublic?: boolean; 
    isFeatured?: boolean; 
    limit?: number 
  }): Promise<GameReplay[]> {
    let query = db.select().from(gameReplays);
    
    const conditions = [];
    
    if (options?.gameId) {
      conditions.push(eq(gameReplays.gameId, options.gameId));
    }
    if (options?.isPublic !== undefined) {
      conditions.push(eq(gameReplays.isPublic, options.isPublic));
    }
    if (options?.isFeatured !== undefined) {
      conditions.push(eq(gameReplays.isFeatured, options.isFeatured));
    }
    conditions.push(eq(gameReplays.status, 'completed'));
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    query = query.orderBy(desc(gameReplays.createdAt)) as any;
    
    if (options?.limit) {
      query = query.limit(options.limit) as any;
    }
    
    return query;
  }

  async incrementReplayViewCount(id: string): Promise<void> {
    await db.update(gameReplays)
      .set({ viewCount: sql`${gameReplays.viewCount} + 1` })
      .where(eq(gameReplays.id, id));
  }

  async deleteGameReplay(id: string): Promise<boolean> {
    await db.delete(gameReplays).where(eq(gameReplays.id, id));
    return true;
  }

  // ==================== REPLAY EVENTS ====================

  async createReplayEvent(event: InsertReplayEvent): Promise<ReplayEvent> {
    const [created] = await db.insert(replayEvents).values(event).returning();
    return created;
  }

  async getReplayEvents(replayId: string): Promise<ReplayEvent[]> {
    return db.select().from(replayEvents)
      .where(eq(replayEvents.replayId, replayId))
      .orderBy(asc(replayEvents.sequenceNumber));
  }

  async bulkCreateReplayEvents(events: InsertReplayEvent[]): Promise<ReplayEvent[]> {
    if (events.length === 0) return [];
    return db.insert(replayEvents).values(events).returning();
  }

  // ==================== REPLAY PLAYERS ====================

  async createReplayPlayer(player: InsertReplayPlayer): Promise<ReplayPlayer> {
    const [created] = await db.insert(replayPlayers).values(player).returning();
    return created;
  }

  async getReplayPlayers(replayId: string): Promise<ReplayPlayer[]> {
    return db.select().from(replayPlayers)
      .where(eq(replayPlayers.replayId, replayId))
      .orderBy(asc(replayPlayers.position));
  }

  async getUserReplays(userId: string, limit: number = 50): Promise<GameReplay[]> {
    const playerReplays = await db.select({ replayId: replayPlayers.replayId })
      .from(replayPlayers)
      .where(eq(replayPlayers.userId, userId));
    
    const replayIds = playerReplays.map(r => r.replayId);
    
    if (replayIds.length === 0) return [];
    
    return db.select().from(gameReplays)
      .where(sql`${gameReplays.id} IN (${sql.join(replayIds.map(id => sql`${id}`), sql`, `)})`)
      .orderBy(desc(gameReplays.createdAt))
      .limit(limit);
  }
}

export const storage = new DatabaseStorage();
