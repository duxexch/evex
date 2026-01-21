import type { Express, Response } from "express";
import jwt from "jsonwebtoken";
import { storage } from "../storage";
import { db } from "../db";
import { authMiddleware, type AuthRequest } from "./middleware";
import { adminSessions, users, adminAuditLogs, userTwoFactorAuth } from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const JWT_ADMIN_SECRET = process.env.JWT_ADMIN_SECRET || "admin-secret-key-change-in-prod";
const SESSION_TIMEOUT_MS = 28800000; // 8 hours
const MAX_CONCURRENT_SESSIONS = 2;

// TOTP verification helper
async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash).catch(() => false);
}

function verifyTotp(token: string, secret: string): boolean {
  // Placeholder - in production use speakeasy or similar
  // For now, accept any 6-digit token as valid
  return /^\d{6}$/.test(token);
}

function generateTotpSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}

async function createAdminAuditLog(log: {
  adminId: string;
  action: string;
  entityType: string;
  entityId?: string;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    await storage.createAdminAuditLog({
      adminId: log.adminId,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      reason: log.reason,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}

export async function registerAdminAuthRoutes(app: Express): Promise<void> {
  // Admin Login
  app.post("/api/admin/login", async (req: AuthRequest, res: Response) => {
    try {
      const { username, password, totpToken } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }

      const adminUser = await storage.getUserByUsername(username);
      if (!adminUser || adminUser.role !== "admin") {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const passwordValid = await verifyPassword(password, adminUser.password);
      if (!passwordValid) {
        await createAdminAuditLog({
          adminId: adminUser.id,
          action: "login",
          entityType: "admin_session",
          reason: "Invalid password",
          ipAddress: req.ip || "",
          userAgent: req.get("user-agent") || "",
        });
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Check 2FA requirement
      const twoFa = await storage.getUserTwoFactorAuth(adminUser.id);
      if (twoFa?.isEnabled && !totpToken) {
        return res.status(401).json({
          error: "2FA required",
          require2fa: true,
        });
      }

      if (twoFa?.isEnabled && totpToken) {
        const totpValid = verifyTotp(totpToken, twoFa.secret || "");
        if (!totpValid) {
          await createAdminAuditLog({
            adminId: adminUser.id,
            action: "login",
            entityType: "admin_session",
            reason: "Invalid TOTP",
            ipAddress: req.ip || "",
            userAgent: req.get("user-agent") || "",
          });
          return res.status(401).json({ error: "Invalid TOTP token" });
        }
      }

      // Check concurrent sessions
      const activeSessions = await storage.getActiveAdminSessions(adminUser.id);
      if (activeSessions.length >= MAX_CONCURRENT_SESSIONS) {
        return res.status(429).json({ error: "Maximum sessions reached" });
      }

      // Create session
      const sessionId = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + SESSION_TIMEOUT_MS);

      const session = await storage.createAdminSession({
        id: sessionId,
        adminId: adminUser.id,
        token: sessionId,
        expiresAt,
        lastActivity: new Date(),
        ipAddress: req.ip || "",
        userAgent: req.get("user-agent") || "",
        logoutAt: null,
        revokedAt: null,
        createdAt: new Date(),
      });

      const token = jwt.sign(
        { adminId: adminUser.id, sessionId, role: "admin" },
        JWT_ADMIN_SECRET,
        { expiresIn: "8h" }
      );

      await createAdminAuditLog({
        adminId: adminUser.id,
        action: "login",
        entityType: "admin_session",
        entityId: sessionId,
        ipAddress: req.ip || "",
        userAgent: req.get("user-agent") || "",
      });

      res.json({ token, sessionId, expiresAt });
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admin Logout
  app.post("/api/admin/logout", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const adminId = req.user?.id;
      const sessionId = (req as any).sessionId;

      if (!adminId || !sessionId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      await storage.revokeAdminSession(sessionId);

      await createAdminAuditLog({
        adminId,
        action: "logout",
        entityType: "admin_session",
        entityId: sessionId,
        ipAddress: req.ip || "",
        userAgent: req.get("user-agent") || "",
      });

      res.json({ message: "Logged out successfully" });
    } catch (error) {
      console.error("Admin logout error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get Session Info
  app.get("/api/admin/session", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const sessionId = (req as any).sessionId;
      if (!sessionId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const session = await storage.getAdminSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: "Session not found" });
      }

      const remainingMs = session.expiresAt.getTime() - Date.now();
      res.json({
        sessionId,
        expiresAt: session.expiresAt,
        remainingMs: Math.max(0, remainingMs),
        lastActivity: session.lastActivity,
      });
    } catch (error) {
      console.error("Get session error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get Active Sessions
  app.get("/api/admin/sessions", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const sessions = await storage.getActiveAdminSessions(adminId);
      res.json(sessions.map(s => ({
        id: s.id,
        createdAt: s.createdAt,
        lastActivity: s.lastActivity,
        expiresAt: s.expiresAt,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
      })));
    } catch (error) {
      console.error("Get sessions error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Enable 2FA
  app.post("/api/admin/2fa/enable", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const secret = generateTotpSecret();
      const backupCodes = Array.from({ length: 10 }, () =>
        crypto.randomBytes(4).toString("hex")
      );

      const existing = await storage.getUserTwoFactorAuth(adminId);
      if (existing?.isEnabled) {
        return res.status(400).json({ error: "2FA already enabled" });
      }

      if (existing) {
        await storage.updateUserTwoFactorAuth(adminId, {
          secret,
          backupCodes: JSON.stringify(backupCodes),
          isEnabled: false,
          updatedAt: new Date(),
        });
      } else {
        await storage.createUserTwoFactorAuth({
          id: crypto.randomBytes(16).toString("hex"),
          userId: adminId,
          secret,
          method: "totp",
          backupCodes: JSON.stringify(backupCodes),
          isEnabled: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      res.json({ secret, backupCodes, message: "Scan QR code and confirm with TOTP token" });
    } catch (error) {
      console.error("Enable 2FA error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Confirm 2FA
  app.post("/api/admin/2fa/confirm", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const adminId = req.user?.id;
      const { totpToken } = req.body;

      if (!adminId || !totpToken) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const twoFa = await storage.getUserTwoFactorAuth(adminId);
      if (!twoFa || twoFa.isEnabled) {
        return res.status(400).json({ error: "2FA setup not in progress" });
      }

      const valid = verifyTotp(totpToken, twoFa.secret || "");
      if (!valid) {
        return res.status(401).json({ error: "Invalid TOTP token" });
      }

      await storage.updateUserTwoFactorAuth(adminId, {
        isEnabled: true,
        updatedAt: new Date(),
      });

      await createAdminAuditLog({
        adminId,
        action: "settings_update",
        entityType: "admin_security",
        reason: "2FA enabled",
        ipAddress: req.ip || "",
        userAgent: req.get("user-agent") || "",
      });

      res.json({ message: "2FA enabled successfully" });
    } catch (error) {
      console.error("Confirm 2FA error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Disable 2FA
  app.post("/api/admin/2fa/disable", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const adminId = req.user?.id;
      const { password } = req.body;

      if (!adminId || !password) {
        return res.status(400).json({ error: "Password required" });
      }

      const user = await storage.getUser(adminId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      const passwordValid = await verifyPassword(password, user.password);
      if (!passwordValid) {
        return res.status(401).json({ error: "Invalid password" });
      }

      await storage.deleteTwoFactorAuth(adminId);

      await createAdminAuditLog({
        adminId,
        action: "settings_update",
        entityType: "admin_security",
        reason: "2FA disabled",
        ipAddress: req.ip || "",
        userAgent: req.get("user-agent") || "",
      });

      res.json({ message: "2FA disabled" });
    } catch (error) {
      console.error("Disable 2FA error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Logout all other sessions
  app.post("/api/admin/sessions/logout-others", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const adminId = req.user?.id;
      const sessionId = (req as any).sessionId;

      if (!adminId || !sessionId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      await storage.revokeAllAdminSessions(adminId, sessionId);

      await createAdminAuditLog({
        adminId,
        action: "logout",
        entityType: "admin_session",
        reason: "Logged out all other sessions",
        ipAddress: req.ip || "",
        userAgent: req.get("user-agent") || "",
      });

      res.json({ message: "All other sessions logged out" });
    } catch (error) {
      console.error("Logout others error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
