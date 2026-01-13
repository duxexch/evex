import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Production-ready pool configuration optimized for Hostinger VPS
const isProduction = process.env.NODE_ENV === "production";

// VPS-optimized pool settings:
// - 50 max connections: suitable for 2-4 core VPS with 4GB+ RAM
// - Scales well up to 20,000+ users with proper caching
// - Each connection uses ~10MB RAM, so 50 = ~500MB for DB pool
const poolConfig: pg.PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  // Connection pool settings optimized for high traffic VPS
  max: parseInt(process.env.DB_POOL_MAX || "50", 10), // Max connections for VPS
  min: parseInt(process.env.DB_POOL_MIN || "5", 10),  // Keep 5 warm connections
  idleTimeoutMillis: 30000,      // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Faster timeout for better UX (5s)
  allowExitOnIdle: false,        // Keep pool alive
  // Statement timeout to prevent long-running queries
  statement_timeout: 30000,      // 30s max query time
  query_timeout: 30000,          // 30s max query time
  // SSL configuration for production
  ssl: isProduction ? {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
  } : undefined,
};

export const pool = new Pool(poolConfig);

// Handle pool errors gracefully
pool.on("error", (err) => {
  console.error("[DB POOL ERROR]", err.message);
  // Don't exit - let the pool recover
});

pool.on("connect", () => {
  if (!isProduction) {
    console.log("[DB] New client connected to pool");
  }
});

export const db = drizzle(pool, { schema });

// Graceful shutdown helper
export async function closePool(): Promise<void> {
  console.log("[DB] Closing connection pool...");
  await pool.end();
  console.log("[DB] Connection pool closed");
}
