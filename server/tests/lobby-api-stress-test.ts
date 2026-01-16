/**
 * Lobby API Stress Test Suite
 * 
 * Tests lobby endpoints under load with actual API calls:
 * 1. Concurrent challenge creation via API
 * 2. Join race conditions via API
 * 3. Financial safety with real balance checks
 * 4. Self-join prevention at API level
 * 5. Concurrent lobby queries via API
 * 
 * Run: npx tsx server/tests/lobby-api-stress-test.ts
 */

import { db } from '../db';
import { users, challenges } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:5000';
const TEST_RUN_ID = nanoid(6);
const TEST_PREFIX = `api_${TEST_RUN_ID}_`;
const INITIAL_BALANCE = 10000;

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  details?: string;
}

const results: TestResult[] = [];

async function cleanup() {
  // Delete challenges first (no FK dependencies)
  await db.delete(challenges).where(sql`${challenges.id} LIKE ${TEST_PREFIX + '%'}`);
  // Don't delete users - they may have audit logs. Just let them accumulate for test runs.
  // In production, test data would be in a separate database.
}

async function createTestUser(suffix: string, balance: number = INITIAL_BALANCE) {
  const username = `${TEST_PREFIX}user_${suffix}`;
  const hashedPassword = await bcrypt.hash('testpass123', 10);
  const [user] = await db.insert(users).values({
    username,
    email: `${username}@test.com`,
    password: hashedPassword,
    balance: balance.toString(),
    role: 'player',
  }).returning();
  return { ...user, plainPassword: 'testpass123' };
}

async function loginUser(username: string, password: string): Promise<string | null> {
  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return data.token;
  } catch (e) {
    return null;
  }
}

async function apiCall(
  method: string, 
  path: string, 
  token: string | null = null, 
  body?: any
): Promise<{ ok: boolean; status: number; data: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  
  let data = null;
  try {
    data = await response.json();
  } catch (e) {
    // No JSON body
  }
  
  return { ok: response.ok, status: response.status, data };
}

async function runTest(name: string, testFn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await testFn();
    results.push({ name, passed: true, duration: Date.now() - start });
    console.log(`✅ ${name} (${Date.now() - start}ms)`);
  } catch (error: any) {
    results.push({ name, passed: false, duration: Date.now() - start, details: error.message });
    console.log(`❌ ${name}: ${error.message}`);
  }
}

// =============================================================================
// TEST SUITE 1: API Challenge Creation Under Load
// =============================================================================

async function testConcurrentChallengeCreationAPI() {
  await runTest('API: Concurrent challenge creation (20 challenges)', async () => {
    const user = await createTestUser('api_creator', 50000);
    const token = await loginUser(user.username, user.plainPassword);
    
    if (!token) throw new Error('Failed to authenticate test user');
    
    // Create 20 challenges concurrently via API
    const promises = Array.from({ length: 20 }, (_, i) =>
      apiCall('POST', '/api/challenges', token, {
        gameType: ['chess', 'domino', 'backgammon', 'tarneeb', 'baloot'][i % 5],
        betAmount: 50 + i,
        visibility: 'public',
        opponentType: 'random',
      })
    );
    
    const startTime = Date.now();
    const responses = await Promise.all(promises);
    const duration = Date.now() - startTime;
    
    const successful = responses.filter(r => r.ok);
    
    console.log(`  Created ${successful.length} challenges via API in ${duration}ms`);
    
    if (successful.length < 15) {
      throw new Error(`Too few successful creations: ${successful.length}/20`);
    }
  });
}

async function testConcurrentLobbyQueriesAPI() {
  await runTest('API: Concurrent lobby queries (30 rapid polls)', async () => {
    // Create user for authenticated queries
    const user = await createTestUser('query_user');
    const token = await loginUser(user.username, user.plainPassword);
    
    if (!token) throw new Error('Failed to authenticate');
    
    // Query available challenges endpoint rapidly (authenticated)
    const promises = Array.from({ length: 30 }, () =>
      apiCall('GET', '/api/challenges/available', token)
    );
    
    const startTime = Date.now();
    const responses = await Promise.all(promises);
    const duration = Date.now() - startTime;
    
    const successful = responses.filter(r => r.ok).length;
    
    console.log(`  Completed ${successful}/30 queries in ${duration}ms (avg ${(duration / 30).toFixed(1)}ms/query)`);
    
    if (successful < 28) {
      throw new Error(`Too many failed queries: ${30 - successful}/30`);
    }
  });
}

// =============================================================================
// TEST SUITE 2: Join Race Conditions via API
// =============================================================================

async function testJoinRaceConditionAPI() {
  await runTest('API: Join race condition prevention', async () => {
    const creator = await createTestUser('race_api_creator');
    const joiner1 = await createTestUser('race_api_joiner1');
    const joiner2 = await createTestUser('race_api_joiner2');
    
    const creatorToken = await loginUser(creator.username, creator.plainPassword);
    const joiner1Token = await loginUser(joiner1.username, joiner1.plainPassword);
    const joiner2Token = await loginUser(joiner2.username, joiner2.plainPassword);
    
    if (!creatorToken || !joiner1Token || !joiner2Token) {
      throw new Error('Failed to authenticate test users');
    }
    
    // Create challenge
    const createRes = await apiCall('POST', '/api/challenges', creatorToken, {
      gameType: 'chess',
      betAmount: 100,
      visibility: 'public',
      opponentType: 'random',
    });
    
    if (!createRes.ok) throw new Error('Failed to create challenge');
    
    const challengeId = createRes.data.id;
    
    // Two users try to join simultaneously
    const joinResults = await Promise.allSettled([
      apiCall('POST', `/api/challenges/${challengeId}/join`, joiner1Token),
      apiCall('POST', `/api/challenges/${challengeId}/join`, joiner2Token),
    ]);
    
    const successfulJoins = joinResults.filter(
      r => r.status === 'fulfilled' && r.value.ok
    ).length;
    
    // Only one should succeed
    if (successfulJoins > 1) {
      throw new Error(`Race condition: ${successfulJoins} users joined the same challenge`);
    }
    
    if (successfulJoins < 1) {
      throw new Error('No user could join the challenge');
    }
  });
}

async function testSelfJoinBlockedAPI() {
  await runTest('API: Self-join prevention', async () => {
    const user = await createTestUser('self_join_api');
    const token = await loginUser(user.username, user.plainPassword);
    
    if (!token) throw new Error('Failed to authenticate');
    
    // Create challenge
    const createRes = await apiCall('POST', '/api/challenges', token, {
      gameType: 'chess',
      betAmount: 50,
      visibility: 'public',
      opponentType: 'random',
    });
    
    if (!createRes.ok) throw new Error('Failed to create challenge');
    
    // Try to join own challenge
    const joinRes = await apiCall('POST', `/api/challenges/${createRes.data.id}/join`, token);
    
    // Should be rejected
    if (joinRes.ok) {
      throw new Error('Self-join was allowed - this is a security issue');
    }
    
    console.log(`  Self-join correctly rejected with status ${joinRes.status}`);
  });
}

// =============================================================================
// TEST SUITE 3: Financial Safety via API
// =============================================================================

async function testInsufficientBalanceBlockedAPI() {
  await runTest('API: Insufficient balance prevention', async () => {
    const creator = await createTestUser('insuf_api_creator');
    const joiner = await createTestUser('insuf_api_joiner', 50); // Only 50 balance
    
    const creatorToken = await loginUser(creator.username, creator.plainPassword);
    const joinerToken = await loginUser(joiner.username, joiner.plainPassword);
    
    if (!creatorToken || !joinerToken) throw new Error('Failed to authenticate');
    
    // Create challenge with 500 stake
    const createRes = await apiCall('POST', '/api/challenges', creatorToken, {
      gameType: 'chess',
      betAmount: 500,
      visibility: 'public',
      opponentType: 'random',
    });
    
    if (!createRes.ok) throw new Error('Failed to create challenge');
    
    // Joiner (with 50 balance) tries to join 500 stake challenge
    const joinRes = await apiCall('POST', `/api/challenges/${createRes.data.id}/join`, joinerToken);
    
    if (joinRes.ok) {
      throw new Error('Joined challenge despite insufficient balance - CRITICAL FINANCIAL BUG');
    }
    
    console.log(`  Insufficient balance correctly rejected with status ${joinRes.status}`);
  });
}

async function testBalanceDeductionOnJoinAPI() {
  await runTest('API: Balance deduction on join', async () => {
    const betAmount = 100;
    const creator = await createTestUser('deduct_api_creator');
    const joiner = await createTestUser('deduct_api_joiner', 1000);
    
    const creatorToken = await loginUser(creator.username, creator.plainPassword);
    const joinerToken = await loginUser(joiner.username, joiner.plainPassword);
    
    if (!creatorToken || !joinerToken) throw new Error('Failed to authenticate');
    
    // Get initial balance
    const initialBalance = 1000;
    
    // Create and join challenge
    const createRes = await apiCall('POST', '/api/challenges', creatorToken, {
      gameType: 'chess',
      betAmount,
      visibility: 'public',
      opponentType: 'random',
    });
    
    if (!createRes.ok) throw new Error('Failed to create challenge');
    
    const joinRes = await apiCall('POST', `/api/challenges/${createRes.data.id}/join`, joinerToken);
    
    if (!joinRes.ok) throw new Error('Failed to join challenge');
    
    // Check balance was deducted
    const [updatedJoiner] = await db.select().from(users).where(eq(users.id, joiner.id));
    const newBalance = parseFloat(updatedJoiner.balance);
    
    if (newBalance >= initialBalance) {
      throw new Error(`Balance not deducted: was ${initialBalance}, now ${newBalance}`);
    }
    
    console.log(`  Balance correctly deducted: ${initialBalance} -> ${newBalance}`);
  });
}

async function testConcurrentJoinBalanceIntegrityAPI() {
  await runTest('API: Concurrent join attempts maintain balance integrity', async () => {
    const betAmount = 100;
    const creator = await createTestUser('conc_api_creator');
    const creatorToken = await loginUser(creator.username, creator.plainPassword);
    
    if (!creatorToken) throw new Error('Failed to authenticate creator');
    
    // Create 5 challenges
    const challengePromises = Array.from({ length: 5 }, () =>
      apiCall('POST', '/api/challenges', creatorToken, {
        gameType: 'chess',
        betAmount,
        visibility: 'public',
        opponentType: 'random',
      })
    );
    const challengeResults = await Promise.all(challengePromises);
    const challengeIds = challengeResults.filter(r => r.ok).map(r => r.data.id);
    
    // Create joiner with 300 balance (can only afford 3 joins)
    const joiner = await createTestUser('conc_api_joiner', 300);
    const joinerToken = await loginUser(joiner.username, joiner.plainPassword);
    
    if (!joinerToken) throw new Error('Failed to authenticate joiner');
    
    // Try to join all 5 concurrently
    const joinPromises = challengeIds.map(id =>
      apiCall('POST', `/api/challenges/${id}/join`, joinerToken)
    );
    
    const joinResults = await Promise.all(joinPromises);
    const successfulJoins = joinResults.filter(r => r.ok).length;
    
    // Should only join up to 3 (300 / 100 = 3)
    if (successfulJoins > 3) {
      throw new Error(`Joined ${successfulJoins} challenges with only 300 balance for 100/each - OVERDRAFT BUG`);
    }
    
    // Verify final balance is non-negative
    const [finalJoiner] = await db.select().from(users).where(eq(users.id, joiner.id));
    const finalBalance = parseFloat(finalJoiner.balance);
    
    if (finalBalance < 0) {
      throw new Error(`Negative balance detected: ${finalBalance} - CRITICAL BUG`);
    }
    
    console.log(`  Joined ${successfulJoins}/5 challenges, final balance: ${finalBalance}`);
  });
}

// =============================================================================
// TEST SUITE 4: Spectator/Watch Access
// =============================================================================

async function testSpectatorAccessAPI() {
  await runTest('API: Spectator access to active games', async () => {
    const player1 = await createTestUser('spec_api_p1');
    const player2 = await createTestUser('spec_api_p2');
    const spectator = await createTestUser('spec_api_watcher');
    
    const p1Token = await loginUser(player1.username, player1.plainPassword);
    const p2Token = await loginUser(player2.username, player2.plainPassword);
    const spectatorToken = await loginUser(spectator.username, spectator.plainPassword);
    
    if (!p1Token || !p2Token || !spectatorToken) throw new Error('Failed to authenticate users');
    
    // Create and join to make active game
    const createRes = await apiCall('POST', '/api/challenges', p1Token, {
      gameType: 'chess',
      betAmount: 50,
      visibility: 'public',
      opponentType: 'random',
    });
    
    if (!createRes.ok) throw new Error('Failed to create challenge');
    
    const joinRes = await apiCall('POST', `/api/challenges/${createRes.data.id}/join`, p2Token);
    if (!joinRes.ok) throw new Error('Failed to join challenge');
    
    // Check public challenges endpoint shows active game (authenticated)
    const publicRes = await apiCall('GET', '/api/challenges/public', spectatorToken);
    
    if (!publicRes.ok) throw new Error(`Failed to fetch public challenges: ${publicRes.status}`);
    
    const activeGames = publicRes.data.filter((c: any) => c.status === 'active');
    
    console.log(`  Found ${activeGames.length} active game(s) available for spectating`);
  });
}

// =============================================================================
// TEST SUITE 5: High-Load Stress Test
// =============================================================================

async function testMixedOperationsUnderLoadAPI() {
  await runTest('API: Mixed operations under load', async () => {
    const user = await createTestUser('mixed_api_user', 50000);
    const token = await loginUser(user.username, user.plainPassword);
    
    if (!token) throw new Error('Failed to authenticate');
    
    // Mix of create and query operations
    const operations: Promise<any>[] = [];
    
    // 10 challenge creations
    for (let i = 0; i < 10; i++) {
      operations.push(
        apiCall('POST', '/api/challenges', token, {
          gameType: 'chess',
          betAmount: 50 + i,
          visibility: 'public',
          opponentType: 'random',
        })
      );
    }
    
    // 20 lobby queries
    for (let i = 0; i < 20; i++) {
      operations.push(apiCall('GET', '/api/challenges/available'));
    }
    
    const startTime = Date.now();
    await Promise.all(operations);
    const duration = Date.now() - startTime;
    
    console.log(`  Completed ${operations.length} mixed API operations in ${duration}ms`);
  });
}

// =============================================================================
// Main Test Runner
// =============================================================================

async function runAllTests() {
  console.log('\n========================================');
  console.log('  LOBBY API STRESS TEST SUITE');
  console.log('========================================\n');
  
  try {
    await cleanup();
    console.log('Initial cleanup completed\n');
    
    // Suite 1: API Challenge Operations
    console.log('📦 Suite 1: API Challenge Operations');
    await testConcurrentChallengeCreationAPI();
    await testConcurrentLobbyQueriesAPI();
    await cleanup();
    
    // Suite 2: Join Synchronization
    console.log('\n🔄 Suite 2: API Join Synchronization');
    await testJoinRaceConditionAPI();
    await testSelfJoinBlockedAPI();
    await cleanup();
    
    // Suite 3: Financial Safety
    console.log('\n💰 Suite 3: API Financial Safety');
    await testInsufficientBalanceBlockedAPI();
    await testBalanceDeductionOnJoinAPI();
    await testConcurrentJoinBalanceIntegrityAPI();
    await cleanup();
    
    // Suite 4: Spectator Access
    console.log('\n👀 Suite 4: Spectator Access');
    await testSpectatorAccessAPI();
    await cleanup();
    
    // Suite 5: High-Load Stress
    console.log('\n⚡ Suite 5: High-Load Stress');
    await testMixedOperationsUnderLoadAPI();
    await cleanup();
    
  } catch (error) {
    console.error('Test suite error:', error);
  }
  
  await cleanup();
  
  // Results summary
  console.log('\n========================================');
  console.log('  TEST RESULTS SUMMARY');
  console.log('========================================\n');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  
  results.forEach(r => {
    const status = r.passed ? '✅' : '❌';
    console.log(`${status} ${r.name} (${r.duration}ms)`);
    if (r.details) console.log(`   └─ ${r.details}`);
  });
  
  console.log('\n----------------------------------------');
  console.log(`Total: ${passed}/${results.length} passed (${failed} failed)`);
  console.log(`Duration: ${totalDuration}ms`);
  console.log('----------------------------------------\n');
  
  process.exit(failed > 0 ? 1 : 0);
}

runAllTests();
