import type { Express, Response } from "express";
import { storage } from "../storage";
import { authMiddleware, agentMiddleware, sensitiveRateLimiter, type AuthRequest } from "./middleware";

export function registerTransactionsRoutes(app: Express): void {
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
}
