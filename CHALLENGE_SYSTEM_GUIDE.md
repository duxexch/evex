/**
 * CHALLENGE SYSTEM - COMPLETE IMPLEMENTATION GUIDE
 * 
 * This document describes the complete refactored challenge system
 * with all new modular services and components.
 */

# Challenge System Architecture

## Overview
The challenge system has been completely refactored into a modular, maintainable architecture
with clear separation of concerns. Each service handles a specific aspect of the challenge lifecycle.

## Directory Structure

```
/server/services/challenges/
├── core/
│   ├── challenge-creator.ts          # Create new challenges
│   └── challenge-acceptor.ts         # Accept challenges & auto-open games
├── validation/
│   └── challenge-validator.ts        # All validation logic
├── currency/
│   └── currency-service.ts           # Deductions, credits, balances
├── notifications/
│   └── notification-service.ts       # All notification types
└── index.ts                          # Service exports

/server/services/game/
├── game-abandonment.ts               # Disconnect & forfeit handling
├── game-inactivity-checker.ts        # 15-min timeout monitoring
└── ...

/server/routes/
├── challenges-refactored.ts          # New API endpoints using services
└── ...

/client/src/lib/
└── game-session-guard.ts             # Prevent player abandonment
```

## Key Components

### 1. Challenge Validator (`challenge-validator.ts`)
- **validateChallengeCreation()**: Validate game exists, amount is positive, user has balance
- **validateChallengeAcceptance()**: Ensure challenge is in 'waiting' state, user hasn't accepted, has funds
- **validateWithdrawal()**: Ensure only creator can withdraw while in 'waiting' state

### 2. Currency Service (`currency-service.ts`)
- **deductUSDBalance()**: Atomic USD deduction with row-level locking
- **deductProjectCurrency()**: Atomic project currency deduction (earned first, then purchased)
- **creditUSDBalance()**: Credit USD earnings
- **creditProjectCurrency()**: Credit VEX Coin earnings to earned balance
- **lockProjectCurrency()**: Lock funds for pending challenges (not yet deducted)
- **unlockProjectCurrency()**: Unlock funds after challenge resolves

### 3. Notification Service (`notification-service.ts`)
- **sendUserNotification()**: Send to single user with real-time WebSocket broadcast
- **sendBulkNotifications()**: Send to multiple users instantly
- **notifyFollowersAboutChallenge()**: Alert all followers of challenger
- **notifyGameEnthusiastsAboutChallenge()**: Alert players who play that game
- **notifyPlayersAboutChallengeStart()**: Urgent notification when challenge accepted
- **notifySpectatorsAboutGameResult()**: Game completion notification
- **notifyChallengeWithdrawal()**: Penalty notification on withdrawal
- **notifyGameAbandonmentPenalty()**: Forfeit notification

### 4. Challenge Creator (`challenge-creator.ts`)
- **createChallenge()**: Full atomic challenge creation with all validations
- **getAvailableChallenges()**: Public waiting challenges for joining
- **getPublicChallenges()**: Active challenges for Arena display
- **getUserChallenges()**: User's MY CHALLENGES tab

### 5. Challenge Acceptor (`challenge-acceptor.ts`)
- **acceptChallenge()**: Accept challenge, create game session, auto-notify both players
- **getChallengeDetails()**: Get challenge with player info
- Uses WebSocket to broadcast `challenge_accepted` message for automatic game opening

### 6. Game Abandonment Service (`game-abandonment.ts`)
- **handleGameAbandonement()**: Disconnect/timeout/inactivity handling
- **resignFromGame()**: Voluntary resignation
- **checkAndForeitInactiveSessions()**: Automatic forfeit after 15 minutes inactivity
- **updateSessionLastActivity()**: Reset inactivity timer

### 7. Inactivity Checker (`game-inactivity-checker.ts`)
- **GameInactivityChecker** class: Background service that runs every 60 seconds
- Checks for games with no moves in 15 minutes
- Automatically forfeits and settles payouts
- Respects enable/disable configuration
- Handles errors gracefully with pause on repeated failures

## API Endpoints (New/Refactored)

```typescript
// Challenge Management
POST   /api/challenges                    // Create challenge (uses project currency by default)
GET    /api/challenges/available          // Available for joining
GET    /api/challenges/public             // All active for Arena
GET    /api/challenges/my                 // User's challenges
POST   /api/challenges/:id/join           // Accept & auto-open game
GET    /api/challenges/:id                // Get challenge details
POST   /api/challenges/:id/withdraw       // Withdraw with 30% penalty

// Game Session Management
GET    /api/challenges/:id/session        // Get game session
POST   /api/game-sessions/:id/activity    // Heartbeat (prevents inactivity timeout)
POST   /api/game-sessions/:id/resign      // Voluntary resign/forfeit

// Support/Betting (Planned)
POST   /api/challenges/:id/stake          // Place spectator bet
GET    /api/challenges/:id/stakes         // Get all bets
POST   /api/challenges/:id/gift           // Send gift
GET    /api/challenges/:id/gifts          // Get gifts
```

## Challenge Flow (Complete)

### 1. User Creates Challenge
```
Client: POST /api/challenges
├─ Validate game type, amount, user balance
├─ Deduct currency (USD or VEX)
├─ Create challenge in DB (status: 'waiting')
├─ Notify followers
├─ Notify game enthusiasts
└─ Return challenge ID, list in MY CHALLENGES

Time: ~500ms
```

### 2. Second User Accepts Challenge
```
Client: POST /api/challenges/:id/join
├─ Validate challenge is 'waiting', user not creator, has funds
├─ Deduct currency from player2
├─ Update challenge: player2, status='active', startedAt=now
├─ Create liveGameSession
├─ Notify player1: urgent "Challenge Accepted!"
├─ Notify player2: urgent "Challenge Started!"
├─ Broadcast to both: challenge_accepted WebSocket message
│  └─ Client receives, auto-navigates to /challenge/:id/play
├─ Players auto-join WebSocket game room
├─ Game board opens automatically
└─ Inactivity timer starts

Time: ~1s (automatic game opening)
Heartbeat: Every 60s client sends /api/game-sessions/:id/activity
```

### 3. Game in Progress
```
While Playing:
├─ Each move updates game state
├─ Spectators see real-time updates
├─ Gifts can be sent (earned credits to both players)
├─ Timer ticks down
├─ Activity heartbeat resets 15-min inactivity timer
└─ Movement prevented by GameSessionGuard (browser beforeunload event)

Abandonment Scenarios:
1. Browser close/page close → beforeunload → forfeit signal
2. Back button → popstate → forfeit signal
3. Navigate away → hashchange → forfeit signal
4. 15 min inactivity → server timeout → auto-forfeit
5. Player disconnect → WebSocket close → disconnect forfeit
6. Voluntary resign → player button → graceful forfeit
```

### 4. Game Ends
```
Winner Declared:
├─ Opponent gets 2x bet as earnings
├─ Loser notified of forfeit reason
├─ Settle spectator supports/bets
├─ Update player stats
├─ Broadcast game_over to spectators
└─ Redirect players to challenges page

Time Tracking:
├─ 15 minutes = full game inactivity threshold
└─ 5 minutes = per-turn timeout (for turn-based games like chess)
```

## Currency Flow

### USD Balance
```
User USD Balance (usdBalance field in users table)
│
├─ Challenge Creation
│  └─ Deduct: betAmount → Challenge waiting
│
├─ Challenge Acceptance (Player 2)
│  └─ Deduct: betAmount
│
├─ Game Win
│  └─ Credit: betAmount * 2
│
└─ Withdrawal (30% penalty)
   └─ Refund: betAmount * 0.7
```

### Project Currency (VEX Coin)
```
User Wallet (projectCurrencyWallets table)
├─ purchasedBalance  (refundable)
├─ earnedBalance     (non-refundable, prioritized for spending)
├─ totalBalance      (sum)
├─ lockedBalance     (reserved for pending)
└─ totalSpent        (ledger tracking)

Challenge Creation/Acceptance:
├─ Deduct earned first (up to earned balance)
├─ Then deduct purchased (remainder)
└─ Log to projectCurrencyLedger

Game Win:
├─ Credit to earned only
└─ Cannot be refunded

Ledger Entry (projectCurrencyLedger):
├─ type: 'game_stake' | 'game_win' | 'withdrawal' | 'conversion'
├─ amount: positive or negative
├─ balanceBefore/After: track precise state
├─ referenceId: challenge ID
└─ metadata: JSON context
```

## Configuration

### Environment Variables
```bash
INACTIVITY_THRESHOLD_MINUTES=15          # Auto-forfeit after N minutes
CHECK_INTERVAL_SECONDS=60                # How often to check for inactivity
CHALLENGE_DEFAULT_CURRENCY=project       # USD or project
WITHDRAWAL_PENALTY_PERCENT=30            # Percentage lost on cancel
```

### Admin Panel Settings (Future)
```
Challenge Settings:
├─ Enable/disable challenge system
├─ Default currency (USD or VEX)
├─ Min/max bet amounts
├─ Withdrawal penalty %
├─ Inactivity timeout (minutes)
└─ House fee %
```

## Error Handling

### Validation Errors (400)
- Invalid bet amount
- Game not found
- Insufficient balance
- Challenge not available
- Already accepted challenge

### Race Conditions (409)
- Multiple users accepting same challenge simultaneously
- Uses in-memory lock + atomic DB transaction

### Server Errors (500)
- Database connection failures
- Currency deduction failures
- Notification delivery failures

## Testing Checklist

- [ ] Create challenge with USD currency
- [ ] Create challenge with VEX currency
- [ ] Verify balance deduction (both currencies)
- [ ] Accept challenge - verify game opens automatically
- [ ] Receive notifications (followers, enthusiasts, players)
- [ ] Test withdrawal with 30% penalty
- [ ] Test 15-minute inactivity timeout
- [ ] Test browser close during game (forfeit)
- [ ] Test back button during game (forfeit)
- [ ] Test voluntary resignation
- [ ] Test gift sending to player
- [ ] Test spectator support/betting
- [ ] Verify winner receives 2x payout
- [ ] Verify spectator supports are settled
- [ ] Test with multiple concurrent games

## Performance Considerations

- **Atomic Transactions**: All currency operations use DB transactions with row-level locking
- **Real-time Updates**: WebSocket broadcasts for instant notifications
- **Background Jobs**: Inactivity checker runs every 60 seconds (adjustable)
- **Rate Limiting**: Prevents abuse of challenge creation/acceptance
- **Caching**: Player stats cached at user load time
- **Indexing**: Challenges table indexed on (player1Id, player2Id, status, visibility)

## Security Considerations

- **Row-level Locking**: Prevents double-spending on concurrent operations
- **Atomic Transactions**: All-or-nothing operations (no partial updates)
- **JWT Validation**: All endpoints require valid authentication token
- **Earned vs Purchased**: Earned currency is non-refundable
- **House Fee**: Protects platform from loss on cancellations
- **Rate Limiting**: Prevents spam/abuse
- **Sendbeacon**: Ensures forfeit signal even on page close

## Migration from Old System

The old system (`/server/routes/challenges.ts`) is still functional.
The new system (`/server/routes/challenges-refactored.ts`) is now registered.

To complete migration:
1. Replace all client imports of old challenge endpoints
2. Run comprehensive tests
3. Monitor production errors
4. Archive old routes file after 1 week verification

## Future Enhancements

- [ ] Implement actual support/betting system
- [ ] Add gift catalog and sending
- [ ] Implement tournament brackets
- [ ] Add replay system
- [ ] Tournament scheduling
- [ ] Ranked ladder system
- [ ] Achievement system
- [ ] Challenge badges
- [ ] Streamer integration
- [ ] Spectator viewer analytics
