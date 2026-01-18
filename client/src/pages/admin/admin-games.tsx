import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Gamepad2, Users, User, Image, DollarSign } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const gameFormSchema = z.object({
  name: z.string().min(1, "Game name is required"),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  sections: z.array(z.string()).min(1, "Select at least one section"),
  gameType: z.enum(["single", "multiplayer"]),
  status: z.enum(["active", "inactive", "maintenance"]),
  volatility: z.enum(["low", "medium", "high"]),
  minBet: z.string().min(1, "Min bet is required"),
  maxBet: z.string().min(1, "Max bet is required"),
  rtp: z.string().min(1, "RTP is required"),
  houseEdge: z.string().min(1, "House edge is required"),
  multiplierMin: z.string(),
  multiplierMax: z.string(),
  isFeatured: z.boolean(),
  isFreeToPlay: z.boolean(),
  playPrice: z.string(),
  pricingType: z.enum(["bet", "fixed", "free"]),
  minPlayers: z.number().min(1),
  maxPlayers: z.number().min(1),
  sortOrder: z.number(),
});

type GameFormData = z.infer<typeof gameFormSchema>;

interface Game {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  category: string;
  sections: string[];
  gameType: string;
  status: string;
  volatility: string;
  minBet: string;
  maxBet: string;
  rtp: string;
  houseEdge: string;
  multiplierMin: string;
  multiplierMax: string;
  isFeatured: boolean;
  isFreeToPlay: boolean;
  playPrice: string;
  pricingType: string;
  minPlayers: number;
  maxPlayers: number;
  playCount: number;
  totalVolume: string;
  sortOrder: number;
  createdAt: string;
}

const sections = [
  { id: "play", label: "Play Games" },
  { id: "challenges", label: "Challenges" },
  { id: "multiplayer", label: "Multiplayer" },
  { id: "free", label: "Free Play" },
  { id: "featured", label: "Featured" },
];

const categories = [
  { value: "slots", label: "Slots" },
  { value: "cards", label: "Cards" },
  { value: "dice", label: "Dice" },
  { value: "crash", label: "Crash" },
  { value: "roulette", label: "Roulette" },
  { value: "arcade", label: "Arcade" },
  { value: "sports", label: "Sports" },
  { value: "board", label: "Board Games" },
  { value: "strategy", label: "Strategy" },
  { value: "other", label: "Other" },
];

function GameForm({ 
  game, 
  onSuccess, 
  onClose 
}: { 
  game?: Game; 
  onSuccess: () => void; 
  onClose: () => void;
}) {
  const { toast } = useToast();
  
  const form = useForm<GameFormData>({
    resolver: zodResolver(gameFormSchema),
    defaultValues: {
      name: game?.name || "",
      description: game?.description || "",
      imageUrl: game?.imageUrl || "",
      thumbnailUrl: game?.thumbnailUrl || "",
      category: game?.category || "slots",
      sections: game?.sections || ["play"],
      gameType: (game?.gameType as "single" | "multiplayer") || "single",
      status: (game?.status as "active" | "inactive" | "maintenance") || "active",
      volatility: (game?.volatility as "low" | "medium" | "high") || "medium",
      minBet: game?.minBet || "1.00",
      maxBet: game?.maxBet || "1000.00",
      rtp: game?.rtp || "95.00",
      houseEdge: game?.houseEdge || "5.00",
      multiplierMin: game?.multiplierMin || "0.00",
      multiplierMax: game?.multiplierMax || "100.00",
      isFeatured: game?.isFeatured || false,
      isFreeToPlay: game?.isFreeToPlay || false,
      playPrice: game?.playPrice || "0.00",
      pricingType: (game?.pricingType as "bet" | "fixed" | "free") || "bet",
      minPlayers: game?.minPlayers || 1,
      maxPlayers: game?.maxPlayers || 1,
      sortOrder: game?.sortOrder || 0,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: GameFormData) => apiRequest("/api/admin/games", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/games"] });
      toast({ title: "Game created successfully" });
      onSuccess();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: GameFormData) => apiRequest(`/api/admin/games/${game?.id}`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/games"] });
      toast({ title: "Game updated successfully" });
      onSuccess();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Watch sections and auto-adjust gameType based on section selection
  // Use subscription pattern to avoid infinite loops
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "sections" || name === undefined) {
        const sections = value.sections as string[] | undefined;
        const hasChallenges = sections?.includes("challenges");
        const hasMultiplayer = sections?.includes("multiplayer");
        
        const currentGameType = form.getValues("gameType");
        const currentMinPlayers = form.getValues("minPlayers");
        const currentMaxPlayers = form.getValues("maxPlayers");
        
        if (hasChallenges || hasMultiplayer) {
          // Force multiplayer for challenges/multiplayer sections
          if (currentGameType !== "multiplayer") {
            form.setValue("gameType", "multiplayer", { shouldDirty: false });
          }
          if (currentMinPlayers <= 1) {
            form.setValue("minPlayers", 2, { shouldDirty: false });
          }
          if (currentMaxPlayers <= 1) {
            form.setValue("maxPlayers", 4, { shouldDirty: false });
          }
        } else {
          // Revert to single player if no multiplayer sections selected
          if (currentGameType !== "single") {
            form.setValue("gameType", "single", { shouldDirty: false });
          }
          if (currentMinPlayers !== 1) {
            form.setValue("minPlayers", 1, { shouldDirty: false });
          }
          if (currentMaxPlayers !== 1) {
            form.setValue("maxPlayers", 1, { shouldDirty: false });
          }
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const onSubmit = (data: GameFormData) => {
    if (game) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Game Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter game name" {...field} data-testid="input-game-name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Enter game description" {...field} data-testid="input-game-description" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="imageUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Image URL</FormLabel>
                <FormControl>
                  <Input placeholder="https://..." {...field} data-testid="input-game-image" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="thumbnailUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Thumbnail URL</FormLabel>
                <FormControl>
                  <Input placeholder="https://..." {...field} data-testid="input-game-thumbnail" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-game-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="gameType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Game Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-game-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="single">Single Player</SelectItem>
                    <SelectItem value="multiplayer">Multiplayer</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="sections"
          render={() => (
            <FormItem>
              <FormLabel>Sections (where to display)</FormLabel>
              <p className="text-xs text-muted-foreground">
                Selecting "Challenges" or "Multiplayer" will automatically set the game as multiplayer
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2">
                {sections.map((section) => (
                  <FormField
                    key={section.id}
                    control={form.control}
                    name="sections"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value?.includes(section.id)}
                            onCheckedChange={(checked) => {
                              const current = field.value || [];
                              if (checked) {
                                field.onChange([...current, section.id]);
                              } else {
                                field.onChange(current.filter((v) => v !== section.id));
                              }
                              // Note: gameType and players auto-adjust via useEffect
                            }}
                            data-testid={`checkbox-section-${section.id}`}
                          />
                        </FormControl>
                        <FormLabel className="font-normal cursor-pointer">
                          {section.label}
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-game-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="volatility"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Volatility</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-game-volatility">
                      <SelectValue placeholder="Select volatility" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="minBet"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Min Amount ($)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} data-testid="input-min-bet" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="maxBet"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max Amount ($)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} data-testid="input-max-bet" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="rtp"
            render={({ field }) => (
              <FormItem>
                <FormLabel>RTP (%)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} data-testid="input-rtp" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="houseEdge"
            render={({ field }) => (
              <FormItem>
                <FormLabel>House Edge (%)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} data-testid="input-house-edge" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="multiplierMin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Min Multiplier</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} data-testid="input-multiplier-min" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="multiplierMax"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max Multiplier</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} data-testid="input-multiplier-max" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {form.watch("gameType") === "multiplayer" && (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="minPlayers"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Min Players</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min="1" 
                      {...field} 
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
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
                      min="1" 
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      data-testid="input-max-players" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="sortOrder"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sort Order</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    data-testid="input-sort-order" 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="isFeatured"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between pt-6">
                <FormLabel>Featured Game</FormLabel>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="switch-featured"
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="isFreeToPlay"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between pt-6">
                <FormLabel>Free to Play</FormLabel>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="switch-free-to-play"
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="pricingType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pricing Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-pricing-type">
                      <SelectValue placeholder="Select pricing type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="bet">Bet-based</SelectItem>
                    <SelectItem value="fixed">Fixed Price</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {!form.watch("isFreeToPlay") && (
          <FormField
            control={form.control}
            name="playPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Play Price ($)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} data-testid="input-play-price" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel">
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} data-testid="button-save-game">
            {isSubmitting ? "Saving..." : game ? "Update Game" : "Create Game"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default function AdminGamesPage() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);

  const { data: games, isLoading } = useQuery<Game[]>({
    queryKey: ["/api/admin/games"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/admin/games/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/games"] });
      toast({ title: "Game deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleEdit = (game: Game) => {
    setEditingGame(game);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingGame(null);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Gamepad2 className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">Games Management</h1>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingGame(null)} data-testid="button-add-game">
              <Plus className="me-2 h-4 w-4" />
              Add New Game
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingGame ? "Edit Game" : "Add New Game"}</DialogTitle>
            </DialogHeader>
            <GameForm 
              game={editingGame || undefined} 
              onSuccess={handleDialogClose}
              onClose={handleDialogClose}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Games ({games?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {games && games.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Image</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Pricing</TableHead>
                    <TableHead>Sections</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>RTP</TableHead>
                    <TableHead>Plays</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {games.map((game) => (
                    <TableRow key={game.id} data-testid={`row-game-${game.id}`}>
                      <TableCell>
                        {game.thumbnailUrl || game.imageUrl ? (
                          <img 
                            src={game.thumbnailUrl || game.imageUrl || ""} 
                            alt={game.name}
                            className="w-12 h-12 rounded-md object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center">
                            <Image className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{game.name}</span>
                          {game.isFeatured && (
                            <Badge variant="secondary" className="text-xs">Featured</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{game.category}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {game.gameType === "multiplayer" ? (
                            <>
                              <Users className="h-4 w-4" />
                              <span>MP ({game.minPlayers}-{game.maxPlayers})</span>
                            </>
                          ) : (
                            <>
                              <User className="h-4 w-4" />
                              <span>Single</span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {game.isFreeToPlay || game.pricingType === "free" ? (
                            <Badge variant="secondary" className="bg-green-600 text-white text-xs">
                              Free
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              <DollarSign className="h-3 w-3 me-1" />
                              {game.playPrice}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs capitalize">
                            {game.pricingType}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {game.sections?.map((section) => (
                            <Badge key={section} variant="outline" className="text-xs">
                              {section}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={game.status === "active" ? "default" : "secondary"}
                          className={game.status === "active" ? "bg-primary" : ""}
                        >
                          {game.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{game.rtp}%</TableCell>
                      <TableCell>{game.playCount.toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(game)}
                            data-testid={`button-edit-game-${game.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this game?")) {
                                deleteMutation.mutate(game.id);
                              }
                            }}
                            data-testid={`button-delete-game-${game.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Gamepad2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No games found. Click "Add New Game" to create one.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
