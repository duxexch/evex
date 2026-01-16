# VEX - Gaming & Trading Platform

## Overview

VEX is a comprehensive gaming and P2P trading platform inspired by betting/gaming platforms like 1xBet. It provides a full-stack solution for managing user accounts, financial transactions, agent/affiliate systems, complaints handling, and game management. The platform features a React frontend with a dark, gaming-inspired theme and an Express.js backend with PostgreSQL database.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with hot module replacement
- **Styling**: Tailwind CSS with custom dark theme (1xBet-inspired colors)
- **UI Components**: shadcn/ui (New York style) with Radix UI primitives
- **State Management**: TanStack React Query for server state
- **Form Handling**: React Hook Form with Zod validation
- **Routing**: Wouter for client-side routing

**Design System**:
- Dark navy/blue-black background (#0f1419)
- Primary accent: Bright green (#00c853)
- Secondary accent: Orange/Gold (#ff9800)
- Component library includes cards, buttons, dialogs, forms, and data tables

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT-based with bcryptjs password hashing
- **API Design**: RESTful endpoints under `/api` prefix
- **Session Management**: Express sessions with PostgreSQL store option

**Key Backend Patterns**:
- Role-based access control (admin, agent, affiliate, player)
- Middleware chain for authentication and authorization
- Storage interface pattern for data access abstraction
- Decimal precision handling for financial operations

### Database Schema
The schema (in `shared/schema.ts`) includes:
- **Users**: Multi-role user system with balance tracking, VIP levels, referrals, withdrawal password security
- **Agents**: Agent management with commission rates and payment methods
- **Affiliates**: Affiliate tracking with promo codes and statistics
- **Transactions**: Full transaction history (deposits, withdrawals, bets, wins, bonuses)
- **Complaints**: Ticket system with priority levels and message threads
- **Games**: Game catalog with session tracking, pricing controls (free/paid, bet-based/fixed pricing)
- **Chat Messages**: Real-time messaging with disappearing messages support
- **Promo Codes**: Promotional code management with usage tracking
- **Audit Logs**: Comprehensive action logging
- **Financial Limits**: Configurable limits per user/agent

### Recent Features (January 2026)
- **User Account Caching**: Strong ETag-based caching with HTTP 304 support for efficient user data fetching
- **Disappearing Messages**: Chat messages can be set to disappear after being read
- **Free/Paid Games**: Games can be configured as free-to-play or paid with bet-based or fixed pricing
- **Withdrawal Password**: Separate security password for withdrawals and P2P sells
- **Rate Limiting**: Comprehensive rate limiting system:
  - Global API: 100 requests/minute
  - Registration: 10 attempts/15 minutes
  - Failed login: 5 attempts/15 minutes
  - Password reset: 5 attempts/hour
  - Sensitive operations (withdrawals): 5 attempts/15 minutes
- **Enhanced Security**: JWT_SECRET enforcement in production mode (fails if not set)
- **Docker Entrypoint**: Automatic database migrations and health checks on container startup
- **Lazy Loading**: 40+ pages use React.lazy() for improved initial load times
- **Health Monitoring**: Detailed health endpoints with DB latency, memory usage, pool stats, and CPU metrics
- **Trust Proxy**: Proper proxy configuration for rate limiting behind nginx/load balancers
- **Internationalization (i18n)**: Full translation support with automatic missing translation detection
  - English and Arabic translations with RTL support
  - Automatic fallback to English when translation is missing
  - Development-only warnings in console for missing translations
  - `TranslationDebugger` component shows missing translations count in development
  - Helper functions: `getMissingTranslations()`, `validateTranslations()`, `clearMissingTranslations()`
  - Uses "stake" terminology instead of "bet" throughout the platform

### WebSocket Game System (January 2026)
- **Robust Reconnection**: Exponential backoff with jitter, max 5 attempts
  - Automatic reconnect on network recovery (online event)
  - Automatic state sync on visibility change (tab focus)
  - State sync triggered after successful reconnect/game_joined
- **State Persistence**: Game state synced from database on reconnect, not just memory
  - Database is source of truth for game state
  - Turn number properly incremented with atomic operations
  - Move history persisted for audit trail
- **Error Handling**: Typed error codes for specific recovery actions
  - SESSION_NOT_FOUND, NOT_AUTHORIZED error codes
  - Graceful UI states: connecting, reconnecting, syncing, error
  - Console logging for debugging with [WS] prefix
- **Multi-player Support**: Player seat detection for 2-4 player games
  - Chess uses player1 = white, player2 = black
  - Extensible for team games (Tarneeb, Baloot)
  - spectatorId tracking for proper cleanup
- **Financial Safety**: Move persistence before broadcasting updates
  - Failed saves return error to client, don't corrupt state
- **Protocol Normalization**: Consistent WebSocket message schema
  - All message types use `view` field for player-specific state
  - All payloads include `gameType` discriminant
  - Consistent payload formats: make_move, chat, spectator events
- **Client-side Validation**: Chess-specific guards
  - GameType guard: rejects non-chess payloads
  - Shape validation: verifies fen, currentTurn, validMoves fields
  - Error UI with retry option for invalid states

### WebSocket Security Verification (January 2026)
- **Server-Authoritative State**: All game logic executed on server
  - Chess moves validated via chess.js library
  - Turn order enforced server-side
  - Player identity verified against session
- **Authentication Guards**:
  - Unauthenticated users cannot make moves
  - Spectators cannot make moves (separate flag check)
  - Non-players receive NOT_AUTHORIZED errors
- **Financial Safety (Move Processing - PRODUCTION GRADE)**:
  1. SELECT ... FOR UPDATE locks session row for exclusive access
  2. Validate move against DB state (not in-memory) inside transaction
  3. Apply move to create new state
  4. Update session + insert move history atomically in transaction
  5. Room state updated only AFTER transaction commits
  6. Broadcast only after successful commit
  7. On any failure, sync room state from DB and notify client
- **Concurrency Control**:
  - Row-level locking prevents concurrent move conflicts
  - Optional expectedTurn validation for client-side turn tracking
  - TURN_MISMATCH errors trigger automatic state_sync
  - Race conditions fully handled by database transactions
- **Error Handling**: Typed error codes with appropriate recovery
  - SESSION_NOT_FOUND, TURN_MISMATCH, INVALID_MOVE, MOVE_APPLY_FAILED
  - All failures trigger room state resync from database
- **Error Logging**: All move errors logged with session/user context
- **Graceful Degradation**: Connection errors don't corrupt state

### Client-Side Turn Tracking (January 2026)
**Purpose**: UX optimization layer only - server remains fully authoritative

**Validation Flow**:
1. **Client-side (optimization)**:
   - Tracks `turnNumber` locally from server messages
   - Prevents duplicate move submissions via `isMovePending` flag
   - Sends `expectedTurn` with each move for early mismatch detection
   - Blocks UI during pending moves to prevent double-clicks
2. **Server-side (authoritative)**:
   - SELECT FOR UPDATE locks session row
   - Validates against DB state, not client-provided data
   - If expectedTurn provided and mismatches DB, rejects with TURN_MISMATCH
   - If expectedTurn not provided, move still processed (backwards compatible)
   - All validation happens inside transaction before commit

**Failure & Recovery Scenarios**:
| Scenario | Detection | Recovery |
|----------|-----------|----------|
| Network lag | Server rejects stale turn | state_sync sent, client resets turnNumber |
| Tab refresh | turnNumber resets to 0 | Server syncs on game_joined, turnNumber updated |
| Reconnect | Client may have stale state | requestStateSync on reconnect, turnNumber updated |
| Concurrent moves | Only one succeeds (row lock) | Loser gets TURN_MISMATCH + state_sync |
| Malicious client | Sends wrong expectedTurn | Server validates against DB, ignores client value |

**Assumptions**:
- Server is the single source of truth; client turn tracking is advisory only
- Browser may lose state (refresh, crash); always resync from server
- Network may be unreliable; handle all edge cases gracefully
- Client could be malicious; never trust client-provided state for security

**Files**:
- Server: `server/game-websocket.ts` (handleMakeMove with transaction + FOR UPDATE)
- Client: `client/src/hooks/useGameWebSocket.ts` (turnNumber state + isMovePending)

### Production Readiness Test Suite (January 2026)

**Test Files**:
- `server/tests/chess-websocket-test.ts` - Unit tests for game logic and concurrency
- `server/tests/chess-integration-test.ts` - End-to-end integration tests

**Unit Test Categories (18 tests, all passing)**:
1. **Turn Integrity (4 tests)**:
   - Duplicate move with same expectedTurn is rejected
   - Turn number increments correctly after each move
   - Invalid move on wrong turn is rejected
   - State remains consistent after rapid move sequence

2. **Network Reliability (3 tests)**:
   - Game state can be reconstructed from FEN
   - Multiple reconnects maintain correct state
   - State sync restores correct turn information

3. **Financial Safety (4 tests)**:
   - Move cannot be applied twice to same state
   - Game outcome is deterministic from move history
   - Server state override simulation
   - No state corruption from invalid move attempts

4. **Stress & Concurrency (4 tests)**:
   - Multiple independent games can run simultaneously
   - Rapid sequential moves do not corrupt state
   - Concurrent move validation is consistent
   - High-volume move sequence maintains integrity

5. **Database Transaction Logic (3 tests)**:
   - SELECT FOR UPDATE simulation: only one writer succeeds
   - Turn mismatch detection prevents stale updates
   - Atomic commit: all-or-nothing update

**Run Tests**: 
- Unit tests: `npx tsx server/tests/chess-websocket-test.ts` (18 tests, all passing)
- Integration tests: `npx tsx server/tests/chess-integration-test.ts` (requires direct WebSocket access)

**Integration Test Environment Notes**:
- Integration tests require `TEST_WS_URL` environment variable in Replit due to proxy WebSocket routing
- In production/staging, tests connect directly to `ws://localhost:5000/ws/game`
- Unit tests cover all critical paths and don't require WebSocket connectivity

### Build and Development
- **Development**: `npm run dev` - runs tsx with hot reload
- **Production Build**: Custom build script using esbuild for server and Vite for client
- **Database Migrations**: Drizzle Kit with `npm run db:push`
- **Type Checking**: `npm run check` for TypeScript validation

## External Dependencies

### Database
- **PostgreSQL**: Primary database (requires `DATABASE_URL` environment variable)
- **Drizzle ORM**: Type-safe database operations with automatic schema inference

### Authentication & Security
- **jsonwebtoken**: JWT token generation and verification
- **bcryptjs**: Password hashing
- **express-session**: Session management
- **connect-pg-simple**: PostgreSQL session store
- **express-rate-limit**: Brute-force protection for auth endpoints

### Security Notes
- **SESSION_SECRET**: Required in production (app will fail to start without it)
- **Rate Limiting**: All auth endpoints protected (login, register, forgot-password, reset-password)
  - Login/register: 10 attempts per 15 minutes
  - Password reset: 5 attempts per hour
- **Docker Deployment**: Uses entrypoint.sh for automatic migrations with validation

### Third-Party Services (Potential)
Based on dependencies, the platform is prepared for:
- **Stripe**: Payment processing integration
- **Nodemailer**: Email notifications
- **OpenAI/Google Generative AI**: AI-powered features
- **Multer**: File upload handling

### Development Tools
- **Vite**: Frontend build and development server
- **Replit Plugins**: Development banner, cartographer, and error overlay for Replit environment
- **TSX**: TypeScript execution for development

### Data Processing
- **xlsx**: Excel file generation for reports
- **date-fns**: Date manipulation
- **nanoid/uuid**: Unique identifier generation
- **zod**: Schema validation for API inputs