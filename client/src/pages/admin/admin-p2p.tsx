import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  ArrowLeftRight,
  Ban,
  Check,
  X,
  Eye,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  Shield,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";

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

export default function AdminP2PPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOffer, setSelectedOffer] = useState<any>(null);
  const [selectedTrade, setSelectedTrade] = useState<any>(null);
  const [actionDialog, setActionDialog] = useState<string | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [resolution, setResolution] = useState("");

  const { data: offers = [], isLoading: offersLoading } = useQuery({
    queryKey: ["/api/admin/p2p/offers"],
    queryFn: () => adminFetch("/api/admin/p2p/offers"),
  });

  const { data: trades = [], isLoading: tradesLoading } = useQuery({
    queryKey: ["/api/admin/p2p/trades"],
    queryFn: () => adminFetch("/api/admin/p2p/trades"),
  });

  const { data: disputes = [], isLoading: disputesLoading } = useQuery({
    queryKey: ["/api/admin/p2p/disputes"],
    queryFn: () => adminFetch("/api/admin/p2p/disputes"),
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/admin/p2p/stats"],
    queryFn: () => adminFetch("/api/admin/p2p/stats"),
  });

  const cancelOfferMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return adminFetch(`/api/admin/p2p/offers/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/p2p/offers"] });
      toast({ title: "Offer Cancelled", description: "The P2P offer has been cancelled" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to cancel offer", variant: "destructive" });
    },
  });

  const resolveDisputeMutation = useMutation({
    mutationFn: async ({ id, resolution, winnerId }: { id: string; resolution: string; winnerId: string }) => {
      return adminFetch(`/api/admin/p2p/disputes/${id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ resolution, winnerId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/p2p/disputes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/p2p/trades"] });
      toast({ title: "Dispute Resolved", description: "The dispute has been resolved" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to resolve dispute", variant: "destructive" });
    },
  });

  const closeDialog = () => {
    setActionDialog(null);
    setSelectedOffer(null);
    setSelectedTrade(null);
    setActionReason("");
    setResolution("");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "default";
      case "completed": return "secondary";
      case "cancelled": return "destructive";
      case "pending": return "outline";
      case "processing": return "secondary";
      case "disputed": return "destructive";
      default: return "outline";
    }
  };

  const filteredOffers = offers?.filter((offer: any) =>
    offer.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    offer.currency?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTrades = trades?.filter((trade: any) =>
    trade.buyerUsername?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    trade.sellerUsername?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">P2P Management</h1>
          <p className="text-muted-foreground">Manage P2P offers, trades and disputes</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-p2p"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <ArrowLeftRight className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Offers</p>
                <p className="text-2xl font-bold">{stats?.activeOffers || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/10">
                <Check className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completed Trades</p>
                <p className="text-2xl font-bold">{stats?.completedTrades || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-orange-500/10">
                <Clock className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Trades</p>
                <p className="text-2xl font-bold">{stats?.pendingTrades || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-500/10">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Open Disputes</p>
                <p className="text-2xl font-bold">{stats?.openDisputes || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="offers">
        <TabsList>
          <TabsTrigger value="offers" data-testid="tab-offers">Offers</TabsTrigger>
          <TabsTrigger value="trades" data-testid="tab-trades">Trades</TabsTrigger>
          <TabsTrigger value="disputes" data-testid="tab-disputes">
            Disputes
            {disputes?.filter((d: any) => d.status === "pending" || d.status === "under_review").length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {disputes?.filter((d: any) => d.status === "pending" || d.status === "under_review").length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="offers" className="space-y-4">
          {offersLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOffers?.map((offer: any) => (
                <Card key={offer.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${offer.type === "buy" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                          {offer.type === "buy" ? (
                            <TrendingUp className="h-5 w-5 text-green-500" />
                          ) : (
                            <TrendingDown className="h-5 w-5 text-red-500" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{offer.username}</span>
                            <Badge variant={offer.type === "buy" ? "default" : "secondary"}>
                              {offer.type?.toUpperCase()}
                            </Badge>
                            <Badge variant={getStatusColor(offer.status)}>
                              {offer.status}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {offer.amount} {offer.currency} @ {offer.price} per unit
                          </div>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-offer-actions-${offer.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setSelectedOffer(offer); setActionDialog("viewOffer"); }}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {offer.status === "active" && (
                            <DropdownMenuItem 
                              onClick={() => { setSelectedOffer(offer); setActionDialog("cancelOffer"); }}
                              className="text-destructive"
                            >
                              <X className="h-4 w-4 mr-2" />
                              Cancel Offer
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filteredOffers?.length === 0 && (
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-muted-foreground">No offers found</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="trades" className="space-y-4">
          {tradesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTrades?.map((trade: any) => (
                <Card key={trade.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-full bg-primary/10">
                          <ArrowLeftRight className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{trade.buyerUsername}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="font-semibold">{trade.sellerUsername}</span>
                            <Badge variant={getStatusColor(trade.status)}>
                              {trade.status}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {trade.amount} @ ${trade.totalPrice} total
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => { setSelectedTrade(trade); setActionDialog("viewTrade"); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filteredTrades?.length === 0 && (
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-muted-foreground">No trades found</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="disputes" className="space-y-4">
          {disputesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {disputes?.map((dispute: any) => (
                <Card key={dispute.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-full bg-red-500/10">
                          <AlertTriangle className="h-5 w-5 text-red-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">Dispute #{dispute.id.slice(0, 8)}</span>
                            <Badge variant={getStatusColor(dispute.status)}>
                              {dispute.status}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {dispute.initiatorName} vs {dispute.respondentName}
                          </div>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-dispute-actions-${dispute.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setSelectedTrade(dispute); setActionDialog("viewDispute"); }}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {(dispute.status === "pending" || dispute.status === "under_review") && (
                            <DropdownMenuItem onClick={() => { setSelectedTrade(dispute); setActionDialog("resolveDispute"); }}>
                              <Shield className="h-4 w-4 mr-2" />
                              Resolve Dispute
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {disputes?.length === 0 && (
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-muted-foreground">No disputes found</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={actionDialog === "cancelOffer"} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Offer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                placeholder="Enter reason for cancellation..."
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                data-testid="input-cancel-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => cancelOfferMutation.mutate({ id: selectedOffer?.id, reason: actionReason })}
              disabled={!actionReason}
              data-testid="button-confirm-cancel"
            >
              Cancel Offer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={actionDialog === "resolveDispute"} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Dispute</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Winner</Label>
              <Select value={resolution} onValueChange={setResolution}>
                <SelectTrigger data-testid="select-winner">
                  <SelectValue placeholder="Select winner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="initiator">Initiator ({selectedTrade?.initiatorName})</SelectItem>
                  <SelectItem value="respondent">Respondent ({selectedTrade?.respondentName})</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Resolution Notes</Label>
              <Textarea
                placeholder="Enter resolution details..."
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                data-testid="input-resolution-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button
              onClick={() => resolveDisputeMutation.mutate({
                id: selectedTrade?.id,
                resolution: actionReason,
                winnerId: resolution === "initiator" ? selectedTrade?.initiatorId : selectedTrade?.respondentId,
              })}
              disabled={!resolution || !actionReason}
              data-testid="button-confirm-resolve"
            >
              Resolve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={actionDialog === "viewOffer" || actionDialog === "viewTrade" || actionDialog === "viewDispute"} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog === "viewOffer" && "Offer Details"}
              {actionDialog === "viewTrade" && "Trade Details"}
              {actionDialog === "viewDispute" && "Dispute Details"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <pre className="p-4 bg-muted rounded-lg text-sm overflow-auto max-h-96">
              {JSON.stringify(actionDialog === "viewOffer" ? selectedOffer : selectedTrade, null, 2)}
            </pre>
          </div>
          <DialogFooter>
            <Button onClick={closeDialog}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
