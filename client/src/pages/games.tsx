import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth, useAuthHeaders } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { Game } from "@shared/schema";
import { Plus, Pencil, Trash2, Gamepad2, Loader2 } from "lucide-react";

export default function GamesPage() {
  const { user } = useAuth();
  const headers = useAuthHeaders();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "slots",
    rtp: "95.00",
    houseEdge: "5.00",
    volatility: "medium",
    minBet: "1.00",
    maxBet: "1000.00",
    status: "active",
  });

  const { data: games, isLoading } = useQuery<Game[]>({
    queryKey: ["/api/games"],
    queryFn: async () => {
      const res = await fetch("/api/games", { headers });
      if (!res.ok) throw new Error("Failed to fetch games");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("/api/games", {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Success", description: "Game created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      return apiRequest(`/api/games/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      setIsDialogOpen(false);
      setEditingGame(null);
      resetForm();
      toast({ title: "Success", description: "Game updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/games/${id}`, {
        method: "DELETE",
        headers,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      toast({ title: "Success", description: "Game deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      category: "slots",
      rtp: "95.00",
      houseEdge: "5.00",
      volatility: "medium",
      minBet: "1.00",
      maxBet: "1000.00",
      status: "active",
    });
  };

  const openEditDialog = (game: Game) => {
    setEditingGame(game);
    setFormData({
      name: game.name,
      description: game.description || "",
      category: game.category,
      rtp: game.rtp,
      houseEdge: game.houseEdge,
      volatility: game.volatility,
      minBet: game.minBet,
      maxBet: game.maxBet,
      status: game.status,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingGame) {
      updateMutation.mutate({ id: editingGame.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const isAdmin = user?.role === "admin";

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Game Management</h1>
        {isAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingGame(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-game">
                <Plus className="mr-2 h-4 w-4" /> Add Game
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingGame ? "Edit Game" : "Add New Game"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Game Name</Label>
                  <Input
                    data-testid="input-game-name"
                    value={formData.name}
                    onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={formData.category} onValueChange={(v) => setFormData(p => ({ ...p, category: v }))}>
                      <SelectTrigger data-testid="select-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="slots">Slots</SelectItem>
                        <SelectItem value="table">Table</SelectItem>
                        <SelectItem value="cards">Cards</SelectItem>
                        <SelectItem value="live">Live</SelectItem>
                        <SelectItem value="crash">Crash</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Volatility</Label>
                    <Select value={formData.volatility} onValueChange={(v) => setFormData(p => ({ ...p, volatility: v }))}>
                      <SelectTrigger data-testid="select-volatility">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>RTP (%)</Label>
                    <Input
                      data-testid="input-rtp"
                      type="number"
                      step="0.01"
                      value={formData.rtp}
                      onChange={(e) => setFormData(p => ({ ...p, rtp: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>House Edge (%)</Label>
                    <Input
                      data-testid="input-house-edge"
                      type="number"
                      step="0.01"
                      value={formData.houseEdge}
                      onChange={(e) => setFormData(p => ({ ...p, houseEdge: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Min Amount</Label>
                    <Input
                      data-testid="input-min-bet"
                      type="number"
                      step="0.01"
                      value={formData.minBet}
                      onChange={(e) => setFormData(p => ({ ...p, minBet: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Amount</Label>
                    <Input
                      data-testid="input-max-bet"
                      type="number"
                      step="0.01"
                      value={formData.maxBet}
                      onChange={(e) => setFormData(p => ({ ...p, maxBet: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData(p => ({ ...p, status: v }))}>
                    <SelectTrigger data-testid="select-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button
                  type="submit"
                  className="w-full"
                  data-testid="button-save-game"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingGame ? "Update Game" : "Create Game"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {games?.map((game) => (
          <Card key={game.id} data-testid={`card-game-${game.id}`} className="game-card-hover">
            <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
              <div className="flex items-center gap-2">
                <Gamepad2 className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">{game.name}</CardTitle>
              </div>
              <Badge
                variant={game.status === "active" ? "default" : "secondary"}
                className={game.status === "active" ? "bg-primary" : ""}
              >
                {game.status}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{game.category}</Badge>
                <Badge variant="outline">{game.volatility} volatility</Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">RTP:</span>{" "}
                  <span className="font-medium">{game.rtp}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">House Edge:</span>{" "}
                  <span className="font-medium">{game.houseEdge}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Min:</span>{" "}
                  <span className="font-medium">${game.minBet}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Max:</span>{" "}
                  <span className="font-medium">${game.maxBet}</span>
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground">
                {game.playCount} plays | ${parseFloat(game.totalVolume).toLocaleString()} volume
              </div>
              
              {isAdmin && (
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid={`button-edit-game-${game.id}`}
                    onClick={() => openEditDialog(game)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    data-testid={`button-delete-game-${game.id}`}
                    onClick={() => deleteMutation.mutate(game.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      
      {games?.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Gamepad2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No games yet. Add your first game!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
