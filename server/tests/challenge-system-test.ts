const BASE_URL = 'http://localhost:5000';

interface TestUser {
  id: number;
  username: string;
  token: string;
  accountId: string;
}

interface Challenge {
  id: string;
  player1Id: number;
  player2Id: number | null;
  gameType: string;
  betAmount: number;
  status: string;
  visibility: string;
}

const GAME_TYPES = ['chess', 'domino', 'backgammon', 'tarneeb', 'baloot'];

let testUsers: TestUser[] = [];
let createdChallenges: Challenge[] = [];
let passCount = 0;
let failCount = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passCount++;
    console.log(`  ✓ ${name}`);
  } catch (error: any) {
    failCount++;
    console.log(`  ✗ ${name}: ${error.message}`);
  }
}

async function createTestUser(username: string): Promise<TestUser> {
  const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      email: `${username}@test.com`,
      password: 'TestPass123!',
      fullName: `Test User ${username}`,
    }),
  });

  if (!registerRes.ok) {
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password: 'TestPass123!',
      }),
    });
    
    if (!loginRes.ok) {
      throw new Error(`Failed to login user ${username}: ${await loginRes.text()}`);
    }
    
    const loginData = await loginRes.json();
    return {
      id: loginData.user.id,
      username: loginData.user.username,
      token: loginData.token,
      accountId: loginData.user.accountId,
    };
  }

  const registerData = await registerRes.json();
  return {
    id: registerData.user.id,
    username: registerData.user.username,
    token: registerData.token,
    accountId: registerData.user.accountId,
  };
}

async function addBalanceToUser(userId: number, amount: number): Promise<void> {
  const { db } = await import('../db');
  const { users } = await import('@shared/schema');
  const { eq, sql } = await import('drizzle-orm');
  
  await db.update(users)
    .set({ balance: sql`${users.balance} + ${amount}` })
    .where(eq(users.id, userId));
}

function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

async function runTests() {
  console.log('\n========================================');
  console.log('CHALLENGE SYSTEM COMPREHENSIVE TEST');
  console.log('Testing all 5 game types: Chess, Domino, Backgammon, Tarneeb, Baloot');
  console.log('========================================\n');

  console.log('Setting up test users...');
  for (let i = 1; i <= 3; i++) {
    const user = await createTestUser(`challenge_tester_${i}_${Date.now()}`);
    await addBalanceToUser(user.id, 10000);
    testUsers.push(user);
  }
  console.log(`Created ${testUsers.length} test users with balance\n`);

  console.log('1. Challenge Creation API');
  for (const gameType of GAME_TYPES) {
    await test(`should create a ${gameType} challenge`, async () => {
      const user = testUsers[0];
      
      const res = await fetch(`${BASE_URL}/api/challenges`, {
        method: 'POST',
        headers: authHeaders(user.token),
        body: JSON.stringify({
          gameType,
          betAmount: 100,
          visibility: 'public',
          opponentType: 'random',
        }),
      });

      assert(res.ok, `Response not ok: ${res.status}`);
      const challenge = await res.json();
      
      assert(challenge.gameType === gameType, `gameType mismatch: ${challenge.gameType}`);
      assert(challenge.player1Id === user.id, `player1Id mismatch: got ${challenge.player1Id}, expected ${user.id}`);
      assert(challenge.status === 'waiting', `status: ${challenge.status}`);
      
      createdChallenges.push(challenge);
    });
  }

  console.log('\n2. Challenge Listing APIs');
  await test('should list available challenges', async () => {
    const user = testUsers[1];
    
    const res = await fetch(`${BASE_URL}/api/challenges/available`, {
      headers: authHeaders(user.token),
    });

    assert(res.ok, `Response not ok: ${res.status}`);
    const challenges = await res.json();
    assert(Array.isArray(challenges), 'Expected array');
  });

  await test('should list public challenges', async () => {
    const user = testUsers[1];
    
    const res = await fetch(`${BASE_URL}/api/challenges/public`, {
      headers: authHeaders(user.token),
    });

    assert(res.ok, `Response not ok: ${res.status}`);
    const challenges = await res.json();
    assert(Array.isArray(challenges), 'Expected array');
  });

  await test('should list my challenges', async () => {
    const user = testUsers[0];
    
    const res = await fetch(`${BASE_URL}/api/challenges/my`, {
      headers: authHeaders(user.token),
    });

    assert(res.ok, `Response not ok: ${res.status}`);
    const challenges = await res.json();
    assert(Array.isArray(challenges), 'Expected array');
    assert(challenges.length >= GAME_TYPES.length, `Expected at least ${GAME_TYPES.length} challenges`);
  });

  console.log('\n3. Challenge Join Flow');
  await test('should allow another user to join a challenge', async () => {
    const creator = testUsers[0];
    const joiner = testUsers[1];
    
    const createRes = await fetch(`${BASE_URL}/api/challenges`, {
      method: 'POST',
      headers: authHeaders(creator.token),
      body: JSON.stringify({
        gameType: 'chess',
        betAmount: 50,
        visibility: 'public',
        opponentType: 'random',
      }),
    });

    assert(createRes.ok, 'Failed to create challenge');
    const challenge = await createRes.json();
    
    const joinRes = await fetch(`${BASE_URL}/api/challenges/${challenge.id}/join`, {
      method: 'POST',
      headers: authHeaders(joiner.token),
    });

    assert(joinRes.ok, `Join failed: ${joinRes.status}`);
    const joinedChallenge = await joinRes.json();
    
    assert(joinedChallenge.player2Id === joiner.id, `player2Id mismatch: got ${joinedChallenge.player2Id}`);
    assert(joinedChallenge.status === 'active', `status: ${joinedChallenge.status}`);
  });

  await test('should prevent creator from joining their own challenge', async () => {
    if (createdChallenges.length === 0) {
      console.log('    (skipped - no challenges created)');
      return;
    }
    const user = testUsers[0];
    const challenge = createdChallenges[0];
    
    const res = await fetch(`${BASE_URL}/api/challenges/${challenge.id}/join`, {
      method: 'POST',
      headers: authHeaders(user.token),
    });

    assert(!res.ok, 'Should have rejected self-join');
  });

  console.log('\n4. Challenge Withdrawal');
  await test('should allow creator to withdraw waiting challenge', async () => {
    const user = testUsers[0];
    
    const createRes = await fetch(`${BASE_URL}/api/challenges`, {
      method: 'POST',
      headers: authHeaders(user.token),
      body: JSON.stringify({
        gameType: 'domino',
        betAmount: 25,
        visibility: 'public',
        opponentType: 'random',
      }),
    });

    assert(createRes.ok, 'Failed to create challenge');
    const challenge = await createRes.json();
    
    const withdrawRes = await fetch(`${BASE_URL}/api/challenges/${challenge.id}/withdraw`, {
      method: 'POST',
      headers: authHeaders(user.token),
    });

    assert(withdrawRes.ok, `Withdraw failed: ${withdrawRes.status}`);
    const result = await withdrawRes.json();
    assert(result.status === 'cancelled', `status: ${result.status}`);
  });

  console.log('\n5. Challenge Details API');
  await test('should get challenge details by ID', async () => {
    if (createdChallenges.length === 0) {
      console.log('    (skipped - no challenges created)');
      return;
    }
    const user = testUsers[0];
    const challenge = createdChallenges[0];
    
    const res = await fetch(`${BASE_URL}/api/challenges/${challenge.id}`, {
      headers: authHeaders(user.token),
    });

    assert(res.ok, `Response not ok: ${res.status}`);
    const details = await res.json();
    
    assert(details.id === challenge.id, 'id mismatch');
    assert(details.gameType === challenge.gameType, 'gameType mismatch');
  });

  console.log('\n6. Spectator Staking API');
  await test('should allow spectator to stake on a challenge', async () => {
    const creator = testUsers[0];
    const joiner = testUsers[1];
    const spectator = testUsers[2];
    
    const createRes = await fetch(`${BASE_URL}/api/challenges`, {
      method: 'POST',
      headers: authHeaders(creator.token),
      body: JSON.stringify({
        gameType: 'backgammon',
        betAmount: 100,
        visibility: 'public',
        opponentType: 'random',
      }),
    });
    
    const challenge = await createRes.json();
    
    await fetch(`${BASE_URL}/api/challenges/${challenge.id}/join`, {
      method: 'POST',
      headers: authHeaders(joiner.token),
    });
    
    const stakeRes = await fetch(`${BASE_URL}/api/challenges/${challenge.id}/stake`, {
      method: 'POST',
      headers: authHeaders(spectator.token),
      body: JSON.stringify({
        playerId: creator.id,
        amount: 50,
      }),
    });

    assert(stakeRes.ok, `Stake failed: ${stakeRes.status}`);
  });

  await test('should get stakes for a challenge', async () => {
    if (createdChallenges.length === 0) {
      console.log('    (skipped - no challenges created)');
      return;
    }
    const user = testUsers[0];
    const challenge = createdChallenges[0];
    
    const res = await fetch(`${BASE_URL}/api/challenges/${challenge.id}/stakes`, {
      headers: authHeaders(user.token),
    });

    assert(res.ok, `Response not ok: ${res.status}`);
    const stakes = await res.json();
    assert(Array.isArray(stakes), 'Expected array');
  });

  console.log('\n7. Gift System API');
  await test('should get gifts for a challenge', async () => {
    if (createdChallenges.length === 0) {
      console.log('    (skipped - no challenges created)');
      return;
    }
    const user = testUsers[0];
    const challenge = createdChallenges[0];
    
    const res = await fetch(`${BASE_URL}/api/challenges/${challenge.id}/gifts`, {
      headers: authHeaders(user.token),
    });

    assert(res.ok, `Response not ok: ${res.status}`);
    const gifts = await res.json();
    assert(Array.isArray(gifts), 'Expected array');
  });

  console.log('\n8. Challenger Follow System');
  await test('should follow a challenger', async () => {
    const follower = testUsers[1];
    const target = testUsers[0];
    
    const res = await fetch(`${BASE_URL}/api/challenger-follows`, {
      method: 'POST',
      headers: authHeaders(follower.token),
      body: JSON.stringify({ userId: target.id }),
    });

    assert(res.ok, `Follow failed: ${res.status}`);
  });

  await test('should list followed challengers', async () => {
    const user = testUsers[1];
    
    const res = await fetch(`${BASE_URL}/api/challenger-follows`, {
      headers: authHeaders(user.token),
    });

    assert(res.ok, `Response not ok: ${res.status}`);
    const follows = await res.json();
    assert(Array.isArray(follows), 'Expected array');
  });

  await test('should unfollow a challenger', async () => {
    const follower = testUsers[1];
    const target = testUsers[0];
    
    const res = await fetch(`${BASE_URL}/api/challenger-follows/${target.id}`, {
      method: 'DELETE',
      headers: authHeaders(follower.token),
    });

    const isOk = res.ok || res.status === 404;
    assert(isOk, `Unfollow failed: ${res.status}`);
  });

  console.log('\n9. Game Type Validation');
  for (const gameType of GAME_TYPES) {
    await test(`should validate ${gameType} challenge has correct structure`, async () => {
      const user = testUsers[0];
      
      const res = await fetch(`${BASE_URL}/api/challenges/available`, {
        headers: authHeaders(user.token),
      });

      const challenges = await res.json();
      const gameChallenge = challenges.find((c: Challenge) => c.gameType === gameType);
      
      if (gameChallenge) {
        assert(gameChallenge.gameType === gameType, 'gameType mismatch');
        assert(typeof gameChallenge.betAmount === 'number', 'betAmount not number');
        assert(['waiting', 'active', 'completed', 'cancelled'].includes(gameChallenge.status), 'invalid status');
      }
    });
  }

  console.log('\n10. Profile Display Data');
  await test('should include player1 profile in challenge details', async () => {
    const user = testUsers[1];
    
    const res = await fetch(`${BASE_URL}/api/challenges/public`, {
      headers: authHeaders(user.token),
    });

    assert(res.ok, `Response not ok: ${res.status}`);
    const challenges = await res.json();
    
    if (challenges.length > 0) {
      const challenge = challenges[0];
      assert(challenge.player1Id || challenge.player1Name, 'Missing player1 data');
    }
  });

  console.log('\n========================================');
  console.log('CHALLENGE SYSTEM TEST SUMMARY');
  console.log('========================================');
  console.log(`Total users created: ${testUsers.length}`);
  console.log(`Total challenges created: ${createdChallenges.length}`);
  console.log(`Game types tested: ${GAME_TYPES.join(', ')}`);
  console.log(`\nPassed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Total: ${passCount + failCount}`);
  console.log('========================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
