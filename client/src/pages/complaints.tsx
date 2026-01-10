import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth, useAuthHeaders } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import type { Complaint, ComplaintMessage } from "@shared/schema";
import { AlertTriangle, MessageSquare, Clock, CheckCircle, Loader2, Plus, Send } from "lucide-react";

interface ComplaintWithMessages extends Complaint {
  messages?: ComplaintMessage[];
}

export default function ComplaintsPage() {
  const { user } = useAuth();
  const headers = useAuthHeaders();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintWithMessages | null>(null);
  const [newMessage, setNewMessage] = useState("");
  
  const [formData, setFormData] = useState({
    category: "financial",
    priority: "medium",
    subject: "",
    description: "",
  });

  const { data: complaints, isLoading } = useQuery<Complaint[]>({
    queryKey: ["/api/complaints"],
    queryFn: async () => {
      const res = await fetch("/api/complaints", { headers });
      if (!res.ok) throw new Error("Failed to fetch complaints");
      return res.json();
    },
  });

  const { data: complaintDetails, refetch: refetchDetails } = useQuery<ComplaintWithMessages>({
    queryKey: ["/api/complaints", selectedComplaint?.id],
    queryFn: async () => {
      const res = await fetch(`/api/complaints/${selectedComplaint?.id}`, { headers });
      if (!res.ok) throw new Error("Failed to fetch complaint");
      return res.json();
    },
    enabled: !!selectedComplaint?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("/api/complaints", {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/complaints"] });
      setIsDialogOpen(false);
      setFormData({ category: "financial", priority: "medium", subject: "", description: "" });
      toast({ title: "Success", description: "Complaint submitted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Complaint> }) => {
      return apiRequest(`/api/complaints/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/complaints"] });
      refetchDetails();
      toast({ title: "Success", description: "Complaint updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const messageMutation = useMutation({
    mutationFn: async ({ complaintId, message }: { complaintId: string; message: string }) => {
      return apiRequest(`/api/complaints/${complaintId}/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message }),
      });
    },
    onSuccess: () => {
      refetchDetails();
      setNewMessage("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
      open: { variant: "secondary", icon: AlertTriangle },
      assigned: { variant: "outline", icon: Clock },
      in_progress: { variant: "outline", icon: Clock },
      escalated: { variant: "destructive", icon: AlertTriangle },
      resolved: { variant: "default", icon: CheckCircle },
      closed: { variant: "secondary", icon: CheckCircle },
    };
    const config = statusConfig[status] || { variant: "outline", icon: AlertTriangle };
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className={status === "resolved" ? "bg-primary" : ""}>
        <Icon className="w-3 h-3 mr-1" /> {status.replace("_", " ")}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      low: "bg-blue-500/20 text-blue-400",
      medium: "bg-yellow-500/20 text-yellow-400",
      high: "bg-orange-500/20 text-orange-400",
      urgent: "bg-red-500/20 text-red-400",
    };
    return <Badge className={colors[priority] || ""}>{priority}</Badge>;
  };

  const isAgentOrAdmin = user?.role === "admin" || user?.role === "agent";

  if (isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Complaints</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-complaint">
              <Plus className="mr-2 h-4 w-4" /> New Complaint
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit Complaint</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate(formData);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(v) => setFormData((p) => ({ ...p, category: v }))}
                  >
                    <SelectTrigger data-testid="select-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="financial">Financial</SelectItem>
                      <SelectItem value="technical">Technical</SelectItem>
                      <SelectItem value="account">Account</SelectItem>
                      <SelectItem value="game">Game</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(v) => setFormData((p) => ({ ...p, priority: v }))}
                  >
                    <SelectTrigger data-testid="select-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  data-testid="input-subject"
                  value={formData.subject}
                  onChange={(e) => setFormData((p) => ({ ...p, subject: e.target.value }))}
                  placeholder="Brief summary of your issue"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  data-testid="input-description"
                  value={formData.description}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Provide detailed information about your complaint"
                  rows={4}
                  required
                />
              </div>
              
              <Button
                type="submit"
                className="w-full"
                data-testid="button-submit-complaint"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Complaint
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>All Complaints</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="divide-y">
                {complaints?.map((complaint) => (
                  <div
                    key={complaint.id}
                    className={`p-4 cursor-pointer hover-elevate ${
                      selectedComplaint?.id === complaint.id ? "bg-muted" : ""
                    }`}
                    data-testid={`row-complaint-${complaint.id}`}
                    onClick={() => setSelectedComplaint(complaint)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="font-medium line-clamp-1">{complaint.subject}</p>
                      {getStatusBadge(complaint.status)}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{complaint.ticketNumber}</span>
                      <span>|</span>
                      {getPriorityBadge(complaint.priority)}
                      <span>|</span>
                      <span>{new Date(complaint.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
                
                {complaints?.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">
                    <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                    No complaints yet
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {selectedComplaint ? (
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  {selectedComplaint.ticketNumber}
                </div>
              ) : (
                "Select a Complaint"
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedComplaint && complaintDetails ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="font-semibold">{complaintDetails.subject}</h3>
                    <div className="flex gap-2">
                      {getStatusBadge(complaintDetails.status)}
                      {getPriorityBadge(complaintDetails.priority)}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{complaintDetails.description}</p>
                  {complaintDetails.slaDeadline && (
                    <p className="text-xs text-muted-foreground">
                      SLA: {new Date(complaintDetails.slaDeadline).toLocaleString()}
                    </p>
                  )}
                </div>

                {isAgentOrAdmin && (
                  <div className="flex gap-2">
                    <Select
                      value={complaintDetails.status}
                      onValueChange={(v) =>
                        updateMutation.mutate({ id: complaintDetails.id, data: { status: v as any } })
                      }
                    >
                      <SelectTrigger data-testid="select-update-status" className="w-40">
                        <SelectValue placeholder="Update status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="assigned">Assigned</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="escalated">Escalated</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Messages</h4>
                  <ScrollArea className="h-48 mb-4">
                    <div className="space-y-3">
                      {complaintDetails.messages?.map((msg) => (
                        <div
                          key={msg.id}
                          className={`p-3 rounded-lg ${
                            msg.senderId === user?.id
                              ? "bg-primary/20 ml-8"
                              : "bg-muted mr-8"
                          }`}
                        >
                          <p className="text-sm">{msg.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(msg.createdAt).toLocaleString()}
                          </p>
                        </div>
                      ))}
                      
                      {(!complaintDetails.messages || complaintDetails.messages.length === 0) && (
                        <p className="text-center text-muted-foreground text-sm">
                          No messages yet
                        </p>
                      )}
                    </div>
                  </ScrollArea>

                  <div className="flex gap-2">
                    <Input
                      data-testid="input-message"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newMessage.trim()) {
                          messageMutation.mutate({
                            complaintId: complaintDetails.id,
                            message: newMessage,
                          });
                        }
                      }}
                    />
                    <Button
                      size="icon"
                      data-testid="button-send-message"
                      onClick={() => {
                        if (newMessage.trim()) {
                          messageMutation.mutate({
                            complaintId: complaintDetails.id,
                            message: newMessage,
                          });
                        }
                      }}
                      disabled={messageMutation.isPending || !newMessage.trim()}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-12">
                <MessageSquare className="h-12 w-12 mx-auto mb-2" />
                Select a complaint to view details
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
