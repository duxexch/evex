import type { Express, Response } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { authMiddleware, type AuthRequest } from "./middleware";
import { transactions } from "@shared/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import crypto from "crypto";

export async function registerAdminTransactionsRoutes(app: Express): Promise<void> {
  // Get pending transactions for review
  app.get("/api/admin/transactions/pending", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const adminId = req.user?.id;

      if (!adminId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const pending = await storage.getPendingTransactions();
      const withFlags = await Promise.all(
        pending.map(async (tx: any) => ({
          ...tx,
          fraudFlags: await storage.listTransactionFraudFlags(tx.id),
        }))
      );

      res.json(withFlags);
    } catch (error) {
      console.error("Get pending transactions error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // List all transactions with filtering
  app.get("/api/admin/transactions", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { userId, type, status } = req.query as Record<string, string>;
      const adminId = req.user?.id;

      if (!adminId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      let txList = await storage.listTransactions(userId, type, status);
      txList.sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());

      res.json(txList.slice(0, 100)); // Limit to 100
    } catch (error) {
      console.error("List transactions error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get transaction details with fraud analysis
  app.get("/api/admin/transactions/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const adminId = req.user?.id;

      if (!adminId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const tx = await storage.getTransaction(id);
      if (!tx) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      const fraudFlags = await storage.listTransactionFraudFlags(id);
      const user = await storage.getUser(tx.userId);

      res.json({
        transaction: tx,
        user: {
          id: user?.id,
          username: user?.username,
          email: user?.email,
          vipLevel: user?.vipLevel,
        },
        fraudFlags,
        riskLevel: fraudFlags.some(f => f.severity === "critical")
          ? "critical"
          : fraudFlags.some(f => f.severity === "high")
          ? "high"
          : fraudFlags.some(f => f.severity === "medium")
          ? "medium"
          : "low",
      });
    } catch (error) {
      console.error("Get transaction error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Approve transaction
  app.post("/api/admin/transactions/:id/approve", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminId = req.user?.id;

      if (!adminId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const tx = await storage.getTransaction(id);
      if (!tx) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      // Check for critical fraud flags
      const criticalFlags = await storage.listTransactionFraudFlags(id, "critical");
      if (criticalFlags.length > 0 && !reason) {
        return res.status(400).json({ error: "Must provide reason to override critical flags" });
      }

      // Update transaction - using atomic update
      const updated = await storage.updateTransaction(id, {
        status: "approved",
        adminNote: reason || "",
      });

      // Mark flags as reviewed
      for (const flag of await storage.listTransactionFraudFlags(id)) {
        await storage.updateTransactionFraudFlag(flag.id, {
          status: "reviewed",
          reviewedBy: adminId,
          reviewedAt: new Date(),
        });
      }

      res.json({ message: "Transaction approved", transaction: updated });
    } catch (error) {
      console.error("Approve transaction error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Reject transaction
  app.post("/api/admin/transactions/:id/reject", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminId = req.user?.id;

      if (!adminId || !reason) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const tx = await storage.getTransaction(id);
      if (!tx) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      const updated = await storage.updateTransaction(id, {
        status: "rejected",
        adminNote: reason,
      });

      res.json({ message: "Transaction rejected", transaction: updated });
    } catch (error) {
      console.error("Reject transaction error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create fraud flag
  app.post("/api/admin/transactions/:id/flag", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { severity, reason } = req.body;
      const adminId = req.user?.id;

      if (!adminId || !severity || !reason) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      if (!["low", "medium", "high", "critical"].includes(severity)) {
        return res.status(400).json({ error: "Invalid severity level" });
      }

      const tx = await storage.getTransaction(id);
      if (!tx) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      const flag = await storage.createTransactionFraudFlag({
        id: crypto.randomBytes(16).toString("hex"),
        transactionId: id,
        severity,
        reason,
        status: "pending",
        flaggedBy: adminId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      res.json({ message: "Fraud flag created", flag });
    } catch (error) {
      console.error("Create fraud flag error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Review fraud flag
  app.post("/api/admin/transactions/:id/review-flag/:flagId", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id, flagId } = req.params;
      const { decision } = req.body;
      const adminId = req.user?.id;

      if (!adminId || !decision) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      if (!["approved", "rejected", "escalated"].includes(decision)) {
        return res.status(400).json({ error: "Invalid decision" });
      }

      const flag = await storage.getTransactionFraudFlag(flagId);
      if (!flag) {
        return res.status(404).json({ error: "Flag not found" });
      }

      const updated = await storage.updateTransactionFraudFlag(flagId, {
        status: decision,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      });

      res.json({ message: "Flag reviewed", flag: updated });
    } catch (error) {
      console.error("Review flag error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get user transactions
  app.get("/api/admin/users/:userId/transactions", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const adminId = req.user?.id;

      if (!adminId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const userTxs = await storage.listTransactions(userId);
      userTxs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      res.json(userTxs.slice(0, 50)); // Limit to 50
    } catch (error) {
      console.error("Get user transactions error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get daily statistics
  app.get("/api/admin/transactions/stats/dashboard", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const adminId = req.user?.id;

      if (!adminId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const allTxs = await storage.listTransactions();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayTxs = allTxs.filter(tx => tx.createdAt >= today);

      const deposits = todayTxs.filter(tx => tx.type === "deposit");
      const withdrawals = todayTxs.filter(tx => tx.type === "withdrawal");
      const pending = todayTxs.filter(tx => tx.status === "pending");

      const depositTotal = deposits.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
      const withdrawalTotal = withdrawals.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

      res.json({
        daily: {
          deposits: {
            count: deposits.length,
            total: depositTotal.toFixed(2),
          },
          withdrawals: {
            count: withdrawals.length,
            total: withdrawalTotal.toFixed(2),
          },
          pending: {
            count: pending.length,
          },
          net: (depositTotal - withdrawalTotal).toFixed(2),
        },
        status: {
          approved: allTxs.filter(tx => tx.status === "approved").length,
          rejected: allTxs.filter(tx => tx.status === "rejected").length,
          pending: allTxs.filter(tx => tx.status === "pending").length,
        },
      });
    } catch (error) {
      console.error("Get stats error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Reverse transaction
  app.post("/api/admin/transactions/:id/reverse", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminId = req.user?.id;

      if (!adminId || !reason) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const tx = await storage.getTransaction(id);
      if (!tx) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      if (tx.status === "cancelled") {
        return res.status(400).json({ error: "Transaction already cancelled/reversed" });
      }

      // If transaction was approved and affected balance, reverse it
      if (tx.status === "approved" && (tx.type === "deposit" || tx.type === "win")) {
        const user = await storage.getUser(tx.userId);
        if (user) {
          const reverseAmount = parseFloat(tx.amount);
          await storage.updateUserBalance(tx.userId, reverseAmount.toString(), "subtract");
        }
      }

      const updated = await storage.updateTransaction(id, {
        status: "cancelled",
        adminNote: reason,
      });

      res.json({ message: "Transaction reversed", transaction: updated });
    } catch (error) {
      console.error("Reverse transaction error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
