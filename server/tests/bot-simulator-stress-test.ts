/**
 * Bot Simulator Stress Test
 * 
 * Tests the bot simulator under heavy load to ensure:
 * - No crashes or unhandled exceptions
 * - Memory stability (no leaks)
 * - Proper game completion
 * - Statistics accuracy
 */

import { db } from "../db";
import { users, challenges } from "@shared/schema";
import { eq, sql, and, gte } from "drizzle-orm";
import {
  startBotSimulator,
  stopBotSimulator,
  getBotSimulatorStatus,
  getActiveGames,
  loadBotAccounts,
  updateSimulatorConfig,
  createBotChallenge,
} from "../bot-game-simulator";

const TEST_DURATION_MS = 60000; // 1 minute stress test
const MEMORY_SAMPLE_INTERVAL = 5000; // Sample memory every 5 seconds
const MAX_MEMORY_GROWTH_MB = 50; // Max acceptable memory growth

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  duration?: number;
}

const results: TestResult[] = [];

function log(message: string) {
  console.log(`[Bot Stress Test] ${message}`);
}

function pass(name: string, message: string = "Passed") {
  results.push({ name, passed: true, message });
  log(`✓ ${name}: ${message}`);
}

function fail(name: string, message: string) {
  results.push({ name, passed: false, message });
  log(`✗ ${name}: ${message}`);
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getMemoryUsageMB(): number {
  const usage = process.memoryUsage();
  return Math.round(usage.heapUsed / 1024 / 1024);
}

async function runStressTest() {
  log("Starting Bot Simulator Stress Test...\n");
  
  const startTime = Date.now();
  const initialMemory = getMemoryUsageMB();
  const memorySamples: number[] = [initialMemory];
  
  // Test 1: Load bot accounts
  log("Test 1: Loading bot accounts...");
  try {
    const bots = await loadBotAccounts();
    if (bots.length >= 20) {
      pass("Load Bot Accounts", `Loaded ${bots.length} bots`);
    } else {
      fail("Load Bot Accounts", `Only ${bots.length} bots loaded, expected >= 20`);
    }
  } catch (error: any) {
    fail("Load Bot Accounts", error.message);
  }
  
  // Test 2: Configure for stress test
  log("\nTest 2: Configuring simulator for stress test...");
  try {
    const config = updateSimulatorConfig({
      targetActiveGames: 10,
      gameCreationIntervalMin: 2000,
      gameCreationIntervalMax: 5000,
      moveDelayMin: 500,
      moveDelayMax: 1500,
      enabledGameTypes: ["chess", "backgammon", "domino"],
    });
    pass("Configure Simulator", `Config updated: target=${config.targetActiveGames} games`);
  } catch (error: any) {
    fail("Configure Simulator", error.message);
  }
  
  // Test 3: Start simulator
  log("\nTest 3: Starting simulator...");
  try {
    await startBotSimulator();
    const status = getBotSimulatorStatus();
    if (status.isRunning) {
      pass("Start Simulator", "Simulator started successfully");
    } else {
      fail("Start Simulator", "Simulator failed to start");
    }
  } catch (error: any) {
    fail("Start Simulator", error.message);
  }
  
  // Test 4: Create rapid challenges
  log("\nTest 4: Creating 20 rapid challenges...");
  let createdChallenges = 0;
  const challengePromises = [];
  for (let i = 0; i < 20; i++) {
    challengePromises.push(createBotChallenge());
  }
  
  try {
    const results = await Promise.all(challengePromises);
    createdChallenges = results.filter(r => r !== null).length;
    if (createdChallenges >= 15) {
      pass("Rapid Challenge Creation", `Created ${createdChallenges}/20 challenges`);
    } else {
      fail("Rapid Challenge Creation", `Only created ${createdChallenges}/20 challenges`);
    }
  } catch (error: any) {
    fail("Rapid Challenge Creation", error.message);
  }
  
  // Test 5: Monitor for stability during stress period
  log(`\nTest 5: Running stress test for ${TEST_DURATION_MS / 1000} seconds...`);
  
  let maxActiveGames = 0;
  let totalGamesCreated = 0;
  let totalGamesCompleted = 0;
  let errorCount = 0;
  
  const testStartTime = Date.now();
  
  // Get initial completed games count
  const [initialStats] = await db.select({
    completed: sql<number>`count(*)`.mapWith(Number)
  }).from(challenges).where(eq(challenges.status, "completed"));
  const initialCompleted = initialStats?.completed || 0;
  
  while (Date.now() - testStartTime < TEST_DURATION_MS) {
    try {
      const status = getBotSimulatorStatus();
      const activeGames = getActiveGames();
      
      if (activeGames.length > maxActiveGames) {
        maxActiveGames = activeGames.length;
      }
      
      // Sample memory
      if ((Date.now() - testStartTime) % MEMORY_SAMPLE_INTERVAL < 1000) {
        memorySamples.push(getMemoryUsageMB());
      }
      
      // Log progress every 10 seconds
      if ((Date.now() - testStartTime) % 10000 < 1000) {
        const elapsed = Math.round((Date.now() - testStartTime) / 1000);
        log(`  ${elapsed}s: Active games: ${activeGames.length}, Memory: ${getMemoryUsageMB()}MB`);
      }
      
      await sleep(1000);
    } catch (error: any) {
      errorCount++;
      log(`  Error during stress test: ${error.message}`);
    }
  }
  
  // Get final completed games count
  const [finalStats] = await db.select({
    completed: sql<number>`count(*)`.mapWith(Number)
  }).from(challenges).where(eq(challenges.status, "completed"));
  totalGamesCompleted = (finalStats?.completed || 0) - initialCompleted;
  
  if (errorCount === 0) {
    pass("Stability During Stress", `No errors during ${TEST_DURATION_MS / 1000}s test`);
  } else {
    fail("Stability During Stress", `${errorCount} errors during test`);
  }
  
  // Test 6: Check memory stability
  log("\nTest 6: Checking memory stability...");
  const finalMemory = getMemoryUsageMB();
  const memoryGrowth = finalMemory - initialMemory;
  const avgMemory = memorySamples.reduce((a, b) => a + b, 0) / memorySamples.length;
  
  if (memoryGrowth < MAX_MEMORY_GROWTH_MB) {
    pass("Memory Stability", `Growth: ${memoryGrowth}MB (limit: ${MAX_MEMORY_GROWTH_MB}MB), Avg: ${Math.round(avgMemory)}MB`);
  } else {
    fail("Memory Stability", `Memory grew by ${memoryGrowth}MB, exceeds ${MAX_MEMORY_GROWTH_MB}MB limit`);
  }
  
  // Test 7: Check games completed
  log("\nTest 7: Checking game completion...");
  if (totalGamesCompleted > 0) {
    pass("Game Completion", `${totalGamesCompleted} games completed during test`);
  } else {
    fail("Game Completion", "No games completed during test");
  }
  
  // Test 8: Stop simulator
  log("\nTest 8: Stopping simulator...");
  try {
    stopBotSimulator();
    await sleep(1000);
    const status = getBotSimulatorStatus();
    const activeGames = getActiveGames();
    
    if (!status.isRunning && activeGames.length === 0) {
      pass("Stop Simulator", "Simulator stopped and games cleared");
    } else {
      fail("Stop Simulator", `Running: ${status.isRunning}, Active games: ${activeGames.length}`);
    }
  } catch (error: any) {
    fail("Stop Simulator", error.message);
  }
  
  // Test 9: Verify bot statistics updated
  log("\nTest 9: Verifying bot statistics...");
  try {
    const botsWithGames = await db.select({
      count: sql<number>`count(*)`.mapWith(Number)
    }).from(users).where(
      and(
        sql`${users.email} LIKE '%@vix.bot'`,
        sql`${users.gamesPlayed} > 0`
      )
    );
    
    const count = botsWithGames[0]?.count || 0;
    if (count > 0) {
      pass("Bot Statistics", `${count} bots have updated game statistics`);
    } else {
      fail("Bot Statistics", "No bots have game statistics");
    }
  } catch (error: any) {
    fail("Bot Statistics", error.message);
  }
  
  // Test 10: Verify challenges have proper winners
  log("\nTest 10: Verifying challenge winners...");
  try {
    const challengesWithWinners = await db.select({
      count: sql<number>`count(*)`.mapWith(Number)
    }).from(challenges).where(
      and(
        eq(challenges.status, "completed"),
        sql`${challenges.winnerId} IS NOT NULL`
      )
    );
    
    const count = challengesWithWinners[0]?.count || 0;
    if (count > 0) {
      pass("Challenge Winners", `${count} completed challenges have winners recorded`);
    } else {
      fail("Challenge Winners", "No completed challenges have winners");
    }
  } catch (error: any) {
    fail("Challenge Winners", error.message);
  }
  
  // Summary
  const totalDuration = Date.now() - startTime;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log("\n" + "=".repeat(60));
  console.log("BOT SIMULATOR STRESS TEST SUMMARY");
  console.log("=".repeat(60));
  console.log(`Duration: ${Math.round(totalDuration / 1000)}s`);
  console.log(`Max concurrent games: ${maxActiveGames}`);
  console.log(`Games completed: ${totalGamesCompleted}`);
  console.log(`Memory: ${initialMemory}MB → ${finalMemory}MB (${memoryGrowth > 0 ? "+" : ""}${memoryGrowth}MB)`);
  console.log("-".repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("=".repeat(60));
  
  if (failed > 0) {
    console.log("\nFailed tests:");
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.message}`);
    });
    process.exit(1);
  } else {
    console.log("\n✓ All tests passed!");
    process.exit(0);
  }
}

// Run the stress test
runStressTest().catch(err => {
  console.error("Stress test crashed:", err);
  process.exit(1);
});
