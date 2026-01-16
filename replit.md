# VEX - Gaming & Trading Platform

## Overview

VEX is a full-stack gaming and P2P trading platform, inspired by betting platforms like 1xBet. It provides comprehensive solutions for user management, financial transactions, an agent/affiliate system, complaints handling, and game management. The platform aims to offer a robust, secure, and feature-rich environment for online gaming and trading, with a strong focus on security, scalability, and user experience.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript, built with Vite.
- **Styling**: Tailwind CSS with a custom dark theme (inspired by 1xBet colors: dark navy/blue-black background `#0f1419`, primary green accent `#00c853`, secondary orange/gold accent `#ff9800`).
- **UI Components**: shadcn/ui (New York style) built on Radix UI primitives.
- **State Management**: TanStack React Query for server state.
- **Form Handling**: React Hook Form with Zod for validation.
- **Routing**: Wouter for client-side navigation.
- **Internationalization (i18n)**: Full translation support including RTL for Arabic, with automatic fallback to English and development-only warnings for missing translations.
- **Performance**: Lazy loading for over 40 pages and ETag-based caching for user data.

### Backend
- **Framework**: Express.js with TypeScript.
- **Database**: PostgreSQL with Drizzle ORM.
- **Authentication**: JWT-based with bcryptjs for password hashing, supporting multi-role users (admin, agent, affiliate, player).
- **API Design**: RESTful endpoints with role-based access control and middleware for authentication/authorization.
- **Session Management**: Express sessions with PostgreSQL store.
- **Financial Operations**: Decimal precision handling for all transactions.
- **Security**: Comprehensive rate limiting for API endpoints (global, registration, login, password reset, sensitive operations), separate withdrawal passwords, and JWT_SECRET enforcement in production.
- **Scalability**: Docker entrypoint for automatic database migrations and health checks.
- **Monitoring**: Structured logging (JSON format, correlation IDs, specialized loggers), Circuit Breaker pattern for external service resilience (database, external-api, payment), and detailed health monitoring (CPU, memory, DB latency, error rates).

### Database Schema
A multi-role user system with balance tracking, VIP levels, referrals, and withdrawal security. Includes modules for agent/affiliate management, comprehensive transaction history (deposits, withdrawals, stakes, wins, bonuses), a ticket-based complaint system, game catalog with flexible pricing, real-time chat with disappearing messages, promo code management, and detailed audit logs.

### WebSocket Game System
- **Robustness**: Exponential backoff with jitter for reconnection, automatic state synchronization on reconnect or tab focus, and database-driven state persistence for game sessions (source of truth).
- **Error Handling**: Typed error codes for specific recovery actions (e.g., `SESSION_NOT_FOUND`, `NOT_AUTHORIZED`), graceful UI states, and console logging.
- **Multi-player Support**: Designed for 2-4 player games with player seat detection and spectator tracking.
- **Financial Safety**: Move persistence before broadcasting updates, ensuring atomic operations and preventing state corruption.
- **Protocol Normalization**: Consistent WebSocket message schema for all message types, including `view` field for player-specific state and `gameType` discriminants.
- **Security**: Server-authoritative game logic with comprehensive authentication guards (unauthenticated, spectators, non-players cannot make moves). Production-grade financial safety using `SELECT ... FOR UPDATE` row-level locking within database transactions to ensure atomicity, prevent concurrent move conflicts, and handle race conditions. Includes client-side turn tracking for UX optimization, but server remains the ultimate authority.

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

### Chess Game Test Suite (18 tests, all passing)
Run: `npx tsx server/tests/chess-websocket-test.ts`

**Test Categories**:
1. **Turn Integrity (4 tests)**: Duplicate move rejection, turn increment, wrong turn rejection, rapid move consistency
2. **Network Reliability (3 tests)**: State reconstruction from FEN, multiple reconnects, state sync
3. **Financial Safety (4 tests)**: No double-apply, deterministic outcomes, server override, no corruption from invalid moves
4. **Stress & Concurrency (4 tests)**: Multiple independent games, rapid sequential moves, concurrent validation, high-volume integrity
5. **Database Transaction Logic (3 tests)**: SELECT FOR UPDATE locking, turn mismatch detection, atomic commit/rollback

### Platform Financial Test Suite (14 tests, all passing)
Run: `npx tsx server/tests/platform-financial-test.ts`

**Test Categories**:
1. **Balance Consistency (3 tests)**: Atomic negative balance prevention, sequential update consistency, concurrent update serialization
2. **Transfer Atomicity (3 tests)**: Atomic fund transfer, atomic failure rollback, deadlock prevention via consistent lock ordering
3. **Game Payout (3 tests)**: Stake-to-winner transfer, platform fee calculation, sequential multi-game payouts
4. **Concurrency Stress (2 tests)**: High-volume concurrent balance updates maintain total sum, rapid game payouts maintain consistency
5. **Edge Cases (3 tests)**: Zero amount handling, decimal precision maintenance, self-transfer handling

## Production Monitoring Infrastructure

### Structured Logging (`server/lib/logger.ts`)
- Log levels: DEBUG, INFO, WARN, ERROR, FATAL (configurable via LOG_LEVEL env)
- JSON structured output for log aggregation
- Request correlation IDs (x-request-id header)
- Specialized loggers: `logger.financial()`, `logger.game()`, `logger.security()`
- Performance timing with `logger.startTimer()`
- Child loggers with persistent context

### Circuit Breaker Pattern (`server/lib/circuit-breaker.ts`)
- States: CLOSED (normal), OPEN (failing fast), HALF_OPEN (testing recovery)
- Pre-configured breakers:
  - `database`: 3 failures, 10s reset timeout (very responsive)
  - `external-api`: 5 failures, 30s reset timeout
  - `payment`: 2 failures, 60s reset timeout (very sensitive for financial ops)
- Automatic recovery attempts with success threshold
- Request timeout handling
- Fallback function support

### Health Monitoring (`server/lib/health.ts`)
- **Endpoints**:
  - `/api/health` - Quick health check for load balancers
  - `/api/health/detailed` - Full system metrics and pool stats
  - `/api/health/full` - Complete report with circuit breakers and alerts
  - `/api/health/circuits` - Circuit breaker status only
- **System Metrics**: CPU load, memory usage, process uptime
- **Database Health**: Connection status, latency checks
- **Alert Thresholds**:
  - Memory: 80% warning, 95% critical
  - DB latency: 100ms warning, 500ms critical
  - Error rate: 10/min warning, 50/min critical

### Staging Verification Test Suite
Run: `npx tsx server/tests/staging-verification-test.ts`

Exercises monitoring infrastructure with 13 tests covering:
- Logging output at all levels (DEBUG, INFO, WARN, ERROR)
- Specialized loggers (financial, game, security)
- Circuit breaker state transitions (CLOSED → OPEN → HALF_OPEN → CLOSED)
- Health report generation with alerts
- Error tracking and counting

### Financial Concurrency Test Suite
Run: `npx tsx server/tests/financial-concurrency-test.ts`

Tests real storage transaction paths with 12 tests covering:
- Atomic balance operations with negative balance prevention
- Concurrent balance updates (serialization verified)
- Multi-user transfer integrity (total balance preserved)
- Full game stake/payout flow
- Large concurrent operation stress test (50+ parallel operations)

## Recovery Playbooks

### Circuit Breaker Recovery
**Symptoms**: `/api/health/full` shows circuit breaker in OPEN state
**Cause**: Failure threshold exceeded (database: 3 failures, payment: 2 failures)
**Recovery Steps**:
1. Check underlying service health (database connection, external API)
2. Wait for automatic reset timeout (database: 10s, payment: 60s)
3. Circuit will transition to HALF_OPEN and test recovery
4. Upon success, circuit returns to CLOSED
**Manual Override**: Call `circuitBreaker.reset()` from admin endpoint if needed

### Transaction Rollback Behavior
**Behavior**: All financial operations use database transactions with row-level locking
**On Failure**: Automatic rollback - no partial state changes
**Logging**: Failed transactions logged with requestId for correlation
**Verification**: Balance totals are preserved across all concurrent operations

### Error Rate Alerts
**Warning**: 10 errors/minute → Investigate error logs
**Critical**: 50 errors/minute → Potential service degradation
**Actions**:
1. Check `/api/health/full` for alert details
2. Review structured logs for error patterns (filter by ERROR/FATAL)
3. Check circuit breaker states for failing dependencies

### Database Latency Alerts
**Warning**: >100ms latency → Monitor for degradation
**Critical**: >500ms latency → Immediate investigation required
**Actions**:
1. Check database connection pool stats via `/api/health/detailed`
2. Review slow queries in database logs
3. Consider connection pool scaling if many waiting clients