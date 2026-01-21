import React, { useEffect, useState } from "react";
import styles from "./AdminStats.module.css";

interface StatCard {
  id: string;
  icon: string;
  label: string;
  value: string | number;
  change?: {
    value: number;
    type: "increase" | "decrease" | "neutral";
  };
  color: string;
}

interface AdminStatsProps {
  compact?: boolean;
  onStatClick?: (statId: string) => void;
}

const AdminStats: React.FC<AdminStatsProps> = ({ compact = false, onStatClick }) => {
  const [stats, setStats] = useState<StatCard[]>([
    {
      id: "users",
      icon: "👥",
      label: "Total Users",
      value: "2,847",
      change: { value: 12, type: "increase" },
      color: "#3b82f6",
    },
    {
      id: "transactions",
      icon: "💰",
      label: "Daily Transactions",
      value: "$45,230",
      change: { value: 8, type: "increase" },
      color: "#10b981",
    },
    {
      id: "games",
      icon: "🎮",
      label: "Active Games",
      value: "156",
      change: { value: 5, type: "increase" },
      color: "#8b5cf6",
    },
    {
      id: "health",
      icon: "📊",
      label: "System Health",
      value: "98.5%",
      change: { value: 0, type: "neutral" },
      color: "#06b6d4",
    },
    {
      id: "agents",
      icon: "🔧",
      label: "Active Agents",
      value: "34",
      change: { value: 2, type: "increase" },
      color: "#f59e0b",
    },
    {
      id: "complaints",
      icon: "📧",
      label: "Pending Issues",
      value: "12",
      change: { value: 3, type: "decrease" },
      color: "#ef4444",
    },
  ]);

  const [loading, setLoading] = useState(false);

  // Simulate fetching stats
  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        // In production, fetch from /api/admin/monitoring/stats
        await new Promise((resolve) => setTimeout(resolve, 500));
        // Stats already initialized with dummy data
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const displayStats = compact ? stats.slice(0, 4) : stats;

  return (
    <div className={`${styles.container} ${compact ? styles.compact : ""}`}>
      <div className={styles.header}>
        <h2>📈 Dashboard Statistics</h2>
        <span className={styles.timestamp}>Updated just now</span>
      </div>

      <div className={styles.grid}>
        {displayStats.map((stat) => (
          <div
            key={stat.id}
            className={styles.card}
            onClick={() => onStatClick?.(stat.id)}
            style={{ borderLeftColor: stat.color }}
          >
            <div className={styles.cardHeader}>
              <span className={styles.icon}>{stat.icon}</span>
              {stat.change && (
                <div
                  className={`${styles.change} ${
                    styles[`change-${stat.change.type}`]
                  }`}
                >
                  <span className={styles.arrow}>
                    {stat.change.type === "increase"
                      ? "↑"
                      : stat.change.type === "decrease"
                      ? "↓"
                      : "−"}
                  </span>
                  {Math.abs(stat.change.value)}%
                </div>
              )}
            </div>

            <div className={styles.cardContent}>
              <div className={styles.label}>{stat.label}</div>
              <div className={styles.value}>{stat.value}</div>
            </div>

            <div
              className={styles.colorBar}
              style={{ backgroundColor: stat.color }}
            />
          </div>
        ))}
      </div>

      {loading && <div className={styles.loading}>Loading statistics...</div>}
    </div>
  );
};

export default AdminStats;
