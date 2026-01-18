import { db } from "./db";
import { users, challenges, multiplayerGames } from "@shared/schema";
import { eq, sql, inArray, and } from "drizzle-orm";
import { getGameEngine } from "./game-engines";
import type { MoveData } from "./game-engines/types";

const DEFAULT_GAME_TYPES = ["chess", "backgammon", "domino"];
const DEFAULT_BET_AMOUNTS = [5, 10, 25, 50, 100, 250, 500, 1000];

interface SimulatorConfig {
  isEnabled: boolean;
  enabledGameTypes: string[];
  minBetAmount: number;
  maxBetAmount: number;
  moveDelayMin: number;
  moveDelayMax: number;
  gameCreationIntervalMin: number;
  gameCreationIntervalMax: number;
  maxActiveGames: number;
  targetActiveGames: number;
}

interface BotAccount {
  id: string;
  nickname: string | null;
  accountId: string;
  isActive: boolean;
  email: string;
}

interface ActiveGame {
  gameType: string;
  state: string;
  players: string[];
  challengeId: string;
  currentPlayerIndex: number;
  startTime: Date;
  moveCount: number;
}

let botAccounts: BotAccount[] = [];
let activeGames: Map<string, ActiveGame> = new Map();
let isRunning = false;
let lastGameType: string = "";
let onlineStatusInterval: NodeJS.Timeout | null = null;
let gameCreationInterval: NodeJS.Timeout | null = null;

let config: SimulatorConfig = {
  isEnabled: true,
  enabledGameTypes: [...DEFAULT_GAME_TYPES],
  minBetAmount: 5,
  maxBetAmount: 1000,
  moveDelayMin: 2000,
  moveDelayMax: 8000,
  gameCreationIntervalMin: 15000,
  gameCreationIntervalMax: 30000,
  maxActiveGames: 10,
  targetActiveGames: 5,
};

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min) + min);
  return new Promise(resolve => setTimeout(resolve, delay));
}

function randomBetAmount(): number {
  const amounts = DEFAULT_BET_AMOUNTS.filter(
    a => a >= config.minBetAmount && a <= config.maxBetAmount
  );
  return amounts.length > 0 ? randomElement(amounts) : config.minBetAmount;
}

function selectNextGameType(): string {
  const available = config.enabledGameTypes.filter(g => g !== lastGameType);
  if (available.length === 0) {
    return config.enabledGameTypes[0] || "chess";
  }
  const selected = randomElement(available);
  lastGameType = selected;
  return selected;
}

export async function loadBotAccounts(): Promise<BotAccount[]> {
  try {
    const allUsers = await db.select().from(users);
    
    if (!allUsers || !Array.isArray(allUsers)) {
      console.log("[Bot Simulator] No users found in database");
      return [];
    }
    
    botAccounts = allUsers
      .filter(u => u && u.email && u.email.endsWith("@vix.bot"))
      .map(u => ({
        id: u.id,
        nickname: u.nickname,
        accountId: u.accountId || "",
        email: u.email || "",
        isActive: u.isActive !== false,
      }));
    
    console.log(`[Bot Simulator] Loaded ${botAccounts.length} bot accounts`);
    return botAccounts;
  } catch (error: any) {
    console.error("[Bot Simulator] Failed to load bot accounts:", error.message);
    console.error("[Bot Simulator] Stack:", error.stack);
    return [];
  }
}

async function selectRandomBots(count: number): Promise<BotAccount[]> {
  if (botAccounts.length < count) {
    await loadBotAccounts();
  }
  
  const activeBots = botAccounts.filter(b => b.isActive);
  if (activeBots.length < count) {
    console.log(`[Bot Simulator] Not enough active bots (${activeBots.length}/${count})`);
    return [];
  }
  
  const shuffled = [...activeBots].sort(() => Math.random() - 0.5);
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

export async function createBotChallenge(
  gameType?: string,
  player1Id?: string,
  player2Id?: string,
  betAmount?: number
): Promise<string | null> {
  try {
    const selectedGameType = gameType || selectNextGameType();
    const selectedBetAmount = betAmount || randomBetAmount();
    
    let player1: BotAccount | undefined;
    let player2: BotAccount | undefined;
    
    if (player1Id && player2Id) {
      player1 = botAccounts.find(b => b.id === player1Id);
      player2 = botAccounts.find(b => b.id === player2Id);
    } else {
      const selectedBots = await selectRandomBots(2);
      if (selectedBots.length < 2) {
        return null;
      }
      [player1, player2] = selectedBots;
    }
    
    if (!player1 || !player2) {
      console.log(`[Bot Simulator] Invalid players for ${selectedGameType}`);
      return null;
    }
    
    const [challenge] = await db.insert(challenges).values({
      gameType: selectedGameType,
      betAmount: selectedBetAmount.toString(),
      currencyType: "usd",
      visibility: "public",
      status: "active",
      player1Id: player1.id,
      player2Id: player2.id,
      opponentType: "random",
      timeLimit: 600,
      startedAt: new Date(),
    }).returning();
    
    console.log(`[Bot Simulator] Created ${selectedGameType} challenge: ${challenge.id.slice(0, 8)} between ${player1.nickname} vs ${player2.nickname} ($${selectedBetAmount})`);
    
    const initialState = initializeGameState(selectedGameType, [player1.id, player2.id]);
    
    if (initialState) {
      activeGames.set(challenge.id, {
        gameType: selectedGameType,
        state: initialState,
        players: [player1.id, player2.id],
        challengeId: challenge.id,
        currentPlayerIndex: 0,
        startTime: new Date(),
        moveCount: 0,
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
  if (!game) {
    console.log(`[Bot Simulator] Game ${challengeId.slice(0, 8)} not found`);
    return;
  }
  
  const engine = getGameEngine(game.gameType);
  if (!engine) {
    console.log(`[Bot Simulator] No engine for ${game.gameType}`);
    return;
  }
  
  console.log(`[Bot Simulator] Starting simulation for ${challengeId.slice(0, 8)} (${game.gameType})`);
  
  const gameLoop = async () => {
    let loopCount = 0;
    while (isRunning) {
      await randomDelay(config.moveDelayMin, config.moveDelayMax);
      
      const currentGame = activeGames.get(challengeId);
      if (!currentGame) {
        console.log(`[Bot Simulator] Game ${challengeId.slice(0, 8)} removed from active games`);
        break;
      }
      
      loopCount++;
      
      try {
        const status = engine.getGameStatus(currentGame.state);
        
        if (status.isOver) {
          let winnerId: string | null = null;
          const isDraw = status.winner === "draw" || status.winner === null || status.winner === undefined;
          
          if (!isDraw && status.winner) {
            const winner = String(status.winner);
            if (winner === "white" || winner === "player1" || winner === "0") {
              winnerId = currentGame.players[0];
            } else if (winner === "black" || winner === "player2" || winner === "1") {
              winnerId = currentGame.players[1];
            } else if (currentGame.players.includes(winner)) {
              winnerId = winner;
            } else {
              const playerIndex = currentGame.players.findIndex(p => p === winner);
              if (playerIndex >= 0) {
                winnerId = currentGame.players[playerIndex];
              }
            }
          }
          
          await endGame(challengeId, winnerId, status, isDraw);
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
          currentGame.moveCount++;
          activeGames.set(challengeId, currentGame);
          
          if (currentGame.moveCount % 10 === 0) {
            console.log(`[Bot Simulator] Game ${challengeId.slice(0, 8)}: ${currentGame.moveCount} moves`);
          }
        }
        
      } catch (error: any) {
        console.error(`[Bot Simulator] Move error in ${challengeId.slice(0, 8)}:`, error.message);
        break;
      }
    }
    
    console.log(`[Bot Simulator] Game loop ended for ${challengeId.slice(0, 8)} after ${loopCount} iterations`);
  };
  
  gameLoop().catch(err => console.error("[Bot Simulator] Game loop error:", err.message));
}

async function endGame(challengeId: string, winnerId: string | null, status: any, isDraw: boolean = false): Promise<void> {
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
    } else if (isDraw) {
      for (const playerId of game.players) {
        await db.update(users)
          .set({
            gamesPlayed: sql`${users.gamesPlayed} + 1`,
          })
          .where(eq(users.id, playerId));
      }
    }
    
    await db.update(multiplayerGames)
      .set({ totalGamesPlayed: sql`${multiplayerGames.totalGamesPlayed} + 1` })
      .where(eq(multiplayerGames.key, game.gameType));
    
    activeGames.delete(challengeId);
    
    const winnerBot = botAccounts.find(b => b.id === winnerId);
    const duration = Math.round((Date.now() - game.startTime.getTime()) / 1000);
    console.log(`[Bot Simulator] Game ${challengeId.slice(0, 8)} ended after ${game.moveCount} moves (${duration}s). Winner: ${winnerBot?.nickname || (winnerId ? winnerId.slice(0, 8) : "Draw")}`);
    
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
    
    const activeBotIds = botAccounts.filter(b => b.isActive).map(b => b.id);
    if (activeBotIds.length > 0) {
      await db.update(users)
        .set({ isOnline: true, lastActiveAt: new Date() })
        .where(inArray(users.id, activeBotIds));
    }
  } catch (error: any) {
    console.error("[Bot Simulator] Failed to update online status:", error.message);
  }
}

async function gameCreationLoop(): Promise<void> {
  if (!isRunning || !config.isEnabled) return;
  
  try {
    if (activeGames.size < config.targetActiveGames) {
      await createBotChallenge();
    }
  } catch (error: any) {
    console.error("[Bot Simulator] Game creation error:", error.message);
  }
  
  const nextInterval = Math.floor(
    Math.random() * (config.gameCreationIntervalMax - config.gameCreationIntervalMin) + 
    config.gameCreationIntervalMin
  );
  
  if (isRunning) {
    gameCreationInterval = setTimeout(gameCreationLoop, nextInterval);
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
  
  const activeBots = botAccounts.filter(b => b.isActive);
  if (activeBots.length < 2) {
    console.log("[Bot Simulator] Not enough active bot accounts. Please run bot seeder first.");
    isRunning = false;
    return;
  }
  
  await updateBotOnlineStatus();
  onlineStatusInterval = setInterval(updateBotOnlineStatus, 60000);
  
  gameCreationLoop();
  
  console.log("[Bot Simulator] Started successfully");
}

export function stopBotSimulator(): void {
  isRunning = false;
  
  if (onlineStatusInterval) {
    clearInterval(onlineStatusInterval);
    onlineStatusInterval = null;
  }
  
  if (gameCreationInterval) {
    clearTimeout(gameCreationInterval);
    gameCreationInterval = null;
  }
  
  activeGames.clear();
  console.log("[Bot Simulator] Stopped");
}

export function getBotSimulatorStatus(): {
  isRunning: boolean;
  activeGames: number;
  botCount: number;
  activeBotCount: number;
  config: SimulatorConfig;
} {
  return {
    isRunning,
    activeGames: activeGames.size,
    botCount: botAccounts.length,
    activeBotCount: botAccounts.filter(b => b.isActive).length,
    config: { ...config },
  };
}

export function getActiveGames(): Array<{
  challengeId: string;
  gameType: string;
  players: string[];
  startTime: Date;
  moveCount: number;
  duration: number;
}> {
  return Array.from(activeGames.values()).map(game => ({
    challengeId: game.challengeId,
    gameType: game.gameType,
    players: game.players,
    startTime: game.startTime,
    moveCount: game.moveCount,
    duration: Math.round((Date.now() - game.startTime.getTime()) / 1000),
  }));
}

export function updateSimulatorConfig(newConfig: Partial<SimulatorConfig>): SimulatorConfig {
  config = { ...config, ...newConfig };
  console.log("[Bot Simulator] Config updated:", config);
  return config;
}

export async function endGameManually(challengeId: string, winnerId?: string): Promise<boolean> {
  const game = activeGames.get(challengeId);
  if (!game) return false;
  
  const finalWinner = winnerId || null;
  await endGame(challengeId, finalWinner, { reason: "manual_end" });
  return true;
}

export function getBotAccounts(): BotAccount[] {
  return [...botAccounts];
}

export async function toggleBotActive(botId: string, isActive: boolean): Promise<boolean> {
  try {
    await db.update(users)
      .set({ isActive })
      .where(eq(users.id, botId));
    
    const botIndex = botAccounts.findIndex(b => b.id === botId);
    if (botIndex >= 0) {
      botAccounts[botIndex].isActive = isActive;
    }
    
    console.log(`[Bot Simulator] Bot ${botId.slice(0, 8)} ${isActive ? "activated" : "deactivated"}`);
    return true;
  } catch (error: any) {
    console.error(`[Bot Simulator] Failed to toggle bot:`, error.message);
    return false;
  }
}

export async function updateBotProfile(
  botId: string,
  updates: { nickname?: string; profilePicture?: string }
): Promise<boolean> {
  try {
    await db.update(users)
      .set(updates)
      .where(eq(users.id, botId));
    
    if (updates.nickname) {
      const botIndex = botAccounts.findIndex(b => b.id === botId);
      if (botIndex >= 0) {
        botAccounts[botIndex].nickname = updates.nickname;
      }
    }
    
    console.log(`[Bot Simulator] Bot ${botId.slice(0, 8)} profile updated`);
    return true;
  } catch (error: any) {
    console.error(`[Bot Simulator] Failed to update bot profile:`, error.message);
    return false;
  }
}
