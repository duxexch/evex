/**
 * Financial Concurrency Test Suite
 * 
 * Tests financial operations using real storage transactional paths:
 * - Concurrent stake deductions
 * - Parallel payout processing
 * - Race condition prevention
 * - Transaction rollback verification
 * - Precision handling under load
 */

import { storage } from '../storage';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

// Test user IDs created for this suite
const testUserIds: string[] = [];

async function createTestUser(balance: string): Promise<string> {
  const accountId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  const user = await storage.createUser({
    accountId,
    username: accountId,
    password: 'test-password-hash',
    role: 'player' as const,
    status: 'active' as const,
    balance,
  } as any);
  const id = String(user.id);
  testUserIds.push(id);
  return id;
}

async function getBalance(userId: string): Promise<string> {
  const user = await storage.getUser(userId);
  return user?.balance || '0.00';
}

async function cleanupTestUsers(): Promise<void> {
  for (const userId of testUserIds) {
    try {
      await db.delete(users).where(eq(users.id, parseInt(userId)));
    } catch (error) {
      console.log(`  Warning: Could not delete test user ${userId}`);
    }
  }
  testUserIds.length = 0;
}

async function runTest(name: string, testFn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await testFn();
    results.push({ name, passed: true, duration: Date.now() - start });
    console.log(`✅ PASS: ${name} (${Date.now() - start}ms)`);
  } catch (error: any) {
    results.push({ name, passed: false, error: error.message, duration: Date.now() - start });
    console.log(`❌ FAIL: ${name} - ${error.message} (${Date.now() - start}ms)`);
  }
}

async function runAtomicOperationTests() {
  console.log('\n=== ATOMIC OPERATION TESTS ===\n');

  await runTest('Balance update with negative prevention (real storage)', async () => {
    const userId = await createTestUser('100.00');
    
    // Try to subtract more than available
    const result = await storage.updateUserBalanceWithCheck(userId, '150.00', 'subtract');
    
    if (result.success) {
      throw new Error('Should have rejected insufficient balance');
    }
    
    const finalBalance = await getBalance(userId);
    if (finalBalance !== '100.00') {
      throw new Error(`Balance corrupted: expected 100.00, got ${finalBalance}`);
    }
  });

  await runTest('Sequential balance updates maintain consistency', async () => {
    const userId = await createTestUser('1000.00');
    
    // Perform multiple sequential operations
    for (let i = 0; i < 10; i++) {
      await storage.updateUserBalanceWithCheck(userId, '10.00', 'add');
    }
    for (let i = 0; i < 5; i++) {
      await storage.updateUserBalanceWithCheck(userId, '10.00', 'subtract');
    }
    
    const finalBalance = await getBalance(userId);
    const expected = (1000 + 100 - 50).toFixed(2);
    
    if (finalBalance !== expected) {
      throw new Error(`Balance mismatch: expected ${expected}, got ${finalBalance}`);
    }
  });

  await runTest('Decimal precision is maintained through operations', async () => {
    const userId = await createTestUser('0.00');
    
    // Add fractional amounts
    await storage.updateUserBalanceWithCheck(userId, '33.33', 'add');
    await storage.updateUserBalanceWithCheck(userId, '33.33', 'add');
    await storage.updateUserBalanceWithCheck(userId, '33.34', 'add');
    
    const finalBalance = await getBalance(userId);
    if (finalBalance !== '100.00') {
      throw new Error(`Precision lost: expected 100.00, got ${finalBalance}`);
    }
  });
}

async function runConcurrentOperationTests() {
  console.log('\n=== CONCURRENT OPERATION TESTS ===\n');

  await runTest('Concurrent balance updates are serialized', async () => {
    const userId = await createTestUser('1000.00');
    
    // Fire 20 concurrent +10 operations
    const operations = Array(20).fill(null).map(() => 
      storage.updateUserBalanceWithCheck(userId, '10.00', 'add')
    );
    
    await Promise.all(operations);
    
    const finalBalance = await getBalance(userId);
    const expected = (1000 + 200).toFixed(2);
    
    if (finalBalance !== expected) {
      throw new Error(`Concurrent updates corrupted balance: expected ${expected}, got ${finalBalance}`);
    }
  });

  await runTest('Mixed concurrent add/subtract maintains consistency', async () => {
    const userId = await createTestUser('500.00');
    
    // Mix of adds and subtracts
    const operations = [
      ...Array(10).fill(null).map(() => storage.updateUserBalanceWithCheck(userId, '10.00', 'add')),
      ...Array(5).fill(null).map(() => storage.updateUserBalanceWithCheck(userId, '10.00', 'subtract'))
    ];
    
    // Shuffle operations to interleave
    for (let i = operations.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [operations[i], operations[j]] = [operations[j], operations[i]];
    }
    
    await Promise.all(operations);
    
    const finalBalance = await getBalance(userId);
    const expected = (500 + 100 - 50).toFixed(2);
    
    if (finalBalance !== expected) {
      throw new Error(`Mixed operations corrupted balance: expected ${expected}, got ${finalBalance}`);
    }
  });

  await runTest('Concurrent transfers between users preserve total', async () => {
    // Create 5 users with 1000 each
    const userIds = await Promise.all([
      createTestUser('1000.00'),
      createTestUser('1000.00'),
      createTestUser('1000.00'),
      createTestUser('1000.00'),
      createTestUser('1000.00')
    ]);
    
    const initialTotal = 5000;
    
    // Execute random transfers between users
    const transfers: Promise<any>[] = [];
    for (let i = 0; i < 20; i++) {
      const from = userIds[Math.floor(Math.random() * userIds.length)];
      const to = userIds[Math.floor(Math.random() * userIds.length)];
      if (from !== to) {
        transfers.push(storage.transferBalance(from, to, '10.00'));
      }
    }
    
    await Promise.all(transfers);
    
    // Calculate final total
    let finalTotal = 0;
    for (const userId of userIds) {
      const balance = await getBalance(userId);
      finalTotal += parseFloat(balance);
    }
    
    if (Math.abs(finalTotal - initialTotal) > 0.01) {
      throw new Error(`Total balance corrupted: expected ${initialTotal}, got ${finalTotal}`);
    }
    
    console.log(`  Total balance preserved: ${finalTotal.toFixed(2)}`);
  });
}

async function runStakePayoutTests() {
  console.log('\n=== STAKE/PAYOUT FLOW TESTS ===\n');

  await runTest('Full game flow: stake deduction + payout (winner gets pot)', async () => {
    const player1 = await createTestUser('500.00');
    const player2 = await createTestUser('500.00');
    const stake = '100.00';
    
    // Deduct stakes from both players
    const deduct1 = await storage.updateUserBalanceWithCheck(player1, stake, 'subtract');
    const deduct2 = await storage.updateUserBalanceWithCheck(player2, stake, 'subtract');
    
    if (!deduct1.success || !deduct2.success) {
      throw new Error('Stake deduction failed');
    }
    
    // Verify stakes deducted
    const p1AfterStake = await getBalance(player1);
    const p2AfterStake = await getBalance(player2);
    
    if (p1AfterStake !== '400.00' || p2AfterStake !== '400.00') {
      throw new Error(`Stakes not deducted correctly: P1=${p1AfterStake}, P2=${p2AfterStake}`);
    }
    
    // Player 1 wins - gets both stakes (200)
    const winnerPayout = (parseFloat(stake) * 2).toFixed(2);
    await storage.updateUserBalanceWithCheck(player1, winnerPayout, 'add');
    
    const p1Final = await getBalance(player1);
    const p2Final = await getBalance(player2);
    
    // P1: 400 + 200 = 600, P2: 400
    if (p1Final !== '600.00') {
      throw new Error(`Winner balance wrong: expected 600.00, got ${p1Final}`);
    }
    if (p2Final !== '400.00') {
      throw new Error(`Loser balance wrong: expected 400.00, got ${p2Final}`);
    }
    
    // Total should still be 1000
    const total = parseFloat(p1Final) + parseFloat(p2Final);
    if (total !== 1000) {
      throw new Error(`Total balance corrupted: expected 1000, got ${total}`);
    }
  });

  await runTest('Multiple rapid games maintain balance integrity', async () => {
    const player1 = await createTestUser('10000.00');
    const player2 = await createTestUser('10000.00');
    const stake = '50.00';
    
    // Simulate 20 games with alternating winners
    for (let i = 0; i < 20; i++) {
      // Deduct stakes
      await storage.updateUserBalanceWithCheck(player1, stake, 'subtract');
      await storage.updateUserBalanceWithCheck(player2, stake, 'subtract');
      
      // Award winner (alternating)
      const winnerId = i % 2 === 0 ? player1 : player2;
      const winnerPayout = (parseFloat(stake) * 2).toFixed(2);
      await storage.updateUserBalanceWithCheck(winnerId, winnerPayout, 'add');
    }
    
    const p1Final = await getBalance(player1);
    const p2Final = await getBalance(player2);
    const total = parseFloat(p1Final) + parseFloat(p2Final);
    
    // With alternating wins, both should have 10000
    if (total !== 20000) {
      throw new Error(`Total corrupted after 20 games: expected 20000, got ${total}`);
    }
    
    console.log(`  Final balances: P1=${p1Final}, P2=${p2Final}, Total=${total}`);
  });

  await runTest('Insufficient balance mid-game prevents stake deduction', async () => {
    const player1 = await createTestUser('100.00');
    const player2 = await createTestUser('50.00'); // Not enough for 100 stake
    const stake = '100.00';
    
    const deduct1 = await storage.updateUserBalanceWithCheck(player1, stake, 'subtract');
    const deduct2 = await storage.updateUserBalanceWithCheck(player2, stake, 'subtract');
    
    if (!deduct1.success) {
      throw new Error('Player1 deduction should have succeeded');
    }
    if (deduct2.success) {
      throw new Error('Player2 deduction should have failed (insufficient balance)');
    }
    
    // Rollback player1's deduction since game can't start
    await storage.updateUserBalanceWithCheck(player1, stake, 'add');
    
    const p1Final = await getBalance(player1);
    const p2Final = await getBalance(player2);
    
    if (p1Final !== '100.00' || p2Final !== '50.00') {
      throw new Error(`Rollback failed: P1=${p1Final}, P2=${p2Final}`);
    }
    
    console.log('  Game prevented, balances restored');
  });
}

async function runEdgeCaseTests() {
  console.log('\n=== EDGE CASE TESTS ===\n');

  await runTest('Zero amount operations are handled', async () => {
    const userId = await createTestUser('100.00');
    
    await storage.updateUserBalanceWithCheck(userId, '0.00', 'add');
    await storage.updateUserBalanceWithCheck(userId, '0.00', 'subtract');
    
    const balance = await getBalance(userId);
    if (balance !== '100.00') {
      throw new Error(`Zero operations affected balance: ${balance}`);
    }
  });

  await runTest('Large concurrent operations stress test', async () => {
    const userId = await createTestUser('100000.00');
    
    // 50 concurrent small operations
    const operations = Array(50).fill(null).map(() =>
      storage.updateUserBalanceWithCheck(userId, '1.00', 'add')
    );
    
    await Promise.all(operations);
    
    const finalBalance = await getBalance(userId);
    const expected = (100000 + 50).toFixed(2);
    
    if (finalBalance !== expected) {
      throw new Error(`Stress test failed: expected ${expected}, got ${finalBalance}`);
    }
    
    console.log(`  50 concurrent operations completed successfully`);
  });

  await runTest('Self-transfer is rejected at storage level', async () => {
    const userId = await createTestUser('500.00');
    
    // Self-transfers are now blocked at the storage layer
    const result = await storage.transferBalance(userId, userId, '100.00');
    
    if (result.success) {
      throw new Error('Self-transfer should have been rejected');
    }
    
    if (result.error !== 'Cannot transfer to self') {
      throw new Error(`Wrong error message: ${result.error}`);
    }
    
    // Verify balance unchanged
    const balance = await getBalance(userId);
    if (balance !== '500.00') {
      throw new Error(`Balance corrupted by rejected self-transfer: ${balance}`);
    }
    
    console.log('  Self-transfer correctly rejected, balance preserved');
  });
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   FINANCIAL CONCURRENCY TEST SUITE                        ║');
  console.log('║   Testing Real Storage Transaction Paths                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    await runAtomicOperationTests();
    await runConcurrentOperationTests();
    await runStakePayoutTests();
    await runEdgeCaseTests();
  } finally {
    // Cleanup test users
    console.log('\n=== CLEANUP ===');
    await cleanupTestUsers();
    console.log(`  Removed ${testUserIds.length} test users`);
  }

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                     TEST SUMMARY                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total Time: ${totalTime}ms`);

  if (failed > 0) {
    console.log('\nFAILED TESTS:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ❌ ${r.name}: ${r.error}`);
    });
    console.log('\n❌ FINANCIAL CONCURRENCY TESTS FAILED');
    process.exit(1);
  } else {
    console.log('\n✅ ALL FINANCIAL CONCURRENCY TESTS PASSED');
    console.log('   Real storage transaction paths are production ready');
  }
}

main().catch(console.error);
