import type { Express, Response } from "express";
import { storage } from "../storage";
import { authMiddleware, type AuthRequest } from "./middleware";
import { complaints } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";

const SLA_HOURS = 48;

function calculateSLAStatus(createdAt: Date, status: string): string {
  if (status === "resolved" || status === "closed") return "no_sla";
  const elapsedHours = (Date.now() - createdAt.getTime()) / 3600000;
  if (elapsedHours > SLA_HOURS) return "breached";
  if (elapsedHours > SLA_HOURS - 1) return "at_risk";
  return "on_track";
}

export async function registerAdminComplaintsRoutes(app: Express): Promise<void> {
  // List complaints with filtering
  app.get("/api/admin/complaints", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { status, priority, category, agent } = req.query as Record<string, string>;
      const adminId = req.user?.id;

      if (!adminId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      let complaintList = await storage.listComplaints();

      if (status) complaintList = complaintList.filter((c: any) => c.status === status);
      if (priority) complaintList = complaintList.filter((c: any) => c.priority === priority);
      if (category) complaintList = complaintList.filter((c: any) => c.category === category);
      if (agent) complaintList = complaintList.filter((c: any) => c.assignedAgentId === agent);

      const withSLA = complaintList.map((c: any) => ({
        ...c,
        slaStatus: calculateSLAStatus(c.createdAt, c.status),
      }));

      res.json(withSLA);
    } catch (error) {
      console.error("List complaints error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get complaint details
  app.get("/api/admin/complaints/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const adminId = req.user?.id;

      if (!adminId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const complaint = await storage.getComplaint(id);
      if (!complaint) {
        return res.status(404).json({ error: "Complaint not found" });
      }

      const messages = await storage.getComplaintMessages(id);

      res.json({
        ...complaint,
        slaStatus: calculateSLAStatus(complaint.createdAt, complaint.status),
        messages: messages.map((m: any) => ({
          id: m.id,
          senderId: m.senderId,
          message: m.message,
          isInternal: m.isInternal,
          createdAt: m.createdAt,
        })),
      });
    } catch (error) {
      console.error("Get complaint error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Assign complaint to agent
  app.post("/api/admin/complaints/:id/assign", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { agentId } = req.body;
      const adminId = req.user?.id;

      if (!adminId || !agentId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const complaint = await storage.getComplaint(id);
      if (!complaint) {
        return res.status(404).json({ error: "Complaint not found" });
      }

      const updated = await storage.updateComplaint(id, {
        assignedAgentId: agentId,
        status: "assigned",
      });

      res.json({ message: "Complaint assigned", complaint: updated });
    } catch (error) {
      console.error("Assign complaint error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update complaint status
  app.patch("/api/admin/complaints/:id/status", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const adminId = req.user?.id;

      if (!adminId || !status) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const complaint = await storage.getComplaint(id);
      if (!complaint) {
        return res.status(404).json({ error: "Complaint not found" });
      }

      const updated = await storage.updateComplaint(id, { status });

      res.json({
        message: "Status updated",
        complaint: updated,
        slaStatus: calculateSLAStatus(complaint.createdAt, status),
      });
    } catch (error) {
      console.error("Update status error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Escalate complaint
  app.post("/api/admin/complaints/:id/escalate", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminId = req.user?.id;

      if (!adminId || !reason) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const complaint = await storage.getComplaint(id);
      if (!complaint) {
        return res.status(404).json({ error: "Complaint not found" });
      }

      const updated = await storage.updateComplaint(id, {
        status: "escalated",
        escalatedTo: adminId,
      });

      // Add internal note about escalation
      await storage.addComplaintMessage({
        complaintId: id,
        senderId: adminId,
        message: `Escalated: ${reason}`,
        isInternal: true,
      });

      res.json({ message: "Complaint escalated", complaint: updated });
    } catch (error) {
      console.error("Escalate complaint error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Add message to complaint
  app.post("/api/admin/complaints/:id/messages", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { content, isInternal } = req.body;
      const adminId = req.user?.id;

      if (!adminId || !content) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const complaint = await storage.getComplaint(id);
      if (!complaint) {
        return res.status(404).json({ error: "Complaint not found" });
      }

      const message = await storage.addComplaintMessage({
        complaintId: id,
        senderId: adminId,
        message: content,
        isInternal: isInternal || false,
      });

      res.json({ message: "Message added", data: message });
    } catch (error) {
      console.error("Add message error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get complaint messages
  app.get("/api/admin/complaints/:id/messages", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const adminId = req.user?.id;

      if (!adminId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const messages = await storage.getComplaintMessages(id);

      res.json(messages.map((m: any) => ({
        id: m.id,
        senderId: m.senderId,
        message: m.message,
        isInternal: m.isInternal,
        createdAt: m.createdAt,
      })));
    } catch (error) {
      console.error("Get messages error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get complaint statistics
  app.get("/api/admin/complaints/stats/dashboard", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const adminId = req.user?.id;

      if (!adminId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const allComplaints = await storage.listComplaints();

      const stats = {
        total: allComplaints.length,
        open: allComplaints.filter((c: any) => c.status === "open").length,
        assigned: allComplaints.filter((c: any) => c.status === "assigned").length,
        in_progress: allComplaints.filter((c: any) => c.status === "in_progress").length,
        resolved: allComplaints.filter((c: any) => c.status === "resolved").length,
        closed: allComplaints.filter((c: any) => c.status === "closed").length,
        escalated: allComplaints.filter((c: any) => c.status === "escalated").length,
        slaBreached: allComplaints.filter((c: any) =>
          calculateSLAStatus(c.createdAt, c.status) === "breached"
        ).length,
        slaAtRisk: allComplaints.filter((c: any) =>
          calculateSLAStatus(c.createdAt, c.status) === "at_risk"
        ).length,
      };

      res.json(stats);
    } catch (error) {
      console.error("Get stats error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get SLA compliance report
  app.get("/api/admin/complaints/stats/sla", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const adminId = req.user?.id;

      if (!adminId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const allComplaints = await storage.listComplaints();
      const resolvedComplaints = allComplaints.filter((c: any) => c.status === "resolved" || c.status === "closed");

      const onTrack = resolvedComplaints.filter((c: any) =>
        (c.updatedAt.getTime() - c.createdAt.getTime()) <= SLA_HOURS * 3600000
      ).length;

      const breached = resolvedComplaints.filter((c: any) =>
        (c.updatedAt.getTime() - c.createdAt.getTime()) > SLA_HOURS * 3600000
      ).length;

      const complianceRate = resolvedComplaints.length > 0
        ? ((onTrack / resolvedComplaints.length) * 100).toFixed(2)
        : "N/A";

      res.json({
        totalResolved: resolvedComplaints.length,
        onTrack,
        breached,
        complianceRate: `${complianceRate}%`,
        slaHours: SLA_HOURS,
      });
    } catch (error) {
      console.error("Get SLA stats error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Rate complaint resolution
  app.post("/api/admin/complaints/:id/rate", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { rating, feedback } = req.body;
      const adminId = req.user?.id;

      if (!adminId || !rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Invalid rating (1-5)" });
      }

      const complaint = await storage.getComplaint(id);
      if (!complaint) {
        return res.status(404).json({ error: "Complaint not found" });
      }

      await storage.addComplaintMessage({
        complaintId: id,
        senderId: adminId,
        message: `Rating: ${rating}/5${feedback ? ` - ${feedback}` : ""}`,
        isInternal: true,
      });

      res.json({ message: "Rating recorded", rating });
    } catch (error) {
      console.error("Rate complaint error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
