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
- **Rate Limiting**: Authentication endpoints protected with express-rate-limit (10 attempts/15 min)
- **Enhanced Security**: JWT_SECRET enforcement in production mode (fails if not set)
- **Docker Entrypoint**: Automatic database migrations and health checks on container startup
- **Lazy Loading**: 40+ pages use React.lazy() for improved initial load times

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