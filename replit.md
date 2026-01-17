# VEX - Gaming & Trading Platform

## Overview

VEX is a full-stack gaming and P2P trading platform, inspired by betting platforms like 1xBet. It offers solutions for user management, financial transactions, an agent/affiliate system, complaints handling, and game management. The platform aims to provide a robust, secure, and feature-rich environment for online gaming and trading, with a strong focus on security, scalability, and user experience, positioning itself for significant market potential.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript, built with Vite.
- **Styling**: Tailwind CSS with a custom dark theme (dark navy/blue-black background `#0f1419`, primary green accent `#00c853`, secondary orange/gold accent `#ff9800`).
- **UI Components**: shadcn/ui (New York style) built on Radix UI primitives.
- **State Management**: TanStack React Query for server state.
- **Form Handling**: React Hook Form with Zod for validation.
- **Routing**: Wouter for client-side navigation.
- **Internationalization (i18n)**: Full translation support including RTL for Arabic, with automatic fallback to English.
- **Performance**: Lazy loading for pages and ETag-based caching for user data.

### Backend
- **Framework**: Express.js with TypeScript.
- **Database**: PostgreSQL with Drizzle ORM.
- **Authentication**: JWT-based with bcryptjs for password hashing, supporting multi-role users (admin, agent, affiliate, player).
- **API Design**: RESTful endpoints with role-based access control and middleware for authentication/authorization.
- **Session Management**: Express sessions with PostgreSQL store.
- **Financial Operations**: Decimal precision handling for all transactions.
- **Security**: Comprehensive rate limiting, separate withdrawal passwords, and JWT_SECRET enforcement in production.
- **Scalability**: Docker entrypoint for automatic database migrations and health checks.
- **Monitoring**: Structured logging (JSON format, correlation IDs), Circuit Breaker pattern for external service resilience (database, external-api, payment), and detailed health monitoring (CPU, memory, DB latency, error rates).

### Database Schema
A multi-role user system with balance tracking, VIP levels, referrals, and withdrawal security. Includes modules for agent/affiliate management, comprehensive transaction history, a ticket-based complaint system, game catalog, real-time chat, promo code management, and detailed audit logs.

### WebSocket Game System
- **Robustness**: Exponential backoff with jitter for reconnection, automatic state synchronization, and database-driven state persistence for game sessions.
- **Error Handling**: Typed error codes for specific recovery actions, graceful UI states.
- **Multi-player Support**: Designed for 2-4 player games with player seat detection and spectator tracking.
- **Financial Safety**: Move persistence before broadcasting updates, ensuring atomic operations and preventing state corruption. Production-grade financial safety uses `SELECT ... FOR UPDATE` row-level locking within database transactions to ensure atomicity, prevent concurrent move conflicts, and handle race conditions.
- **Protocol Normalization**: Consistent WebSocket message schema for all message types, including `view` field for player-specific state and `gameType` discriminants.
- **Security**: Server-authoritative game logic with comprehensive authentication guards.

### Implemented Games
- **Chess**: Full implementation with legal move validation, check/checkmate detection, stalemate, draw offers, resignation, and pawn promotion.
- **Backgammon**: Complete game engine with all standard rules (dice rolling, checker movement, hitting/blots, bar re-entry, bearing off, gammon/backgammon scoring).
- **Domino**: 2-4 player game with tile matching, boneyard drawing, pass mechanics, and blocked game detection. Supports multiple scoring modes.
- **Tarneeb**: 4-player trick-taking card game with bidding phase, trump suit selection, team scoring, and target score victory conditions.
- **Baloot**: 4-player Saudi Arabian card game with Sun/Hokm game types, project declarations, team-based scoring, and round point accumulation.

### Game Engine Pattern
Games implement the `GameEngine` interface in `server/game-engines/`, providing methods for server-side move validation (`validateMove`), state mutation (`applyMove`), game status retrieval (`getGameStatus`), legal move generation (`getValidMoves`), and player-specific state views (`getPlayerView`).

### Admin Panel Real-time Features
- **Admin Alerts System**: Real-time WebSocket notifications for admins across categories like disputes, game changes, and trades, with priority levels and deep-link navigation.
- **Multiplayer Games Management**: CRUD operations for game configurations with live sync indicators, scheduled changes, and real-time WebSocket updates.
- **P2P Dispute Management**: Advanced filtering, inline actions (Escalate, Resolve, Close), audit log viewer, and real-time toast notifications for new disputes.

## External Dependencies

### Database
- **PostgreSQL**: Primary database.
- **Drizzle ORM**: Type-safe ORM for PostgreSQL.

### Authentication & Security
- **jsonwebtoken**: For JWT token handling.
- **bcryptjs**: For password hashing.
- **express-session**: For session management.
- **connect-pg-simple**: PostgreSQL store for sessions.
- **express-rate-limit**: For API rate limiting.

### Development Tools
- **Vite**: Frontend build tool.
- **TSX**: TypeScript execution for development.

### Utility Libraries
- **date-fns**: Date manipulation.
- **nanoid/uuid**: Unique ID generation.
- **zod**: Schema validation.
- **xlsx**: Excel file generation.

## Testing

### Test Suites (All Passing)
Run individual test suites:
- `npx tsx server/tests/chess-websocket-test.ts` - Chess (18 tests)
- `npx tsx server/tests/backgammon-websocket-test.ts` - Backgammon (21 tests)
- `npx tsx server/tests/tarneeb-websocket-test.ts` - Tarneeb (15 tests)
- `npx tsx server/tests/domino-websocket-test.ts` - Domino (11 tests)
- `npx tsx server/tests/baloot-websocket-test.ts` - Baloot (18 tests)
- `npx tsx server/tests/platform-financial-test.ts` - Financial Operations (14 tests)
- `npx tsx server/tests/financial-concurrency-test.ts` - Concurrency (12 tests)
- `npx tsx server/tests/lobby-api-stress-test.ts` - Lobby API (9 tests)

### Test Categories
1. **Turn Integrity**: Duplicate move rejection, turn tracking, wrong turn rejection
2. **Network Reliability**: State reconstruction, reconnection handling
3. **Financial Safety**: No double-apply, atomic transactions, deterministic outcomes
4. **Stress & Concurrency**: Multiple independent games, rapid sequential moves
5. **Database Transaction Logic**: SELECT FOR UPDATE locking, atomic commit/rollback

## Production Monitoring Infrastructure

### Structured Logging (`server/lib/logger.ts`)
- Log levels: DEBUG, INFO, WARN, ERROR, FATAL (configurable via LOG_LEVEL env)
- JSON structured output for log aggregation
- Request correlation IDs (x-request-id header)
- Specialized loggers: `logger.financial()`, `logger.game()`, `logger.security()`

### Circuit Breaker Pattern (`server/lib/circuit-breaker.ts`)
Pre-configured circuit breakers for external services:
- **database**: 3 failures, 10s timeout, 30s half-open test
- **external-api**: 5 failures, 30s timeout, 60s half-open test
- **payment**: 2 failures, 60s timeout, 120s half-open test

### Health Endpoints
- `GET /api/health` - Basic health check
- `GET /api/health/detailed` - Extended metrics (CPU, memory, DB latency, pool stats)
- `GET /api/health/full` - Complete health report with alerts and circuit breaker states
- `GET /api/health/circuits` - Circuit breaker states

## Recovery Playbooks

### Circuit Breaker Recovery
**Symptoms**: `/api/health/full` shows circuit breaker in OPEN state
**Recovery Steps**:
1. Check underlying service health
2. Wait for automatic reset timeout
3. Circuit will transition to HALF_OPEN and test recovery
4. Upon success, circuit returns to CLOSED

### Transaction Rollback Behavior
- All financial operations use database transactions with row-level locking
- On Failure: Automatic rollback - no partial state changes
- Logging: Failed transactions logged with requestId for correlation

## Production Audit Summary (January 2026)

### Audit Results: PRODUCTION READY

**Test Suite Results**: 118/118 tests passing
- Chess WebSocket: 18/18
- Backgammon WebSocket: 21/21
- Tarneeb WebSocket: 15/15
- Domino WebSocket: 11/11
- Baloot WebSocket: 18/18
- Platform Financial: 14/14
- Financial Concurrency: 12/12
- Lobby API Stress: 9/9

**Infrastructure Validation**:
- Docker multi-stage build with health checks (30s interval, 60s start period)
- Entrypoint validates ENV secrets (32+ char requirement in production)
- Database connection retry logic (30 attempts)
- Automatic migrations via `drizzle-kit push`

**Database Integrity**:
- 102 tables with proper foreign key constraints
- Full referential integrity across all entities
- Comprehensive indexing on frequently queried columns

**Security Measures**:
- 6-tier rate limiting (auth, registration, strict, API, sensitive, attack protection)
- 209 authenticated endpoints with JWT middleware
- bcrypt password hashing
- Dual JWT system (user + admin tokens)
- Withdrawal password support

**API Coverage**:
- 234 RESTful API endpoints
- Role-based access control (admin, agent, affiliate, player)
- Zod schema validation on all inputs

**Real-Time Systems**:
- WebSocket game state synchronization
- Exponential backoff reconnection
- Admin alerts with WebSocket broadcast
- Spectator viewing with gifts

**P2P Trading**:
- Complete escrow system (14 P2P tables)
- Dispute management with audit logs
- Trader profiles, metrics, badges, ratings

**Frontend**:
- 26+ user pages, 27 admin pages
- Full i18n support (53 files) with Arabic RTL
- Lazy loading for performance
