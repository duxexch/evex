# VEX Platform - Docker Image
# منصة VEX للألعاب والتداول - صورة Docker
# آخر تحديث: يناير 2026

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

# Metadata
LABEL maintainer="VEX Platform Team"
LABEL version="1.0.0"
LABEL description="VEX Gaming & P2P Trading Platform with شاهد واربح (Watch & Win) System"

WORKDIR /app

# Install PostgreSQL client and utilities for database operations
RUN apk add --no-cache postgresql-client curl

# Copy package files
COPY package*.json ./

# Install production dependencies + drizzle-kit for migrations
RUN npm ci --omit=dev && npm install --no-save drizzle-kit tsx

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/tsconfig.json ./

# Copy server source files for scripts that import from server/
COPY --from=builder /app/server ./server

# Copy scripts
COPY scripts ./scripts
RUN chmod +x scripts/*.sh 2>/dev/null || true

# Create necessary directories
RUN mkdir -p logs uploads temp

# Set environment defaults
ENV NODE_ENV=production
ENV PORT=5000
ENV TZ=UTC

# Expose port
EXPOSE 5000

# Health check with proper intervals for production
HEALTHCHECK --interval=30s --timeout=15s --start-period=90s --retries=5 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# Set entrypoint for automatic migrations and startup
ENTRYPOINT ["./scripts/entrypoint.sh"]
