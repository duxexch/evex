import { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { storage } from "../storage";
import { db } from "../db";
import { otpVerifications } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { 
  authMiddleware, 
  AuthRequest,
  authRateLimiter,
  registrationRateLimiter,
  strictRateLimiter
} from "./middleware";

const JWT_USER_SECRET = process.env.JWT_SECRET || "development-secret-key";
const JWT_USER_EXPIRY = "7d";

export function registerAuthRoutes(app: Express) {
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
      
      const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_USER_SECRET, { expiresIn: JWT_USER_EXPIRY });
      
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
      
      const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_USER_SECRET, { expiresIn: JWT_USER_EXPIRY });
      
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
      
      const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_USER_SECRET, { expiresIn: JWT_USER_EXPIRY });
      
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
      
      const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_USER_SECRET, { expiresIn: JWT_USER_EXPIRY });
      
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
      
      const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_USER_SECRET, { expiresIn: JWT_USER_EXPIRY });
      
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
  
  // Login by email
  app.post("/api/auth/login-by-email", authRateLimiter, async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      
      const user = await storage.getUserByEmail(email);
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
      
      const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_USER_SECRET, { expiresIn: JWT_USER_EXPIRY });
      
      await storage.createAuditLog({
        userId: user.id,
        action: "login",
        entityType: "user",
        entityId: user.id,
        details: "Login by email",
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

  // Check if identifier (email/phone/accountId) exists
  app.post("/api/auth/check-identifier", authRateLimiter, async (req: Request, res: Response) => {
    try {
      const { identifier, type } = req.body;
      
      if (!identifier || !type) {
        return res.status(400).json({ error: "Identifier and type are required" });
      }
      
      let user = null;
      if (type === "email") {
        user = await storage.getUserByEmail(identifier);
      } else if (type === "phone") {
        user = await storage.getUserByPhone(identifier);
      } else if (type === "account") {
        user = await storage.getUserByAccountId(identifier);
      } else {
        return res.status(400).json({ error: "Invalid type" });
      }
      
      res.json({ exists: !!user, type });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create account from login attempt (auto-registration)
  app.post("/api/auth/create-from-identifier", registrationRateLimiter, async (req: Request, res: Response) => {
    try {
      const { identifier, type, password } = req.body;
      
      if (!identifier || !type || !password) {
        return res.status(400).json({ error: "Identifier, type, and password are required" });
      }
      
      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }
      
      // Check if already exists
      let existingUser = null;
      if (type === "email") {
        existingUser = await storage.getUserByEmail(identifier);
      } else if (type === "phone") {
        existingUser = await storage.getUserByPhone(identifier);
      }
      
      if (existingUser) {
        return res.status(400).json({ error: "Account already exists" });
      }
      
      // Generate unique username and account ID
      const accountId = Math.floor(100000000 + Math.random() * 900000000).toString();
      const username = type === "email" 
        ? identifier.split("@")[0] + "_" + Math.random().toString(36).substring(2, 6)
        : "user_" + Math.random().toString(36).substring(2, 10);
      
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const userData: any = {
        username,
        password: hashedPassword,
        accountId,
        role: "player",
        status: "active",
        emailVerified: false,
        phoneVerified: false,
      };
      
      if (type === "email") {
        userData.email = identifier;
      } else if (type === "phone") {
        userData.phone = identifier;
      }
      
      const user = await storage.createUser(userData);
      
      const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_USER_SECRET, { expiresIn: JWT_USER_EXPIRY });
      
      await storage.createAuditLog({
        userId: user.id,
        action: "login",
        entityType: "user",
        entityId: user.id,
        details: "Auto-registered from login attempt",
        ipAddress: req.ip,
      });
      
      res.json({ 
        user: { ...user, password: undefined }, 
        token,
        message: "Account created successfully. Please verify your " + type + "."
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Send OTP for verification
  app.post("/api/auth/otp/send", authMiddleware, strictRateLimiter, async (req: AuthRequest, res: Response) => {
    try {
      const { contactType, contactValue } = req.body;
      const userId = req.user!.id;
      
      if (!contactType || !contactValue) {
        return res.status(400).json({ error: "Contact type and value are required" });
      }
      
      if (!["email", "phone"].includes(contactType)) {
        return res.status(400).json({ error: "Invalid contact type" });
      }
      
      // Generate 6-digit OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const codeHash = await bcrypt.hash(otpCode, 10);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      // Delete any existing OTP for this user and contact type
      await db.delete(otpVerifications)
        .where(and(
          eq(otpVerifications.userId, userId),
          eq(otpVerifications.contactType, contactType)
        ));
      
      // Create new OTP
      await db.insert(otpVerifications).values({
        userId,
        contactType,
        contactValue,
        codeHash,
        expiresAt,
        attempts: 0,
        maxAttempts: 5,
      });
      
      // In production, send OTP via email/SMS service
      // For now, log it (in dev mode)
      if (process.env.NODE_ENV !== "production") {
        console.log(`[OTP] Code for ${contactType} ${contactValue}: ${otpCode}`);
      }
      
      // Mask the contact value for response
      let maskedValue = contactValue;
      if (contactType === "email") {
        const [name, domain] = contactValue.split("@");
        maskedValue = name.substring(0, 2) + "***@" + domain;
      } else if (contactType === "phone") {
        maskedValue = contactValue.substring(0, 3) + "****" + contactValue.substring(contactValue.length - 3);
      }
      
      res.json({ 
        success: true, 
        message: `OTP sent to ${maskedValue}`,
        expiresIn: 600, // 10 minutes in seconds
        // Only in development for testing
        ...(process.env.NODE_ENV !== "production" && { devOtp: otpCode })
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Verify OTP
  app.post("/api/auth/otp/verify", authMiddleware, strictRateLimiter, async (req: AuthRequest, res: Response) => {
    try {
      const { contactType, code } = req.body;
      const userId = req.user!.id;
      
      if (!contactType || !code) {
        return res.status(400).json({ error: "Contact type and code are required" });
      }
      
      // Get latest OTP for this user and contact type
      const [otpRecord] = await db.select()
        .from(otpVerifications)
        .where(and(
          eq(otpVerifications.userId, userId),
          eq(otpVerifications.contactType, contactType)
        ))
        .orderBy(desc(otpVerifications.createdAt))
        .limit(1);
      
      if (!otpRecord) {
        return res.status(400).json({ error: "No OTP request found. Please request a new one." });
      }
      
      // Check if expired
      if (new Date() > otpRecord.expiresAt) {
        return res.status(400).json({ error: "OTP has expired. Please request a new one." });
      }
      
      // Check if already consumed
      if (otpRecord.consumedAt) {
        return res.status(400).json({ error: "OTP has already been used." });
      }
      
      // Check max attempts
      if (otpRecord.attempts >= otpRecord.maxAttempts) {
        return res.status(400).json({ error: "Too many failed attempts. Please request a new OTP." });
      }
      
      // Verify OTP
      const isValid = await bcrypt.compare(code, otpRecord.codeHash);
      
      if (!isValid) {
        // Increment attempts
        await db.update(otpVerifications)
          .set({ attempts: otpRecord.attempts + 1 })
          .where(eq(otpVerifications.id, otpRecord.id));
        
        return res.status(400).json({ 
          error: "Invalid OTP code.",
          attemptsRemaining: otpRecord.maxAttempts - otpRecord.attempts - 1
        });
      }
      
      // Mark OTP as consumed
      await db.update(otpVerifications)
        .set({ consumedAt: new Date() })
        .where(eq(otpVerifications.id, otpRecord.id));
      
      // Update user verification status
      if (contactType === "email") {
        await storage.updateUser(userId, { 
          emailVerified: true,
          email: otpRecord.contactValue 
        });
      } else if (contactType === "phone") {
        await storage.updateUser(userId, { 
          phoneVerified: true,
          phone: otpRecord.contactValue 
        });
      }
      
      await storage.createAuditLog({
        userId,
        action: "settings_change",
        entityType: "user",
        entityId: userId,
        details: `${contactType} verified: ${otpRecord.contactValue}`,
      });
      
      res.json({ 
        success: true, 
        message: contactType === "email" ? "Email verified successfully" : "Phone verified successfully"
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
