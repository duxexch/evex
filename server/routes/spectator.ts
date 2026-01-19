import type { Express, Response } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { authMiddleware, adminTokenMiddleware, AuthRequest } from "./middleware";
import { calculateOdds, calculatePotentialWinnings, type PlayerStats } from "../lib/odds-calculator";

export function registerSpectatorRoutes(app: Express): void {
  // ==================== SPECTATOR SUPPORT SYSTEM (ادعم واربح) ====================

  // Admin endpoints for support settings (uses adminTokenMiddleware for admin panel)
  app.get("/api/admin/support-settings", adminTokenMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const settings = await storage.getSupportSettingsList();
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/support-settings/:gameType", adminTokenMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const settings = await storage.getSupportSettings(req.params.gameType);
      if (!settings) {
        return res.status(404).json({ error: "Support settings not found for this game type" });
      }
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/support-settings/:gameType", adminTokenMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const settings = await storage.updateSupportSettings(req.params.gameType, req.body);
      if (!settings) {
        return res.status(404).json({ error: "Support settings not found for this game type" });
      }
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/support-settings", adminTokenMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { gameType, ...settingsData } = req.body;
      if (!gameType) {
        return res.status(400).json({ error: "gameType is required" });
      }
      const existing = await storage.getSupportSettings(gameType);
      if (existing) {
        return res.status(400).json({ error: "Support settings already exist for this game type" });
      }
      const settings = await storage.createSupportSettings({ gameType, ...settingsData });
      res.status(201).json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // User endpoints for spectator supports
  app.get("/api/challenges/:challengeId/supports", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const supports = await storage.getSpectatorSupportsByChallenge(req.params.challengeId);
      res.json(supports);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/challenges/:challengeId/odds", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { challenges } = await import("@shared/schema");
      const [challenge] = await db.select().from(challenges).where(eq(challenges.id, req.params.challengeId));
      
      if (!challenge) {
        return res.status(404).json({ error: "Challenge not found" });
      }

      const player1 = await storage.getUser(challenge.player1Id);
      if (!player1) {
        return res.status(404).json({ error: "Player 1 not found" });
      }

      const player2 = challenge.player2Id ? await storage.getUser(challenge.player2Id) : null;
      
      const settings = await storage.getSupportSettings(challenge.gameType);
      
      const player1Stats: PlayerStats = {
        gamesWon: player1.gamesWon,
        gamesLost: player1.gamesLost,
        gamesPlayed: player1.gamesPlayed,
        currentWinStreak: player1.currentWinStreak,
        longestWinStreak: player1.longestWinStreak,
        chessWon: player1.chessWon,
        chessPlayed: player1.chessPlayed,
        backgammonWon: player1.backgammonWon,
        backgammonPlayed: player1.backgammonPlayed,
        dominoWon: player1.dominoWon,
        dominoPlayed: player1.dominoPlayed,
        tarneebWon: player1.tarneebWon,
        tarneebPlayed: player1.tarneebPlayed,
        balootWon: player1.balootWon,
        balootPlayed: player1.balootPlayed,
      };

      const player2Stats: PlayerStats = player2 ? {
        gamesWon: player2.gamesWon,
        gamesLost: player2.gamesLost,
        gamesPlayed: player2.gamesPlayed,
        currentWinStreak: player2.currentWinStreak,
        longestWinStreak: player2.longestWinStreak,
        chessWon: player2.chessWon,
        chessPlayed: player2.chessPlayed,
        backgammonWon: player2.backgammonWon,
        backgammonPlayed: player2.backgammonPlayed,
        dominoWon: player2.dominoWon,
        dominoPlayed: player2.dominoPlayed,
        tarneebWon: player2.tarneebWon,
        tarneebPlayed: player2.tarneebPlayed,
        balootWon: player2.balootWon,
        balootPlayed: player2.balootPlayed,
      } : {
        gamesWon: 0,
        gamesLost: 0,
        gamesPlayed: 0,
        currentWinStreak: 0,
      };

      const odds = calculateOdds(player1Stats, player2Stats, settings || undefined, challenge.gameType);

      res.json({
        challengeId: challenge.id,
        gameType: challenge.gameType,
        player1: {
          id: player1.id,
          username: player1.username,
          odds: odds.player1Odds,
          probability: odds.player1Probability,
        },
        player2: player2 ? {
          id: player2.id,
          username: player2.username,
          odds: odds.player2Odds,
          probability: odds.player2Probability,
        } : null,
        houseFeePercent: odds.houseFeePercent,
        instantMatchOdds: settings?.instantMatchOdds || "1.80",
        allowInstantMatch: settings?.allowInstantMatch ?? true,
        minSupportAmount: parseFloat(settings?.minSupportAmount || "1.00"),
        maxSupportAmount: parseFloat(settings?.maxSupportAmount || "1000.00"),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/challenges/:challengeId/support", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { playerId, amount, mode } = req.body;
      const supporterId = req.user!.id;
      const challengeId = req.params.challengeId;

      if (!playerId || !amount || !mode) {
        return res.status(400).json({ error: "playerId, amount, and mode are required" });
      }

      if (mode !== "instant" && mode !== "wait_for_match") {
        return res.status(400).json({ error: "mode must be 'instant' or 'wait_for_match'" });
      }

      const supportAmount = parseFloat(amount);
      if (isNaN(supportAmount) || supportAmount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      const { challenges, spectatorSupports, matchedSupports } = await import("@shared/schema");
      const [challenge] = await db.select().from(challenges).where(eq(challenges.id, challengeId));
      
      if (!challenge) {
        return res.status(404).json({ error: "Challenge not found" });
      }

      if (challenge.status !== "waiting" && challenge.status !== "active") {
        return res.status(400).json({ error: "Challenge is not accepting supports" });
      }

      if (playerId !== challenge.player1Id && playerId !== challenge.player2Id) {
        return res.status(400).json({ error: "Invalid player ID for this challenge" });
      }

      if (supporterId === challenge.player1Id || supporterId === challenge.player2Id) {
        return res.status(400).json({ error: "Players cannot support themselves" });
      }

      const settings = await storage.getSupportSettings(challenge.gameType);
      if (!settings?.isEnabled) {
        return res.status(400).json({ error: "Support is not enabled for this game type" });
      }

      const minAmount = parseFloat(settings.minSupportAmount);
      const maxAmount = parseFloat(settings.maxSupportAmount);
      if (supportAmount < minAmount || supportAmount > maxAmount) {
        return res.status(400).json({ 
          error: `Support amount must be between ${minAmount} and ${maxAmount}` 
        });
      }

      if (mode === "instant" && !settings.allowInstantMatch) {
        return res.status(400).json({ error: "Instant match is not allowed for this game type" });
      }

      const wallet = await storage.getOrCreateProjectCurrencyWallet(supporterId);
      const availableBalance = parseFloat(wallet.purchasedBalance) + parseFloat(wallet.earnedBalance) - parseFloat(wallet.lockedBalance);
      if (availableBalance < supportAmount) {
        return res.status(400).json({ error: "Insufficient project currency balance" });
      }

      const lockResult = await storage.lockProjectCurrencyBalance(wallet.id, amount);
      if (!lockResult.success) {
        return res.status(400).json({ error: lockResult.error || "Failed to lock balance" });
      }

      let odds: number;
      let potentialWinnings: number;

      if (mode === "instant") {
        odds = parseFloat(settings.instantMatchOdds);
        const winningsCalc = calculatePotentialWinnings(supportAmount, odds);
        potentialWinnings = winningsCalc.potentialWinnings;
      } else {
        const player1 = await storage.getUser(challenge.player1Id);
        const player2 = challenge.player2Id ? await storage.getUser(challenge.player2Id) : null;
        
        if (!player1) {
          await storage.unlockProjectCurrencyBalance(wallet.id, amount);
          return res.status(404).json({ error: "Player 1 not found" });
        }

        const player1Stats: PlayerStats = {
          gamesWon: player1.gamesWon,
          gamesLost: player1.gamesLost,
          gamesPlayed: player1.gamesPlayed,
          currentWinStreak: player1.currentWinStreak,
        };

        const player2Stats: PlayerStats = player2 ? {
          gamesWon: player2.gamesWon,
          gamesLost: player2.gamesLost,
          gamesPlayed: player2.gamesPlayed,
          currentWinStreak: player2.currentWinStreak,
        } : { gamesWon: 0, gamesLost: 0, gamesPlayed: 0, currentWinStreak: 0 };

        const oddsResult = calculateOdds(player1Stats, player2Stats, settings, challenge.gameType);
        odds = playerId === challenge.player1Id ? oddsResult.player1Odds : oddsResult.player2Odds;
        const winningsCalc = calculatePotentialWinnings(supportAmount, odds);
        potentialWinnings = winningsCalc.potentialWinnings;
      }

      const houseFee = supportAmount * (parseFloat(settings.houseFeePercent) / 100);

      const support = await storage.createSpectatorSupport({
        challengeId,
        supporterId,
        supportedPlayerId: playerId,
        amount: supportAmount.toFixed(2),
        odds: odds.toFixed(2),
        potentialWinnings: potentialWinnings.toFixed(2),
        mode,
        status: "pending",
        houseFee: houseFee.toFixed(2),
      });

      if (mode === "wait_for_match") {
        const oppositePlayerId = playerId === challenge.player1Id ? challenge.player2Id : challenge.player1Id;
        
        if (oppositePlayerId) {
          const pendingOppositeSupports = await storage.getPendingSupportsForPlayer(challengeId, oppositePlayerId);
          
          if (pendingOppositeSupports.length > 0) {
            const oppositeSupport = pendingOppositeSupports[0];
            
            const totalPool = supportAmount + parseFloat(oppositeSupport.amount);
            const totalHouseFee = houseFee + parseFloat(oppositeSupport.houseFee);

            const matched = await storage.createMatchedSupport({
              challengeId,
              support1Id: support.id,
              support2Id: oppositeSupport.id,
              totalPool: totalPool.toFixed(2),
              houseFeeTotal: totalHouseFee.toFixed(2),
            });

            await storage.updateSpectatorSupport(support.id, { 
              status: "matched", 
              matchedSupportId: oppositeSupport.id 
            });
            await storage.updateSpectatorSupport(oppositeSupport.id, { 
              status: "matched", 
              matchedSupportId: support.id 
            });

            return res.status(201).json({
              support,
              matched: true,
              matchedSupport: matched,
            });
          }
        }
      }

      res.status(201).json({
        support,
        matched: false,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/supports/:supportId", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const support = await storage.getSpectatorSupport(req.params.supportId);
      
      if (!support) {
        return res.status(404).json({ error: "Support not found" });
      }

      if (support.supporterId !== req.user!.id) {
        return res.status(403).json({ error: "Not authorized to cancel this support" });
      }

      if (support.status !== "pending") {
        return res.status(400).json({ error: "Only pending supports can be cancelled" });
      }

      const wallet = await storage.getProjectCurrencyWallet(req.user!.id);
      if (wallet) {
        await storage.unlockProjectCurrencyBalance(wallet.id, support.amount);
      }

      await storage.updateSpectatorSupport(support.id, { status: "cancelled" });

      res.json({ success: true, message: "Support cancelled and funds refunded" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/my-supports", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const supports = await storage.getSpectatorSupportsByUser(req.user!.id);
      res.json(supports);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
