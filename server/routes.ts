import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import { z } from "zod";
import { 
  insertUserSchema, insertGameSchema, insertTransactionSchema, 
  insertComplaintSchema, insertPromoCodeSchema, insertAgentSchema,
  insertAffiliateSchema, insertComplaintMessageSchema, insertAgentPaymentMethodSchema,
  insertAuditLogSchema, insertFinancialLimitSchema,
  insertAnnouncementSchema, insertUserPreferencesSchema, notifications,
  chatMessages, chatSettings, users, matchmakingQueue, gameMatches, games, gameplaySettings,
  gameplayEmojis, gameplayMessages, gameSections, advertisements,
  insertGameSectionSchema, insertAdvertisementSchema,
  insertCountryPaymentMethodSchema, insertSocialPlatformSchema
} from "@shared/schema";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { setupWebSocket, sendNotification } from "./websocket";
import { db, pool } from "./db";
import { eq, desc, and, or, sql } from "drizzle-orm";

// Security: JWT_SECRET must be set in production
const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('CRITICAL: SESSION_SECRET environment variable must be set in production!');
}
const JWT_SIGNING_KEY = JWT_SECRET || 'dev-only-insecure-key';

// Rate limiting for authentication endpoints (brute-force protection)
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: { error: "Too many login attempts, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed login attempts
});

// Rate limiter for registration (counts all attempts including successful)
const registrationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 registrations per window
  message: { error: "Too many registration attempts, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count ALL requests including successful
});

const strictRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 attempts per hour
  message: { error: "Too many attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiter for all endpoints - optimized for 20k users
const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // 200 requests per minute per IP (increased for high traffic)
  message: { error: "Too many requests, please slow down" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/api/health" || req.path === "/api/health/detailed",
});

// Sensitive operations rate limiter (withdrawals, password changes)
const sensitiveRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  message: { error: "Too many sensitive operation attempts" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Aggressive rate limiter for suspected attacks (DDoS protection)
// Set high to avoid blocking legitimate NAT/CDN users
const attackProtectionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5000, // 5000 requests per minute absolute max (allows for NAT/CDN)
  message: { error: "Rate limit exceeded. Your IP has been flagged." },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`[SECURITY] Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({ error: "Too many requests. Please wait before retrying." });
  },
});

// Auth middleware
interface AuthRequest extends Request {
  user?: { id: string; role: string; username: string };
}

const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const decoded = jwt.verify(token, JWT_SIGNING_KEY) as any;
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
};

const adminMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

const agentMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== "agent" && req.user?.role !== "admin") {
    return res.status(403).json({ error: "Agent access required" });
  }
  next();
};

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  
  // Apply DDoS protection first (absolute limit)
  app.use("/api", attackProtectionLimiter);
  
  // Apply general API rate limiter to all API routes
  app.use("/api", apiRateLimiter);
  
  // ==================== HEALTH CHECK ====================
  
  app.get("/api/health", async (req: Request, res: Response) => {
    try {
      // Check database connection
      const dbStart = Date.now();
      await db.execute(sql`SELECT 1`);
      const dbLatency = Date.now() - dbStart;
      
      res.json({ 
        status: "healthy", 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development",
        database: {
          status: "connected",
          latencyMs: dbLatency,
        },
        version: "1.0.0",
        uptime: process.uptime(),
        memory: {
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        },
      });
    } catch (error: any) {
      res.status(503).json({ 
        status: "unhealthy", 
        timestamp: new Date().toISOString(),
        database: {
          status: "disconnected",
          error: error.message,
        }
      });
    }
  });
  
  // Detailed health check for monitoring (admin only in production)
  app.get("/api/health/detailed", async (req: Request, res: Response) => {
    try {
      const dbStart = Date.now();
      await db.execute(sql`SELECT count(*) as count FROM users`);
      const dbLatency = Date.now() - dbStart;
      
      const poolStats = pool.totalCount !== undefined ? {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      } : null;
      
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development",
        version: "1.0.0",
        uptime: process.uptime(),
        database: {
          status: "connected",
          latencyMs: dbLatency,
          pool: poolStats,
        },
        memory: {
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
          external: Math.round(process.memoryUsage().external / 1024 / 1024),
        },
        cpu: process.cpuUsage(),
        nodeVersion: process.version,
      });
    } catch (error: any) {
      res.status(503).json({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error.message,
      });
    }
  });
  
  // ==================== AUTH ROUTES ====================
  
  // One-click registration - generates account ID and password automatically
  app.post("/api/auth/one-click-register", registrationRateLimiter, async (req: Request, res: Response) => {
    try {
      const accountId = await storage.generateUniqueAccountId();
      const plainPassword = crypto.randomBytes(8).toString("hex");
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      
      const user = await storage.createUser({
        accountId,
        username: accountId,
        password: hashedPassword,
        role: "player",
        status: "active",
      });
      
      const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_SIGNING_KEY, { expiresIn: "7d" });
      
      await storage.createAuditLog({
        userId: user.id,
        action: "login",
        entityType: "user",
        entityId: user.id,
        details: "One-click registration",
        ipAddress: req.ip,
      });
      
      res.json({ 
        user: { ...user, password: undefined }, 
        token,
        credentials: {
          accountId,
          password: plainPassword,
        },
        message: "Save your login credentials! You will need them to access your account."
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post("/api/auth/register", registrationRateLimiter, async (req: Request, res: Response) => {
    try {
      const { username, password, email, firstName, lastName, referralCode } = req.body;
      
      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(400).json({ error: "Username already exists" });
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      let referredBy = null;
      
      if (referralCode) {
        const affiliate = await storage.getAffiliateByCode(referralCode);
        if (affiliate) {
          referredBy = affiliate.userId;
          await storage.updateAffiliate(affiliate.id, {
            totalReferrals: affiliate.totalReferrals + 1,
            totalRegistrations: affiliate.totalRegistrations + 1,
          });
        }
      }
      
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        email,
        firstName,
        lastName,
        referredBy,
        role: "player",
        status: "active",
      });
      
      const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_SIGNING_KEY, { expiresIn: "7d" });
      
      await storage.createAuditLog({
        userId: user.id,
        action: "login",
        entityType: "user",
        entityId: user.id,
        details: "User registered",
      });
      
      res.json({ user: { ...user, password: undefined }, token });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post("/api/auth/login", authRateLimiter, async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      if (user.status !== "active") {
        return res.status(403).json({ error: "Account is not active" });
      }
      
      await storage.updateUser(user.id, { lastLoginAt: new Date() });
      
      const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_SIGNING_KEY, { expiresIn: "7d" });
      
      await storage.createAuditLog({
        userId: user.id,
        action: "login",
        entityType: "user",
        entityId: user.id,
        details: "User logged in",
        ipAddress: req.ip,
      });
      
      res.json({ user: { ...user, password: undefined }, token });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get("/api/auth/me", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const userData = { ...user, password: undefined };
      const etag = `"user-${user.id}-${user.updatedAt?.getTime() || Date.now()}"`;
      const lastModified = user.updatedAt?.toUTCString() || new Date().toUTCString();
      
      res.setHeader("ETag", etag);
      res.setHeader("Last-Modified", lastModified);
      res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=300");
      
      const clientEtag = req.headers["if-none-match"];
      if (clientEtag === etag) {
        return res.status(304).end();
      }
      
      res.json(userData);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Login by account ID (one-click generated users)
  app.post("/api/auth/login-by-account", authRateLimiter, async (req: Request, res: Response) => {
    try {
      const { accountId, password } = req.body;
      
      const user = await storage.getUserByAccountId(accountId);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      if (user.status !== "active") {
        return res.status(403).json({ error: "Account is not active" });
      }
      
      await storage.updateUser(user.id, { lastLoginAt: new Date() });
      
      const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_SIGNING_KEY, { expiresIn: "7d" });
      
      await storage.createAuditLog({
        userId: user.id,
        action: "login",
        entityType: "user",
        entityId: user.id,
        details: "Login by account ID",
        ipAddress: req.ip,
      });
      
      res.json({ user: { ...user, password: undefined }, token });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Login by phone number
  app.post("/api/auth/login-by-phone", authRateLimiter, async (req: Request, res: Response) => {
    try {
      const { phone, password } = req.body;
      
      const user = await storage.getUserByPhone(phone);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      if (user.status !== "active") {
        return res.status(403).json({ error: "Account is not active" });
      }
      
      await storage.updateUser(user.id, { lastLoginAt: new Date() });
      
      const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_SIGNING_KEY, { expiresIn: "7d" });
      
      await storage.createAuditLog({
        userId: user.id,
        action: "login",
        entityType: "user",
        entityId: user.id,
        details: "Login by phone",
        ipAddress: req.ip,
      });
      
      res.json({ user: { ...user, password: undefined }, token });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Request password reset
  app.post("/api/auth/forgot-password", strictRateLimiter, async (req: Request, res: Response) => {
    try {
      const { email, phone, accountId } = req.body;
      
      let user;
      if (email) {
        user = await storage.getUserByEmail(email);
      } else if (phone) {
        user = await storage.getUserByPhone(phone);
      } else if (accountId) {
        user = await storage.getUserByAccountId(accountId);
      }
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const resetToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 3600000);
      
      await storage.createPasswordResetToken({
        userId: user.id,
        token: resetToken,
        expiresAt,
      });
      
      res.json({ 
        success: true, 
        message: "Password reset token generated",
        token: resetToken,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Reset password with token
  app.post("/api/auth/reset-password", strictRateLimiter, async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body;
      
      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) {
        return res.status(400).json({ error: "Invalid or expired token" });
      }
      
      if (resetToken.usedAt) {
        return res.status(400).json({ error: "Token has already been used" });
      }
      
      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({ error: "Token has expired" });
      }
      
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(resetToken.userId, { password: hashedPassword });
      await storage.markTokenAsUsed(resetToken.id);
      
      await storage.createAuditLog({
        userId: resetToken.userId,
        action: "settings_change",
        entityType: "user",
        entityId: resetToken.userId,
        details: "Password reset",
      });
      
      res.json({ success: true, message: "Password has been reset successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== USERS ROUTES ====================
  
  app.get("/api/users", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { role } = req.query;
      const users = await storage.listUsers(role as string);
      res.json(users.map(u => ({ ...u, password: undefined })));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get("/api/users/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ ...user, password: undefined });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.patch("/api/users/:id", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const user = await storage.updateUser(req.params.id, req.body);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ ...user, password: undefined });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== GAMES ROUTES ====================
  
  app.get("/api/games", async (req: Request, res: Response) => {
    try {
      const { status } = req.query;
      const games = await storage.listGames(status as string);
      res.json(games);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get("/api/games/:id", async (req: Request, res: Response) => {
    try {
      const game = await storage.getGame(req.params.id);
      if (!game) {
        return res.status(404).json({ error: "Game not found" });
      }
      res.json(game);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post("/api/games", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const data = insertGameSchema.parse({ ...req.body, createdBy: req.user!.id });
      const game = await storage.createGame(data);
      res.status(201).json(game);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });
  
  app.patch("/api/games/:id", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const game = await storage.updateGame(req.params.id, req.body);
      if (!game) {
        return res.status(404).json({ error: "Game not found" });
      }
      res.json(game);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.delete("/api/games/:id", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      await storage.deleteGame(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== GAME PLAY ROUTES ====================
  
  app.post("/api/games/:id/play", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { betAmount } = req.body;
      const gameId = req.params.id;
      const userId = req.user!.id;
      
      const user = await storage.getUser(userId);
      const game = await storage.getGame(gameId);
      
      if (!user || !game) {
        return res.status(404).json({ error: "User or game not found" });
      }
      
      if (game.status !== "active") {
        return res.status(400).json({ error: "Game is not active" });
      }
      
      const bet = parseFloat(betAmount);
      const balance = parseFloat(user.balance);
      
      if (bet < parseFloat(game.minBet) || bet > parseFloat(game.maxBet)) {
        return res.status(400).json({ error: `Bet must be between ${game.minBet} and ${game.maxBet}` });
      }
      
      if (bet > balance) {
        return res.status(400).json({ error: "Insufficient balance" });
      }
      
      // Game logic: Use RTP to determine win/loss
      const rtp = parseFloat(game.rtp) / 100;
      const random = Math.random();
      const isWin = random < rtp;
      
      // Calculate multiplier based on volatility
      let multiplier = 0;
      if (isWin) {
        const volatilityMultipliers = {
          low: { min: 1.1, max: 2 },
          medium: { min: 1.5, max: 5 },
          high: { min: 2, max: 10 },
        };
        const range = volatilityMultipliers[game.volatility] || volatilityMultipliers.medium;
        multiplier = range.min + Math.random() * (range.max - range.min);
        multiplier = Math.min(multiplier, parseFloat(game.multiplierMax));
      }
      
      const winAmount = isWin ? bet * multiplier : 0;
      const netResult = winAmount - bet;
      const newBalance = (balance + netResult).toFixed(2);
      
      // Update user balance
      await storage.updateUser(userId, { 
        balance: newBalance,
        totalWagered: (parseFloat(user.totalWagered) + bet).toFixed(2),
        totalWon: (parseFloat(user.totalWon) + winAmount).toFixed(2),
      });
      
      // Create game session
      const session = await storage.createGameSession({
        userId,
        gameId,
        betAmount: bet.toFixed(2),
        multiplier: multiplier.toFixed(2),
        winAmount: winAmount.toFixed(2),
        isWin,
        balanceBefore: balance.toFixed(2),
        balanceAfter: newBalance,
        seed: crypto.randomBytes(16).toString("hex"),
        result: isWin ? "win" : "loss",
      });
      
      // Update game stats
      await storage.incrementGamePlayCount(gameId, bet.toFixed(2));
      
      // Create audit log
      await storage.createAuditLog({
        userId,
        action: isWin ? "win" : "bet",
        entityType: "game_session",
        entityId: session.id,
        details: JSON.stringify({ betAmount: bet, winAmount, multiplier }),
      });
      
      res.json({
        session,
        isWin,
        multiplier: parseFloat(multiplier.toFixed(2)),
        winAmount: parseFloat(winAmount.toFixed(2)),
        newBalance: parseFloat(newBalance),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get("/api/games/:id/history", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const sessions = await storage.getGameSessionsByUser(req.user!.id, 50);
      res.json(sessions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== PAYMENT METHODS ROUTES ====================
  
  app.get("/api/payment-methods", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const methods = await storage.listCountryPaymentMethods();
      res.json(methods.filter(m => m.isActive));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/payment-methods", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const methods = await storage.listCountryPaymentMethods();
      res.json(methods);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/integrations/status", authMiddleware, adminMiddleware, async (_req: AuthRequest, res: Response) => {
    try {
      const integrations: Record<string, boolean> = {
        twilio: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER),
        sendgrid: !!(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL),
        google_oauth: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        facebook_oauth: !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET),
        telegram_oauth: !!process.env.TELEGRAM_BOT_TOKEN,
        twitter_oauth: !!(process.env.TWITTER_API_KEY && process.env.TWITTER_API_SECRET),
        stripe: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY),
        firebase_push: !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY),
      };
      res.json(integrations);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/payment-methods", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const parsed = insertCountryPaymentMethodSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid payment method data", details: parsed.error.errors });
      }
      const method = await storage.createCountryPaymentMethod(parsed.data);
      res.json(method);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/payment-methods/:id", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const parsed = insertCountryPaymentMethodSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid payment method data", details: parsed.error.errors });
      }
      const method = await storage.updateCountryPaymentMethod(id, parsed.data);
      if (!method) {
        return res.status(404).json({ error: "Payment method not found" });
      }
      res.json(method);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/payment-methods/:id", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteCountryPaymentMethod(id);
      if (!deleted) {
        return res.status(404).json({ error: "Payment method not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== TRANSACTIONS ROUTES ====================
  
  app.get("/api/transactions", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { type, status } = req.query;
      const userId = req.user!.role === "admin" ? undefined : req.user!.id;
      const transactions = await storage.listTransactions(userId, type as string, status as string);
      res.json(transactions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post("/api/transactions/deposit", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { amount, paymentMethod, paymentReference, walletNumber } = req.body;
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      if (!amount || parseFloat(amount) <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }
      
      if (!paymentReference) {
        return res.status(400).json({ error: "Payment reference is required" });
      }
      
      const totalAmount = parseFloat(amount);
      
      const transaction = await storage.createTransaction({
        userId: user.id,
        type: "deposit",
        status: "pending",
        amount: totalAmount.toFixed(2),
        balanceBefore: user.balance,
        balanceAfter: (parseFloat(user.balance) + totalAmount).toFixed(2),
        referenceId: paymentReference,
        description: `${paymentMethod}${walletNumber ? ` | Sender: ${walletNumber}` : ''}`,
      });
      
      await storage.createAuditLog({
        userId: user.id,
        action: "deposit",
        entityType: "transaction",
        entityId: transaction.id,
        details: JSON.stringify({ amount: totalAmount, paymentMethod, paymentReference }),
      });
      
      res.status(201).json(transaction);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post("/api/transactions/withdraw", authMiddleware, sensitiveRateLimiter, async (req: AuthRequest, res: Response) => {
    try {
      const { amount } = req.body;
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      if (parseFloat(amount) > parseFloat(user.balance)) {
        return res.status(400).json({ error: "Insufficient balance" });
      }
      
      const transaction = await storage.createTransaction({
        userId: user.id,
        type: "withdrawal",
        status: "pending",
        amount: amount,
        balanceBefore: user.balance,
        balanceAfter: (parseFloat(user.balance) - parseFloat(amount)).toFixed(2),
        description: "Withdrawal request",
      });
      
      await storage.createAuditLog({
        userId: user.id,
        action: "withdrawal",
        entityType: "transaction",
        entityId: transaction.id,
        details: JSON.stringify({ amount }),
      });
      
      res.status(201).json(transaction);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.patch("/api/transactions/:id/process", authMiddleware, agentMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { status, adminNote } = req.body;
      const transaction = await storage.getTransaction(req.params.id);
      
      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }
      
      const agent = await storage.getAgentByUserId(req.user!.id);
      
      const updated = await storage.updateTransaction(req.params.id, {
        status,
        adminNote,
        processedBy: agent?.id,
        processedAt: new Date(),
      });
      
      if (status === "approved" || status === "completed") {
        const user = await storage.getUser(transaction.userId);
        if (user) {
          if (transaction.type === "deposit") {
            await storage.updateUser(user.id, {
              balance: (parseFloat(user.balance) + parseFloat(transaction.amount)).toFixed(2),
              totalDeposited: (parseFloat(user.totalDeposited) + parseFloat(transaction.amount)).toFixed(2),
            });
          } else if (transaction.type === "withdrawal") {
            await storage.updateUser(user.id, {
              balance: (parseFloat(user.balance) - parseFloat(transaction.amount)).toFixed(2),
              totalWithdrawn: (parseFloat(user.totalWithdrawn) + parseFloat(transaction.amount)).toFixed(2),
            });
          }
        }
      }
      
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get("/api/transactions/pending", authMiddleware, agentMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const transactions = await storage.getPendingTransactions();
      res.json(transactions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== AGENTS ROUTES ====================
  
  app.get("/api/agents", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const agents = await storage.listAgents();
      res.json(agents);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post("/api/agents", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { username, password, email, firstName, lastName, ...agentData } = req.body;
      
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        email,
        firstName,
        lastName,
        role: "agent",
        status: "active",
      });
      
      const agentCode = `AGT-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      const agent = await storage.createAgent({
        userId: user.id,
        agentCode,
        ...agentData,
      });
      
      res.status(201).json({ user: { ...user, password: undefined }, agent });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get("/api/agents/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      res.json(agent);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.patch("/api/agents/:id", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const agent = await storage.updateAgent(req.params.id, req.body);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      res.json(agent);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get("/api/agents/:id/payment-methods", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const methods = await storage.getAgentPaymentMethods(req.params.id);
      res.json(methods);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post("/api/agents/:id/payment-methods", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const method = await storage.createAgentPaymentMethod({
        agentId: req.params.id,
        ...req.body,
      });
      res.status(201).json(method);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== AFFILIATES ROUTES ====================
  
  app.get("/api/affiliates", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const affiliates = await storage.listAffiliates();
      res.json(affiliates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post("/api/affiliates", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const affiliateCode = `AFF-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      const affiliate = await storage.createAffiliate({
        userId: req.user!.id,
        affiliateCode,
        referralLink: `/ref/${affiliateCode}`,
        ...req.body,
      });
      res.status(201).json(affiliate);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get("/api/affiliates/me", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const affiliate = await storage.getAffiliateByCode(req.user!.id);
      res.json(affiliate);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== PROMO CODES ROUTES ====================
  
  app.get("/api/promo-codes", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const promoCodes = await storage.listPromoCodes();
      res.json(promoCodes);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post("/api/promo-codes", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const promoCode = await storage.createPromoCode(req.body);
      res.status(201).json(promoCode);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get("/api/promo-codes/validate/:code", async (req: Request, res: Response) => {
    try {
      const promo = await storage.getPromoCodeByCode(req.params.code);
      if (!promo) {
        return res.status(404).json({ valid: false, error: "Promo code not found" });
      }
      if (!promo.isActive) {
        return res.json({ valid: false, error: "Promo code is not active" });
      }
      if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
        return res.json({ valid: false, error: "Promo code has expired" });
      }
      if (promo.usageLimit && promo.usageCount >= promo.usageLimit) {
        return res.json({ valid: false, error: "Promo code usage limit reached" });
      }
      res.json({ valid: true, promo });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== COMPLAINTS ROUTES ====================
  
  app.get("/api/complaints", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { status } = req.query;
      const userId = req.user!.role === "admin" || req.user!.role === "agent" ? undefined : req.user!.id;
      const complaints = await storage.listComplaints(userId, status as string);
      res.json(complaints);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post("/api/complaints", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      // Auto-assign to available agent
      const agent = await storage.getAvailableAgentForAssignment();
      
      const complaint = await storage.createComplaint({
        userId: req.user!.id,
        assignedAgentId: agent?.id,
        status: agent ? "assigned" : "open",
        slaDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours SLA
        ...req.body,
      });
      
      if (agent) {
        await storage.updateAgent(agent.id, {
          assignedCustomersCount: agent.assignedCustomersCount + 1,
        });
      }
      
      res.status(201).json(complaint);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get("/api/complaints/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const complaint = await storage.getComplaint(req.params.id);
      if (!complaint) {
        return res.status(404).json({ error: "Complaint not found" });
      }
      const messages = await storage.getComplaintMessages(complaint.id);
      res.json({ ...complaint, messages });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.patch("/api/complaints/:id", authMiddleware, agentMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const complaint = await storage.updateComplaint(req.params.id, req.body);
      if (!complaint) {
        return res.status(404).json({ error: "Complaint not found" });
      }
      res.json(complaint);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post("/api/complaints/:id/messages", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const message = await storage.addComplaintMessage({
        complaintId: req.params.id,
        senderId: req.user!.id,
        message: req.body.message,
        isInternal: req.body.isInternal || false,
      });
      res.status(201).json(message);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== FINANCIAL LIMITS ROUTES ====================
  
  app.get("/api/financial-limits", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const limits = await storage.getFinancialLimits();
      res.json(limits);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post("/api/financial-limits", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const limit = await storage.createFinancialLimit(req.body);
      res.status(201).json(limit);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== AUDIT LOGS ROUTES ====================
  
  app.get("/api/audit-logs", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { userId, action } = req.query;
      const logs = await storage.getAuditLogs(userId as string, action as string);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== AUTH SETTINGS ROUTES ====================
  
  // Public route to get visible auth methods
  app.get("/api/auth/settings", async (req: Request, res: Response) => {
    try {
      const settings = await storage.getSettingsByCategory("auth");
      const authConfig: Record<string, boolean> = {
        oneClickEnabled: true,
        phoneLoginEnabled: true,
        emailLoginEnabled: true,
        googleLoginEnabled: false,
        facebookLoginEnabled: false,
        telegramLoginEnabled: false,
        twitterLoginEnabled: false,
      };
      
      settings.forEach(s => {
        if (s.key in authConfig) {
          authConfig[s.key] = s.value === "true";
        }
      });
      
      res.json(authConfig);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Admin route to update auth settings
  app.patch("/api/auth/settings", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const updates = req.body;
      for (const [key, value] of Object.entries(updates)) {
        await storage.setSetting(key, String(value), "auth");
      }
      
      await storage.createAuditLog({
        userId: req.user!.id,
        action: "settings_change",
        entityType: "system",
        entityId: "auth_settings",
        details: JSON.stringify(updates),
      });
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== NOTIFICATIONS ====================
  
  app.get("/api/notifications", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const notifications = await storage.getUserNotifications(req.user!.id);
      res.json(notifications);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/notifications/unread-count", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const count = await storage.getUnreadNotificationCount(req.user!.id);
      res.json({ count });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/notifications/:id/read", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      await storage.markNotificationAsRead(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/notifications/read-all", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      await storage.markAllNotificationsAsRead(req.user!.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== ANNOUNCEMENTS ====================

  app.get("/api/announcements", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const announcements = await storage.getPublishedAnnouncements();
      const viewedIds = await storage.getViewedAnnouncementIds(req.user!.id);
      
      const withViewStatus = announcements.map(a => ({
        ...a,
        isViewed: viewedIds.includes(a.id),
      }));
      
      res.json(withViewStatus);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/announcements/:id/view", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      await storage.markAnnouncementViewed(req.params.id, req.user!.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Create announcement
  const announcementCreateSchema = z.object({
    title: z.string().min(1).max(200),
    titleAr: z.string().max(200).optional().nullable(),
    content: z.string().min(1).max(5000),
    contentAr: z.string().max(5000).optional().nullable(),
    type: z.enum(["general", "promotion", "maintenance", "update"]).default("general"),
    priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
    target: z.enum(["all", "players", "agents", "affiliates"]).default("all"),
    isPinned: z.boolean().default(false),
    expiresAt: z.string().datetime().optional().nullable(),
  });

  app.post("/api/admin/announcements", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const validated = announcementCreateSchema.parse(req.body);
      const announcement = await storage.createAnnouncement({
        ...validated,
        expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : null,
        createdBy: req.user!.id,
      });
      res.json(announcement);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: List all announcements
  app.get("/api/admin/announcements", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { status } = req.query;
      const announcements = await storage.listAnnouncements(status as string);
      res.json(announcements);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Update announcement
  app.patch("/api/admin/announcements/:id", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const announcement = await storage.updateAnnouncement(req.params.id, req.body);
      if (!announcement) {
        return res.status(404).json({ error: "Announcement not found" });
      }
      res.json(announcement);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Publish announcement
  app.post("/api/admin/announcements/:id/publish", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const announcement = await storage.updateAnnouncement(req.params.id, {
        status: "published",
        publishedAt: new Date(),
      });
      
      if (!announcement) {
        return res.status(404).json({ error: "Announcement not found" });
      }

      // Respond immediately to avoid blocking
      res.json(announcement);

      // Create notifications in background (fire-and-forget with error handling)
      (async () => {
        try {
          const users = await storage.listUsers();
          // Batch in groups of 50 to avoid overload
          const batchSize = 50;
          for (let i = 0; i < users.length; i += batchSize) {
            const batch = users.slice(i, i + batchSize);
            await Promise.all(batch.map(user => 
              storage.createNotification({
                userId: user.id,
                type: "announcement",
                priority: announcement.priority as any,
                title: announcement.title,
                titleAr: announcement.titleAr,
                message: announcement.content.substring(0, 200),
                messageAr: announcement.contentAr?.substring(0, 200),
                link: `/announcements/${announcement.id}`,
              }).catch(err => console.error("Failed to create notification for user:", user.id, err))
            ));
          }
        } catch (err) {
          console.error("Failed to create announcement notifications:", err);
        }
      })();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== USER PROFILE & PREFERENCES ====================

  const preferencesUpdateSchema = z.object({
    language: z.enum(["en", "ar"]).optional(),
    currency: z.enum(["USD", "EUR", "GBP", "AED", "SAR"]).optional(),
    notifyAnnouncements: z.boolean().optional(),
    notifyTransactions: z.boolean().optional(),
    notifyPromotions: z.boolean().optional(),
    notifyP2P: z.boolean().optional(),
  });

  const profileUpdateSchema = z.object({
    firstName: z.string().max(50).optional().nullable(),
    lastName: z.string().max(50).optional().nullable(),
    email: z.string().email().optional().nullable().or(z.literal("")),
    phone: z.string().max(20).optional().nullable(),
  });

  app.get("/api/user/preferences", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const prefs = await storage.getUserPreferences(req.user!.id);
      res.json(prefs || { language: "en", currency: "USD" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/user/preferences", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const validated = preferencesUpdateSchema.parse(req.body);
      const prefs = await storage.createOrUpdateUserPreferences(req.user!.id, validated);
      res.json(prefs);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/user/profile", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const validated = profileUpdateSchema.parse(req.body);
      const user = await storage.updateUser(req.user!.id, validated);
      
      await storage.createAuditLog({
        userId: req.user!.id,
        action: "user_update",
        entityType: "user",
        entityId: req.user!.id,
        details: "Profile updated",
      });
      
      const { password, ...safeUser } = user!;
      res.json(safeUser);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Check nickname availability
  app.get("/api/user/check-nickname/:nickname", async (req: Request, res: Response) => {
    try {
      const { nickname } = req.params;
      if (!nickname || nickname.length < 3) {
        return res.json({ available: false, error: "Nickname must be at least 3 characters" });
      }
      const existingUser = await storage.getUserByNickname(nickname);
      res.json({ available: !existingUser });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Set nickname
  app.post("/api/user/nickname", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { nickname } = req.body;
      if (!nickname || nickname.length < 3) {
        return res.status(400).json({ error: "Nickname must be at least 3 characters" });
      }
      
      const existingUser = await storage.getUserByNickname(nickname);
      if (existingUser && existingUser.id !== req.user!.id) {
        return res.status(400).json({ error: "Nickname already taken" });
      }
      
      const user = await storage.updateUser(req.user!.id, { nickname });
      const { password, ...safeUser } = user!;
      res.json(safeUser);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const userStatusSchema = z.object({
    stealthMode: z.boolean().optional(),
    isOnline: z.boolean().optional(),
  }).refine(data => data.stealthMode !== undefined || data.isOnline !== undefined, {
    message: "At least one field (stealthMode or isOnline) is required"
  });

  app.patch("/api/user/status", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const parsed = userStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }
      
      const { stealthMode, isOnline } = parsed.data;
      const updateData: Partial<{stealthMode: boolean; isOnline: boolean; lastActiveAt: Date}> = { 
        lastActiveAt: new Date() 
      };
      if (stealthMode !== undefined) updateData.stealthMode = stealthMode;
      if (isOnline !== undefined) updateData.isOnline = isOnline;
      
      const user = await storage.updateUser(req.user!.id, updateData);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== SECURITY ====================

  const passwordChangeSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string()
      .min(6, "Password must be at least 6 characters")
      .max(100, "Password is too long")
      .regex(/[a-zA-Z]/, "Password must contain at least one letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string(),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  }).refine((data) => data.newPassword !== data.currentPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });

  app.post("/api/user/change-password", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const validated = passwordChangeSchema.parse(req.body);
      
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const isValid = await bcrypt.compare(validated.currentPassword, user.password);
      if (!isValid) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }
      
      const hashedPassword = await bcrypt.hash(validated.newPassword, 10);
      await storage.updateUser(req.user!.id, { password: hashedPassword });
      
      await storage.createAuditLog({
        userId: req.user!.id,
        action: "settings_change",
        entityType: "user",
        entityId: req.user!.id,
        details: "Password changed",
        ipAddress: req.ip,
      });

      await storage.createNotification({
        userId: req.user!.id,
        type: "security",
        priority: "high",
        title: "Password Changed",
        titleAr: "تم تغيير كلمة المرور",
        message: "Your password was changed successfully. If you didn't make this change, contact support immediately.",
        messageAr: "تم تغيير كلمة المرور بنجاح. إذا لم تقم بهذا التغيير، اتصل بالدعم فوراً.",
      });
      
      res.json({ success: true, message: "Password changed successfully" });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0]?.message || "Invalid input" });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/user/login-history", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const history = await storage.getUserLoginHistory(req.user!.id);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/user/sessions", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const sessions = await storage.getUserSessions(req.user!.id);
      res.json(sessions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/user/sessions/:id/revoke", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      await storage.revokeUserSession(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/user/sessions/revoke-all", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { exceptCurrent } = req.body;
      await storage.revokeAllUserSessions(req.user!.id, exceptCurrent);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== DASHBOARD STATS ====================
  
  app.get("/api/dashboard/stats", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const users = await storage.listUsers();
      const agents = await storage.listAgents();
      const affiliates = await storage.listAffiliates();
      const games = await storage.listGames();
      const transactions = await storage.listTransactions();
      const complaints = await storage.listComplaints();
      
      const pendingTransactions = transactions.filter(t => t.status === "pending");
      const openComplaints = complaints.filter(c => c.status === "open" || c.status === "assigned");
      
      const totalDeposits = transactions
        .filter(t => t.type === "deposit" && t.status === "completed")
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      const totalWithdrawals = transactions
        .filter(t => t.type === "withdrawal" && t.status === "completed")
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      res.json({
        totalUsers: users.length,
        totalAgents: agents.length,
        totalAffiliates: affiliates.length,
        totalGames: games.length,
        pendingTransactions: pendingTransactions.length,
        openComplaints: openComplaints.length,
        totalDeposits,
        totalWithdrawals,
        netRevenue: totalDeposits - totalWithdrawals,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== P2P TRADING ROUTES ====================
  
  // Mock P2P offers data
  const mockP2POffers = [
    {
      id: "p2p-offer-1",
      userId: "user-1",
      username: "CryptoTrader",
      type: "sell",
      amount: "500",
      price: "1.02",
      currency: "USDT",
      minLimit: "50",
      maxLimit: "500",
      paymentMethods: ["bank_transfer", "vodafone_cash"],
      rating: 4.8,
      completedTrades: 156,
      status: "active",
      createdAt: new Date().toISOString(),
    },
    {
      id: "p2p-offer-2",
      userId: "user-2",
      username: "FastExchange",
      type: "buy",
      amount: "1000",
      price: "0.98",
      currency: "USD",
      minLimit: "100",
      maxLimit: "1000",
      paymentMethods: ["instapay"],
      rating: 4.5,
      completedTrades: 89,
      status: "active",
      createdAt: new Date().toISOString(),
    },
    {
      id: "p2p-offer-3",
      userId: "user-3",
      username: "EuroDealer",
      type: "sell",
      amount: "750",
      price: "1.05",
      currency: "EUR",
      minLimit: "25",
      maxLimit: "750",
      paymentMethods: ["bank_transfer"],
      rating: 4.9,
      completedTrades: 234,
      status: "active",
      createdAt: new Date().toISOString(),
    },
  ];

  const userP2POffers: any[] = [];
  const userP2PTrades: any[] = [];

  // GET /api/p2p/offers - List marketplace offers
  app.get("/api/p2p/offers", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { type, currency, payment } = req.query;
      let offers = [...mockP2POffers, ...userP2POffers.filter(o => o.status === "active")];
      
      if (type && type !== "all") {
        offers = offers.filter(o => o.type === type);
      }
      if (currency && currency !== "all") {
        offers = offers.filter(o => o.currency === currency);
      }
      if (payment && payment !== "all") {
        offers = offers.filter(o => o.paymentMethods.includes(payment as string));
      }
      
      res.json(offers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/p2p/offers - Create new offer
  app.post("/api/p2p/offers", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { type, amount, price, currency, minLimit, maxLimit, paymentMethods } = req.body;
      const user = await storage.getUser(req.user!.id);
      
      const newOffer = {
        id: `p2p-offer-${Date.now()}`,
        userId: req.user!.id,
        username: user?.username || "Unknown",
        type,
        amount,
        price,
        currency,
        minLimit,
        maxLimit,
        paymentMethods: Array.isArray(paymentMethods) ? paymentMethods : [paymentMethods],
        rating: 5.0,
        completedTrades: 0,
        status: "active",
        createdAt: new Date().toISOString(),
      };
      
      userP2POffers.push(newOffer);
      res.status(201).json(newOffer);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/p2p/my-offers - User's offers
  app.get("/api/p2p/my-offers", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const myOffers = userP2POffers.filter(o => o.userId === req.user!.id);
      res.json(myOffers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/p2p/offers/:id - Delete an offer
  app.delete("/api/p2p/offers/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const index = userP2POffers.findIndex(o => o.id === req.params.id && o.userId === req.user!.id);
      if (index === -1) {
        return res.status(404).json({ error: "Offer not found" });
      }
      userP2POffers.splice(index, 1);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/p2p/my-trades - User's trade history
  app.get("/api/p2p/my-trades", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const myTrades = userP2PTrades.filter(
        t => t.buyerId === req.user!.id || t.sellerId === req.user!.id
      );
      
      // Return mock trades if no real trades exist
      if (myTrades.length === 0) {
        res.json([
          {
            id: "trade-demo-1",
            offerId: "p2p-offer-1",
            buyerId: req.user!.id,
            sellerId: "user-1",
            amount: "100 USDT",
            price: "1.02",
            totalPrice: "102.00",
            status: "completed",
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            completedAt: new Date(Date.now() - 86000000).toISOString(),
            counterpartyUsername: "CryptoTrader",
          },
          {
            id: "trade-demo-2",
            offerId: "p2p-offer-2",
            buyerId: "user-2",
            sellerId: req.user!.id,
            amount: "250 USD",
            price: "0.98",
            totalPrice: "245.00",
            status: "pending",
            createdAt: new Date().toISOString(),
            completedAt: null,
            counterpartyUsername: "FastExchange",
          },
        ]);
        return;
      }
      
      res.json(myTrades);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== P2P DISPUTES ====================

  // Mock data for disputes
  const p2pDisputes: any[] = [];
  const p2pDisputeMessages: any[] = [];
  const p2pDisputeEvidence: any[] = [];
  const p2pTransactionLogs: any[] = [];

  // Pre-written responses templates
  const prewrittenResponses = [
    { id: "pr-1", category: "payment_proof", title: "Payment Completed", titleAr: "تم الدفع", message: "I have completed the payment. Please check your account and confirm receipt.", messageAr: "لقد أتممت الدفع. يرجى التحقق من حسابك وتأكيد الاستلام." },
    { id: "pr-2", category: "payment_proof", title: "Payment Screenshot Attached", titleAr: "مرفق لقطة شاشة الدفع", message: "I have attached a screenshot of the payment transaction as proof.", messageAr: "لقد أرفقت لقطة شاشة لمعاملة الدفع كإثبات." },
    { id: "pr-3", category: "payment_not_received", title: "Payment Not Received", titleAr: "لم يتم استلام الدفع", message: "I have not received the payment yet. Please provide proof of transaction.", messageAr: "لم أستلم الدفع بعد. يرجى تقديم إثبات المعاملة." },
    { id: "pr-4", category: "wrong_amount", title: "Wrong Amount Received", titleAr: "استلام مبلغ خاطئ", message: "The amount received does not match the agreed amount. Please review and correct.", messageAr: "المبلغ المستلم لا يتطابق مع المبلغ المتفق عليه. يرجى المراجعة والتصحيح." },
    { id: "pr-5", category: "release_request", title: "Request to Release", titleAr: "طلب الإفراج", message: "Please release the crypto as I have completed the payment successfully.", messageAr: "يرجى إطلاق العملة المشفرة حيث أنني أتممت الدفع بنجاح." },
    { id: "pr-6", category: "name_mismatch", title: "Name Mismatch", titleAr: "عدم تطابق الاسم", message: "The payment was made from a different account name. Please verify the payment details.", messageAr: "تم الدفع من حساب باسم مختلف. يرجى التحقق من تفاصيل الدفع." },
    { id: "pr-7", category: "bank_delay", title: "Bank Processing Delay", titleAr: "تأخير المعالجة البنكية", message: "My bank is taking time to process the payment. It should arrive within 2-4 hours.", messageAr: "البنك يستغرق وقتاً لمعالجة الدفع. يجب أن يصل خلال 2-4 ساعات." },
    { id: "pr-8", category: "cancel_request", title: "Request to Cancel", titleAr: "طلب إلغاء", message: "I would like to cancel this trade due to unforeseen circumstances.", messageAr: "أود إلغاء هذه الصفقة بسبب ظروف غير متوقعة." },
  ];

  // Dispute rules and guidelines
  const disputeRules = [
    { id: "rule-1", category: "proof_requirements", title: "Payment Proof Requirements", titleAr: "متطلبات إثبات الدفع", content: "All payment proofs must include: 1) Full transaction reference number, 2) Date and time of transaction, 3) Sender and receiver names, 4) Transaction amount, 5) Bank/payment method name clearly visible.", contentAr: "يجب أن تتضمن جميع إثباتات الدفع: 1) رقم مرجع المعاملة الكامل، 2) تاريخ ووقت المعاملة، 3) أسماء المرسل والمستلم، 4) مبلغ المعاملة، 5) اسم البنك/طريقة الدفع بشكل واضح.", icon: "FileCheck" },
    { id: "rule-2", category: "screenshot_guidelines", title: "Screenshot Guidelines", titleAr: "إرشادات لقطات الشاشة", content: "Screenshots must be: 1) Original and unedited, 2) Full screen captures showing complete information, 3) Clearly readable with no blurry text, 4) Showing the transaction date and time, 5) Including bank/app name in the screenshot.", contentAr: "يجب أن تكون لقطات الشاشة: 1) أصلية وغير معدلة، 2) التقاطات شاشة كاملة تظهر المعلومات الكاملة، 3) قابلة للقراءة بوضوح بدون نص ضبابي، 4) تظهر تاريخ ووقت المعاملة، 5) تتضمن اسم البنك/التطبيق.", icon: "Camera" },
    { id: "rule-3", category: "video_evidence", title: "Video Evidence Guidelines", titleAr: "إرشادات الفيديو كإثبات", content: "Video evidence should: 1) Be recorded from the official banking app, 2) Show scrolling through the full transaction details, 3) Include the current date/time on the device, 4) Be no longer than 60 seconds, 5) Clearly show all relevant information.", contentAr: "يجب أن يكون الفيديو كإثبات: 1) مسجلاً من تطبيق البنك الرسمي، 2) يظهر التمرير خلال تفاصيل المعاملة الكاملة، 3) يتضمن التاريخ/الوقت الحالي على الجهاز، 4) لا يزيد عن 60 ثانية، 5) يظهر جميع المعلومات ذات الصلة بوضوح.", icon: "Video" },
    { id: "rule-4", category: "prohibited_actions", title: "Prohibited Actions", titleAr: "الإجراءات المحظورة", content: "The following actions are prohibited and may result in account suspension: 1) Submitting fake or edited screenshots, 2) Using offensive language, 3) Making false claims, 4) Not responding within the given timeframe, 5) Trading outside the platform.", contentAr: "الإجراءات التالية محظورة وقد تؤدي إلى تعليق الحساب: 1) تقديم لقطات شاشة مزيفة أو معدلة، 2) استخدام لغة مسيئة، 3) تقديم ادعاءات كاذبة، 4) عدم الرد خلال الإطار الزمني المحدد، 5) التداول خارج المنصة.", icon: "Ban" },
    { id: "rule-5", category: "timeframe", title: "Response Timeframe", titleAr: "الإطار الزمني للرد", content: "All parties must respond within: 1) 10 minutes for peer negotiation, 2) 24 hours for evidence submission, 3) 48 hours for additional documentation if requested. Failure to respond may result in automatic resolution in favor of the responding party.", contentAr: "يجب على جميع الأطراف الرد خلال: 1) 10 دقائق للتفاوض بين الأطراف، 2) 24 ساعة لتقديم الأدلة، 3) 48 ساعة للوثائق الإضافية إذا طُلبت. قد يؤدي عدم الرد إلى حل تلقائي لصالح الطرف المستجيب.", icon: "Clock" },
  ];

  // GET /api/p2p/prewritten-responses
  app.get("/api/p2p/prewritten-responses", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      res.json(prewrittenResponses);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/p2p/dispute-rules
  app.get("/api/p2p/dispute-rules", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      res.json(disputeRules);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/p2p/disputes - List user's disputes
  app.get("/api/p2p/disputes", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const myDisputes = p2pDisputes.filter(
        d => d.initiatorId === req.user!.id || d.respondentId === req.user!.id
      );
      
      if (myDisputes.length === 0) {
        res.json([
          {
            id: "dispute-demo-1",
            tradeId: "trade-demo-1",
            initiatorId: req.user!.id,
            respondentId: "user-123",
            respondentName: "CryptoTrader",
            status: "open",
            reason: "payment_not_received",
            description: "Payment has not been received after 2 hours",
            stage: "peer_negotiation",
            peerNegotiationEndsAt: new Date(Date.now() + 600000).toISOString(),
            tradeAmount: "100 USDT",
            tradeFiatAmount: "102.00 USD",
            createdAt: new Date(Date.now() - 3600000).toISOString(),
          }
        ]);
        return;
      }
      
      res.json(myDisputes);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/p2p/disputes - Open a new dispute
  app.post("/api/p2p/disputes", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { tradeId, reason, description } = req.body;
      
      const dispute = {
        id: `dispute-${Date.now()}`,
        tradeId,
        initiatorId: req.user!.id,
        initiatorName: req.user!.username,
        respondentId: "user-other",
        respondentName: "Counterparty",
        status: "open",
        reason,
        description,
        stage: "peer_negotiation",
        peerNegotiationEndsAt: new Date(Date.now() + 600000).toISOString(),
        createdAt: new Date().toISOString(),
      };
      
      p2pDisputes.push(dispute);
      
      // Log the dispute creation
      p2pTransactionLogs.push({
        id: `log-${Date.now()}`,
        tradeId,
        disputeId: dispute.id,
        userId: req.user!.id,
        action: "dispute_opened",
        description: `Dispute opened by ${req.user!.username}. Reason: ${reason}`,
        descriptionAr: `تم فتح نزاع بواسطة ${req.user!.username}. السبب: ${reason}`,
        createdAt: new Date().toISOString(),
      });
      
      res.status(201).json(dispute);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/p2p/disputes/:id - Get dispute details
  app.get("/api/p2p/disputes/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      let dispute = p2pDisputes.find(d => d.id === req.params.id);
      
      if (!dispute) {
        dispute = {
          id: req.params.id,
          tradeId: "trade-demo-1",
          initiatorId: req.user!.id,
          initiatorName: req.user!.username,
          respondentId: "user-123",
          respondentName: "CryptoTrader",
          status: "open",
          reason: "payment_not_received",
          description: "Payment has not been received after 2 hours",
          stage: "peer_negotiation",
          peerNegotiationEndsAt: new Date(Date.now() + 600000).toISOString(),
          tradeAmount: "100 USDT",
          tradeFiatAmount: "102.00 USD",
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        };
      }
      
      const messages = p2pDisputeMessages.filter(m => m.disputeId === req.params.id);
      const evidence = p2pDisputeEvidence.filter(e => e.disputeId === req.params.id);
      const logs = p2pTransactionLogs.filter(l => l.disputeId === req.params.id || l.tradeId === dispute.tradeId);
      
      res.json({ dispute, messages, evidence, logs });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/p2p/disputes/:id/messages - Send message in dispute
  app.post("/api/p2p/disputes/:id/messages", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { message, isPrewritten, prewrittenTemplateId } = req.body;
      
      const newMessage = {
        id: `msg-${Date.now()}`,
        disputeId: req.params.id,
        senderId: req.user!.id,
        senderName: req.user!.username,
        message,
        isPrewritten: isPrewritten || false,
        prewrittenTemplateId: prewrittenTemplateId || null,
        isFromSupport: false,
        createdAt: new Date().toISOString(),
      };
      
      p2pDisputeMessages.push(newMessage);
      
      // Log the message
      p2pTransactionLogs.push({
        id: `log-${Date.now()}`,
        tradeId: "trade-demo-1",
        disputeId: req.params.id,
        userId: req.user!.id,
        action: "dispute_message",
        description: `Message sent by ${req.user!.username}`,
        descriptionAr: `تم إرسال رسالة بواسطة ${req.user!.username}`,
        createdAt: new Date().toISOString(),
      });
      
      res.status(201).json(newMessage);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/p2p/disputes/:id/evidence - Upload evidence
  app.post("/api/p2p/disputes/:id/evidence", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { fileName, fileUrl, fileType, fileSize, description, evidenceType } = req.body;
      
      const evidence = {
        id: `evidence-${Date.now()}`,
        disputeId: req.params.id,
        uploaderId: req.user!.id,
        uploaderName: req.user!.username,
        fileName,
        fileUrl,
        fileType,
        fileSize,
        description,
        evidenceType,
        isVerified: false,
        createdAt: new Date().toISOString(),
      };
      
      p2pDisputeEvidence.push(evidence);
      
      // Log the evidence upload
      p2pTransactionLogs.push({
        id: `log-${Date.now()}`,
        tradeId: "trade-demo-1",
        disputeId: req.params.id,
        userId: req.user!.id,
        action: "evidence_uploaded",
        description: `Evidence uploaded by ${req.user!.username}: ${fileName} (${evidenceType})`,
        descriptionAr: `تم رفع إثبات بواسطة ${req.user!.username}: ${fileName} (${evidenceType})`,
        createdAt: new Date().toISOString(),
      });
      
      res.status(201).json(evidence);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/p2p/disputes/:id/resolve - Resolve dispute (consensus)
  app.post("/api/p2p/disputes/:id/resolve", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { resolution, action } = req.body;
      
      const dispute = p2pDisputes.find(d => d.id === req.params.id);
      if (dispute) {
        dispute.status = "resolved";
        dispute.resolution = resolution;
        dispute.resolvedAt = new Date().toISOString();
      }
      
      // Log the resolution
      p2pTransactionLogs.push({
        id: `log-${Date.now()}`,
        tradeId: "trade-demo-1",
        disputeId: req.params.id,
        userId: req.user!.id,
        action: "dispute_resolved",
        description: `Dispute resolved: ${resolution}. Action: ${action}`,
        descriptionAr: `تم حل النزاع: ${resolution}. الإجراء: ${action}`,
        createdAt: new Date().toISOString(),
      });
      
      res.json({ success: true, resolution, action });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/p2p/trades/:tradeId/logs - Get transaction logs for a trade
  app.get("/api/p2p/trades/:tradeId/logs", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      let logs = p2pTransactionLogs.filter(l => l.tradeId === req.params.tradeId);
      
      if (logs.length === 0) {
        logs = [
          {
            id: "log-1",
            tradeId: req.params.tradeId,
            userId: "user-seller",
            action: "trade_created",
            description: "Trade initiated by buyer",
            descriptionAr: "تم بدء الصفقة بواسطة المشتري",
            createdAt: new Date(Date.now() - 7200000).toISOString(),
          },
          {
            id: "log-2",
            tradeId: req.params.tradeId,
            userId: "user-seller",
            action: "escrow_held",
            description: "100 USDT held in escrow",
            descriptionAr: "تم احتجاز 100 USDT في الضمان",
            createdAt: new Date(Date.now() - 7190000).toISOString(),
          },
          {
            id: "log-3",
            tradeId: req.params.tradeId,
            userId: req.user!.id,
            action: "payment_marked",
            description: "Buyer marked payment as sent",
            descriptionAr: "قام المشتري بتأكيد إرسال الدفع",
            createdAt: new Date(Date.now() - 3600000).toISOString(),
          },
        ];
      }
      
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== P2P TRADER PROFILES ====================

  app.get("/api/p2p/profile/:userId", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.params.userId === 'me' ? req.user!.id : req.params.userId;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const profile = {
        id: userId,
        username: user.username,
        displayName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.username,
        bio: "",
        region: "Egypt",
        verificationLevel: user.phoneVerified ? "phone" : "email",
        isOnline: true,
        lastSeenAt: new Date().toISOString(),
        memberSince: user.createdAt,
        metrics: {
          totalTrades: 156,
          completedTrades: 152,
          cancelledTrades: 4,
          completionRate: 97.44,
          totalBuyTrades: 78,
          totalSellTrades: 78,
          totalVolumeUsdt: "45680.00",
          totalDisputes: 2,
          disputesWon: 1,
          disputesLost: 1,
          disputeRate: 1.28,
          avgReleaseTimeSeconds: 180,
          avgPaymentTimeSeconds: 300,
          avgResponseTimeSeconds: 45,
          positiveRatings: 148,
          negativeRatings: 4,
          overallRating: 4.85,
          trades30d: 28,
          completion30d: 100,
          volume30d: "8500.00",
          firstTradeAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
          lastTradeAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        },
        badges: [
          { slug: "verified", name: "Verified", nameAr: "موثق", icon: "shield-check", color: "#00c853", earnedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString() },
          { slug: "trusted_seller", name: "Trusted Seller", nameAr: "بائع موثوق", icon: "badge-check", color: "#2196f3", earnedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString() },
          { slug: "fast_responder", name: "Fast Responder", nameAr: "رد سريع", icon: "zap", color: "#ff9800", earnedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
          { slug: "high_volume", name: "High Volume", nameAr: "حجم تداول عالي", icon: "trending-up", color: "#9c27b0", earnedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString() },
        ],
        paymentMethods: [
          { id: "pm-1", type: "bank_transfer", name: "Bank Misr", holderName: user.firstName || "Account Holder", isVerified: true },
          { id: "pm-2", type: "e_wallet", name: "Vodafone Cash", holderName: user.phone || "01xxxxxxxxx", isVerified: true },
          { id: "pm-3", type: "e_wallet", name: "InstaPay", holderName: user.firstName || "Account Holder", isVerified: false },
        ],
        recentTrades: [
          { id: "rt-1", type: "sell", amount: "500", currency: "USDT", fiatAmount: "15500", counterparty: "Buyer123", status: "completed", completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
          { id: "rt-2", type: "buy", amount: "200", currency: "USDT", fiatAmount: "6200", counterparty: "Seller456", status: "completed", completedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() },
          { id: "rt-3", type: "sell", amount: "1000", currency: "USDT", fiatAmount: "31000", counterparty: "Buyer789", status: "completed", completedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() },
        ],
      };

      res.json(profile);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/p2p/profile", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { displayName, bio, region } = req.body;
      res.json({ success: true, displayName, bio, region });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/p2p/settings", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      res.json({
        autoReplyEnabled: false,
        autoReplyMessage: "",
        notifyOnTrade: true,
        notifyOnDispute: true,
        notifyOnMessage: true,
        preferredCurrencies: ["EGP", "USD"],
        tradeLimits: {
          minBuy: "50",
          maxBuy: "10000",
          minSell: "50",
          maxSell: "10000",
        },
        autoConfirmEnabled: false,
        autoConfirmDelayMinutes: 15,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/p2p/settings", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const settings = req.body;
      res.json({ success: true, ...settings });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/p2p/badges", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      res.json([
        { slug: "verified", name: "Verified", nameAr: "موثق", description: "Complete phone and email verification", descriptionAr: "أكمل التحقق من الهاتف والبريد", icon: "shield-check", color: "#00c853", criteria: { requiresVerification: "phone" } },
        { slug: "trusted_seller", name: "Trusted Seller", nameAr: "بائع موثوق", description: "98% completion rate with 200+ trades", descriptionAr: "نسبة إتمام 98٪ مع أكثر من 200 صفقة", icon: "badge-check", color: "#2196f3", criteria: { minTrades: 200, minCompletionRate: 98 } },
        { slug: "trusted_buyer", name: "Trusted Buyer", nameAr: "مشتري موثوق", description: "98% completion rate with 200+ buy trades", descriptionAr: "نسبة إتمام 98٪ مع أكثر من 200 عملية شراء", icon: "user-check", color: "#2196f3", criteria: { minTrades: 200, minCompletionRate: 98 } },
        { slug: "fast_responder", name: "Fast Responder", nameAr: "رد سريع", description: "Average response time under 1 minute", descriptionAr: "متوسط وقت الرد أقل من دقيقة", icon: "zap", color: "#ff9800", criteria: { maxResponseTime: 60 } },
        { slug: "high_volume", name: "High Volume", nameAr: "حجم تداول عالي", description: "Total trading volume over $100,000", descriptionAr: "إجمالي حجم التداول أكثر من 100,000 دولار", icon: "trending-up", color: "#9c27b0", criteria: { minVolume: 100000 } },
        { slug: "new_star", name: "Rising Star", nameAr: "نجم صاعد", description: "50+ trades in 30 days with 100% completion", descriptionAr: "أكثر من 50 صفقة في 30 يوم بنسبة إتمام 100٪", icon: "star", color: "#ffc107", criteria: { trades30d: 50, completion30d: 100 } },
        { slug: "dispute_free", name: "Dispute Free", nameAr: "بدون نزاعات", description: "No disputes in last 100 trades", descriptionAr: "لا نزاعات في آخر 100 صفقة", icon: "shield", color: "#4caf50", criteria: { maxDisputeRate: 0 } },
        { slug: "premium_trader", name: "Premium Trader", nameAr: "تاجر مميز", description: "KYC verified with excellent track record", descriptionAr: "موثق بالهوية مع سجل ممتاز", icon: "crown", color: "#e91e63", criteria: { requiresVerification: "kyc_full", minTrades: 500 } },
        { slug: "top_rated", name: "Top Rated", nameAr: "الأعلى تقييماً", description: "4.9+ rating with 100+ reviews", descriptionAr: "تقييم 4.9+ مع أكثر من 100 مراجعة", icon: "award", color: "#ff5722", criteria: { minRating: 4.9, minRatings: 100 } },
      ]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/p2p/payment-methods", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      res.json([
        { id: "pm-1", type: "bank_transfer", name: "Bank Misr", accountNumber: "****1234", holderName: "User Name", isVerified: true, isActive: true },
        { id: "pm-2", type: "e_wallet", name: "Vodafone Cash", accountNumber: "01xxxxxxxx", holderName: "User Name", isVerified: true, isActive: true },
      ]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/p2p/payment-methods", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { type, name, accountNumber, bankName, holderName, details } = req.body;
      const newMethod = {
        id: `pm-${Date.now()}`,
        type,
        name,
        accountNumber,
        bankName,
        holderName,
        details,
        isVerified: false,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      res.status(201).json(newMethod);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/p2p/payment-methods/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== FREE REWARDS ====================

  app.get("/api/free/rewards", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      res.json({
        dailyBonus: { available: true, amount: 0.50, streak: 3, nextClaim: null },
        adsWatched: 2,
        maxAdsPerDay: 10,
        adReward: 0.10,
        referrals: 5,
        referralReward: 5.00,
        trialGamesPlayed: 3,
        trialReward: 0.25,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/free/claim-daily", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      res.json({ success: true, amount: 0.50 });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/free/watch-ad", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      res.json({ success: true, amount: 0.10 });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== CHALLENGES ====================

  const challenges: any[] = [];
  const spectatorBets: any[] = [];
  const challengeRatings: any[] = [];
  const challengerFollows: { id: string; followerId: string; followedId: string; createdAt: Date }[] = [];

  // ==================== CHALLENGER FOLLOWS ROUTES ====================

  app.get("/api/challenger-follows", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const follows = challengerFollows
        .filter(f => f.followerId === req.user!.id)
        .map(f => ({ userId: f.followedId }));
      res.json(follows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/challenger-follows", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { followedId } = req.body;
      
      if (followedId === req.user!.id) {
        return res.status(400).json({ error: "Cannot follow yourself" });
      }
      
      const existing = challengerFollows.find(
        f => f.followerId === req.user!.id && f.followedId === followedId
      );
      
      if (existing) {
        return res.status(400).json({ error: "Already following this challenger" });
      }
      
      const follow = {
        id: crypto.randomUUID(),
        followerId: req.user!.id,
        followedId,
        createdAt: new Date(),
      };
      
      challengerFollows.push(follow);
      res.json(follow);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/challenger-follows/:userId", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const index = challengerFollows.findIndex(
        f => f.followerId === req.user!.id && f.followedId === userId
      );
      
      if (index === -1) {
        return res.status(404).json({ error: "Follow not found" });
      }
      
      challengerFollows.splice(index, 1);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/challenges/available", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const available = challenges.filter(c => c.status === 'waiting' && c.player1Id !== req.user!.id && c.visibility === 'public');
      if (available.length === 0) {
        res.json([
          {
            id: "challenge-demo-1",
            gameType: "domino",
            betAmount: 10,
            status: "waiting",
            visibility: "public",
            player1Id: "user-123",
            player1Name: "GamerPro",
            player1Rating: { wins: 15, losses: 5, winRate: 75, rank: "gold" },
            timeLimit: 60,
            spectatorCount: 12,
            totalBets: 150,
            createdAt: new Date().toISOString(),
          },
          {
            id: "challenge-demo-2",
            gameType: "chess",
            betAmount: 25,
            status: "waiting",
            visibility: "public",
            player1Id: "user-456",
            player1Name: "ChessMaster",
            player1Rating: { wins: 42, losses: 8, winRate: 84, rank: "platinum" },
            timeLimit: 120,
            spectatorCount: 28,
            totalBets: 320,
            createdAt: new Date().toISOString(),
          },
          {
            id: "challenge-demo-3",
            gameType: "backgammon",
            betAmount: 15,
            status: "active",
            visibility: "public",
            player1Id: "user-789",
            player1Name: "BackgammonKing",
            player1Rating: { wins: 23, losses: 12, winRate: 66, rank: "silver" },
            player2Id: "user-101",
            player2Name: "RollMaster",
            player2Rating: { wins: 18, losses: 9, winRate: 67, rank: "silver" },
            player1Score: 3,
            player2Score: 2,
            timeLimit: 90,
            spectatorCount: 45,
            totalBets: 580,
            createdAt: new Date(Date.now() - 600000).toISOString(),
            startedAt: new Date(Date.now() - 300000).toISOString(),
          },
        ]);
        return;
      }
      res.json(available);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/challenges/public", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      res.json([
        {
          id: "challenge-live-1",
          gameType: "domino",
          betAmount: 50,
          status: "active",
          visibility: "public",
          player1Id: "user-abc",
          player1Name: "DominoKing",
          player1Rating: { wins: 67, losses: 23, winRate: 74, rank: "gold" },
          player2Id: "user-def",
          player2Name: "TileChamp",
          player2Rating: { wins: 45, losses: 30, winRate: 60, rank: "silver" },
          player1Score: 4,
          player2Score: 3,
          timeLimit: 60,
          spectatorCount: 89,
          totalBets: 1250,
          createdAt: new Date(Date.now() - 1200000).toISOString(),
          startedAt: new Date(Date.now() - 600000).toISOString(),
        },
        {
          id: "challenge-live-2",
          gameType: "chess",
          betAmount: 100,
          status: "active",
          visibility: "public",
          player1Id: "user-ghi",
          player1Name: "GrandMaster99",
          player1Rating: { wins: 156, losses: 12, winRate: 93, rank: "diamond" },
          player2Id: "user-jkl",
          player2Name: "QueenSlayer",
          player2Rating: { wins: 89, losses: 34, winRate: 72, rank: "gold" },
          player1Score: 1,
          player2Score: 0,
          timeLimit: 180,
          spectatorCount: 234,
          totalBets: 4500,
          createdAt: new Date(Date.now() - 1800000).toISOString(),
          startedAt: new Date(Date.now() - 900000).toISOString(),
        },
      ]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/challenges/my", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const my = challenges.filter(c => c.player1Id === req.user!.id || c.player2Id === req.user!.id);
      res.json(my);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/challenges", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { gameType, betAmount, opponentType, friendAccountId, visibility = 'public' } = req.body;
      const challenge = {
        id: `challenge-${Date.now()}`,
        gameType,
        betAmount,
        visibility,
        status: 'waiting',
        player1Id: req.user!.id,
        player1Name: req.user!.username,
        player1Rating: { wins: 0, losses: 0, winRate: 0, rank: "bronze" },
        player2Id: opponentType === 'friend' ? friendAccountId : null,
        player2Name: null,
        player1Score: 0,
        player2Score: 0,
        timeLimit: 60,
        spectatorCount: 0,
        totalBets: 0,
        createdAt: new Date().toISOString(),
      };
      challenges.push(challenge);
      res.json(challenge);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/challenges/:id/join", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const challenge = challenges.find(c => c.id === req.params.id);
      if (!challenge) {
        return res.status(404).json({ error: "Challenge not found" });
      }
      challenge.player2Id = req.user!.id;
      challenge.player2Name = req.user!.username;
      challenge.player2Rating = { wins: 0, losses: 0, winRate: 0, rank: "bronze" };
      challenge.status = 'active';
      challenge.startedAt = new Date().toISOString();
      res.json(challenge);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/challenges/:id/withdraw", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const challenge = challenges.find(c => c.id === req.params.id && c.player1Id === req.user!.id);
      if (!challenge) {
        return res.status(404).json({ error: "Challenge not found" });
      }
      challenge.status = 'cancelled';
      const penalty = challenge.betAmount * 0.7;
      res.json({ success: true, penalty });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/challenges/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const challenge = challenges.find(c => c.id === req.params.id);
      if (!challenge) {
        res.json({
          id: req.params.id,
          gameType: "domino",
          betAmount: 50,
          status: "active",
          visibility: "public",
          player1Id: "user-abc",
          player1Name: "DominoKing",
          player1Rating: { wins: 67, losses: 23, winRate: 74, rank: "gold" },
          player2Id: "user-def",
          player2Name: "TileChamp",
          player2Rating: { wins: 45, losses: 30, winRate: 60, rank: "silver" },
          player1Score: 4,
          player2Score: 3,
          timeLimit: 60,
          spectatorCount: 89,
          totalBets: 1250,
          createdAt: new Date(Date.now() - 1200000).toISOString(),
          startedAt: new Date(Date.now() - 600000).toISOString(),
        });
        return;
      }
      res.json(challenge);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/challenges/:id/bet", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { backedPlayerId, betAmount } = req.body;
      const bet = {
        id: `bet-${Date.now()}`,
        challengeId: req.params.id,
        spectatorId: req.user!.id,
        spectatorName: req.user!.username,
        backedPlayerId,
        betAmount,
        potentialWinnings: betAmount * 1.9,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      spectatorBets.push(bet);
      res.json(bet);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/challenges/:id/bets", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const bets = spectatorBets.filter(b => b.challengeId === req.params.id);
      res.json(bets);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/challenges/:id/gifts", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      res.json([
        { id: "gift-1", senderName: "Fan123", giftName: "Fire", giftIcon: "flame", recipientName: "DominoKing", sentAt: new Date(Date.now() - 30000).toISOString() },
        { id: "gift-2", senderName: "Supporter99", giftName: "Trophy", giftIcon: "trophy", recipientName: "TileChamp", sentAt: new Date(Date.now() - 60000).toISOString() },
      ]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/challenges/:id/gifts", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { recipientId, giftId, quantity = 1 } = req.body;
      res.json({ success: true, giftId, recipientId, quantity });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== CHALLENGE GAME SESSIONS ====================

  app.get("/api/challenges/:id/session", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { challengeGameSessions: sessions } = await import("@shared/schema");
      const [session] = await db.select()
        .from(sessions)
        .where(eq(sessions.challengeId, req.params.id))
        .orderBy(desc(sessions.createdAt))
        .limit(1);
      res.json(session || null);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/challenges/:id/session", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { challengeGameSessions: sessions, challenges: challengesTable } = await import("@shared/schema");
      
      const [challenge] = await db.select().from(challengesTable).where(eq(challengesTable.id, req.params.id));
      if (!challenge) {
        return res.status(404).json({ error: "Challenge not found" });
      }
      
      if (challenge.player1Id !== req.user!.id && challenge.player2Id !== req.user!.id) {
        return res.status(403).json({ error: "Not a participant in this challenge" });
      }

      const initialState = challenge.gameType === "chess" 
        ? { fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", moveCount: 0 }
        : { myHand: [], opponentTileCount: 7, boardTiles: [], leftEnd: -1, rightEnd: -1, boneyard: 14 };

      const [session] = await db.insert(sessions).values({
        challengeId: req.params.id,
        gameType: challenge.gameType,
        currentTurn: challenge.player1Id,
        player1TimeRemaining: challenge.timeLimit || 300,
        player2TimeRemaining: challenge.timeLimit || 300,
        gameState: JSON.stringify(initialState),
        status: "playing",
      }).returning();

      await db.update(challengesTable)
        .set({ status: "in_progress", startedAt: new Date() })
        .where(eq(challengesTable.id, req.params.id));

      res.json(session);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== CHALLENGE POINTS ====================

  app.post("/api/challenge-points", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { challengePointsLedger } = await import("@shared/schema");
      const { challengeId, targetPlayerId, pointsAmount } = req.body;

      if (!challengeId || !targetPlayerId || !pointsAmount) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const [entry] = await db.insert(challengePointsLedger).values({
        challengeId,
        userId: req.user!.id,
        targetPlayerId,
        pointsAmount: parseInt(pointsAmount),
        reason: "boost_challenge",
      }).returning();

      res.json(entry);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/challenges/:id/points", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { challengePointsLedger } = await import("@shared/schema");
      const points = await db.select()
        .from(challengePointsLedger)
        .where(eq(challengePointsLedger.challengeId, req.params.id))
        .orderBy(desc(challengePointsLedger.createdAt));
      res.json(points);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== CHALLENGER FOLLOWS ====================

  app.get("/api/challenger-follows", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      res.json([]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/challenger-follows", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { followedId } = req.body;
      res.json({ id: `follow-${Date.now()}`, followerId: req.user!.id, followedId, createdAt: new Date().toISOString() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/challenger-follows/:userId", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/user/rating", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      res.json({
        userId: req.user!.id,
        totalChallenges: 25,
        wins: 18,
        losses: 7,
        draws: 0,
        winRate: 72,
        currentStreak: 3,
        bestStreak: 8,
        totalEarnings: "450.00",
        rank: "gold",
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== GIFT SHOP ====================

  app.get("/api/gifts", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      res.json([
        { id: "gift-rose", name: "Rose", nameAr: "وردة", price: "0.50", iconUrl: "heart", category: "love", animationType: "float", coinValue: 5 },
        { id: "gift-fire", name: "Fire", nameAr: "نار", price: "1.00", iconUrl: "flame", category: "gaming", animationType: "burst", coinValue: 10 },
        { id: "gift-trophy", name: "Trophy", nameAr: "كأس", price: "5.00", iconUrl: "trophy", category: "celebration", animationType: "spin", coinValue: 50 },
        { id: "gift-crown", name: "Crown", nameAr: "تاج", price: "10.00", iconUrl: "crown", category: "celebration", animationType: "rain", coinValue: 100 },
        { id: "gift-rocket", name: "Rocket", nameAr: "صاروخ", price: "25.00", iconUrl: "rocket", category: "gaming", animationType: "burst", coinValue: 250 },
        { id: "gift-diamond", name: "Diamond", nameAr: "ماسة", price: "50.00", iconUrl: "gem", category: "love", animationType: "spin", coinValue: 500 },
        { id: "gift-star", name: "Star", nameAr: "نجمة", price: "2.00", iconUrl: "star", category: "general", animationType: "float", coinValue: 20 },
        { id: "gift-lightning", name: "Lightning", nameAr: "برق", price: "3.00", iconUrl: "zap", category: "gaming", animationType: "burst", coinValue: 30 },
      ]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/gifts/inventory", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      res.json([
        { id: "inv-1", giftId: "gift-fire", giftName: "Fire", giftNameAr: "نار", iconUrl: "flame", quantity: 5, coinValue: 10 },
        { id: "inv-2", giftId: "gift-rose", giftName: "Rose", giftNameAr: "وردة", iconUrl: "heart", quantity: 10, coinValue: 5 },
        { id: "inv-3", giftId: "gift-star", giftName: "Star", giftNameAr: "نجمة", iconUrl: "star", quantity: 3, coinValue: 20 },
      ]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gifts/purchase", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { giftId, quantity = 1 } = req.body;
      res.json({ success: true, giftId, quantity, message: "Gift purchased successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== NOTIFICATIONS API ====================

  app.get("/api/notifications", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userNotifications = await db.select()
        .from(notifications)
        .where(eq(notifications.userId, req.user!.id))
        .orderBy(desc(notifications.createdAt))
        .limit(50);
      res.json(userNotifications);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/notifications/unread-count", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const unread = await db.select()
        .from(notifications)
        .where(and(
          eq(notifications.userId, req.user!.id),
          eq(notifications.isRead, false)
        ));
      res.json({ count: unread.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/notifications/:id/read", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const [updated] = await db.update(notifications)
        .set({ isRead: true, readAt: new Date() })
        .where(and(
          eq(notifications.id, req.params.id),
          eq(notifications.userId, req.user!.id)
        ))
        .returning();
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/notifications/mark-all-read", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      await db.update(notifications)
        .set({ isRead: true, readAt: new Date() })
        .where(and(
          eq(notifications.userId, req.user!.id),
          eq(notifications.isRead, false)
        ));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== USER RELATIONSHIPS API ====================

  app.get("/api/users/friends", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const following = await storage.getUserFollowing(req.user!.id);
      const followers = await storage.getUserFollowers(req.user!.id);
      
      const followingIds = new Set(following.map(r => r.targetUserId));
      const followerIds = new Set(followers.map(r => r.userId));
      
      const mutualIds = [...followingIds].filter(id => followerIds.has(id));
      
      const friends = await Promise.all(
        mutualIds.map(async (id) => {
          const user = await storage.getUser(id);
          if (user) {
            const { password, ...safeUser } = user;
            return safeUser;
          }
          return null;
        })
      );
      
      res.json(friends.filter(Boolean));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/users/following", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const following = await storage.getUserFollowing(req.user!.id);
      
      const users = await Promise.all(
        following.map(async (rel) => {
          const user = await storage.getUser(rel.targetUserId);
          if (user) {
            const { password, ...safeUser } = user;
            return safeUser;
          }
          return null;
        })
      );
      
      res.json(users.filter(Boolean));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/users/followers", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const followers = await storage.getUserFollowers(req.user!.id);
      
      const users = await Promise.all(
        followers.map(async (rel) => {
          const user = await storage.getUser(rel.userId);
          if (user) {
            const { password, ...safeUser } = user;
            return safeUser;
          }
          return null;
        })
      );
      
      res.json(users.filter(Boolean));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/users/blocked", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const blocked = await storage.getUserBlocked(req.user!.id);
      
      const users = await Promise.all(
        blocked.map(async (rel) => {
          const user = await storage.getUser(rel.targetUserId);
          if (user) {
            const { password, ...safeUser } = user;
            return safeUser;
          }
          return null;
        })
      );
      
      res.json(users.filter(Boolean));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/users/follow/:userId", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const targetUserId = req.params.userId;
      
      if (targetUserId === req.user!.id) {
        return res.status(400).json({ error: "Cannot follow yourself" });
      }
      
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const isBlocked = await storage.getUserRelationship(targetUserId, req.user!.id, "block");
      if (isBlocked) {
        return res.status(403).json({ error: "Cannot follow this user" });
      }
      
      const existing = await storage.getUserRelationship(req.user!.id, targetUserId, "follow");
      if (existing) {
        return res.status(400).json({ error: "Already following this user" });
      }
      
      await storage.createUserRelationship({
        userId: req.user!.id,
        targetUserId,
        type: "follow",
        status: "active",
      });
      
      const currentUser = await storage.getUser(req.user!.id);
      await db.insert(notifications).values({
        userId: targetUserId,
        title: "New Follower",
        titleAr: "متابع جديد",
        message: `${currentUser?.username || "Someone"} started following you`,
        messageAr: `بدأ ${currentUser?.username || "شخص ما"} بمتابعتك`,
        type: "system",
        priority: "normal",
      });
      
      const reverseFollow = await storage.getUserRelationship(targetUserId, req.user!.id, "follow");
      if (reverseFollow) {
        await db.insert(notifications).values({
          userId: req.user!.id,
          title: "New Friend",
          titleAr: "صديق جديد",
          message: `You and ${targetUser.username} are now friends!`,
          messageAr: `أنت و ${targetUser.username} أصدقاء الآن!`,
          type: "system",
          priority: "normal",
        });
        await db.insert(notifications).values({
          userId: targetUserId,
          title: "New Friend",
          titleAr: "صديق جديد",
          message: `You and ${currentUser?.username || "a user"} are now friends!`,
          messageAr: `أنت و ${currentUser?.username || "مستخدم"} أصدقاء الآن!`,
          type: "system",
          priority: "normal",
        });
      }
      
      res.json({ success: true, message: "Now following user" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/users/unfollow/:userId", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const targetUserId = req.params.userId;
      
      await storage.deleteUserRelationship(req.user!.id, targetUserId, "follow");
      
      res.json({ success: true, message: "Unfollowed user" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/users/block/:userId", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const targetUserId = req.params.userId;
      
      if (targetUserId === req.user!.id) {
        return res.status(400).json({ error: "Cannot block yourself" });
      }
      
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      await storage.deleteUserRelationship(req.user!.id, targetUserId, "follow");
      await storage.deleteUserRelationship(targetUserId, req.user!.id, "follow");
      
      const existing = await storage.getUserRelationship(req.user!.id, targetUserId, "block");
      if (!existing) {
        await storage.createUserRelationship({
          userId: req.user!.id,
          targetUserId,
          type: "block",
          status: "active",
        });
      }
      
      res.json({ success: true, message: "User blocked" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/users/unblock/:userId", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const targetUserId = req.params.userId;
      
      await storage.deleteUserRelationship(req.user!.id, targetUserId, "block");
      
      res.json({ success: true, message: "User unblocked" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/users/search", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const query = (req.query.q as string) || "";
      
      if (query.length < 2) {
        return res.json([]);
      }
      
      const users = await storage.searchUsers(query, req.user!.id);
      const following = await storage.getUserFollowing(req.user!.id);
      const followingIds = new Set(following.map(r => r.targetUserId));
      
      const results = users.map(user => {
        const { password, ...safeUser } = user;
        return {
          ...safeUser,
          isFollowing: followingIds.has(user.id),
        };
      });
      
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/users/:accountId/profile", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const accountId = req.params.accountId;
      
      const user = await storage.getUserByAccountId(accountId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const { password, ...safeUser } = user;
      
      const following = await storage.getUserFollowing(req.user!.id);
      const followers = await storage.getUserFollowers(req.user!.id);
      const blocked = await storage.getUserBlocked(req.user!.id);
      
      const isFollowing = following.some(r => r.targetUserId === user.id);
      const isFollower = followers.some(r => r.userId === user.id);
      const isBlocked = blocked.some(r => r.targetUserId === user.id);
      const isFriend = isFollowing && isFollower;
      
      res.json({
        ...safeUser,
        isFollowing,
        isFollower,
        isBlocked,
        isFriend,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== CHAT ROUTES ====================

  // Get chat settings (check if chat is enabled)
  app.get("/api/chat/settings", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const settings = await db.select().from(chatSettings);
      const settingsMap: Record<string, string> = {};
      settings.forEach(s => {
        settingsMap[s.key] = s.value || "";
      });
      res.json(settingsMap);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get list of conversations
  app.get("/api/chat/conversations", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      
      // Get all messages involving the user
      const allMessages = await db.select()
        .from(chatMessages)
        .where(or(
          eq(chatMessages.senderId, userId),
          eq(chatMessages.receiverId, userId)
        ))
        .orderBy(desc(chatMessages.createdAt));
      
      // Group by conversation partner
      const conversationsMap = new Map<string, {
        otherUserId: string;
        lastMessage: typeof allMessages[0];
        unreadCount: number;
      }>();
      
      for (const msg of allMessages) {
        const otherUserId = msg.senderId === userId ? msg.receiverId : msg.senderId;
        
        if (!conversationsMap.has(otherUserId)) {
          conversationsMap.set(otherUserId, {
            otherUserId,
            lastMessage: msg,
            unreadCount: 0,
          });
        }
        
        // Count unread messages
        if (msg.receiverId === userId && !msg.isRead) {
          const conv = conversationsMap.get(otherUserId)!;
          conv.unreadCount++;
        }
      }
      
      // Get user info for each conversation
      const conversations = [];
      for (const [otherUserId, conv] of conversationsMap) {
        const [otherUser] = await db.select({
          id: users.id,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          avatarUrl: users.avatarUrl,
          accountId: users.accountId,
        }).from(users).where(eq(users.id, otherUserId));
        
        if (otherUser) {
          conversations.push({
            ...conv,
            otherUser,
          });
        }
      }
      
      res.json(conversations);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get message history with a specific user
  app.get("/api/chat/:userId/messages", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const otherUserId = req.params.userId;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const messages = await db.select()
        .from(chatMessages)
        .where(or(
          and(eq(chatMessages.senderId, userId), eq(chatMessages.receiverId, otherUserId)),
          and(eq(chatMessages.senderId, otherUserId), eq(chatMessages.receiverId, userId))
        ))
        .orderBy(desc(chatMessages.createdAt))
        .limit(limit)
        .offset(offset);
      
      res.json(messages.reverse());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Send a message (fallback if WebSocket not available)
  app.post("/api/chat/:userId/messages", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const senderId = req.user!.id;
      const receiverId = req.params.userId;
      const { content, messageType = "text", attachmentUrl } = req.body;
      
      // Check if chat is enabled
      const chatEnabledSetting = await db.select().from(chatSettings).where(eq(chatSettings.key, "isEnabled")).limit(1);
      if (chatEnabledSetting.length > 0 && chatEnabledSetting[0].value === "false") {
        return res.status(403).json({ error: "Chat is currently disabled" });
      }
      
      if (!content || content.trim() === "") {
        return res.status(400).json({ error: "Message content is required" });
      }
      
      const [message] = await db.insert(chatMessages).values({
        senderId,
        receiverId,
        content: content.trim(),
        messageType,
        attachmentUrl,
      }).returning();
      
      res.status(201).json(message);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Mark a message as read
  app.put("/api/chat/messages/:messageId/read", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const messageId = req.params.messageId;
      
      const [updated] = await db.update(chatMessages)
        .set({ isRead: true, readAt: new Date() })
        .where(and(
          eq(chatMessages.id, messageId),
          eq(chatMessages.receiverId, userId)
        ))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: "Message not found or not authorized" });
      }
      
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Mark all messages from a user as read
  app.put("/api/chat/:userId/read", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const otherUserId = req.params.userId;
      
      await db.update(chatMessages)
        .set({ isRead: true, readAt: new Date() })
        .where(and(
          eq(chatMessages.senderId, otherUserId),
          eq(chatMessages.receiverId, userId),
          eq(chatMessages.isRead, false)
        ));
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== MATCHMAKING ROUTES ====================

  // Join random matchmaking queue
  app.post("/api/games/:gameId/matchmaking/random", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { gameId } = req.params;

      // Check if game exists
      const game = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
      if (game.length === 0) {
        return res.status(404).json({ error: "Game not found" });
      }

      // Check free play limit
      const freePlayLimitSetting = await db.select().from(gameplaySettings).where(eq(gameplaySettings.key, "freePlayLimit")).limit(1);
      if (freePlayLimitSetting.length > 0) {
        const limit = parseInt(freePlayLimitSetting[0].value) || 0;
        if (limit > 0) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const todayMatches = await db.select().from(gameMatches)
            .where(and(
              or(eq(gameMatches.player1Id, userId), eq(gameMatches.player2Id, userId)),
              sql`${gameMatches.createdAt} >= ${today}`
            ));
          if (todayMatches.length >= limit) {
            return res.status(400).json({ error: "Daily free play limit reached" });
          }
        }
      }

      // Check if already in queue
      const existingQueue = await db.select().from(matchmakingQueue)
        .where(and(
          eq(matchmakingQueue.userId, userId),
          eq(matchmakingQueue.status, "waiting")
        ));
      if (existingQueue.length > 0) {
        return res.status(400).json({ error: "Already in matchmaking queue" });
      }

      // Try to find a match - get all waiting players for random selection
      const waitingPlayers = await db.select().from(matchmakingQueue)
        .where(and(
          eq(matchmakingQueue.gameId, gameId),
          eq(matchmakingQueue.matchType, "random"),
          eq(matchmakingQueue.status, "waiting"),
          sql`${matchmakingQueue.userId} != ${userId}`
        ));

      if (waitingPlayers.length > 0) {
        // Fisher-Yates shuffle using crypto.randomInt for true randomness
        const shuffled = [...waitingPlayers];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = crypto.randomInt(0, i + 1);
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const opponent = shuffled[0];
        
        // Update opponent's queue status
        await db.update(matchmakingQueue)
          .set({ status: "matched" })
          .where(eq(matchmakingQueue.id, opponent.id));

        // Create match
        const [match] = await db.insert(gameMatches).values({
          gameId,
          player1Id: opponent.userId,
          player2Id: userId,
          status: "pending",
        }).returning();

        res.json({ matched: true, match });
      } else {
        // Join queue
        const [queueEntry] = await db.insert(matchmakingQueue).values({
          gameId,
          userId,
          matchType: "random",
          status: "waiting",
        }).returning();

        res.json({ matched: false, queueEntry });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Invite friend to match
  app.post("/api/games/:gameId/matchmaking/friend", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { gameId } = req.params;
      const { friendAccountId } = req.body;

      if (!friendAccountId) {
        return res.status(400).json({ error: "Friend account ID required" });
      }

      // Find friend by account ID
      const friend = await db.select().from(users).where(eq(users.accountId, friendAccountId)).limit(1);
      if (friend.length === 0) {
        return res.status(404).json({ error: "Friend not found" });
      }

      if (friend[0].id === userId) {
        return res.status(400).json({ error: "Cannot invite yourself" });
      }

      // Check if either user has blocked the other
      const blockedByFriend = await storage.getUserRelationship(friend[0].id, userId, "block");
      const blockedByUser = await storage.getUserRelationship(userId, friend[0].id, "block");
      if (blockedByFriend || blockedByUser) {
        return res.status(403).json({ error: "Cannot invite this user" });
      }

      // Check if game exists
      const game = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
      if (game.length === 0) {
        return res.status(404).json({ error: "Game not found" });
      }

      // Create pending match as invitation
      const [match] = await db.insert(gameMatches).values({
        gameId,
        player1Id: userId,
        player2Id: friend[0].id,
        status: "pending",
      }).returning();

      // Create queue entry for tracking
      await db.insert(matchmakingQueue).values({
        gameId,
        userId,
        matchType: "friend",
        friendAccountId,
        status: "waiting",
      });

      res.json({ match, friendId: friend[0].id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Cancel matchmaking
  app.delete("/api/games/matchmaking/cancel", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;

      await db.update(matchmakingQueue)
        .set({ status: "cancelled" })
        .where(and(
          eq(matchmakingQueue.userId, userId),
          eq(matchmakingQueue.status, "waiting")
        ));

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get matchmaking status
  app.get("/api/games/matchmaking/status", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;

      const queueEntry = await db.select().from(matchmakingQueue)
        .where(and(
          eq(matchmakingQueue.userId, userId),
          eq(matchmakingQueue.status, "waiting")
        ))
        .orderBy(desc(matchmakingQueue.createdAt))
        .limit(1);

      const pendingMatches = await db.select().from(gameMatches)
        .where(and(
          eq(gameMatches.player2Id, userId),
          eq(gameMatches.status, "pending")
        ))
        .orderBy(desc(gameMatches.createdAt));

      const activeMatches = await db.select().from(gameMatches)
        .where(and(
          or(eq(gameMatches.player1Id, userId), eq(gameMatches.player2Id, userId)),
          eq(gameMatches.status, "in_progress")
        ))
        .orderBy(desc(gameMatches.createdAt));

      res.json({
        inQueue: queueEntry.length > 0 ? queueEntry[0] : null,
        pendingInvites: pendingMatches,
        activeMatches,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Accept match invitation
  app.post("/api/games/matches/:matchId/accept", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { matchId } = req.params;

      const [match] = await db.select().from(gameMatches).where(eq(gameMatches.id, matchId));
      if (!match) {
        return res.status(404).json({ error: "Match not found" });
      }

      if (match.player2Id !== userId) {
        return res.status(403).json({ error: "Not authorized" });
      }

      if (match.status !== "pending") {
        return res.status(400).json({ error: "Match already started or cancelled" });
      }

      const [updated] = await db.update(gameMatches)
        .set({ status: "in_progress", startedAt: new Date() })
        .where(eq(gameMatches.id, matchId))
        .returning();

      // Update queue entries
      await db.update(matchmakingQueue)
        .set({ status: "matched" })
        .where(and(
          or(eq(matchmakingQueue.userId, match.player1Id), eq(matchmakingQueue.userId, match.player2Id)),
          eq(matchmakingQueue.status, "waiting")
        ));

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Decline match invitation
  app.post("/api/games/matches/:matchId/decline", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { matchId } = req.params;

      const [match] = await db.select().from(gameMatches).where(eq(gameMatches.id, matchId));
      if (!match) {
        return res.status(404).json({ error: "Match not found" });
      }

      if (match.player2Id !== userId) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const [updated] = await db.update(gameMatches)
        .set({ status: "cancelled" })
        .where(eq(gameMatches.id, matchId))
        .returning();

      // Update queue entries
      await db.update(matchmakingQueue)
        .set({ status: "cancelled" })
        .where(and(
          eq(matchmakingQueue.userId, match.player1Id),
          eq(matchmakingQueue.status, "waiting")
        ));

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get match details
  app.get("/api/games/matches/:matchId", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { matchId } = req.params;

      const [match] = await db.select().from(gameMatches).where(eq(gameMatches.id, matchId));
      if (!match) {
        return res.status(404).json({ error: "Match not found" });
      }

      if (match.player1Id !== userId && match.player2Id !== userId) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Get player details
      const [player1] = await db.select({
        id: users.id,
        username: users.username,
        accountId: users.accountId,
        avatarUrl: users.avatarUrl,
        vipLevel: users.vipLevel,
      }).from(users).where(eq(users.id, match.player1Id));

      const [player2] = await db.select({
        id: users.id,
        username: users.username,
        accountId: users.accountId,
        avatarUrl: users.avatarUrl,
        vipLevel: users.vipLevel,
      }).from(users).where(eq(users.id, match.player2Id));

      const [game] = await db.select().from(games).where(eq(games.id, match.gameId));

      res.json({ ...match, player1, player2, game });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get all games for matchmaking
  app.get("/api/games/available", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const availableGames = await db.select().from(games).where(eq(games.status, "active"));
      res.json(availableGames);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== GAMEPLAY EMOJIS & IN-GAME CHAT ====================

  // Get all active gameplay emojis
  app.get("/api/gameplay/emojis", async (req: Request, res: Response) => {
    try {
      const emojis = await db.query.gameplayEmojis.findMany({
        where: eq(gameplayEmojis.isActive, true),
        orderBy: [gameplayEmojis.sortOrder],
      });
      res.json(emojis);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Create gameplay emoji
  app.post("/api/admin/gameplay/emojis", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { emoji, name, nameAr, price, category } = req.body;
      const [newEmoji] = await db.insert(gameplayEmojis).values({
        emoji,
        name,
        nameAr,
        price: price || "0.50",
        category: category || "general",
      }).returning();
      res.json(newEmoji);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Update gameplay emoji
  app.patch("/api/admin/gameplay/emojis/:id", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const [updated] = await db.update(gameplayEmojis)
        .set(updates)
        .where(eq(gameplayEmojis.id, id))
        .returning();
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Delete gameplay emoji
  app.delete("/api/admin/gameplay/emojis/:id", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      await db.delete(gameplayEmojis).where(eq(gameplayEmojis.id, id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Send in-game message (text or emoji)
  app.post("/api/gameplay/messages", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { matchId, message, emojiId, isEmoji } = req.body;

      // Verify user is part of the match
      const [match] = await db.select().from(gameMatches).where(eq(gameMatches.id, matchId));
      if (!match) {
        return res.status(404).json({ error: "Match not found" });
      }
      if (match.player1Id !== userId && match.player2Id !== userId) {
        return res.status(403).json({ error: "Not authorized" });
      }

      let emojiCost = null;

      // If sending emoji, deduct balance
      if (isEmoji && emojiId) {
        const [emoji] = await db.select().from(gameplayEmojis).where(eq(gameplayEmojis.id, emojiId));
        if (!emoji) {
          return res.status(404).json({ error: "Emoji not found" });
        }

        const [user] = await db.select().from(users).where(eq(users.id, userId));
        const userBalance = parseFloat(user.balance);
        const emojiPrice = parseFloat(emoji.price);

        if (userBalance < emojiPrice) {
          return res.status(400).json({ error: "Insufficient balance for emoji" });
        }

        // Deduct balance
        const newBalance = (userBalance - emojiPrice).toFixed(2);
        await db.update(users)
          .set({ balance: newBalance })
          .where(eq(users.id, userId));

        emojiCost = emoji.price;
      }

      // Create message
      const [newMessage] = await db.insert(gameplayMessages).values({
        matchId,
        senderId: userId,
        message: isEmoji ? null : message,
        emojiId: isEmoji ? emojiId : null,
        isEmoji: isEmoji || false,
        emojiCost,
      }).returning();

      // Get sender info for response
      const [sender] = await db.select({
        id: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
      }).from(users).where(eq(users.id, userId));

      const responseMessage = { ...newMessage, sender };

      // If emoji, include emoji details
      if (isEmoji && emojiId) {
        const [emoji] = await db.select().from(gameplayEmojis).where(eq(gameplayEmojis.id, emojiId));
        responseMessage.emoji = emoji;
      }

      res.json(responseMessage);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get messages for a match
  app.get("/api/gameplay/messages/:matchId", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { matchId } = req.params;

      // Verify user is part of the match
      const [match] = await db.select().from(gameMatches).where(eq(gameMatches.id, matchId));
      if (!match) {
        return res.status(404).json({ error: "Match not found" });
      }
      if (match.player1Id !== userId && match.player2Id !== userId) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const messages = await db.query.gameplayMessages.findMany({
        where: eq(gameplayMessages.matchId, matchId),
        orderBy: [gameplayMessages.createdAt],
        with: {
          sender: {
            columns: { id: true, username: true, avatarUrl: true },
          },
          emoji: true,
        },
      });

      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Seed default emojis if none exist
  (async () => {
    try {
      const existingEmojis = await db.select().from(gameplayEmojis).limit(1);
      if (existingEmojis.length === 0) {
        const defaultEmojis = [
          { emoji: "👍", name: "Thumbs Up", nameAr: "إعجاب", price: "0.50", category: "reactions", sortOrder: 1 },
          { emoji: "😂", name: "Laughing", nameAr: "ضحك", price: "0.50", category: "emotions", sortOrder: 2 },
          { emoji: "🔥", name: "Fire", nameAr: "نار", price: "1.00", category: "special", sortOrder: 3 },
          { emoji: "💰", name: "Money Bag", nameAr: "كيس نقود", price: "2.00", category: "special", sortOrder: 4 },
          { emoji: "🎉", name: "Party", nameAr: "احتفال", price: "1.50", category: "celebrations", sortOrder: 5 },
          { emoji: "😎", name: "Cool", nameAr: "رائع", price: "0.75", category: "emotions", sortOrder: 6 },
          { emoji: "💎", name: "Diamond", nameAr: "ماس", price: "3.00", category: "premium", sortOrder: 7 },
          { emoji: "🏆", name: "Trophy", nameAr: "كأس", price: "2.50", category: "premium", sortOrder: 8 },
          { emoji: "👑", name: "Crown", nameAr: "تاج", price: "5.00", category: "premium", sortOrder: 9 },
          { emoji: "💀", name: "Skull", nameAr: "جمجمة", price: "1.00", category: "reactions", sortOrder: 10 },
        ];
        await db.insert(gameplayEmojis).values(defaultEmojis);
        console.log("Default gameplay emojis created");
      }
    } catch (error) {
      console.error("Failed to seed gameplay emojis:", error);
    }
  })();

  // ==================== GAME SECTIONS API ====================

  // Get all game sections (public)
  app.get("/api/game-sections", async (_req: Request, res: Response) => {
    try {
      const sections = await db.select().from(gameSections)
        .where(eq(gameSections.isActive, true))
        .orderBy(gameSections.sortOrder);
      res.json(sections);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get most played games (public)
  app.get("/api/games/most-played", async (_req: Request, res: Response) => {
    try {
      const mostPlayed = await db.select().from(games)
        .where(eq(games.status, "active"))
        .orderBy(desc(games.playCount))
        .limit(10);
      res.json(mostPlayed);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Get all sections
  app.get("/api/admin/game-sections", authMiddleware, adminMiddleware, async (_req: AuthRequest, res: Response) => {
    try {
      const sections = await db.select().from(gameSections).orderBy(gameSections.sortOrder);
      res.json(sections);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Create section
  app.post("/api/admin/game-sections", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const data = insertGameSectionSchema.parse(req.body);
      const [section] = await db.insert(gameSections).values(data).returning();
      res.status(201).json(section);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Admin: Update section
  app.patch("/api/admin/game-sections/:id", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const [section] = await db.update(gameSections)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(gameSections.id, id))
        .returning();
      if (!section) {
        return res.status(404).json({ error: "Section not found" });
      }
      res.json(section);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Admin: Delete section
  app.delete("/api/admin/game-sections/:id", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      await db.delete(gameSections).where(eq(gameSections.id, id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== ADVERTISEMENTS API ====================

  // Get active advertisements (public)
  app.get("/api/advertisements", async (_req: Request, res: Response) => {
    try {
      const now = new Date();
      const ads = await db.select().from(advertisements)
        .where(and(
          eq(advertisements.isActive, true),
          or(
            sql`${advertisements.startsAt} IS NULL`,
            sql`${advertisements.startsAt} <= ${now}`
          ),
          or(
            sql`${advertisements.endsAt} IS NULL`,
            sql`${advertisements.endsAt} >= ${now}`
          )
        ))
        .orderBy(advertisements.sortOrder);
      res.json(ads);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Get all advertisements
  app.get("/api/admin/advertisements", authMiddleware, adminMiddleware, async (_req: AuthRequest, res: Response) => {
    try {
      const ads = await db.select().from(advertisements).orderBy(advertisements.sortOrder);
      res.json(ads);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Create advertisement
  app.post("/api/admin/advertisements", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const data = insertAdvertisementSchema.parse(req.body);
      const [ad] = await db.insert(advertisements).values({
        ...data,
        createdBy: req.user!.id,
      }).returning();
      res.status(201).json(ad);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Admin: Update advertisement
  app.patch("/api/admin/advertisements/:id", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const [ad] = await db.update(advertisements)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(advertisements.id, id))
        .returning();
      if (!ad) {
        return res.status(404).json({ error: "Advertisement not found" });
      }
      res.json(ad);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Admin: Delete advertisement
  app.delete("/api/admin/advertisements/:id", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      await db.delete(advertisements).where(eq(advertisements.id, id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== ID VERIFICATION ROUTES ====================

  // Submit ID verification request
  app.post("/api/user/id-verification", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { frontImage, backImage } = req.body;
      if (!frontImage || !backImage) {
        return res.status(400).json({ error: "Both front and back ID images are required" });
      }
      
      await db.update(users)
        .set({
          idFrontImage: frontImage,
          idBackImage: backImage,
          idVerificationStatus: 'pending',
          idVerificationRejectionReason: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, req.user!.id));
      
      // Send notification to admins
      const adminUsers = await db.select().from(users).where(eq(users.role, 'admin'));
      for (const admin of adminUsers) {
        await db.insert(notifications).values({
          userId: admin.id,
          type: 'id_verification',
          title: 'New ID Verification Request',
          titleAr: 'طلب توثيق هوية جديد',
          message: `User ${req.user!.username} has submitted ID verification documents`,
          messageAr: `قام المستخدم ${req.user!.username} بتقديم وثائق التحقق من الهوية`,
          metadata: JSON.stringify({ userId: req.user!.id }),
          isRead: false,
        });
        sendNotification(admin.id, {
          type: 'id_verification_request',
          title: 'New ID Verification Request',
          message: `User ${req.user!.username} has submitted ID verification documents`,
        });
      }
      
      res.json({ success: true, message: "ID verification submitted successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get user's ID verification status
  app.get("/api/user/id-verification", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const [user] = await db.select({
        idVerificationStatus: users.idVerificationStatus,
        idFrontImage: users.idFrontImage,
        idBackImage: users.idBackImage,
        idVerificationRejectionReason: users.idVerificationRejectionReason,
        idVerifiedAt: users.idVerifiedAt,
      }).from(users).where(eq(users.id, req.user!.id));
      
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Get pending ID verifications
  app.get("/api/admin/id-verifications", authMiddleware, adminMiddleware, async (_req: AuthRequest, res: Response) => {
    try {
      const pendingVerifications = await db.select({
        id: users.id,
        username: users.username,
        nickname: users.nickname,
        email: users.email,
        phone: users.phone,
        idFrontImage: users.idFrontImage,
        idBackImage: users.idBackImage,
        idVerificationStatus: users.idVerificationStatus,
        createdAt: users.createdAt,
      }).from(users)
        .where(sql`${users.idVerificationStatus} IS NOT NULL`);
      
      res.json(pendingVerifications);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Approve or reject ID verification
  app.post("/api/admin/id-verifications/:userId/review", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const { action, reason } = req.body;
      
      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: "Invalid action" });
      }
      
      const updateData: any = {
        idVerificationStatus: action === 'approve' ? 'approved' : 'rejected',
        updatedAt: new Date(),
      };
      
      if (action === 'approve') {
        updateData.idVerifiedAt = new Date();
        updateData.idVerificationRejectionReason = null;
      } else {
        updateData.idVerificationRejectionReason = reason || 'Verification rejected';
      }
      
      await db.update(users).set(updateData).where(eq(users.id, userId));
      
      // Notify user
      const notificationTitle = action === 'approve' ? 'ID Verified' : 'ID Verification Rejected';
      const notificationTitleAr = action === 'approve' ? 'تم التحقق من الهوية' : 'تم رفض التحقق من الهوية';
      const notificationMessage = action === 'approve' 
        ? 'Your ID has been verified successfully'
        : `Your ID verification was rejected: ${reason || 'Please try again with clearer images'}`;
      const notificationMessageAr = action === 'approve'
        ? 'تم التحقق من هويتك بنجاح'
        : `تم رفض التحقق من هويتك: ${reason || 'يرجى المحاولة مرة أخرى بصور أوضح'}`;
      
      await db.insert(notifications).values({
        userId,
        type: 'id_verification',
        title: notificationTitle,
        titleAr: notificationTitleAr,
        message: notificationMessage,
        messageAr: notificationMessageAr,
        isRead: false,
      });
      
      sendNotification(userId, {
        type: 'id_verification_result',
        title: notificationTitle,
        message: notificationMessage,
      });
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== PROFILE PICTURE ROUTES ====================

  // Update profile picture
  app.post("/api/user/profile-picture", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { profilePicture } = req.body;
      if (!profilePicture) {
        return res.status(400).json({ error: "Profile picture is required" });
      }
      
      await db.update(users)
        .set({ profilePicture, updatedAt: new Date() })
        .where(eq(users.id, req.user!.id));
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update nickname
  app.post("/api/user/nickname", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { nickname } = req.body;
      if (!nickname || nickname.length < 3) {
        return res.status(400).json({ error: "Nickname must be at least 3 characters" });
      }
      
      // Check if nickname is unique
      const existing = await db.select().from(users).where(eq(users.nickname, nickname));
      if (existing.length > 0 && existing[0].id !== req.user!.id) {
        return res.status(400).json({ error: "Nickname already taken" });
      }
      
      await db.update(users)
        .set({ nickname, updatedAt: new Date() })
        .where(eq(users.id, req.user!.id));
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Check nickname availability
  app.get("/api/user/check-nickname/:nickname", async (req: Request, res: Response) => {
    try {
      const { nickname } = req.params;
      const existing = await db.select().from(users).where(eq(users.nickname, nickname));
      res.json({ available: existing.length === 0 });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get user P2P stats
  app.get("/api/user/:userId/p2p-stats", async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const [user] = await db.select({
        p2pRating: users.p2pRating,
        p2pTotalTrades: users.p2pTotalTrades,
        p2pSuccessfulTrades: users.p2pSuccessfulTrades,
        idVerificationStatus: users.idVerificationStatus,
        nickname: users.nickname,
        profilePicture: users.profilePicture,
        createdAt: users.createdAt,
      }).from(users).where(eq(users.id, userId));
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const successRate = user.p2pTotalTrades > 0 
        ? ((user.p2pSuccessfulTrades || 0) / user.p2pTotalTrades * 100).toFixed(1)
        : "100.0";
      
      res.json({
        ...user,
        successRate,
        isVerified: user.idVerificationStatus === 'approved',
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Seed default game sections
  (async () => {
    try {
      const existingSections = await db.select().from(gameSections).limit(1);
      if (existingSections.length === 0) {
        const defaultSections = [
          { key: "crash", nameEn: "Crash Games", nameAr: "ألعاب الانهيار", icon: "TrendingUp", iconColor: "text-red-500", sortOrder: 1 },
          { key: "dice", nameEn: "Dice Games", nameAr: "ألعاب النرد", icon: "Dices", iconColor: "text-blue-500", sortOrder: 2 },
          { key: "wheel", nameEn: "Wheel Games", nameAr: "ألعاب العجلة", icon: "CircleDot", iconColor: "text-purple-500", sortOrder: 3 },
          { key: "slots", nameEn: "Slot Machines", nameAr: "ماكينات القمار", icon: "Star", iconColor: "text-yellow-500", sortOrder: 4 },
          { key: "jackpot", nameEn: "Jackpot Games", nameAr: "ألعاب الجائزة الكبرى", icon: "Trophy", iconColor: "text-green-500", sortOrder: 5 },
        ];
        await db.insert(gameSections).values(defaultSections);
        console.log("Default game sections created");
      }
    } catch (error) {
      console.error("Failed to seed game sections:", error);
    }
  })();

  // ==================== ADMIN ID VERIFICATION ====================

  // Get all ID verification requests for admin
  app.get("/api/admin/id-verifications", authMiddleware, adminMiddleware, async (_req: AuthRequest, res: Response) => {
    try {
      const verifications = await db.select({
        id: users.id,
        username: users.username,
        nickname: users.nickname,
        email: users.email,
        phone: users.phone,
        idFrontImage: users.idFrontImage,
        idBackImage: users.idBackImage,
        idVerificationStatus: users.idVerificationStatus,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(sql`${users.idFrontImage} IS NOT NULL AND ${users.idBackImage} IS NOT NULL`)
      .orderBy(desc(users.createdAt));
      
      res.json(verifications);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Review ID verification (approve/reject)
  app.post("/api/admin/id-verifications/:userId/review", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const { action, reason } = req.body;
      
      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: "Invalid action" });
      }
      
      const status = action === 'approve' ? 'approved' : 'rejected';
      await storage.updateUser(userId, { idVerificationStatus: status });
      
      // Create notification for user
      const notificationTitle = action === 'approve' 
        ? 'ID Verification Approved' 
        : 'ID Verification Rejected';
      const notificationTitleAr = action === 'approve' 
        ? 'تم التوثيق بنجاح' 
        : 'تم رفض طلب التوثيق';
      const notificationMessage = action === 'approve'
        ? 'Your ID has been verified successfully. You can now access all P2P features.'
        : `Your ID verification was rejected. ${reason || 'Please upload clear images and try again.'}`;
      const notificationMessageAr = action === 'approve'
        ? 'تم التحقق من هويتك بنجاح. يمكنك الآن الوصول إلى جميع ميزات P2P.'
        : `تم رفض طلب التوثيق. ${reason || 'يرجى رفع صور واضحة والمحاولة مرة أخرى.'}`;
      
      await storage.createNotification({
        userId,
        type: 'id_verification',
        priority: 'high',
        title: notificationTitle,
        titleAr: notificationTitleAr,
        message: notificationMessage,
        messageAr: notificationMessageAr,
      });
      
      await storage.createAuditLog({
        userId: req.user!.id,
        action: 'user_update',
        entityType: 'user',
        entityId: userId,
        details: `ID verification ${action}: ${reason || ''}`,
      });
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== SOCIAL PLATFORMS (PUBLIC) ====================

  // Get enabled social platforms (public - for login/register pages)
  app.get("/api/social-platforms", async (_req: Request, res: Response) => {
    try {
      const platforms = await storage.getEnabledSocialPlatforms();
      const publicPlatforms = platforms.map(p => ({
        id: p.id,
        name: p.name,
        displayName: p.displayName,
        displayNameAr: p.displayNameAr,
        icon: p.icon,
        type: p.type,
        otpEnabled: p.otpEnabled,
      }));
      res.json(publicPlatforms);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Seed default social platforms if none exist
  (async () => {
    try {
      const existingPlatforms = await storage.listSocialPlatforms();
      if (existingPlatforms.length === 0) {
        const defaultPlatforms = [
          { name: "google", displayName: "Google", displayNameAr: "جوجل", icon: "SiGoogle", type: "oauth" as const, sortOrder: 1, isEnabled: true },
          { name: "facebook", displayName: "Facebook", displayNameAr: "فيسبوك", icon: "SiFacebook", type: "oauth" as const, sortOrder: 2, isEnabled: true },
          { name: "telegram", displayName: "Telegram", displayNameAr: "تيليجرام", icon: "SiTelegram", type: "both" as const, sortOrder: 3, isEnabled: true },
          { name: "whatsapp", displayName: "WhatsApp", displayNameAr: "واتساب", icon: "SiWhatsapp", type: "otp" as const, sortOrder: 4, isEnabled: true },
          { name: "twitter", displayName: "X (Twitter)", displayNameAr: "إكس (تويتر)", icon: "SiX", type: "oauth" as const, sortOrder: 5, isEnabled: true },
          { name: "apple", displayName: "Apple", displayNameAr: "آبل", icon: "SiApple", type: "oauth" as const, sortOrder: 6, isEnabled: true },
          { name: "discord", displayName: "Discord", displayNameAr: "ديسكورد", icon: "SiDiscord", type: "oauth" as const, sortOrder: 7, isEnabled: false },
          { name: "linkedin", displayName: "LinkedIn", displayNameAr: "لينكدإن", icon: "SiLinkedin", type: "oauth" as const, sortOrder: 8, isEnabled: false },
          { name: "github", displayName: "GitHub", displayNameAr: "جيت هاب", icon: "SiGithub", type: "oauth" as const, sortOrder: 9, isEnabled: false },
          { name: "tiktok", displayName: "TikTok", displayNameAr: "تيك توك", icon: "SiTiktok", type: "oauth" as const, sortOrder: 10, isEnabled: false },
          { name: "instagram", displayName: "Instagram", displayNameAr: "إنستجرام", icon: "SiInstagram", type: "oauth" as const, sortOrder: 11, isEnabled: false },
          { name: "sms", displayName: "SMS", displayNameAr: "رسائل SMS", icon: "Phone", type: "otp" as const, sortOrder: 12, isEnabled: false },
        ];
        for (const platform of defaultPlatforms) {
          await storage.createSocialPlatform(platform);
        }
        console.log("Default social platforms seeded");
      }
    } catch (error) {
      console.error("Failed to seed social platforms:", error);
    }
  })();

  // ==================== WEBSOCKET SETUP ====================

  setupWebSocket(httpServer);

  // ==================== ADMIN BOOTSTRAP (PRODUCTION-SAFE) ====================
  
  // Only create admin in development mode via environment variables
  // In production, admins must be created via secure bootstrap CLI or migration
  (async () => {
    try {
      // Check if any admin exists
      const existingAdmins = await db.select().from(users).where(eq(users.role, "admin")).limit(1);
      
      if (existingAdmins.length === 0) {
        // Only bootstrap in development OR if ADMIN_BOOTSTRAP_PASSWORD is set
        const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
        const isDevelopment = process.env.NODE_ENV !== "production";
        
        if (isDevelopment) {
          // Development mode: create with secure random password
          const devPassword = crypto.randomBytes(16).toString("hex");
          const hashedPassword = await bcrypt.hash(devPassword, 12);
          await storage.createUser({
            username: "admin",
            password: hashedPassword,
            email: "admin@vex.local",
            firstName: "Admin",
            lastName: "User",
            role: "admin",
            status: "active",
            accountId: "100000000",
            mustChangePassword: true,
          });
          console.log("========================================");
          console.log("🔐 DEVELOPMENT ADMIN CREATED");
          console.log(`   Username: admin`);
          console.log(`   Password: ${devPassword}`);
          console.log("   ⚠️  This password is temporary and must be changed!");
          console.log("========================================");
        } else if (bootstrapPassword && bootstrapPassword.length >= 16) {
          // Production bootstrap: use provided password (must be strong)
          const hashedPassword = await bcrypt.hash(bootstrapPassword, 12);
          await storage.createUser({
            username: "admin",
            password: hashedPassword,
            email: process.env.ADMIN_BOOTSTRAP_EMAIL || "admin@vex.local",
            firstName: "Admin",
            lastName: "User",
            role: "admin",
            status: "active",
            accountId: "100000000",
            mustChangePassword: true,
          });
          console.log("✅ Admin user bootstrapped from ADMIN_BOOTSTRAP_PASSWORD");
          console.log("   ⚠️  Remember to unset ADMIN_BOOTSTRAP_PASSWORD after first login!");
        } else {
          console.log("⚠️  No admin user exists. To create one:");
          console.log("   Set ADMIN_BOOTSTRAP_PASSWORD (min 16 chars) and ADMIN_BOOTSTRAP_EMAIL");
          console.log("   Then restart the server. Unset these vars after creation.");
        }
      }
    } catch (error) {
      console.error("Failed during admin bootstrap:", error);
    }
  })();

  return httpServer;
}
