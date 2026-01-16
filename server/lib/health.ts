/**
 * Platform Health Dashboard & Monitoring
 * 
 * Provides comprehensive health monitoring:
 * - System metrics (CPU, memory, uptime)
 * - Database health with latency
 * - Circuit breaker status
 * - Recent error tracking
 * - Alerting thresholds
 */

import os from 'os';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { getAllCircuitBreakerStats, CircuitState } from './circuit-breaker';
import { logger } from './logger';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
}

interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    loadAverage: number[];
  };
  process: {
    pid: number;
    uptime: number;
    nodeVersion: string;
  };
}

interface DatabaseHealth {
  connected: boolean;
  latencyMs: number;
  poolStats?: {
    idle: number;
    total: number;
    waiting: number;
  };
}

interface ServiceHealth {
  circuitBreakers: Record<string, { state: string; failures: number }>;
  recentErrors: number;
  activeConnections: number;
}

export interface HealthReport {
  status: HealthStatus;
  system: SystemMetrics;
  database: DatabaseHealth;
  services: ServiceHealth;
  alerts: Alert[];
}

interface Alert {
  level: 'warning' | 'critical';
  component: string;
  message: string;
  timestamp: string;
}

// Alert thresholds
const THRESHOLDS = {
  memoryWarning: 80, // %
  memoryCritical: 95, // %
  dbLatencyWarning: 100, // ms
  dbLatencyCritical: 500, // ms
  errorRateWarning: 10, // per minute
  errorRateCritical: 50, // per minute
};

// Recent errors tracking
const recentErrors: { timestamp: number; message: string }[] = [];
const ERROR_WINDOW_MS = 60000; // 1 minute

export function trackError(message: string): void {
  const now = Date.now();
  recentErrors.push({ timestamp: now, message });
  
  // Clean up old errors
  const cutoff = now - ERROR_WINDOW_MS;
  while (recentErrors.length > 0 && recentErrors[0].timestamp < cutoff) {
    recentErrors.shift();
  }
}

function getRecentErrorCount(): number {
  const cutoff = Date.now() - ERROR_WINDOW_MS;
  return recentErrors.filter(e => e.timestamp >= cutoff).length;
}

async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    const latencyMs = Date.now() - start;
    
    return {
      connected: true,
      latencyMs,
      // Pool stats would require access to the underlying pool
    };
  } catch (error) {
    return {
      connected: false,
      latencyMs: Date.now() - start
    };
  }
}

function getSystemMetrics(): SystemMetrics {
  const memUsage = process.memoryUsage();
  const totalMem = os.totalmem();
  const usedMem = memUsage.heapUsed + memUsage.external;
  
  return {
    memory: {
      used: Math.round(usedMem / 1024 / 1024), // MB
      total: Math.round(totalMem / 1024 / 1024), // MB
      percentage: Math.round((usedMem / totalMem) * 100)
    },
    cpu: {
      loadAverage: os.loadavg()
    },
    process: {
      pid: process.pid,
      uptime: Math.round(process.uptime()),
      nodeVersion: process.version
    }
  };
}

function getServiceHealth(): ServiceHealth {
  const cbStats = getAllCircuitBreakerStats();
  const circuitBreakers: Record<string, { state: string; failures: number }> = {};
  
  Object.entries(cbStats).forEach(([name, stats]) => {
    circuitBreakers[name] = {
      state: stats.state,
      failures: stats.failures
    };
  });

  return {
    circuitBreakers,
    recentErrors: getRecentErrorCount(),
    activeConnections: 0 // Would need WebSocket server reference
  };
}

function generateAlerts(
  system: SystemMetrics,
  database: DatabaseHealth,
  services: ServiceHealth
): Alert[] {
  const alerts: Alert[] = [];
  const timestamp = new Date().toISOString();

  // Memory alerts
  if (system.memory.percentage >= THRESHOLDS.memoryCritical) {
    alerts.push({
      level: 'critical',
      component: 'memory',
      message: `Memory usage at ${system.memory.percentage}%`,
      timestamp
    });
  } else if (system.memory.percentage >= THRESHOLDS.memoryWarning) {
    alerts.push({
      level: 'warning',
      component: 'memory',
      message: `Memory usage at ${system.memory.percentage}%`,
      timestamp
    });
  }

  // Database alerts
  if (!database.connected) {
    alerts.push({
      level: 'critical',
      component: 'database',
      message: 'Database connection failed',
      timestamp
    });
  } else if (database.latencyMs >= THRESHOLDS.dbLatencyCritical) {
    alerts.push({
      level: 'critical',
      component: 'database',
      message: `Database latency ${database.latencyMs}ms exceeds threshold`,
      timestamp
    });
  } else if (database.latencyMs >= THRESHOLDS.dbLatencyWarning) {
    alerts.push({
      level: 'warning',
      component: 'database',
      message: `Database latency ${database.latencyMs}ms is elevated`,
      timestamp
    });
  }

  // Circuit breaker alerts
  Object.entries(services.circuitBreakers).forEach(([name, cb]) => {
    if (cb.state === CircuitState.OPEN) {
      alerts.push({
        level: 'critical',
        component: `circuit-${name}`,
        message: `Circuit breaker ${name} is OPEN`,
        timestamp
      });
    } else if (cb.state === CircuitState.HALF_OPEN) {
      alerts.push({
        level: 'warning',
        component: `circuit-${name}`,
        message: `Circuit breaker ${name} is recovering`,
        timestamp
      });
    }
  });

  // Error rate alerts
  if (services.recentErrors >= THRESHOLDS.errorRateCritical) {
    alerts.push({
      level: 'critical',
      component: 'errors',
      message: `${services.recentErrors} errors in last minute`,
      timestamp
    });
  } else if (services.recentErrors >= THRESHOLDS.errorRateWarning) {
    alerts.push({
      level: 'warning',
      component: 'errors',
      message: `${services.recentErrors} errors in last minute`,
      timestamp
    });
  }

  return alerts;
}

function determineOverallStatus(
  database: DatabaseHealth,
  alerts: Alert[]
): 'healthy' | 'degraded' | 'unhealthy' {
  if (!database.connected) {
    return 'unhealthy';
  }

  const hasCritical = alerts.some(a => a.level === 'critical');
  if (hasCritical) {
    return 'unhealthy';
  }

  const hasWarning = alerts.some(a => a.level === 'warning');
  if (hasWarning) {
    return 'degraded';
  }

  return 'healthy';
}

export async function getHealthReport(): Promise<HealthReport> {
  const [database, system] = await Promise.all([
    checkDatabaseHealth(),
    Promise.resolve(getSystemMetrics())
  ]);

  const services = getServiceHealth();
  const alerts = generateAlerts(system, database, services);
  const overallStatus = determineOverallStatus(database, alerts);

  const report: HealthReport = {
    status: {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: system.process.uptime,
      version: process.env.npm_package_version || '1.0.0'
    },
    system,
    database,
    services,
    alerts
  };

  // Log if unhealthy
  if (overallStatus === 'unhealthy') {
    logger.error('Health check: UNHEALTHY', undefined, {
      alerts: alerts.filter(a => a.level === 'critical')
    });
  } else if (overallStatus === 'degraded') {
    logger.warn('Health check: DEGRADED', {
      alerts: alerts.filter(a => a.level === 'warning')
    });
  }

  return report;
}

// Quick health check for load balancers
export async function quickHealthCheck(): Promise<{ ok: boolean; db: boolean }> {
  try {
    await db.execute(sql`SELECT 1`);
    return { ok: true, db: true };
  } catch {
    return { ok: false, db: false };
  }
}

// Express middleware to track errors
export function errorTracker() {
  return (err: any, req: any, res: any, next: (err?: any) => void) => {
    trackError(err.message || 'Unknown error');
    next(err);
  };
}
