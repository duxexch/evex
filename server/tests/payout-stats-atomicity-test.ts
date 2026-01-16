import { db } from '../db';
import { users, liveGameSessions, games } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { storage } from '../storage';

const TEST_PREFIX = 'payout_test_';
let testUsers: { id: string; username: string }[] = [];
let testSessionIds: string[] = [];
let testGameId: string | null = null;

async function ensureTestGame() {
  if (testGameId) return testGameId;
  const [existing] = await db.select().from(games).limit(1);
  if (existing) {
    testGameId = existing.id;
    return testGameId;
  }
  const [game] = await db.insert(games).values({
    name: 'Test Chess',
    internalName: 'chess',
    category: 'board',
    status: 'active',
  }).returning();
  testGameId = game.id;
  return testGameId;
}

async function createTestUser(suffix: string, balance: string = '100.00') {
  const username = `${TEST_PREFIX}${suffix}_${Date.now()}`;
  const user = await storage.createUser({
    username,
    password: 'test123',
  });
  await db.update(users).set({
    balance,
    gamesPlayed: 0,
    gamesWon: 0,
    gamesLost: 0,
    gamesDraw: 0,
    chessPlayed: 0,
    chessWon: 0,
    backgammonPlayed: 0,
    backgammonWon: 0,
    currentWinStreak: 0,
    longestWinStreak: 0,
    totalEarnings: '0.00',
  }).where(eq(users.id, user.id));
  testUsers.push({ id: user.id, username });
  const [updatedUser] = await db.select().from(users).where(eq(users.id, user.id));
  return updatedUser;
}

async function createTestSession(gameType: string, player1Id: string, player2Id: string | null) {
  const gameId = await ensureTestGame();
  const session = await storage.createLiveGameSession({
    gameId,
    gameType,
    player1Id,
    player2Id,
    status: 'in_progress',
    gameState: '{}',
  });
  testSessionIds.push(session.id);
  return session;
}

async function cleanup() {
  for (const sessionId of testSessionIds) {
    await db.delete(liveGameSessions).where(eq(liveGameSessions.id, sessionId)).catch(() => {});
  }
  for (const user of testUsers) {
    await db.delete(users).where(eq(users.id, user.id)).catch(() => {});
  }
  testUsers = [];
  testSessionIds = [];
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function test_payout_updates_stats_atomically() {
  console.log('\n[TEST] Payout updates stats atomically');
  
  const winner = await createTestUser('winner', '50.00');
  const loser = await createTestUser('loser', '50.00');
  
  const initialWinnerStats = {
    gamesPlayed: winner.gamesPlayed,
    gamesWon: winner.gamesWon,
    chessWon: winner.chessWon,
    totalEarnings: winner.totalEarnings,
    currentWinStreak: winner.currentWinStreak,
  };
  
  const initialLoserStats = {
    gamesPlayed: loser.gamesPlayed,
    gamesLost: loser.gamesLost,
    chessPlayed: loser.chessPlayed,
  };

  const session = await createTestSession('chess', winner.id, loser.id);

  const result = await storage.settleGamePayout(
    session.id,
    winner.id,
    loser.id,
    '25.00',
    0,
    'chess'
  );

  assert(result.success, 'Payout should succeed');

  const [updatedWinner] = await db.select().from(users).where(eq(users.id, winner.id));
  const [updatedLoser] = await db.select().from(users).where(eq(users.id, loser.id));

  assert(updatedWinner.gamesPlayed === initialWinnerStats.gamesPlayed + 1, 
    `Winner gamesPlayed should increment: ${updatedWinner.gamesPlayed}`);
  assert(updatedWinner.gamesWon === initialWinnerStats.gamesWon + 1, 
    `Winner gamesWon should increment: ${updatedWinner.gamesWon}`);
  assert(updatedWinner.chessWon === initialWinnerStats.chessWon + 1, 
    `Winner chessWon should increment: ${updatedWinner.chessWon}`);
  assert(parseFloat(updatedWinner.totalEarnings!) === parseFloat(initialWinnerStats.totalEarnings!) + 25, 
    `Winner totalEarnings should increase by 25: ${updatedWinner.totalEarnings}`);
  assert(updatedWinner.currentWinStreak === initialWinnerStats.currentWinStreak + 1, 
    `Winner currentWinStreak should increment: ${updatedWinner.currentWinStreak}`);

  assert(updatedLoser.gamesPlayed === initialLoserStats.gamesPlayed + 1, 
    `Loser gamesPlayed should increment: ${updatedLoser.gamesPlayed}`);
  assert(updatedLoser.gamesLost === initialLoserStats.gamesLost + 1, 
    `Loser gamesLost should increment: ${updatedLoser.gamesLost}`);
  assert(updatedLoser.currentWinStreak === 0, 
    `Loser currentWinStreak should reset: ${updatedLoser.currentWinStreak}`);

  assert(parseFloat(updatedWinner.balance) === 75, 
    `Winner balance should be 75 (50 + 25): ${updatedWinner.balance}`);

  console.log('  ✓ Winner stats updated atomically with payout');
  console.log('  ✓ Loser stats updated atomically with payout');
  console.log('  ✓ Balance and earnings consistent');
}

async function test_payout_rollback_on_missing_user() {
  console.log('\n[TEST] Payout rollback on missing user');
  
  const winner = await createTestUser('winner_rollback', '100.00');
  const fakeUserId = 'non-existent-user-id-12345';
  
  // Create session with winner only (null player2 for test)
  const session = await createTestSession('chess', winner.id, null);

  const result = await storage.settleGamePayout(
    session.id,
    winner.id,
    fakeUserId,
    '25.00',
    0,
    'chess'
  );

  assert(!result.success, 'Payout should fail for missing user');

  const [unchangedWinner] = await db.select().from(users).where(eq(users.id, winner.id));
  
  assert(unchangedWinner.gamesPlayed === 0, 
    `Winner gamesPlayed should remain 0 after rollback: ${unchangedWinner.gamesPlayed}`);
  assert(unchangedWinner.gamesWon === 0, 
    `Winner gamesWon should remain 0 after rollback: ${unchangedWinner.gamesWon}`);
  assert(parseFloat(unchangedWinner.balance) === 100, 
    `Winner balance should remain 100 after rollback: ${unchangedWinner.balance}`);

  console.log('  ✓ Transaction rolled back on failure');
  console.log('  ✓ Winner stats unchanged after rollback');
  console.log('  ✓ Balance unchanged after rollback');
}

async function test_non_paid_game_stats_update() {
  console.log('\n[TEST] Non-paid game stats update');
  
  const player1 = await createTestUser('player1_free', '0.00');
  const player2 = await createTestUser('player2_free', '0.00');

  const session = await createTestSession('backgammon', player1.id, player2.id);

  const result = await storage.updateGameStats(
    session.id,
    'backgammon',
    player1.id,
    player1.id,
    player2.id,
    false,
    '0'
  );

  assert(result.success, 'Stats update should succeed');

  const [updatedPlayer1] = await db.select().from(users).where(eq(users.id, player1.id));
  const [updatedPlayer2] = await db.select().from(users).where(eq(users.id, player2.id));

  assert(updatedPlayer1.gamesPlayed === 1, `Player1 gamesPlayed: ${updatedPlayer1.gamesPlayed}`);
  assert(updatedPlayer1.gamesWon === 1, `Player1 gamesWon: ${updatedPlayer1.gamesWon}`);
  assert(updatedPlayer1.backgammonPlayed === 1, `Player1 backgammonPlayed: ${updatedPlayer1.backgammonPlayed}`);
  assert(updatedPlayer1.backgammonWon === 1, `Player1 backgammonWon: ${updatedPlayer1.backgammonWon}`);

  assert(updatedPlayer2.gamesPlayed === 1, `Player2 gamesPlayed: ${updatedPlayer2.gamesPlayed}`);
  assert(updatedPlayer2.gamesLost === 1, `Player2 gamesLost: ${updatedPlayer2.gamesLost}`);
  assert(updatedPlayer2.backgammonPlayed === 1, `Player2 backgammonPlayed: ${updatedPlayer2.backgammonPlayed}`);

  console.log('  ✓ Non-paid game stats updated correctly');
  console.log('  ✓ Per-game stats (backgammon) tracked');
}

async function test_draw_game_stats() {
  console.log('\n[TEST] Draw game stats');
  
  const player1 = await createTestUser('player1_draw', '0.00');
  const player2 = await createTestUser('player2_draw', '0.00');

  // Set initial win streak
  await db.update(users).set({ currentWinStreak: 5 }).where(eq(users.id, player1.id));

  const session = await createTestSession('chess', player1.id, player2.id);

  const result = await storage.updateGameStats(
    session.id,
    'chess',
    null,
    player1.id,
    player2.id,
    true,
    '0'
  );

  assert(result.success, 'Draw stats update should succeed');

  const [updatedPlayer1] = await db.select().from(users).where(eq(users.id, player1.id));
  const [updatedPlayer2] = await db.select().from(users).where(eq(users.id, player2.id));

  assert(updatedPlayer1.gamesDraw === 1, `Player1 gamesDraw: ${updatedPlayer1.gamesDraw}`);
  assert(updatedPlayer1.currentWinStreak === 0, `Player1 winStreak should reset: ${updatedPlayer1.currentWinStreak}`);
  assert(updatedPlayer2.gamesDraw === 1, `Player2 gamesDraw: ${updatedPlayer2.gamesDraw}`);

  console.log('  ✓ Draw increments gamesDraw for both players');
  console.log('  ✓ Win streak reset on draw');
}

async function test_concurrent_payout_integrity() {
  console.log('\n[TEST] Concurrent payout integrity');
  
  const winner = await createTestUser('winner_conc', '100.00');
  const loser = await createTestUser('loser_conc', '100.00');

  const sessions: string[] = [];
  for (let i = 0; i < 3; i++) {
    const session = await createTestSession('chess', winner.id, loser.id);
    sessions.push(session.id);
  }

  const payoutPromises = sessions.map((sessionId) => 
    storage.settleGamePayout(sessionId, winner.id, loser.id, '10.00', 0, 'chess')
  );

  const results = await Promise.all(payoutPromises);
  
  const successCount = results.filter(r => r.success).length;
  console.log(`  Payouts succeeded: ${successCount}/3`);

  const [finalWinner] = await db.select().from(users).where(eq(users.id, winner.id));

  assert(finalWinner.gamesPlayed === successCount, 
    `Winner gamesPlayed should match success count: ${finalWinner.gamesPlayed}`);
  assert(finalWinner.gamesWon === successCount, 
    `Winner gamesWon should match success count: ${finalWinner.gamesWon}`);
  assert(parseFloat(finalWinner.balance) === 100 + (successCount * 10), 
    `Winner balance should be consistent: ${finalWinner.balance}`);

  console.log('  ✓ Concurrent payouts handled safely');
  console.log('  ✓ Stats and balances remain consistent');
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('PAYOUT + STATS ATOMICITY REGRESSION TESTS');
  console.log('='.repeat(60));

  const tests = [
    test_payout_updates_stats_atomically,
    test_payout_rollback_on_missing_user,
    test_non_paid_game_stats_update,
    test_draw_game_stats,
    test_concurrent_payout_integrity,
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (error: any) {
      console.error(`  ✗ FAILED: ${error.message}`);
      failed++;
    } finally {
      await cleanup();
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
