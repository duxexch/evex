# Challenge System - Execution Flow Simulation

## Overview
Step-by-step simulation of the complete challenge lifecycle from creation through game play with detailed state changes and database writes.

---

## PHASE 1: CREATE CHALLENGE

### 1.1 HTTP Request
```
POST /api/challenges
Headers: Authorization: Bearer {JWT_TOKEN}
Body: {
  "gameType": "chess",
  "betAmount": 50,
  "currencyType": "usd",
  "visibility": "public",
  "opponentType": "random",
  "timeLimit": 300
}
```

### 1.2 Authentication & Validation
**Actor**: Server (Route Handler) → Challenge Creator Service

```
Request Flow:
1. authMiddleware extracts JWT token
   - Verifies JWT signature
   - Extracts userId from claims
   - Sets req.user = { id: "user-123", username: "challenger1" }

2. Route Handler: POST /api/challenges
   - Extracts request body parameters
   - Calls createChallenge(request) from challenge-creator.ts
```

### 1.3 Validation Phase (Step 1)
**File**: `server/services/challenges/validation/challenge-validator.ts`

```typescript
validateChallengeCreation({
  gameType: "chess",
  betAmount: 50,
  currencyType: "usd",
  userId: "user-123"
})
```

**Checks Performed**:
- ✓ gameType exists in games table
- ✓ betAmount > 0
- ✓ User has sufficient balance
- ✓ currencyType is valid ('usd' or 'project')

**Validation Result**:
```javascript
{
  valid: true,
  error: null,
  errorCode: null
}
```

### 1.4 Game Record Lookup (Step 2)
**Database Query**: 
```sql
SELECT * FROM games 
WHERE LOWER(name) = LOWER('chess')
LIMIT 1
```

**Result**:
```javascript
{
  id: 1,
  name: "Chess",
  description: "Classic Chess Game",
  rules: {...},
  maxPlayers: 2
}
```

### 1.5 Currency Deduction (Step 3)
**Currency Type**: USD (usd)

**Function Call**:
```typescript
deductUSDBalance(
  userId: "user-123",
  amount: 50,
  description: "Challenge creation for chess"
)
```

**Before State**:
```javascript
// Users Table
{
  id: "user-123",
  username: "challenger1",
  balance: 500.00,
  gamesWon: 10,
  gamesLost: 5
}
```

**Transaction Logic**:
```sql
BEGIN TRANSACTION;

-- 1. Lock user row for update
SELECT * FROM users WHERE id = 'user-123' FOR UPDATE;

-- 2. Check balance
-- Balance: 500.00 >= 50.00 ✓

-- 3. Deduct amount
UPDATE users 
SET balance = 450.00 
WHERE id = 'user-123';

-- 4. Log transaction
INSERT INTO currency_ledger (
  user_id, type, amount, timestamp, description
) VALUES (
  'user-123', 'game_stake', -50.00, NOW(), 
  'Challenge creation for chess'
);

COMMIT;
```

**After State**:
```javascript
// Users Table
{
  id: "user-123",
  username: "challenger1",
  balance: 450.00,  // Changed: 500.00 → 450.00
  gamesWon: 10,
  gamesLost: 5
}

// Currency Ledger (New Entry)
{
  id: 1001,
  userId: "user-123",
  type: "game_stake",
  amount: -50.00,
  timestamp: "2026-01-23T10:30:00Z",
  description: "Challenge creation for chess"
}
```

### 1.6 Challenge Creation (Step 4)
**Challenge ID Generated**: `uuid: 550e8400-e29b-41d4-a716-446655440000`

**Database Insert**:
```sql
INSERT INTO challenges (
  id, game_type, bet_amount, currency_type, 
  visibility, status, player1_id, player2_id, 
  time_limit, player1_score, player2_score,
  started_at, ended_at, created_at, updated_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',  -- id
  'chess',                                   -- gameType
  '50',                                      -- betAmount
  'usd',                                     -- currencyType
  'public',                                  -- visibility
  'waiting',                                 -- status ← KEY STATE
  'user-123',                                -- player1Id (creator)
  NULL,                                      -- player2Id (not yet joined)
  300,                                       -- timeLimit (5 minutes)
  0, 0,                                      -- scores
  NULL, NULL,                                -- started_at, ended_at
  '2026-01-23T10:30:05Z',                   -- created_at
  '2026-01-23T10:30:05Z'                    -- updated_at
) RETURNING *;
```

**Challenge Table State After Insert**:
```javascript
{
  id: "550e8400-e29b-41d4-a716-446655440000",
  gameType: "chess",
  betAmount: "50",
  currencyType: "usd",
  visibility: "public",
  status: "waiting",  // ← WAITING FOR OPPONENT
  player1Id: "user-123",
  player2Id: null,
  winnerId: null,
  opponentType: "random",
  friendAccountId: null,
  timeLimit: 300,
  player1Score: 0,
  player2Score: 0,
  startedAt: null,
  endedAt: null,
  createdAt: "2026-01-23T10:30:05Z",
  updatedAt: "2026-01-23T10:30:05Z"
}
```

### 1.7 Notifications (Step 5-6)
**Notifications Triggered** (Asynchronous, non-blocking):

1. **Notify Followers**:
```sql
SELECT follower_id FROM followers WHERE followed_id = 'user-123';
-- Result: ["user-456", "user-789"]

INSERT INTO notifications (
  recipient_id, challenge_id, type, title, message
) VALUES
  ('user-456', '550e8400-e29b-41d4-a716-446655440000', 
   'challenge_created', 'New Challenge from challenger1',
   'challenger1 created a chess challenge with 50 USD bet'),
  ('user-789', '550e8400-e29b-41d4-a716-446655440000',
   'challenge_created', 'New Challenge from challenger1',
   'challenger1 created a chess challenge with 50 USD bet');
```

2. **Notify Game Enthusiasts**:
```sql
SELECT id FROM users 
WHERE game_interests LIKE '%chess%' 
LIMIT 20;
-- Sends notifications to interested players
```

### 1.8 HTTP Response
```javascript
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "gameType": "chess",
  "betAmount": 50,
  "currencyType": "usd",
  "visibility": "public",
  "status": "waiting",
  "player1Id": "user-123",
  "player2Id": null,
  "opponentType": "random",
  "timeLimit": 300,
  "createdAt": "2026-01-23T10:30:05Z"
}
```

---

## PHASE 2: JOIN CHALLENGE

### 2.1 HTTP Request
```
POST /api/challenges/550e8400-e29b-41d4-a716-446655440000/join
Headers: Authorization: Bearer {JWT_TOKEN_USER_456}
Body: {}
```

**Time**: ~30 seconds after challenge creation

### 2.2 Challenge Lock Acquisition
**Purpose**: Prevent race conditions where multiple users join simultaneously

```typescript
// In-memory lock set
const challengeJoinLocks = new Set<string>();

if (challengeJoinLocks.has(challengeId)) {
  return res.status(400).json({ error: "Challenge is no longer available" });
}
challengeJoinLocks.add(challengeId);
// Lock is now held for this challenge
```

### 2.3 Challenge Validation
**Database Read** (Get fresh state):
```sql
SELECT * FROM challenges 
WHERE id = '550e8400-e29b-41d4-a716-446655440000' 
LIMIT 1;
```

**Validation Checks**:
```javascript
// 1. Challenge exists?
if (!dbChallenge) {
  challengeJoinLocks.delete(challengeId);
  return 404 "Challenge not found";
}

// 2. Not creator's own challenge?
if (dbChallenge.player1Id === "user-456") {
  challengeJoinLocks.delete(challengeId);
  return 400 "Cannot join your own challenge";
}

// 3. Still in waiting state?
if (dbChallenge.status !== 'waiting') {
  challengeJoinLocks.delete(challengeId);
  return 400 "Challenge is no longer available";
}
// All checks passed ✓
```

### 2.4 Balance Check & Currency Deduction
**Transaction Scope**: Complete join operation is atomic

**Currency Type**: USD (from challenge)

```sql
BEGIN TRANSACTION;

-- 1. Lock user row
SELECT * FROM users 
WHERE id = 'user-456' 
FOR UPDATE;

-- Current State:
-- user-456 balance: 600.00 ✓

-- 2. Check balance
-- 600.00 >= 50.00 ✓ PASS

-- 3. Deduct balance
UPDATE users 
SET balance = 550.00  -- 600.00 - 50.00
WHERE id = 'user-456';

-- 4. Log transaction
INSERT INTO currency_ledger (
  user_id, type, amount, timestamp, description
) VALUES (
  'user-456', 'game_stake', -50.00, NOW(),
  'Game stake for challenge 550e8400...'
);
```

**User Balance State**:
```javascript
// BEFORE
{
  id: "user-456",
  username: "challenger2",
  balance: 600.00
}

// AFTER
{
  id: "user-456",
  username: "challenger2",
  balance: 550.00  // ← DEDUCTED
}
```

### 2.5 Challenge Status Update (Atomic)
**Critical Section**: Uses race condition protection

```sql
-- This UPDATE only succeeds if conditions are met
-- This prevents multiple simultaneous joins

UPDATE challenges
SET 
  player2_id = 'user-456',
  status = 'active',  -- ← TRANSITION TO ACTIVE
  started_at = '2026-01-23T10:30:35Z',
  updated_at = '2026-01-23T10:30:35Z'
WHERE 
  id = '550e8400-e29b-41d4-a716-446655440000'
  AND status = 'waiting'      -- Only if still waiting
  AND player2_id IS NULL;     -- Only if no player2 yet

-- Result: 1 row updated (success) or 0 rows updated (failed)
```

**Challenge State After Update**:
```javascript
{
  id: "550e8400-e29b-41d4-a716-446655440000",
  gameType: "chess",
  betAmount: "50",
  currencyType: "usd",
  visibility: "public",
  status: "active",  // ← CHANGED FROM 'waiting' TO 'active'
  player1Id: "user-123",
  player2Id: "user-456",  // ← ASSIGNED
  timeLimit: 300,
  startedAt: "2026-01-23T10:30:35Z",  // ← SET
  createdAt: "2026-01-23T10:30:05Z",
  updatedAt: "2026-01-23T10:30:35Z"  // ← UPDATED
}
```

### 2.6 Live Game Session Creation
**Purpose**: Track game state for WebSocket play

```sql
INSERT INTO live_game_sessions (
  id, challenge_id, game_id, game_type, 
  player1_id, player2_id, status, 
  game_state, turn_number, created_at
) VALUES (
  'session-uuid-001',
  '550e8400-e29b-41d4-a716-446655440000',  -- Links to challenge
  1,  -- Chess game ID
  'chess',
  'user-123',
  'user-456',
  'in_progress',
  '{
    "initialized": true,
    "startedAt": "2026-01-23T10:30:35Z",
    "board": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "currentTurn": "w",
    "moveCount": 0,
    "history": []
  }',
  0,
  '2026-01-23T10:30:35Z'
) RETURNING *;
```

**Live Game Sessions Table**:
```javascript
{
  id: "session-uuid-001",
  challengeId: "550e8400-e29b-41d4-a716-446655440000",
  gameId: 1,
  gameType: "chess",
  player1Id: "user-123",
  player2Id: "user-456",
  player3Id: null,
  player4Id: null,
  status: "in_progress",
  gameState: "{...chess_initial_state...}",
  turnNumber: 0,
  createdAt: "2026-01-23T10:30:35Z"
}
```

### 2.7 Lock Release
```typescript
// After successful transaction commit
challengeJoinLocks.delete(challengeId);
```

### 2.8 Broadcast Challenge Update
**WebSocket Broadcast** (Real-time notification):
```javascript
broadcastChallengeUpdate('started', {
  id: "550e8400-e29b-41d4-a716-446655440000",
  status: "active",
  player1Id: "user-123",
  player1Name: "challenger1",
  player1Rating: { wins: 10, losses: 5, winRate: 67, rank: "silver" },
  player2Id: "user-456",
  player2Name: "challenger2",
  player2Rating: { wins: 8, losses: 3, winRate: 73, rank: "silver" },
  sessionId: "session-uuid-001"
});

// All connected clients receive:
{
  type: 'challenge_update',
  payload: {
    challengeId: "550e8400-e29b-41d4-a716-446655440000",
    status: "started",
    challenge: {...}
  }
}
```

### 2.9 HTTP Response
```javascript
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "gameType": "chess",
  "betAmount": 50,
  "status": "active",
  "player1Id": "user-123",
  "player2Id": "user-456",
  "sessionId": "session-uuid-001",
  "startedAt": "2026-01-23T10:30:35Z"
}
```

### 2.10 Database State Summary After Join
```
USERS TABLE:
┌──────────┬───────────────┬────────────┬──────────┬──────────┐
│ id       │ username      │ balance    │ wins     │ losses   │
├──────────┼───────────────┼────────────┼──────────┼──────────┤
│ user-123 │ challenger1   │ 450.00     │ 10       │ 5        │
│ user-456 │ challenger2   │ 550.00     │ 8        │ 3        │
└──────────┴───────────────┴────────────┴──────────┴──────────┘

CHALLENGES TABLE:
┌────────────────────────────┬───────────┬────────────┬──────────────┬──────────────┬────────┐
│ id                         │ status    │ player1_id │ player2_id   │ started_at   │ bet_am │
├────────────────────────────┼───────────┼────────────┼──────────────┼──────────────┼────────┤
│ 550e8400-e29b-41d4-a716... │ active    │ user-123   │ user-456     │ 2026-01-...  │ 50     │
└────────────────────────────┴───────────┴────────────┴──────────────┴──────────────┴────────┘

LIVE_GAME_SESSIONS TABLE:
┌──────────────────┬────────────────────────────┬───────────┬──────────────┬──────────────┐
│ id               │ challenge_id               │ game_type │ player1_id   │ player2_id   │
├──────────────────┼────────────────────────────┼───────────┼──────────────┼──────────────┤
│ session-uuid-001 │ 550e8400-e29b-41d4-a716... │ chess     │ user-123     │ user-456     │
└──────────────────┴────────────────────────────┴───────────┴──────────────┴──────────────┘
```

---

## PHASE 3: WEBSOCKET CONNECT

### 3.1 WebSocket Establishment
**Protocol**: WebSocket over HTTPS
**Endpoint**: `wss://api.example.com/ws/game`

```javascript
// Client-side connection
const ws = new WebSocket('wss://api.example.com/ws/game');
```

**Server-side handler**:
```javascript
// setupGameWebSocket() in game-websocket.ts
wss.on('connection', (ws: AuthenticatedWebSocket) => {
  ws.isAlive = true;  // Set for heartbeat
  console.log('[WS] New connection established');
  
  // Setup event listeners
  ws.on('message', async (data) => { ... });
  ws.on('close', () => { ... });
  ws.on('error', (error) => { ... });
});
```

### 3.2 Authentication Message
**Client sends**:
```javascript
ws.send(JSON.stringify({
  type: 'authenticate',
  payload: {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  }
}));
```

**Server validates**:
```typescript
async function handleAuthenticate(
  ws: AuthenticatedWebSocket, 
  payload: { token: string }
) {
  try {
    // Decode JWT
    const decoded = jwt.verify(payload.token, JWT_USER_SECRET) as {
      id: string;
      username: string;
    };

    // decoded:
    // {
    //   id: "user-123",
    //   username: "challenger1"
    // }

    // Attach to WebSocket connection
    ws.userId = "user-123";
    ws.username = "challenger1";

    // Map connection in global tracking
    userConnections.set("user-123", ws);

    // Send confirmation
    send(ws, {
      type: 'authenticated',
      payload: {
        userId: "user-123",
        username: "challenger1"
      }
    });
  } catch (error) {
    sendError(ws, 'Authentication failed');
  }
}
```

**Client receives**:
```javascript
{
  type: 'authenticated',
  payload: {
    userId: 'user-123',
    username: 'challenger1'
  }
}
```

### 3.3 Join Game Message
**Player 1 (challenger1) sends**:
```javascript
ws.send(JSON.stringify({
  type: 'join_game',
  payload: {
    sessionId: 'session-uuid-001'
  }
}));
```

**Server-side processing**:
```typescript
async function handleJoinGame(
  ws: AuthenticatedWebSocket,
  payload: { sessionId: string }
) {
  const { sessionId } = payload;
  const userId = ws.userId;  // "user-123"

  try {
    // 1. Get session from database
    const session = await storage.getLiveGameSession(sessionId);
    // session:
    // {
    //   id: "session-uuid-001",
    //   player1Id: "user-123",
    //   player2Id: "user-456",
    //   gameType: "chess",
    //   gameState: "{ ... }",
    //   status: "in_progress"
    // }

    // 2. Verify player is in session
    const isPlayer = [
      session.player1Id,
      session.player2Id,
      session.player3Id,
      session.player4Id
    ].includes(userId);  // true ✓

    if (!isPlayer) {
      sendError(ws, 'You are not a player in this game');
      return;
    }

    // 3. Get or create room
    let room = rooms.get(sessionId);
    if (!room) {
      room = {
        sessionId,
        players: new Map(),
        spectators: new Map(),
        gameType: "chess",
        gameState: session.gameState || '{...initial chess state...}'
      };
      rooms.set(sessionId, room);
    }

    // 4. Add player to room
    room.players.set(userId, ws);
    ws.sessionId = sessionId;
    ws.isSpectator = false;

    // 5. Get game engine and player view
    const engine = getGameEngine("chess");  // ChessEngine
    const playerView = engine.getPlayerView(
      room.gameState,
      userId
    );
    // playerView will show board from player1's perspective (white pieces at bottom)

    // 6. Determine seat and color
    const playerIds = [
      session.player1Id,   // "user-123"
      session.player2Id,   // "user-456"
      null, null
    ];
    const seatIndex = playerIds.indexOf(userId);  // 0
    const playerSeat = seatIndex + 1;  // 1
    const playerColor = playerSeat === 1 ? 'w' : 'b';  // 'w' (white)

    // 7. Get opponent info
    const opponent = await storage.getUser(session.player2Id);
    // opponent:
    // {
    //   id: "user-456",
    //   username: "challenger2"
    // }

    // 8. Send game joined confirmation
    send(ws, {
      type: 'game_joined',
      payload: {
        sessionId: 'session-uuid-001',
        gameType: 'chess',
        view: playerView,
        playerColor: 'w',
        playerSeat: 1,
        isSpectator: false,
        opponent: {
          id: 'user-456',
          username: 'challenger2'
        },
        players: [
          { id: 'user-123', username: 'challenger1' },
          { id: 'user-456', username: 'challenger2' }
        ],
        spectatorCount: 0,
        status: 'in_progress',
        turnNumber: 0
      }
    });

    // 9. Broadcast to room (other players and spectators)
    broadcastToRoom(room, {
      type: 'player_joined',
      payload: {
        userId: 'user-123',
        username: 'challenger1'
      }
    }, userId);  // Don't re-send to sender
  } catch (error) {
    console.error('Error joining game:', error);
    sendError(ws, 'Failed to join game');
  }
}
```

**In-Memory State Updated**:
```javascript
// rooms map
rooms.set('session-uuid-001', {
  sessionId: 'session-uuid-001',
  players: Map {
    'user-123' → <WebSocket connection>,
    // 'user-456' will join when they connect
  },
  spectators: Map {},
  gameType: 'chess',
  gameState: '{...chess game state...}'
});

// userConnections map
userConnections.set('user-123', <WebSocket connection>);
```

### 3.4 Player 2 Joins
**Player 2 (challenger2) sends similar authenticate and join_game messages**

**Final Room State**:
```javascript
rooms.set('session-uuid-001', {
  sessionId: 'session-uuid-001',
  players: Map {
    'user-123' → <WebSocket>,  // White
    'user-456' → <WebSocket>   // Black
  },
  spectators: Map {},
  gameType: 'chess',
  gameState: '{...chess game state...}'
});
```

---

## PHASE 4: AUTO-START (Game Ready)

### 4.1 Game Start Trigger
**Trigger Condition**: Both players connected to WebSocket

**Server broadcasts to both players**:
```javascript
// After both players join via WebSocket
broadcastToRoom(room, {
  type: 'game_ready',
  payload: {
    status: 'ready',
    players: [
      { id: 'user-123', username: 'challenger1', color: 'w' },
      { id: 'user-456', username: 'challenger2', color: 'b' }
    ],
    startTime: '2026-01-23T10:30:35Z',
    timeControl: { baseTime: 300, increment: 0 }
  }
});
```

### 4.2 Initial Game State
**Database State** (live_game_sessions):
```javascript
{
  id: 'session-uuid-001',
  challengeId: '550e8400-e29b-41d4-a716-446655440000',
  gameType: 'chess',
  player1Id: 'user-123',
  player2Id: 'user-456',
  status: 'in_progress',
  gameState: {
    board: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    currentTurn: 'w',
    moveCount: 0,
    history: [],
    whiteTime: 300000,
    blackTime: 300000
  },
  turnNumber: 0
}
```

### 4.3 Move Processing Flow
**When Player 1 makes a move**:

```javascript
// Client sends:
ws.send(JSON.stringify({
  type: 'make_move',
  payload: {
    move: {
      type: 'move',
      from: 'e2',
      to: 'e4',
      promotion: null
    },
    expectedTurn: 0
  }
}));
```

**Server-side transaction**:
```typescript
async function handleMakeMove(
  ws: AuthenticatedWebSocket,
  payload: { move: MoveData; expectedTurn?: number }
) {
  const sessionId = ws.sessionId;  // 'session-uuid-001'
  const userId = ws.userId;        // 'user-123'

  const result = await db.transaction(async (tx) => {
    // 1. Lock game session for exclusive access
    const [lockedSession] = await tx
      .select()
      .from(liveGameSessions)
      .where(eq(liveGameSessions.id, sessionId))
      .for('update');  // Serializable isolation

    // 2. Check turn consistency
    if (payload.expectedTurn !== lockedSession.turnNumber) {
      throw new Error('TURN_MISMATCH');
    }

    // 3. Get current game state
    const dbState = lockedSession.gameState;
    // dbState: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

    // 4. Validate move using game engine
    const engine = getGameEngine('chess');
    const validation = engine.validateMove(dbState, userId, payload.move);

    if (!validation.valid) {
      throw new Error(`INVALID_MOVE: ${validation.error}`);
    }

    // 5. Apply move to game state
    const applyResult = engine.applyMove(dbState, userId, payload.move);
    // applyResult: {
    //   success: true,
    //   newState: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
    //   events: [
    //     {
    //       type: 'piece_moved',
    //       from: 'e2',
    //       to: 'e4',
    //       piece: 'P'
    //     }
    //   ]
    // }

    const newTurnNumber = lockedSession.turnNumber + 1;

    // 6. Update game session in database
    await tx
      .update(liveGameSessions)
      .set({
        gameState: applyResult.newState,
        turnNumber: newTurnNumber
      })
      .where(eq(liveGameSessions.id, sessionId));

    // Database write:
    // UPDATE live_game_sessions
    // SET game_state = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
    //     turn_number = 1
    // WHERE id = 'session-uuid-001';

    // 7. Log move to game_moves table
    await tx.insert(gameMoves).values({
      sessionId: sessionId,
      playerId: userId,
      moveNumber: newTurnNumber,
      moveType: 'move',
      moveData: JSON.stringify(payload.move),
      isValid: true
    });

    // Database write:
    // INSERT INTO game_moves (
    //   session_id, player_id, move_number, 
    //   move_type, move_data, is_valid
    // ) VALUES (
    //   'session-uuid-001',
    //   'user-123',
    //   1,
    //   'move',
    //   '{"type":"move","from":"e2","to":"e4","promotion":null}',
    //   true
    // );

    return {
      newState: applyResult.newState,
      events: applyResult.events,
      turnNumber: newTurnNumber
    };
  });  // Transaction committed here

  // 8. Update in-memory room state
  room.gameState = result.newState;

  // 9. Send updated state to all players
  for (const [playerId, playerWs] of room.players) {
    const playerView = engine.getPlayerView(
      result.newState,
      playerId
    );
    send(playerWs, {
      type: 'game_update',
      payload: {
        gameType: 'chess',
        events: result.events,
        view: playerView,
        turnNumber: result.turnNumber
      }
    });
  }

  // 10. Send to spectators
  for (const [, spectatorWs] of room.spectators) {
    const spectatorView = engine.getPlayerView(result.newState, 'spectator');
    send(spectatorWs, {
      type: 'game_update',
      payload: {
        gameType: 'chess',
        events: result.events,
        view: spectatorView,
        turnNumber: result.turnNumber
      }
    });
  }

  // 11. Check if game is over
  const gameStatus = engine.getGameStatus(result.newState);
  if (gameStatus.isOver) {
    await handleGameOver(room, gameStatus);
  }
}
```

**Database State After Move 1**:
```
GAME_MOVES TABLE:
┌──────────────────┬───────────┬────────────┬──────────────────┐
│ session_id       │ player_id │ move_no    │ move_data        │
├──────────────────┼───────────┼────────────┼──────────────────┤
│ session-uuid-001 │ user-123  │ 1          │ e2→e4            │
└──────────────────┴───────────┴────────────┴──────────────────┘

LIVE_GAME_SESSIONS TABLE:
┌──────────────────┬─────────────────────────────────────────┬────────┐
│ id               │ game_state                              │ turn   │
├──────────────────┼─────────────────────────────────────────┼────────┤
│ session-uuid-001 │ rnbqkbnr/pppppppp/8/8/4P3/8/PPP1PPP/... │ 1      │
└──────────────────┴─────────────────────────────────────────┴────────┘
```

### 4.4 Game Conclusion Flow
**Example: Player 1 wins by checkmate**

```typescript
async function handleGameOver(room: GameRoom, status: any) {
  const sessionId = room.sessionId;
  const winnerId = status.winner;  // 'user-123'
  const loserId = status.loser;    // 'user-456'

  // Get session and challenge
  const session = await storage.getLiveGameSession(sessionId);
  const [challenge] = await db
    .select()
    .from(challenges)
    .where(eq(challenges.id, session.challengeId));

  // Determine payout (if paid game)
  if (challenge && parseFloat(challenge.betAmount) > 0) {
    const betAmount = parseFloat(challenge.betAmount);
    const houseFee = betAmount * 0.02;  // 2% house fee
    const payoutAmount = betAmount * 2 - houseFee;

    // Update balances in transaction
    await db.transaction(async (tx) => {
      // Winner gets payout
      const [winner] = await tx
        .select()
        .from(users)
        .where(eq(users.id, winnerId))
        .for('update');

      await tx.update(users)
        .set({
          balance: (parseFloat(winner.balance) + payoutAmount).toString(),
          gamesWon: winner.gamesWon + 1
        })
        .where(eq(users.id, winnerId));

      // Loser updates
      const [loser] = await tx
        .select()
        .from(users)
        .where(eq(users.id, loserId))
        .for('update');

      await tx.update(users)
        .set({
          gamesLost: loser.gamesLost + 1
        })
        .where(eq(users.id, loserId));

      // Update challenge with winner
      await tx.update(challenges)
        .set({
          status: 'completed',
          winnerId: winnerId,
          endedAt: new Date()
        })
        .where(eq(challenges.id, session.challengeId));

      // Update game session
      await tx.update(liveGameSessions)
        .set({
          status: 'completed',
          winner: winnerId
        })
        .where(eq(liveGameSessions.id, sessionId));

      // Log winner transaction
      await tx.insert(projectCurrencyLedger).values({
        userId: winnerId,
        type: 'game_payout',
        amount: payoutAmount.toFixed(2),
        description: `Game payout for challenge ${session.challengeId}`
      });

      // Log house fee
      await tx.insert(projectCurrencyLedger).values({
        userId: 'system',
        type: 'house_fee',
        amount: houseFee.toFixed(2),
        description: `House fee from challenge ${session.challengeId}`
      });
    });
  }

  // Broadcast game over to all connected players
  broadcastToRoom(room, {
    type: 'game_over',
    payload: {
      status: status.status,  // 'checkmate'
      winner: winnerId,
      loser: loserId,
      totalMoves: status.moveCount
    }
  });

  // Notify spectators
  broadcastNotification('game_completed', {
    challengeId: session.challengeId,
    winner: winnerId,
    loser: loserId,
    betAmount: challenge.betAmount
  });
}
```

**Final Database State After Game Completion**:
```
USERS TABLE:
┌──────────┬───────────────┬────────────┬──────────┬──────────┐
│ id       │ username      │ balance    │ wins     │ losses   │
├──────────┼───────────────┼────────────┼──────────┼──────────┤
│ user-123 │ challenger1   │ 950.00     │ 11       │ 5        │ ← +50 payout, -2 fee, +1 win
│ user-456 │ challenger2   │ 550.00     │ 8        │ 4        │ ← +1 loss
└──────────┴───────────────┴────────────┴──────────┴──────────┘

CHALLENGES TABLE:
┌────────────────────────────┬───────────┬────────────┬─────────────┬────────┐
│ id                         │ status    │ winner_id  │ ended_at    │ bet_am │
├────────────────────────────┼───────────┼────────────┼─────────────┼────────┤
│ 550e8400-e29b-41d4-a716... │ completed │ user-123   │ 2026-01-... │ 50     │
└────────────────────────────┴───────────┴────────────┴─────────────┴────────┘

LIVE_GAME_SESSIONS TABLE:
┌──────────────────┬────────────┬──────────────┬────────┐
│ id               │ status     │ winner       │ move_c │
├──────────────────┼────────────┼──────────────┼────────┤
│ session-uuid-001 │ completed  │ user-123     │ 50     │
└──────────────────┴────────────┴──────────────┴────────┘

GAME_MOVES TABLE:
┌──────────────────┬───────────┬──────────────┬────────────────────┐
│ session_id       │ player_id │ move_number  │ move_data          │
├──────────────────┼───────────┼──────────────┼────────────────────┤
│ session-uuid-001 │ user-123  │ 1            │ e2→e4              │
│ session-uuid-001 │ user-456  │ 2            │ e7→e5              │
│ ...              │ ...       │ ...          │ ...                │
│ session-uuid-001 │ user-123  │ 49           │ Qh5→f7 (checkmate) │
│ session-uuid-001 │ user-456  │ 50           │ (abandoned)        │
└──────────────────┴───────────┴──────────────┴────────────────────┘
```

---

## SUMMARY OF STATE TRANSITIONS

### Challenge Status Flow
```
┌─────────┐       ┌────────┐       ┌────────┐
│ waiting │ ──→ │ active │ ──→ │complete│
└─────────┘       └────────┘       └────────┘
   (1 player)      (2 players)     (game over)
```

### User Balance Changes
```
User-123 (Challenger 1):
500.00 (initial)
  ↓ -50 (challenge creation stake)
450.00 (waiting for opponent)
  ↓ +98 (payout: 50*2 - 2 fee) ← If wins
548.00 (after game win)

User-456 (Challenger 2):
600.00 (initial)
  ↓ -50 (join challenge stake)
550.00 (active in game)
  ↓ (no change) ← If loses
550.00 (after game loss)
```

### Database Writes Summary
```
1. Create Challenge:
   - challenges table: INSERT 1 row
   - currency_ledger: INSERT 1 row (player1 deduction)
   - notifications: INSERT N rows (followers)

2. Join Challenge:
   - users table: UPDATE 1 row (player2 balance)
   - currency_ledger: INSERT 1 row (player2 deduction)
   - challenges table: UPDATE 1 row (set player2, status→active)
   - live_game_sessions: INSERT 1 row (new game session)

3. Game Play (per move):
   - live_game_sessions: UPDATE 1 row (game_state, turn_number)
   - game_moves: INSERT 1 row (move record)

4. Game Complete:
   - users table: UPDATE 2 rows (winner balance + wins, loser + losses)
   - challenges table: UPDATE 1 row (status→completed, winner)
   - live_game_sessions: UPDATE 1 row (status→completed)
   - currency_ledger: INSERT 2 rows (payout + house fee)

Total writes: ~15-20+ depending on game length
```

---

## KEY DESIGN PATTERNS

### 1. Race Condition Prevention
- **Challenge Join Lock**: In-memory Set prevents multiple simultaneous joins
- **Database Constraints**: Atomic UPDATE with WHERE conditions ensure only one join succeeds
- **Transaction Isolation**: All moves use `for('update')` row locking

### 2. Atomic Transactions
- Currency deduction and challenge creation: Single transaction
- All balance updates: Locked rows with row-level locking
- Game move commits: WITH transactions for consistency

### 3. Real-time Updates
- WebSocket broadcasts on challenge status changes
- Live game updates sent to all connected players
- Spectator support with read-only game views

### 4. Financial Integrity
- House fees tracked separately
- All transactions logged to ledger
- Decimal precision for currency (8 decimal places)

---

## ERROR SCENARIOS & RECOVERY

### Challenge Join Fails
```
Scenario: Second player tries to join, but first player cancelled

1. Database read: status != 'waiting'
2. Lock released immediately
3. Response: 400 "Challenge is no longer available"
4. No balance deduction occurs ✓
```

### Insufficient Balance
```
Scenario: Player has only 40 USD, tries to join 50 USD challenge

1. Transaction begins
2. Row-level lock acquired on user
3. Balance check: 40 < 50 → FAIL
4. Transaction rolled back ✓
5. Balance unchanged: 40 USD
```

### Concurrent Move Conflict
```
Scenario: Two moves sent within same transaction window

1. First move:
   - Lock session
   - Check turn: expectedTurn = 5, dbTurn = 5 ✓
   - Apply move, turnNumber → 6
   - Commit

2. Second move (from other player, before state sync):
   - Lock session
   - Check turn: expectedTurn = 5, dbTurn = 6 ✗ MISMATCH
   - Send TURN_MISMATCH error
   - Client syncs state and retries
```

---

## PERFORMANCE CHARACTERISTICS

### Database Queries
- Challenge creation: ~5 queries
- Challenge join: ~8 queries (with locks)
- Single game move: ~3 queries (with lock)
- Game completion: ~10 queries

### Network
- Challenge creation response: <200ms
- Challenge join response: <300ms
- Game move response: <150ms (WebSocket)

### Storage
- Per challenge: ~500 bytes
- Per game move: ~200 bytes
- Game history (40 moves): ~8KB

---

