import React, { useState, useEffect } from "react";
import styles from "./AdminDashboard.module.css";
import MonitoringPanel from "../MonitoringPanel";
import PermissionsMatrix from "../PermissionsMatrix";
import AdminStats from "./AdminStats";
import AdminCharts from "./AdminCharts";
import AdminQuickActions from "./AdminQuickActions";
import { useLanguage } from "../../contexts/LanguageContext";
import { LanguageSwitcherDropdown } from "../LanguageSwitcher";

type AdminView = "dashboard" | "monitoring" | "permissions" | "users" | "transactions" | "complaints";

interface AdminDashboardProps {
  initialView?: AdminView;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  initialView = "dashboard",
}) => {
  const [activeView, setActiveView] = useState<AdminView>(initialView);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { t } = useLanguage();

  const views: Record<AdminView, { icon: string; label: string; title: string }> = {
    dashboard: {
      icon: "📊",
      label: t("admin.dashboard"),
      title: t("admin.title"),
    },
    monitoring: {
      icon: "🔔",
      label: t("admin.monitoring"),
      title: t("monitoring.systemStatus"),
    },
    permissions: {
      icon: "🔐",
      label: t("admin.permissions"),
      title: t("permissions.matrix"),
    },
    users: {
      icon: "👥",
      label: t("admin.users"),
      title: t("admin.users"),
    },
    transactions: {
      icon: "💰",
      label: t("admin.transactions"),
      title: t("admin.transactions"),
    },
    complaints: {
      icon: "📧",
      label: t("admin.complaints"),
      title: t("admin.complaints"),
    },
  };

  const renderContent = () => {
    switch (activeView) {
      case "dashboard":
        return (
          <div className={styles.dashboardContent}>
            <AdminStats />
            <AdminQuickActions
              onAction={(actionId) => {
                if (actionId === "logs") setActiveView("monitoring");
                if (actionId === "settings") setActiveView("permissions");
              }}
            />
            <AdminCharts />
          </div>
        );
      case "monitoring":
        return <MonitoringPanel />;
      case "permissions":
        return <PermissionsMatrix readOnly={false} />;
      case "users":
        return (
          <div className={styles.placeholder}>
            <div className={styles.icon}>👥</div>
            <h3>{t("admin.users")}</h3>
            <p>{t("common.loading")}</p>
          </div>
        );
      case "transactions":
        return (
          <div className={styles.placeholder}>
            <div className={styles.icon}>💰</div>
            <h3>{t("admin.transactions")}</h3>
            <p>{t("common.loading")}</p>
          </div>
        );
      case "complaints":
        return (
          <div className={styles.placeholder}>
            <div className={styles.icon}>📧</div>
            <h3>{t("admin.complaints")}</h3>
            <p>{t("common.loading")}</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={styles.container}>
      {/* Sidebar */}
      <aside
        className={`${styles.sidebar} ${sidebarOpen ? styles.open : styles.closed}`}
      >
        <div className={styles.sidebarHeader}>
          <div className={styles.logo}>🎮 VEX Admin</div>
          <button
            className={styles.toggleBtn}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? "Collapse" : "Expand"}
          >
            {sidebarOpen ? "◀" : "▶"}
          </button>
        </div>

        <nav className={styles.nav}>
          {Object.entries(views).map(([key, view]) => (
            <button
              key={key}
              className={`${styles.navItem} ${
                activeView === key ? styles.active : ""
              }`}
              onClick={() => setActiveView(key as AdminView)}
              title={view.label}
            >
              <span className={styles.icon}>{view.icon}</span>
              {sidebarOpen && <span className={styles.label}>{view.label}</span>}
            </button>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <button className={styles.logoutBtn} title={t("common.logout")}>
            🚪
            {sidebarOpen && <span>{t("common.logout")}</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={styles.main}>
        {/* Top Bar */}
        <header className={styles.topBar}>
          <button
            className={styles.menuBtn}
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            ☰
          </button>

          <div className={styles.breadcrumb}>
            <span className={styles.icon}>{views[activeView].icon}</span>
            <h1>{views[activeView].title}</h1>
          </div>

          <div className={styles.userInfo}>
            <LanguageSwitcherDropdown />
            <div className={styles.avatar}>👤</div>
            <div className={styles.details}>
              <div className={styles.name}>{t("common.profile")}</div>
              <div className={styles.role}>Super Admin</div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className={styles.content}>{renderContent()}</div>
      </main>
    </div>
  );
};

export default AdminDashboard;
