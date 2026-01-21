import React, { useState, useEffect, useCallback } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import styles from "./PermissionsMatrix.module.css";

interface Permission {
  id: string;
  resource: string;
  action: string;
  description?: string;
  enabled?: boolean;
}

interface Role {
  id: string;
  name: string;
  description: string;
  level: number;
  permissions: Permission[];
  createdAt: Date;
  updatedAt: Date;
}

interface PermissionsMatrixProps {
  onRoleSelect?: (role: Role) => void;
  onPermissionChange?: (roleId: string, permissions: Permission[]) => void;
  readOnly?: boolean;
}

const RESOURCE_ICONS: Record<string, string> = {
  users: "👤",
  transactions: "💰",
  complaints: "📧",
  games: "🎮",
  agents: "🔧",
  settings: "⚙️",
  permissions: "🔐",
  monitoring: "📊",
  logs: "📝",
  finance: "💳",
  affiliates: "🤝",
  system: "🖥️",
};

const ACTION_COLORS: Record<string, string> = {
  view: "#3b82f6",
  create: "#10b981",
  edit: "#f59e0b",
  delete: "#ef4444",
  approve: "#8b5cf6",
  reject: "#f97316",
  moderate: "#ec4899",
  ban: "#991b1b",
  suspend: "#ea580c",
  respond: "#06b6d4",
  resolve: "#059669",
  escalate: "#7c3aed",
  configure: "#6366f1",
  manage: "#14b8a6",
  restart: "#dc2626",
  export: "#4f46e5",
  refund: "#d946ef",
  close: "#64748b",
  save: "#f59e0b",
};

export const PermissionsMatrix: React.FC<PermissionsMatrixProps> = ({
  onRoleSelect,
  onPermissionChange,
  readOnly = false,
}) => {
  const { t } = useLanguage();
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [matrix, setMatrix] = useState<Record<string, string[]>>({});
  const [changes, setChanges] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");

  // Fetch roles and matrix
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rolesRes, matrixRes] = await Promise.all([
        fetch("/api/admin/permissions/roles", {
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        }),
        fetch("/api/admin/permissions/matrix", {
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        }),
      ]);

      if (!rolesRes.ok || !matrixRes.ok) {
        throw new Error("Failed to fetch data");
      }

      const rolesData = await rolesRes.json();
      const matrixData = await matrixRes.json();

      setRoles(rolesData.data || []);
      setMatrix(matrixData.data || {});

      if (rolesData.data && rolesData.data.length > 0) {
        setSelectedRole(rolesData.data[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
      console.error("Error fetching permissions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionToggle = useCallback(
    (resource: string, action: string, enabled: boolean) => {
      if (readOnly) return;

      const key = `${resource}:${action}`;
      const newChanges = new Map(changes);

      if (enabled) {
        newChanges.set(key, true);
      } else {
        newChanges.delete(key);
      }

      setChanges(newChanges);
    },
    [changes, readOnly]
  );

  const handleSaveChanges = async () => {
    if (!selectedRole || changes.size === 0) return;

    try {
      const permissionsToUpdate = [];

      for (const [key, enabled] of changes) {
        const [resource, action] = key.split(":");
        permissionsToUpdate.push({
          resource,
          action,
          enabled,
        });
      }

      const response = await fetch(
        `/api/admin/permissions/roles/${selectedRole.id}/bulk-update`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ permissions: permissionsToUpdate }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update permissions");
      }

      setChanges(new Map());
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
      console.error("Error saving permissions:", err);
    }
  };

  const handleResetChanges = () => {
    setChanges(new Map());
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading permissions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>{error}</div>
        <button onClick={fetchData} className={styles.retryBtn}>
          Retry
        </button>
      </div>
    );
  }

  const filteredMatrix = filter
    ? Object.fromEntries(
        Object.entries(matrix).filter(([resource]) =>
          resource.toLowerCase().includes(filter.toLowerCase())
        )
      )
    : matrix;

  const selectedPermissions = new Set(
    selectedRole?.permissions.map((p) => `${p.resource}:${p.action}`) || []
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>📋 {t("permissions.matrix")}</h2>
        <p>{t("admin.permissions")}</p>
      </div>

      <div className={styles.layout}>
        {/* Roles Panel */}
        <div className={styles.rolesPanel}>
          <h3>{t("permissions.roles")} ({roles.length})</h3>
          <div className={styles.rolesList}>
            {roles.map((role) => (
              <button
                key={role.id}
                className={`${styles.roleItem} ${
                  selectedRole?.id === role.id ? styles.active : ""
                }`}
                onClick={() => {
                  setSelectedRole(role);
                  setChanges(new Map());
                  onRoleSelect?.(role);
                }}
              >
                <div className={styles.roleInfo}>
                  <div className={styles.roleName}>{role.name}</div>
                  <div className={styles.roleDesc}>{role.description}</div>
                  <div className={styles.permCount}>
                    {role.permissions.length} perms
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Matrix Panel */}
        <div className={styles.matrixPanel}>
          {selectedRole && (
            <>
              {/* Role Header */}
              <div className={styles.roleHeader}>
                <div>
                  <h3>{selectedRole.name}</h3>
                  <p>{selectedRole.description}</p>
                </div>
                <div className={styles.badge}>Level {selectedRole.level}</div>
              </div>

              {/* Controls */}
              <div className={styles.controls}>
                <input
                  type="text"
                  placeholder="Filter resources..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className={styles.filterInput}
                />

                {changes.size > 0 && !readOnly && (
                  <div className={styles.actionButtons}>
                    <button
                      onClick={handleSaveChanges}
                      className={styles.saveBtn}
                    >
                      💾 Save ({changes.size})
                    </button>
                    <button
                      onClick={handleResetChanges}
                      className={styles.resetBtn}
                    >
                      ↻ Reset
                    </button>
                  </div>
                )}
              </div>

              {/* Matrix Grid */}
              <div className={styles.matrixGrid}>
                {Object.entries(filteredMatrix).map(([resource, actions]) => (
                  <div key={resource} className={styles.resourceSection}>
                    <div className={styles.resourceHeader}>
                      <span className={styles.icon}>
                        {RESOURCE_ICONS[resource] || "📌"}
                      </span>
                      <span className={styles.resourceName}>{resource}</span>
                      <span className={styles.actionCount}>
                        {
                          actions.filter((a) =>
                            selectedPermissions.has(`${resource}:${a}`)
                          ).length
                        }
                        /{actions.length}
                      </span>
                    </div>

                    <div className={styles.actionsGrid}>
                      {actions.map((action) => {
                        const key = `${resource}:${action}`;
                        const isSelected = selectedPermissions.has(key);
                        const isChanged = changes.has(key);
                        const willEnable =
                          isChanged && changes.get(key) === true;
                        const willDisable =
                          isChanged && changes.get(key) === false;
                        const isFinal = willEnable
                          ? true
                          : willDisable
                          ? false
                          : isSelected;

                        return (
                          <button
                            key={action}
                            onClick={() =>
                              handlePermissionToggle(
                                resource,
                                action,
                                !isFinal
                              )
                            }
                            disabled={readOnly}
                            className={`${styles.actionBtn} ${
                              isFinal ? styles.enabled : ""
                            } ${isChanged ? styles.changed : ""}`}
                            style={{
                              backgroundColor: isFinal
                                ? ACTION_COLORS[action] || "#6b7280"
                                : "transparent",
                              borderColor: ACTION_COLORS[action] || "#6b7280",
                            }}
                            title={`${resource}:${action}`}
                          >
                            {action}
                            {isChanged && (
                              <span className={styles.badge}>
                                {willEnable ? "+" : "−"}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Stats */}
              <div className={styles.stats}>
                <div className={styles.statItem}>
                  <span>Total Permissions:</span>
                  <strong>{selectedRole.permissions.length}</strong>
                </div>
                <div className={styles.statItem}>
                  <span>Resources:</span>
                  <strong>{Object.keys(matrix).length}</strong>
                </div>
                <div className={styles.statItem}>
                  <span>Total Actions:</span>
                  <strong>
                    {Object.values(matrix).reduce((a, b) => a + b.length, 0)}
                  </strong>
                </div>
                {changes.size > 0 && (
                  <div className={styles.statItem}>
                    <span>Pending Changes:</span>
                    <strong className={styles.pending}>{changes.size}</strong>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PermissionsMatrix;
