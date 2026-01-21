import React, { useState } from "react";
import styles from "./AdminQuickActions.module.css";

interface QuickAction {
  id: string;
  icon: string;
  label: string;
  description: string;
  color: string;
  action: () => void | Promise<void>;
}

interface AdminQuickActionsProps {
  onAction?: (actionId: string) => void;
}

const AdminQuickActions: React.FC<AdminQuickActionsProps> = ({ onAction }) => {
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const actions: QuickAction[] = [
    {
      id: "broadcast",
      icon: "📢",
      label: "Send Broadcast",
      description: "Send announcement to all users",
      color: "#3b82f6",
      action: async () => {
        setLoading("broadcast");
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setToast({ message: "Broadcast queued successfully", type: "success" });
        setLoading(null);
      },
    },
    {
      id: "restart",
      icon: "🔄",
      label: "System Restart",
      description: "Restart background services",
      color: "#f59e0b",
      action: async () => {
        setLoading("restart");
        await new Promise((resolve) => setTimeout(resolve, 1500));
        setToast({ message: "System restart initiated", type: "success" });
        setLoading(null);
      },
    },
    {
      id: "backup",
      icon: "💾",
      label: "Database Backup",
      description: "Create system backup",
      color: "#10b981",
      action: async () => {
        setLoading("backup");
        await new Promise((resolve) => setTimeout(resolve, 2000));
        setToast({ message: "Backup completed successfully", type: "success" });
        setLoading(null);
      },
    },
    {
      id: "report",
      icon: "📋",
      label: "Generate Report",
      description: "Export analytics report",
      color: "#8b5cf6",
      action: async () => {
        setLoading("report");
        await new Promise((resolve) => setTimeout(resolve, 1500));
        setToast({ message: "Report generated and downloaded", type: "success" });
        setLoading(null);
      },
    },
    {
      id: "logs",
      icon: "📝",
      label: "View Logs",
      description: "Check system logs",
      color: "#06b6d4",
      action: () => {
        onAction?.("logs");
      },
    },
    {
      id: "settings",
      icon: "⚙️",
      label: "Settings",
      description: "Configure system settings",
      color: "#ef4444",
      action: () => {
        onAction?.("settings");
      },
    },
  ];

  const handleAction = async (action: QuickAction) => {
    try {
      await action.action();
      onAction?.(action.id);
    } catch (error) {
      setToast({
        message: `Error executing ${action.label}`,
        type: "error",
      });
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>⚡ Quick Actions</h2>
        <span className={styles.subtitle}>Common admin operations</span>
      </div>

      <div className={styles.grid}>
        {actions.map((action) => (
          <button
            key={action.id}
            className={styles.actionCard}
            onClick={() => handleAction(action)}
            disabled={loading !== null}
            style={{ "--color": action.color } as any}
          >
            <div className={styles.cardContent}>
              <div className={styles.icon}>{action.icon}</div>
              <div className={styles.text}>
                <div className={styles.label}>{action.label}</div>
                <div className={styles.description}>{action.description}</div>
              </div>
              {loading === action.id && (
                <div className={styles.loader}>
                  <div className={styles.spinner} />
                </div>
              )}
            </div>
            <div className={styles.arrow}>→</div>
          </button>
        ))}
      </div>

      {toast && (
        <div className={`${styles.toast} ${styles[`toast-${toast.type}`]}`}>
          <span className={styles.toastIcon}>
            {toast.type === "success" ? "✓" : "✕"}
          </span>
          {toast.message}
          <button
            className={styles.toastClose}
            onClick={() => setToast(null)}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminQuickActions;
