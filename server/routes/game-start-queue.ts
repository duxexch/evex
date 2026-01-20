import { Router } from "express";
import { db } from "../db";
import { authMiddleware, AuthRequest } from "./middleware";
import { 
  getPendingMessagesForUser, 
  markMessageAsDelivered,
  getQueueStatus 
} from "../services/challenges/core/game-start-queue";

export function setupGameStartQueueRoutes(router: Router) {
  /**
   * GET /api/game-start-messages/pending
   * Get pending game start messages for current user
   * Used as polling fallback when WebSocket is not available
   */
  router.get("/api/game-start-messages/pending", authMiddleware, (req: AuthRequest, res) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    
    const pendingMessages = getPendingMessagesForUser(userId);
    
    // Mark as delivered when user fetches them
    pendingMessages.forEach(msg => {
      markMessageAsDelivered(msg.payload.challengeId, userId);
    });
    
    res.json({
      messages: pendingMessages,
      count: pendingMessages.length,
    });
  });

  /**
   * POST /api/game-start-messages/:challengeId/acknowledge
   * Acknowledge that a game start message was received
   */
  router.post("/api/game-start-messages/:challengeId/acknowledge", authMiddleware, (req: AuthRequest, res) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    
    const { challengeId } = req.params;
    
    markMessageAsDelivered(challengeId, userId);
    
    res.json({ 
      success: true,
      message: "Message acknowledged" 
    });
  });

  /**
   * GET /api/admin/game-start-queue-status
   * Admin endpoint to monitor queue status
   */
  router.get("/api/admin/game-start-queue-status", authMiddleware, (req: AuthRequest, res) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    
    // In a real app, verify admin role here
    const status = getQueueStatus();
    
    res.json(status);
  });
}
