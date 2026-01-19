import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Target, Crown, Shuffle, Gem, Users, Play } from "lucide-react";

interface Game {
  id: string;
  name: string;
  category: string;
  minBet: string;
  maxBet: string;
  status: string;
  minPlayers?: number;
  maxPlayers?: number;
  description?: string;
}

interface VirtualGamesGridProps {
  games: Game[];
  onGameSelect: (game: Game) => void;
  isLoading?: boolean;
}

const GAME_ICONS: Record<string, any> = {
  domino: Target,
  chess: Crown,
  backgammon: Shuffle,
  tarneeb: Gem,
  baloot: Gem,
  board: Target,
  strategy: Crown,
  cards: Gem,
};

const getGameIcon = (name: string, category: string) => {
  const lowerName = name.toLowerCase();
  if (GAME_ICONS[lowerName]) return GAME_ICONS[lowerName];
  if (GAME_ICONS[category]) return GAME_ICONS[category];
  return Target;
};

export function GameCardSkeleton() {
  return (
    <Card className="h-full animate-pulse">
      <CardContent className="p-4 flex flex-col h-full">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 bg-muted rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </div>
        <div className="space-y-2 mb-3 flex-1">
          <div className="h-4 bg-muted rounded w-full" />
          <div className="h-4 bg-muted rounded w-2/3" />
        </div>
        <div className="h-9 bg-muted rounded w-full" />
      </CardContent>
    </Card>
  );
}

interface GameCardProps {
  game: Game;
  onGameSelect: (game: Game) => void;
}

export function GameCard({ game, onGameSelect }: GameCardProps) {
  const Icon = getGameIcon(game.name, game.category);
  
  return (
    <Card 
      className="cursor-pointer hover-elevate transition-all duration-200 overflow-visible h-full"
      onClick={() => onGameSelect(game)}
      data-testid={`card-game-${game.id}`}
    >
      <CardContent className="p-4 flex flex-col h-full min-h-[200px]">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-3 rounded-full bg-primary/20 flex-shrink-0">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-lg truncate">{game.name}</h3>
            <Badge variant="secondary" className="text-xs capitalize">
              {game.category}
            </Badge>
          </div>
        </div>
        
        {game.description && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2 flex-1">
            {game.description}
          </p>
        )}
        
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{game.minPlayers || 2}-{game.maxPlayers || 4}</span>
          </div>
          <div className="flex items-center gap-1">
            <span>${game.minBet} - ${game.maxBet}</span>
          </div>
        </div>
        
        <Button className="w-full" size="sm" data-testid={`button-play-${game.id}`}>
          <Play className="h-4 w-4 me-2" />
          Play
        </Button>
      </CardContent>
    </Card>
  );
}

export function VirtualGamesGrid({ 
  games, 
  onGameSelect, 
  isLoading = false
}: VirtualGamesGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array(8).fill(0).map((_, i) => (
          <GameCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No games available
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {games.map(game => (
        <GameCard key={game.id} game={game} onGameSelect={onGameSelect} />
      ))}
    </div>
  );
}

export default VirtualGamesGrid;
