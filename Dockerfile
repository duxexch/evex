# VEX Platform - Docker Image
# صورة Docker لمنصة VEX

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

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

WORKDIR /app

# Install PostgreSQL client for database operations
RUN apk add --no-cache postgresql-client

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Install tsx and drizzle-kit globally for database operations
RUN npm install -g tsx drizzle-kit

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/tsconfig.json ./

# Copy scripts
COPY scripts ./scripts
RUN chmod +x scripts/*.sh 2>/dev/null || true

# Create necessary directories
RUN mkdir -p logs uploads

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

# Start command
CMD ["node", "dist/index.cjs"]
