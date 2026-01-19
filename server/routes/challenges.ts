import type { Express, Response } from "express";
import crypto from "crypto";
import { storage } from "../storage";
import { db } from "../db";
import { eq, desc, or, and, isNull } from "drizzle-orm";
import { users, projectCurrencyWallets, projectCurrencyLedger, challenges as challengesTable, notifications } from "@shared/schema";
import { authMiddleware, AuthRequest } from "./middleware";
import { broadcastChallengeUpdate, broadcastNotification } from "../websocket";

// In-memory stores for challenges (should be moved to DB in production)
const challenges: any[] = [];
const spectatorBets: any[] = [];
const challengeRatings: any[] = [];
const challengerFollows: { id: string; followerId: string; followedId: string; createdAt: Date }[] = [];

// In-memory lock for challenge joins to prevent race conditions
const challengeJoinLocks = new Set<string>();

export function registerChallengesRoutes(app: Express): void {
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

  // ==================== CHALLENGES ROUTES ====================

  app.get("/api/challenges/available", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const dbChallenges = await storage.getAvailableChallenges(req.user!.id);
      const enrichedChallenges = await Promise.all(dbChallenges.map(async (c) => {
        const player1 = await storage.getUser(c.player1Id);
        const gamesWon = player1?.gamesWon || 0;
        const gamesLost = player1?.gamesLost || 0;
        const totalGames = gamesWon + gamesLost;
        const winRate = totalGames > 0 ? Math.round((gamesWon / totalGames) * 100) : 50;
        const rank = winRate >= 80 ? "diamond" : winRate >= 60 ? "gold" : winRate >= 40 ? "silver" : "bronze";
        
        return {
          id: c.id,
          gameType: c.gameType,
          betAmount: parseFloat(c.betAmount || "0"),
          status: c.status,
          visibility: c.visibility,
          player1Id: c.player1Id,
          player1Name: player1?.nickname || player1?.username || "Unknown",
          player1Rating: { wins: gamesWon, losses: gamesLost, winRate, rank },
          timeLimit: c.timeLimit,
          spectatorCount: Math.floor(Math.random() * 50) + 5,
          totalBets: Math.floor(Math.random() * 500) + 50,
          createdAt: c.createdAt?.toISOString() || new Date().toISOString(),
        };
      }));
      res.json(enrichedChallenges);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/challenges/public", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const dbChallenges = await storage.getActiveChallenges();
      const enrichedChallenges = await Promise.all(dbChallenges.slice(0, 10).map(async (c) => {
        const player1 = await storage.getUser(c.player1Id);
        const player2 = c.player2Id ? await storage.getUser(c.player2Id) : null;
        
        const p1Won = player1?.gamesWon || 0;
        const p1Lost = player1?.gamesLost || 0;
        const p1Total = p1Won + p1Lost;
        const p1WinRate = p1Total > 0 ? Math.round((p1Won / p1Total) * 100) : 50;
        const p1Rank = p1WinRate >= 80 ? "diamond" : p1WinRate >= 60 ? "gold" : p1WinRate >= 40 ? "silver" : "bronze";
        
        const result: any = {
          id: c.id,
          gameType: c.gameType,
          betAmount: parseFloat(c.betAmount || "0"),
          status: c.status,
          visibility: c.visibility,
          player1Id: c.player1Id,
          player1Name: player1?.nickname || player1?.username || "Unknown",
          player1Rating: { wins: p1Won, losses: p1Lost, winRate: p1WinRate, rank: p1Rank },
          player1Score: c.player1Score || 0,
          timeLimit: c.timeLimit,
          spectatorCount: Math.floor(Math.random() * 100) + 20,
          totalBets: Math.floor(Math.random() * 2000) + 200,
          createdAt: c.createdAt?.toISOString() || new Date().toISOString(),
          startedAt: c.startedAt?.toISOString() || new Date().toISOString(),
        };
        
        if (player2) {
          const p2Won = player2?.gamesWon || 0;
          const p2Lost = player2?.gamesLost || 0;
          const p2Total = p2Won + p2Lost;
          const p2WinRate = p2Total > 0 ? Math.round((p2Won / p2Total) * 100) : 50;
          const p2Rank = p2WinRate >= 80 ? "diamond" : p2WinRate >= 60 ? "gold" : p2WinRate >= 40 ? "silver" : "bronze";
          
          result.player2Id = c.player2Id;
          result.player2Name = player2?.nickname || player2?.username || "Unknown";
          result.player2Rating = { wins: p2Won, losses: p2Lost, winRate: p2WinRate, rank: p2Rank };
          result.player2Score = c.player2Score || 0;
        }
        
        return result;
      }));
      res.json(enrichedChallenges);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/challenges/my", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      // Read from DB instead of in-memory
      const myChallenges = await db.select().from(challengesTable)
        .where(or(
          eq(challengesTable.player1Id, req.user!.id),
          eq(challengesTable.player2Id, req.user!.id)
        ))
        .orderBy(desc(challengesTable.createdAt))
        .limit(20);
      
      // Enrich with player names
      const enriched = await Promise.all(myChallenges.map(async (c) => {
        const player1 = await storage.getUser(c.player1Id);
        const player2 = c.player2Id ? await storage.getUser(c.player2Id) : null;
        return {
          ...c,
          player1Name: player1?.nickname || player1?.username,
          player2Name: player2?.nickname || player2?.username,
        };
      }));
      
      res.json(enriched);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/challenges", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { gameType, betAmount, opponentType, friendAccountId, visibility = 'public', currencyType = 'usd' } = req.body;
      const parsedBetAmount = parseFloat(String(betAmount || 0));
      
      // Validate amount is positive
      if (isNaN(parsedBetAmount) || parsedBetAmount <= 0) {
        return res.status(400).json({ error: "Invalid bet amount" });
      }
      
      // VALIDATION: Verify game exists and is active in database (Single Source of Truth)
      const validation = await storage.validateGameConfig(gameType, String(betAmount || 0));
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
      
      const gameConfig = validation.game!;
      const timeLimit = gameConfig.defaultTimeLimit || 300;
      const userId = req.user!.id;
      
      // Use transaction to check balance and deduct + create challenge atomically
      const [dbChallenge] = await db.transaction(async (tx) => {
        if (currencyType === 'project') {
          // Check if project currency is enabled for games
          const settings = await storage.getProjectCurrencySettings();
          if (!settings?.isActive || !settings?.useInGames) {
            throw new Error("Project currency is not available for games");
          }
          
          // Lock and check user's project currency balance
          const [wallet] = await tx.select()
            .from(projectCurrencyWallets)
            .where(eq(projectCurrencyWallets.userId, userId))
            .for('update');
          
          if (!wallet) {
            throw new Error('Project currency wallet not found');
          }
          
          let earnedBalance = parseFloat(wallet.earnedBalance);
          let purchasedBalance = parseFloat(wallet.purchasedBalance);
          const totalBalance = earnedBalance + purchasedBalance;
          
          if (totalBalance < parsedBetAmount) {
            throw new Error("Insufficient project currency balance to create this challenge");
          }
          
          // Deduct from earned first, then purchased
          let remaining = parsedBetAmount;
          if (earnedBalance >= remaining) {
            earnedBalance -= remaining;
            remaining = 0;
          } else {
            remaining -= earnedBalance;
            earnedBalance = 0;
            purchasedBalance -= remaining;
          }
          
          await tx.update(projectCurrencyWallets)
            .set({ 
              earnedBalance: earnedBalance.toFixed(8),
              purchasedBalance: purchasedBalance.toFixed(8),
              updatedAt: new Date()
            })
            .where(eq(projectCurrencyWallets.userId, userId));
        } else {
          // Check and deduct USD balance
          const [userRecord] = await tx.select()
            .from(users)
            .where(eq(users.id, userId))
            .for('update');
          
          if (!userRecord) {
            throw new Error('User not found');
          }
          
          const currentBalance = parseFloat(userRecord.balance);
          if (currentBalance < parsedBetAmount) {
            throw new Error('Insufficient balance to create this challenge');
          }
          
          // Deduct balance
          await tx.update(users)
            .set({ balance: (currentBalance - parsedBetAmount).toString() })
            .where(eq(users.id, userId));
        }
        
        // Insert challenge into database
        return await tx.insert(challengesTable).values({
          gameType,
          betAmount: String(betAmount),
          currencyType,
          visibility,
          status: 'waiting',
          player1Id: userId,
          player2Id: opponentType === 'friend' ? friendAccountId : null,
          opponentType,
          friendAccountId: opponentType === 'friend' ? friendAccountId : null,
          timeLimit,
          player1Score: 0,
          player2Score: 0,
        }).returning();
      });
      
      // Get player details for response
      const player1 = await storage.getUser(req.user!.id);
      const gamesWon = player1?.gamesWon || 0;
      const gamesLost = player1?.gamesLost || 0;
      const totalGames = gamesWon + gamesLost;
      const winRate = totalGames > 0 ? Math.round((gamesWon / totalGames) * 100) : 50;
      const rank = winRate >= 80 ? "diamond" : winRate >= 60 ? "gold" : winRate >= 40 ? "silver" : "bronze";
      
      const challenge = {
        ...dbChallenge,
        player1Name: req.user!.username,
        player1Rating: { wins: gamesWon, losses: gamesLost, winRate, rank },
        player2Name: null,
        player2Rating: null,
        spectatorCount: 0,
        totalBets: 0,
        houseFee: gameConfig.houseFee,
      };
      
      // Also keep in memory for backward compatibility
      challenges.push(challenge);
      
      // Broadcast new challenge to all connected clients for real-time updates
      broadcastChallengeUpdate('created', challenge);
      
      // Notify followers of the challenger about the new challenge
      const followers = await storage.getUserFollowers(req.user!.id);
      if (followers.length > 0) {
        const followerIds = followers.map(f => f.userId);
        const gameName = gameType.charAt(0).toUpperCase() + gameType.slice(1);
        
        await broadcastNotification({
          type: "system",
          priority: "normal",
          title: "New Challenge",
          titleAr: "تحدي جديد",
          message: `${player1?.nickname || player1?.username} started a ${gameName} challenge for $${parsedBetAmount}! Watch and support now.`,
          messageAr: `${player1?.nickname || player1?.username} بدأ تحدي ${gameName} بقيمة $${parsedBetAmount}! شاهد وادعم الآن.`,
          link: `/watch/${dbChallenge.id}`,
          metadata: JSON.stringify({ 
            challengeId: dbChallenge.id, 
            gameType, 
            betAmount: parsedBetAmount,
            action: 'watch_and_support'
          }),
        }, followerIds);
      }
      
      res.json(challenge);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/challenges/:id/join", authMiddleware, async (req: AuthRequest, res: Response) => {
    const challengeId = req.params.id;
    
    // Acquire lock for this challenge
    if (challengeJoinLocks.has(challengeId)) {
      return res.status(400).json({ error: "Challenge is no longer available" });
    }
    challengeJoinLocks.add(challengeId);
    
    try {
      // Read challenge from DB instead of memory
      const [dbChallenge] = await db.select().from(challengesTable).where(eq(challengesTable.id, challengeId)).limit(1);
      if (!dbChallenge) {
        challengeJoinLocks.delete(challengeId);
        return res.status(404).json({ error: "Challenge not found" });
      }
      if (dbChallenge.player1Id === req.user!.id) {
        challengeJoinLocks.delete(challengeId);
        return res.status(400).json({ error: "Cannot join your own challenge" });
      }
      if (dbChallenge.status !== 'waiting') {
        challengeJoinLocks.delete(challengeId);
        return res.status(400).json({ error: "Challenge is no longer available" });
      }
      
      // Use DB challenge for financial logic
      const challenge = dbChallenge as any;
      
      // Financial safety: Check and deduct balance using transaction with row-level locking
      const betAmount = parseFloat(String(challenge.betAmount));
      const userId = req.user!.id;
      const currencyType = (challenge as any).currencyType || 'usd';
      
      await db.transaction(async (tx) => {
        if (currencyType === 'project') {
          // Handle project currency stake
          const [wallet] = await tx.select()
            .from(projectCurrencyWallets)
            .where(eq(projectCurrencyWallets.userId, userId))
            .for('update');
          
          if (!wallet) {
            throw new Error('Project currency wallet not found');
          }
          
          // Deduct from earned first, then purchased
          let earnedBalance = parseFloat(wallet.earnedBalance);
          let purchasedBalance = parseFloat(wallet.purchasedBalance);
          const totalBalance = earnedBalance + purchasedBalance;
          
          if (totalBalance < betAmount) {
            throw new Error('Insufficient project currency balance to join this challenge');
          }
          
          // Deduct from earned first, then purchased
          let remaining = betAmount;
          if (earnedBalance >= remaining) {
            earnedBalance -= remaining;
            remaining = 0;
          } else {
            remaining -= earnedBalance;
            earnedBalance = 0;
            purchasedBalance -= remaining;
          }
          
          await tx.update(projectCurrencyWallets)
            .set({ 
              earnedBalance: earnedBalance.toFixed(8),
              purchasedBalance: purchasedBalance.toFixed(8),
              updatedAt: new Date()
            })
            .where(eq(projectCurrencyWallets.userId, userId));
          
          await tx.insert(projectCurrencyLedger).values({
            walletId: wallet.id,
            userId: userId,
            transactionType: 'game_stake',
            amount: (-betAmount).toFixed(8),
            balanceType: 'earned',
            balanceBefore: (parseFloat(wallet.earnedBalance) + parseFloat(wallet.purchasedBalance)).toFixed(8),
            balanceAfter: (earnedBalance + purchasedBalance).toFixed(8),
            description: `Game stake for challenge ${challengeId}`,
            referenceId: challengeId
          });
        } else {
          // Handle USD stake (original logic)
          const [userRecord] = await tx.select()
            .from(users)
            .where(eq(users.id, userId))
            .for('update');
          
          if (!userRecord) {
            throw new Error('User not found');
          }
          
          const currentBalance = parseFloat(userRecord.balance);
          if (currentBalance < betAmount) {
            throw new Error('Insufficient balance to join this challenge');
          }
          
          // Deduct balance
          await tx.update(users)
            .set({ balance: (currentBalance - betAmount).toString() })
            .where(eq(users.id, userId));
        }
        
        // Update challenge in database with race condition protection
        const updateResult = await tx.update(challengesTable)
          .set({ 
            player2Id: userId,
            status: 'active',
            startedAt: new Date(),
            updatedAt: new Date()
          })
          .where(and(
            eq(challengesTable.id, challengeId),
            eq(challengesTable.status, 'waiting'),
            isNull(challengesTable.player2Id)
          ))
          .returning();
        
        if (updateResult.length === 0) {
          throw new Error('Challenge is no longer available - already taken or cancelled');
        }
        
      });
      
      // Release lock after success (challenge is now 'active', so future joins will fail on status check)
      challengeJoinLocks.delete(challengeId);
      
      // Fetch updated challenge from DB for accurate broadcast
      const [updatedChallenge] = await db.select().from(challengesTable).where(eq(challengesTable.id, challengeId)).limit(1);
      const player1 = await storage.getUser(updatedChallenge!.player1Id);
      const player2 = await storage.getUser(userId);
      
      const enrichedChallenge = {
        ...updatedChallenge,
        player1Name: player1?.nickname || player1?.username,
        player2Name: player2?.nickname || player2?.username,
        player1Rating: { wins: player1?.gamesWon || 0, losses: player1?.gamesLost || 0, winRate: 50, rank: "silver" },
        player2Rating: { wins: player2?.gamesWon || 0, losses: player2?.gamesLost || 0, winRate: 50, rank: "silver" },
      };
      
      // Broadcast that challenge started for real-time updates
      broadcastChallengeUpdate('started', enrichedChallenge);
      
      res.json(enrichedChallenge);
    } catch (error: any) {
      challengeJoinLocks.delete(challengeId);
      if (error.message.includes('Insufficient')) {
        return res.status(400).json({ error: error.message });
      }
      if (error.message.includes('no longer available') || error.message.includes('already taken')) {
        return res.status(409).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/challenges/:id/withdraw", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      // Read from DB instead of memory
      const [dbChallenge] = await db.select().from(challengesTable)
        .where(eq(challengesTable.id, req.params.id))
        .limit(1);
      
      if (!dbChallenge || dbChallenge.player1Id !== req.user!.id) {
        return res.status(404).json({ error: "Challenge not found" });
      }
      if (dbChallenge.status !== 'waiting') {
        return res.status(400).json({ error: "Can only withdraw waiting challenges" });
      }
      
      const penalty = parseFloat(dbChallenge.betAmount || '0') * 0.3;
      
      // Update in database
      await db.update(challengesTable)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(challengesTable.id, req.params.id));
      
      const cancelledChallenge = { ...dbChallenge, status: 'cancelled' };
      
      // Broadcast challenge cancelled for real-time updates
      broadcastChallengeUpdate('cancelled', cancelledChallenge);
      
      res.json({ ...cancelledChallenge, penalty });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/challenges/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const challengeId = req.params.id;
      
      // Fetch challenge from database
      const [dbChallenge] = await db.select().from(challengesTable).where(eq(challengesTable.id, challengeId)).limit(1);
      
      if (!dbChallenge) {
        return res.status(404).json({ error: "Challenge not found" });
      }
      
      // Fetch player details
      const player1 = await storage.getUser(dbChallenge.player1Id);
      const player2 = dbChallenge.player2Id ? await storage.getUser(dbChallenge.player2Id) : null;
      
      // Calculate player 1 stats
      const p1Won = player1?.gamesWon || 0;
      const p1Lost = player1?.gamesLost || 0;
      const p1Total = p1Won + p1Lost;
      const p1WinRate = p1Total > 0 ? Math.round((p1Won / p1Total) * 100) : 50;
      const p1Rank = p1WinRate >= 80 ? "diamond" : p1WinRate >= 60 ? "gold" : p1WinRate >= 40 ? "silver" : "bronze";
      
      const result: any = {
        id: dbChallenge.id,
        gameType: dbChallenge.gameType,
        betAmount: parseFloat(dbChallenge.betAmount || "0"),
        status: dbChallenge.status,
        visibility: dbChallenge.visibility,
        player1Id: dbChallenge.player1Id,
        player1Name: player1?.nickname || player1?.username || "Unknown",
        player1Rating: { wins: p1Won, losses: p1Lost, winRate: p1WinRate, rank: p1Rank },
        player1Score: dbChallenge.player1Score || 0,
        timeLimit: dbChallenge.timeLimit,
        spectatorCount: Math.floor(Math.random() * 100) + 20,
        totalBets: Math.floor(Math.random() * 2000) + 200,
        createdAt: dbChallenge.createdAt?.toISOString() || new Date().toISOString(),
        startedAt: dbChallenge.startedAt?.toISOString() || new Date().toISOString(),
        player1: {
          id: dbChallenge.player1Id,
          username: player1?.nickname || player1?.username || "Unknown",
          avatarUrl: player1?.profilePicture,
          vipLevel: player1?.vipLevel || 0,
        },
      };
      
      // Add player 2 details if exists
      if (player2) {
        const p2Won = player2?.gamesWon || 0;
        const p2Lost = player2?.gamesLost || 0;
        const p2Total = p2Won + p2Lost;
        const p2WinRate = p2Total > 0 ? Math.round((p2Won / p2Total) * 100) : 50;
        const p2Rank = p2WinRate >= 80 ? "diamond" : p2WinRate >= 60 ? "gold" : p2WinRate >= 40 ? "silver" : "bronze";
        
        result.player2Id = dbChallenge.player2Id;
        result.player2Name = player2?.nickname || player2?.username || "Unknown";
        result.player2Rating = { wins: p2Won, losses: p2Lost, winRate: p2WinRate, rank: p2Rank };
        result.player2Score = dbChallenge.player2Score || 0;
        result.player2 = {
          id: dbChallenge.player2Id,
          username: player2?.nickname || player2?.username || "Unknown",
          avatarUrl: player2?.profilePicture,
          vipLevel: player2?.vipLevel || 0,
        };
      }
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/challenges/:id/stake", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { backedPlayerId, stakeAmount } = req.body;
      const stake = {
        id: `stake-${Date.now()}`,
        challengeId: req.params.id,
        spectatorId: req.user!.id,
        spectatorName: req.user!.username,
        backedPlayerId,
        stakeAmount,
        potentialWinnings: stakeAmount * 1.9,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      spectatorBets.push(stake);
      res.json(stake);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/challenges/:id/stakes", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const stakes = spectatorBets.filter(b => b.challengeId === req.params.id);
      res.json(stakes);
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
}
