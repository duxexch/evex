<!-- PWM Frontend - Next.js Dockerfile -->
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy app files
COPY . .

# Build Next.js
RUN npm run build

EXPOSE 3012

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3012/ || exit 1

# Start the app
CMD ["npm", "start", "--", "-p", "3012"]
