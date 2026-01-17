import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Gamepad2, Power, AlertCircle, Radio, CheckCircle2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const gameFormSchema = z.object({
  key: z.string().min(1, "Game key is required").regex(/^[a-z0-9_]+$/, "Only lowercase letters, numbers, and underscores"),
  nameEn: z.string().min(1, "English name is required"),
  nameAr: z.string().min(1, "Arabic name is required"),
  minStake: z.string().min(1, "Minimum stake is required"),
  maxStake: z.string().min(1, "Maximum stake is required"),
  houseFee: z.string().min(1, "House fee is required"),
  defaultTimeLimit: z.string().optional(),
  minPlayers: z.string().min(1, "Minimum players is required"),
  maxPlayers: z.string().min(1, "Maximum players is required"),
  isActive: z.boolean(),
});

type GameFormData = z.infer<typeof gameFormSchema>;

interface MultiplayerGame {
  id: string;
  key: string;
  nameEn: string;
  nameAr: string;
  minStake: string;
  maxStake: string;
  houseFee: string;
  defaultTimeLimit: number | null;
  minPlayers: number;
  maxPlayers: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

function GameForm({ 
  game, 
  onSuccess, 
  onCancel 
}: { 
  game?: MultiplayerGame | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const isEditing = !!game;

  const form = useForm<GameFormData>({
    resolver: zodResolver(gameFormSchema),
    defaultValues: {
      key: game?.key || "",
      nameEn: game?.nameEn || "",
      nameAr: game?.nameAr || "",
      minStake: game?.minStake || "1",
      maxStake: game?.maxStake || "1000",
      houseFee: game?.houseFee || "0.05",
      defaultTimeLimit: game?.defaultTimeLimit?.toString() || "300",
      minPlayers: game?.minPlayers?.toString() || "2",
      maxPlayers: game?.maxPlayers?.toString() || "2",
      isActive: game?.isActive ?? true,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: GameFormData) =>
      apiRequest("POST", "/api/admin/multiplayer-games", {
        ...data,
        defaultTimeLimit: data.defaultTimeLimit ? parseInt(data.defaultTimeLimit) : 300,
        minPlayers: parseInt(data.minPlayers),
        maxPlayers: parseInt(data.maxPlayers),
      }),
    onSuccess: () => {
      toast({ 
        title: "Game created successfully",
        description: "Live update sent to all connected users",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/multiplayer-games"] });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to create game", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: GameFormData) =>
      apiRequest("PATCH", `/api/admin/multiplayer-games/${game!.id}`, {
        ...data,
        defaultTimeLimit: data.defaultTimeLimit ? parseInt(data.defaultTimeLimit) : 300,
        minPlayers: parseInt(data.minPlayers),
        maxPlayers: parseInt(data.maxPlayers),
      }),
    onSuccess: () => {
      toast({ 
        title: "Game updated successfully",
        description: "Live update sent to all connected users",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/multiplayer-games"] });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to update game", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const onSubmit = (data: GameFormData) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="key"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Game Key</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="chess" 
                    {...field} 
                    disabled={isEditing}
                    data-testid="input-game-key"
                  />
                </FormControl>
                <FormDescription>Unique identifier (lowercase, underscores)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel>Active Status</FormLabel>
                  <FormDescription>Enable or disable this game</FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="switch-game-active"
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="nameEn"
            render={({ field }) => (
              <FormItem>
                <FormLabel>English Name</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Chess" 
                    {...field} 
                    data-testid="input-game-name-en"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="nameAr"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Arabic Name</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="شطرنج" 
                    dir="rtl" 
                    {...field} 
                    data-testid="input-game-name-ar"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="minStake"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Minimum Stake</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder="1.00" 
                    {...field} 
                    data-testid="input-min-stake"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="maxStake"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Maximum Stake</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder="1000.00" 
                    {...field} 
                    data-testid="input-max-stake"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="houseFee"
            render={({ field }) => (
              <FormItem>
                <FormLabel>House Fee (%)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder="0.05" 
                    {...field} 
                    data-testid="input-house-fee"
                  />
                </FormControl>
                <FormDescription>E.g., 0.05 = 5%</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="defaultTimeLimit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Time Limit (seconds)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="300" 
                    {...field} 
                    data-testid="input-time-limit"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="minPlayers"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Min Players</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    min="2" 
                    max="10" 
                    {...field} 
                    data-testid="input-min-players"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="maxPlayers"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max Players</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    min="2" 
                    max="10" 
                    {...field} 
                    data-testid="input-max-players"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">
            Cancel
          </Button>
          <Button type="submit" disabled={isPending} data-testid="button-submit-game">
            {isPending ? "Saving..." : isEditing ? "Update Game" : "Create Game"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default function AdminMultiplayerGames() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState<MultiplayerGame | null>(null);
  const [gameToDelete, setGameToDelete] = useState<MultiplayerGame | null>(null);

  const { data: games = [], isLoading } = useQuery<MultiplayerGame[]>({
    queryKey: ["/api/admin/multiplayer-games"],
  });

  const { data: configVersion } = useQuery<{ version: string }>({
    queryKey: ["/api/config-version/multiplayer_games_version"],
    queryFn: async () => {
      const res = await fetch("/api/config-version/multiplayer_games_version");
      if (!res.ok) return { version: "" };
      return res.json();
    },
    refetchInterval: 10000,
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("POST", `/api/admin/multiplayer-games/${id}/toggle`),
    onSuccess: () => {
      toast({ 
        title: "Game status updated",
        description: "Live update sent to all connected users",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/multiplayer-games"] });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to update status", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/admin/multiplayer-games/${id}`),
    onSuccess: () => {
      toast({ 
        title: "Game deleted successfully",
        description: "Live update sent to all connected users",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/multiplayer-games"] });
      setGameToDelete(null);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to delete game", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const handleEdit = (game: MultiplayerGame) => {
    setSelectedGame(game);
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedGame(null);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSelectedGame(null);
  };

  const formatFee = (fee: string) => {
    const percent = parseFloat(fee) * 100;
    return `${percent.toFixed(0)}%`;
  };

  const formatCurrency = (value: string) => {
    return `$${parseFloat(value).toLocaleString()}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Gamepad2 className="h-6 w-6" />
            Multiplayer Games
          </h1>
          <p className="text-muted-foreground">
            Manage game configurations - this is the single source of truth for all game settings
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="flex items-center gap-1.5 px-3 py-1" data-testid="badge-sync-status">
            <Radio className="h-3 w-3 text-green-500 animate-pulse" />
            <span className="text-xs">Live Sync Active</span>
          </Badge>
          {configVersion?.version && (
            <Badge variant="secondary" className="text-xs" data-testid="badge-config-version">
              Config v{new Date(parseInt(configVersion.version)).toLocaleTimeString()}
            </Badge>
          )}
          <Button onClick={handleCreate} data-testid="button-add-game">
            <Plus className="h-4 w-4 mr-2" />
            Add Game
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Configuration Notice
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Changes made here affect all game lobbies, challenge creation, and payouts immediately. 
            Disabling a game will prevent new challenges but won't affect ongoing games.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Game</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Stake Range</TableHead>
                <TableHead>House Fee</TableHead>
                <TableHead>Players</TableHead>
                <TableHead>Time Limit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {games.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No games configured. Click "Add Game" to create one.
                  </TableCell>
                </TableRow>
              ) : (
                games.map((game) => (
                  <TableRow key={game.id} data-testid={`row-game-${game.key}`}>
                    <TableCell>
                      <div>
                        <div className="font-medium" data-testid={`text-game-name-${game.key}`}>{game.nameEn}</div>
                        <div className="text-sm text-muted-foreground" dir="rtl">{game.nameAr}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">{game.key}</code>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatCurrency(game.minStake)} - {formatCurrency(game.maxStake)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{formatFee(game.houseFee)}</Badge>
                    </TableCell>
                    <TableCell>
                      {game.minPlayers === game.maxPlayers 
                        ? game.minPlayers 
                        : `${game.minPlayers}-${game.maxPlayers}`}
                    </TableCell>
                    <TableCell>
                      {game.defaultTimeLimit ? `${Math.floor(game.defaultTimeLimit / 60)}m` : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={game.isActive}
                          onCheckedChange={() => toggleMutation.mutate(game.id)}
                          disabled={toggleMutation.isPending}
                          data-testid={`switch-toggle-${game.key}`}
                        />
                        <Badge variant={game.isActive ? "default" : "outline"}>
                          {game.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(game)}
                          data-testid={`button-edit-${game.key}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setGameToDelete(game)}
                          data-testid={`button-delete-${game.key}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedGame ? "Edit Game" : "Add New Game"}
            </DialogTitle>
          </DialogHeader>
          <GameForm
            game={selectedGame}
            onSuccess={handleDialogClose}
            onCancel={handleDialogClose}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!gameToDelete} onOpenChange={() => setGameToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Game</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{gameToDelete?.nameEn}"? 
              This action cannot be undone and may affect historical records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => gameToDelete && deleteMutation.mutate(gameToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
