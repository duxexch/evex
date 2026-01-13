import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Production-ready pool configuration
const isProduction = process.env.NODE_ENV === "production";
const poolConfig: pg.PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  // Connection pool settings optimized for VPS
  max: parseInt(process.env.DB_POOL_MAX || "20", 10), // Max connections
  min: parseInt(process.env.DB_POOL_MIN || "2", 10),  // Min idle connections
  idleTimeoutMillis: 30000,    // Close idle connections after 30s
  connectionTimeoutMillis: 10000, // Connection timeout 10s
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
