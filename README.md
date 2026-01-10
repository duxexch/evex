# VEX - Gaming & P2P Trading Platform

<div align="center">

![VEX Platform](https://img.shields.io/badge/VEX-Gaming%20Platform-00c853?style=for-the-badge)
![Version](https://img.shields.io/badge/version-1.0.0-blue?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)
![Node](https://img.shields.io/badge/node-20.x-brightgreen?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?style=for-the-badge)

**A comprehensive gaming and P2P trading platform with Binance-inspired design**

[English](#overview) | [العربية](#نظرة-عامة)

</div>

---

## Overview

VEX is a full-stack gaming and P2P (peer-to-peer) trading platform inspired by platforms like 1xBet and Binance P2P. It provides a complete solution for managing user accounts, financial transactions, agent/affiliate systems, complaints handling, game management, and real-time notifications.

### Key Features

- **Multi-Role System**: Admin, Agent, Affiliate, and Player roles with role-based access control
- **P2P Trading**: Buy and sell with multiple payment methods and currencies
- **Game Management**: Support for multiple game types with RTP controls and betting limits
- **Real-time Notifications**: Push notifications with sound alerts and offline email delivery
- **Multilingual Support**: Full Arabic and English localization (RTL/LTR)
- **Wallet System**: Multi-currency wallet with deposit, withdrawal, and transfer capabilities
- **Agent/Affiliate System**: Commission tracking, referral codes, and payout management
- **Admin Dashboard**: Comprehensive control panel with analytics and user management
- **Privacy Controls**: Stealth mode and online status visibility settings
- **Responsive Design**: Dark theme optimized for desktop and mobile

---

## نظرة عامة

VEX هي منصة متكاملة للألعاب والتداول P2P مستوحاة من منصات مثل 1xBet و Binance P2P. توفر حلاً شاملاً لإدارة حسابات المستخدمين والمعاملات المالية ونظام الوكلاء والعمولات.

---

## Table of Contents

- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Installation](#installation)
  - [Local Development](#local-development)
  - [Docker Deployment](#docker-deployment)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [Production Deployment](#production-deployment)
- [API Documentation](#api-documentation)
- [Admin Panel](#admin-panel)
- [Contributing](#contributing)

---

## Architecture

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Vite |
| **UI Components** | shadcn/ui, Radix UI, Tailwind CSS |
| **State Management** | TanStack React Query |
| **Backend** | Express.js, TypeScript |
| **Database** | PostgreSQL with Drizzle ORM |
| **Authentication** | JWT with bcrypt password hashing |
| **Real-time** | WebSocket (ws) |
| **Forms** | React Hook Form + Zod validation |
| **Routing** | Wouter (frontend), Express Router (backend) |

### System Design

```
┌─────────────────────────────────────────────────────────────────┐
│                        VEX Platform                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   React     │    │   Express   │    │  PostgreSQL │         │
│  │  Frontend   │◄──►│   Backend   │◄──►│   Database  │         │
│  │  (Vite)     │    │   (API)     │    │  (Drizzle)  │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│         │                  │                                    │
│         ▼                  ▼                                    │
│  ┌─────────────┐    ┌─────────────┐                            │
│  │  WebSocket  │    │   Service   │                            │
│  │  Real-time  │    │   Worker    │                            │
│  │  Updates    │    │   (Push)    │                            │
│  └─────────────┘    └─────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
vex/
├── client/                      # Frontend React application
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   │   ├── ui/              # shadcn/ui base components
│   │   │   └── ...              # Custom components
│   │   ├── hooks/               # Custom React hooks
│   │   │   ├── use-auth.tsx     # Authentication hook
│   │   │   ├── use-i18n.tsx     # Internationalization hook
│   │   │   └── use-toast.ts     # Toast notifications
│   │   ├── lib/                 # Utility libraries
│   │   │   ├── queryClient.ts   # React Query configuration
│   │   │   ├── notifications.ts # Push notification utilities
│   │   │   └── utils.ts         # Helper functions
│   │   ├── pages/               # Page components
│   │   │   ├── admin/           # Admin panel pages
│   │   │   ├── dashboard.tsx    # User dashboard
│   │   │   ├── wallet.tsx       # Wallet management
│   │   │   ├── p2p.tsx          # P2P trading
│   │   │   ├── games.tsx        # Games lobby
│   │   │   ├── settings.tsx     # User settings
│   │   │   └── ...
│   │   ├── App.tsx              # Main application component
│   │   ├── main.tsx             # Application entry point
│   │   └── index.css            # Global styles & Tailwind
│   └── public/
│       └── sw.js                # Service worker for push notifications
│
├── server/                      # Backend Express application
│   ├── index.ts                 # Server entry point
│   ├── routes.ts                # API routes (user-facing)
│   ├── admin-routes.ts          # Admin API routes
│   ├── storage.ts               # Data access layer
│   ├── db.ts                    # Database connection
│   ├── websocket.ts             # WebSocket handler
│   ├── seed.ts                  # Database seeding
│   ├── vite.ts                  # Vite dev server integration
│   └── static.ts                # Static file serving
│
├── shared/                      # Shared code (frontend & backend)
│   └── schema.ts                # Database schema & types (Drizzle)
│
├── scripts/                     # Utility scripts
│   ├── seed-data.ts             # Production data seeding
│   └── ...
│
├── docker/                      # Docker configuration
│   └── nginx.conf               # Nginx reverse proxy config
│
├── docs/                        # Documentation
│
├── Dockerfile                   # Docker image definition
├── docker-compose.yml           # Docker Compose configuration
├── package.json                 # Node.js dependencies
├── tsconfig.json                # TypeScript configuration
├── vite.config.ts               # Vite build configuration
├── tailwind.config.ts           # Tailwind CSS configuration
├── drizzle.config.ts            # Drizzle ORM configuration
└── design_guidelines.md         # UI/UX design guidelines
```

---

## Prerequisites

### Required

- **Node.js**: v20.x or higher
- **npm**: v10.x or higher
- **PostgreSQL**: v15.x or higher

### Optional (for Docker deployment)

- **Docker**: v24.x or higher
- **Docker Compose**: v2.x or higher

---

## Environment Variables

Create a `.env` file in the root directory with the following variables:

### Required Variables

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/vex_db
PGUSER=username
PGPASSWORD=password
PGDATABASE=vex_db
PGHOST=localhost
PGPORT=5432

# Security
SESSION_SECRET=your-super-secret-session-key-min-32-chars
```

### Optional Variables (External Integrations)

```env
# Email Service (for notifications)
SENDGRID_API_KEY=your-sendgrid-api-key

# SMS Service
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# OAuth Providers
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
TELEGRAM_BOT_TOKEN=your-telegram-bot-token

# Payment Gateway
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key

# Push Notifications
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY=your-firebase-private-key
FIREBASE_CLIENT_EMAIL=your-firebase-client-email
```

### Environment Variables Description

#### Database Variables (Required)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Full PostgreSQL connection string in format: `postgresql://user:password@host:port/database` |
| `PGUSER` | Yes | PostgreSQL username for database authentication |
| `PGPASSWORD` | Yes | PostgreSQL password for database authentication |
| `PGDATABASE` | Yes | Name of the PostgreSQL database (e.g., `vex_db`) |
| `PGHOST` | Yes | PostgreSQL server hostname (e.g., `localhost` or `db` for Docker) |
| `PGPORT` | Yes | PostgreSQL server port (default: `5432`) |

#### Security Variables (Required)

| Variable | Required | Description |
|----------|----------|-------------|
| `SESSION_SECRET` | Yes | Secret key for encrypting session cookies. Must be at least 32 characters. Use a random string generator for production. |
| `NODE_ENV` | No | Environment mode: `development` or `production`. Defaults to `development`. |
| `PORT` | No | Server port number. Defaults to `5000`. |

#### Email Service (Optional)

| Variable | Required | Description |
|----------|----------|-------------|
| `SENDGRID_API_KEY` | No | SendGrid API key for sending email notifications (deposits, withdrawals, P2P trades) |

#### SMS Service (Optional)

| Variable | Required | Description |
|----------|----------|-------------|
| `TWILIO_ACCOUNT_SID` | No | Twilio Account SID for SMS verification and notifications |
| `TWILIO_AUTH_TOKEN` | No | Twilio Auth Token for API authentication |
| `TWILIO_PHONE_NUMBER` | No | Twilio phone number in E.164 format (e.g., `+1234567890`) |

#### OAuth Providers (Optional)

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLIENT_ID` | No | Google OAuth 2.0 Client ID for social login |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth 2.0 Client Secret |
| `FACEBOOK_APP_ID` | No | Facebook App ID for social login |
| `FACEBOOK_APP_SECRET` | No | Facebook App Secret |
| `TELEGRAM_BOT_TOKEN` | No | Telegram Bot Token for Telegram authentication |
| `TWITTER_API_KEY` | No | Twitter/X API Key for social login |
| `TWITTER_API_SECRET` | No | Twitter/X API Secret |

#### Payment Gateway (Optional)

| Variable | Required | Description |
|----------|----------|-------------|
| `STRIPE_SECRET_KEY` | No | Stripe Secret Key (starts with `sk_`) for payment processing |
| `STRIPE_PUBLISHABLE_KEY` | No | Stripe Publishable Key (starts with `pk_`) for frontend |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe Webhook Secret for verifying webhook events |

#### Push Notifications (Optional)

| Variable | Required | Description |
|----------|----------|-------------|
| `FIREBASE_PROJECT_ID` | No | Firebase project ID for push notifications |
| `FIREBASE_PRIVATE_KEY` | No | Firebase service account private key (JSON format) |
| `FIREBASE_CLIENT_EMAIL` | No | Firebase service account client email |

---

## Installation

### Local Development

1. **Clone the repository**

```bash
git clone https://github.com/your-username/vex.git
cd vex
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Create the database**

```bash
# Create PostgreSQL database
createdb vex_db

# Or using psql
psql -U postgres -c "CREATE DATABASE vex_db;"
```

5. **Push database schema**

```bash
npm run db:push
```

6. **Seed initial data (optional)**

```bash
npx tsx scripts/seed-data.ts
```

7. **Start development server**

```bash
npm run dev
```

The application will be available at `http://localhost:5000`

---

### Docker Deployment

1. **Clone the repository**

```bash
git clone https://github.com/your-username/vex.git
cd vex
```

2. **Configure environment**

```bash
# Create .env file for Docker
cat > .env << EOF
POSTGRES_USER=vex_user
POSTGRES_PASSWORD=your-secure-password
POSTGRES_DB=vex_db
SESSION_SECRET=your-super-secret-session-key-min-32-chars
EOF
```

3. **Build and start containers**

```bash
# Start with PostgreSQL and App
docker-compose up -d

# Or with Nginx reverse proxy
docker-compose --profile with-nginx up -d
```

4. **Push database schema**

```bash
docker-compose exec app npx drizzle-kit push
```

5. **Seed initial data (optional)**

```bash
docker-compose exec app npx tsx scripts/seed-data.ts
```

6. **View logs**

```bash
docker-compose logs -f app
```

#### Docker Commands Reference

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Rebuild after changes
docker-compose up -d --build

# View logs
docker-compose logs -f

# Access app container shell
docker-compose exec app sh

# Access database
docker-compose exec db psql -U vex_user -d vex_db

# Backup database
docker-compose exec db pg_dump -U vex_user vex_db > backup.sql

# Restore database
cat backup.sql | docker-compose exec -T db psql -U vex_user -d vex_db
```

---

## Database Setup

### Schema Overview

The database includes the following main tables:

| Table | Description |
|-------|-------------|
| `users` | User accounts with roles, balances, VIP levels |
| `transactions` | Financial transaction history |
| `agents` | Agent accounts with commission settings |
| `affiliates` | Affiliate tracking with promo codes |
| `complaints` | Support ticket system |
| `complaint_messages` | Ticket conversation threads |
| `games` | Game catalog with configurations |
| `game_sessions` | Active game sessions |
| `chat_messages` | Real-time messaging |
| `promo_codes` | Promotional codes |
| `currencies` | Supported currencies |
| `payment_methods` | Available payment methods |
| `p2p_trades` | P2P trade orders |
| `audit_logs` | Admin action logging |
| `financial_limits` | User/agent financial limits |

### Database Commands

```bash
# Push schema changes to database
npm run db:push

# Generate migration files (if using migrations)
npx drizzle-kit generate

# Open Drizzle Studio (database GUI)
npx drizzle-kit studio
```

---

## Running the Application

### Development Mode

```bash
npm run dev
```

- Frontend: Hot reload enabled via Vite
- Backend: Auto-restart via tsx
- URL: http://localhost:5000

### Production Mode

```bash
# Build the application
npm run build

# Start production server
npm start
```

### TypeScript Check

```bash
npm run check
```

---

## Production Deployment

### Option 1: Docker (Recommended)

```bash
# Build production image
docker build -t vex:latest .

# Run with environment variables
docker run -d \
  -p 5000:5000 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/db \
  -e SESSION_SECRET=your-secret \
  --name vex-app \
  vex:latest
```

### Option 2: Node.js Direct

1. **Build the application**

```bash
npm run build
```

2. **Set environment variables**

```bash
export NODE_ENV=production
export DATABASE_URL=postgresql://...
export SESSION_SECRET=...
```

3. **Start the server**

```bash
npm start
```

### Option 3: PM2 Process Manager

```bash
# Install PM2 globally
npm install -g pm2

# Start with ecosystem config
pm2 start ecosystem.config.js

# Or start directly
pm2 start npm --name "vex" -- start

# Save process list
pm2 save

# Setup startup script
pm2 startup
```

### SSL/TLS Configuration

For production with HTTPS, use the included Nginx configuration:

```bash
# Start with Nginx profile
docker-compose --profile with-nginx up -d
```

Place your SSL certificates in `docker/ssl/`:
- `docker/ssl/cert.pem`
- `docker/ssl/key.pem`

---

## API Documentation

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/admin/login` | Admin login |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/logout` | User logout |

### User Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user/preferences` | Get user preferences |
| PATCH | `/api/user/preferences` | Update preferences |
| PATCH | `/api/user/status` | Update online status |
| GET | `/api/user/balance` | Get wallet balance |

### Transaction Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transactions` | Get transaction history |
| POST | `/api/deposit` | Request deposit |
| POST | `/api/withdraw` | Request withdrawal |

### P2P Trading Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/p2p/trades` | Get available trades |
| POST | `/api/p2p/trades` | Create new trade |
| PATCH | `/api/p2p/trades/:id` | Update trade status |

### Game Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/games` | Get all games |
| GET | `/api/games/:id` | Get game details |
| POST | `/api/games/:id/session` | Start game session |

### Admin Endpoints

All admin endpoints require Bearer token authentication:

```
Authorization: Bearer <admin-token>
```

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | List all users |
| GET | `/api/admin/transactions` | List all transactions |
| GET | `/api/admin/stats` | Get platform statistics |
| POST | `/api/admin/broadcast` | Send broadcast message |

---

## Admin Panel

Access the admin panel at `/admin` after logging in with admin credentials.

### Admin Features

- **Dashboard**: Platform statistics and analytics
- **User Management**: View, edit, and manage users
- **Transaction Management**: Approve/reject deposits and withdrawals
- **Agent Management**: Manage agents and commissions
- **Affiliate Management**: Track affiliates and payouts
- **Game Management**: Configure games and limits
- **Payment Methods**: Manage payment options
- **Currencies**: Configure supported currencies
- **Integrations**: Configure external services
- **Audit Logs**: View admin action history
- **Broadcast**: Send messages to all users

### Default Admin Credentials

```
Username: admin
Password: admin123
```

**Important**: Change these credentials immediately after first login!

---

## Security Considerations

1. **Change default credentials** before deploying to production
2. **Use strong SESSION_SECRET** (minimum 32 characters)
3. **Enable HTTPS** in production using Nginx or a reverse proxy
4. **Database backups**: Schedule regular backups
5. **Environment variables**: Never commit `.env` files to version control
6. **Rate limiting**: Configure rate limits for API endpoints
7. **Input validation**: All inputs are validated using Zod schemas

---

## Troubleshooting

### Common Issues

**Database connection failed**
```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Verify connection string
psql $DATABASE_URL -c "SELECT 1"
```

**Port 5000 already in use**
```bash
# Find and kill process
lsof -i :5000
kill -9 <PID>
```

**Build fails**
```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install

# Check TypeScript errors
npm run check
```

**Docker container won't start**
```bash
# Check logs
docker-compose logs app

# Rebuild from scratch
docker-compose down -v
docker-compose up -d --build
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Support

For support, email support@vex-platform.com or open an issue on GitHub.

---

<div align="center">

**Built with ❤️ by VEX Team**

</div>
