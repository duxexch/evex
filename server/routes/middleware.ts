import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { JWT_USER_SECRET, JWT_ADMIN_SECRET } from "../lib/auth-config";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    username: string;
  };
}

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

export const registrationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many registration attempts, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

export const strictRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: "Too many attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const sensitiveRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: "Too many sensitive operations, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const attackProtectionLimiter = rateLimit({
  windowMs: 1000,
  max: 100,
  message: { error: "Request rate too high" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_USER_SECRET) as any;
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
};

export const adminMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

export const adminTokenMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers["x-admin-token"]?.toString();
  if (!token) {
    return res.status(401).json({ error: "Admin authentication required" });
  }
  try {
    const decoded = jwt.verify(token, JWT_ADMIN_SECRET) as any;
    if (decoded.role !== "admin") {
      return res.status(403).json({ error: "Admin access only" });
    }
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid admin token" });
  }
};

export const agentMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== "agent" && req.user?.role !== "admin") {
    return res.status(403).json({ error: "Agent access required" });
  }
  next();
};
