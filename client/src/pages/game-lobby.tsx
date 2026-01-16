import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { BackButton } from "@/components/BackButton";
import {
  Gamepad2,
  Users,
  Shuffle,
  Clock,
  Trophy,
  Coins,
  Play,
  Search,
  Filter,
  Target,
  Crown,
  Gem,
  Zap,
  Eye,
  Timer,
  TrendingUp,
  RefreshCw,
  Loader2,
  ChevronRight,
  Sparkles,
  Flame
} from "lucide-react";

interface Challenge {
  id: string;
  gameType: string;
  betAmount: number;
  visibility: 'public' | 'private';
  status: 'waiting' | 'active' | 'completed' | 'cancelled';
  player1Id: string;
  player1Name: string;
  player1Rating?: { wins: number; losses: number; winRate: number; rank: string };
  player2Id?: string;
  player2Name?: string;
  player2Rating?: { wins: number; losses: number; winRate: number; rank: string };
  spectatorCount?: number;
  totalBets?: number;
  createdAt: string;
  startedAt?: string;
}

const GAME_CONFIG = {
  chess: { name: 'Chess', nameAr: 'شطرنج', icon: Crown, color: 'bg-amber-500/20 text-amber-500 border-amber-500/30' },
  domino: { name: 'Domino', nameAr: 'دومينو', icon: Target, color: 'bg-blue-500/20 text-blue-500 border-blue-500/30' },
  backgammon: { name: 'Backgammon', nameAr: 'طاولة', icon: Shuffle, color: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30' },
  tarneeb: { name: 'Tarneeb', nameAr: 'طرنيب', icon: Gem, color: 'bg-purple-500/20 text-purple-500 border-purple-500/30' },
  baloot: { name: 'Baloot', nameAr: 'بلوت', icon: Gem, color: 'bg-rose-500/20 text-rose-500 border-rose-500/30' },
};

const RANK_COLORS: Record<string, string> = {
  bronze: "bg-amber-700/20 text-amber-600 border-amber-700/30",
  silver: "bg-gray-400/20 text-gray-400 border-gray-400/30",
  gold: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
  platinum: "bg-cyan-400/20 text-cyan-400 border-cyan-400/30",
  diamond: "bg-purple-400/20 text-purple-400 border-purple-400/30",
};

export default function GameLobbyPage() {
  const { t, language } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [betRange, setBetRange] = useState<[number, number]>([0, 1000]);
  const [showQuickMatch, setShowQuickMatch] = useState(false);
  const [quickMatchGame, setQuickMatchGame] = useState<string | null>(null);
  const [quickMatchBet, setQuickMatchBet] = useState(50);
  const [isSearching, setIsSearching] = useState(false);

  const { data: availableChallenges = [], isLoading: loadingAvailable, refetch: refetchAvailable } = useQuery<Challenge[]>({
    queryKey: ['/api/challenges/available'],
    refetchInterval: 5000,
  });

  const { data: liveChallenges = [], isLoading: loadingLive, refetch: refetchLive } = useQuery<Challenge[]>({
    queryKey: ['/api/challenges/public'],
    refetchInterval: 5000,
  });

  const joinChallengeMutation = useMutation({
    mutationFn: async (challengeId: string) => {
      return apiRequest('POST', `/api/challenges/${challengeId}/join`);
    },
    onSuccess: (data: any) => {
      toast({ title: t('lobby.joinedChallenge'), description: t('lobby.gameStarting') });
      queryClient.invalidateQueries({ queryKey: ['/api/challenges/available'] });
      queryClient.invalidateQueries({ queryKey: ['/api/challenges/public'] });
      navigate(`/challenge/${data.id}/play`);
    },
    onError: (error: any) => {
      toast({ title: t('common.error'), description: error.message, variant: "destructive" });
    },
  });

  const createChallengeMutation = useMutation({
    mutationFn: async (data: { gameType: string; betAmount: number }) => {
      return apiRequest('POST', '/api/challenges', {
        ...data,
        visibility: 'public',
        opponentType: 'random',
      });
    },
    onSuccess: (data: any) => {
      toast({ title: t('lobby.challengeCreated'), description: t('lobby.waitingForOpponent') });
      queryClient.invalidateQueries({ queryKey: ['/api/challenges/available'] });
      queryClient.invalidateQueries({ queryKey: ['/api/challenges/public'] });
      setShowQuickMatch(false);
      setIsSearching(true);
      setTimeout(() => {
        navigate(`/challenge/${data.id}/play`);
      }, 1000);
    },
    onError: (error: any) => {
      toast({ title: t('common.error'), description: error.message, variant: "destructive" });
    },
  });

  const filteredAvailable = availableChallenges.filter((c: Challenge) => {
    if (selectedGame && c.gameType !== selectedGame) return false;
    if (c.betAmount < betRange[0] || c.betAmount > betRange[1]) return false;
    if (searchQuery && !c.player1Name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return c.status === 'waiting';
  });

  const filteredLive = liveChallenges.filter((c: Challenge) => {
    if (selectedGame && c.gameType !== selectedGame) return false;
    return c.status === 'active';
  });

  const handleQuickMatch = (gameType: string) => {
    setQuickMatchGame(gameType);
    setShowQuickMatch(true);
  };

  const startQuickMatch = () => {
    if (!quickMatchGame) return;
    
    const matchingChallenge = availableChallenges.find(
      (c: Challenge) => c.gameType === quickMatchGame && 
        c.status === 'waiting' && 
        Math.abs(c.betAmount - quickMatchBet) <= quickMatchBet * 0.3
    );

    if (matchingChallenge) {
      joinChallengeMutation.mutate(matchingChallenge.id);
    } else {
      createChallengeMutation.mutate({ gameType: quickMatchGame, betAmount: quickMatchBet });
    }
    setShowQuickMatch(false);
  };

  const GameCard = ({ gameType, config }: { gameType: string; config: typeof GAME_CONFIG[keyof typeof GAME_CONFIG] }) => {
    const Icon = config.icon;
    const waitingCount = availableChallenges.filter((c: Challenge) => c.gameType === gameType && c.status === 'waiting').length;
    const liveCount = liveChallenges.filter((c: Challenge) => c.gameType === gameType && c.status === 'active').length;

    return (
      <Card 
        className={`hover-elevate cursor-pointer transition-all ${selectedGame === gameType ? 'ring-2 ring-primary' : ''}`}
        onClick={() => setSelectedGame(selectedGame === gameType ? null : gameType)}
        data-testid={`card-game-${gameType}`}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${config.color}`}>
              <Icon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">{language === 'ar' ? config.nameAr : config.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  <Users className="w-3 h-3 mr-1" />
                  {waitingCount} {t('lobby.waiting')}
                </Badge>
                {liveCount > 0 && (
                  <Badge variant="secondary" className="text-xs bg-red-500/20 text-red-500">
                    <Eye className="w-3 h-3 mr-1" />
                    {liveCount} {t('lobby.live')}
                  </Badge>
                )}
              </div>
            </div>
            <Button 
              size="sm" 
              onClick={(e) => { e.stopPropagation(); handleQuickMatch(gameType); }}
              data-testid={`button-quickmatch-${gameType}`}
            >
              <Zap className="w-4 h-4 mr-1" />
              {t('lobby.quickMatch')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const ChallengeRow = ({ challenge, isLive = false }: { challenge: Challenge; isLive?: boolean }) => {
    const config = GAME_CONFIG[challenge.gameType as keyof typeof GAME_CONFIG] || GAME_CONFIG.chess;
    const Icon = config.icon;

    return (
      <div 
        className="flex items-center gap-4 p-4 rounded-lg bg-card/50 hover-elevate transition-all"
        data-testid={`row-challenge-${challenge.id}`}
      >
        <div className={`p-2 rounded-lg ${config.color}`}>
          <Icon className="w-5 h-5" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{challenge.player1Name}</span>
            {challenge.player1Rating && (
              <Badge variant="outline" className={`text-xs ${RANK_COLORS[challenge.player1Rating.rank] || ''}`}>
                {challenge.player1Rating.rank}
              </Badge>
            )}
            {isLive && challenge.player2Name && (
              <>
                <span className="text-muted-foreground">vs</span>
                <span className="font-medium truncate">{challenge.player2Name}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Coins className="w-3 h-3" />
              ${challenge.betAmount}
            </span>
            {challenge.player1Rating && (
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {challenge.player1Rating.winRate}%
              </span>
            )}
            {isLive && challenge.spectatorCount !== undefined && challenge.spectatorCount > 0 && (
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {challenge.spectatorCount}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isLive ? (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate(`/challenge/${challenge.id}/watch`)}
              data-testid={`button-watch-${challenge.id}`}
            >
              <Eye className="w-4 h-4 mr-1" />
              {t('lobby.watch')}
            </Button>
          ) : (
            <Button 
              size="sm"
              onClick={() => joinChallengeMutation.mutate(challenge.id)}
              disabled={joinChallengeMutation.isPending}
              data-testid={`button-join-${challenge.id}`}
            >
              {joinChallengeMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Play className="w-4 h-4 mr-1" />
                  {t('lobby.join')}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Gamepad2 className="w-7 h-7 text-primary" />
              {t('lobby.title')}
            </h1>
            <p className="text-muted-foreground">{t('lobby.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => { refetchAvailable(); refetchLive(); }}
            data-testid="button-refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button onClick={() => navigate('/challenges')} data-testid="button-create-challenge">
            <Sparkles className="w-4 h-4 mr-2" />
            {t('lobby.createChallenge')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {Object.entries(GAME_CONFIG).map(([gameType, config]) => (
          <GameCard key={gameType} gameType={gameType} config={config} />
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <Card className="w-full lg:w-64 shrink-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="w-4 h-4" />
              {t('lobby.filters')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('lobby.searchPlayer')}</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder={t('lobby.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                  data-testid="input-search"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('lobby.betRange')}</label>
              <Slider
                value={betRange}
                onValueChange={(value) => setBetRange(value as [number, number])}
                min={0}
                max={1000}
                step={10}
                data-testid="slider-bet-range"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>${betRange[0]}</span>
                <span>${betRange[1]}</span>
              </div>
            </div>

            {selectedGame && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full"
                onClick={() => setSelectedGame(null)}
                data-testid="button-clear-filter"
              >
                {t('lobby.clearFilter')}
              </Button>
            )}
          </CardContent>
        </Card>

        <div className="flex-1">
          <Tabs defaultValue="available" className="w-full">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="available" className="flex items-center gap-2" data-testid="tab-available">
                <Users className="w-4 h-4" />
                {t('lobby.availableMatches')} ({filteredAvailable.length})
              </TabsTrigger>
              <TabsTrigger value="live" className="flex items-center gap-2" data-testid="tab-live">
                <Flame className="w-4 h-4" />
                {t('lobby.liveMatches')} ({filteredLive.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="available" className="mt-4">
              <ScrollArea className="h-[500px]">
                {loadingAvailable ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredAvailable.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">{t('lobby.noAvailableMatches')}</p>
                    <Button 
                      className="mt-4" 
                      onClick={() => navigate('/challenges')}
                      data-testid="button-create-first"
                    >
                      {t('lobby.createFirstMatch')}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredAvailable.map((challenge: Challenge) => (
                      <ChallengeRow key={challenge.id} challenge={challenge} />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="live" className="mt-4">
              <ScrollArea className="h-[500px]">
                {loadingLive ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredLive.length === 0 ? (
                  <div className="text-center py-12">
                    <Eye className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">{t('lobby.noLiveMatches')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredLive.map((challenge: Challenge) => (
                      <ChallengeRow key={challenge.id} challenge={challenge} isLive />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={showQuickMatch} onOpenChange={setShowQuickMatch}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              {t('lobby.quickMatchTitle')}
            </DialogTitle>
          </DialogHeader>
          
          {quickMatchGame && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                {(() => {
                  const config = GAME_CONFIG[quickMatchGame as keyof typeof GAME_CONFIG];
                  const Icon = config?.icon || Gamepad2;
                  return (
                    <>
                      <div className={`p-3 rounded-lg ${config?.color || ''}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-semibold">
                          {language === 'ar' ? config?.nameAr : config?.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">{t('lobby.findingMatch')}</p>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t('lobby.betAmount')}</label>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[quickMatchBet]}
                    onValueChange={(value) => setQuickMatchBet(value[0])}
                    min={10}
                    max={500}
                    step={10}
                    className="flex-1"
                    data-testid="slider-quickmatch-bet"
                  />
                  <Badge variant="secondary" className="min-w-[60px] justify-center">
                    ${quickMatchBet}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuickMatch(false)} data-testid="button-cancel-quickmatch">
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={startQuickMatch}
              disabled={createChallengeMutation.isPending || joinChallengeMutation.isPending}
              data-testid="button-start-quickmatch"
            >
              {(createChallengeMutation.isPending || joinChallengeMutation.isPending) ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              {t('lobby.startMatch')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isSearching && (
        <Dialog open={isSearching} onOpenChange={setIsSearching}>
          <DialogContent className="text-center">
            <div className="py-8">
              <div className="relative mx-auto w-20 h-20 mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping" />
                <div className="absolute inset-2 rounded-full border-4 border-primary/40 animate-pulse" />
                <div className="absolute inset-4 rounded-full bg-primary/10 flex items-center justify-center">
                  <Search className="w-6 h-6 text-primary" />
                </div>
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('lobby.searchingOpponent')}</h3>
              <p className="text-muted-foreground">{t('lobby.pleaseWait')}</p>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
