import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  Search,
  Ban,
  Clock,
  Gift,
  DollarSign,
  MoreVertical,
  User,
  Mail,
  Shield,
  ArrowLeftRight,
  RefreshCw,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function getAdminToken() {
  return localStorage.getItem("adminToken");
}

async function adminFetch(url: string, options?: RequestInit) {
  const token = getAdminToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": token || "",
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [actionDialog, setActionDialog] = useState<string | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionAmount, setActionAmount] = useState("");
  const [adjustType, setAdjustType] = useState<"add" | "subtract">("add");

  const { data: users, isLoading, refetch } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: () => adminFetch("/api/admin/users"),
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const banMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return adminFetch(`/api/admin/users/${id}/ban`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User Banned", description: "User has been banned successfully" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to ban user", variant: "destructive" });
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return adminFetch(`/api/admin/users/${id}/suspend`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User Suspended", description: "User has been suspended" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to suspend user", variant: "destructive" });
    },
  });

  const balanceAdjustMutation = useMutation({
    mutationFn: async ({ id, amount, type, reason }: { id: string; amount: string; type: string; reason: string }) => {
      return adminFetch(`/api/admin/users/${id}/balance-adjust`, {
        method: "POST",
        body: JSON.stringify({ amount, type, reason }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Balance Updated", description: "User balance has been adjusted" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to adjust balance", variant: "destructive" });
    },
  });

  const rewardMutation = useMutation({
    mutationFn: async ({ id, amount, reason }: { id: string; amount: string; reason: string }) => {
      return adminFetch(`/api/admin/users/${id}/reward`, {
        method: "POST",
        body: JSON.stringify({ amount, reason }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Reward Sent", description: "Reward has been sent to user" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send reward", variant: "destructive" });
    },
  });

  const p2pBanMutation = useMutation({
    mutationFn: async ({ id, reason, banned }: { id: string; reason: string; banned: boolean }) => {
      return adminFetch(`/api/admin/users/${id}/p2p-ban`, {
        method: "POST",
        body: JSON.stringify({ reason, banned }),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ 
        title: variables.banned ? "P2P Banned" : "P2P Unbanned", 
        description: variables.banned ? "User banned from P2P trading" : "User can now use P2P trading" 
      });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update P2P access", variant: "destructive" });
    },
  });

  const closeDialog = () => {
    setActionDialog(null);
    setSelectedUser(null);
    setActionReason("");
    setActionAmount("");
  };

  const handleAction = () => {
    if (!selectedUser) return;

    switch (actionDialog) {
      case "ban":
        banMutation.mutate({ id: selectedUser.id, reason: actionReason });
        break;
      case "suspend":
        suspendMutation.mutate({ id: selectedUser.id, reason: actionReason });
        break;
      case "balance":
        balanceAdjustMutation.mutate({
          id: selectedUser.id,
          amount: actionAmount,
          type: adjustType,
          reason: actionReason,
        });
        break;
      case "reward":
        rewardMutation.mutate({
          id: selectedUser.id,
          amount: actionAmount,
          reason: actionReason,
        });
        break;
      case "p2pBan":
        p2pBanMutation.mutate({
          id: selectedUser.id,
          reason: actionReason,
          banned: !selectedUser.p2pBanned,
        });
        break;
    }
  };

  const filteredUsers = users?.filter((user: any) =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "default";
      case "banned": return "destructive";
      case "suspended": return "secondary";
      default: return "outline";
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">
            Manage all platform users 
            {users && <span className="ml-2">({users.length} total)</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            data-testid="button-refresh-users"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search-users"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredUsers?.map((user: any) => (
            <Card key={user.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{user.username}</span>
                        <Badge variant={getStatusColor(user.status)}>
                          {user.status}
                        </Badge>
                        <Badge variant="outline">{user.role}</Badge>
                        {user.p2pBanned && (
                          <Badge variant="secondary" className="bg-orange-500/10 text-orange-500">
                            P2P Banned
                          </Badge>
                        )}
                      </div>
                      {user.p2pBanned && (
                        <div className="mt-1 text-xs text-orange-500/80 bg-orange-500/5 px-2 py-1 rounded">
                          <span className="font-medium">P2P Ban:</span> {user.p2pBanReason || "No reason specified"}
                          {user.p2pBannedAt && (
                            <span className="ml-2 text-muted-foreground">
                              ({new Date(user.p2pBannedAt).toLocaleDateString()})
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {user.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          ${parseFloat(user.balance || "0").toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`button-user-actions-${user.id}`}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setSelectedUser(user); setActionDialog("reward"); }}>
                        <Gift className="h-4 w-4 mr-2" />
                        Send Reward
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setSelectedUser(user); setActionDialog("balance"); }}>
                        <DollarSign className="h-4 w-4 mr-2" />
                        Adjust Balance
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setSelectedUser(user); setActionDialog("suspend"); }}>
                        <Clock className="h-4 w-4 mr-2" />
                        Suspend User
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setSelectedUser(user); setActionDialog("p2pBan"); }}>
                        <ArrowLeftRight className="h-4 w-4 mr-2" />
                        {user.p2pBanned ? "Unban P2P" : "Ban from P2P"}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => { setSelectedUser(user); setActionDialog("ban"); }}
                        className="text-destructive"
                      >
                        <Ban className="h-4 w-4 mr-2" />
                        Ban User
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredUsers?.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">No users found</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Dialog open={actionDialog !== null} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog === "ban" && "Ban User"}
              {actionDialog === "suspend" && "Suspend User"}
              {actionDialog === "balance" && "Adjust Balance"}
              {actionDialog === "reward" && "Send Reward"}
              {actionDialog === "p2pBan" && (selectedUser?.p2pBanned ? "Unban P2P Access" : "Ban from P2P")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedUser && (
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <User className="h-5 w-5" />
                <div>
                  <p className="font-medium">{selectedUser.username}</p>
                  <p className="text-sm text-muted-foreground">
                    Current Balance: ${parseFloat(selectedUser.balance || "0").toFixed(2)}
                  </p>
                </div>
              </div>
            )}

            {(actionDialog === "balance" || actionDialog === "reward") && (
              <div className="space-y-2">
                <Label>Amount ($)</Label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={actionAmount}
                  onChange={(e) => setActionAmount(e.target.value)}
                  data-testid="input-action-amount"
                />
              </div>
            )}

            {actionDialog === "balance" && (
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={adjustType} onValueChange={(v: "add" | "subtract") => setAdjustType(v)}>
                  <SelectTrigger data-testid="select-adjust-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add">Add to Balance</SelectItem>
                    <SelectItem value="subtract">Subtract from Balance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Reason / Notes</Label>
              <Textarea
                placeholder="Enter reason for this action..."
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                data-testid="input-action-reason"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              variant={actionDialog === "ban" ? "destructive" : "default"}
              disabled={
                !actionReason ||
                ((actionDialog === "balance" || actionDialog === "reward") && !actionAmount)
              }
              data-testid="button-confirm-action"
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
