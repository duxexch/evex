# Phase 6: Challenge Logic Flow Analysis

**Date**: 2026-01-12  
**Status**: ⚠️ CRITICAL ISSUES FOUND  
**Priority**: HIGH - Security & Data Integrity

---

## 📋 Executive Summary

Analyzed complete challenge lifecycle (create → join → play → complete/cancel) to identify:
- **Transaction safety**: Balance deduction flows
- **Race conditions**: Concurrent acceptance, double-spend prevention
- **Fund locking**: Wallet operations during challenge lifecycle
- **Refund mechanisms**: Cancellation and dispute resolution

### 🔴 Critical Findings
1. **NO REFUND IMPLEMENTATION** in withdrawal endpoint (money disappears!)
2. **RACE CONDITION** in challenge acceptance (in-memory lock only, not DB-safe)
3. **MISSING TRANSACTION WRAPPER** in challenge creation (balance deducted separately from challenge insert)
4. **NO DISPUTE/COMPLAINT SETTLEMENT** for challenge funds
5. **SPECTATOR SUPPORT INCOMPLETE** (TODO comments in code)

---

## 🔍 Challenge Flow Analysis

### 1. **Challenge Creation Flow**

**File**: `server/services/challenges/core/challenge-creator.ts`

```
User Request → Validate (balance, game exists) → Deduct funds → Create challenge → Send notifications
```

#### Step-by-Step:
1. **validateChallengeCreation()** checks:
   - Game exists in DB
   - Bet amount > 0
   - User balance sufficient (USD or project currency via walletRepository)
   - User hasn't exceeded 10 active challenges
   
2. **Currency deduction** (SEPARATE OPERATION - NOT ATOMIC WITH CHALLENGE INSERT):
   ```typescript
   // USD: deductUSDBalance() uses db.transaction with row lock
   // Project: deductProjectCurrency() uses walletRepository.deductBalance()
   ```
   
3. **Challenge insert**:
   ```typescript
   await db.insert(challengesTable).values({
     status: 'waiting',
     player1Id: userId,
     betAmount: betAmount.toString(),
     // No player2Id yet
   });
   ```

4. **Notifications** (async, fire-and-forget)

#### ⚠️ Issues:
- **NOT ATOMIC**: If challenge insert fails, money is already deducted
- **NO ROLLBACK**: Failed challenge creation = lost funds
- **NO LOCK**: Balance check → deduction has race window

---

### 2. **Challenge Acceptance Flow**

**File**: `server/services/challenges/core/challenge-acceptor.ts`

```
User Request → In-Memory Lock → Validate → Deduct funds → Update challenge → Create game session → Release Lock
```

#### Race Condition Protection:
```typescript
const challengeAcceptanceLocks = new Set<string>();

if (challengeAcceptanceLocks.has(challengeId)) {
  return { error: 'Challenge is being processed', errorCode: 'RACE_CONDITION' };
}
challengeAcceptanceLocks.add(challengeId);
```

#### Step-by-Step:
1. **In-memory lock** (prevents concurrent acceptance in same Node process)
2. **validateChallengeAcceptance()** checks:
   - Challenge exists & status = 'waiting'
   - User is not player1
   - User not already player2
   - User has sufficient balance
   
3. **Deduct player2 funds** (SEPARATE OPERATION):
   ```typescript
   await deductProjectCurrency(userId, betAmount, reason, challengeId);
   ```
   
4. **Update challenge**:
   ```typescript
   await db.update(challengesTable)
     .set({ player2Id: userId, status: 'active', startedAt: now })
     .where(eq(challengesTable.id, challengeId));
   ```
   
5. **Create liveGameSession**:
   ```typescript
   await db.insert(liveGameSessions).values({
     challengeId, player1Id, player2Id, status: 'waiting'
   });
   ```

6. **Initiate game start** (sends WebSocket messages to both players)

#### ⚠️ Critical Issues:
- **IN-MEMORY LOCK ONLY**: Multi-instance deployment = race conditions!
  - If 2 users click "Join" simultaneously on different servers → both succeed
  - Challenge gets 2 player2 assignments (last write wins)
  - First player's money is deducted but they're not in the game
  
- **NO DATABASE-LEVEL LOCK**: Should use `SELECT FOR UPDATE` or unique constraint
  
- **NOT ATOMIC**: Deduction → Update → Session creation are separate transactions
  - If any step fails mid-way, funds are lost

---

### 3. **Game Completion & Payout**

**File**: `server/storage.ts` (settleGamePayout / settleProjectCurrencyGamePayout)

```
Game ends → WebSocket handler → settleGamePayout → Credit winner → Update stats
```

#### USD Payout:
```typescript
async settleGamePayout(sessionId, winnerId, loserId, stakeAmount, platformFeePercent) {
  return await db.transaction(async (tx) => {
    // Row-level locks on both users (sorted order to prevent deadlocks)
    const [user1] = await tx.select().from(users).where(eq(users.id, id1)).for('update');
    const [user2] = await tx.select().from(users).where(eq(users.id, id2)).for('update');
    
    // Calculate payout
    const totalPot = stake * 2;
    const platformFee = totalPot * (platformFeePercent / 100);
    const winnerPayout = totalPot - platformFee;
    
    // Credit winner
    await tx.update(users)
      .set({ 
        balance: (winnerBalance + winnerPayout).toFixed(2),
        gamesWon: winner.gamesWon + 1,
        totalEarnings: (parseFloat(winner.totalEarnings) + winnerPayout).toFixed(2)
      });
      
    // Update stats for loser (no balance change - already deducted at challenge creation)
    
    // Create transaction records
    await tx.insert(transactions).values({ type: 'win', amount: winnerPayout });
  });
}
```

#### ✅ Good Points:
- **TRANSACTION WRAPPER**: All operations atomic
- **ROW-LEVEL LOCKS**: Prevents concurrent balance modifications
- **SORTED LOCK ORDER**: Prevents deadlocks (always lock lower ID first)
- **TRANSACTION RECORDS**: Audit trail for winnings

#### ⚠️ Issues:
- **PLATFORM FEE CALCULATION**: platformFeePercent is always passed as 0 (no revenue!)
- **NO REFUND ON DRAW**: If game ends in draw, both players lose their stakes
- **LOSER STATS ONLY**: No balance refund for loser (already deducted, never returned)

---

### 4. **Challenge Withdrawal (Cancel) Flow**

**File**: `server/routes/challenges-refactored.ts`

```typescript
app.post("/api/challenges/:id/withdraw", authMiddleware, async (req, res) => {
  const challenge = await db.select().from(challengesTable).where(eq(challengesTable.id, challengeId));
  
  if (challenge.status !== 'waiting') {
    return res.status(400).json({ error: "Can only withdraw challenges in waiting status" });
  }
  
  // Calculate 30% penalty
  const betAmount = parseFloat(challenge.betAmount || '0');
  const penalty = betAmount * 0.30;
  
  // Update challenge status
  await db.update(challengesTable)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(challengesTable.id, challengeId));
  
  res.json({
    success: true,
    penalty,
    refund: betAmount - penalty, // ⚠️ RETURNED IN RESPONSE BUT NEVER CREDITED TO USER!
  });
});
```

#### 🔴 CRITICAL BUG:
**NO ACTUAL REFUND HAPPENS!**
- User's money was deducted at challenge creation
- Withdrawal endpoint ONLY updates challenge status
- Response claims "refund: X" but no wallet/balance operation occurs
- **User loses 100% of stake, not 30%**

#### Required Fix:
```typescript
// Must add before status update:
if (challenge.currencyType === 'usd') {
  await creditUSDBalance(challenge.player1Id, betAmount - penalty, 'Challenge withdrawal refund');
} else {
  await creditProjectCurrency(challenge.player1Id, betAmount - penalty, 'Challenge withdrawal refund', challengeId);
}
```

---

### 5. **Wallet Repository Operations**

**File**: `server/repositories/wallet-repository.ts`

#### Available Balance Calculation:
```typescript
// In WalletBalanceSchema (Zod transform):
availableBalance: z.number().transform(
  (_, ctx) => {
    const total = parseFloat(ctx.totalBalance);
    const locked = parseFloat(ctx.lockedBalance);
    return total - locked;
  }
)
```

#### Deduct Balance (Earned First):
```typescript
async deductBalance(userId: string, amount: number): Promise<WalletBalance> {
  const wallet = await this.getOrCreateWallet(userId);
  
  if (wallet.availableBalance < amount) {
    throw new Error('Insufficient balance');
  }
  
  // Earned balance used first, then purchased
  const earnedDeduction = Math.min(amount, wallet.earnedBalance);
  const purchasedDeduction = amount - earnedDeduction;
  
  await db.update(projectCurrencyWallets).set({
    earnedBalance: (wallet.earnedBalance - earnedDeduction).toFixed(2),
    purchasedBalance: (wallet.purchasedBalance - purchasedDeduction).toFixed(2),
    totalBalance: (wallet.totalBalance - amount).toFixed(2),
    totalSpent: (wallet.totalSpent + amount).toFixed(2)
  });
}
```

#### Lock/Unlock Balance:
```typescript
async lockBalance(userId: string, amount: number): Promise<void> {
  if (wallet.availableBalance < amount) {
    throw new Error('Insufficient balance to lock');
  }
  
  await db.update(projectCurrencyWallets).set({
    lockedBalance: (wallet.lockedBalance + amount).toFixed(2)
  });
}

async unlockBalance(userId: string, amount: number): Promise<void> {
  await db.update(projectCurrencyWallets).set({
    lockedBalance: Math.max(0, wallet.lockedBalance - amount).toFixed(2)
  });
}
```

#### ⚠️ Issues:
- **NO LOCKING DURING CHALLENGES**: Lock/unlock functions exist but are NEVER CALLED in challenge flows
- **AVAILABLE BALANCE CHECK**: Calculated correctly but not protected by locks
- **NO TRANSACTION WRAPPER**: Each wallet operation is a separate DB query
- **NO FOR UPDATE**: Concurrent deductions can pass balance check simultaneously

---

## 🔒 Race Condition Matrix

| Scenario | Current Protection | Vulnerability | Impact |
|----------|-------------------|---------------|---------|
| **Concurrent challenge acceptance** | In-memory Set lock | Multi-instance deployment | 2 users can join same challenge, both lose money |
| **Double-spend at creation** | Balance check before deduct | No row lock during check | User can create 5 challenges simultaneously with balance for 1 |
| **Withdrawal during acceptance** | None | Status check not atomic | Player1 withdraws while Player2 joins → both lose money |
| **Balance deduction race** | None | No FOR UPDATE | Concurrent API calls can pass balance check |
| **Game completion concurrency** | Transaction + row locks | None (✅ SAFE) | Winner credited exactly once |

---

## 📊 Fund Flow Diagram

```
CHALLENGE CREATION:
┌─────────────────────────────────────────────┐
│ User Balance: 1000                          │
│ → deductProjectCurrency(100) [SEPARATE TX] │
│ → Balance: 900                              │
│ → db.insert(challenge) [SEPARATE TX]       │
│   ├─ Success: Challenge created ✅          │
│   └─ Failure: Money lost ❌                 │
└─────────────────────────────────────────────┘

CHALLENGE ACCEPTANCE:
┌──────────────────────────────────────────────────┐
│ Player2 Balance: 800                             │
│ → In-memory lock (challengeAcceptanceLocks)     │
│ → deductProjectCurrency(100) [SEPARATE TX]      │
│ → Balance: 700                                   │
│ → db.update(challenge, player2Id) [SEPARATE TX] │
│ → db.insert(liveGameSession) [SEPARATE TX]      │
│   ├─ Any failure: Money lost ❌                  │
│   └─ Success: Game starts ✅                     │
└──────────────────────────────────────────────────┘

GAME COMPLETION:
┌───────────────────────────────────────────┐
│ Winner gets: (100 + 100) - platformFee   │
│ → db.transaction {                       │
│     SELECT users FOR UPDATE (deadlock-safe)│
│     UPDATE winner.balance += 200         │
│     UPDATE winner.gamesWon += 1          │
│     INSERT transaction record            │
│   } [ATOMIC ✅]                           │
└───────────────────────────────────────────┘

WITHDRAWAL (CURRENT - BROKEN):
┌────────────────────────────────────────┐
│ User lost 100 at creation              │
│ → Withdrawal request                   │
│ → db.update(status='cancelled')        │
│ → Response: { refund: 70 }             │
│ → ACTUAL REFUND: 0 ❌                  │
│ → User LOST: 100 (not 30!)             │
└────────────────────────────────────────┘
```

---

## 🛠️ Required Fixes

### Priority 1: URGENT (Data Loss)

#### 1.1 Fix Withdrawal Refund
```typescript
// server/routes/challenges-refactored.ts
app.post("/api/challenges/:id/withdraw", authMiddleware, async (req, res) => {
  return await db.transaction(async (tx) => {
    // Lock challenge
    const [challenge] = await tx.select()
      .from(challengesTable)
      .where(eq(challengesTable.id, challengeId))
      .for('update');
    
    if (!challenge || challenge.status !== 'waiting') {
      throw new Error('Invalid challenge for withdrawal');
    }
    
    const betAmount = parseFloat(challenge.betAmount);
    const penalty = betAmount * 0.30;
    const refund = betAmount - penalty;
    
    // CRITICAL: Actually refund the money
    if (challenge.currencyType === 'usd') {
      const [user] = await tx.select().from(users)
        .where(eq(users.id, challenge.player1Id))
        .for('update');
      
      await tx.update(users).set({
        balance: (parseFloat(user.balance) + refund).toFixed(2)
      }).where(eq(users.id, challenge.player1Id));
      
      await tx.insert(transactions).values({
        userId: challenge.player1Id,
        type: 'refund',
        amount: refund.toFixed(2),
        description: `Challenge withdrawal refund (30% penalty applied)`
      });
    } else {
      await walletRepository.addBalance(challenge.player1Id, refund, 'earned');
      
      await tx.insert(projectCurrencyLedger).values({
        userId: challenge.player1Id,
        transactionType: 'challenge_refund',
        amount: refund.toFixed(8),
        description: 'Challenge withdrawal refund (30% penalty)'
      });
    }
    
    // Then update status
    await tx.update(challengesTable)
      .set({ status: 'cancelled' })
      .where(eq(challengesTable.id, challengeId));
  });
});
```

---

### Priority 2: HIGH (Race Conditions)

#### 2.1 Make Challenge Acceptance Atomic
```typescript
// server/services/challenges/core/challenge-acceptor.ts
export async function acceptChallenge(request: AcceptChallengeRequest) {
  return await db.transaction(async (tx) => {
    // 1. Lock challenge with FOR UPDATE
    const [challenge] = await tx.select()
      .from(challengesTable)
      .where(and(
        eq(challengesTable.id, challengeId),
        eq(challengesTable.status, 'waiting'),
        isNull(challengesTable.player2Id) // Prevent double-join
      ))
      .for('update');
    
    if (!challenge) {
      throw new Error('Challenge not available');
    }
    
    // 2. Lock user wallet
    const [wallet] = await tx.select()
      .from(projectCurrencyWallets)
      .where(eq(projectCurrencyWallets.userId, userId))
      .for('update');
    
    const betAmount = parseFloat(challenge.betAmount);
    if (wallet.availableBalance < betAmount) {
      throw new Error('Insufficient balance');
    }
    
    // 3. Deduct balance (within same transaction)
    await tx.update(projectCurrencyWallets).set({
      totalBalance: (wallet.totalBalance - betAmount).toFixed(2),
      earnedBalance: (wallet.earnedBalance - Math.min(betAmount, wallet.earnedBalance)).toFixed(2)
    });
    
    // 4. Update challenge (still in transaction)
    await tx.update(challengesTable).set({
      player2Id: userId,
      status: 'active',
      startedAt: new Date()
    });
    
    // 5. Create game session (still in transaction)
    const [session] = await tx.insert(liveGameSessions).values({
      challengeId, player1Id: challenge.player1Id, player2Id: userId
    }).returning();
    
    return { success: true, session };
  });
  
  // Remove in-memory lock - no longer needed!
}
```

#### 2.2 Make Challenge Creation Atomic
```typescript
// server/services/challenges/core/challenge-creator.ts
export async function createChallenge(request: CreateChallengeRequest) {
  // Run validation first (outside transaction)
  const validation = await validateChallengeCreation(request);
  if (!validation.valid) return validation;
  
  // Then do everything atomically
  return await db.transaction(async (tx) => {
    // 1. Lock user balance
    const [wallet] = await tx.select()
      .from(projectCurrencyWallets)
      .where(eq(projectCurrencyWallets.userId, userId))
      .for('update');
    
    if (wallet.availableBalance < betAmount) {
      throw new Error('Insufficient balance');
    }
    
    // 2. Deduct balance
    await tx.update(projectCurrencyWallets).set({
      totalBalance: (wallet.totalBalance - betAmount).toFixed(2)
    });
    
    // 3. Create challenge
    const [challenge] = await tx.insert(challengesTable).values({
      id: uuidv4(),
      gameType, betAmount, currencyType,
      status: 'waiting',
      player1Id: userId
    }).returning();
    
    // 4. Create ledger entry
    await tx.insert(projectCurrencyLedger).values({
      userId,
      transactionType: 'challenge_creation',
      amount: (-betAmount).toFixed(8),
      referenceId: challenge.id
    });
    
    return { success: true, challenge };
  });
}
```

---

### Priority 3: MEDIUM (Data Integrity)

#### 3.1 Add Unique Constraint for Player2
```sql
-- Add constraint to prevent double-assignment
ALTER TABLE challenges 
ADD CONSTRAINT challenges_player2_unique 
UNIQUE (player2_id) 
WHERE status = 'active' AND player2_id IS NOT NULL;
```

#### 3.2 Implement Draw Refund
```typescript
// In settleGamePayout, add draw handling:
if (isDraw) {
  return await db.transaction(async (tx) => {
    // Refund both players
    await refundPlayer(tx, player1Id, stake, 'Game draw refund');
    await refundPlayer(tx, player2Id, stake, 'Game draw refund');
  });
}
```

#### 3.3 Implement Dispute Resolution
```typescript
// New service: challenge-dispute-resolver.ts
export async function resolveChallengDispute(
  challengeId: string,
  resolution: 'refund_both' | 'award_player1' | 'award_player2'
) {
  return await db.transaction(async (tx) => {
    const [challenge] = await tx.select()
      .from(challengesTable)
      .where(eq(challengesTable.id, challengeId))
      .for('update');
    
    const betAmount = parseFloat(challenge.betAmount);
    
    switch (resolution) {
      case 'refund_both':
        await refundPlayer(tx, challenge.player1Id, betAmount);
        await refundPlayer(tx, challenge.player2Id, betAmount);
        break;
      case 'award_player1':
        await awardWinner(tx, challenge.player1Id, challenge.player2Id, betAmount);
        break;
      case 'award_player2':
        await awardWinner(tx, challenge.player2Id, challenge.player1Id, betAmount);
        break;
    }
    
    await tx.update(challengesTable).set({
      status: 'resolved',
      resolution
    });
  });
}
```

---

## 📈 Performance Impact Assessment

### Current Query Patterns (from Phase 5):
- `challenges` table: **505 sequential scans, 0 index scans**
- Most queries filter by: `status='waiting'`, `player1Id`, `player2Id`

### After Implementing Fixes:
- **Row-level locks** will increase lock contention
- **Transactions** will hold locks longer
- **Missing indexes** will make FOR UPDATE even slower

### Recommended Index (CRITICAL for locking):
```sql
-- Must add BEFORE implementing transaction locks
CREATE INDEX CONCURRENTLY idx_challenges_acceptance 
ON challenges (id, status, player2_id) 
WHERE status = 'waiting';

-- For player queries
CREATE INDEX CONCURRENTLY idx_challenges_player_status 
ON challenges (player1_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY idx_challenges_available 
ON challenges (status, visibility, created_at DESC) 
WHERE status = 'waiting';
```

**Without these indexes**: FOR UPDATE will cause full table scans under lock = DEADLOCKS

---

## 🧪 Testing Requirements

### Unit Tests Needed:
1. **Race condition test**: 100 users simultaneously join same challenge (only 1 succeeds)
2. **Double-spend test**: Create 10 challenges with balance for 1 (all fail except 1)
3. **Withdrawal refund test**: Verify money actually returns to user
4. **Transaction rollback test**: Simulate failure mid-acceptance (no money lost)
5. **Deadlock prevention test**: Concurrent game completions (sorted lock order works)

### Load Test Scenarios:
- 1000 concurrent challenge creations
- 500 concurrent acceptances of different challenges
- 100 withdrawals while system under load
- Mixed operations: create/accept/complete/withdraw simultaneously

---

## 📋 Checklist for Phase 6 Completion

- [ ] **Fix withdrawal refund** (URGENT - users losing money)
- [ ] **Make acceptance atomic** (wrap in db.transaction)
- [ ] **Make creation atomic** (wrap in db.transaction)
- [ ] **Add FOR UPDATE locks** (prevent race conditions)
- [ ] **Add missing indexes** (prevent lock contention)
- [ ] **Implement draw refund** (currently both lose)
- [ ] **Implement dispute resolution** (complaints have no settlement)
- [ ] **Remove in-memory locks** (replace with DB locks)
- [ ] **Add unique constraint** (prevent double player2)
- [ ] **Write unit tests** (race conditions, rollbacks)
- [ ] **Load test** (concurrent operations)
- [ ] **Audit all currency operations** (ensure no other missing refunds)

---

## 📚 Related Documentation

- **Phase 4**: Schema indexes (identified missing indexes)
- **Phase 5**: DB performance (challenges table has 505 seq scans)
- **Phase 7**: Wallet flows (next phase)
- **Phase 17**: Performance optimization (where indexes will be applied)

---

## 🎯 Next Phase Preview

**Phase 7: Wallet & Payment Flows**
- Analyze wallet-repository.ts full implementation
- Review deposit/withdrawal endpoints
- Check commission calculations
- Verify ledger integrity
- Examine P2P wallet escrow

**Key Questions**:
- Are deposits/withdrawals atomic?
- How are conversion rates handled?
- Is there any withdrawal locking mechanism?
- What happens if ledger insert fails?
