/**
 * Challenge Routes - Refactored
 * All challenge endpoints using modular service layer
 */

import type { Express, Response } from "express";
import { authMiddleware, AuthRequest } from "./middleware";
import { db } from "../db";
import { eq, desc, or, and, isNull, ilike } from "drizzle-orm";
import { challenges as challengesTable, liveGameSessions } from "@shared/schema";

// Import all services
import {
  createChallenge,
  getAvailableChallenges,
  getPublicChallenges,
  getUserChallenges,
} from "../services/challenges/core/challenge-creator";
import {
  acceptChallenge,
  getChallengeDetails,
} from "../services/challenges/core/challenge-acceptor";
import {
  handleGameAbandonement,
  resignFromGame,
  updateSessionLastActivity,
} from "../services/game/game-abandonment";
import { broadcastToUser } from "../websocket";
import { storage } from "../storage";

export function registerChallengesRoutes(app: Express): void {
  /**
   * GET /api/challenges/available
   * Get available challenges for joining
   */
  app.get("/api/challenges/available", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const challenges = await getAvailableChallenges(req.user!.id);
      res.json(challenges);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/challenges/public
   * Get all public/active challenges for Arena view
   */
  app.get("/api/challenges/public", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const challenges = await getPublicChallenges();
      res.json(challenges);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/challenges/my
   * Get user's own challenges (MY CHALLENGES tab)
   */
  app.get("/api/challenges/my", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const challenges = await getUserChallenges(req.user!.id);
      res.json(challenges);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/challenges
   * Create a new challenge
   */
  app.post("/api/challenges", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const {
        gameType,
        betAmount,
        currencyType = 'project', // Default to project currency
        visibility = 'public',
        opponentType = 'random',
        friendAccountId,
        timeLimit,
      } = req.body;

      const result = await createChallenge({
        gameType,
        betAmount: parseFloat(betAmount),
        currencyType: currencyType as 'usd' | 'project',
        visibility: visibility as 'public' | 'private',
        opponentType: opponentType as 'random' | 'friend',
        friendAccountId,
        userId: req.user!.id,
        timeLimit: timeLimit || 300,
      });

      if (!result.success) {
        return res
          .status(result.errorCode === 'DEDUCTION_FAILED' ? 400 : 500)
          .json({ error: result.error, errorCode: result.errorCode });
      }

      res.json(result.challenge);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/challenges/:id/join
   * Accept/Join a challenge
   */
  app.post("/api/challenges/:id/join", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const result = await acceptChallenge({
        challengeId: req.params.id,
        userId: req.user!.id,
      });

      if (!result.success) {
        const statusCode =
          result.errorCode === 'RACE_CONDITION' ? 409 :
          result.errorCode === 'DEDUCTION_FAILED' ? 400 :
          404;
        return res.status(statusCode).json({ error: result.error });
      }

      res.json(result.challenge);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/challenges/:id/withdraw
   * Withdraw/Cancel a challenge (30% penalty)
   */
  app.post("/api/challenges/:id/withdraw", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const challengeId = req.params.id;
      const [challenge] = await db
        .select()
        .from(challengesTable)
        .where(eq(challengesTable.id, challengeId))
        .limit(1);

      if (!challenge || challenge.player1Id !== req.user!.id) {
        return res.status(404).json({ error: "Challenge not found" });
      }

      if (challenge.status !== 'waiting') {
        return res.status(400).json({ error: "Can only withdraw challenges in waiting status" });
      }

      // Calculate 30% penalty
      const betAmount = parseFloat(challenge.betAmount || '0');
      const penalty = betAmount * 0.30;

      // Update challenge status
      await db
        .update(challengesTable)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(challengesTable.id, challengeId));

      res.json({
        success: true,
        challengeId,
        penalty,
        refund: betAmount - penalty,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/challenges/:id
   * Get challenge details
   */
  app.get("/api/challenges/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const challenge = await getChallengeDetails(req.params.id);
      if (!challenge) {
        return res.status(404).json({ error: "Challenge not found" });
      }
      res.json(challenge);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/game-sessions/:id/activity
   * Update last activity for a game session (prevents inactivity timeout)
   */
  app.post("/api/game-sessions/:id/activity", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const success = await updateSessionLastActivity(req.params.id);
      res.json({ success });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/game-sessions/:id/resign
   * Resign from a game (voluntary forfeit)
   */
  app.post("/api/game-sessions/:id/resign", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const result = await resignFromGame(req.params.id, req.user!.id);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/challenges/:id/session
   * Get game session for a challenge
   */
  app.get("/api/challenges/:id/session", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const [session] = await db
        .select()
        .from(liveGameSessions)
        .where(eq(liveGameSessions.challengeId, req.params.id))
        .orderBy(desc(liveGameSessions.createdAt))
        .limit(1);

      res.json(session || null);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/challenges/:id/stake
   * Place a spectator support/bet
   */
  app.post("/api/challenges/:id/stake", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { backedPlayerId, stakeAmount } = req.body;
      
      if (!backedPlayerId || !stakeAmount || stakeAmount <= 0) {
        return res.status(400).json({ error: "Invalid stake parameters" });
      }

      // TODO: Implement actual stake creation with currency deduction
      const stake = {
        id: `stake-${Date.now()}`,
        challengeId: req.params.id,
        spectatorId: req.user!.id,
        backedPlayerId,
        stakeAmount,
        potentialWinnings: stakeAmount * 1.9,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      res.json(stake);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/challenges/:id/stakes
   * Get all stakes/supports for a challenge
   */
  app.get("/api/challenges/:id/stakes", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      // TODO: Fetch from database spectatorSupports table
      res.json([]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/challenges/:id/gift
   * Send a gift to a player
   */
  app.post("/api/challenges/:id/gift", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { recipientId, giftItemId, quantity = 1, message } = req.body;

      if (!recipientId || !giftItemId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // TODO: Implement actual gift sending with currency deduction and crediting
      const gift = {
        id: `gift-${Date.now()}`,
        sessionId: req.params.id,
        senderId: req.user!.id,
        recipientId,
        giftItemId,
        quantity,
        message,
        createdAt: new Date().toISOString(),
      };

      res.json(gift);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/challenges/:id/gifts
   * Get all gifts sent in a challenge/session
   */
  app.get("/api/challenges/:id/gifts", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      // TODO: Fetch from database spectatorGifts table
      res.json([]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
