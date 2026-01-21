import React, { useState } from "react";
import { useMonitoring, requestNotificationPermission } from "../hooks/useMonitoring";
import { useLanguage } from "../contexts/LanguageContext";
import styles from "./MonitoringPanel.module.css";

export function MonitoringPanel() {
  const { alerts, metrics, isConnected, alertCount, markAlertAsRead, resolveAlert } =
    useMonitoring();
  const { t } = useLanguage();
  const [showAlerts, setShowAlerts] = useState(false);
  const [filter, setFilter] = useState<"all" | "critical" | "warning" | "info">("all");

  const filteredAlerts = alerts.filter((a) => {
    if (filter === "all") return true;
    return a.severity === filter;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "#ef4444";
      case "warning":
        return "#f59e0b";
      case "info":
        return "#3b82f6";
      default:
        return "#6b7280";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return "🔴";
      case "warning":
        return "🟡";
      case "info":
        return "🔵";
      default:
        return "⚪";
    }
  };

  return (
    <div className={styles.monitoringPanel}>
      {/* Top Bar */}
      <div className={styles.topBar}>
        <div className={styles.statusIndicator}>
          <div
            className={`${styles.dot} ${isConnected ? styles.connected : styles.disconnected}`}
          />
          <span>{isConnected ? t("monitoring.metrics") : t("msg.operationFailed")}</span>
        </div>

        {/* Alert Badges */}
        <div className={styles.alertBadges}>
          {alertCount.critical > 0 && (
            <button
              className={`${styles.badge} ${styles.critical}`}
              onClick={() => {
                setFilter("critical");
                setShowAlerts(true);
              }}
            >
              🔴 {alertCount.critical}
            </button>
          )}
          {alertCount.warning > 0 && (
            <button
              className={`${styles.badge} ${styles.warning}`}
              onClick={() => {
                setFilter("warning");
                setShowAlerts(true);
              }}
            >
              🟡 {alertCount.warning}
            </button>
          )}
          {alertCount.info > 0 && (
            <button
              className={`${styles.badge} ${styles.info}`}
              onClick={() => {
                setFilter("info");
                setShowAlerts(true);
              }}
            >
              🔵 {alertCount.info}
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className={styles.actions}>
          <button
            className={styles.iconBtn}
            onClick={() => requestNotificationPermission()}
            title={t("notifications.title")}
          >
            🔔
          </button>
          <button
            className={styles.iconBtn}
            onClick={() => setShowAlerts(!showAlerts)}
            title={t("common.settings")}
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Metrics Display */}
      {metrics && (
        <div className={styles.metricsRow}>
          <div className={styles.metric}>
            <span className={styles.label}>{t("stats.totalUsers")}</span>
            <span className={styles.value}>{metrics.activeUsers}</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.label}>{t("stats.activeGames")}</span>
            <span className={styles.value}>{metrics.activeChallenges}</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.label}>{t("admin.transactions")}</span>
            <span className={styles.value}>{metrics.pendingTransactions}</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.label}>{t("admin.complaints")}</span>
            <span className={styles.value}>{metrics.pendingComplaints}</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.label}>{t("stats.systemHealth")}</span>
            <div className={styles.healthBar}>
              <div
                className={styles.healthFill}
                style={{
                  width: `${metrics.systemHealth}%`,
                  backgroundColor:
                    metrics.systemHealth > 80
                      ? "#10b981"
                      : metrics.systemHealth > 50
                        ? "#f59e0b"
                        : "#ef4444",
                }}
              />
            </div>
            <span className={styles.healthText}>{metrics.systemHealth.toFixed(0)}%</span>
          </div>
        </div>
      )}

      {/* Alerts Panel */}
      {showAlerts && (
        <div className={styles.alertsPanel}>
          <div className={styles.alertsHeader}>
            <h3>{t("monitoring.alerts")} ({filteredAlerts.length})</h3>
            <div className={styles.filterButtons}>
              {(["all", "critical", "warning", "info"] as const).map((f) => (
                <button
                  key={f}
                  className={`${styles.filterBtn} ${filter === f ? styles.active : ""}`}
                  onClick={() => setFilter(f)}
                >
                  {f === "all" ? "All" : f === "critical" ? t("monitoring.criticalAlert") : f === "warning" ? t("monitoring.warning") : t("monitoring.info")}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.alertsList}>
            {filteredAlerts.length === 0 ? (
              <div className={styles.empty}>{t("notifications.empty")}</div>
            ) : (
              filteredAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`${styles.alertItem} ${alert.isRead ? styles.read : ""}`}
                  style={{
                    borderLeftColor: getSeverityColor(alert.severity),
                  }}
                >
                  <div className={styles.alertIcon}>{getSeverityIcon(alert.severity)}</div>
                  <div className={styles.alertContent}>
                    <div className={styles.alertTitle}>{alert.title}</div>
                    <div className={styles.alertMessage}>{alert.message}</div>
                    <div className={styles.alertTime}>
                      {new Date(alert.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className={styles.alertActions}>
                    {!alert.isRead && (
                      <button
                        className={styles.actionBtn}
                        onClick={() => markAlertAsRead(alert.id)}
                        title="Mark as read"
                      >
                        ✓
                      </button>
                    )}
                    <button
                      className={styles.actionBtn}
                      onClick={() => resolveAlert(alert.id)}
                      title="Resolve"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MonitoringPanel;
