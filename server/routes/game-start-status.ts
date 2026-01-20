/**
 * Game Start Status Route
 * Endpoints to check and manage game start status
 * Used by client for polling and verification
 */

import express, { Request, Response } from 'express';
import { db } from '../db';
import { liveGameSessions, challenges } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { authMiddleware, AuthRequest } from './middleware';

const router = express.Router();

/**
 * GET /api/game-start/status/:challengeId
 * Check if a game has started for this challenge
 * Returns game session details if game is ready
 */
router.get(
  '/status/:challengeId',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { challengeId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      console.log(`[Game Start Status] Checking status for challenge ${challengeId} for user ${userId}`);

      // Get the challenge
      const [challenge] = await db
        .select()
        .from(challenges)
        .where(eq(challenges.id, challengeId))
        .limit(1);

      if (!challenge) {
        return res.status(404).json({ error: 'Challenge not found' });
      }

      // Verify user is part of this challenge
      if (challenge.player1Id !== userId && challenge.player2Id !== userId) {
        console.log(`[Game Start Status] User ${userId} not part of this challenge`);
        return res.status(403).json({ error: 'Not authorized' });
      }

      // Check if game session exists
      const [gameSession] = await db
        .select()
        .from(liveGameSessions)
        .where(eq(liveGameSessions.challengeId, challengeId))
        .limit(1);

      if (!gameSession) {
        console.log(`[Game Start Status] No game session for challenge ${challengeId}`);
        return res.json({
          ready: false,
          challenge: {
            id: challenge.id,
            status: challenge.status,
            gameType: challenge.gameType,
          },
        });
      }

      console.log(`[Game Start Status] ✓ Game ready: ${gameSession.id}`);
      return res.json({
        ready: true,
        challenge: {
          id: challenge.id,
          status: challenge.status,
          gameType: challenge.gameType,
        },
        session: {
          id: gameSession.id,
          status: gameSession.status,
          player1Id: gameSession.player1Id,
          player2Id: gameSession.player2Id,
        },
      });
    } catch (error: any) {
      console.error('[Game Start Status] Error:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
