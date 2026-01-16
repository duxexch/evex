import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
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
  Coins,
  Play,
  Search,
  Target,
  Crown,
  Gem,
  Zap,
  Eye,
  TrendingUp,
  RefreshCw,
  Loader2,
  Sparkles,
  Flame,
  User,
  X
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
  chess: { name: 'Chess', nameAr: 'شطرنج', icon: Crown, color: 'bg-amber-500/20 text-amber-500 border-amber-500/30', gradient: 'from-amber-500/20 to-amber-600/10' },
  domino: { name: 'Domino', nameAr: 'دومينو', icon: Target, color: 'bg-blue-500/20 text-blue-500 border-blue-500/30', gradient: 'from-blue-500/20 to-blue-600/10' },
  backgammon: { name: 'Backgammon', nameAr: 'طاولة', icon: Shuffle, color: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30', gradient: 'from-emerald-500/20 to-emerald-600/10' },
  tarneeb: { name: 'Tarneeb', nameAr: 'طرنيب', icon: Gem, color: 'bg-purple-500/20 text-purple-500 border-purple-500/30', gradient: 'from-purple-500/20 to-purple-600/10' },
  baloot: { name: 'Baloot', nameAr: 'بلوت', icon: Gem, color: 'bg-rose-500/20 text-rose-500 border-rose-500/30', gradient: 'from-rose-500/20 to-rose-600/10' },
};

const RANK_COLORS: Record<string, string> = {
  bronze: "bg-amber-700/20 text-amber-600 border-amber-700/30",
  silver: "bg-gray-400/20 text-gray-400 border-gray-400/30",
  gold: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
  platinum: "bg-cyan-400/20 text-cyan-400 border-cyan-400/30",
  diamond: "bg-purple-400/20 text-purple-400 border-purple-400/30",
};

const STAKE_PRESETS = [
  { key: 'all', min: 0, max: 10000 },
  { key: 'low', min: 0, max: 50 },
  { key: 'medium', min: 50, max: 200 },
  { key: 'high', min: 200, max: 10000 },
];

export default function GameLobbyPage() {
  const { t, language } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [stakePreset, setStakePreset] = useState('all');
  const [betRange, setBetRange] = useState<[number, number]>([0, 10000]);
  const [showQuickMatch, setShowQuickMatch] = useState(false);
  const [quickMatchGame, setQuickMatchGame] = useState<string | null>(null);
  const [quickMatchBet, setQuickMatchBet] = useState(50);
  const [isSearching, setIsSearching] = useState(false);
  const [newMatchIds, setNewMatchIds] = useState<Set<string>>(new Set());
  const prevAvailableRef = useRef<string[]>([]);

  const { data: availableChallenges = [], isLoading: loadingAvailable, refetch: refetchAvailable } = useQuery<Challenge[]>({
    queryKey: ['/api/challenges/available'],
    refetchInterval: 5000,
  });

  const { data: liveChallenges = [], isLoading: loadingLive, refetch: refetchLive } = useQuery<Challenge[]>({
    queryKey: ['/api/challenges/public'],
    refetchInterval: 5000,
  });

  // Track new matches for animation
  useEffect(() => {
    const currentIds = availableChallenges.map(c => c.id);
    const prevIds = prevAvailableRef.current;
    const newIds = currentIds.filter(id => !prevIds.includes(id));
    
    if (newIds.length > 0 && prevIds.length > 0) {
      setNewMatchIds(new Set(newIds));
      setTimeout(() => setNewMatchIds(new Set()), 3000);
    }
    prevAvailableRef.current = currentIds;
  }, [availableChallenges]);

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

  // Your own waiting challenges
  const yourChallenges = availableChallenges.filter((c: Challenge) => 
    c.player1Id === user?.id && c.status === 'waiting'
  );

  // Other players' open matches
  const openMatches = availableChallenges.filter((c: Challenge) => {
    if (c.player1Id === user?.id) return false;
    if (selectedGame && c.gameType !== selectedGame) return false;
    if (c.betAmount < betRange[0] || c.betAmount > betRange[1]) return false;
    if (searchQuery && !c.player1Name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return c.status === 'waiting';
  });

  // Active games for spectating
  const liveGames = liveChallenges.filter((c: Challenge) => {
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
        c.player1Id !== user?.id &&
        Math.abs(c.betAmount - quickMatchBet) <= quickMatchBet * 0.3
    );

    if (matchingChallenge) {
      joinChallengeMutation.mutate(matchingChallenge.id);
    } else {
      createChallengeMutation.mutate({ gameType: quickMatchGame, betAmount: quickMatchBet });
    }
    setShowQuickMatch(false);
  };

  const handleStakePreset = (preset: typeof STAKE_PRESETS[0]) => {
    setStakePreset(preset.key);
    setBetRange([preset.min, preset.max]);
  };

  const GameTypeButton = ({ gameType, config }: { gameType: string; config: typeof GAME_CONFIG[keyof typeof GAME_CONFIG] }) => {
    const Icon = config.icon;
    const isSelected = selectedGame === gameType;
    const matchCount = availableChallenges.filter((c: Challenge) => c.gameType === gameType && c.status === 'waiting').length;
    
    return (
      <Button
        variant={isSelected ? "default" : "outline"}
        size="sm"
        onClick={() => setSelectedGame(isSelected ? null : gameType)}
        className={`gap-2 ${isSelected ? '' : config.color}`}
        data-testid={`button-filter-${gameType}`}
      >
        <Icon className="w-4 h-4" />
        <span className="hidden sm:inline">{language === 'ar' ? config.nameAr : config.name}</span>
        {matchCount > 0 && (
          <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
            {matchCount}
          </Badge>
        )}
      </Button>
    );
  };

  const GameCard = ({ gameType, config }: { gameType: string; config: typeof GAME_CONFIG[keyof typeof GAME_CONFIG] }) => {
    const Icon = config.icon;
    const waitingCount = availableChallenges.filter((c: Challenge) => c.gameType === gameType && c.status === 'waiting').length;
    const liveCount = liveChallenges.filter((c: Challenge) => c.gameType === gameType && c.status === 'active').length;

    return (
      <Card 
        className={`hover-elevate cursor-pointer transition-all overflow-hidden ${selectedGame === gameType ? 'ring-2 ring-primary' : ''}`}
        onClick={() => setSelectedGame(selectedGame === gameType ? null : gameType)}
        data-testid={`card-game-${gameType}`}
      >
        <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient} opacity-50`} />
        <CardContent className="p-4 relative">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${config.color} border`}>
              <Icon className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold">{language === 'ar' ? config.nameAr : config.name}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  <Users className="w-3 h-3 mr-1" />
                  {waitingCount}
                </Badge>
                {liveCount > 0 && (
                  <Badge className="text-xs bg-red-500/20 text-red-500 border-red-500/30">
                    <div className="w-2 h-2 rounded-full bg-red-500 mr-1 animate-pulse" />
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
              <Zap className="w-4 h-4" />
              <span className="hidden lg:inline ml-1">{t('lobby.quickMatch')}</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const ChallengeRow = ({ challenge, type }: { challenge: Challenge; type: 'yours' | 'open' | 'live' }) => {
    const config = GAME_CONFIG[challenge.gameType as keyof typeof GAME_CONFIG] || GAME_CONFIG.chess;
    const Icon = config.icon;
    const isNew = newMatchIds.has(challenge.id);

    return (
      <div 
        className={`relative flex items-center gap-4 p-4 rounded-lg bg-card/50 hover-elevate transition-all ${isNew ? 'ring-2 ring-primary' : ''}`}
        data-testid={`row-challenge-${challenge.id}`}
      >
        {isNew && (
          <Badge className="absolute -top-2 -right-2 bg-primary text-xs px-1.5 z-10">{t('lobby.new')}</Badge>
        )}
        
        <div className={`p-2 rounded-lg ${config.color} border shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{challenge.player1Name}</span>
            {challenge.player1Rating && (
              <Badge variant="outline" className={`text-xs ${RANK_COLORS[challenge.player1Rating.rank] || ''}`}>
                {challenge.player1Rating.rank}
              </Badge>
            )}
            {type === 'live' && challenge.player2Name && (
              <>
                <span className="text-muted-foreground">vs</span>
                <span className="font-medium truncate">{challenge.player2Name}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
            <Badge variant="secondary" className="text-xs">
              {language === 'ar' ? config.nameAr : config.name}
            </Badge>
            <span className="flex items-center gap-1">
              <Coins className="w-3 h-3 text-yellow-500" />
              ${challenge.betAmount}
            </span>
            {challenge.player1Rating && (
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {challenge.player1Rating.winRate}%
              </span>
            )}
            {type === 'live' && challenge.spectatorCount !== undefined && challenge.spectatorCount > 0 && (
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {challenge.spectatorCount}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {type === 'yours' && (
            <Button 
              variant="outline"
              size="sm"
              onClick={() => navigate(`/challenge/${challenge.id}/play`)}
              data-testid={`button-resume-${challenge.id}`}
            >
              <Clock className="w-4 h-4 mr-1" />
              {t('lobby.waiting')}
            </Button>
          )}
          {type === 'open' && (
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
          {type === 'live' && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate(`/challenge/${challenge.id}/watch`)}
              data-testid={`button-watch-${challenge.id}`}
            >
              <Eye className="w-4 h-4 mr-1" />
              {t('lobby.watch')}
            </Button>
          )}
        </div>
      </div>
    );
  };

  const EmptyState = ({ type }: { type: 'yours' | 'open' | 'live' }) => {
    const configs = {
      yours: { icon: User, message: t('lobby.noYourChallenges'), action: t('lobby.createFirstMatch') },
      open: { icon: Users, message: t('lobby.noOpenMatches'), action: t('lobby.createFirstMatch') },
      live: { icon: Eye, message: t('lobby.noLiveMatches'), action: null },
    };
    const config = configs[type];
    
    return (
      <div className="text-center py-12">
        <config.icon className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
        <p className="text-muted-foreground">{config.message}</p>
        {config.action && (
          <Button 
            className="mt-4" 
            onClick={() => navigate('/challenges')}
            data-testid={`button-create-${type}`}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {config.action}
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <BackButton data-testid="button-back" />
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Gamepad2 className="w-7 h-7 text-primary" />
              {t('lobby.title')}
            </h1>
            <p className="text-muted-foreground text-sm">{t('lobby.subtitle')}</p>
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

      {/* Game Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {Object.entries(GAME_CONFIG).map(([gameType, config]) => (
          <GameCard key={gameType} gameType={gameType} config={config} />
        ))}
      </div>

      {/* Filters Bar */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          {/* Game Type Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground mr-2">{t('lobby.gameType')}:</span>
            <Button
              variant={selectedGame === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedGame(null)}
              data-testid="button-filter-all"
            >
              {t('lobby.allGames')}
            </Button>
            {Object.entries(GAME_CONFIG).map(([gameType, config]) => (
              <GameTypeButton key={gameType} gameType={gameType} config={config} />
            ))}
          </div>

          {/* Stake Presets */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground mr-2">{t('lobby.stakes')}:</span>
            {STAKE_PRESETS.map((preset) => (
              <Button
                key={preset.key}
                variant={stakePreset === preset.key ? "default" : "outline"}
                size="sm"
                onClick={() => handleStakePreset(preset)}
                data-testid={`button-stake-${preset.key}`}
              >
                {t(`lobby.stake${preset.key.charAt(0).toUpperCase() + preset.key.slice(1)}`)}
              </Button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full lg:w-64">
            <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder={t('lobby.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
              data-testid="input-search"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 px-2"
                onClick={() => setSearchQuery("")}
                data-testid="button-clear-search"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Main Content with Three Tabs */}
      <Tabs defaultValue="open" className="w-full">
        <TabsList className="w-full justify-start mb-4 h-auto p-1 flex-wrap gap-1">
          <TabsTrigger value="yours" className="flex items-center gap-2" data-testid="tab-yours">
            <User className="w-4 h-4" />
            {t('lobby.yourChallenges')}
            {yourChallenges.length > 0 && (
              <Badge variant="secondary" className="ml-1">{yourChallenges.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="open" className="flex items-center gap-2" data-testid="tab-open">
            <Users className="w-4 h-4" />
            {t('lobby.openMatches')}
            <Badge variant="secondary" className="ml-1">{openMatches.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="live" className="flex items-center gap-2" data-testid="tab-live">
            <div className="relative">
              <Flame className="w-4 h-4" />
              {liveGames.length > 0 && (
                <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
            </div>
            {t('lobby.liveGames')}
            <Badge variant="secondary" className="ml-1">{liveGames.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="yours">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {t('lobby.yourWaitingChallenges')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {loadingAvailable ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : yourChallenges.length === 0 ? (
                  <EmptyState type="yours" />
                ) : (
                  <div className="space-y-2">
                    {yourChallenges.map((challenge: Challenge) => (
                      <ChallengeRow key={challenge.id} challenge={challenge} type="yours" />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="open">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4" />
                {t('lobby.availableToJoin')}
                {newMatchIds.size > 0 && (
                  <Badge className="bg-primary animate-pulse">{t('lobby.newMatches')}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {loadingAvailable ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : openMatches.length === 0 ? (
                  <EmptyState type="open" />
                ) : (
                  <div className="space-y-2">
                    {openMatches.map((challenge: Challenge) => (
                      <ChallengeRow key={challenge.id} challenge={challenge} type="open" />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="live">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="w-4 h-4" />
                {t('lobby.watchLiveGames')}
                {liveGames.length > 0 && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-sm text-red-500">{t('lobby.live')}</span>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {loadingLive ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : liveGames.length === 0 ? (
                  <EmptyState type="live" />
                ) : (
                  <div className="space-y-2">
                    {liveGames.map((challenge: Challenge) => (
                      <ChallengeRow key={challenge.id} challenge={challenge} type="live" />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Match Dialog */}
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
                      <div className={`p-3 rounded-lg ${config?.color || ''} border`}>
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

      {/* Searching Animation Dialog */}
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
