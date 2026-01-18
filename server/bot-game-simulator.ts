import { db } from "./db";
import { users, challenges, multiplayerGames } from "@shared/schema";
import { eq, sql, inArray } from "drizzle-orm";
import { getGameEngine } from "./game-engines";
import type { MoveData } from "./game-engines/types";

const GAME_TYPES = ["chess", "backgammon", "domino"];
const BET_AMOUNTS = [5, 10, 25, 50, 100, 250, 500, 1000];
const MOVE_DELAY_MIN = 3000;
const MOVE_DELAY_MAX = 10000;
const GAME_INTERVAL_MIN = 10000;
const GAME_INTERVAL_MAX = 30000;

interface BotAccount {
  id: string;
  nickname: string | null;
  accountId: string;
}

interface ActiveGame {
  gameType: string;
  state: string;
  players: string[];
  challengeId: string;
  currentPlayerIndex: number;
}

let botAccounts: BotAccount[] = [];
let activeGames: Map<string, ActiveGame> = new Map();
let isRunning = false;

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min) + min);
  return new Promise(resolve => setTimeout(resolve, delay));
}

async function loadBotAccounts(): Promise<void> {
  try {
    const allUsers = await db.select({
      id: users.id,
      nickname: users.nickname,
      accountId: users.accountId,
      email: users.email,
    }).from(users);
    
    botAccounts = allUsers
      .filter(u => u.email?.endsWith("@vix.bot"))
      .map(({ id, nickname, accountId }) => ({ id, nickname, accountId }));
    
    console.log(`[Bot Simulator] Loaded ${botAccounts.length} bot accounts`);
  } catch (error: any) {
    console.error("[Bot Simulator] Failed to load bot accounts:", error.message);
  }
}

async function selectRandomBots(count: number): Promise<BotAccount[]> {
  if (botAccounts.length < count) {
    await loadBotAccounts();
  }
  
  const shuffled = [...botAccounts].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function initializeGameState(gameType: string, players: string[]): string {
  const engine = getGameEngine(gameType);
  if (!engine) return "";
  
  let state = engine.createInitialState();
  const parsed = JSON.parse(state);
  
  if (gameType === "chess") {
    parsed.players = { white: players[0], black: players[1] };
  } else if (gameType === "backgammon") {
    parsed.players = { white: players[0], black: players[1] };
  } else if (gameType === "domino") {
    parsed.players = players;
  }
  
  return JSON.stringify(parsed);
}

async function createBotChallenge(): Promise<string | null> {
  try {
    const gameType = randomElement(GAME_TYPES);
    const betAmount = randomElement(BET_AMOUNTS);
    
    const selectedBots = await selectRandomBots(2);
    if (selectedBots.length < 2) {
      console.log(`[Bot Simulator] Not enough bots for ${gameType}`);
      return null;
    }
    
    const [player1, player2] = selectedBots;
    
    const [challenge] = await db.insert(challenges).values({
      gameType,
      betAmount: betAmount.toString(),
      currencyType: "usd",
      visibility: "public",
      status: "active",
      player1Id: player1.id,
      player2Id: player2.id,
      opponentType: "random",
      timeLimit: 600,
      startedAt: new Date(),
    }).returning();
    
    console.log(`[Bot Simulator] Created ${gameType} challenge: ${challenge.id.slice(0, 8)} between ${player1.nickname} vs ${player2.nickname} ($${betAmount})`);
    
    const initialState = initializeGameState(gameType, [player1.id, player2.id]);
    
    if (initialState) {
      activeGames.set(challenge.id, {
        gameType,
        state: initialState,
        players: [player1.id, player2.id],
        challengeId: challenge.id,
        currentPlayerIndex: 0,
      });
      
      simulateGame(challenge.id);
    }
    
    return challenge.id;
  } catch (error: any) {
    console.error("[Bot Simulator] Failed to create challenge:", error.message);
    return null;
  }
}

async function simulateGame(challengeId: string): Promise<void> {
  const game = activeGames.get(challengeId);
  if (!game) return;
  
  const engine = getGameEngine(game.gameType);
  if (!engine) return;
  
  let moveCount = 0;
  const maxMoves = 100;
  
  const gameLoop = async () => {
    while (moveCount < maxMoves && isRunning) {
      await randomDelay(MOVE_DELAY_MIN, MOVE_DELAY_MAX);
      
      const currentGame = activeGames.get(challengeId);
      if (!currentGame) break;
      
      try {
        const status = engine.getGameStatus(currentGame.state);
        if (status.isOver) {
          await endGame(challengeId, status.winner || null, status);
          return;
        }
        
        const currentPlayerId = currentGame.players[currentGame.currentPlayerIndex];
        const validMoves = engine.getValidMoves(currentGame.state, currentPlayerId);
        
        if (!validMoves || validMoves.length === 0) {
          currentGame.currentPlayerIndex = (currentGame.currentPlayerIndex + 1) % currentGame.players.length;
          activeGames.set(challengeId, currentGame);
          continue;
        }
        
        const randomMove = randomElement(validMoves);
        const result = engine.applyMove(currentGame.state, currentPlayerId, randomMove);
        
        if (result.success) {
          currentGame.state = result.newState;
          currentGame.currentPlayerIndex = (currentGame.currentPlayerIndex + 1) % currentGame.players.length;
          activeGames.set(challengeId, currentGame);
          moveCount++;
        }
        
      } catch (error: any) {
        console.error(`[Bot Simulator] Move error in ${challengeId.slice(0, 8)}:`, error.message);
        break;
      }
    }
    
    if (moveCount >= maxMoves) {
      const randomWinner = randomElement(game.players);
      await endGame(challengeId, randomWinner, { reason: "timeout" });
    }
  };
  
  gameLoop().catch(err => console.error("[Bot Simulator] Game loop error:", err.message));
}

async function endGame(challengeId: string, winnerId: string | null, status: any): Promise<void> {
  try {
    const game = activeGames.get(challengeId);
    if (!game) return;
    
    await db.update(challenges)
      .set({
        status: "completed",
        winnerId: winnerId,
        endedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(challenges.id, challengeId));
    
    if (winnerId) {
      await db.update(users)
        .set({
          gamesWon: sql`${users.gamesWon} + 1`,
          gamesPlayed: sql`${users.gamesPlayed} + 1`,
        })
        .where(eq(users.id, winnerId));
      
      const loserId = game.players.find(p => p !== winnerId);
      if (loserId) {
        await db.update(users)
          .set({
            gamesLost: sql`${users.gamesLost} + 1`,
            gamesPlayed: sql`${users.gamesPlayed} + 1`,
          })
          .where(eq(users.id, loserId));
      }
    }
    
    await db.update(multiplayerGames)
      .set({ totalGamesPlayed: sql`${multiplayerGames.totalGamesPlayed} + 1` })
      .where(eq(multiplayerGames.key, game.gameType));
    
    activeGames.delete(challengeId);
    
    const winner = game.players.find(p => p === winnerId);
    console.log(`[Bot Simulator] Game ${challengeId} ended. Winner: ${winnerId ? "Player " + winnerId.slice(0, 8) : "Draw"}`);
    
  } catch (error: any) {
    console.error(`[Bot Simulator] Failed to end game ${challengeId}:`, error.message);
    activeGames.delete(challengeId);
  }
}

async function updateBotOnlineStatus(): Promise<void> {
  try {
    if (botAccounts.length === 0) {
      await loadBotAccounts();
    }
    
    const botIds = botAccounts.map(b => b.id);
    if (botIds.length > 0) {
      await db.update(users)
        .set({ isOnline: true, lastActiveAt: new Date() })
        .where(inArray(users.id, botIds));
    }
  } catch (error: any) {
    console.error("[Bot Simulator] Failed to update online status:", error.message);
  }
}

export async function startBotSimulator(): Promise<void> {
  if (isRunning) {
    console.log("[Bot Simulator] Already running");
    return;
  }
  
  isRunning = true;
  console.log("[Bot Simulator] Starting...");
  
  await loadBotAccounts();
  
  if (botAccounts.length < 2) {
    console.log("[Bot Simulator] Not enough bot accounts. Please run bot seeder first.");
    isRunning = false;
    return;
  }
  
  await updateBotOnlineStatus();
  setInterval(updateBotOnlineStatus, 60000);
  
  const gameLoop = async () => {
    while (isRunning) {
      try {
        if (activeGames.size < 5) {
          await createBotChallenge();
        }
        
        await randomDelay(GAME_INTERVAL_MIN, GAME_INTERVAL_MAX);
      } catch (error: any) {
        console.error("[Bot Simulator] Loop error:", error.message);
        await randomDelay(5000, 10000);
      }
    }
  };
  
  gameLoop();
  console.log("[Bot Simulator] Started successfully");
}

export function stopBotSimulator(): void {
  isRunning = false;
  activeGames.clear();
  console.log("[Bot Simulator] Stopped");
}

export function getBotSimulatorStatus(): { isRunning: boolean; activeGames: number; botCount: number } {
  return {
    isRunning,
    activeGames: activeGames.size,
    botCount: botAccounts.length,
  };
}
