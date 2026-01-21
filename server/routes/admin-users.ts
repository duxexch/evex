import type { Express, Response } from "express";
import { storage } from "../storage";
import { authMiddleware, type AuthRequest } from "./middleware";
import { users, type User } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

async function createAdminAuditLog(log: {
  adminId: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    await storage.createAdminAuditLog(log);
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}

export async function registerAdminUsersRoutes(app: Express): Promise<void> {
  // List users with filtering
  app.get("/api/admin/users", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { role, status, search } = req.query as Record<string, string>;
      const adminId = req.user?.id;

      if (!adminId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      let userList = await storage.listUsers();

      if (role) userList = userList.filter((u: User) => u.role === role);
      if (status) userList = userList.filter((u: User) => u.status === status);
      if (search) {
        const q = search.toLowerCase();
        userList = userList.filter((u: User) =>
          u.username?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.nickname?.toLowerCase().includes(q)
        );
      }

      res.json(userList.map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        status: u.status,
        role: u.role,
        vipLevel: u.vipLevel,
        createdAt: u.createdAt,
      })));
    } catch (error) {
      console.error("List users error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get user details
  app.get("/api/admin/users/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const adminId = req.user?.id;

      if (!adminId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const warnings = await storage.getUserWarnings(id);
      const bans = await storage.getUserBanHistory(id);
      const suspensions = await storage.getUserSuspensionHistory(id);

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        status: user.status,
        vipLevel: user.vipLevel,
        balance: user.balance,
        createdAt: user.createdAt,
        warnings: warnings.length,
        bans: bans.map((b: any) => ({
          id: b.id,
          status: b.status,
          reason: b.reason,
          bannedAt: b.createdAt,
          expiresAt: b.expiresAt,
        })),
        suspensions: suspensions.map((s: any) => ({
          id: s.id,
          status: s.status,
          reason: s.reason,
          suspendedAt: s.createdAt,
          expiresAt: s.expiresAt,
        })),
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Ban user
  app.post("/api/admin/users/:id/ban", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { reason, duration } = req.body;
      const adminId = req.user?.id;

      if (!adminId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (user.role === "admin") {
        return res.status(400).json({ error: "Cannot ban admin users" });
      }

      const expiresAt = duration ? new Date(Date.now() + duration * 86400000) : null;

      const ban = await storage.createUserBanHistory({
        id: crypto.randomBytes(16).toString("hex"),
        userId: id,
        reason: reason || "No reason provided",
        bannedBy: adminId,
        status: "active",
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await storage.updateUser(id, { status: "banned" as any });

      await createAdminAuditLog({
        adminId,
        action: "user_ban",
        entityType: "user",
        entityId: id,
        newValue: { reason, duration },
        ipAddress: req.ip || "",
        userAgent: req.get("user-agent") || "",
      });

      res.json({ message: "User banned", ban });
    } catch (error) {
      console.error("Ban user error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Suspend user
  app.post("/api/admin/users/:id/suspend", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { reason, hours } = req.body;
      const adminId = req.user?.id;

      if (!adminId || !hours) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const expiresAt = new Date(Date.now() + hours * 3600000);

      const suspension = await storage.createUserSuspensionHistory({
        id: crypto.randomBytes(16).toString("hex"),
        userId: id,
        reason: reason || "No reason provided",
        suspendedBy: adminId,
        status: "active",
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await storage.updateUser(id, { status: "suspended" as any });

      await createAdminAuditLog({
        adminId,
        action: "user_suspend",
        entityType: "user",
        entityId: id,
        newValue: { reason, hours },
        ipAddress: req.ip || "",
        userAgent: req.get("user-agent") || "",
      });

      res.json({ message: "User suspended", suspension });
    } catch (error) {
      console.error("Suspend user error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Unban user
  app.post("/api/admin/users/:id/unban", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const adminId = req.user?.id;

      if (!adminId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const activeBan = await storage.getActiveUserBan(id);
      if (activeBan) {
        await storage.updateUserBanHistory(activeBan.id, {
          status: "lifted",
          updatedAt: new Date(),
        });
      }

      await storage.updateUser(id, { status: "active" as any });

      await createAdminAuditLog({
        adminId,
        action: "user_unban",
        entityType: "user",
        entityId: id,
        ipAddress: req.ip || "",
        userAgent: req.get("user-agent") || "",
      });

      res.json({ message: "User unbanned" });
    } catch (error) {
      console.error("Unban user error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Issue warning
  app.post("/api/admin/users/:id/warnings", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminId = req.user?.id;

      if (!adminId || !reason) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const warning = await storage.createUserWarning({
        id: crypto.randomBytes(16).toString("hex"),
        userId: id,
        reason,
        issuedBy: adminId,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const warningCount = await storage.getUserWarningCount(id);

      // Auto-suspend at 3 warnings
      if (warningCount >= 3) {
        const suspension = await storage.createUserSuspensionHistory({
          id: crypto.randomBytes(16).toString("hex"),
          userId: id,
          reason: "Automatic suspension due to 3 warnings",
          suspendedBy: "system",
          status: "active",
          expiresAt: new Date(Date.now() + 24 * 3600000), // 24 hours
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await storage.updateUser(id, { status: "suspended" as any });
      }

      await createAdminAuditLog({
        adminId,
        action: "user_warning",
        entityType: "user",
        entityId: id,
        newValue: { reason, warningCount },
        ipAddress: req.ip || "",
        userAgent: req.get("user-agent") || "",
      });

      res.json({
        message: "Warning issued",
        warning,
        warningCount,
        autoSuspended: warningCount >= 3,
      });
    } catch (error) {
      console.error("Issue warning error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Verify ID
  app.post("/api/admin/users/:id/verify-id", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const adminId = req.user?.id;

      if (!adminId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      await storage.updateUser(id, {
        idVerificationStatus: "approved" as any,
        idVerifiedAt: new Date() as any,
      });

      await createAdminAuditLog({
        adminId,
        action: "id_verified",
        entityType: "user",
        entityId: id,
        ipAddress: req.ip || "",
        userAgent: req.get("user-agent") || "",
      });

      res.json({ message: "User ID verified" });
    } catch (error) {
      console.error("Verify ID error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Reject ID verification
  app.post("/api/admin/users/:id/reject-id", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminId = req.user?.id;

      if (!adminId || !reason) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      await storage.updateUser(id, {
        idVerificationStatus: "rejected" as any,
      });

      await createAdminAuditLog({
        adminId,
        action: "id_rejected",
        entityType: "user",
        entityId: id,
        newValue: { reason },
        ipAddress: req.ip || "",
        userAgent: req.get("user-agent") || "",
      });

      res.json({ message: "ID verification rejected" });
    } catch (error) {
      console.error("Reject ID error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Set VIP level
  app.post("/api/admin/users/:id/vip-level", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { vipLevel } = req.body;
      const adminId = req.user?.id;

      if (!adminId || vipLevel === undefined || vipLevel < 0 || vipLevel > 10) {
        return res.status(400).json({ error: "Invalid VIP level (0-10)" });
      }

      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const oldLevel = user.vipLevel || 0;
      await storage.updateUser(id, { vipLevel });

      await createAdminAuditLog({
        adminId,
        action: "vip_level_set",
        entityType: "user",
        entityId: id,
        oldValue: { vipLevel: oldLevel },
        newValue: { vipLevel },
        ipAddress: req.ip || "",
        userAgent: req.get("user-agent") || "",
      });

      res.json({ message: "VIP level updated", vipLevel });
    } catch (error) {
      console.error("Set VIP level error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Adjust balance
  app.post("/api/admin/users/:id/adjust-balance", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { amount, reason } = req.body;
      const adminId = req.user?.id;

      if (!adminId || !amount || !reason) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const oldBalance = user.balance;
      const numAmount = parseFloat(amount);
      const newBalance = (parseFloat(user.balance) + numAmount).toString();

      await storage.updateUser(id, { balance: newBalance as any });

      await createAdminAuditLog({
        adminId,
        action: "balance_adjusted",
        entityType: "user",
        entityId: id,
        oldValue: { balance: oldBalance, reason },
        newValue: { balance: newBalance, reason },
        ipAddress: req.ip || "",
        userAgent: req.get("user-agent") || "",
      });

      res.json({
        message: "Balance adjusted",
        oldBalance,
        newBalance,
        adjustment: numAmount,
      });
    } catch (error) {
      console.error("Adjust balance error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get user audit log
  app.get("/api/admin/users/:id/audit-log", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const adminId = req.user?.id;

      if (!adminId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const logs = await storage.getAuditLogs(id);

      res.json(logs.map((log: any) => ({
        id: log.id,
        action: log.action,
        description: log.description,
        createdAt: log.createdAt,
      })));
    } catch (error) {
      console.error("Get audit log error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
