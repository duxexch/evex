// @ts-nocheck
import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { v4 as uuid } from "uuid";

export function registerPermissionsRoutes(app: Router) {
  const router = Router();

  /**
   * Get all roles with their permissions
   * GET /api/admin/permissions/roles
   */
  router.get("/roles", async (req: Request, res: Response) => {
    try {
      const roles = await (storage as any).listAdminRoles();
      
      // Get permissions for each role
      const rolesWithPermissions = await Promise.all(
        roles.map(async (role: any) => {
          const permissions = await (storage as any).listAdminPermissions(role.id);
          return {
            id: role.id,
            name: role.name,
            description: role.description,
            level: role.level,
            permissions: permissions.map((p: any) => ({
              id: p.id,
              resource: p.resource,
              action: p.action,
              description: p.description,
            })),
            createdAt: role.createdAt,
            updatedAt: role.updatedAt,
          };
        })
      );

      res.json({
        success: true,
        data: rolesWithPermissions,
      });
    } catch (error) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * Get permissions matrix (all resources and actions)
   * GET /api/admin/permissions/matrix
   */
  router.get("/matrix", async (req: Request, res: Response) => {
    try {
      // Define all available resources and actions
      const matrix = {
        users: ["view", "create", "edit", "delete", "ban", "suspend"],
        transactions: ["view", "edit", "approve", "reject", "refund"],
        complaints: ["view", "respond", "resolve", "escalate", "close"],
        games: ["view", "create", "edit", "delete", "moderate", "configure"],
        agents: ["view", "create", "edit", "delete", "manage"],
        settings: ["view", "edit", "save"],
        permissions: ["view", "edit"],
        monitoring: ["view", "export"],
        logs: ["view", "export", "delete"],
        finance: ["view", "edit", "approve", "export"],
        affiliates: ["view", "create", "edit", "delete"],
        system: ["view", "edit", "restart"],
      };

      res.json({
        success: true,
        data: matrix,
      });
    } catch (error) {
      console.error("Error fetching permissions matrix:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * Get specific role with permissions
   * GET /api/admin/permissions/roles/:roleId
   */
  router.get("/roles/:roleId", async (req: Request, res: Response) => {
    try {
      const { roleId } = req.params;

      const role = await (storage as any).getAdminRole(roleId);
      if (!role) {
        return res.status(404).json({ error: "Role not found" });
      }

      const permissions = await (storage as any).listAdminPermissions(roleId);

      res.json({
        success: true,
        data: {
          id: role.id,
          name: role.name,
          description: role.description,
          level: role.level,
          permissions: permissions.map((p: any) => ({
            id: p.id,
            resource: p.resource,
            action: p.action,
            description: p.description,
            enabled: true,
          })),
        },
      });
    } catch (error) {
      console.error("Error fetching role:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * Create new permission
   * POST /api/admin/permissions
   */
  router.post("/", async (req: Request, res: Response) => {
    try {
      const { roleId, resource, action, description } = req.body;

      if (!roleId || !resource || !action) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const permission = await (storage as any).createAdminPermission({
        id: uuid(),
        roleId,
        resource,
        action,
        description: description || "",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      res.json({
        success: true,
        data: permission,
        message: "Permission created successfully",
      });
    } catch (error) {
      console.error("Error creating permission:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * Update permission
   * PUT /api/admin/permissions/:permissionId
   */
  router.put("/:permissionId", async (req: Request, res: Response) => {
    try {
      const { permissionId } = req.params;
      const { enabled, description } = req.body;

      const updated = await (storage as any).updateAdminPermission(permissionId, {
        description: description !== undefined ? description : undefined,
        updatedAt: new Date(),
      });

      if (!updated) {
        return res.status(404).json({ error: "Permission not found" });
      }

      res.json({
        success: true,
        data: updated,
        message: "Permission updated successfully",
      });
    } catch (error) {
      console.error("Error updating permission:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * Delete permission
   * DELETE /api/admin/permissions/:permissionId
   */
  router.delete("/:permissionId", async (req: Request, res: Response) => {
    try {
      const { permissionId } = req.params;

      // Check if permission exists
      const existing = await (storage as any).getAdminPermission(permissionId);
      if (!existing) {
        return res.status(404).json({ error: "Permission not found" });
      }

      res.json({
        success: true,
        message: "Permission deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting permission:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * Bulk update permissions for a role
   * POST /api/admin/permissions/roles/:roleId/bulk-update
   */
  router.post("/roles/:roleId/bulk-update", async (req: Request, res: Response) => {
    try {
      const { roleId } = req.params;
      const { permissions } = req.body;

      if (!Array.isArray(permissions)) {
        return res.status(400).json({ error: "Invalid permissions format" });
      }

      // Get existing permissions for this role
      const existing = await (storage as any).listAdminPermissions(roleId);
      const existingMap = new Map(
        existing.map((p: any) => [`${p.resource}:${p.action}`, p])
      );

      // Process updates
      const created = [];
      const updated = [];

      for (const perm of permissions) {
        const key = `${perm.resource}:${perm.action}`;
        const exists = existingMap.get(key);

        if (perm.enabled && !exists) {
          // Create new permission
          const newPerm = await (storage as any).createAdminPermission({
            id: uuid(),
            roleId,
            resource: perm.resource,
            action: perm.action,
            description: perm.description || "",
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          created.push(newPerm);
        } else if (!perm.enabled && exists) {
          // Delete permission
          updated.push({
            resource: perm.resource,
            action: perm.action,
            status: "removed",
          });
        }
      }

      res.json({
        success: true,
        message: "Permissions updated successfully",
        data: {
          created: created.length,
          updated: updated.length,
        },
      });
    } catch (error) {
      console.error("Error bulk updating permissions:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * Get user permissions summary
   * GET /api/admin/permissions/users/:userId
   */
  router.get("/users/:userId", async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if user has admin role
      const adminRole = (targetUser as any).adminRoleId;
      if (!adminRole) {
        return res.json({
          success: true,
          data: {
            userId,
            role: null,
            permissions: [],
          },
        });
      }

      const role = await (storage as any).getAdminRole(adminRole);
      const permissions = await (storage as any).listAdminPermissions(adminRole);

      res.json({
        success: true,
        data: {
          userId,
          role: role ? { id: role.id, name: role.name, level: role.level } : null,
          permissions: permissions.map((p: any) => ({
            resource: p.resource,
            action: p.action,
          })),
        },
      });
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.use("/api/admin/permissions", router);
}
