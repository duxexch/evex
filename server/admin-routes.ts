import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { z } from "zod";
import { 
  featureFlags, themes, adminAuditLogs, users, transactions, complaints,
  insertFeatureFlagSchema, insertAdminAuditLogSchema, supportContacts, insertSupportContactSchema,
  p2pOffers, p2pTrades, p2pDisputes, p2pTransactionLogs, p2pSettings,
  projectCurrencySettings, projectCurrencyConversions, projectCurrencyWallets, projectCurrencyLedger,
  appSettings, loginMethodConfigs, managedLanguages, badgeCatalog, broadcastNotifications, chatSettings, gameplaySettings,
  insertAppSettingSchema, insertLoginMethodConfigSchema, insertManagedLanguageSchema, insertBadgeCatalogSchema,
  insertBroadcastNotificationSchema, insertChatSettingSchema, insertGameplaySettingSchema,
  notifications, games, insertSocialPlatformSchema, multiplayerGames, insertMultiplayerGameSchema
} from "@shared/schema";
import { broadcastSystemEvent } from "./websocket";
import { emitGameChangeAlert, emitDisputeAlert } from "./lib/admin-alerts";
import { db } from "./db";
import { eq, desc, and, sql, like, or, gte, lte } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const ADMIN_JWT_SECRET = process.env.SESSION_SECRET ? 
  `admin_${process.env.SESSION_SECRET}_secure` : 
  "admin-secret-key-change-in-production-secure";

interface AdminRequest extends Request {
  admin?: { id: string; role: string; username: string };
}

const adminAuthMiddleware = async (req: AdminRequest, res: Response, next: NextFunction) => {
  const token = req.headers["x-admin-token"]?.toString();
  if (!token) {
    return res.status(401).json({ error: "Admin authentication required" });
  }
  try {
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET) as any;
    if (decoded.role !== "admin") {
      return res.status(403).json({ error: "Admin access only" });
    }
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid admin token" });
  }
};

async function logAdminAction(
  adminId: string,
  action: string,
  entityType: string,
  entityId: string,
  details: { previousValue?: string; newValue?: string; reason?: string; metadata?: string },
  req: Request
) {
  await db.insert(adminAuditLogs).values({
    adminId,
    action: action as any,
    entityType,
    entityId,
    previousValue: details.previousValue,
    newValue: details.newValue,
    reason: details.reason,
    metadata: details.metadata,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });
}

export function registerAdminRoutes(app: Express) {

  // ==================== ADMIN AUTH ====================

  app.post("/api/admin/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      const user = await storage.getUserByUsername(username);
      
      if (!user || user.role !== "admin") {
        return res.status(401).json({ error: "Invalid admin credentials" });
      }
      
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: "Invalid admin credentials" });
      }
      
      const token = jwt.sign(
        { id: user.id, role: user.role, username: user.username },
        ADMIN_JWT_SECRET,
        { expiresIn: "4h" }
      );
      
      await logAdminAction(user.id, "login", "admin", user.id, {}, req);
      
      res.json({ 
        token, 
        admin: { id: user.id, username: user.username, role: user.role } 
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/me", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const user = await storage.getUser(req.admin!.id);
      if (!user) {
        return res.status(404).json({ error: "Admin not found" });
      }
      res.json({ ...user, password: undefined });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== DASHBOARD STATS ====================

  app.get("/api/admin/stats", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const [
        totalUsersResult,
        activeUsersResult,
        totalTransactionsResult,
        pendingDepositsResult,
        pendingWithdrawalsResult,
        openComplaintsResult,
        totalBalanceResult
      ] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(users),
        db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.status, "active")),
        db.select({ count: sql<number>`count(*)` }).from(transactions),
        db.select({ count: sql<number>`count(*)`, sum: sql<string>`coalesce(sum(amount), 0)` })
          .from(transactions)
          .where(and(eq(transactions.type, "deposit"), eq(transactions.status, "pending"))),
        db.select({ count: sql<number>`count(*)`, sum: sql<string>`coalesce(sum(amount), 0)` })
          .from(transactions)
          .where(and(eq(transactions.type, "withdrawal"), eq(transactions.status, "pending"))),
        db.select({ count: sql<number>`count(*)` }).from(complaints).where(eq(complaints.status, "open")),
        db.select({ sum: sql<string>`coalesce(sum(balance), 0)` }).from(users),
      ]);

      res.json({
        totalUsers: Number(totalUsersResult[0]?.count || 0),
        activeUsers: Number(activeUsersResult[0]?.count || 0),
        totalTransactions: Number(totalTransactionsResult[0]?.count || 0),
        pendingDeposits: {
          count: Number(pendingDepositsResult[0]?.count || 0),
          amount: pendingDepositsResult[0]?.sum || "0"
        },
        pendingWithdrawals: {
          count: Number(pendingWithdrawalsResult[0]?.count || 0),
          amount: pendingWithdrawalsResult[0]?.sum || "0"
        },
        openComplaints: Number(openComplaintsResult[0]?.count || 0),
        totalUserBalance: totalBalanceResult[0]?.sum || "0"
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== GLOBAL SEARCH ====================

  app.get("/api/admin/search", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { q, type } = req.query;
      const query = String(q || "").trim();
      
      if (!query || query.length < 2) {
        return res.json({ users: [], transactions: [], complaints: [] });
      }

      const searchPattern = `%${query}%`;
      
      const [usersResult, transactionsResult, complaintsResult] = await Promise.all([
        type === "all" || type === "users" ? 
          db.select().from(users)
            .where(or(
              like(users.username, searchPattern),
              like(users.email || "", searchPattern),
              like(users.accountId || "", searchPattern),
              like(users.phone || "", searchPattern)
            ))
            .limit(10) : Promise.resolve([]),
        type === "all" || type === "transactions" ?
          db.select().from(transactions)
            .where(or(
              like(transactions.id, searchPattern),
              like(transactions.referenceId || "", searchPattern),
              like(transactions.description || "", searchPattern)
            ))
            .limit(10) : Promise.resolve([]),
        type === "all" || type === "complaints" ?
          db.select().from(complaints)
            .where(or(
              like(complaints.subject, searchPattern),
              like(complaints.description, searchPattern),
              like(complaints.ticketNumber, searchPattern)
            ))
            .limit(10) : Promise.resolve([])
      ]);

      res.json({
        users: usersResult.map(u => ({ ...u, password: undefined })),
        transactions: transactionsResult,
        complaints: complaintsResult
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== FEATURE FLAGS (Section Control) ====================

  app.get("/api/admin/feature-flags", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const flags = await db.select().from(featureFlags).orderBy(featureFlags.sortOrder);
      res.json(flags);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/feature-flags", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const data = insertFeatureFlagSchema.parse(req.body);
      const [flag] = await db.insert(featureFlags).values({
        ...data,
        updatedBy: req.admin!.id
      }).returning();
      
      await logAdminAction(req.admin!.id, "section_toggle", "feature_flag", flag.id, {
        newValue: JSON.stringify(data)
      }, req);
      
      res.json(flag);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/feature-flags/:id", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { isEnabled } = req.body;
      
      const [existing] = await db.select().from(featureFlags).where(eq(featureFlags.id, id));
      if (!existing) {
        return res.status(404).json({ error: "Feature flag not found" });
      }
      
      const [updated] = await db.update(featureFlags)
        .set({ isEnabled, updatedBy: req.admin!.id, updatedAt: new Date() })
        .where(eq(featureFlags.id, id))
        .returning();
      
      await logAdminAction(req.admin!.id, "section_toggle", "feature_flag", id, {
        previousValue: String(existing.isEnabled),
        newValue: String(isEnabled)
      }, req);
      
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== THEMES ====================

  app.get("/api/admin/themes", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const themesList = await db.select().from(themes);
      res.json(themesList);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/themes", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const [theme] = await db.insert(themes).values(req.body).returning();
      res.json(theme);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/themes/:id/activate", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      await db.update(themes).set({ isDefault: false });
      const [updated] = await db.update(themes)
        .set({ isDefault: true })
        .where(eq(themes.id, id))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: "Theme not found" });
      }
      
      await logAdminAction(req.admin!.id, "theme_change", "theme", id, {
        newValue: updated.name
      }, req);
      
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== USER MANAGEMENT ====================

  app.get("/api/admin/users", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { role, status, limit = "50", offset = "0" } = req.query;
      
      let query = db.select().from(users);
      const conditions = [];
      
      if (role) conditions.push(eq(users.role, role as any));
      if (status) conditions.push(eq(users.status, status as any));
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
      
      const result = await query
        .orderBy(desc(users.createdAt))
        .limit(Number(limit))
        .offset(Number(offset));
      
      res.json(result.map(u => ({ ...u, password: undefined })));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/users/:id", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const userTransactions = await db.select()
        .from(transactions)
        .where(eq(transactions.userId, req.params.id))
        .orderBy(desc(transactions.createdAt))
        .limit(20);
      
      res.json({ 
        user: { ...user, password: undefined },
        transactions: userTransactions
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/users/:id", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const existing = await storage.getUser(id);
      if (!existing) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const updated = await storage.updateUser(id, updates);
      
      await logAdminAction(req.admin!.id, "user_update", "user", id, {
        previousValue: JSON.stringify({ status: existing.status, role: existing.role }),
        newValue: JSON.stringify(updates)
      }, req);
      
      res.json({ ...updated, password: undefined });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/users/:id/ban", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      const [updated] = await db.update(users)
        .set({ status: "banned", updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
      
      await logAdminAction(req.admin!.id, "user_ban", "user", id, { reason }, req);
      
      res.json({ ...updated, password: undefined });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/users/:id/suspend", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      const [updated] = await db.update(users)
        .set({ status: "suspended", updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
      
      await logAdminAction(req.admin!.id, "user_suspend", "user", id, { reason }, req);
      
      res.json({ ...updated, password: undefined });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/users/:id/balance-adjust", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { amount, type, reason } = req.body;
      
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const currentBalance = parseFloat(user.balance);
      const adjustAmount = parseFloat(amount);
      const newBalance = type === "add" ? currentBalance + adjustAmount : currentBalance - adjustAmount;
      
      if (newBalance < 0) {
        return res.status(400).json({ error: "Balance cannot be negative" });
      }
      
      const [updated] = await db.update(users)
        .set({ balance: String(newBalance), updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
      
      await storage.createTransaction({
        userId: id,
        type: type === "add" ? "bonus" : "withdrawal",
        status: "completed",
        amount: String(adjustAmount),
        balanceBefore: String(currentBalance),
        balanceAfter: String(newBalance),
        description: `Admin adjustment: ${reason}`,
        adminNote: reason
      });
      
      await logAdminAction(req.admin!.id, "user_balance_adjust", "user", id, {
        previousValue: String(currentBalance),
        newValue: String(newBalance),
        reason
      }, req);
      
      res.json({ ...updated, password: undefined });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/users/:id/reward", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { amount, reason } = req.body;
      
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const currentBalance = parseFloat(user.balance);
      const rewardAmount = parseFloat(amount);
      const newBalance = currentBalance + rewardAmount;
      
      const [updated] = await db.update(users)
        .set({ balance: String(newBalance), updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
      
      await storage.createTransaction({
        userId: id,
        type: "bonus",
        status: "completed",
        amount: String(rewardAmount),
        balanceBefore: String(currentBalance),
        balanceAfter: String(newBalance),
        description: `Reward: ${reason}`,
        adminNote: `Sent by admin: ${reason}`
      });
      
      await logAdminAction(req.admin!.id, "reward_sent", "user", id, {
        newValue: String(rewardAmount),
        reason
      }, req);
      
      res.json({ ...updated, password: undefined, rewardSent: rewardAmount });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/users/:id/p2p-ban", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { reason, banned } = req.body;
      
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const [updated] = await db.update(users)
        .set({ 
          p2pBanned: banned ?? true, 
          p2pBanReason: banned ? reason : null,
          p2pBannedAt: banned ? new Date() : null,
          updatedAt: new Date() 
        })
        .where(eq(users.id, id))
        .returning();
      
      await logAdminAction(req.admin!.id, banned ? "p2p_ban" : "p2p_unban", "user", id, {
        previousValue: String(user.p2pBanned),
        newValue: String(banned),
        reason
      }, req);
      
      res.json({ ...updated, password: undefined });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== COMPLAINTS / DISPUTES ====================

  app.get("/api/admin/complaints", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { status, priority } = req.query;
      const conditions = [];
      
      if (status) conditions.push(eq(complaints.status, status as any));
      if (priority) conditions.push(eq(complaints.priority, priority as any));
      
      let query = db.select().from(complaints);
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
      
      const result = await query.orderBy(desc(complaints.createdAt));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/complaints/:id", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const updated = await storage.updateComplaint(id, updates);
      
      if (updates.status === "resolved" || updates.status === "closed") {
        await logAdminAction(req.admin!.id, "dispute_resolve", "complaint", id, {
          newValue: updates.status,
          reason: updates.resolution
        }, req);
      }
      
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== ANALYTICS ====================

  app.get("/api/admin/analytics", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { period = "7d" } = req.query;
      
      let dateFilter: Date;
      switch (period) {
        case "24h": dateFilter = new Date(Date.now() - 24 * 60 * 60 * 1000); break;
        case "7d": dateFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); break;
        case "30d": dateFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); break;
        default: dateFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      }
      
      const [
        newUsers,
        depositsInPeriod,
        withdrawalsInPeriod,
        activeTransactions
      ] = await Promise.all([
        db.select({ count: sql<number>`count(*)` })
          .from(users)
          .where(gte(users.createdAt, dateFilter)),
        db.select({ 
          count: sql<number>`count(*)`,
          total: sql<string>`coalesce(sum(amount), 0)`
        })
          .from(transactions)
          .where(and(
            eq(transactions.type, "deposit"),
            eq(transactions.status, "completed"),
            gte(transactions.createdAt, dateFilter)
          )),
        db.select({ 
          count: sql<number>`count(*)`,
          total: sql<string>`coalesce(sum(amount), 0)`
        })
          .from(transactions)
          .where(and(
            eq(transactions.type, "withdrawal"),
            eq(transactions.status, "completed"),
            gte(transactions.createdAt, dateFilter)
          )),
        db.select({ count: sql<number>`count(*)` })
          .from(transactions)
          .where(gte(transactions.createdAt, dateFilter))
      ]);
      
      res.json({
        period,
        newUsers: Number(newUsers[0]?.count || 0),
        deposits: {
          count: Number(depositsInPeriod[0]?.count || 0),
          total: depositsInPeriod[0]?.total || "0"
        },
        withdrawals: {
          count: Number(withdrawalsInPeriod[0]?.count || 0),
          total: withdrawalsInPeriod[0]?.total || "0"
        },
        totalTransactions: Number(activeTransactions[0]?.count || 0)
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== AUDIT LOGS ====================

  app.get("/api/admin/audit-logs", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { limit = "50", action } = req.query;
      
      let query = db.select().from(adminAuditLogs);
      
      if (action) {
        query = query.where(eq(adminAuditLogs.action, action as any)) as any;
      }
      
      const result = await query
        .orderBy(desc(adminAuditLogs.createdAt))
        .limit(Number(limit));
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== PUBLIC SETTINGS (for user app) ====================

  app.get("/api/settings/public", async (req: Request, res: Response) => {
    try {
      const [flagsList, activeTheme] = await Promise.all([
        db.select().from(featureFlags),
        db.select().from(themes).where(eq(themes.isDefault, true)).limit(1)
      ]);
      
      const enabledSections: Record<string, boolean> = {};
      flagsList.forEach(flag => {
        enabledSections[flag.key] = flag.isEnabled;
      });
      
      res.json({
        sections: enabledSections,
        theme: activeTheme[0] || null
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Public themes list (for user theme picker)
  app.get("/api/themes/public", async (req: Request, res: Response) => {
    try {
      const themesList = await db.select().from(themes);
      res.json(themesList);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Seed default feature flags and themes
  app.post("/api/admin/seed-defaults", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const defaultFlags = [
        { key: "dashboard", name: "Dashboard", nameAr: "لوحة التحكم", icon: "LayoutDashboard", sortOrder: 1 },
        { key: "wallet", name: "Wallet", nameAr: "المحفظة", icon: "Wallet", sortOrder: 2 },
        { key: "challenges", name: "Challenges", nameAr: "التحديات", icon: "Swords", sortOrder: 3 },
        { key: "play", name: "Play Games", nameAr: "العب الألعاب", icon: "Play", sortOrder: 4 },
        { key: "p2p", name: "P2P Trading", nameAr: "تداول P2P", icon: "ArrowLeftRight", sortOrder: 5 },
        { key: "free", name: "Free Rewards", nameAr: "مكافآت مجانية", icon: "Gift", sortOrder: 6 },
        { key: "transactions", name: "Transactions", nameAr: "المعاملات", icon: "DollarSign", sortOrder: 7 },
        { key: "complaints", name: "Complaints", nameAr: "الشكاوى", icon: "AlertTriangle", sortOrder: 8 },
        { key: "settings", name: "Settings", nameAr: "الإعدادات", icon: "Settings", sortOrder: 9 },
      ];
      
      for (const flag of defaultFlags) {
        const existing = await db.select().from(featureFlags).where(eq(featureFlags.key, flag.key));
        if (existing.length === 0) {
          await db.insert(featureFlags).values({
            ...flag,
            isEnabled: true,
            category: "section",
            updatedBy: req.admin!.id
          });
        }
      }
      
      const defaultThemes = [
        {
          name: "vex-dark",
          displayName: "VEX Dark",
          primaryColor: "#00c853",
          secondaryColor: "#ff9800",
          accentColor: "#00bcd4",
          backgroundColor: "#0f1419",
          foregroundColor: "#ffffff",
          cardColor: "#1a1f26",
          mutedColor: "#6b7280",
          borderColor: "#2d3748",
          isDefault: true
        },
        {
          name: "midnight-blue",
          displayName: "Midnight Blue",
          primaryColor: "#3b82f6",
          secondaryColor: "#8b5cf6",
          accentColor: "#06b6d4",
          backgroundColor: "#0f172a",
          foregroundColor: "#f8fafc",
          cardColor: "#1e293b",
          mutedColor: "#64748b",
          borderColor: "#334155",
          isDefault: false
        },
        {
          name: "crimson-night",
          displayName: "Crimson Night",
          primaryColor: "#ef4444",
          secondaryColor: "#f97316",
          accentColor: "#eab308",
          backgroundColor: "#18181b",
          foregroundColor: "#fafafa",
          cardColor: "#27272a",
          mutedColor: "#71717a",
          borderColor: "#3f3f46",
          isDefault: false
        },
        {
          name: "emerald-forest",
          displayName: "Emerald Forest",
          primaryColor: "#10b981",
          secondaryColor: "#14b8a6",
          accentColor: "#22d3ee",
          backgroundColor: "#022c22",
          foregroundColor: "#ecfdf5",
          cardColor: "#064e3b",
          mutedColor: "#6ee7b7",
          borderColor: "#065f46",
          isDefault: false
        },
        {
          name: "royal-gold",
          displayName: "Royal Gold",
          primaryColor: "#f59e0b",
          secondaryColor: "#d97706",
          accentColor: "#fbbf24",
          backgroundColor: "#1c1917",
          foregroundColor: "#fef3c7",
          cardColor: "#292524",
          mutedColor: "#a8a29e",
          borderColor: "#44403c",
          isDefault: false
        }
      ];
      
      for (const theme of defaultThemes) {
        const existing = await db.select().from(themes).where(eq(themes.name, theme.name));
        if (existing.length === 0) {
          await db.insert(themes).values(theme);
        }
      }
      
      res.json({ message: "Default data seeded successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== SUPPORT CONTACTS ====================

  app.get("/api/admin/support/contacts", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const contacts = await db.select().from(supportContacts).orderBy(supportContacts.displayOrder);
      res.json(contacts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/support/contacts", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const data = insertSupportContactSchema.parse(req.body);
      const [contact] = await db.insert(supportContacts).values(data).returning();
      
      await logAdminAction(
        req.admin!.id,
        "settings_update",
        "support_contact",
        contact.id,
        { newValue: JSON.stringify(data), reason: "Created support contact" },
        req
      );
      
      res.json(contact);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/support/contacts/:id", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updates = insertSupportContactSchema.partial().parse(req.body);
      
      const [existing] = await db.select().from(supportContacts).where(eq(supportContacts.id, id));
      if (!existing) {
        return res.status(404).json({ error: "Contact not found" });
      }
      
      const [contact] = await db.update(supportContacts)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(supportContacts.id, id))
        .returning();
      
      await logAdminAction(
        req.admin!.id,
        "settings_update",
        "support_contact",
        id,
        { previousValue: JSON.stringify(existing), newValue: JSON.stringify(updates) },
        req
      );
      
      res.json(contact);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/support/contacts/:id", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      const [existing] = await db.select().from(supportContacts).where(eq(supportContacts.id, id));
      if (!existing) {
        return res.status(404).json({ error: "Contact not found" });
      }
      
      await db.delete(supportContacts).where(eq(supportContacts.id, id));
      
      await logAdminAction(
        req.admin!.id,
        "settings_update",
        "support_contact",
        id,
        { previousValue: JSON.stringify(existing), reason: "Deleted support contact" },
        req
      );
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Public endpoint for user app
  app.get("/api/support/contacts", async (req: Request, res: Response) => {
    try {
      const contacts = await db.select()
        .from(supportContacts)
        .where(eq(supportContacts.isActive, true))
        .orderBy(supportContacts.displayOrder);
      res.json(contacts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== P2P MANAGEMENT ====================

  app.get("/api/admin/p2p/stats", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const [activeOffers] = await db.select({ count: sql<number>`count(*)` })
        .from(p2pOffers)
        .where(eq(p2pOffers.status, "active"));
      
      const [completedTrades] = await db.select({ count: sql<number>`count(*)` })
        .from(p2pTrades)
        .where(sql`${p2pTrades.status} = 'completed'`);
      
      const [pendingTrades] = await db.select({ count: sql<number>`count(*)` })
        .from(p2pTrades)
        .where(sql`${p2pTrades.status} IN ('pending', 'paid', 'confirmed')`);
      
      const [openDisputes] = await db.select({ count: sql<number>`count(*)` })
        .from(p2pDisputes)
        .where(sql`${p2pDisputes.status} IN ('open', 'investigating')`);

      res.json({
        activeOffers: Number(activeOffers?.count) || 0,
        completedTrades: Number(completedTrades?.count) || 0,
        pendingTrades: Number(pendingTrades?.count) || 0,
        openDisputes: Number(openDisputes?.count) || 0,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/p2p/offers", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const offers = await db.select({
        id: p2pOffers.id,
        userId: p2pOffers.userId,
        type: p2pOffers.type,
        availableAmount: p2pOffers.availableAmount,
        price: p2pOffers.price,
        cryptoCurrency: p2pOffers.cryptoCurrency,
        fiatCurrency: p2pOffers.fiatCurrency,
        minLimit: p2pOffers.minLimit,
        maxLimit: p2pOffers.maxLimit,
        paymentMethods: p2pOffers.paymentMethods,
        status: p2pOffers.status,
        createdAt: p2pOffers.createdAt,
        username: users.username,
      })
        .from(p2pOffers)
        .leftJoin(users, eq(p2pOffers.userId, users.id))
        .orderBy(desc(p2pOffers.createdAt))
        .limit(100);
      
      const formattedOffers = offers.map(offer => ({
        ...offer,
        amount: offer.availableAmount,
        currency: `${offer.cryptoCurrency}/${offer.fiatCurrency}`,
      }));
      
      res.json(formattedOffers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/p2p/trades", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const trades = await db.select()
        .from(p2pTrades)
        .orderBy(desc(p2pTrades.createdAt))
        .limit(100);

      const tradesWithUsers = await Promise.all(trades.map(async (trade) => {
        const buyer = await storage.getUser(trade.buyerId);
        const seller = await storage.getUser(trade.sellerId);
        return {
          ...trade,
          buyerUsername: buyer?.username || "Unknown",
          sellerUsername: seller?.username || "Unknown",
        };
      }));

      res.json(tradesWithUsers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Enhanced dispute listing with filters, sorting, and real-time alerts
  app.get("/api/admin/p2p/disputes", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { status, sortBy, sortOrder, dateFrom, dateTo, minValue, maxValue } = req.query;
      
      const conditions: any[] = [];
      
      // Filter by status
      if (status && status !== "all") {
        conditions.push(eq(p2pDisputes.status, String(status) as any));
      }
      
      // Filter by date range
      if (dateFrom) {
        conditions.push(gte(p2pDisputes.createdAt, new Date(String(dateFrom))));
      }
      if (dateTo) {
        conditions.push(lte(p2pDisputes.createdAt, new Date(String(dateTo))));
      }
      
      // Build query
      let disputes;
      if (conditions.length > 0) {
        disputes = await db.select()
          .from(p2pDisputes)
          .where(and(...conditions))
          .orderBy(sortOrder === "asc" ? p2pDisputes.createdAt : desc(p2pDisputes.createdAt))
          .limit(200);
      } else {
        disputes = await db.select()
          .from(p2pDisputes)
          .orderBy(sortOrder === "asc" ? p2pDisputes.createdAt : desc(p2pDisputes.createdAt))
          .limit(200);
      }
      
      // Enrich with user info and trade value
      const disputesWithDetails = await Promise.all(disputes.map(async (dispute) => {
        const initiator = await storage.getUser(dispute.initiatorId);
        const respondent = await storage.getUser(dispute.respondentId);
        const [trade] = await db.select().from(p2pTrades).where(eq(p2pTrades.id, dispute.tradeId));
        
        return {
          ...dispute,
          initiatorName: initiator?.username || "Unknown",
          respondentName: respondent?.username || "Unknown",
          tradeAmount: trade?.amount || "0",
          tradeCurrency: "USD",
        };
      }));
      
      // Sort by criticality if requested (open disputes first, then by date)
      if (sortBy === "criticality") {
        disputesWithDetails.sort((a, b) => {
          const statusOrder: Record<string, number> = { open: 0, investigating: 1, resolved: 2, closed: 3 };
          const statusDiff = (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
          if (statusDiff !== 0) return statusDiff;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      }
      
      res.json(disputesWithDetails);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/p2p/offers/:id/cancel", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const [updated] = await db.update(p2pOffers)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(p2pOffers.id, id))
        .returning();

      await logAdminAction(req.admin!.id, "p2p_offer_cancel", "p2p_offer", id, { reason }, req);

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/p2p/disputes/:id/resolve", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { resolution, winnerId } = req.body;

      const [dispute] = await db.select().from(p2pDisputes).where(eq(p2pDisputes.id, id));
      if (!dispute) {
        return res.status(404).json({ error: "Dispute not found" });
      }

      const [updated] = await db.update(p2pDisputes)
        .set({ 
          status: "resolved", 
          resolution,
          resolvedBy: req.admin!.id,
          resolvedAt: new Date(),
          updatedAt: new Date() 
        })
        .where(eq(p2pDisputes.id, id))
        .returning();

      if (dispute.tradeId) {
        await db.update(p2pTrades)
          .set({ status: "completed", updatedAt: new Date() })
          .where(eq(p2pTrades.id, dispute.tradeId));
      }

      // Log the action to transaction logs
      await db.insert(p2pTransactionLogs).values({
        tradeId: dispute.tradeId,
        disputeId: id,
        userId: req.admin!.id,
        action: "dispute_resolved",
        description: `Dispute resolved by admin. Winner: ${winnerId}. Resolution: ${resolution}`,
        metadata: JSON.stringify({ winnerId, resolution, adminId: req.admin!.id })
      });
      
      await logAdminAction(req.admin!.id, "p2p_dispute_resolve", "p2p_dispute", id, { 
        reason: resolution,
        newValue: winnerId 
      }, req);
      
      // Emit admin alert for dispute resolution
      await emitDisputeAlert({
        disputeId: id,
        tradeId: dispute.tradeId,
        isNew: false,
        severity: "info",
        message: `Dispute resolved by ${req.admin!.username}. Resolution: ${resolution}`
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Escalate dispute to investigating status
  app.post("/api/admin/p2p/disputes/:id/escalate", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      const [dispute] = await db.select().from(p2pDisputes).where(eq(p2pDisputes.id, id));
      if (!dispute) {
        return res.status(404).json({ error: "Dispute not found" });
      }
      
      if (dispute.status !== "open") {
        return res.status(400).json({ error: "Can only escalate open disputes" });
      }
      
      const [updated] = await db.update(p2pDisputes)
        .set({
          status: "investigating",
          updatedAt: new Date()
        })
        .where(eq(p2pDisputes.id, id))
        .returning();
      
      // Log to transaction logs (using dispute_message for escalation updates)
      await db.insert(p2pTransactionLogs).values({
        tradeId: dispute.tradeId,
        disputeId: id,
        userId: req.admin!.id,
        action: "dispute_message",
        description: `Dispute escalated to investigation. Reason: ${reason || "No reason provided"}`,
        metadata: JSON.stringify({ reason, adminId: req.admin!.id, previousStatus: "open", eventType: "escalated" })
      });
      
      await logAdminAction(req.admin!.id, "p2p_dispute_escalate", "p2p_dispute", id, {
        previousValue: "open",
        newValue: "investigating",
        reason
      }, req);
      
      // Emit admin alert
      await emitDisputeAlert({
        disputeId: id,
        tradeId: dispute.tradeId,
        isNew: false,
        severity: "warning",
        message: `Dispute escalated to investigation by ${req.admin!.username}. Reason: ${reason || "Escalated for investigation"}`
      });
      
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Close dispute without resolution
  app.post("/api/admin/p2p/disputes/:id/close", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      const [dispute] = await db.select().from(p2pDisputes).where(eq(p2pDisputes.id, id));
      if (!dispute) {
        return res.status(404).json({ error: "Dispute not found" });
      }
      
      const [updated] = await db.update(p2pDisputes)
        .set({
          status: "closed",
          resolution: reason || "Closed by admin",
          resolvedBy: req.admin!.id,
          resolvedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(p2pDisputes.id, id))
        .returning();
      
      // Log to transaction logs (using dispute_resolved for closure)
      await db.insert(p2pTransactionLogs).values({
        tradeId: dispute.tradeId,
        disputeId: id,
        userId: req.admin!.id,
        action: "dispute_resolved",
        description: `Dispute closed by admin. Reason: ${reason || "No reason provided"}`,
        metadata: JSON.stringify({ reason, adminId: req.admin!.id, previousStatus: dispute.status, eventType: "closed" })
      });
      
      await logAdminAction(req.admin!.id, "p2p_dispute_close", "p2p_dispute", id, {
        previousValue: dispute.status,
        newValue: "closed",
        reason
      }, req);
      
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get dispute audit trail/transaction logs
  app.get("/api/admin/p2p/disputes/:id/logs", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      const logs = await db.select()
        .from(p2pTransactionLogs)
        .where(eq(p2pTransactionLogs.disputeId, id))
        .orderBy(desc(p2pTransactionLogs.createdAt));
      
      // Enrich with user info
      const logsWithUsers = await Promise.all(logs.map(async (log) => {
        const user = log.userId ? await storage.getUser(log.userId) : null;
        return {
          ...log,
          username: user?.username || "System"
        };
      }));
      
      res.json(logsWithUsers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== APP SETTINGS ====================

  app.get("/api/admin/app-settings", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const settings = await db.select().from(appSettings).orderBy(appSettings.key);
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/app-settings", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const data = insertAppSettingSchema.parse(req.body);
      const [setting] = await db.insert(appSettings).values({
        ...data,
        updatedBy: req.admin!.id
      }).returning();

      await logAdminAction(req.admin!.id, "settings_change", "app_setting", setting.id, {
        newValue: JSON.stringify(data)
      }, req);

      res.json(setting);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/app-settings/:key", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { key } = req.params;
      const { value, valueAr, category } = req.body;

      const [existing] = await db.select().from(appSettings).where(eq(appSettings.key, key));
      
      if (!existing) {
        const [created] = await db.insert(appSettings).values({
          key,
          value,
          valueAr,
          category,
          updatedBy: req.admin!.id
        }).returning();

        await logAdminAction(req.admin!.id, "settings_change", "app_setting", created.id, {
          newValue: value
        }, req);

        return res.json(created);
      }

      const [updated] = await db.update(appSettings)
        .set({ value, valueAr, category, updatedBy: req.admin!.id, updatedAt: new Date() })
        .where(eq(appSettings.key, key))
        .returning();

      await logAdminAction(req.admin!.id, "settings_change", "app_setting", updated.id, {
        previousValue: existing.value || "",
        newValue: value
      }, req);

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== LOGIN METHOD CONFIGS ====================

  app.get("/api/admin/login-configs", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const configs = await db.select().from(loginMethodConfigs).orderBy(loginMethodConfigs.method);
      res.json(configs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/login-configs/:method", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { method } = req.params;
      const { isEnabled, otpEnabled, otpLength, otpExpiryMinutes, settings } = req.body;

      const [existing] = await db.select().from(loginMethodConfigs).where(eq(loginMethodConfigs.method, method));
      
      if (!existing) {
        const [created] = await db.insert(loginMethodConfigs).values({
          method,
          isEnabled: isEnabled ?? false,
          otpEnabled: otpEnabled ?? false,
          otpLength: otpLength ?? 6,
          otpExpiryMinutes: otpExpiryMinutes ?? 5,
          settings,
          updatedBy: req.admin!.id
        }).returning();

        await logAdminAction(req.admin!.id, "settings_change", "login_method_config", created.id, {
          newValue: JSON.stringify({ method, isEnabled })
        }, req);

        return res.json(created);
      }

      const [updated] = await db.update(loginMethodConfigs)
        .set({ 
          isEnabled: isEnabled ?? existing.isEnabled,
          otpEnabled: otpEnabled ?? existing.otpEnabled,
          otpLength: otpLength ?? existing.otpLength,
          otpExpiryMinutes: otpExpiryMinutes ?? existing.otpExpiryMinutes,
          settings: settings ?? existing.settings,
          updatedBy: req.admin!.id,
          updatedAt: new Date()
        })
        .where(eq(loginMethodConfigs.method, method))
        .returning();

      await logAdminAction(req.admin!.id, "settings_change", "login_method_config", updated.id, {
        previousValue: String(existing.isEnabled),
        newValue: String(isEnabled)
      }, req);

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== MANAGED LANGUAGES ====================

  app.get("/api/admin/languages", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const languages = await db.select().from(managedLanguages).orderBy(managedLanguages.name);
      res.json(languages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/languages", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const data = insertManagedLanguageSchema.parse(req.body);
      const [language] = await db.insert(managedLanguages).values(data).returning();

      await logAdminAction(req.admin!.id, "settings_change", "managed_language", language.id, {
        newValue: JSON.stringify(data)
      }, req);

      res.json(language);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/languages/:id", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, nativeName, direction, isDefault, isActive, translations } = req.body;

      const [existing] = await db.select().from(managedLanguages).where(eq(managedLanguages.id, id));
      if (!existing) {
        return res.status(404).json({ error: "Language not found" });
      }

      if (isDefault === true) {
        await db.update(managedLanguages).set({ isDefault: false });
      }

      const [updated] = await db.update(managedLanguages)
        .set({ 
          name: name ?? existing.name,
          nativeName: nativeName ?? existing.nativeName,
          direction: direction ?? existing.direction,
          isDefault: isDefault ?? existing.isDefault,
          isActive: isActive ?? existing.isActive,
          translations: translations ?? existing.translations,
          updatedAt: new Date()
        })
        .where(eq(managedLanguages.id, id))
        .returning();

      await logAdminAction(req.admin!.id, "settings_change", "managed_language", id, {
        previousValue: JSON.stringify(existing),
        newValue: JSON.stringify(updated)
      }, req);

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/languages/:id", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;

      const [existing] = await db.select().from(managedLanguages).where(eq(managedLanguages.id, id));
      if (!existing) {
        return res.status(404).json({ error: "Language not found" });
      }

      if (existing.isDefault) {
        return res.status(400).json({ error: "Cannot delete default language" });
      }

      await db.delete(managedLanguages).where(eq(managedLanguages.id, id));

      await logAdminAction(req.admin!.id, "settings_change", "managed_language", id, {
        previousValue: JSON.stringify(existing),
        reason: "Language deleted"
      }, req);

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== BADGE CATALOG ====================

  app.get("/api/admin/badges", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const badges = await db.select().from(badgeCatalog).orderBy(badgeCatalog.sortOrder, badgeCatalog.name);
      res.json(badges);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/badges", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const data = insertBadgeCatalogSchema.parse(req.body);
      const [badge] = await db.insert(badgeCatalog).values(data).returning();

      await logAdminAction(req.admin!.id, "settings_change", "badge_catalog", badge.id, {
        newValue: JSON.stringify(data)
      }, req);

      res.json(badge);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/badges/:id", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const [existing] = await db.select().from(badgeCatalog).where(eq(badgeCatalog.id, id));
      if (!existing) {
        return res.status(404).json({ error: "Badge not found" });
      }

      const [updated] = await db.update(badgeCatalog)
        .set({
          name: updates.name ?? existing.name,
          nameAr: updates.nameAr ?? existing.nameAr,
          description: updates.description ?? existing.description,
          descriptionAr: updates.descriptionAr ?? existing.descriptionAr,
          iconUrl: updates.iconUrl ?? existing.iconUrl,
          iconName: updates.iconName ?? existing.iconName,
          color: updates.color ?? existing.color,
          category: updates.category ?? existing.category,
          requirement: updates.requirement ?? existing.requirement,
          points: updates.points ?? existing.points,
          isActive: updates.isActive ?? existing.isActive,
          sortOrder: updates.sortOrder ?? existing.sortOrder
        })
        .where(eq(badgeCatalog.id, id))
        .returning();

      await logAdminAction(req.admin!.id, "settings_change", "badge_catalog", id, {
        previousValue: JSON.stringify(existing),
        newValue: JSON.stringify(updated)
      }, req);

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/badges/:id", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;

      const [existing] = await db.select().from(badgeCatalog).where(eq(badgeCatalog.id, id));
      if (!existing) {
        return res.status(404).json({ error: "Badge not found" });
      }

      await db.delete(badgeCatalog).where(eq(badgeCatalog.id, id));

      await logAdminAction(req.admin!.id, "settings_change", "badge_catalog", id, {
        previousValue: JSON.stringify(existing),
        reason: "Badge deleted"
      }, req);

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== BROADCAST NOTIFICATIONS ====================

  app.get("/api/admin/broadcast-notifications", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const broadcasts = await db.select().from(broadcastNotifications).orderBy(desc(broadcastNotifications.sentAt)).limit(100);
      res.json(broadcasts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/broadcast-notifications", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const data = insertBroadcastNotificationSchema.parse(req.body);
      const [broadcast] = await db.insert(broadcastNotifications).values({
        ...data,
        sentBy: req.admin!.id
      }).returning();

      if (data.targetType === "all") {
        const allUsers = await db.select({ id: users.id }).from(users).where(eq(users.status, "active"));
        for (const user of allUsers) {
          await db.insert(notifications).values({
            userId: user.id,
            type: "announcement",
            title: data.title,
            message: data.content,
            metadata: JSON.stringify({ broadcastId: broadcast.id })
          });
        }
      } else if (data.targetType === "user" && data.targetValue) {
        await db.insert(notifications).values({
          userId: data.targetValue,
          type: "announcement",
          title: data.title,
          message: data.content,
          metadata: JSON.stringify({ broadcastId: broadcast.id })
        });
      }

      await logAdminAction(req.admin!.id, "settings_change", "broadcast_notification", broadcast.id, {
        newValue: JSON.stringify({ title: data.title, targetType: data.targetType })
      }, req);

      res.json(broadcast);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== CHAT SETTINGS ====================

  app.get("/api/admin/chat-settings", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const settings = await db.select().from(chatSettings).orderBy(chatSettings.key);
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/chat-settings/:key", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { key } = req.params;
      const { value } = req.body;

      const [existing] = await db.select().from(chatSettings).where(eq(chatSettings.key, key));

      if (!existing) {
        const [created] = await db.insert(chatSettings).values({
          key,
          value,
          updatedBy: req.admin!.id
        }).returning();

        await logAdminAction(req.admin!.id, "settings_change", "chat_setting", created.id, {
          newValue: value
        }, req);

        return res.json(created);
      }

      const [updated] = await db.update(chatSettings)
        .set({ value, updatedBy: req.admin!.id, updatedAt: new Date() })
        .where(eq(chatSettings.key, key))
        .returning();

      await logAdminAction(req.admin!.id, "settings_change", "chat_setting", updated.id, {
        previousValue: existing.value || "",
        newValue: value
      }, req);

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== GAMEPLAY SETTINGS ====================

  app.get("/api/admin/gameplay-settings", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const settings = await db.select().from(gameplaySettings).orderBy(gameplaySettings.key);
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/gameplay-settings", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const defaultSettings = [
        { key: "free_play_limit", value: "5", description: "Number of free plays per day", descriptionAr: "عدد اللعبات المجانية في اليوم" },
        { key: "min_bet", value: "1.00", description: "Minimum bet amount", descriptionAr: "الحد الأدنى للرهان" },
        { key: "max_bet", value: "1000.00", description: "Maximum bet amount", descriptionAr: "الحد الأقصى للرهان" },
        { key: "house_edge", value: "5.00", description: "House edge percentage", descriptionAr: "نسبة ربح المنزل" },
        { key: "default_rtp", value: "95.00", description: "Default return to player percentage", descriptionAr: "نسبة العائد للاعب الافتراضية" }
      ];

      const created = [];
      for (const setting of defaultSettings) {
        const [existing] = await db.select().from(gameplaySettings).where(eq(gameplaySettings.key, setting.key));
        if (!existing) {
          const [inserted] = await db.insert(gameplaySettings).values({
            ...setting,
            updatedBy: req.admin!.id
          }).returning();
          created.push(inserted);
        }
      }

      if (created.length > 0) {
        await logAdminAction(req.admin!.id, "settings_change", "gameplay_settings", "defaults", {
          newValue: `Created ${created.length} default settings`
        }, req);
      }

      const allSettings = await db.select().from(gameplaySettings).orderBy(gameplaySettings.key);
      res.json(allSettings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/gameplay-settings/:key", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { key } = req.params;
      const { value, description, descriptionAr } = req.body;

      const [existing] = await db.select().from(gameplaySettings).where(eq(gameplaySettings.key, key));

      if (!existing) {
        const [created] = await db.insert(gameplaySettings).values({
          key,
          value,
          description,
          descriptionAr,
          updatedBy: req.admin!.id
        }).returning();

        await logAdminAction(req.admin!.id, "settings_change", "gameplay_setting", created.id, {
          newValue: value
        }, req);

        return res.json(created);
      }

      const [updated] = await db.update(gameplaySettings)
        .set({ 
          value: value ?? existing.value,
          description: description ?? existing.description,
          descriptionAr: descriptionAr ?? existing.descriptionAr,
          updatedBy: req.admin!.id,
          updatedAt: new Date()
        })
        .where(eq(gameplaySettings.key, key))
        .returning();

      await logAdminAction(req.admin!.id, "settings_change", "gameplay_setting", updated.id, {
        previousValue: existing.value,
        newValue: value
      }, req);

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== GAMES MANAGEMENT ====================

  app.get("/api/admin/games", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const allGames = await db.select().from(games).orderBy(games.sortOrder, games.name);
      res.json(allGames);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/games", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { 
        name, description, imageUrl, thumbnailUrl, category, sections, gameType,
        status, volatility, minBet, maxBet, rtp, houseEdge, multiplierMin, multiplierMax,
        isFeatured, minPlayers, maxPlayers, sortOrder, isFreeToPlay, playPrice, pricingType
      } = req.body;

      const [existing] = await db.select().from(games).where(eq(games.name, name));
      if (existing) {
        return res.status(400).json({ error: "A game with this name already exists" });
      }

      const [newGame] = await db.insert(games).values({
        name,
        description,
        imageUrl,
        thumbnailUrl,
        category,
        sections: sections || ["play"],
        gameType: gameType || "single",
        status: status || "active",
        volatility: volatility || "medium",
        minBet: minBet || "1.00",
        maxBet: maxBet || "1000.00",
        rtp: rtp || "95.00",
        houseEdge: houseEdge || "5.00",
        multiplierMin: multiplierMin || "0.00",
        multiplierMax: multiplierMax || "100.00",
        isFeatured: isFeatured || false,
        minPlayers: minPlayers || 1,
        maxPlayers: maxPlayers || 1,
        sortOrder: sortOrder || 0,
        isFreeToPlay: isFreeToPlay || false,
        playPrice: playPrice || "0.00",
        pricingType: pricingType || "bet",
        createdBy: req.admin!.id,
      }).returning();

      await logAdminAction(req.admin!.id, "settings_change", "game", newGame.id, {
        newValue: JSON.stringify({ name, category, gameType, status })
      }, req);

      res.status(201).json(newGame);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/games/:id", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const [existing] = await db.select().from(games).where(eq(games.id, id));
      if (!existing) {
        return res.status(404).json({ error: "Game not found" });
      }

      if (updates.name && updates.name !== existing.name) {
        const [nameExists] = await db.select().from(games).where(eq(games.name, updates.name));
        if (nameExists) {
          return res.status(400).json({ error: "A game with this name already exists" });
        }
      }

      const [updated] = await db.update(games)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(games.id, id))
        .returning();

      await logAdminAction(req.admin!.id, "settings_change", "game", id, {
        previousValue: JSON.stringify({ name: existing.name, status: existing.status }),
        newValue: JSON.stringify({ name: updated.name, status: updated.status })
      }, req);

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/games/:id", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;

      const [existing] = await db.select().from(games).where(eq(games.id, id));
      if (!existing) {
        return res.status(404).json({ error: "Game not found" });
      }

      await db.delete(games).where(eq(games.id, id));

      await logAdminAction(req.admin!.id, "settings_change", "game", id, {
        previousValue: JSON.stringify({ name: existing.name }),
        reason: "Game deleted"
      }, req);

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== MULTIPLAYER GAMES MANAGEMENT ====================

  // List multiplayer games with optional filtering
  app.get("/api/admin/multiplayer-games", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { category, isActive, search } = req.query;
      
      let query = db.select().from(multiplayerGames);
      const conditions: any[] = [];
      
      // Note: multiplayerGames doesn't have a category field, filter by key instead
      if (category && category !== "all") {
        conditions.push(eq(multiplayerGames.key, String(category)));
      }
      if (isActive !== undefined && isActive !== "all") {
        conditions.push(eq(multiplayerGames.isActive, isActive === "true"));
      }
      if (search) {
        const searchTerm = `%${String(search).toLowerCase()}%`;
        conditions.push(
          or(
            like(sql`LOWER(${multiplayerGames.nameEn})`, searchTerm),
            like(sql`LOWER(${multiplayerGames.nameAr})`, searchTerm),
            like(sql`LOWER(${multiplayerGames.key})`, searchTerm)
          )
        );
      }
      
      const allGames = conditions.length > 0
        ? await db.select().from(multiplayerGames).where(and(...conditions)).orderBy(multiplayerGames.sortOrder)
        : await db.select().from(multiplayerGames).orderBy(multiplayerGames.sortOrder);
      
      res.json(allGames);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get single multiplayer game
  app.get("/api/admin/multiplayer-games/:id", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const [game] = await db.select().from(multiplayerGames).where(eq(multiplayerGames.id, id));
      if (!game) {
        return res.status(404).json({ error: "Multiplayer game not found" });
      }
      res.json(game);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create multiplayer game
  app.post("/api/admin/multiplayer-games", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const validatedData = insertMultiplayerGameSchema.parse(req.body);
      
      // Check for duplicate key
      const [existing] = await db.select().from(multiplayerGames).where(eq(multiplayerGames.key, validatedData.key));
      if (existing) {
        return res.status(400).json({ error: "A game with this key already exists" });
      }
      
      const [newGame] = await db.insert(multiplayerGames).values(validatedData).returning();
      
      await logAdminAction(req.admin!.id, "settings_change", "multiplayer_game", newGame.id, {
        newValue: JSON.stringify({ key: newGame.key, nameEn: newGame.nameEn })
      }, req);
      
      // Broadcast game config change
      broadcastSystemEvent({
        type: 'game_config_changed',
        data: { action: 'create', gameId: newGame.id, gameKey: newGame.key }
      });
      
      // Emit admin alert
      await emitGameChangeAlert({
        gameId: newGame.id,
        gameKey: newGame.key,
        gameName: newGame.nameEn,
        action: "activated",
        message: `New multiplayer game "${newGame.nameEn}" created by ${req.admin!.username}`
      });
      
      res.status(201).json(newGame);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Update multiplayer game with atomic financial field handling
  app.patch("/api/admin/multiplayer-games/:id", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const [existing] = await db.select().from(multiplayerGames).where(eq(multiplayerGames.id, id));
      if (!existing) {
        return res.status(404).json({ error: "Multiplayer game not found" });
      }
      
      // Check for duplicate key if changing
      if (updates.key && updates.key !== existing.key) {
        const [keyExists] = await db.select().from(multiplayerGames).where(eq(multiplayerGames.key, updates.key));
        if (keyExists) {
          return res.status(400).json({ error: "A game with this key already exists" });
        }
      }
      
      // Atomic update with transaction for financial fields
      const [updated] = await db.update(multiplayerGames)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(multiplayerGames.id, id))
        .returning();
      
      await logAdminAction(req.admin!.id, "settings_change", "multiplayer_game", id, {
        previousValue: JSON.stringify({ 
          nameEn: existing.nameEn, 
          isActive: existing.isActive,
          minStake: existing.minStake,
          maxStake: existing.maxStake
        }),
        newValue: JSON.stringify({ 
          nameEn: updated.nameEn, 
          isActive: updated.isActive,
          minStake: updated.minStake,
          maxStake: updated.maxStake
        })
      }, req);
      
      // Broadcast game config change
      broadcastSystemEvent({
        type: 'game_config_changed',
        data: { action: 'update', gameId: updated.id, gameKey: updated.key, changes: Object.keys(updates) }
      });
      
      // Emit admin alert for significant changes
      const significantChange = updates.isActive !== undefined || updates.minStake || updates.maxStake;
      if (significantChange) {
        const action = updates.isActive === false ? "deactivated" : updates.isActive === true ? "activated" : "updated";
        await emitGameChangeAlert({
          gameId: updated.id,
          gameKey: updated.key,
          gameName: updated.nameEn,
          action,
          message: `Multiplayer game "${updated.nameEn}" ${action} by ${req.admin!.username}. Changed: ${Object.keys(updates).join(", ")}`
        });
      }
      
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete multiplayer game
  app.delete("/api/admin/multiplayer-games/:id", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      const [existing] = await db.select().from(multiplayerGames).where(eq(multiplayerGames.id, id));
      if (!existing) {
        return res.status(404).json({ error: "Multiplayer game not found" });
      }
      
      await db.delete(multiplayerGames).where(eq(multiplayerGames.id, id));
      
      await logAdminAction(req.admin!.id, "settings_change", "multiplayer_game", id, {
        previousValue: JSON.stringify({ key: existing.key, nameEn: existing.nameEn }),
        reason: "Multiplayer game deleted"
      }, req);
      
      // Broadcast game config change
      broadcastSystemEvent({
        type: 'game_config_changed',
        data: { action: 'delete', gameId: id, gameKey: existing.key }
      });
      
      // Emit admin alert
      await emitGameChangeAlert({
        gameId: id,
        gameKey: existing.key,
        gameName: existing.nameEn,
        action: "deactivated",
        message: `Multiplayer game "${existing.nameEn}" deleted by ${req.admin!.username}`
      });
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== SOCIAL PLATFORMS MANAGEMENT ====================

  // Get all social platforms (admin)
  app.get("/api/admin/social-platforms", adminAuthMiddleware, async (_req: AdminRequest, res: Response) => {
    try {
      const platforms = await storage.listSocialPlatforms();
      res.json(platforms);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create social platform
  app.post("/api/admin/social-platforms", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const validatedData = insertSocialPlatformSchema.parse(req.body);
      const platform = await storage.createSocialPlatform(validatedData);
      
      await logAdminAction(req.admin!.id, "settings_change", "social_platform", platform.id, {
        newValue: JSON.stringify({ name: platform.name, displayName: platform.displayName })
      }, req);
      
      res.json(platform);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Update social platform
  app.patch("/api/admin/social-platforms/:id", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updateSchema = insertSocialPlatformSchema.partial();
      const validatedData = updateSchema.parse(req.body);
      
      const existing = await storage.getSocialPlatform(id);
      const platform = await storage.updateSocialPlatform(id, validatedData);
      if (!platform) {
        return res.status(404).json({ error: "Platform not found" });
      }
      
      await logAdminAction(req.admin!.id, "settings_change", "social_platform", id, {
        previousValue: existing ? JSON.stringify({ name: existing.name }) : undefined,
        newValue: JSON.stringify({ name: platform.name })
      }, req);
      
      res.json(platform);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Delete social platform
  app.delete("/api/admin/social-platforms/:id", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const existing = await storage.getSocialPlatform(id);
      
      await storage.deleteSocialPlatform(id);
      
      if (existing) {
        await logAdminAction(req.admin!.id, "settings_change", "social_platform", id, {
          previousValue: JSON.stringify({ name: existing.name }),
          reason: "Platform deleted"
        }, req);
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Toggle social platform enabled/disabled
  app.post("/api/admin/social-platforms/:id/toggle", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const platform = await storage.getSocialPlatform(id);
      if (!platform) {
        return res.status(404).json({ error: "Platform not found" });
      }
      const updated = await storage.updateSocialPlatform(id, { isEnabled: !platform.isEnabled });
      
      await logAdminAction(req.admin!.id, "settings_change", "social_platform", id, {
        previousValue: JSON.stringify({ isEnabled: platform.isEnabled }),
        newValue: JSON.stringify({ isEnabled: updated?.isEnabled })
      }, req);
      
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== ADMIN ALERTS (Real-time Admin Notifications) ====================

  // Get admin alerts with optional filtering
  app.get("/api/admin/alerts", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { unreadOnly, type, severity, limit } = req.query;
      const alerts = await storage.listAdminAlerts({
        unreadOnly: unreadOnly === 'true',
        type: type as string | undefined,
        severity: severity as string | undefined,
        limit: limit ? parseInt(limit as string) : 100,
      });
      res.json(alerts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get unread admin alert count
  app.get("/api/admin/alerts/count", adminAuthMiddleware, async (_req: AdminRequest, res: Response) => {
    try {
      const count = await storage.getUnreadAdminAlertCount();
      res.json({ count });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Mark single alert as read
  app.post("/api/admin/alerts/:id/read", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const alert = await storage.markAdminAlertAsRead(id, req.admin!.id);
      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }
      res.json(alert);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Mark all alerts as read
  app.post("/api/admin/alerts/read-all", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const count = await storage.markAllAdminAlertsAsRead(req.admin!.id);
      res.json({ success: true, count });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete an alert
  app.delete("/api/admin/alerts/:id", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteAdminAlert(id);
      if (!success) {
        return res.status(404).json({ error: "Alert not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== P2P SETTINGS ====================

  // Get P2P settings
  app.get("/api/admin/p2p/settings", adminAuthMiddleware, async (_req: AdminRequest, res: Response) => {
    try {
      const [settings] = await db.select().from(p2pSettings).limit(1);
      if (!settings) {
        // Create default settings if none exist
        const [newSettings] = await db.insert(p2pSettings).values({}).returning();
        return res.json(newSettings);
      }
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update P2P settings
  const updateP2pSettingsSchema = z.object({
    feeType: z.enum(["percentage", "fixed", "hybrid"]).optional(),
    platformFeePercentage: z.string().optional(),
    platformFeeFixed: z.string().optional(),
    minFee: z.string().optional(),
    maxFee: z.string().nullable().optional(),
    minTradeAmount: z.string().optional(),
    maxTradeAmount: z.string().optional(),
    escrowTimeoutHours: z.number().int().positive().optional(),
    paymentTimeoutMinutes: z.number().int().positive().optional(),
    autoExpireEnabled: z.boolean().optional(),
    isEnabled: z.boolean().optional(),
  });

  app.put("/api/admin/p2p/settings", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const data = updateP2pSettingsSchema.parse(req.body);
      
      // Get current settings or create if not exists
      let [existing] = await db.select().from(p2pSettings).limit(1);
      if (!existing) {
        [existing] = await db.insert(p2pSettings).values({}).returning();
      }
      
      const previousValue = JSON.stringify(existing);
      
      // Update settings
      const [updated] = await db.update(p2pSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(p2pSettings.id, existing.id))
        .returning();
      
      // Log admin action
      await logAdminAction(
        req.admin!.id,
        "update",
        "p2p_settings",
        existing.id,
        { previousValue, newValue: JSON.stringify(updated) },
        req
      );
      
      // Broadcast settings change
      broadcastSystemEvent({
        type: "p2p_settings_changed",
        data: updated,
      });
      
      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Calculate P2P fee for a given amount (utility endpoint)
  app.post("/api/admin/p2p/calculate-fee", adminAuthMiddleware, async (req: Request, res: Response) => {
    try {
      const { amount } = req.body;
      if (!amount || isNaN(parseFloat(amount))) {
        return res.status(400).json({ error: "Valid amount required" });
      }
      
      const [settings] = await db.select().from(p2pSettings).limit(1);
      if (!settings) {
        return res.json({ fee: "0.00", feeType: "none" });
      }
      
      const tradeAmount = parseFloat(amount);
      let fee = 0;
      
      switch (settings.feeType) {
        case "percentage":
          fee = tradeAmount * parseFloat(settings.platformFeePercentage);
          break;
        case "fixed":
          fee = parseFloat(settings.platformFeeFixed);
          break;
        case "hybrid":
          // Percentage + fixed
          fee = (tradeAmount * parseFloat(settings.platformFeePercentage)) + parseFloat(settings.platformFeeFixed);
          break;
      }
      
      // Apply min/max bounds
      const minFee = parseFloat(settings.minFee);
      const maxFee = settings.maxFee ? parseFloat(settings.maxFee) : null;
      
      if (fee < minFee) fee = minFee;
      if (maxFee !== null && fee > maxFee) fee = maxFee;
      
      res.json({ 
        fee: fee.toFixed(2), 
        feeType: settings.feeType,
        breakdown: {
          percentageFee: (tradeAmount * parseFloat(settings.platformFeePercentage)).toFixed(2),
          fixedFee: settings.platformFeeFixed,
          minFee: settings.minFee,
          maxFee: settings.maxFee,
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // P2P Analytics - Revenue summary
  app.get("/api/admin/p2p/analytics", adminAuthMiddleware, async (_req: AdminRequest, res: Response) => {
    try {
      // Get total completed trades and fees collected
      const completedTrades = await db.select({
        totalTrades: sql<number>`count(*)`,
        totalVolume: sql<string>`coalesce(sum(cast(${p2pTrades.fiatAmount} as decimal)), 0)`,
        totalFees: sql<string>`coalesce(sum(cast(${p2pTrades.platformFee} as decimal)), 0)`,
      })
      .from(p2pTrades)
      .where(eq(p2pTrades.status, "completed"));
      
      // Get trades by status
      const tradesByStatus = await db.select({
        status: p2pTrades.status,
        count: sql<number>`count(*)`,
      })
      .from(p2pTrades)
      .groupBy(p2pTrades.status);
      
      // Get recent 30-day stats
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentStats = await db.select({
        totalTrades: sql<number>`count(*)`,
        totalVolume: sql<string>`coalesce(sum(cast(${p2pTrades.fiatAmount} as decimal)), 0)`,
        totalFees: sql<string>`coalesce(sum(cast(${p2pTrades.platformFee} as decimal)), 0)`,
      })
      .from(p2pTrades)
      .where(and(
        eq(p2pTrades.status, "completed"),
        gte(p2pTrades.completedAt, thirtyDaysAgo)
      ));
      
      res.json({
        allTime: completedTrades[0],
        last30Days: recentStats[0],
        byStatus: tradesByStatus,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get expired trades (for auto-cancel processing)
  app.get("/api/admin/p2p/expired-trades", adminAuthMiddleware, async (_req: AdminRequest, res: Response) => {
    try {
      const now = new Date();
      const expiredTrades = await db.select()
        .from(p2pTrades)
        .where(and(
          or(eq(p2pTrades.status, "pending"), eq(p2pTrades.status, "paid")),
          lte(p2pTrades.expiresAt, now)
        ))
        .orderBy(desc(p2pTrades.expiresAt));
      
      res.json(expiredTrades);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Auto-cancel expired trade
  app.post("/api/admin/p2p/trades/:id/auto-cancel", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      // Get trade
      const [trade] = await db.select().from(p2pTrades).where(eq(p2pTrades.id, id));
      if (!trade) {
        return res.status(404).json({ error: "Trade not found" });
      }
      
      // Check if trade is actually expired
      if (!trade.expiresAt || new Date(trade.expiresAt) > new Date()) {
        return res.status(400).json({ error: "Trade has not expired" });
      }
      
      if (trade.status !== "pending" && trade.status !== "paid") {
        return res.status(400).json({ error: "Trade cannot be cancelled" });
      }
      
      // Use atomic cancel operation
      const result = await storage.cancelP2PTradeAtomic(id, trade.sellerId, "Trade expired - auto-cancelled");
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      // Log admin action
      await logAdminAction(
        req.admin!.id,
        "auto_cancel",
        "p2p_trade",
        id,
        { reason: "Trade expired - auto-cancelled" },
        req
      );
      
      // Add transaction log
      await db.insert(p2pTransactionLogs).values({
        tradeId: id,
        action: "trade_cancelled",
        userId: req.admin!.id,
        description: "Trade expired - auto-cancelled by system",
        metadata: JSON.stringify({ reason: "auto_expire", cancelledBy: "system" }),
      });
      
      res.json({ success: true, trade: result.trade });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== PROJECT CURRENCY MANAGEMENT ====================

  app.get("/api/admin/project-currency/settings", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      let settings = await storage.getProjectCurrencySettings();
      if (!settings) {
        settings = await storage.updateProjectCurrencySettings({
          currencyName: "VEX Coin",
          currencySymbol: "VXC",
          exchangeRate: "1.00",
        });
      }
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/project-currency/settings", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const data = req.body;
      const previousSettings = await storage.getProjectCurrencySettings();
      
      const updated = await storage.updateProjectCurrencySettings(data);

      await logAdminAction(
        req.admin!.id,
        "update",
        "project_currency_settings",
        updated.id,
        { 
          previousValue: JSON.stringify(previousSettings), 
          newValue: JSON.stringify(updated) 
        },
        req
      );

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/project-currency/conversions", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { status, limit } = req.query;
      const conversions = await storage.listProjectCurrencyConversions({
        status: status as string | undefined,
        limit: limit ? parseInt(limit as string) : 100,
      });

      const conversionsWithUsers = await Promise.all(
        conversions.map(async (conv) => {
          const user = await storage.getUser(conv.userId);
          const approver = conv.approvedById ? await storage.getUser(conv.approvedById) : null;
          return {
            ...conv,
            user: user ? { id: user.id, username: user.username, displayName: user.displayName } : null,
            approver: approver ? { id: approver.id, username: approver.username } : null,
          };
        })
      );

      res.json(conversionsWithUsers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/project-currency/conversions/:id/approve", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const result = await storage.approveProjectCurrencyConversion(id, req.admin!.id);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      await logAdminAction(
        req.admin!.id,
        "approve",
        "project_currency_conversion",
        id,
        { reason: "Conversion approved" },
        req
      );

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/project-currency/conversions/:id/reject", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      const result = await storage.rejectProjectCurrencyConversion(id, req.admin!.id, reason || "Rejected by admin");

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      await logAdminAction(
        req.admin!.id,
        "reject",
        "project_currency_conversion",
        id,
        { reason: reason || "Rejected by admin" },
        req
      );

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/project-currency/stats", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const [totalWallets] = await db.execute(sql`
        SELECT COUNT(*) as count FROM project_currency_wallets
      `);
      
      const [totalConverted] = await db.execute(sql`
        SELECT COALESCE(SUM(CAST(net_amount AS DECIMAL)), 0) as total
        FROM project_currency_conversions
        WHERE status = 'completed'
      `);
      
      const [pendingConversions] = await db.execute(sql`
        SELECT COUNT(*) as count FROM project_currency_conversions
        WHERE status = 'pending'
      `);
      
      const [totalCirculating] = await db.execute(sql`
        SELECT COALESCE(SUM(CAST(total_balance AS DECIMAL)), 0) as total
        FROM project_currency_wallets
      `);

      const dailyTotal = await storage.getPlatformDailyConversionTotal();

      res.json({
        totalWallets: Number((totalWallets as any)?.count || 0),
        totalConverted: (totalConverted as any)?.total?.toString() || "0",
        pendingConversions: Number((pendingConversions as any)?.count || 0),
        totalCirculating: (totalCirculating as any)?.total?.toString() || "0",
        dailyConversionTotal: dailyTotal,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/project-currency/ledger", adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const { userId, type, limit, offset } = req.query;
      const entries = await storage.getProjectCurrencyLedger({
        userId: userId as string | undefined,
        type: type as string | undefined,
        limit: limit ? parseInt(limit as string) : 100,
        offset: offset ? parseInt(offset as string) : 0,
      });

      const entriesWithUsers = await Promise.all(
        entries.map(async (entry) => {
          const user = await storage.getUser(entry.userId);
          return {
            ...entry,
            user: user ? { id: user.id, username: user.username, displayName: user.displayName } : null,
          };
        })
      );

      res.json(entriesWithUsers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
