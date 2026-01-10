import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Swords, 
  Users, 
  Shuffle, 
  Clock, 
  Trophy, 
  Coins,
  Play,
  X,
  AlertTriangle,
  Timer,
  Target,
  Eye,
  Lock,
  Globe,
  TrendingUp,
  Star,
  Crown,
  Gem,
  Flame,
  Heart,
  Rocket,
  Zap,
  Gift,
  Send,
  ShoppingBag,
  UserPlus,
  UserCheck,
  Bell
} from "lucide-react";

interface PlayerRating {
  wins: number;
  losses: number;
  winRate: number;
  rank: string;
}

interface Challenge {
  id: string;
  gameType: string;
  betAmount: number;
  visibility: 'public' | 'private';
  status: 'waiting' | 'active' | 'completed' | 'cancelled';
  player1Id: string;
  player1Name: string;
  player1Rating?: PlayerRating;
  player2Id?: string;
  player2Name?: string;
  player2Rating?: PlayerRating;
  player1Score?: number;
  player2Score?: number;
  winnerId?: string;
  timeLimit: number;
  spectatorCount?: number;
  totalBets?: number;
  createdAt: string;
  startedAt?: string;
}

interface GiftItem {
  id: string;
  name: string;
  nameAr?: string;
  price: string;
  iconUrl: string;
  category: string;
  coinValue: number;
}

interface InventoryItem {
  id: string;
  giftId: string;
  giftName: string;
  giftNameAr?: string;
  iconUrl: string;
  quantity: number;
  coinValue: number;
}

const CHALLENGE_GAMES = [
  { id: 'domino', name: 'Domino', icon: Target, minBet: 1, maxBet: 100 },
  { id: 'chess', name: 'Chess', icon: Crown, minBet: 5, maxBet: 500 },
  { id: 'backgammon', name: 'Backgammon', icon: Shuffle, minBet: 2, maxBet: 200 },
  { id: 'cards', name: 'Card Game', icon: Gem, minBet: 1, maxBet: 100 },
];

const RANK_COLORS: Record<string, string> = {
  bronze: "bg-amber-700/20 text-amber-600",
  silver: "bg-gray-400/20 text-gray-400",
  gold: "bg-yellow-500/20 text-yellow-500",
  platinum: "bg-cyan-400/20 text-cyan-400",
  diamond: "bg-purple-400/20 text-purple-400",
};

const GIFT_ICONS: Record<string, any> = {
  heart: Heart,
  flame: Flame,
  trophy: Trophy,
  crown: Crown,
  rocket: Rocket,
  gem: Gem,
  star: Star,
  zap: Zap,
};

function RatingBadge({ rating }: { rating?: PlayerRating }) {
  if (!rating) return null;
  return (
    <Badge className={RANK_COLORS[rating.rank] || RANK_COLORS.bronze}>
      {rating.winRate}% ({rating.wins}W/{rating.losses}L)
    </Badge>
  );
}

export default function ChallengesPage() {
  const { t, language } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [showSpectateDialog, setShowSpectateDialog] = useState(false);
  const [showGiftShop, setShowGiftShop] = useState(false);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState("");
  const [opponentType, setOpponentType] = useState<'random' | 'friend'>('random');
  const [friendAccountId, setFriendAccountId] = useState("");
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null);
  const [spectatingChallenge, setSpectatingChallenge] = useState<Challenge | null>(null);
  const [spectatorBetAmount, setSpectatorBetAmount] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  const { data: myChallenges, isLoading: loadingMy } = useQuery<Challenge[]>({
    queryKey: ['/api/challenges/my'],
  });

  const { data: availableChallenges, isLoading: loadingAvailable } = useQuery<Challenge[]>({
    queryKey: ['/api/challenges/available'],
  });

  const { data: publicChallenges, isLoading: loadingPublic } = useQuery<Challenge[]>({
    queryKey: ['/api/challenges/public'],
  });

  const { data: userRating } = useQuery<any>({
    queryKey: ['/api/user/rating'],
  });

  const { data: giftCatalog } = useQuery<GiftItem[]>({
    queryKey: ['/api/gifts'],
  });

  const { data: giftInventory } = useQuery<InventoryItem[]>({
    queryKey: ['/api/gifts/inventory'],
  });

  const { data: followedChallengers } = useQuery<{ userId: string }[]>({
    queryKey: ['/api/challenger-follows'],
  });

  const followedIds = new Set(followedChallengers?.map(f => f.userId) || []);

  const followChallengerMutation = useMutation({
    mutationFn: (userId: string) =>
      apiRequest('/api/challenger-follows', { method: 'POST', body: JSON.stringify({ followedId: userId }) }),
    onSuccess: () => {
      toast({ title: t('common.success'), description: t('challenges.followedChallenger') });
      queryClient.invalidateQueries({ queryKey: ['/api/challenger-follows'] });
    },
    onError: (err: any) => {
      toast({ title: t('common.error'), description: err.message, variant: "destructive" });
    }
  });

  const unfollowChallengerMutation = useMutation({
    mutationFn: (userId: string) =>
      apiRequest(`/api/challenger-follows/${userId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast({ title: t('common.success'), description: t('challenges.unfollowedChallenger') });
      queryClient.invalidateQueries({ queryKey: ['/api/challenger-follows'] });
    },
    onError: (err: any) => {
      toast({ title: t('common.error'), description: err.message, variant: "destructive" });
    }
  });

  const toggleFollow = (userId: string) => {
    if (followedIds.has(userId)) {
      unfollowChallengerMutation.mutate(userId);
    } else {
      followChallengerMutation.mutate(userId);
    }
  };

  const createChallengeMutation = useMutation({
    mutationFn: (data: { gameType: string; betAmount: number; opponentType: string; friendAccountId?: string; visibility: string }) =>
      apiRequest('/api/challenges', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: t('common.success'), description: t('challenges.created') });
      queryClient.invalidateQueries({ queryKey: ['/api/challenges'] });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: t('common.error'), description: err.message, variant: "destructive" });
    }
  });

  const joinChallengeMutation = useMutation({
    mutationFn: (challengeId: string) =>
      apiRequest(`/api/challenges/${challengeId}/join`, { method: 'POST' }),
    onSuccess: () => {
      toast({ title: t('common.success'), description: t('challenges.joined') });
      queryClient.invalidateQueries({ queryKey: ['/api/challenges'] });
    },
    onError: (err: any) => {
      toast({ title: t('common.error'), description: err.message, variant: "destructive" });
    }
  });

  const withdrawChallengeMutation = useMutation({
    mutationFn: (challengeId: string) =>
      apiRequest(`/api/challenges/${challengeId}/withdraw`, { method: 'POST' }),
    onSuccess: () => {
      toast({ title: t('common.success'), description: t('challenges.withdrawn') });
      queryClient.invalidateQueries({ queryKey: ['/api/challenges'] });
      setShowWithdrawDialog(false);
      setActiveChallenge(null);
    },
    onError: (err: any) => {
      toast({ title: t('common.error'), description: err.message, variant: "destructive" });
    }
  });

  const placeBetMutation = useMutation({
    mutationFn: (data: { challengeId: string; backedPlayerId: string; betAmount: number }) =>
      apiRequest(`/api/challenges/${data.challengeId}/bet`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: t('common.success'), description: t('challenges.betPlaced') });
      setSpectatorBetAmount("");
      setSelectedPlayer(null);
    },
    onError: (err: any) => {
      toast({ title: t('common.error'), description: err.message, variant: "destructive" });
    }
  });

  const purchaseGiftMutation = useMutation({
    mutationFn: (data: { giftId: string; quantity: number }) =>
      apiRequest('/api/gifts/purchase', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: t('common.success'), description: t('challenges.giftPurchased') });
      queryClient.invalidateQueries({ queryKey: ['/api/gifts/inventory'] });
    },
    onError: (err: any) => {
      toast({ title: t('common.error'), description: err.message, variant: "destructive" });
    }
  });

  const sendGiftMutation = useMutation({
    mutationFn: (data: { challengeId: string; recipientId: string; giftId: string }) =>
      apiRequest(`/api/challenges/${data.challengeId}/gifts`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: t('common.success'), description: t('challenges.giftSent') });
      queryClient.invalidateQueries({ queryKey: ['/api/gifts/inventory'] });
    },
    onError: (err: any) => {
      toast({ title: t('common.error'), description: err.message, variant: "destructive" });
    }
  });

  const resetForm = () => {
    setSelectedGame(null);
    setBetAmount("");
    setOpponentType('random');
    setFriendAccountId("");
    setVisibility('public');
  };

  const handleCreateChallenge = () => {
    if (!selectedGame || !betAmount) {
      toast({ title: t('common.error'), description: t('challenges.fillAll'), variant: "destructive" });
      return;
    }
    if (opponentType === 'friend' && !friendAccountId) {
      toast({ title: t('common.error'), description: t('challenges.enterFriendId'), variant: "destructive" });
      return;
    }
    createChallengeMutation.mutate({
      gameType: selectedGame,
      betAmount: parseFloat(betAmount),
      opponentType,
      friendAccountId: opponentType === 'friend' ? friendAccountId : undefined,
      visibility,
    });
  };

  const handleSpectate = (challenge: Challenge) => {
    setSpectatingChallenge(challenge);
    setShowSpectateDialog(true);
  };

  const handlePlaceBet = () => {
    if (!spectatingChallenge || !selectedPlayer || !spectatorBetAmount) return;
    placeBetMutation.mutate({
      challengeId: spectatingChallenge.id,
      backedPlayerId: selectedPlayer,
      betAmount: parseFloat(spectatorBetAmount),
    });
  };

  const getGameIcon = (gameType: string) => {
    const game = CHALLENGE_GAMES.find(g => g.id === gameType);
    return game?.icon || Target;
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-challenges-title">
            <Swords className="h-6 w-6 text-primary" />
            {t('nav.challenges')}
          </h1>
          <p className="text-muted-foreground">{t('challenges.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowGiftShop(true)} data-testid="button-gift-shop">
            <ShoppingBag className="h-4 w-4 me-2" />
            {t('challenges.giftShop')}
          </Button>
          <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-challenge">
            <Swords className="h-4 w-4 me-2" />
            {t('challenges.createChallenge')}
          </Button>
        </div>
      </div>

      {userRating && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-primary/20">
                  <Trophy className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">{t('challenges.yourRating')}</p>
                  <Badge className={RANK_COLORS[userRating.rank] || RANK_COLORS.bronze}>
                    {userRating.rank.toUpperCase()}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-6 text-center">
                <div>
                  <p className="text-2xl font-bold text-green-500">{userRating.wins}</p>
                  <p className="text-xs text-muted-foreground">{t('challenges.wins')}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-500">{userRating.losses}</p>
                  <p className="text-xs text-muted-foreground">{t('challenges.losses')}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{userRating.winRate}%</p>
                  <p className="text-xs text-muted-foreground">{t('challenges.winRate')}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">{userRating.currentStreak}</p>
                  <p className="text-xs text-muted-foreground">{t('challenges.streak')}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="arena">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="arena" data-testid="tab-arena">
            <Globe className="h-4 w-4 me-1" />
            {t('challenges.publicArena')}
          </TabsTrigger>
          <TabsTrigger value="available" data-testid="tab-available">
            <Users className="h-4 w-4 me-1" />
            {t('challenges.available')}
          </TabsTrigger>
          <TabsTrigger value="my" data-testid="tab-my-challenges">
            <Swords className="h-4 w-4 me-1" />
            {t('challenges.myChallenges')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="arena">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Eye className="h-5 w-5" />
                {t('challenges.liveMatches')}
              </h3>
            </div>

            {loadingPublic ? (
              <div className="grid md:grid-cols-2 gap-4">
                {[1, 2].map(i => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="h-48" />
                  </Card>
                ))}
              </div>
            ) : publicChallenges && publicChallenges.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-4">
                {publicChallenges.map(challenge => {
                  const GameIcon = getGameIcon(challenge.gameType);
                  return (
                    <Card key={challenge.id} className="overflow-hidden" data-testid={`card-live-challenge-${challenge.id}`}>
                      <CardHeader className="pb-2 bg-primary/5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <GameIcon className="h-5 w-5 text-primary" />
                            <span className="font-semibold capitalize">{challenge.gameType}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="destructive" className="animate-pulse">
                              {t('challenges.live')}
                            </Badge>
                            <Badge variant="outline">
                              <Eye className="h-3 w-3 me-1" />
                              {challenge.spectatorCount}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="text-center flex-1">
                            <div className="flex items-center justify-center gap-1">
                              <p className="font-bold">{challenge.player1Name}</p>
                              {challenge.player1Id !== user?.id && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleFollow(challenge.player1Id);
                                  }}
                                  data-testid={`button-follow-p1-${challenge.id}`}
                                >
                                  {followedIds.has(challenge.player1Id) ? (
                                    <UserCheck className="h-3 w-3 text-primary" />
                                  ) : (
                                    <UserPlus className="h-3 w-3" />
                                  )}
                                </Button>
                              )}
                            </div>
                            <RatingBadge rating={challenge.player1Rating} />
                            <p className="text-3xl font-bold mt-2">{challenge.player1Score || 0}</p>
                          </div>
                          <div className="px-4">
                            <span className="text-2xl font-bold text-muted-foreground">VS</span>
                          </div>
                          <div className="text-center flex-1">
                            <div className="flex items-center justify-center gap-1">
                              <p className="font-bold">{challenge.player2Name}</p>
                              {challenge.player2Id && challenge.player2Id !== user?.id && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleFollow(challenge.player2Id!);
                                  }}
                                  data-testid={`button-follow-p2-${challenge.id}`}
                                >
                                  {followedIds.has(challenge.player2Id) ? (
                                    <UserCheck className="h-3 w-3 text-primary" />
                                  ) : (
                                    <UserPlus className="h-3 w-3" />
                                  )}
                                </Button>
                              )}
                            </div>
                            <RatingBadge rating={challenge.player2Rating} />
                            <p className="text-3xl font-bold mt-2">{challenge.player2Score || 0}</p>
                          </div>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <div className="flex items-center gap-1">
                            <Coins className="h-4 w-4 text-yellow-500" />
                            <span>{t('challenges.totalBets')}: ${challenge.totalBets}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Trophy className="h-4 w-4 text-primary" />
                            <span>{t('challenges.prize')}: ${challenge.betAmount * 2}</span>
                          </div>
                        </div>
                        <Button className="w-full" onClick={() => handleSpectate(challenge)} data-testid={`button-spectate-${challenge.id}`}>
                          <Eye className="h-4 w-4 me-2" />
                          {t('challenges.watchAndBet')}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Eye className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t('challenges.noLiveMatches')}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="available">
          <div className="space-y-4">
            {loadingAvailable ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="h-24" />
                  </Card>
                ))}
              </div>
            ) : availableChallenges && availableChallenges.length > 0 ? (
              availableChallenges.map(challenge => {
                const GameIcon = getGameIcon(challenge.gameType);
                return (
                  <Card key={challenge.id} data-testid={`card-challenge-${challenge.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-primary/20">
                            <GameIcon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold capitalize">{challenge.gameType}</p>
                              {challenge.visibility === 'public' ? (
                                <Globe className="h-4 w-4 text-green-500" />
                              ) : (
                                <Lock className="h-4 w-4 text-yellow-500" />
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm text-muted-foreground">
                                {t('challenges.by')} {challenge.player1Name}
                              </p>
                              {challenge.player1Id !== user?.id && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleFollow(challenge.player1Id);
                                  }}
                                  data-testid={`button-follow-${challenge.player1Id}`}
                                >
                                  {followedIds.has(challenge.player1Id) ? (
                                    <UserCheck className="h-4 w-4 text-primary" />
                                  ) : (
                                    <UserPlus className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                            <RatingBadge rating={challenge.player1Rating} />
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-end">
                            <p className="font-bold text-lg">${challenge.betAmount}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {challenge.timeLimit}s
                            </p>
                          </div>
                          <Button onClick={() => joinChallengeMutation.mutate(challenge.id)} data-testid={`button-join-${challenge.id}`}>
                            <Play className="h-4 w-4 me-1" />
                            {t('challenges.join')}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t('challenges.noAvailable')}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="my">
          <div className="space-y-4">
            {loadingMy ? (
              <div className="space-y-4">
                {[1, 2].map(i => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="h-24" />
                  </Card>
                ))}
              </div>
            ) : myChallenges && myChallenges.length > 0 ? (
              myChallenges.map(challenge => {
                const GameIcon = getGameIcon(challenge.gameType);
                const isCreator = challenge.player1Id === user?.id;
                return (
                  <Card key={challenge.id} data-testid={`card-my-challenge-${challenge.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-primary/20">
                            <GameIcon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold capitalize">{challenge.gameType}</p>
                            <p className="text-sm text-muted-foreground">
                              {challenge.status === 'waiting' 
                                ? t('challenges.waitingForOpponent')
                                : `vs ${isCreator ? challenge.player2Name : challenge.player1Name}`
                              }
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant={
                            challenge.status === 'active' ? 'default' :
                            challenge.status === 'completed' ? 'secondary' :
                            challenge.status === 'cancelled' ? 'destructive' : 'outline'
                          }>
                            {challenge.status}
                          </Badge>
                          <p className="font-bold">${challenge.betAmount}</p>
                          {challenge.status === 'waiting' && isCreator && (
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => {
                                setActiveChallenge(challenge);
                                setShowWithdrawDialog(true);
                              }}
                              data-testid={`button-withdraw-${challenge.id}`}
                            >
                              <X className="h-4 w-4 me-1" />
                              {t('challenges.withdraw')}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Swords className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t('challenges.noChallenges')}</p>
                  <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                    {t('challenges.createFirst')}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Challenge Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Swords className="h-5 w-5" />
              {t('challenges.createChallenge')}
            </DialogTitle>
            <DialogDescription>{t('challenges.createDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('challenges.selectGame')}</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {CHALLENGE_GAMES.map(game => {
                  const Icon = game.icon;
                  return (
                    <Button
                      key={game.id}
                      variant={selectedGame === game.id ? "default" : "outline"}
                      className="h-auto py-3 flex-col"
                      onClick={() => setSelectedGame(game.id)}
                      data-testid={`button-game-${game.id}`}
                    >
                      <Icon className="h-6 w-6 mb-1" />
                      <span>{game.name}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label>{t('challenges.betAmount')}</Label>
              <div className="relative mt-2">
                <Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  placeholder="10.00"
                  className="ps-10"
                  data-testid="input-bet-amount"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>{t('challenges.visibility')}</Label>
                <p className="text-xs text-muted-foreground">
                  {visibility === 'public' ? t('challenges.publicDesc') : t('challenges.privateDesc')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Lock className={`h-4 w-4 ${visibility === 'private' ? 'text-primary' : 'text-muted-foreground'}`} />
                <Switch
                  checked={visibility === 'public'}
                  onCheckedChange={(checked) => setVisibility(checked ? 'public' : 'private')}
                  data-testid="switch-visibility"
                />
                <Globe className={`h-4 w-4 ${visibility === 'public' ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
            </div>

            <div>
              <Label>{t('challenges.opponentType')}</Label>
              <RadioGroup value={opponentType} onValueChange={(v) => setOpponentType(v as 'random' | 'friend')} className="mt-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="random" id="random" />
                  <Label htmlFor="random" className="flex items-center gap-2">
                    <Shuffle className="h-4 w-4" />
                    {t('challenges.randomOpponent')}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="friend" id="friend" />
                  <Label htmlFor="friend" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {t('challenges.inviteFriend')}
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {opponentType === 'friend' && (
              <div>
                <Label>{t('challenges.friendAccountId')}</Label>
                <Input
                  value={friendAccountId}
                  onChange={(e) => setFriendAccountId(e.target.value)}
                  placeholder={t('challenges.enterAccountId')}
                  className="mt-2"
                  data-testid="input-friend-id"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreateChallenge} disabled={createChallengeMutation.isPending}>
              {t('challenges.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdraw Dialog */}
      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {t('challenges.withdrawTitle')}
            </DialogTitle>
            <DialogDescription>{t('challenges.withdrawWarning')}</DialogDescription>
          </DialogHeader>
          {activeChallenge && (
            <div className="p-4 bg-destructive/10 rounded-md">
              <p className="text-sm">
                {t('challenges.penaltyInfo', { amount: (activeChallenge.betAmount * 0.3).toFixed(2) })}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWithdrawDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => activeChallenge && withdrawChallengeMutation.mutate(activeChallenge.id)}
              disabled={withdrawChallengeMutation.isPending}
            >
              {t('challenges.confirmWithdraw')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Spectate Dialog */}
      <Dialog open={showSpectateDialog} onOpenChange={setShowSpectateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {t('challenges.spectating')}
            </DialogTitle>
          </DialogHeader>
          {spectatingChallenge && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg">
                <div className="text-center flex-1">
                  <p className="font-bold">{spectatingChallenge.player1Name}</p>
                  <RatingBadge rating={spectatingChallenge.player1Rating} />
                  <p className="text-4xl font-bold mt-2">{spectatingChallenge.player1Score || 0}</p>
                </div>
                <div className="px-4">
                  <Badge variant="destructive" className="animate-pulse">{t('challenges.live')}</Badge>
                </div>
                <div className="text-center flex-1">
                  <p className="font-bold">{spectatingChallenge.player2Name}</p>
                  <RatingBadge rating={spectatingChallenge.player2Rating} />
                  <p className="text-4xl font-bold mt-2">{spectatingChallenge.player2Score || 0}</p>
                </div>
              </div>

              <Separator />

              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <Coins className="h-4 w-4" />
                  {t('challenges.placeBet')}
                </Label>
                <p className="text-xs text-muted-foreground mb-3">{t('challenges.betWarning')}</p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <Button
                    variant={selectedPlayer === spectatingChallenge.player1Id ? "default" : "outline"}
                    onClick={() => setSelectedPlayer(spectatingChallenge.player1Id)}
                    data-testid="button-bet-player1"
                  >
                    {spectatingChallenge.player1Name}
                  </Button>
                  <Button
                    variant={selectedPlayer === spectatingChallenge.player2Id ? "default" : "outline"}
                    onClick={() => setSelectedPlayer(spectatingChallenge.player2Id || '')}
                    data-testid="button-bet-player2"
                  >
                    {spectatingChallenge.player2Name}
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={spectatorBetAmount}
                    onChange={(e) => setSpectatorBetAmount(e.target.value)}
                    placeholder="10.00"
                    data-testid="input-spectator-bet"
                  />
                  <Button onClick={handlePlaceBet} disabled={!selectedPlayer || !spectatorBetAmount}>
                    {t('challenges.bet')}
                  </Button>
                </div>
              </div>

              <Separator />

              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <Gift className="h-4 w-4" />
                  {t('challenges.sendGift')}
                </Label>
                <ScrollArea className="h-24">
                  <div className="flex gap-2">
                    {giftInventory?.map(item => {
                      const Icon = GIFT_ICONS[item.iconUrl] || Gift;
                      return (
                        <Button
                          key={item.id}
                          variant="outline"
                          size="sm"
                          className="flex-col h-auto py-2 min-w-[60px]"
                          onClick={() => {
                            if (selectedPlayer) {
                              sendGiftMutation.mutate({
                                challengeId: spectatingChallenge.id,
                                recipientId: selectedPlayer,
                                giftId: item.giftId,
                              });
                            }
                          }}
                          disabled={!selectedPlayer || item.quantity < 1}
                          data-testid={`button-send-gift-${item.giftId}`}
                        >
                          <Icon className="h-5 w-5 text-primary" />
                          <span className="text-xs">{item.quantity}</span>
                        </Button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Gift Shop Dialog */}
      <Dialog open={showGiftShop} onOpenChange={setShowGiftShop}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              {t('challenges.giftShop')}
            </DialogTitle>
            <DialogDescription>{t('challenges.giftShopDesc')}</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="shop">
            <TabsList className="w-full">
              <TabsTrigger value="shop" className="flex-1">{t('challenges.shop')}</TabsTrigger>
              <TabsTrigger value="inventory" className="flex-1">{t('challenges.inventory')}</TabsTrigger>
            </TabsList>
            <TabsContent value="shop" className="mt-4">
              <ScrollArea className="h-64">
                <div className="grid grid-cols-2 gap-3">
                  {giftCatalog?.map(gift => {
                    const Icon = GIFT_ICONS[gift.iconUrl] || Gift;
                    return (
                      <Card key={gift.id} className="hover-elevate cursor-pointer" data-testid={`card-gift-${gift.id}`}>
                        <CardContent className="p-3 text-center">
                          <Icon className="h-8 w-8 mx-auto text-primary mb-2" />
                          <p className="font-medium">{language === 'ar' && gift.nameAr ? gift.nameAr : gift.name}</p>
                          <p className="text-sm text-muted-foreground">{gift.coinValue} coins</p>
                          <Button 
                            size="sm" 
                            className="mt-2 w-full"
                            onClick={() => purchaseGiftMutation.mutate({ giftId: gift.id, quantity: 1 })}
                            data-testid={`button-buy-${gift.id}`}
                          >
                            ${gift.price}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="inventory" className="mt-4">
              <ScrollArea className="h-64">
                {giftInventory && giftInventory.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3">
                    {giftInventory.map(item => {
                      const Icon = GIFT_ICONS[item.iconUrl] || Gift;
                      return (
                        <Card key={item.id} data-testid={`card-inventory-${item.giftId}`}>
                          <CardContent className="p-3 text-center">
                            <Icon className="h-8 w-8 mx-auto text-primary mb-2" />
                            <p className="font-medium text-sm">{language === 'ar' && item.giftNameAr ? item.giftNameAr : item.giftName}</p>
                            <Badge variant="secondary" className="mt-1">x{item.quantity}</Badge>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Gift className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">{t('challenges.noGifts')}</p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
