import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  Crown,
  Target,
  Shuffle,
  Gem,
  Gamepad2,
  Play,
  Eye,
  Users,
  Trophy,
  Flame,
  Zap,
  TrendingUp,
  Star,
  Sparkles,
} from "lucide-react";

interface LiveMatch {
  id: string;
  gameType: string;
  player1Name: string;
  player2Name: string;
  spectatorCount: number;
  betAmount: number;
  status: string;
}

interface GameConfig {
  key: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  icon: typeof Crown;
  gradient: string;
  accentColor: string;
  players: string;
  duration: string;
}

const GAME_CATALOG: GameConfig[] = [
  {
    key: "chess",
    nameEn: "Chess",
    nameAr: "شطرنج",
    descriptionEn: "The classic game of strategy and intellect",
    descriptionAr: "لعبة الذكاء والاستراتيجية الكلاسيكية",
    icon: Crown,
    gradient: "from-amber-500/30 via-amber-600/20 to-yellow-700/10",
    accentColor: "text-amber-500",
    players: "2",
    duration: "15-60 min",
  },
  {
    key: "backgammon",
    nameEn: "Backgammon",
    nameAr: "طاولة الزهر",
    descriptionEn: "Ancient game of luck and skill",
    descriptionAr: "لعبة قديمة تجمع بين الحظ والمهارة",
    icon: Shuffle,
    gradient: "from-emerald-500/30 via-emerald-600/20 to-green-700/10",
    accentColor: "text-emerald-500",
    players: "2",
    duration: "10-30 min",
  },
  {
    key: "domino",
    nameEn: "Domino",
    nameAr: "دومينو",
    descriptionEn: "Match and strategize with tiles",
    descriptionAr: "طابق واستراتيجي مع البلاطات",
    icon: Target,
    gradient: "from-blue-500/30 via-blue-600/20 to-indigo-700/10",
    accentColor: "text-blue-500",
    players: "2-4",
    duration: "15-45 min",
  },
  {
    key: "tarneeb",
    nameEn: "Tarneeb",
    nameAr: "طرنيب",
    descriptionEn: "Popular Middle Eastern trick-taking card game",
    descriptionAr: "لعبة الورق الشعبية في الشرق الأوسط",
    icon: Gem,
    gradient: "from-purple-500/30 via-purple-600/20 to-violet-700/10",
    accentColor: "text-purple-500",
    players: "4",
    duration: "20-40 min",
  },
  {
    key: "baloot",
    nameEn: "Baloot",
    nameAr: "بلوت",
    descriptionEn: "Traditional Saudi Arabian card game",
    descriptionAr: "لعبة الورق التقليدية السعودية",
    icon: Gem,
    gradient: "from-rose-500/30 via-rose-600/20 to-pink-700/10",
    accentColor: "text-rose-500",
    players: "4",
    duration: "30-60 min",
  },
];

export default function GamesCatalogPage() {
  const { t, language } = useI18n();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [animatedStats, setAnimatedStats] = useState({ players: 0, matches: 0, spectators: 0 });

  const { data: liveMatches = [] } = useQuery<LiveMatch[]>({
    queryKey: ["/api/challenges/public"],
    refetchInterval: 5000,
  });

  const { data: gameStats } = useQuery<Record<string, { waiting: number; live: number }>>({
    queryKey: ["/api/game-stats"],
    refetchInterval: 10000,
  });

  useEffect(() => {
    const totalPlayers = liveMatches.length * 2;
    const totalSpectators = liveMatches.reduce((sum, m) => sum + (m.spectatorCount || 0), 0);
    
    const duration = 1000;
    const steps = 30;
    const interval = duration / steps;
    
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      setAnimatedStats({
        players: Math.round(totalPlayers * progress),
        matches: Math.round(liveMatches.length * progress),
        spectators: Math.round(totalSpectators * progress),
      });
      if (step >= steps) clearInterval(timer);
    }, interval);

    return () => clearInterval(timer);
  }, [liveMatches]);

  const handlePlayNow = (gameKey: string) => {
    if (!user) {
      navigate("/auth");
      return;
    }
    navigate(`/lobby?game=${gameKey}`);
  };

  const handleWatchLive = (gameKey: string) => {
    const liveMatch = liveMatches.find((m) => m.gameType === gameKey);
    if (liveMatch) {
      navigate(`/challenge/${liveMatch.id}/watch`);
    } else {
      navigate(`/lobby?game=${gameKey}&tab=live`);
    }
  };

  const getGameLiveCount = (gameKey: string) => {
    return liveMatches.filter((m) => m.gameType === gameKey).length;
  };

  return (
    <div className="min-h-screen">
      <div className="relative overflow-hidden bg-gradient-to-br from-background via-muted/30 to-background py-12 px-4">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="max-w-6xl mx-auto text-center relative">
          <Badge variant="outline" className="mb-4 px-4 py-1.5 text-sm">
            <Sparkles className="w-4 h-4 mr-2" />
            {language === "ar" ? "شاهد واربح" : "Watch & Win"}
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {language === "ar" ? "الألعاب الحية" : "Live Games Arena"}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            {language === "ar"
              ? "شاهد المباريات المباشرة، ادعم لاعبك المفضل بالهدايا، واربح جوائز حقيقية"
              : "Watch live matches, support your favorite player with gifts, and win real prizes"}
          </p>

          <div className="flex justify-center gap-6 flex-wrap">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card/50 backdrop-blur-sm border">
              <Users className="w-5 h-5 text-primary" />
              <div className="text-start">
                <p className="text-2xl font-bold">{animatedStats.players}</p>
                <p className="text-xs text-muted-foreground">
                  {language === "ar" ? "لاعبين نشطين" : "Active Players"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card/50 backdrop-blur-sm border">
              <Flame className="w-5 h-5 text-orange-500" />
              <div className="text-start">
                <p className="text-2xl font-bold">{animatedStats.matches}</p>
                <p className="text-xs text-muted-foreground">
                  {language === "ar" ? "مباريات حية" : "Live Matches"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card/50 backdrop-blur-sm border">
              <Eye className="w-5 h-5 text-cyan-500" />
              <div className="text-start">
                <p className="text-2xl font-bold">{animatedStats.spectators}</p>
                <p className="text-xs text-muted-foreground">
                  {language === "ar" ? "مشاهدين" : "Spectators"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {GAME_CATALOG.map((game) => {
            const liveCount = getGameLiveCount(game.key);
            const Icon = game.icon;
            const isSelected = selectedGame === game.key;

            return (
              <Card
                key={game.key}
                className={cn(
                  "group relative overflow-hidden transition-all duration-300 hover-elevate game-card-glow cursor-pointer",
                  isSelected && "ring-2 ring-primary"
                )}
                onClick={() => setSelectedGame(isSelected ? null : game.key)}
                data-testid={`game-card-${game.key}`}
              >
                <div className={cn("absolute inset-0 bg-gradient-to-br opacity-60", game.gradient)} />
                
                {liveCount > 0 && (
                  <div className="absolute top-3 right-3 z-10">
                    <Badge variant="destructive" className="gap-1 animate-pulse">
                      <div className="w-2 h-2 rounded-full bg-white" />
                      {liveCount} {language === "ar" ? "مباشر" : "LIVE"}
                    </Badge>
                  </div>
                )}

                <CardContent className="relative p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <div
                      className={cn(
                        "p-4 rounded-2xl bg-background/80 backdrop-blur-sm border shadow-lg transition-transform group-hover:scale-110",
                        game.accentColor
                      )}
                    >
                      <Icon className="w-8 h-8" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold mb-1">
                        {language === "ar" ? game.nameAr : game.nameEn}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {language === "ar" ? game.descriptionAr : game.descriptionEn}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mb-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{game.players}</span>
                    </div>
                    <div className="w-1 h-1 rounded-full bg-muted-foreground" />
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      <span>{game.duration}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      className="flex-1 gap-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayNow(game.key);
                      }}
                      data-testid={`play-${game.key}`}
                    >
                      <Play className="w-4 h-4" />
                      {language === "ar" ? "العب الآن" : "Play Now"}
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleWatchLive(game.key);
                      }}
                      data-testid={`watch-${game.key}`}
                    >
                      <Eye className="w-4 h-4" />
                      {language === "ar" ? "شاهد" : "Watch"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {liveMatches.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <Flame className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">
                    {language === "ar" ? "مباريات حية الآن" : "Live Matches Now"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {language === "ar"
                      ? "انضم كمشاهد وادعم لاعبك المفضل"
                      : "Join as spectator and support your favorite player"}
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={() => navigate("/lobby?tab=live")} data-testid="button-view-all-live">
                {language === "ar" ? "عرض الكل" : "View All"}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveMatches.slice(0, 6).map((match) => {
                const gameConfig = GAME_CATALOG.find((g) => g.key === match.gameType);
                const Icon = gameConfig?.icon || Gamepad2;

                return (
                  <Card
                    key={match.id}
                    className="group hover-elevate cursor-pointer"
                    onClick={() => navigate(`/challenge/${match.id}/watch`)}
                    data-testid={`live-match-${match.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={cn("p-1.5 rounded-lg bg-muted", gameConfig?.accentColor)}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-medium">
                            {language === "ar" ? gameConfig?.nameAr : gameConfig?.nameEn}
                          </span>
                        </div>
                        <Badge variant="destructive" className="gap-1 text-xs">
                          <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          LIVE
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                            {match.player1Name?.[0]?.toUpperCase()}
                          </div>
                          <span className="font-medium truncate max-w-[80px]">
                            {match.player1Name}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-xs">VS</Badge>
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate max-w-[80px]">
                            {match.player2Name}
                          </span>
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm font-bold">
                            {match.player2Name?.[0]?.toUpperCase()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          <span>{match.spectatorCount || 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Trophy className="w-4 h-4 text-yellow-500" />
                          <span>${match.betAmount}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-12 text-center">
          <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-primary/20">
            <CardContent className="py-8">
              <Star className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-2xl font-bold mb-2">
                {language === "ar" ? "هل أنت مستعد للتحدي؟" : "Ready for the Challenge?"}
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                {language === "ar"
                  ? "انضم إلى الآلاف من اللاعبين وابدأ رحلتك نحو القمة"
                  : "Join thousands of players and start your journey to the top"}
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Button size="lg" onClick={() => navigate("/lobby")} className="gap-2" data-testid="button-start-playing">
                  <Zap className="w-5 h-5" />
                  {language === "ar" ? "ابدأ اللعب" : "Start Playing"}
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate("/lobby?tab=live")} className="gap-2" data-testid="button-watch-matches">
                  <Eye className="w-5 h-5" />
                  {language === "ar" ? "شاهد المباريات" : "Watch Matches"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
