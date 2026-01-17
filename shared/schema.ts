import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, timestamp, pgEnum, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ==================== ENUMS ====================

export const userRoleEnum = pgEnum("user_role", ["admin", "agent", "affiliate", "player"]);
export const userStatusEnum = pgEnum("user_status", ["active", "inactive", "suspended", "banned"]);
export const gameStatusEnum = pgEnum("game_status", ["active", "inactive", "maintenance"]);
export const gameVolatilityEnum = pgEnum("game_volatility", ["low", "medium", "high"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["deposit", "withdrawal", "stake", "win", "bonus", "commission", "refund", "gift_sent", "gift_received"]);
export const transactionStatusEnum = pgEnum("transaction_status", ["pending", "approved", "rejected", "completed", "cancelled"]);
export const complaintStatusEnum = pgEnum("complaint_status", ["open", "assigned", "in_progress", "escalated", "resolved", "closed"]);
export const complaintPriorityEnum = pgEnum("complaint_priority", ["low", "medium", "high", "urgent"]);
export const complaintCategoryEnum = pgEnum("complaint_category", ["financial", "technical", "account", "game", "other"]);
export const promoCodeTypeEnum = pgEnum("promo_code_type", ["percentage", "fixed", "free_spins"]);
export const paymentMethodTypeEnum = pgEnum("payment_method_type", ["bank_transfer", "e_wallet", "crypto", "card"]);
export const auditActionEnum = pgEnum("audit_action", ["login", "logout", "deposit", "withdrawal", "stake", "win", "complaint", "settings_change", "user_update", "game_update"]);

// ==================== USERS ====================

export const idVerificationStatusEnum = pgEnum("id_verification_status", ["pending", "approved", "rejected"]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").unique(),
  username: text("username").notNull().unique(),
  nickname: text("nickname").unique(),
  email: text("email").unique(),
  password: text("password").notNull(),
  profilePicture: text("profile_picture"),
  coverPhoto: text("cover_photo"),
  role: userRoleEnum("role").notNull().default("player"),
  status: userStatusEnum("status").notNull().default("active"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone").unique(),
  phoneVerified: boolean("phone_verified").default(false),
  balance: decimal("balance", { precision: 15, scale: 2 }).notNull().default("0.00"),
  totalDeposited: decimal("total_deposited", { precision: 15, scale: 2 }).notNull().default("0.00"),
  totalWithdrawn: decimal("total_withdrawn", { precision: 15, scale: 2 }).notNull().default("0.00"),
  totalWagered: decimal("total_wagered", { precision: 15, scale: 2 }).notNull().default("0.00"),
  totalWon: decimal("total_won", { precision: 15, scale: 2 }).notNull().default("0.00"),
  totalEarnings: decimal("total_earnings", { precision: 15, scale: 2 }).notNull().default("0.00"),
  gamesPlayed: integer("games_played").notNull().default(0),
  gamesWon: integer("games_won").notNull().default(0),
  gamesLost: integer("games_lost").notNull().default(0),
  gamesDraw: integer("games_draw").notNull().default(0),
  chessPlayed: integer("chess_played").notNull().default(0),
  chessWon: integer("chess_won").notNull().default(0),
  backgammonPlayed: integer("backgammon_played").notNull().default(0),
  backgammonWon: integer("backgammon_won").notNull().default(0),
  dominoPlayed: integer("domino_played").notNull().default(0),
  dominoWon: integer("domino_won").notNull().default(0),
  tarneebPlayed: integer("tarneeb_played").notNull().default(0),
  tarneebWon: integer("tarneeb_won").notNull().default(0),
  balootPlayed: integer("baloot_played").notNull().default(0),
  balootWon: integer("baloot_won").notNull().default(0),
  currentWinStreak: integer("current_win_streak").notNull().default(0),
  longestWinStreak: integer("longest_win_streak").notNull().default(0),
  vipLevel: integer("vip_level").notNull().default(0),
  p2pBanned: boolean("p2p_banned").notNull().default(false),
  p2pBanReason: text("p2p_ban_reason"),
  p2pBannedAt: timestamp("p2p_banned_at"),
  p2pRating: decimal("p2p_rating", { precision: 3, scale: 2 }).default("5.00"),
  p2pTotalTrades: integer("p2p_total_trades").notNull().default(0),
  p2pSuccessfulTrades: integer("p2p_successful_trades").notNull().default(0),
  idVerificationStatus: idVerificationStatusEnum("id_verification_status"),
  idFrontImage: text("id_front_image"),
  idBackImage: text("id_back_image"),
  idVerificationRejectionReason: text("id_verification_rejection_reason"),
  idVerifiedAt: timestamp("id_verified_at"),
  referredBy: varchar("referred_by").references(() => users.id),
  freePlayCount: integer("free_play_count").notNull().default(0),
  freePlayResetAt: timestamp("free_play_reset_at"),
  withdrawalPassword: text("withdrawal_password"),
  withdrawalPasswordEnabled: boolean("withdrawal_password_enabled").default(false),
  isOnline: boolean("is_online").notNull().default(false),
  stealthMode: boolean("stealth_mode").notNull().default(false),
  lastActiveAt: timestamp("last_active_at"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  blockedUsers: text("blocked_users").array().notNull().default(sql`'{}'::text[]`),
  mutedUsers: text("muted_users").array().notNull().default(sql`'{}'::text[]`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
}, (table) => [
  index("idx_users_role").on(table.role),
  index("idx_users_status").on(table.status),
  index("idx_users_referred_by").on(table.referredBy),
  index("idx_users_games_won").on(table.gamesWon),
  index("idx_users_total_earnings").on(table.totalEarnings),
  index("idx_users_longest_win_streak").on(table.longestWinStreak),
  index("idx_users_chess_won").on(table.chessWon),
  index("idx_users_backgammon_won").on(table.backgammonWon),
  index("idx_users_domino_won").on(table.dominoWon),
  index("idx_users_tarneeb_won").on(table.tarneebWon),
  index("idx_users_baloot_won").on(table.balootWon),
]);

export const usersRelations = relations(users, ({ one, many }) => ({
  referrer: one(users, { fields: [users.referredBy], references: [users.id] }),
  agent: one(agents, { fields: [users.id], references: [agents.userId] }),
  affiliate: one(affiliates, { fields: [users.id], references: [affiliates.userId] }),
  transactions: many(transactions),
  gameSessions: many(gameSessions),
  complaints: many(complaints),
  auditLogs: many(auditLogs),
}));

// ==================== AGENTS ====================

export const agents = pgTable("agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  agentCode: text("agent_code").notNull().unique(),
  commissionRateDeposit: decimal("commission_rate_deposit", { precision: 5, scale: 4 }).notNull().default("0.02"),
  commissionRateWithdraw: decimal("commission_rate_withdraw", { precision: 5, scale: 4 }).notNull().default("0.01"),
  totalCommissionEarned: decimal("total_commission_earned", { precision: 15, scale: 2 }).notNull().default("0.00"),
  totalDepositsProcessed: decimal("total_deposits_processed", { precision: 15, scale: 2 }).notNull().default("0.00"),
  totalWithdrawalsProcessed: decimal("total_withdrawals_processed", { precision: 15, scale: 2 }).notNull().default("0.00"),
  dailyLimit: decimal("daily_limit", { precision: 15, scale: 2 }).notNull().default("100000.00"),
  monthlyLimit: decimal("monthly_limit", { precision: 15, scale: 2 }).notNull().default("1000000.00"),
  initialDeposit: decimal("initial_deposit", { precision: 15, scale: 2 }).notNull().default("0.00"),
  currentBalance: decimal("current_balance", { precision: 15, scale: 2 }).notNull().default("0.00"),
  isOnline: boolean("is_online").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  assignedCustomersCount: integer("assigned_customers_count").notNull().default(0),
  performanceScore: decimal("performance_score", { precision: 5, scale: 2 }).notNull().default("100.00"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("idx_agents_user_id").on(table.userId),
  index("idx_agents_is_active").on(table.isActive),
]);

export const agentsRelations = relations(agents, ({ one, many }) => ({
  user: one(users, { fields: [agents.userId], references: [users.id] }),
  paymentMethods: many(agentPaymentMethods),
  assignedComplaints: many(complaints),
  processedTransactions: many(transactions),
}));

// ==================== AGENT PAYMENT METHODS ====================

export const agentPaymentMethods = pgTable("agent_payment_methods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  type: paymentMethodTypeEnum("type").notNull(),
  name: text("name").notNull(),
  accountNumber: text("account_number"),
  bankName: text("bank_name"),
  holderName: text("holder_name"),
  details: text("details"),
  isActive: boolean("is_active").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_agent_payment_methods_agent_id").on(table.agentId),
]);

export const agentPaymentMethodsRelations = relations(agentPaymentMethods, ({ one }) => ({
  agent: one(agents, { fields: [agentPaymentMethods.agentId], references: [agents.id] }),
}));

// ==================== AFFILIATES ====================

export const affiliates = pgTable("affiliates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  affiliateCode: text("affiliate_code").notNull().unique(),
  referralLink: text("referral_link"),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).notNull().default("5.00"),
  totalReferrals: integer("total_referrals").notNull().default(0),
  activeReferrals: integer("active_referrals").notNull().default(0),
  totalCommissionEarned: decimal("total_commission_earned", { precision: 15, scale: 2 }).notNull().default("0.00"),
  pendingCommission: decimal("pending_commission", { precision: 15, scale: 2 }).notNull().default("0.00"),
  totalClicks: integer("total_clicks").notNull().default(0),
  totalRegistrations: integer("total_registrations").notNull().default(0),
  totalDeposits: integer("total_deposits").notNull().default(0),
  tier: text("tier").notNull().default("bronze"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("idx_affiliates_user_id").on(table.userId),
  index("idx_affiliates_code").on(table.affiliateCode),
]);

export const affiliatesRelations = relations(affiliates, ({ one, many }) => ({
  user: one(users, { fields: [affiliates.userId], references: [users.id] }),
  promoCodes: many(promoCodes),
  linkAnalytics: many(linkAnalytics),
}));

// ==================== PROMO CODES ====================

export const promoCodes = pgTable("promo_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  affiliateId: varchar("affiliate_id").references(() => affiliates.id),
  type: promoCodeTypeEnum("type").notNull().default("percentage"),
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  minDeposit: decimal("min_deposit", { precision: 15, scale: 2 }).default("0.00"),
  maxDiscount: decimal("max_discount", { precision: 15, scale: 2 }),
  usageLimit: integer("usage_limit"),
  usageCount: integer("usage_count").notNull().default(0),
  perUserLimit: integer("per_user_limit").default(1),
  isActive: boolean("is_active").notNull().default(true),
  startsAt: timestamp("starts_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_promo_codes_code").on(table.code),
  index("idx_promo_codes_affiliate_id").on(table.affiliateId),
]);

export const promoCodesRelations = relations(promoCodes, ({ one, many }) => ({
  affiliate: one(affiliates, { fields: [promoCodes.affiliateId], references: [affiliates.id] }),
  usages: many(promoCodeUsages),
}));

// ==================== PROMO CODE USAGES ====================

export const promoCodeUsages = pgTable("promo_code_usages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  promoCodeId: varchar("promo_code_id").notNull().references(() => promoCodes.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  transactionId: varchar("transaction_id").references(() => transactions.id),
  discountAmount: decimal("discount_amount", { precision: 15, scale: 2 }).notNull(),
  usedAt: timestamp("used_at").notNull().defaultNow(),
}, (table) => [
  index("idx_promo_code_usages_promo_code_id").on(table.promoCodeId),
  index("idx_promo_code_usages_user_id").on(table.userId),
]);

export const promoCodeUsagesRelations = relations(promoCodeUsages, ({ one }) => ({
  promoCode: one(promoCodes, { fields: [promoCodeUsages.promoCodeId], references: [promoCodes.id] }),
  user: one(users, { fields: [promoCodeUsages.userId], references: [users.id] }),
  transaction: one(transactions, { fields: [promoCodeUsages.transactionId], references: [transactions.id] }),
}));

// ==================== LINK ANALYTICS ====================

export const linkAnalytics = pgTable("link_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  affiliateId: varchar("affiliate_id").notNull().references(() => affiliates.id),
  source: text("source"),
  medium: text("medium"),
  campaign: text("campaign"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  country: text("country"),
  city: text("city"),
  isRegistered: boolean("is_registered").notNull().default(false),
  isDeposited: boolean("is_deposited").notNull().default(false),
  registeredUserId: varchar("registered_user_id").references(() => users.id),
  clickedAt: timestamp("clicked_at").notNull().defaultNow(),
}, (table) => [
  index("idx_link_analytics_affiliate_id").on(table.affiliateId),
  index("idx_link_analytics_clicked_at").on(table.clickedAt),
]);

export const linkAnalyticsRelations = relations(linkAnalytics, ({ one }) => ({
  affiliate: one(affiliates, { fields: [linkAnalytics.affiliateId], references: [affiliates.id] }),
  registeredUser: one(users, { fields: [linkAnalytics.registeredUserId], references: [users.id] }),
}));

// ==================== MULTIPLAYER GAMES (Single Source of Truth) ====================

export const multiplayerGames = pgTable("multiplayer_games", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(), // chess, backgammon, domino, tarneeb, baloot
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  descriptionEn: text("description_en"),
  descriptionAr: text("description_ar"),
  iconName: text("icon_name").notNull().default("Gamepad2"), // Lucide icon name
  colorClass: text("color_class").notNull().default("bg-primary/20 text-primary"), // Tailwind color classes
  gradientClass: text("gradient_class").default("from-primary/20 to-primary/10"),
  isActive: boolean("is_active").notNull().default(true),
  minStake: decimal("min_stake", { precision: 15, scale: 2 }).notNull().default("1.00"),
  maxStake: decimal("max_stake", { precision: 15, scale: 2 }).notNull().default("1000.00"),
  houseFee: decimal("house_fee", { precision: 5, scale: 4 }).notNull().default("0.05"), // 5% = 0.05
  minPlayers: integer("min_players").notNull().default(2),
  maxPlayers: integer("max_players").notNull().default(2),
  defaultTimeLimit: integer("default_time_limit").notNull().default(300), // seconds
  isFeatured: boolean("is_featured").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  totalGamesPlayed: integer("total_games_played").notNull().default(0),
  totalVolume: decimal("total_volume", { precision: 20, scale: 2 }).notNull().default("0.00"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_multiplayer_games_key").on(table.key),
  index("idx_multiplayer_games_is_active").on(table.isActive),
  index("idx_multiplayer_games_sort_order").on(table.sortOrder),
]);

export const insertMultiplayerGameSchema = createInsertSchema(multiplayerGames).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  totalGamesPlayed: true,
  totalVolume: true,
});

export type InsertMultiplayerGame = z.infer<typeof insertMultiplayerGameSchema>;
export type MultiplayerGame = typeof multiplayerGames.$inferSelect;

// ==================== SYSTEM CONFIG (Configuration Versioning) ====================

export const systemConfig = pgTable("system_config", {
  key: text("key").primaryKey(),
  value: text("value"),
  version: integer("version").notNull().default(1),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id),
});

export const insertSystemConfigSchema = createInsertSchema(systemConfig);
export type InsertSystemConfig = z.infer<typeof insertSystemConfigSchema>;
export type SystemConfig = typeof systemConfig.$inferSelect;

// ==================== SCHEDULED CONFIG CHANGES ====================

export const scheduledChangeStatusEnum = pgEnum("scheduled_change_status", ["pending", "applied", "cancelled", "failed"]);
export const scheduledChangeActionEnum = pgEnum("scheduled_change_action", ["activate", "deactivate", "update_settings"]);

export const scheduledConfigChanges = pgTable("scheduled_config_changes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameId: varchar("game_id").notNull().references(() => multiplayerGames.id, { onDelete: "cascade" }),
  action: scheduledChangeActionEnum("action").notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  status: scheduledChangeStatusEnum("status").notNull().default("pending"),
  changes: text("changes"), // JSON string of field changes for update_settings action
  description: text("description"), // Admin note about this change
  createdBy: varchar("created_by").notNull().references(() => users.id),
  appliedAt: timestamp("applied_at"),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_scheduled_changes_game_id").on(table.gameId),
  index("idx_scheduled_changes_status").on(table.status),
  index("idx_scheduled_changes_scheduled_at").on(table.scheduledAt),
]);

export const scheduledConfigChangesRelations = relations(scheduledConfigChanges, ({ one }) => ({
  game: one(multiplayerGames, { fields: [scheduledConfigChanges.gameId], references: [multiplayerGames.id] }),
  creator: one(users, { fields: [scheduledConfigChanges.createdBy], references: [users.id] }),
}));

export const insertScheduledConfigChangeSchema = createInsertSchema(scheduledConfigChanges).omit({
  id: true,
  status: true,
  appliedAt: true,
  failureReason: true,
  createdAt: true,
});

export type InsertScheduledConfigChange = z.infer<typeof insertScheduledConfigChangeSchema>;
export type ScheduledConfigChange = typeof scheduledConfigChanges.$inferSelect;

// ==================== GAMES ====================

export const games = pgTable("games", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  imageUrl: text("image_url"),
  thumbnailUrl: text("thumbnail_url"),
  category: text("category").notNull().default("slots"),
  sections: text("sections").array().notNull().default(sql`ARRAY['play']::text[]`),
  gameType: text("game_type").notNull().default("single"),
  status: gameStatusEnum("status").notNull().default("active"),
  rtp: decimal("rtp", { precision: 5, scale: 2 }).notNull().default("95.00"),
  houseEdge: decimal("house_edge", { precision: 5, scale: 2 }).notNull().default("5.00"),
  volatility: gameVolatilityEnum("volatility").notNull().default("medium"),
  minBet: decimal("min_bet", { precision: 15, scale: 2 }).notNull().default("1.00"),
  maxBet: decimal("max_bet", { precision: 15, scale: 2 }).notNull().default("1000.00"),
  multiplierMin: decimal("multiplier_min", { precision: 10, scale: 2 }).notNull().default("0.00"),
  multiplierMax: decimal("multiplier_max", { precision: 10, scale: 2 }).notNull().default("100.00"),
  playCount: integer("play_count").notNull().default(0),
  totalVolume: decimal("total_volume", { precision: 15, scale: 2 }).notNull().default("0.00"),
  isFeatured: boolean("is_featured").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  maxPlayers: integer("max_players").notNull().default(1),
  minPlayers: integer("min_players").notNull().default(1),
  isFreeToPlay: boolean("is_free_to_play").notNull().default(false),
  playPrice: decimal("play_price", { precision: 15, scale: 2 }).default("0.00"),
  pricingType: text("pricing_type").notNull().default("bet"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_games_status").on(table.status),
  index("idx_games_category").on(table.category),
  index("idx_games_game_type").on(table.gameType),
]);

export const gamesRelations = relations(games, ({ one, many }) => ({
  creator: one(users, { fields: [games.createdBy], references: [users.id] }),
  sessions: many(gameSessions),
}));

// ==================== GAME SESSIONS ====================

export const gameSessions = pgTable("game_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  gameId: varchar("game_id").notNull().references(() => games.id),
  betAmount: decimal("bet_amount", { precision: 15, scale: 2 }).notNull(),
  multiplier: decimal("multiplier", { precision: 10, scale: 2 }).notNull(),
  winAmount: decimal("win_amount", { precision: 15, scale: 2 }).notNull().default("0.00"),
  isWin: boolean("is_win").notNull(),
  balanceBefore: decimal("balance_before", { precision: 15, scale: 2 }).notNull(),
  balanceAfter: decimal("balance_after", { precision: 15, scale: 2 }).notNull(),
  seed: text("seed"),
  result: text("result"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_game_sessions_user_id").on(table.userId),
  index("idx_game_sessions_game_id").on(table.gameId),
  index("idx_game_sessions_created_at").on(table.createdAt),
]);

export const gameSessionsRelations = relations(gameSessions, ({ one }) => ({
  user: one(users, { fields: [gameSessions.userId], references: [users.id] }),
  game: one(games, { fields: [gameSessions.gameId], references: [games.id] }),
}));

// ==================== TRANSACTIONS ====================

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: transactionTypeEnum("type").notNull(),
  status: transactionStatusEnum("status").notNull().default("pending"),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  balanceBefore: decimal("balance_before", { precision: 15, scale: 2 }).notNull(),
  balanceAfter: decimal("balance_after", { precision: 15, scale: 2 }).notNull(),
  description: text("description"),
  referenceId: text("reference_id"),
  processedBy: varchar("processed_by").references(() => agents.id),
  processedAt: timestamp("processed_at"),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_transactions_user_id").on(table.userId),
  index("idx_transactions_type").on(table.type),
  index("idx_transactions_status").on(table.status),
  index("idx_transactions_created_at").on(table.createdAt),
]);

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  processor: one(agents, { fields: [transactions.processedBy], references: [agents.id] }),
}));

// ==================== FINANCIAL LIMITS ====================

export const financialLimits = pgTable("financial_limits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  vipLevel: integer("vip_level").notNull().default(0),
  minDeposit: decimal("min_deposit", { precision: 15, scale: 2 }).notNull().default("10.00"),
  maxDeposit: decimal("max_deposit", { precision: 15, scale: 2 }).notNull().default("10000.00"),
  minWithdrawal: decimal("min_withdrawal", { precision: 15, scale: 2 }).notNull().default("20.00"),
  maxWithdrawal: decimal("max_withdrawal", { precision: 15, scale: 2 }).notNull().default("5000.00"),
  dailyWithdrawalLimit: decimal("daily_withdrawal_limit", { precision: 15, scale: 2 }).notNull().default("10000.00"),
  monthlyWithdrawalLimit: decimal("monthly_withdrawal_limit", { precision: 15, scale: 2 }).notNull().default("100000.00"),
  minBet: decimal("min_bet", { precision: 15, scale: 2 }).notNull().default("1.00"),
  maxBet: decimal("max_bet", { precision: 15, scale: 2 }).notNull().default("1000.00"),
  dailyLossLimit: decimal("daily_loss_limit", { precision: 15, scale: 2 }),
  weeklyLossLimit: decimal("weekly_loss_limit", { precision: 15, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ==================== COMPLAINTS ====================

export const complaints = pgTable("complaints", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketNumber: text("ticket_number").notNull().unique(),
  userId: varchar("user_id").notNull().references(() => users.id),
  assignedAgentId: varchar("assigned_agent_id").references(() => agents.id),
  category: complaintCategoryEnum("category").notNull(),
  priority: complaintPriorityEnum("priority").notNull().default("medium"),
  status: complaintStatusEnum("status").notNull().default("open"),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  transactionId: varchar("transaction_id").references(() => transactions.id),
  slaDeadline: timestamp("sla_deadline"),
  resolvedAt: timestamp("resolved_at"),
  resolution: text("resolution"),
  rating: integer("rating"),
  ratingComment: text("rating_comment"),
  escalatedAt: timestamp("escalated_at"),
  escalatedTo: varchar("escalated_to").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_complaints_user_id").on(table.userId),
  index("idx_complaints_assigned_agent_id").on(table.assignedAgentId),
  index("idx_complaints_status").on(table.status),
  index("idx_complaints_priority").on(table.priority),
]);

export const complaintsRelations = relations(complaints, ({ one, many }) => ({
  user: one(users, { fields: [complaints.userId], references: [users.id] }),
  assignedAgent: one(agents, { fields: [complaints.assignedAgentId], references: [agents.id] }),
  transaction: one(transactions, { fields: [complaints.transactionId], references: [transactions.id] }),
  escalatedToUser: one(users, { fields: [complaints.escalatedTo], references: [users.id] }),
  messages: many(complaintMessages),
  attachments: many(complaintAttachments),
}));

// ==================== COMPLAINT MESSAGES ====================

export const complaintMessages = pgTable("complaint_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  complaintId: varchar("complaint_id").notNull().references(() => complaints.id),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  isInternal: boolean("is_internal").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_complaint_messages_complaint_id").on(table.complaintId),
]);

export const complaintMessagesRelations = relations(complaintMessages, ({ one }) => ({
  complaint: one(complaints, { fields: [complaintMessages.complaintId], references: [complaints.id] }),
  sender: one(users, { fields: [complaintMessages.senderId], references: [users.id] }),
}));

// ==================== COMPLAINT ATTACHMENTS ====================

export const complaintAttachments = pgTable("complaint_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  complaintId: varchar("complaint_id").notNull().references(() => complaints.id),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
}, (table) => [
  index("idx_complaint_attachments_complaint_id").on(table.complaintId),
]);

export const complaintAttachmentsRelations = relations(complaintAttachments, ({ one }) => ({
  complaint: one(complaints, { fields: [complaintAttachments.complaintId], references: [complaints.id] }),
  uploader: one(users, { fields: [complaintAttachments.uploadedBy], references: [users.id] }),
}));

// ==================== AUDIT LOGS ====================

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  action: auditActionEnum("action").notNull(),
  entityType: text("entity_type"),
  entityId: varchar("entity_id"),
  details: text("details"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_audit_logs_user_id").on(table.userId),
  index("idx_audit_logs_action").on(table.action),
  index("idx_audit_logs_created_at").on(table.createdAt),
]);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}));

// ==================== SYSTEM SETTINGS ====================

export const systemSettings = pgTable("system_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  category: text("category"),
  description: text("description"),
  dataType: text("data_type").default("string"),
  updatedBy: varchar("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ==================== PASSWORD RESET TOKENS ====================

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_password_reset_tokens_user_id").on(table.userId),
  index("idx_password_reset_tokens_token").on(table.token),
]);

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, { fields: [passwordResetTokens.userId], references: [users.id] }),
}));

// ==================== DEPOSIT REQUESTS ====================

export const depositRequestStatusEnum = pgEnum("deposit_request_status", ["pending", "confirmed", "rejected", "expired"]);

export const depositRequests = pgTable("deposit_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  assignedAgentId: varchar("assigned_agent_id").references(() => agents.id),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  paymentMethod: text("payment_method").notNull(),
  paymentReference: text("payment_reference").notNull(),
  walletNumber: text("wallet_number"),
  status: depositRequestStatusEnum("status").notNull().default("pending"),
  minAmount: decimal("min_amount", { precision: 15, scale: 2 }),
  maxAmount: decimal("max_amount", { precision: 15, scale: 2 }),
  agentNote: text("agent_note"),
  confirmedAt: timestamp("confirmed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_deposit_requests_user_id").on(table.userId),
  index("idx_deposit_requests_agent_id").on(table.assignedAgentId),
  index("idx_deposit_requests_status").on(table.status),
]);

// ==================== LANGUAGES ====================

export const languages = pgTable("languages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  nativeName: text("native_name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ==================== CURRENCIES ====================

export const currencies = pgTable("currencies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  exchangeRate: decimal("exchange_rate", { precision: 15, scale: 6 }).notNull().default("1.000000"),
  isActive: boolean("is_active").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),
  country: text("country"),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ==================== COUNTRY PAYMENT METHODS ====================

export const countryPaymentMethods = pgTable("country_payment_methods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  countryCode: text("country_code").notNull(),
  currencyId: varchar("currency_id").references(() => currencies.id),
  name: text("name").notNull(),
  type: paymentMethodTypeEnum("type").notNull(),
  iconUrl: text("icon_url"),
  minAmount: decimal("min_amount", { precision: 15, scale: 2 }).notNull().default("10.00"),
  maxAmount: decimal("max_amount", { precision: 15, scale: 2 }).notNull().default("10000.00"),
  isAvailable: boolean("is_available").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  processingTime: text("processing_time"),
  instructions: text("instructions"),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => [
  index("idx_country_payment_methods_country").on(table.countryCode),
]);

// ==================== FEATURE FLAGS (Section Control) ====================

export const featureFlags = pgTable("feature_flags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  description: text("description"),
  descriptionAr: text("description_ar"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  category: text("category").notNull().default("section"),
  sortOrder: integer("sort_order").notNull().default(0),
  icon: text("icon"),
  updatedBy: varchar("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_feature_flags_key").on(table.key),
  index("idx_feature_flags_category").on(table.category),
]);

// ==================== ADMIN AUDIT LOGS ====================

export const adminAuditActionEnum = pgEnum("admin_audit_action", [
  "login", "logout", "user_update", "user_ban", "user_suspend", "user_balance_adjust",
  "reward_sent", "dispute_resolve", "theme_change", "section_toggle", "settings_update",
  "announcement_create", "announcement_update", "game_update", "promo_create",
  "p2p_ban", "p2p_unban"
]);

export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminId: varchar("admin_id").notNull().references(() => users.id),
  action: adminAuditActionEnum("action").notNull(),
  entityType: text("entity_type"),
  entityId: varchar("entity_id"),
  previousValue: text("previous_value"),
  newValue: text("new_value"),
  reason: text("reason"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_admin_audit_logs_admin").on(table.adminId),
  index("idx_admin_audit_logs_action").on(table.action),
  index("idx_admin_audit_logs_created_at").on(table.createdAt),
]);

export const adminAuditLogsRelations = relations(adminAuditLogs, ({ one }) => ({
  admin: one(users, { fields: [adminAuditLogs.adminId], references: [users.id] }),
}));

// ==================== THEMES ====================

export const themes = pgTable("themes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  displayName: text("display_name").notNull(),
  primaryColor: text("primary_color").notNull(),
  secondaryColor: text("secondary_color").notNull(),
  accentColor: text("accent_color").notNull(),
  backgroundColor: text("background_color").notNull(),
  foregroundColor: text("foreground_color").notNull(),
  cardColor: text("card_color").notNull(),
  mutedColor: text("muted_color").notNull(),
  borderColor: text("border_color").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ==================== SUPPORT CONTACTS ====================

export const supportContactTypeEnum = pgEnum("support_contact_type", [
  "whatsapp", "telegram", "email", "phone", "facebook", "instagram", "twitter", "discord", "other"
]);

export const supportContacts = pgTable("support_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: supportContactTypeEnum("type").notNull(),
  label: text("label").notNull(),
  value: text("value").notNull(),
  icon: text("icon"),
  isActive: boolean("is_active").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ==================== P2P ENUMS ====================

export const p2pOfferTypeEnum = pgEnum("p2p_offer_type", ["buy", "sell"]);
export const p2pOfferStatusEnum = pgEnum("p2p_offer_status", ["active", "paused", "completed", "cancelled"]);
export const p2pTradeStatusEnum = pgEnum("p2p_trade_status", ["pending", "paid", "confirmed", "completed", "cancelled", "disputed"]);
export const p2pDisputeStatusEnum = pgEnum("p2p_dispute_status", ["open", "investigating", "resolved", "closed"]);

// ==================== P2P OFFERS ====================

export const p2pOffers = pgTable("p2p_offers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: p2pOfferTypeEnum("type").notNull(),
  status: p2pOfferStatusEnum("status").notNull().default("active"),
  cryptoCurrency: text("crypto_currency").notNull(),
  fiatCurrency: text("fiat_currency").notNull(),
  price: decimal("price", { precision: 15, scale: 2 }).notNull(),
  availableAmount: decimal("available_amount", { precision: 15, scale: 8 }).notNull(),
  minLimit: decimal("min_limit", { precision: 15, scale: 2 }).notNull(),
  maxLimit: decimal("max_limit", { precision: 15, scale: 2 }).notNull(),
  paymentMethods: text("payment_methods").array(),
  paymentTimeLimit: integer("payment_time_limit").notNull().default(15),
  terms: text("terms"),
  autoReply: text("auto_reply"),
  completedTrades: integer("completed_trades").notNull().default(0),
  completionRate: decimal("completion_rate", { precision: 5, scale: 2 }).notNull().default("100.00"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_p2p_offers_user_id").on(table.userId),
  index("idx_p2p_offers_type").on(table.type),
  index("idx_p2p_offers_status").on(table.status),
]);

// ==================== P2P TRADES ====================

export const p2pTrades = pgTable("p2p_trades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  offerId: varchar("offer_id").notNull().references(() => p2pOffers.id),
  buyerId: varchar("buyer_id").notNull().references(() => users.id),
  sellerId: varchar("seller_id").notNull().references(() => users.id),
  status: p2pTradeStatusEnum("status").notNull().default("pending"),
  amount: decimal("amount", { precision: 15, scale: 8 }).notNull(),
  fiatAmount: decimal("fiat_amount", { precision: 15, scale: 2 }).notNull(),
  price: decimal("price", { precision: 15, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(),
  paymentReference: text("payment_reference"),
  escrowAmount: decimal("escrow_amount", { precision: 15, scale: 8 }).notNull(),
  escrowEarnedAmount: decimal("escrow_earned_amount", { precision: 15, scale: 8 }).default("0"), // For project currency: earned portion
  escrowPurchasedAmount: decimal("escrow_purchased_amount", { precision: 15, scale: 8 }).default("0"), // For project currency: purchased portion
  platformFee: decimal("platform_fee", { precision: 15, scale: 8 }).notNull().default("0"),
  currencyType: text("currency_type").notNull().default("usd"), // 'usd' or 'project' (VEX Coin)
  expiresAt: timestamp("expires_at"),
  paidAt: timestamp("paid_at"),
  confirmedAt: timestamp("confirmed_at"),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
  cancelReason: text("cancel_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_p2p_trades_offer_id").on(table.offerId),
  index("idx_p2p_trades_buyer_id").on(table.buyerId),
  index("idx_p2p_trades_seller_id").on(table.sellerId),
  index("idx_p2p_trades_status").on(table.status),
]);

// ==================== P2P ESCROW ====================

export const p2pEscrow = pgTable("p2p_escrow", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tradeId: varchar("trade_id").notNull().references(() => p2pTrades.id),
  amount: decimal("amount", { precision: 15, scale: 8 }).notNull(),
  currency: text("currency").notNull(),
  status: text("status").notNull().default("held"),
  heldAt: timestamp("held_at").notNull().defaultNow(),
  releasedAt: timestamp("released_at"),
  returnedAt: timestamp("returned_at"),
}, (table) => [
  index("idx_p2p_escrow_trade_id").on(table.tradeId),
]);

// ==================== P2P DISPUTES ====================

export const p2pDisputes = pgTable("p2p_disputes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tradeId: varchar("trade_id").notNull().references(() => p2pTrades.id),
  initiatorId: varchar("initiator_id").notNull().references(() => users.id),
  respondentId: varchar("respondent_id").notNull().references(() => users.id),
  status: p2pDisputeStatusEnum("status").notNull().default("open"),
  reason: text("reason").notNull(),
  description: text("description").notNull(),
  evidence: text("evidence").array(),
  resolution: text("resolution"),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  winnerUserId: varchar("winner_user_id").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_p2p_disputes_trade_id").on(table.tradeId),
  index("idx_p2p_disputes_status").on(table.status),
]);

// ==================== P2P TRANSACTION LOGS ====================

export const p2pTransactionLogActionEnum = pgEnum("p2p_transaction_log_action", [
  "trade_created", "payment_marked", "payment_confirmed", "trade_completed", 
  "trade_cancelled", "dispute_opened", "dispute_message", "evidence_uploaded",
  "dispute_resolved", "escrow_held", "escrow_released", "escrow_returned"
]);

export const p2pTransactionLogs = pgTable("p2p_transaction_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tradeId: varchar("trade_id").notNull().references(() => p2pTrades.id),
  disputeId: varchar("dispute_id").references(() => p2pDisputes.id),
  userId: varchar("user_id").references(() => users.id),
  action: p2pTransactionLogActionEnum("action").notNull(),
  description: text("description").notNull(),
  descriptionAr: text("description_ar"),
  metadata: text("metadata"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_p2p_transaction_logs_trade_id").on(table.tradeId),
  index("idx_p2p_transaction_logs_dispute_id").on(table.disputeId),
  index("idx_p2p_transaction_logs_created_at").on(table.createdAt),
]);

// ==================== P2P DISPUTE MESSAGES ====================

export const p2pDisputeMessages = pgTable("p2p_dispute_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  disputeId: varchar("dispute_id").notNull().references(() => p2pDisputes.id),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  isPrewritten: boolean("is_prewritten").notNull().default(false),
  prewrittenTemplateId: varchar("prewritten_template_id"),
  isFromSupport: boolean("is_from_support").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_p2p_dispute_messages_dispute_id").on(table.disputeId),
  index("idx_p2p_dispute_messages_sender_id").on(table.senderId),
]);

// ==================== P2P TRADE MESSAGES ====================

export const p2pTradeMessages = pgTable("p2p_trade_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tradeId: varchar("trade_id").notNull().references(() => p2pTrades.id),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  isPrewritten: boolean("is_prewritten").notNull().default(false),
  isSystemMessage: boolean("is_system_message").notNull().default(false),
  attachmentUrl: text("attachment_url"),
  attachmentType: text("attachment_type"),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_p2p_trade_messages_trade_id").on(table.tradeId),
  index("idx_p2p_trade_messages_sender_id").on(table.senderId),
  index("idx_p2p_trade_messages_created_at").on(table.createdAt),
]);

// ==================== P2P DISPUTE EVIDENCE ====================

export const p2pDisputeEvidence = pgTable("p2p_dispute_evidence", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  disputeId: varchar("dispute_id").notNull().references(() => p2pDisputes.id),
  uploaderId: varchar("uploader_id").notNull().references(() => users.id),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  description: text("description"),
  evidenceType: text("evidence_type").notNull(),
  isVerified: boolean("is_verified").notNull().default(false),
  verifiedBy: varchar("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_p2p_dispute_evidence_dispute_id").on(table.disputeId),
  index("idx_p2p_dispute_evidence_uploader_id").on(table.uploaderId),
]);

// ==================== P2P PREWRITTEN RESPONSES ====================

export const p2pPrewrittenResponses = pgTable("p2p_prewritten_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: text("category").notNull(),
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  message: text("message").notNull(),
  messageAr: text("message_ar"),
  isActive: boolean("is_active").notNull().default(true),
  usageCount: integer("usage_count").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_p2p_prewritten_responses_category").on(table.category),
]);

// ==================== P2P DISPUTE RULES ====================

export const p2pDisputeRules = pgTable("p2p_dispute_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: text("category").notNull(),
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  content: text("content").notNull(),
  contentAr: text("content_ar"),
  icon: text("icon"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_p2p_dispute_rules_category").on(table.category),
]);

// ==================== P2P FEE TYPE ENUM ====================

export const p2pFeeTypeEnum = pgEnum("p2p_fee_type", ["percentage", "fixed", "hybrid"]);

// ==================== P2P SETTINGS ====================

export const p2pSettings = pgTable("p2p_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Fee configuration
  feeType: p2pFeeTypeEnum("fee_type").notNull().default("percentage"),
  platformFeePercentage: decimal("platform_fee_percentage", { precision: 5, scale: 4 }).notNull().default("0.005"),
  platformFeeFixed: decimal("platform_fee_fixed", { precision: 15, scale: 2 }).notNull().default("0.00"),
  minFee: decimal("min_fee", { precision: 15, scale: 2 }).notNull().default("0.00"),
  maxFee: decimal("max_fee", { precision: 15, scale: 2 }),
  // Trade limits
  minTradeAmount: decimal("min_trade_amount", { precision: 15, scale: 2 }).notNull().default("10.00"),
  maxTradeAmount: decimal("max_trade_amount", { precision: 15, scale: 2 }).notNull().default("100000.00"),
  // Timeouts
  escrowTimeoutHours: integer("escrow_timeout_hours").notNull().default(24),
  paymentTimeoutMinutes: integer("payment_timeout_minutes").notNull().default(15),
  autoExpireEnabled: boolean("auto_expire_enabled").notNull().default(true),
  // Status
  isEnabled: boolean("is_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ==================== P2P TRADER PROFILES ====================

export const p2pVerificationLevelEnum = pgEnum("p2p_verification_level", ["none", "email", "phone", "kyc_basic", "kyc_full"]);
export const p2pBadgeTypeEnum = pgEnum("p2p_badge_type", [
  "verified", "trusted_seller", "trusted_buyer", "fast_responder", "high_volume", 
  "new_star", "dispute_free", "premium_trader", "top_rated"
]);

export const p2pTraderProfiles = pgTable("p2p_trader_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  displayName: text("display_name"),
  bio: text("bio"),
  region: text("region"),
  preferredCurrencies: text("preferred_currencies").array(),
  verificationLevel: p2pVerificationLevelEnum("verification_level").notNull().default("none"),
  isOnline: boolean("is_online").notNull().default(false),
  lastSeenAt: timestamp("last_seen_at"),
  autoReplyEnabled: boolean("auto_reply_enabled").notNull().default(false),
  autoReplyMessage: text("auto_reply_message"),
  notifyOnTrade: boolean("notify_on_trade").notNull().default(true),
  notifyOnDispute: boolean("notify_on_dispute").notNull().default(true),
  notifyOnMessage: boolean("notify_on_message").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_p2p_trader_profiles_user_id").on(table.userId),
  index("idx_p2p_trader_profiles_verification").on(table.verificationLevel),
]);

export const p2pTraderMetrics = pgTable("p2p_trader_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  totalTrades: integer("total_trades").notNull().default(0),
  completedTrades: integer("completed_trades").notNull().default(0),
  cancelledTrades: integer("cancelled_trades").notNull().default(0),
  completionRate: decimal("completion_rate", { precision: 5, scale: 2 }).notNull().default("0.00"),
  totalBuyTrades: integer("total_buy_trades").notNull().default(0),
  totalSellTrades: integer("total_sell_trades").notNull().default(0),
  totalVolumeUsdt: decimal("total_volume_usdt", { precision: 20, scale: 2 }).notNull().default("0.00"),
  totalDisputes: integer("total_disputes").notNull().default(0),
  disputesWon: integer("disputes_won").notNull().default(0),
  disputesLost: integer("disputes_lost").notNull().default(0),
  disputeRate: decimal("dispute_rate", { precision: 5, scale: 2 }).notNull().default("0.00"),
  avgReleaseTimeSeconds: integer("avg_release_time_seconds").notNull().default(0),
  avgPaymentTimeSeconds: integer("avg_payment_time_seconds").notNull().default(0),
  avgResponseTimeSeconds: integer("avg_response_time_seconds").notNull().default(0),
  positiveRatings: integer("positive_ratings").notNull().default(0),
  negativeRatings: integer("negative_ratings").notNull().default(0),
  overallRating: decimal("overall_rating", { precision: 3, scale: 2 }).notNull().default("0.00"),
  trades30d: integer("trades_30d").notNull().default(0),
  completion30d: decimal("completion_30d", { precision: 5, scale: 2 }).notNull().default("0.00"),
  volume30d: decimal("volume_30d", { precision: 20, scale: 2 }).notNull().default("0.00"),
  firstTradeAt: timestamp("first_trade_at"),
  lastTradeAt: timestamp("last_trade_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_p2p_trader_metrics_user_id").on(table.userId),
  index("idx_p2p_trader_metrics_completion_rate").on(table.completionRate),
  index("idx_p2p_trader_metrics_total_trades").on(table.totalTrades),
]);

export const p2pBadgeDefinitions = pgTable("p2p_badge_definitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  description: text("description").notNull(),
  descriptionAr: text("description_ar"),
  icon: text("icon").notNull(),
  color: text("color").notNull().default("#00c853"),
  minTrades: integer("min_trades"),
  minCompletionRate: decimal("min_completion_rate", { precision: 5, scale: 2 }),
  minVolume: decimal("min_volume", { precision: 20, scale: 2 }),
  maxDisputeRate: decimal("max_dispute_rate", { precision: 5, scale: 2 }),
  maxResponseTime: integer("max_response_time"),
  requiresVerification: p2pVerificationLevelEnum("requires_verification"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const p2pTraderBadges = pgTable("p2p_trader_badges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  badgeSlug: text("badge_slug").notNull(),
  earnedAt: timestamp("earned_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
  isDisplayed: boolean("is_displayed").notNull().default(true),
}, (table) => [
  index("idx_p2p_trader_badges_user_id").on(table.userId),
  index("idx_p2p_trader_badges_slug").on(table.badgeSlug),
]);

export const p2pTraderRatings = pgTable("p2p_trader_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tradeId: varchar("trade_id").notNull().references(() => p2pTrades.id),
  raterId: varchar("rater_id").notNull().references(() => users.id),
  ratedUserId: varchar("rated_user_id").notNull().references(() => users.id),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_p2p_trader_ratings_trade_id").on(table.tradeId),
  index("idx_p2p_trader_ratings_rated_user").on(table.ratedUserId),
]);

export const p2pTraderPaymentMethods = pgTable("p2p_trader_payment_methods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: paymentMethodTypeEnum("type").notNull(),
  name: text("name").notNull(),
  accountNumber: text("account_number"),
  bankName: text("bank_name"),
  holderName: text("holder_name"),
  details: text("details"),
  isVerified: boolean("is_verified").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_p2p_trader_payment_methods_user_id").on(table.userId),
]);

// ==================== NOTIFICATIONS ====================

export const notificationTypeEnum = pgEnum("notification_type", ["announcement", "transaction", "security", "promotion", "system", "p2p", "id_verification", "success", "warning"]);
export const notificationPriorityEnum = pgEnum("notification_priority", ["low", "normal", "high", "urgent"]);

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: notificationTypeEnum("type").notNull().default("system"),
  priority: notificationPriorityEnum("priority").notNull().default("normal"),
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  message: text("message").notNull(),
  messageAr: text("message_ar"),
  link: text("link"),
  metadata: text("metadata"),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_notifications_user_id").on(table.userId),
  index("idx_notifications_is_read").on(table.isRead),
  index("idx_notifications_type").on(table.type),
]);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

// ==================== USER SESSIONS ====================

export const userSessions = pgTable("user_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  sessionToken: text("session_token").notNull().unique(),
  deviceInfo: text("device_info"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  location: text("location"),
  isActive: boolean("is_active").notNull().default(true),
  lastActiveAt: timestamp("last_active_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_user_sessions_user_id").on(table.userId),
  index("idx_user_sessions_token").on(table.sessionToken),
  index("idx_user_sessions_is_active").on(table.isActive),
]);

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, { fields: [userSessions.userId], references: [users.id] }),
}));

// ==================== LOGIN HISTORY ====================

export const loginHistory = pgTable("login_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  deviceInfo: text("device_info"),
  location: text("location"),
  isSuccess: boolean("is_success").notNull().default(true),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_login_history_user_id").on(table.userId),
  index("idx_login_history_created_at").on(table.createdAt),
]);

export const loginHistoryRelations = relations(loginHistory, ({ one }) => ({
  user: one(users, { fields: [loginHistory.userId], references: [users.id] }),
}));

// ==================== ANNOUNCEMENTS ====================

export const announcementStatusEnum = pgEnum("announcement_status", ["draft", "scheduled", "published", "archived"]);
export const announcementTargetEnum = pgEnum("announcement_target", ["all", "players", "agents", "affiliates", "vip"]);

export const announcements = pgTable("announcements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  content: text("content").notNull(),
  contentAr: text("content_ar"),
  imageUrl: text("image_url"),
  link: text("link"),
  status: announcementStatusEnum("status").notNull().default("draft"),
  target: announcementTargetEnum("target").notNull().default("all"),
  priority: notificationPriorityEnum("priority").notNull().default("normal"),
  isPinned: boolean("is_pinned").notNull().default(false),
  viewCount: integer("view_count").notNull().default(0),
  publishedAt: timestamp("published_at"),
  expiresAt: timestamp("expires_at"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_announcements_status").on(table.status),
  index("idx_announcements_target").on(table.target),
  index("idx_announcements_published_at").on(table.publishedAt),
]);

export const announcementsRelations = relations(announcements, ({ one }) => ({
  creator: one(users, { fields: [announcements.createdBy], references: [users.id] }),
}));

// ==================== ANNOUNCEMENT VIEWS ====================

export const announcementViews = pgTable("announcement_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  announcementId: varchar("announcement_id").notNull().references(() => announcements.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  viewedAt: timestamp("viewed_at").notNull().defaultNow(),
}, (table) => [
  index("idx_announcement_views_announcement_id").on(table.announcementId),
  index("idx_announcement_views_user_id").on(table.userId),
]);

// ==================== USER PREFERENCES ====================

export const userPreferences = pgTable("user_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  language: text("language").notNull().default("en"),
  currency: text("currency").notNull().default("USD"),
  timezone: text("timezone").default("UTC"),
  notifyAnnouncements: boolean("notify_announcements").notNull().default(true),
  notifyTransactions: boolean("notify_transactions").notNull().default(true),
  notifyPromotions: boolean("notify_promotions").notNull().default(true),
  notifyP2P: boolean("notify_p2p").notNull().default(true),
  notifyChallengerActivity: boolean("notify_challenger_activity").notNull().default(true),
  emailNotifications: boolean("email_notifications").notNull().default(false),
  smsNotifications: boolean("sms_notifications").notNull().default(false),
  hideBalanceInLists: boolean("hide_balance_in_lists").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_user_preferences_user_id").on(table.userId),
]);

// ==================== CHALLENGER FOLLOWS ====================

export const challengerFollows = pgTable("challenger_follows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  followerId: varchar("follower_id").notNull().references(() => users.id),
  followedId: varchar("followed_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_challenger_follows_follower").on(table.followerId),
  index("idx_challenger_follows_followed").on(table.followedId),
]);

export const challengerFollowsRelations = relations(challengerFollows, ({ one }) => ({
  follower: one(users, { fields: [challengerFollows.followerId], references: [users.id] }),
  followed: one(users, { fields: [challengerFollows.followedId], references: [users.id] }),
}));

export const insertChallengerFollowSchema = createInsertSchema(challengerFollows).omit({ id: true, createdAt: true });
export type InsertChallengerFollow = z.infer<typeof insertChallengerFollowSchema>;
export type ChallengerFollow = typeof challengerFollows.$inferSelect;

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, { fields: [userPreferences.userId], references: [users.id] }),
}));

// ==================== CHALLENGE SYSTEM ====================

export const challenges = pgTable("challenges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameType: text("game_type").notNull(),
  betAmount: decimal("bet_amount", { precision: 20, scale: 8 }).notNull().default("0"),
  currencyType: text("currency_type").notNull().default("usd"), // usd, project (VEX Coin)
  visibility: text("visibility").notNull().default("public"), // public, private
  status: text("status").notNull().default("waiting"), // waiting, active, completed, cancelled
  player1Id: varchar("player1_id").notNull().references(() => users.id),
  player2Id: varchar("player2_id").references(() => users.id),
  winnerId: varchar("winner_id").references(() => users.id),
  opponentType: text("opponent_type").default("random"), // random, friend
  friendAccountId: text("friend_account_id"),
  timeLimit: integer("time_limit").notNull().default(300), // seconds
  player1Score: integer("player1_score").default(0),
  player2Score: integer("player2_score").default(0),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_challenges_player1").on(table.player1Id),
  index("idx_challenges_player2").on(table.player2Id),
  index("idx_challenges_status").on(table.status),
  index("idx_challenges_visibility").on(table.visibility),
]);

export const challengeSpectatorBets = pgTable("challenge_spectator_bets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  challengeId: varchar("challenge_id").notNull().references(() => challenges.id),
  spectatorId: varchar("spectator_id").notNull().references(() => users.id),
  backedPlayerId: varchar("backed_player_id").notNull().references(() => users.id),
  betAmount: decimal("bet_amount", { precision: 20, scale: 8 }).notNull(),
  currencyType: text("currency_type").notNull().default("usd"), // usd, project
  potentialWinnings: decimal("potential_winnings", { precision: 20, scale: 8 }).notNull(),
  status: text("status").notNull().default("pending"), // pending, won, lost, refunded
  settledAt: timestamp("settled_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_spectator_bets_challenge").on(table.challengeId),
  index("idx_spectator_bets_spectator").on(table.spectatorId),
]);

export const challengeRatings = pgTable("challenge_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  totalChallenges: integer("total_challenges").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  draws: integer("draws").notNull().default(0),
  winRate: decimal("win_rate", { precision: 5, scale: 2 }).default("0"),
  currentStreak: integer("current_streak").default(0),
  bestStreak: integer("best_streak").default(0),
  totalEarnings: decimal("total_earnings", { precision: 20, scale: 8 }).default("0"),
  rank: text("rank").default("bronze"), // bronze, silver, gold, platinum, diamond
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_challenge_ratings_user").on(table.userId),
  index("idx_challenge_ratings_rank").on(table.rank),
]);

export const giftCatalog = pgTable("gift_catalog", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  description: text("description"),
  descriptionAr: text("description_ar"),
  price: decimal("price", { precision: 20, scale: 8 }).notNull(),
  iconUrl: text("icon_url"),
  category: text("category").default("general"), // general, love, celebration, gaming
  animationType: text("animation_type").default("float"), // float, burst, rain, spin
  coinValue: integer("coin_value").default(1), // value displayed during stream
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_gift_catalog_category").on(table.category),
  index("idx_gift_catalog_active").on(table.isActive),
]);

export const userGiftInventory = pgTable("user_gift_inventory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  giftId: varchar("gift_id").notNull().references(() => giftCatalog.id),
  quantity: integer("quantity").notNull().default(1),
  purchasedAt: timestamp("purchased_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_gift_inventory_user").on(table.userId),
  index("idx_gift_inventory_gift").on(table.giftId),
]);

export const challengeGifts = pgTable("challenge_gifts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  challengeId: varchar("challenge_id").notNull().references(() => challenges.id),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  recipientId: varchar("recipient_id").notNull().references(() => users.id),
  giftId: varchar("gift_id").notNull().references(() => giftCatalog.id),
  quantity: integer("quantity").notNull().default(1),
  message: text("message"),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
}, (table) => [
  index("idx_challenge_gifts_challenge").on(table.challengeId),
  index("idx_challenge_gifts_sender").on(table.senderId),
  index("idx_challenge_gifts_recipient").on(table.recipientId),
]);

export const challengeSpectators = pgTable("challenge_spectators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  challengeId: varchar("challenge_id").notNull().references(() => challenges.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  leftAt: timestamp("left_at"),
}, (table) => [
  index("idx_challenge_spectators_challenge").on(table.challengeId),
  index("idx_challenge_spectators_user").on(table.userId),
]);

// ==================== CHALLENGE GAME SESSIONS ====================

export const challengeGameSessions = pgTable("challenge_game_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  challengeId: varchar("challenge_id").notNull().references(() => challenges.id),
  gameType: text("game_type").notNull(),
  currentTurn: varchar("current_turn").references(() => users.id),
  player1TimeRemaining: integer("player1_time_remaining").notNull().default(300),
  player2TimeRemaining: integer("player2_time_remaining").notNull().default(300),
  gameState: text("game_state"),
  status: text("status").notNull().default("waiting"),
  winnerId: varchar("winner_id").references(() => users.id),
  winReason: text("win_reason"),
  totalMoves: integer("total_moves").notNull().default(0),
  spectatorCount: integer("spectator_count").notNull().default(0),
  lastMoveAt: timestamp("last_move_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_game_sessions_challenge").on(table.challengeId),
  index("idx_game_sessions_status").on(table.status),
]);

export const chessMoves = pgTable("chess_moves", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => challengeGameSessions.id),
  playerId: varchar("player_id").notNull().references(() => users.id),
  moveNumber: integer("move_number").notNull(),
  fromSquare: text("from_square").notNull(),
  toSquare: text("to_square").notNull(),
  piece: text("piece").notNull(),
  capturedPiece: text("captured_piece"),
  isCheck: boolean("is_check").notNull().default(false),
  isCheckmate: boolean("is_checkmate").notNull().default(false),
  isCastling: boolean("is_castling").notNull().default(false),
  isEnPassant: boolean("is_en_passant").notNull().default(false),
  promotionPiece: text("promotion_piece"),
  fen: text("fen").notNull(),
  notation: text("notation").notNull(),
  timeSpent: integer("time_spent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_chess_moves_session").on(table.sessionId),
  index("idx_chess_moves_player").on(table.playerId),
]);

export const dominoMoves = pgTable("domino_moves", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => challengeGameSessions.id),
  playerId: varchar("player_id").notNull().references(() => users.id),
  moveNumber: integer("move_number").notNull(),
  tileLeft: integer("tile_left").notNull(),
  tileRight: integer("tile_right").notNull(),
  placedEnd: text("placed_end"),
  isPassed: boolean("is_passed").notNull().default(false),
  boardState: text("board_state"),
  timeSpent: integer("time_spent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_domino_moves_session").on(table.sessionId),
  index("idx_domino_moves_player").on(table.playerId),
]);

export const challengeChatMessages = pgTable("challenge_chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => challengeGameSessions.id),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  isQuickMessage: boolean("is_quick_message").notNull().default(false),
  quickMessageKey: text("quick_message_key"),
  isSpectator: boolean("is_spectator").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_chat_messages_session").on(table.sessionId),
  index("idx_chat_messages_sender").on(table.senderId),
]);

export const challengePointsLedger = pgTable("challenge_points_ledger", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  challengeId: varchar("challenge_id").notNull().references(() => challenges.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  targetPlayerId: varchar("target_player_id").notNull().references(() => users.id),
  pointsAmount: integer("points_amount").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_points_ledger_challenge").on(table.challengeId),
  index("idx_points_ledger_user").on(table.userId),
  index("idx_points_ledger_target").on(table.targetPlayerId),
]);

export const challengeFollows = pgTable("challenge_follows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  followerId: varchar("follower_id").notNull().references(() => users.id),
  followedId: varchar("followed_id").notNull().references(() => users.id),
  notifyOnMatch: boolean("notify_on_match").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_follows_follower").on(table.followerId),
  index("idx_follows_followed").on(table.followedId),
]);

export const challengeFollowNotifications = pgTable("challenge_follow_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  followerId: varchar("follower_id").notNull().references(() => users.id),
  challengerId: varchar("challenger_id").notNull().references(() => users.id),
  challengeId: varchar("challenge_id").notNull().references(() => challenges.id),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_follow_notif_follower").on(table.followerId),
  index("idx_follow_notif_challenge").on(table.challengeId),
]);

// Backgammon moves table
export const backgammonMoves = pgTable("backgammon_moves", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => challengeGameSessions.id),
  playerId: varchar("player_id").notNull().references(() => users.id),
  moveNumber: integer("move_number").notNull(),
  fromPoint: integer("from_point").notNull(), // -1 = bar, 24 = bearing off
  toPoint: integer("to_point").notNull(),
  dieUsed: integer("die_used").notNull(),
  isHit: boolean("is_hit").notNull().default(false),
  isBearOff: boolean("is_bear_off").notNull().default(false),
  boardState: text("board_state"),
  timeSpent: integer("time_spent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_backgammon_moves_session").on(table.sessionId),
  index("idx_backgammon_moves_player").on(table.playerId),
]);

// Tarneeb/Baloot card plays table
export const cardGamePlays = pgTable("card_game_plays", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => challengeGameSessions.id),
  playerId: varchar("player_id").notNull().references(() => users.id),
  roundNumber: integer("round_number").notNull(),
  trickNumber: integer("trick_number").notNull(),
  cardSuit: text("card_suit").notNull(),
  cardRank: text("card_rank").notNull(),
  playOrder: integer("play_order").notNull(),
  wonTrick: boolean("won_trick").notNull().default(false),
  timeSpent: integer("time_spent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_card_plays_session").on(table.sessionId),
  index("idx_card_plays_player").on(table.playerId),
]);

// Card game bids table
export const cardGameBids = pgTable("card_game_bids", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => challengeGameSessions.id),
  playerId: varchar("player_id").notNull().references(() => users.id),
  roundNumber: integer("round_number").notNull(),
  bidValue: integer("bid_value"), // null = pass
  bidSuit: text("bid_suit"), // for Baloot hokm
  isPass: boolean("is_pass").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_card_bids_session").on(table.sessionId),
]);

export const insertChallengeGameSessionSchema = createInsertSchema(challengeGameSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertChallengeGameSession = z.infer<typeof insertChallengeGameSessionSchema>;
export type ChallengeGameSession = typeof challengeGameSessions.$inferSelect;

export const insertChessMoveSchema = createInsertSchema(chessMoves).omit({
  id: true,
  createdAt: true,
});
export type InsertChessMove = z.infer<typeof insertChessMoveSchema>;
export type ChessMove = typeof chessMoves.$inferSelect;

export const insertDominoMoveSchema = createInsertSchema(dominoMoves).omit({
  id: true,
  createdAt: true,
});
export type InsertDominoMove = z.infer<typeof insertDominoMoveSchema>;
export type DominoMove = typeof dominoMoves.$inferSelect;

export const insertChallengeChatMessageSchema = createInsertSchema(challengeChatMessages).omit({
  id: true,
  createdAt: true,
});
export type InsertChallengeChatMessage = z.infer<typeof insertChallengeChatMessageSchema>;
export type ChallengeChatMessage = typeof challengeChatMessages.$inferSelect;

export const insertChallengePointsLedgerSchema = createInsertSchema(challengePointsLedger).omit({
  id: true,
  createdAt: true,
});
export type InsertChallengePointsLedger = z.infer<typeof insertChallengePointsLedgerSchema>;
export type ChallengePointsLedgerEntry = typeof challengePointsLedger.$inferSelect;

export const insertChallengeFollowSchema = createInsertSchema(challengeFollows).omit({
  id: true,
  createdAt: true,
});
export type InsertChallengeFollow = z.infer<typeof insertChallengeFollowSchema>;
export type ChallengeFollow = typeof challengeFollows.$inferSelect;

// ==================== APP SETTINGS ====================

export const appSettings = pgTable("app_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value"),
  valueAr: text("value_ar"),
  category: text("category"),
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_app_settings_key").on(table.key),
  index("idx_app_settings_category").on(table.category),
]);

// ==================== LOGIN METHOD CONFIGS ====================

export const loginMethodConfigs = pgTable("login_method_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  method: text("method").notNull().unique(),
  isEnabled: boolean("is_enabled").notNull().default(false),
  otpEnabled: boolean("otp_enabled").notNull().default(false),
  otpLength: integer("otp_length").notNull().default(6),
  otpExpiryMinutes: integer("otp_expiry_minutes").notNull().default(5),
  settings: text("settings"),
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_login_method_configs_method").on(table.method),
]);

// ==================== MANAGED LANGUAGES ====================

export const managedLanguages = pgTable("managed_languages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  nativeName: text("native_name"),
  direction: text("direction").notNull().default("ltr"),
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  translations: text("translations"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_managed_languages_code").on(table.code),
  index("idx_managed_languages_is_active").on(table.isActive),
]);

// ==================== BADGE CATALOG ====================

export const badgeCatalog = pgTable("badge_catalog", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  description: text("description"),
  descriptionAr: text("description_ar"),
  iconUrl: text("icon_url"),
  iconName: text("icon_name"),
  color: text("color"),
  category: text("category"),
  requirement: text("requirement"),
  points: integer("points").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_badge_catalog_category").on(table.category),
  index("idx_badge_catalog_is_active").on(table.isActive),
]);

// ==================== USER BADGES ====================

export const userBadges = pgTable("user_badges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  badgeId: varchar("badge_id").notNull().references(() => badgeCatalog.id),
  earnedAt: timestamp("earned_at").notNull().defaultNow(),
}, (table) => [
  index("idx_user_badges_user_id").on(table.userId),
  index("idx_user_badges_badge_id").on(table.badgeId),
  uniqueIndex("idx_user_badges_user_badge_unique").on(table.userId, table.badgeId),
]);

export const userBadgesRelations = relations(userBadges, ({ one }) => ({
  user: one(users, { fields: [userBadges.userId], references: [users.id] }),
  badge: one(badgeCatalog, { fields: [userBadges.badgeId], references: [badgeCatalog.id] }),
}));

// ==================== USER RELATIONSHIPS ====================

export const userRelationships = pgTable("user_relationships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  targetUserId: varchar("target_user_id").notNull().references(() => users.id),
  type: text("type").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_user_relationships_user_id").on(table.userId),
  index("idx_user_relationships_target_user_id").on(table.targetUserId),
  index("idx_user_relationships_type").on(table.type),
  index("idx_user_relationships_status").on(table.status),
]);

export const userRelationshipsRelations = relations(userRelationships, ({ one }) => ({
  user: one(users, { fields: [userRelationships.userId], references: [users.id] }),
  targetUser: one(users, { fields: [userRelationships.targetUserId], references: [users.id] }),
}));

// ==================== CHAT MESSAGES ====================

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  receiverId: varchar("receiver_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  messageType: text("message_type").notNull().default("text"),
  attachmentUrl: text("attachment_url"),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at"),
  isDisappearing: boolean("is_disappearing").notNull().default(false),
  disappearAfterRead: boolean("disappear_after_read").notNull().default(false),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_chat_messages_sender_id").on(table.senderId),
  index("idx_chat_messages_receiver_id").on(table.receiverId),
  index("idx_chat_messages_created_at").on(table.createdAt),
]);

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  sender: one(users, { fields: [chatMessages.senderId], references: [users.id] }),
  receiver: one(users, { fields: [chatMessages.receiverId], references: [users.id] }),
}));

// ==================== BROADCAST NOTIFICATIONS ====================

export const broadcastNotifications = pgTable("broadcast_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  content: text("content").notNull(),
  contentAr: text("content_ar"),
  targetType: text("target_type").notNull(),
  targetValue: text("target_value"),
  sentBy: varchar("sent_by").references(() => users.id),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
}, (table) => [
  index("idx_broadcast_notifications_target_type").on(table.targetType),
  index("idx_broadcast_notifications_sent_at").on(table.sentAt),
]);

export const broadcastNotificationsRelations = relations(broadcastNotifications, ({ one }) => ({
  sender: one(users, { fields: [broadcastNotifications.sentBy], references: [users.id] }),
}));

// ==================== CHAT SETTINGS ====================

export const chatSettings = pgTable("chat_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value"),
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_chat_settings_key").on(table.key),
]);

// ==================== GAMEPLAY SETTINGS ====================

export const gameplaySettings = pgTable("gameplay_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  descriptionAr: text("description_ar"),
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_gameplay_settings_key").on(table.key),
]);

// ==================== MATCHMAKING QUEUE ====================

export const matchTypeEnum = pgEnum("match_type", ["random", "friend"]);
export const matchmakingStatusEnum = pgEnum("matchmaking_status", ["waiting", "matched", "expired", "cancelled"]);
export const gameMatchStatusEnum = pgEnum("game_match_status", ["pending", "in_progress", "completed", "cancelled"]);

export const matchmakingQueue = pgTable("matchmaking_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameId: varchar("game_id").notNull().references(() => games.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  matchType: matchTypeEnum("match_type").notNull().default("random"),
  friendAccountId: varchar("friend_account_id"),
  status: matchmakingStatusEnum("status").notNull().default("waiting"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_matchmaking_queue_game_id").on(table.gameId),
  index("idx_matchmaking_queue_user_id").on(table.userId),
  index("idx_matchmaking_queue_status").on(table.status),
]);

export const matchmakingQueueRelations = relations(matchmakingQueue, ({ one }) => ({
  game: one(games, { fields: [matchmakingQueue.gameId], references: [games.id] }),
  user: one(users, { fields: [matchmakingQueue.userId], references: [users.id] }),
}));

// ==================== GAME MATCHES ====================

export const gameMatches = pgTable("game_matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameId: varchar("game_id").notNull().references(() => games.id),
  player1Id: varchar("player1_id").notNull().references(() => users.id),
  player2Id: varchar("player2_id").notNull().references(() => users.id),
  status: gameMatchStatusEnum("status").notNull().default("pending"),
  winnerId: varchar("winner_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_game_matches_game_id").on(table.gameId),
  index("idx_game_matches_player1_id").on(table.player1Id),
  index("idx_game_matches_player2_id").on(table.player2Id),
  index("idx_game_matches_status").on(table.status),
]);

export const gameMatchesRelations = relations(gameMatches, ({ one }) => ({
  game: one(games, { fields: [gameMatches.gameId], references: [games.id] }),
  player1: one(users, { fields: [gameMatches.player1Id], references: [users.id] }),
  player2: one(users, { fields: [gameMatches.player2Id], references: [users.id] }),
  winner: one(users, { fields: [gameMatches.winnerId], references: [users.id] }),
}));

// ==================== INSERT SCHEMAS ====================

export const insertMatchmakingQueueSchema = createInsertSchema(matchmakingQueue).omit({ id: true, createdAt: true });
export const insertGameMatchSchema = createInsertSchema(gameMatches).omit({ id: true, createdAt: true });

export const insertChallengeSchema = createInsertSchema(challenges).omit({ id: true, createdAt: true, updatedAt: true });
export const insertChallengeSpectatorBetSchema = createInsertSchema(challengeSpectatorBets).omit({ id: true, createdAt: true });
export const insertChallengeRatingSchema = createInsertSchema(challengeRatings).omit({ id: true, updatedAt: true });
export const insertGiftCatalogSchema = createInsertSchema(giftCatalog).omit({ id: true, createdAt: true });
export const insertUserGiftInventorySchema = createInsertSchema(userGiftInventory).omit({ id: true, purchasedAt: true, updatedAt: true });
export const insertChallengeGiftSchema = createInsertSchema(challengeGifts).omit({ id: true, sentAt: true });
export const insertChallengeSpectatorSchema = createInsertSchema(challengeSpectators).omit({ id: true, joinedAt: true });

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export const insertUserSessionSchema = createInsertSchema(userSessions).omit({ id: true, createdAt: true });
export const insertLoginHistorySchema = createInsertSchema(loginHistory).omit({ id: true, createdAt: true });
export const insertAnnouncementSchema = createInsertSchema(announcements).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAnnouncementViewSchema = createInsertSchema(announcementViews).omit({ id: true });
export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({ id: true, updatedAt: true });

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAgentSchema = createInsertSchema(agents).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAffiliateSchema = createInsertSchema(affiliates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertGameSchema = createInsertSchema(games).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertComplaintSchema = createInsertSchema(complaints).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPromoCodeSchema = createInsertSchema(promoCodes).omit({ id: true, createdAt: true });
export const insertGameSessionSchema = createInsertSchema(gameSessions).omit({ id: true, createdAt: true });
export const insertAgentPaymentMethodSchema = createInsertSchema(agentPaymentMethods).omit({ id: true, createdAt: true });
export const insertComplaintMessageSchema = createInsertSchema(complaintMessages).omit({ id: true, createdAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export const insertFinancialLimitSchema = createInsertSchema(financialLimits).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({ id: true, createdAt: true });
export const insertDepositRequestSchema = createInsertSchema(depositRequests).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLanguageSchema = createInsertSchema(languages).omit({ id: true });
export const insertCurrencySchema = createInsertSchema(currencies).omit({ id: true });
export const insertCountryPaymentMethodSchema = createInsertSchema(countryPaymentMethods).omit({ id: true });
export const insertThemeSchema = createInsertSchema(themes).omit({ id: true, createdAt: true });
export const insertFeatureFlagSchema = createInsertSchema(featureFlags).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAdminAuditLogSchema = createInsertSchema(adminAuditLogs).omit({ id: true, createdAt: true });
export const insertP2POfferSchema = createInsertSchema(p2pOffers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertP2PTradeSchema = createInsertSchema(p2pTrades).omit({ id: true, createdAt: true, updatedAt: true });
export const insertP2PEscrowSchema = createInsertSchema(p2pEscrow).omit({ id: true });
export const insertP2PDisputeSchema = createInsertSchema(p2pDisputes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertP2PSettingsSchema = createInsertSchema(p2pSettings).omit({ id: true, updatedAt: true });
export const insertP2PTransactionLogSchema = createInsertSchema(p2pTransactionLogs).omit({ id: true, createdAt: true });
export const insertP2PDisputeMessageSchema = createInsertSchema(p2pDisputeMessages).omit({ id: true, createdAt: true });
export const insertP2PTradeMessageSchema = createInsertSchema(p2pTradeMessages).omit({ id: true, createdAt: true });
export const insertP2PDisputeEvidenceSchema = createInsertSchema(p2pDisputeEvidence).omit({ id: true, createdAt: true });
export const insertP2PPrewrittenResponseSchema = createInsertSchema(p2pPrewrittenResponses).omit({ id: true, createdAt: true });
export const insertP2PDisputeRuleSchema = createInsertSchema(p2pDisputeRules).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSupportContactSchema = createInsertSchema(supportContacts).omit({ id: true, createdAt: true, updatedAt: true });

export const insertAppSettingSchema = createInsertSchema(appSettings).omit({ id: true, updatedAt: true });
export const insertLoginMethodConfigSchema = createInsertSchema(loginMethodConfigs).omit({ id: true, updatedAt: true });
export const insertManagedLanguageSchema = createInsertSchema(managedLanguages).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBadgeCatalogSchema = createInsertSchema(badgeCatalog).omit({ id: true, createdAt: true });
export const insertUserBadgeSchema = createInsertSchema(userBadges).omit({ id: true, earnedAt: true });
export const insertUserRelationshipSchema = createInsertSchema(userRelationships).omit({ id: true, createdAt: true, updatedAt: true });
export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });
export const insertBroadcastNotificationSchema = createInsertSchema(broadcastNotifications).omit({ id: true, sentAt: true });
export const insertChatSettingSchema = createInsertSchema(chatSettings).omit({ id: true, updatedAt: true });
export const insertGameplaySettingSchema = createInsertSchema(gameplaySettings).omit({ id: true, updatedAt: true });

// ==================== TYPES ====================

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agents.$inferSelect;

export type InsertAffiliate = z.infer<typeof insertAffiliateSchema>;
export type Affiliate = typeof affiliates.$inferSelect;

export type InsertGame = z.infer<typeof insertGameSchema>;
export type Game = typeof games.$inferSelect;

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

export type InsertComplaint = z.infer<typeof insertComplaintSchema>;
export type Complaint = typeof complaints.$inferSelect;

export type InsertPromoCode = z.infer<typeof insertPromoCodeSchema>;
export type PromoCode = typeof promoCodes.$inferSelect;

export type InsertGameSession = z.infer<typeof insertGameSessionSchema>;
export type GameSession = typeof gameSessions.$inferSelect;

export type InsertAgentPaymentMethod = z.infer<typeof insertAgentPaymentMethodSchema>;
export type AgentPaymentMethod = typeof agentPaymentMethods.$inferSelect;

export type InsertComplaintMessage = z.infer<typeof insertComplaintMessageSchema>;
export type ComplaintMessage = typeof complaintMessages.$inferSelect;

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

export type InsertFinancialLimit = z.infer<typeof insertFinancialLimitSchema>;
export type FinancialLimit = typeof financialLimits.$inferSelect;

export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;
export type SystemSetting = typeof systemSettings.$inferSelect;

export type ComplaintAttachment = typeof complaintAttachments.$inferSelect;
export type LinkAnalytic = typeof linkAnalytics.$inferSelect;
export type PromoCodeUsage = typeof promoCodeUsages.$inferSelect;

export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

export type InsertDepositRequest = z.infer<typeof insertDepositRequestSchema>;
export type DepositRequest = typeof depositRequests.$inferSelect;

export type InsertLanguage = z.infer<typeof insertLanguageSchema>;
export type Language = typeof languages.$inferSelect;

export type InsertCurrency = z.infer<typeof insertCurrencySchema>;
export type Currency = typeof currencies.$inferSelect;

export type InsertCountryPaymentMethod = z.infer<typeof insertCountryPaymentMethodSchema>;
export type CountryPaymentMethod = typeof countryPaymentMethods.$inferSelect;

export type InsertTheme = z.infer<typeof insertThemeSchema>;
export type Theme = typeof themes.$inferSelect;

export type InsertFeatureFlag = z.infer<typeof insertFeatureFlagSchema>;
export type FeatureFlag = typeof featureFlags.$inferSelect;

export type InsertAdminAuditLog = z.infer<typeof insertAdminAuditLogSchema>;
export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;

export type InsertP2POffer = z.infer<typeof insertP2POfferSchema>;
export type P2POffer = typeof p2pOffers.$inferSelect;

export type InsertP2PTrade = z.infer<typeof insertP2PTradeSchema>;
export type P2PTrade = typeof p2pTrades.$inferSelect;

export type InsertP2PEscrow = z.infer<typeof insertP2PEscrowSchema>;
export type P2PEscrow = typeof p2pEscrow.$inferSelect;

export type InsertP2PDispute = z.infer<typeof insertP2PDisputeSchema>;
export type P2PDispute = typeof p2pDisputes.$inferSelect;

export type InsertP2PSettings = z.infer<typeof insertP2PSettingsSchema>;
export type P2PSettings = typeof p2pSettings.$inferSelect;

export type InsertP2PTransactionLog = z.infer<typeof insertP2PTransactionLogSchema>;
export type P2PTransactionLog = typeof p2pTransactionLogs.$inferSelect;

export type InsertP2PDisputeMessage = z.infer<typeof insertP2PDisputeMessageSchema>;
export type P2PDisputeMessage = typeof p2pDisputeMessages.$inferSelect;

export type InsertP2PTradeMessage = z.infer<typeof insertP2PTradeMessageSchema>;
export type P2PTradeMessage = typeof p2pTradeMessages.$inferSelect;

export type InsertP2PDisputeEvidence = z.infer<typeof insertP2PDisputeEvidenceSchema>;
export type P2PDisputeEvidence = typeof p2pDisputeEvidence.$inferSelect;

export type InsertP2PPrewrittenResponse = z.infer<typeof insertP2PPrewrittenResponseSchema>;
export type P2PPrewrittenResponse = typeof p2pPrewrittenResponses.$inferSelect;

export type InsertP2PDisputeRule = z.infer<typeof insertP2PDisputeRuleSchema>;
export type P2PDisputeRule = typeof p2pDisputeRules.$inferSelect;

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;
export type UserSession = typeof userSessions.$inferSelect;

export type InsertLoginHistory = z.infer<typeof insertLoginHistorySchema>;
export type LoginHistory = typeof loginHistory.$inferSelect;

export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type Announcement = typeof announcements.$inferSelect;

export type AnnouncementView = typeof announcementViews.$inferSelect;

export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type UserPreferences = typeof userPreferences.$inferSelect;

// Challenge system types
export type InsertChallenge = z.infer<typeof insertChallengeSchema>;
export type Challenge = typeof challenges.$inferSelect;

export type InsertChallengeSpectatorBet = z.infer<typeof insertChallengeSpectatorBetSchema>;
export type ChallengeSpectatorBet = typeof challengeSpectatorBets.$inferSelect;

export type InsertChallengeRating = z.infer<typeof insertChallengeRatingSchema>;
export type ChallengeRating = typeof challengeRatings.$inferSelect;

export type InsertGiftCatalog = z.infer<typeof insertGiftCatalogSchema>;
export type GiftCatalog = typeof giftCatalog.$inferSelect;

export type InsertUserGiftInventory = z.infer<typeof insertUserGiftInventorySchema>;
export type UserGiftInventory = typeof userGiftInventory.$inferSelect;

export type InsertChallengeGift = z.infer<typeof insertChallengeGiftSchema>;
export type ChallengeGift = typeof challengeGifts.$inferSelect;

export type InsertChallengeSpectator = z.infer<typeof insertChallengeSpectatorSchema>;
export type ChallengeSpectator = typeof challengeSpectators.$inferSelect;

export type InsertSupportContact = z.infer<typeof insertSupportContactSchema>;
export type SupportContact = typeof supportContacts.$inferSelect;

export type InsertAppSetting = z.infer<typeof insertAppSettingSchema>;
export type AppSetting = typeof appSettings.$inferSelect;

export type InsertLoginMethodConfig = z.infer<typeof insertLoginMethodConfigSchema>;
export type LoginMethodConfig = typeof loginMethodConfigs.$inferSelect;

export type InsertManagedLanguage = z.infer<typeof insertManagedLanguageSchema>;
export type ManagedLanguage = typeof managedLanguages.$inferSelect;

export type InsertBadgeCatalog = z.infer<typeof insertBadgeCatalogSchema>;
export type BadgeCatalog = typeof badgeCatalog.$inferSelect;

export type InsertUserBadge = z.infer<typeof insertUserBadgeSchema>;
export type UserBadge = typeof userBadges.$inferSelect;

export type InsertUserRelationship = z.infer<typeof insertUserRelationshipSchema>;
export type UserRelationship = typeof userRelationships.$inferSelect;

export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

export type InsertBroadcastNotification = z.infer<typeof insertBroadcastNotificationSchema>;
export type BroadcastNotification = typeof broadcastNotifications.$inferSelect;

export type InsertChatSetting = z.infer<typeof insertChatSettingSchema>;
export type ChatSetting = typeof chatSettings.$inferSelect;

export type InsertGameplaySetting = z.infer<typeof insertGameplaySettingSchema>;
export type GameplaySetting = typeof gameplaySettings.$inferSelect;

export type InsertMatchmakingQueue = z.infer<typeof insertMatchmakingQueueSchema>;
export type MatchmakingQueue = typeof matchmakingQueue.$inferSelect;

export type InsertGameMatch = z.infer<typeof insertGameMatchSchema>;
export type GameMatch = typeof gameMatches.$inferSelect;

// ==================== GAMEPLAY EMOJIS (Paid Emojis) ====================

export const gameplayEmojis = pgTable("gameplay_emojis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  emoji: text("emoji").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull().default("0.50"),
  category: text("category").notNull().default("general"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertGameplayEmojiSchema = createInsertSchema(gameplayEmojis).omit({ id: true, createdAt: true });
export type InsertGameplayEmoji = z.infer<typeof insertGameplayEmojiSchema>;
export type GameplayEmoji = typeof gameplayEmojis.$inferSelect;

// ==================== GAMEPLAY MESSAGES (In-game Chat) ====================

export const gameplayMessages = pgTable("gameplay_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id").notNull().references(() => gameMatches.id),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  message: text("message"),
  emojiId: varchar("emoji_id").references(() => gameplayEmojis.id),
  isEmoji: boolean("is_emoji").notNull().default(false),
  emojiCost: decimal("emoji_cost", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_gameplay_messages_match").on(table.matchId),
  index("idx_gameplay_messages_sender").on(table.senderId),
]);

export const gameplayMessagesRelations = relations(gameplayMessages, ({ one }) => ({
  match: one(gameMatches, { fields: [gameplayMessages.matchId], references: [gameMatches.id] }),
  sender: one(users, { fields: [gameplayMessages.senderId], references: [users.id] }),
  emoji: one(gameplayEmojis, { fields: [gameplayMessages.emojiId], references: [gameplayEmojis.id] }),
}));

export const insertGameplayMessageSchema = createInsertSchema(gameplayMessages).omit({ id: true, createdAt: true });
export type InsertGameplayMessage = z.infer<typeof insertGameplayMessageSchema>;
export type GameplayMessage = typeof gameplayMessages.$inferSelect;

// ==================== GAME SECTIONS (Customizable Section Names) ====================

export const gameSections = pgTable("game_sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  icon: text("icon").notNull().default("Gamepad2"),
  iconColor: text("icon_color").notNull().default("text-primary"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertGameSectionSchema = createInsertSchema(gameSections).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGameSection = z.infer<typeof insertGameSectionSchema>;
export type GameSection = typeof gameSections.$inferSelect;

// ==================== ADMIN ALERTS (Real-time Admin Notifications) ====================

export const adminAlertTypeEnum = pgEnum("admin_alert_type", [
  "new_dispute", "dispute_update", "new_trade", "trade_issue",
  "new_complaint", "complaint_escalated", "game_change", "user_issue",
  "payment_issue", "system_alert", "security_alert"
]);

export const adminAlertSeverityEnum = pgEnum("admin_alert_severity", ["info", "warning", "critical", "urgent"]);

export const adminAlerts = pgTable("admin_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: adminAlertTypeEnum("type").notNull(),
  severity: adminAlertSeverityEnum("severity").notNull().default("info"),
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  message: text("message").notNull(),
  messageAr: text("message_ar"),
  entityType: text("entity_type"),
  entityId: varchar("entity_id"),
  deepLink: text("deep_link"),
  metadata: text("metadata"),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at"),
  readBy: varchar("read_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_admin_alerts_type").on(table.type),
  index("idx_admin_alerts_severity").on(table.severity),
  index("idx_admin_alerts_is_read").on(table.isRead),
  index("idx_admin_alerts_created_at").on(table.createdAt),
]);

export const adminAlertsRelations = relations(adminAlerts, ({ one }) => ({
  reader: one(users, { fields: [adminAlerts.readBy], references: [users.id] }),
}));

export const insertAdminAlertSchema = createInsertSchema(adminAlerts).omit({ id: true, createdAt: true });
export type InsertAdminAlert = z.infer<typeof insertAdminAlertSchema>;
export type AdminAlert = typeof adminAlerts.$inferSelect;

// ==================== ADVERTISEMENTS (Carousel Ads) ====================

export const advertisementTypeEnum = pgEnum("advertisement_type", ["image", "video", "link", "embed"]);

export const advertisements = pgTable("advertisements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  type: advertisementTypeEnum("type").notNull().default("image"),
  assetUrl: text("asset_url"),
  targetUrl: text("target_url"),
  embedCode: text("embed_code"),
  displayDuration: integer("display_duration").notNull().default(5000),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_advertisements_active").on(table.isActive),
  index("idx_advertisements_sort").on(table.sortOrder),
]);

export const advertisementsRelations = relations(advertisements, ({ one }) => ({
  creator: one(users, { fields: [advertisements.createdBy], references: [users.id] }),
}));

export const insertAdvertisementSchema = createInsertSchema(advertisements).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAdvertisement = z.infer<typeof insertAdvertisementSchema>;
export type Advertisement = typeof advertisements.$inferSelect;

// ==================== SOCIAL PLATFORMS (OAuth & OTP Settings) ====================

export const socialPlatformTypeEnum = pgEnum("social_platform_type", ["oauth", "otp", "both"]);

export const socialPlatforms = pgTable("social_platforms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  displayName: text("display_name").notNull(),
  displayNameAr: text("display_name_ar"),
  icon: text("icon").notNull(),
  type: socialPlatformTypeEnum("type").notNull().default("oauth"),
  isEnabled: boolean("is_enabled").notNull().default(false),
  clientId: text("client_id"),
  clientSecret: text("client_secret"),
  apiKey: text("api_key"),
  apiSecret: text("api_secret"),
  webhookUrl: text("webhook_url"),
  callbackUrl: text("callback_url"),
  botToken: text("bot_token"),
  phoneNumberId: text("phone_number_id"),
  businessAccountId: text("business_account_id"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  otpEnabled: boolean("otp_enabled").notNull().default(false),
  otpTemplate: text("otp_template"),
  otpExpiry: integer("otp_expiry").notNull().default(300),
  sortOrder: integer("sort_order").notNull().default(0),
  settings: text("settings"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_social_platforms_enabled").on(table.isEnabled),
  index("idx_social_platforms_sort").on(table.sortOrder),
]);

export const insertSocialPlatformSchema = createInsertSchema(socialPlatforms).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSocialPlatform = z.infer<typeof insertSocialPlatformSchema>;
export type SocialPlatform = typeof socialPlatforms.$inferSelect;

// ==================== LIVE GAME SESSIONS (Multiplayer) ====================

export const liveGameStatusEnum = pgEnum("live_game_status", ["waiting", "starting", "in_progress", "paused", "completed", "cancelled"]);

export const liveGameSessions = pgTable("live_game_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  challengeId: varchar("challenge_id").references(() => challenges.id),
  gameId: varchar("game_id").notNull().references(() => games.id),
  gameType: text("game_type").notNull(),
  status: liveGameStatusEnum("status").notNull().default("waiting"),
  gameState: text("game_state"),
  currentTurn: varchar("current_turn").references(() => users.id),
  turnNumber: integer("turn_number").notNull().default(0),
  turnStartedAt: timestamp("turn_started_at"),
  turnTimeLimit: integer("turn_time_limit").notNull().default(60),
  player1Id: varchar("player1_id").notNull().references(() => users.id),
  player2Id: varchar("player2_id").references(() => users.id),
  player3Id: varchar("player3_id").references(() => users.id),
  player4Id: varchar("player4_id").references(() => users.id),
  player1Score: integer("player1_score").notNull().default(0),
  player2Score: integer("player2_score").notNull().default(0),
  player3Score: integer("player3_score").notNull().default(0),
  player4Score: integer("player4_score").notNull().default(0),
  team1Score: integer("team1_score").notNull().default(0),
  team2Score: integer("team2_score").notNull().default(0),
  winnerId: varchar("winner_id").references(() => users.id),
  winningTeam: integer("winning_team"),
  spectatorCount: integer("spectator_count").notNull().default(0),
  totalGiftsValue: decimal("total_gifts_value", { precision: 15, scale: 2 }).notNull().default("0.00"),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_live_sessions_challenge").on(table.challengeId),
  index("idx_live_sessions_game").on(table.gameId),
  index("idx_live_sessions_status").on(table.status),
  index("idx_live_sessions_player1").on(table.player1Id),
]);

export const liveGameSessionsRelations = relations(liveGameSessions, ({ one, many }) => ({
  challenge: one(challenges, { fields: [liveGameSessions.challengeId], references: [challenges.id] }),
  game: one(games, { fields: [liveGameSessions.gameId], references: [games.id] }),
  player1: one(users, { fields: [liveGameSessions.player1Id], references: [users.id] }),
  player2: one(users, { fields: [liveGameSessions.player2Id], references: [users.id] }),
  player3: one(users, { fields: [liveGameSessions.player3Id], references: [users.id] }),
  player4: one(users, { fields: [liveGameSessions.player4Id], references: [users.id] }),
  winner: one(users, { fields: [liveGameSessions.winnerId], references: [users.id] }),
  currentTurnPlayer: one(users, { fields: [liveGameSessions.currentTurn], references: [users.id] }),
  moves: many(gameMoves),
  spectators: many(gameSpectators),
  gifts: many(spectatorGifts),
}));

export const insertLiveGameSessionSchema = createInsertSchema(liveGameSessions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLiveGameSession = z.infer<typeof insertLiveGameSessionSchema>;
export type LiveGameSession = typeof liveGameSessions.$inferSelect;

// ==================== GAME MOVES (Move History) ====================

export const gameMoves = pgTable("game_moves", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => liveGameSessions.id),
  playerId: varchar("player_id").notNull().references(() => users.id),
  moveNumber: integer("move_number").notNull(),
  moveType: text("move_type").notNull(),
  moveData: text("move_data").notNull(),
  previousState: text("previous_state"),
  newState: text("new_state"),
  isValid: boolean("is_valid").notNull().default(true),
  timeTaken: integer("time_taken"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_moves_session").on(table.sessionId),
  index("idx_moves_player").on(table.playerId),
  index("idx_moves_number").on(table.sessionId, table.moveNumber),
]);

export const gameMovesRelations = relations(gameMoves, ({ one }) => ({
  session: one(liveGameSessions, { fields: [gameMoves.sessionId], references: [liveGameSessions.id] }),
  player: one(users, { fields: [gameMoves.playerId], references: [users.id] }),
}));

export const insertGameMoveSchema = createInsertSchema(gameMoves).omit({ id: true, createdAt: true });
export type InsertGameMove = z.infer<typeof insertGameMoveSchema>;
export type GameMove = typeof gameMoves.$inferSelect;

// ==================== GAME SPECTATORS ====================

export const gameSpectators = pgTable("game_spectators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => liveGameSessions.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  leftAt: timestamp("left_at"),
  totalGiftsSent: decimal("total_gifts_sent", { precision: 15, scale: 2 }).notNull().default("0.00"),
}, (table) => [
  index("idx_spectators_session").on(table.sessionId),
  index("idx_spectators_user").on(table.userId),
]);

export const gameSpectatorsRelations = relations(gameSpectators, ({ one }) => ({
  session: one(liveGameSessions, { fields: [gameSpectators.sessionId], references: [liveGameSessions.id] }),
  user: one(users, { fields: [gameSpectators.userId], references: [users.id] }),
}));

export const insertGameSpectatorSchema = createInsertSchema(gameSpectators).omit({ id: true, joinedAt: true });
export type InsertGameSpectator = z.infer<typeof insertGameSpectatorSchema>;
export type GameSpectator = typeof gameSpectators.$inferSelect;

// ==================== GIFT ITEMS ====================

export const giftItems = pgTable("gift_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  nameAr: text("name_ar"),
  description: text("description"),
  descriptionAr: text("description_ar"),
  icon: text("icon").notNull(),
  animationUrl: text("animation_url"),
  price: decimal("price", { precision: 15, scale: 2 }).notNull(),
  creatorShare: decimal("creator_share", { precision: 5, scale: 2 }).notNull().default("70.00"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_gift_items_active").on(table.isActive),
]);

export const insertGiftItemSchema = createInsertSchema(giftItems).omit({ id: true, createdAt: true });
export type InsertGiftItem = z.infer<typeof insertGiftItemSchema>;
export type GiftItem = typeof giftItems.$inferSelect;

// ==================== SPECTATOR GIFTS ====================

export const spectatorGifts = pgTable("spectator_gifts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => liveGameSessions.id),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  recipientId: varchar("recipient_id").notNull().references(() => users.id),
  giftItemId: varchar("gift_item_id").notNull().references(() => giftItems.id),
  quantity: integer("quantity").notNull().default(1),
  totalPrice: decimal("total_price", { precision: 15, scale: 2 }).notNull(),
  recipientEarnings: decimal("recipient_earnings", { precision: 15, scale: 2 }).notNull(),
  message: text("message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_gifts_session").on(table.sessionId),
  index("idx_gifts_sender").on(table.senderId),
  index("idx_gifts_recipient").on(table.recipientId),
]);

export const spectatorGiftsRelations = relations(spectatorGifts, ({ one }) => ({
  session: one(liveGameSessions, { fields: [spectatorGifts.sessionId], references: [liveGameSessions.id] }),
  sender: one(users, { fields: [spectatorGifts.senderId], references: [users.id] }),
  recipient: one(users, { fields: [spectatorGifts.recipientId], references: [users.id] }),
  giftItem: one(giftItems, { fields: [spectatorGifts.giftItemId], references: [giftItems.id] }),
}));

export const insertSpectatorGiftSchema = createInsertSchema(spectatorGifts).omit({ id: true, createdAt: true });
export type InsertSpectatorGift = z.infer<typeof insertSpectatorGiftSchema>;
export type SpectatorGift = typeof spectatorGifts.$inferSelect;

// ==================== GAME CHAT MESSAGES ====================

export const gameChatMessages = pgTable("game_chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => liveGameSessions.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  messageType: text("message_type").notNull().default("text"),
  isFromSpectator: boolean("is_from_spectator").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_game_chat_session").on(table.sessionId),
  index("idx_game_chat_user").on(table.userId),
]);

export const gameChatMessagesRelations = relations(gameChatMessages, ({ one }) => ({
  session: one(liveGameSessions, { fields: [gameChatMessages.sessionId], references: [liveGameSessions.id] }),
  user: one(users, { fields: [gameChatMessages.userId], references: [users.id] }),
}));

export const insertGameChatMessageSchema = createInsertSchema(gameChatMessages).omit({ id: true, createdAt: true });
export type InsertGameChatMessage = z.infer<typeof insertGameChatMessageSchema>;
export type GameChatMessage = typeof gameChatMessages.$inferSelect;

// ==================== ACHIEVEMENTS ====================

export const achievementCategoryEnum = pgEnum("achievement_category", ["games", "wins", "earnings", "streaks", "social", "special"]);
export const achievementRarityEnum = pgEnum("achievement_rarity", ["common", "uncommon", "rare", "epic", "legendary"]);

export const achievements = pgTable("achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  descriptionEn: text("description_en").notNull(),
  descriptionAr: text("description_ar").notNull(),
  category: achievementCategoryEnum("category").notNull(),
  rarity: achievementRarityEnum("rarity").notNull().default("common"),
  gameType: text("game_type"),
  requirement: integer("requirement").notNull().default(1),
  rewardAmount: decimal("reward_amount", { precision: 15, scale: 2 }).notNull().default("0.00"),
  iconName: text("icon_name").notNull().default("trophy"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_achievements_category").on(table.category),
  index("idx_achievements_game_type").on(table.gameType),
  index("idx_achievements_rarity").on(table.rarity),
]);

export const insertAchievementSchema = createInsertSchema(achievements).omit({ id: true, createdAt: true });
export type InsertAchievement = z.infer<typeof insertAchievementSchema>;
export type Achievement = typeof achievements.$inferSelect;

// ==================== USER ACHIEVEMENTS ====================

export const userAchievements = pgTable("user_achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  achievementId: varchar("achievement_id").notNull().references(() => achievements.id),
  progress: integer("progress").notNull().default(0),
  unlockedAt: timestamp("unlocked_at"),
  rewardClaimed: boolean("reward_claimed").notNull().default(false),
  rewardClaimedAt: timestamp("reward_claimed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("idx_user_achievement_unique").on(table.userId, table.achievementId),
  index("idx_user_achievements_user").on(table.userId),
  index("idx_user_achievements_unlocked").on(table.unlockedAt),
]);

export const userAchievementsRelations = relations(userAchievements, ({ one }) => ({
  user: one(users, { fields: [userAchievements.userId], references: [users.id] }),
  achievement: one(achievements, { fields: [userAchievements.achievementId], references: [achievements.id] }),
}));

export const insertUserAchievementSchema = createInsertSchema(userAchievements).omit({ id: true, createdAt: true });
export type InsertUserAchievement = z.infer<typeof insertUserAchievementSchema>;
export type UserAchievement = typeof userAchievements.$inferSelect;

// ==================== SEASONS ====================

export const seasonStatusEnum = pgEnum("season_status", ["upcoming", "active", "ended", "archived"]);

export const seasons = pgTable("seasons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  number: integer("number").notNull().unique(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  descriptionEn: text("description_en"),
  descriptionAr: text("description_ar"),
  status: seasonStatusEnum("status").notNull().default("upcoming"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  prizePool: decimal("prize_pool", { precision: 15, scale: 2 }).notNull().default("0.00"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_seasons_status").on(table.status),
  index("idx_seasons_dates").on(table.startDate, table.endDate),
]);

export const insertSeasonSchema = createInsertSchema(seasons).omit({ id: true, createdAt: true });
export type InsertSeason = z.infer<typeof insertSeasonSchema>;
export type Season = typeof seasons.$inferSelect;

// ==================== SEASONAL STATS ====================

export const seasonalStats = pgTable("seasonal_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  seasonId: varchar("season_id").notNull().references(() => seasons.id),
  gamesPlayed: integer("games_played").notNull().default(0),
  gamesWon: integer("games_won").notNull().default(0),
  gamesLost: integer("games_lost").notNull().default(0),
  gamesDraw: integer("games_draw").notNull().default(0),
  chessPlayed: integer("chess_played").notNull().default(0),
  chessWon: integer("chess_won").notNull().default(0),
  backgammonPlayed: integer("backgammon_played").notNull().default(0),
  backgammonWon: integer("backgammon_won").notNull().default(0),
  dominoPlayed: integer("domino_played").notNull().default(0),
  dominoWon: integer("domino_won").notNull().default(0),
  tarneebPlayed: integer("tarneeb_played").notNull().default(0),
  tarneebWon: integer("tarneeb_won").notNull().default(0),
  balootPlayed: integer("baloot_played").notNull().default(0),
  balootWon: integer("baloot_won").notNull().default(0),
  totalEarnings: decimal("total_earnings", { precision: 15, scale: 2 }).notNull().default("0.00"),
  currentWinStreak: integer("current_win_streak").notNull().default(0),
  longestWinStreak: integer("longest_win_streak").notNull().default(0),
  rank: integer("rank"),
  rankUpdatedAt: timestamp("rank_updated_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("idx_seasonal_stats_user_season").on(table.userId, table.seasonId),
  index("idx_seasonal_stats_season").on(table.seasonId),
  index("idx_seasonal_stats_games_won").on(table.seasonId, table.gamesWon),
  index("idx_seasonal_stats_earnings").on(table.seasonId, table.totalEarnings),
  index("idx_seasonal_stats_streak").on(table.seasonId, table.longestWinStreak),
]);

export const seasonalStatsRelations = relations(seasonalStats, ({ one }) => ({
  user: one(users, { fields: [seasonalStats.userId], references: [users.id] }),
  season: one(seasons, { fields: [seasonalStats.seasonId], references: [seasons.id] }),
}));

export const insertSeasonalStatsSchema = createInsertSchema(seasonalStats).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSeasonalStats = z.infer<typeof insertSeasonalStatsSchema>;
export type SeasonalStats = typeof seasonalStats.$inferSelect;

// ==================== SEASON REWARDS ====================

export const seasonRewards = pgTable("season_rewards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  seasonId: varchar("season_id").notNull().references(() => seasons.id),
  rankFrom: integer("rank_from").notNull(),
  rankTo: integer("rank_to").notNull(),
  rewardAmount: decimal("reward_amount", { precision: 15, scale: 2 }).notNull(),
  rewardDescriptionEn: text("reward_description_en"),
  rewardDescriptionAr: text("reward_description_ar"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_season_rewards_season").on(table.seasonId),
]);

export const seasonRewardsRelations = relations(seasonRewards, ({ one }) => ({
  season: one(seasons, { fields: [seasonRewards.seasonId], references: [seasons.id] }),
}));

export const insertSeasonRewardSchema = createInsertSchema(seasonRewards).omit({ id: true, createdAt: true });
export type InsertSeasonReward = z.infer<typeof insertSeasonRewardSchema>;
export type SeasonReward = typeof seasonRewards.$inferSelect;

// ==================== PROJECT CURRENCY ====================

export const currencyApprovalModeEnum = pgEnum("currency_approval_mode", ["automatic", "manual"]);
export const currencyConversionStatusEnum = pgEnum("currency_conversion_status", ["pending", "approved", "rejected", "completed"]);
export const currencyLedgerTypeEnum = pgEnum("currency_ledger_type", ["conversion", "game_stake", "game_win", "p2p_send", "p2p_receive", "bonus", "refund", "admin_adjustment"]);

// Project Currency Settings - Admin configuration
export const projectCurrencySettings = pgTable("project_currency_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  currencyName: text("currency_name").notNull().default("VEX Coin"),
  currencySymbol: text("currency_symbol").notNull().default("VEX"),
  baseCurrencyCode: text("base_currency_code").notNull().default("USD"),
  exchangeRate: decimal("exchange_rate", { precision: 15, scale: 6 }).notNull().default("100"),
  minConversionAmount: decimal("min_conversion_amount", { precision: 15, scale: 2 }).notNull().default("1.00"),
  maxConversionAmount: decimal("max_conversion_amount", { precision: 15, scale: 2 }).notNull().default("10000.00"),
  dailyConversionLimitPerUser: decimal("daily_conversion_limit_per_user", { precision: 15, scale: 2 }).notNull().default("5000.00"),
  totalPlatformDailyLimit: decimal("total_platform_daily_limit", { precision: 15, scale: 2 }).notNull().default("1000000.00"),
  conversionCommissionRate: decimal("conversion_commission_rate", { precision: 5, scale: 4 }).notNull().default("0.01"),
  approvalMode: currencyApprovalModeEnum("approval_mode").notNull().default("automatic"),
  isActive: boolean("is_active").notNull().default(true),
  allowPointsConversion: boolean("allow_points_conversion").notNull().default(false),
  pointsExchangeRate: decimal("points_exchange_rate", { precision: 15, scale: 6 }).default("10"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProjectCurrencySettingsSchema = createInsertSchema(projectCurrencySettings).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProjectCurrencySettings = z.infer<typeof insertProjectCurrencySettingsSchema>;
export type ProjectCurrencySettings = typeof projectCurrencySettings.$inferSelect;

// Project Currency Wallets - User balances
export const projectCurrencyWallets = pgTable("project_currency_wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  purchasedBalance: decimal("purchased_balance", { precision: 15, scale: 2 }).notNull().default("0.00"),
  earnedBalance: decimal("earned_balance", { precision: 15, scale: 2 }).notNull().default("0.00"),
  totalBalance: decimal("total_balance", { precision: 15, scale: 2 }).notNull().default("0.00"),
  totalConverted: decimal("total_converted", { precision: 15, scale: 2 }).notNull().default("0.00"),
  totalSpent: decimal("total_spent", { precision: 15, scale: 2 }).notNull().default("0.00"),
  totalEarned: decimal("total_earned", { precision: 15, scale: 2 }).notNull().default("0.00"),
  lockedBalance: decimal("locked_balance", { precision: 15, scale: 2 }).notNull().default("0.00"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_currency_wallets_user").on(table.userId),
]);

export const projectCurrencyWalletsRelations = relations(projectCurrencyWallets, ({ one }) => ({
  user: one(users, { fields: [projectCurrencyWallets.userId], references: [users.id] }),
}));

export const insertProjectCurrencyWalletSchema = createInsertSchema(projectCurrencyWallets).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProjectCurrencyWallet = z.infer<typeof insertProjectCurrencyWalletSchema>;
export type ProjectCurrencyWallet = typeof projectCurrencyWallets.$inferSelect;

// Project Currency Conversions - Conversion requests with approval
export const projectCurrencyConversions = pgTable("project_currency_conversions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  baseCurrencyAmount: decimal("base_currency_amount", { precision: 15, scale: 2 }).notNull(),
  projectCurrencyAmount: decimal("project_currency_amount", { precision: 15, scale: 2 }).notNull(),
  exchangeRateUsed: decimal("exchange_rate_used", { precision: 15, scale: 6 }).notNull(),
  commissionAmount: decimal("commission_amount", { precision: 15, scale: 2 }).notNull().default("0.00"),
  netAmount: decimal("net_amount", { precision: 15, scale: 2 }).notNull(),
  status: currencyConversionStatusEnum("status").notNull().default("pending"),
  approvedById: varchar("approved_by_id").references(() => users.id),
  rejectionReason: text("rejection_reason"),
  approvedAt: timestamp("approved_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_currency_conversions_user").on(table.userId),
  index("idx_currency_conversions_status").on(table.status),
  index("idx_currency_conversions_date").on(table.createdAt),
]);

export const projectCurrencyConversionsRelations = relations(projectCurrencyConversions, ({ one }) => ({
  user: one(users, { fields: [projectCurrencyConversions.userId], references: [users.id] }),
  approvedBy: one(users, { fields: [projectCurrencyConversions.approvedById], references: [users.id] }),
}));

export const insertProjectCurrencyConversionSchema = createInsertSchema(projectCurrencyConversions).omit({ id: true, createdAt: true });
export type InsertProjectCurrencyConversion = z.infer<typeof insertProjectCurrencyConversionSchema>;
export type ProjectCurrencyConversion = typeof projectCurrencyConversions.$inferSelect;

// Project Currency Ledger - Transaction history
export const projectCurrencyLedger = pgTable("project_currency_ledger", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  walletId: varchar("wallet_id").notNull().references(() => projectCurrencyWallets.id),
  type: currencyLedgerTypeEnum("type").notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  balanceBefore: decimal("balance_before", { precision: 15, scale: 2 }).notNull(),
  balanceAfter: decimal("balance_after", { precision: 15, scale: 2 }).notNull(),
  referenceId: varchar("reference_id"),
  referenceType: text("reference_type"),
  description: text("description"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_currency_ledger_user").on(table.userId),
  index("idx_currency_ledger_wallet").on(table.walletId),
  index("idx_currency_ledger_type").on(table.type),
  index("idx_currency_ledger_date").on(table.createdAt),
  index("idx_currency_ledger_reference").on(table.referenceId, table.referenceType),
]);

export const projectCurrencyLedgerRelations = relations(projectCurrencyLedger, ({ one }) => ({
  user: one(users, { fields: [projectCurrencyLedger.userId], references: [users.id] }),
  wallet: one(projectCurrencyWallets, { fields: [projectCurrencyLedger.walletId], references: [projectCurrencyWallets.id] }),
}));

export const insertProjectCurrencyLedgerSchema = createInsertSchema(projectCurrencyLedger).omit({ id: true, createdAt: true });
export type InsertProjectCurrencyLedger = z.infer<typeof insertProjectCurrencyLedgerSchema>;
export type ProjectCurrencyLedger = typeof projectCurrencyLedger.$inferSelect;
