import type { Express, Response } from "express";
import { storage } from "../storage";
import { authMiddleware, type AuthRequest } from "./middleware";
import { eq } from "drizzle-orm";

// Alert severity levels
export type AlertSeverity = "critical" | "warning" | "info";
export type AlertType = 
  | "fraud_detected"
  | "high_transaction"
  | "failed_login"
  | "system_health"
  | "new_complaint"
  | "pending_transaction"
  | "user_violation"
  | "unusual_activity";

// Alert interface
export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  details?: Record<string, any>;
  userId?: string;
  entityId?: string;
  entityType?: string;
  isRead: boolean;
  createdAt: Date;
  resolvedAt?: Date;
}

// Real-time monitoring metrics
export interface SystemMetrics {
  activeUsers: number;
  activeChallenges: number;
  pendingTransactions: number;
  pendingComplaints: number;
  systemHealth: number; // 0-100%
  cpuUsage: number; // 0-100%
  memoryUsage: number; // 0-100%
  databaseSize: number; // in MB
  timestamp: Date;
}

// Alert store (in-memory for real-time)
const alertsStore: Map<string, Alert> = new Map();
let alertCounter = 0;

// Metrics store
let currentMetrics: SystemMetrics = {
  activeUsers: 0,
  activeChallenges: 0,
  pendingTransactions: 0,
  pendingComplaints: 0,
  systemHealth: 100,
  cpuUsage: 0,
  memoryUsage: 0,
  databaseSize: 0,
  timestamp: new Date(),
};

// Helper: Create alert
export function createAlert(
  type: AlertType,
  severity: AlertSeverity,
  title: string,
  message: string,
  options?: {
    userId?: string;
    entityId?: string;
    entityType?: string;
    details?: Record<string, any>;
  }
): Alert {
  const id = `alert_${++alertCounter}`;
  const alert: Alert = {
    id,
    type,
    severity,
    title,
    message,
    details: options?.details,
    userId: options?.userId,
    entityId: options?.entityId,
    entityType: options?.entityType,
    isRead: false,
    createdAt: new Date(),
  };

  alertsStore.set(id, alert);

  // Auto-remove old alerts after 1 hour
  setTimeout(() => {
    alertsStore.delete(id);
  }, 60 * 60 * 1000);

  return alert;
}

// Helper: Update metrics
export async function updateMetrics() {
  try {
    // Get active users count (example: users with activity in last 5 minutes)
    // This would be replaced with actual queries
    const activeUsers = Math.floor(Math.random() * 500) + 100;
    
    // Get pending transactions count
    const pendingTransactions = Math.floor(Math.random() * 20);
    
    // Get pending complaints
    const pendingComplaints = Math.floor(Math.random() * 15);
    
    // Get system metrics
    const cpuUsage = Math.floor(Math.random() * 80) + 10;
    const memoryUsage = Math.floor(Math.random() * 85) + 15;

    currentMetrics = {
      activeUsers,
      activeChallenges: Math.floor(Math.random() * 50),
      pendingTransactions,
      pendingComplaints,
      systemHealth: Math.max(100 - cpuUsage * 0.3 - memoryUsage * 0.2, 0),
      cpuUsage,
      memoryUsage,
      databaseSize: Math.floor(Math.random() * 5000) + 500,
      timestamp: new Date(),
    };

    // Generate alerts based on metrics
    if (memoryUsage > 90) {
      createAlert(
        "system_health",
        "critical",
        "High Memory Usage",
        `Memory usage is ${memoryUsage}% - approaching critical level`,
        { details: { memoryUsage } }
      );
    }

    if (cpuUsage > 85) {
      createAlert(
        "system_health",
        "critical",
        "High CPU Usage",
        `CPU usage is ${cpuUsage}% - system may be under heavy load`,
        { details: { cpuUsage } }
      );
    }

    if (pendingTransactions > 50) {
      createAlert(
        "pending_transaction",
        "warning",
        "High Pending Transactions",
        `${pendingTransactions} transactions are pending approval`,
        { details: { count: pendingTransactions } }
      );
    }

    if (pendingComplaints > 20) {
      createAlert(
        "new_complaint",
        "warning",
        "Backlog of Complaints",
        `${pendingComplaints} complaints awaiting assignment`,
        { details: { count: pendingComplaints } }
      );
    }
  } catch (error) {
    console.error("Error updating metrics:", error);
  }
}

// Initialize periodic metrics update (every 30 seconds)
export function initializeMonitoring() {
  setInterval(updateMetrics, 30 * 1000);
  // Initial update
  updateMetrics();
}

// ==================== ROUTES ====================

export function registerMonitoringRoutes(app: Express) {
  // Get current alerts
  app.get(
    "/api/admin/monitoring/alerts",
    authMiddleware as any,
    (req: AuthRequest, res: Response) => {
      try {
        const user = req.user;
        if (!user || user.role !== "admin") {
          return res.status(403).json({ error: "Forbidden" });
        }

        // Convert map to array and sort by severity
        const alerts = Array.from(alertsStore.values())
          .sort((a, b) => {
            const severityOrder = { critical: 0, warning: 1, info: 2 };
            return severityOrder[a.severity] - severityOrder[b.severity];
          })
          .slice(0, 50); // Return last 50 alerts

        res.json({
          total: alertsStore.size,
          alerts,
          critical: alerts.filter((a) => a.severity === "critical").length,
          warning: alerts.filter((a) => a.severity === "warning").length,
          info: alerts.filter((a) => a.severity === "info").length,
        });
      } catch (error) {
        console.error("Get alerts error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // Get system metrics
  app.get(
    "/api/admin/monitoring/metrics",
    authMiddleware as any,
    (req: AuthRequest, res: Response) => {
      try {
        const user = req.user;
        if (!user || user.role !== "admin") {
          return res.status(403).json({ error: "Forbidden" });
        }

        res.json(currentMetrics);
      } catch (error) {
        console.error("Get metrics error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // Mark alert as read
  app.post(
    "/api/admin/monitoring/alerts/:id/read",
    authMiddleware as any,
    (req: AuthRequest, res: Response) => {
      try {
        const user = req.user;
        if (!user || user.role !== "admin") {
          return res.status(403).json({ error: "Forbidden" });
        }

        const { id } = req.params;
        const alert = alertsStore.get(id);

        if (!alert) {
          return res.status(404).json({ error: "Alert not found" });
        }

        alert.isRead = true;
        res.json({ message: "Alert marked as read", alert });
      } catch (error) {
        console.error("Mark alert read error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // Resolve alert
  app.post(
    "/api/admin/monitoring/alerts/:id/resolve",
    authMiddleware as any,
    (req: AuthRequest, res: Response) => {
      try {
        const user = req.user;
        if (!user || user.role !== "admin") {
          return res.status(403).json({ error: "Forbidden" });
        }

        const { id } = req.params;
        const alert = alertsStore.get(id);

        if (!alert) {
          return res.status(404).json({ error: "Alert not found" });
        }

        alert.resolvedAt = new Date();
        res.json({ message: "Alert resolved", alert });
      } catch (error) {
        console.error("Resolve alert error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // Get health check
  app.get("/api/admin/monitoring/health", (req: Response, res: any) => {
    try {
      res.json({
        status: "ok",
        timestamp: new Date(),
        uptime: process.uptime(),
        metrics: currentMetrics,
      });
    } catch (error) {
      console.error("Health check error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get alerts history/logs
  app.get(
    "/api/admin/monitoring/alerts/history",
    authMiddleware as any,
    (req: AuthRequest, res: Response) => {
      try {
        const user = req.user;
        if (!user || user.role !== "admin") {
          return res.status(403).json({ error: "Forbidden" });
        }

        const { type, severity, limit = "100" } = req.query;
        let alerts = Array.from(alertsStore.values());

        if (type) {
          alerts = alerts.filter((a) => a.type === type);
        }

        if (severity) {
          alerts = alerts.filter((a) => a.severity === severity);
        }

        alerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        res.json({
          total: alerts.length,
          alerts: alerts.slice(0, parseInt(limit as string)),
        });
      } catch (error) {
        console.error("Get alerts history error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // Get system statistics
  app.get(
    "/api/admin/monitoring/stats",
    authMiddleware as any,
    (req: AuthRequest, res: Response) => {
      try {
        const user = req.user;
        if (!user || user.role !== "admin") {
          return res.status(403).json({ error: "Forbidden" });
        }

        const alertsByType: Record<AlertType, number> = {
          fraud_detected: 0,
          high_transaction: 0,
          failed_login: 0,
          system_health: 0,
          new_complaint: 0,
          pending_transaction: 0,
          user_violation: 0,
          unusual_activity: 0,
        };

        for (const alert of alertsStore.values()) {
          alertsByType[alert.type]++;
        }

        res.json({
          alertsByType,
          totalAlerts: alertsStore.size,
          activeMetrics: currentMetrics,
          alertsByHour: generateAlertsByHour(),
        });
      } catch (error) {
        console.error("Get stats error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );
}

// Helper: Generate alerts by hour (for charts)
function generateAlertsByHour(): Record<string, number> {
  const result: Record<string, number> = {};
  const now = new Date();

  for (let i = 23; i >= 0; i--) {
    const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
    const key = hour.toISOString().split("T")[0] + " " + String(hour.getHours()).padStart(2, "0") + ":00";
    result[key] = Math.floor(Math.random() * 20);
  }

  return result;
}
