import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  Eye,
  Gift,
  Star,
  Heart,
  Flame,
  Trophy,
  Crown,
  Rocket,
  Gem,
  Zap,
  Send,
  UserPlus,
  UserCheck,
  TrendingUp,
} from "lucide-react";

interface Player {
  id: string;
  username: string;
  avatarUrl?: string;
  vipLevel?: number;
  rating?: {
    wins: number;
    losses: number;
    winRate: number;
    rank: string;
  };
}

interface GiftItem {
  id: string;
  name: string;
  nameAr?: string;
  price: string;
  iconUrl?: string;
  iconName?: string;
  category: string;
  coinValue: number;
}

interface SpectatorPanelProps {
  challengeId: string;
  player1?: Player;
  player2?: Player;
  spectatorCount: number;
}

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

const RANK_COLORS: Record<string, string> = {
  bronze: "bg-amber-700/20 text-amber-600",
  silver: "bg-gray-400/20 text-gray-400",
  gold: "bg-yellow-500/20 text-yellow-500",
  platinum: "bg-cyan-400/20 text-cyan-400",
  diamond: "bg-purple-400/20 text-purple-400",
};

export function SpectatorPanel({
  challengeId,
  player1,
  player2,
  spectatorCount,
}: SpectatorPanelProps) {
  const { t, language } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();

  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null);
  const [pointsAmount, setPointsAmount] = useState("");
  const [showGiftDialog, setShowGiftDialog] = useState(false);
  const [showPointsDialog, setShowPointsDialog] = useState(false);

  const { data: giftCatalog } = useQuery<GiftItem[]>({
    queryKey: ["/api/gifts"],
  });

  const { data: followedChallengers } = useQuery<{ id: string; followedId: string }[]>({
    queryKey: ["/api/challenger-follows"],
  });

  const followedIds = new Set(followedChallengers?.map((f) => f.followedId) || []);

  const sendGiftMutation = useMutation({
    mutationFn: (data: { challengeId: string; recipientId: string; giftId: string }) =>
      apiRequest("/api/challenge-gifts", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({
        title: language === "ar" ? "تم إرسال الهدية!" : "Gift sent!",
      });
      setShowGiftDialog(false);
      setSelectedGift(null);
      setSelectedPlayer(null);
    },
    onError: (err: any) => {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const addPointsMutation = useMutation({
    mutationFn: (data: { challengeId: string; targetPlayerId: string; pointsAmount: number }) =>
      apiRequest("/api/challenge-points", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({
        title: language === "ar" ? "تمت إضافة النقاط!" : "Points added!",
      });
      setShowPointsDialog(false);
      setPointsAmount("");
      setSelectedPlayer(null);
    },
    onError: (err: any) => {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const followMutation = useMutation({
    mutationFn: (userId: string) =>
      apiRequest("/api/challenger-follows", { method: "POST", body: JSON.stringify({ followedId: userId }) }),
    onSuccess: () => {
      toast({ title: language === "ar" ? "تمت المتابعة!" : "Following!" });
      queryClient.invalidateQueries({ queryKey: ["/api/challenger-follows"] });
    },
    onError: (err: any) => {
      toast({ title: language === "ar" ? "خطأ" : "Error", description: err.message, variant: "destructive" });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: (userId: string) =>
      apiRequest(`/api/challenger-follows/${userId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: language === "ar" ? "تم إلغاء المتابعة" : "Unfollowed" });
      queryClient.invalidateQueries({ queryKey: ["/api/challenger-follows"] });
    },
    onError: (err: any) => {
      toast({ title: language === "ar" ? "خطأ" : "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleFollow = (userId: string) => {
    if (followedIds.has(userId)) {
      unfollowMutation.mutate(userId);
    } else {
      followMutation.mutate(userId);
    }
  };

  const handleSendGift = () => {
    if (!selectedGift || !selectedPlayer) return;
    sendGiftMutation.mutate({
      challengeId,
      recipientId: selectedPlayer,
      giftId: selectedGift.id,
    });
  };

  const handleAddPoints = () => {
    if (!selectedPlayer || !pointsAmount) return;
    addPointsMutation.mutate({
      challengeId,
      targetPlayerId: selectedPlayer,
      pointsAmount: parseInt(pointsAmount),
    });
  };

  const renderPlayerCard = (player: Player | undefined, label: string) => {
    if (!player) return null;

    const isFollowing = followedIds.has(player.id);

    return (
      <Card className="mb-3">
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={player.avatarUrl} />
              <AvatarFallback>{player.username?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{player.username}</p>
              <div className="flex items-center gap-2">
                {player.rating && (
                  <Badge className={cn("text-xs", RANK_COLORS[player.rating.rank])}>
                    {player.rating.winRate}%
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                setSelectedPlayer(player.id);
                setShowGiftDialog(true);
              }}
              data-testid={`button-gift-${player.id}`}
            >
              <Gift className="h-4 w-4 me-1" />
              {language === "ar" ? "هدية" : "Gift"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                setSelectedPlayer(player.id);
                setShowPointsDialog(true);
              }}
              data-testid={`button-points-${player.id}`}
            >
              <TrendingUp className="h-4 w-4 me-1" />
              {language === "ar" ? "نقاط" : "Points"}
            </Button>
            <Button
              variant={isFollowing ? "secondary" : "outline"}
              size="icon"
              onClick={() => toggleFollow(player.id)}
              data-testid={`button-follow-${player.id}`}
            >
              {isFollowing ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          <span className="font-medium">
            {language === "ar" ? "المشاهدة" : "Spectating"}
          </span>
        </div>
        <Badge variant="secondary">
          <Eye className="h-3 w-3 me-1" />
          {spectatorCount}
        </Badge>
      </div>

      <ScrollArea className="flex-1 p-3">
        <div className="mb-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            {language === "ar" ? "اللاعبون" : "Players"}
          </h4>
          {renderPlayerCard(player1, language === "ar" ? "لاعب 1" : "Player 1")}
          {renderPlayerCard(player2, language === "ar" ? "لاعب 2" : "Player 2")}
        </div>

        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            {language === "ar" ? "هدايا سريعة" : "Quick Gifts"}
          </h4>
          <div className="grid grid-cols-4 gap-2">
            {giftCatalog?.slice(0, 8).map((gift) => {
              const IconComponent = gift.iconName ? GIFT_ICONS[gift.iconName] : Gift;
              return (
                <Button
                  key={gift.id}
                  variant="outline"
                  size="sm"
                  className="h-14 flex-col gap-1 p-1"
                  onClick={() => {
                    setSelectedGift(gift);
                    setShowGiftDialog(true);
                  }}
                  data-testid={`quick-gift-${gift.id}`}
                >
                  {IconComponent && <IconComponent className="h-5 w-5 text-primary" />}
                  <span className="text-[10px]">${parseFloat(gift.price).toFixed(0)}</span>
                </Button>
              );
            })}
          </div>
        </div>
      </ScrollArea>

      <Dialog open={showGiftDialog} onOpenChange={setShowGiftDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === "ar" ? "إرسال هدية" : "Send Gift"}
            </DialogTitle>
          </DialogHeader>

          {!selectedPlayer && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {language === "ar" ? "اختر اللاعب:" : "Select player:"}
              </p>
              <div className="flex gap-2">
                {player1 && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setSelectedPlayer(player1.id)}
                  >
                    {player1.username}
                  </Button>
                )}
                {player2 && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setSelectedPlayer(player2.id)}
                  >
                    {player2.username}
                  </Button>
                )}
              </div>
            </div>
          )}

          {selectedPlayer && !selectedGift && (
            <div className="grid grid-cols-4 gap-2">
              {giftCatalog?.map((gift) => {
                const IconComponent = gift.iconName ? GIFT_ICONS[gift.iconName] : Gift;
                return (
                  <Button
                    key={gift.id}
                    variant="outline"
                    className="h-20 flex-col gap-1"
                    onClick={() => setSelectedGift(gift)}
                  >
                    {IconComponent && <IconComponent className="h-6 w-6 text-primary" />}
                    <span className="text-xs">{language === "ar" ? gift.nameAr || gift.name : gift.name}</span>
                    <span className="text-xs text-muted-foreground">${parseFloat(gift.price).toFixed(2)}</span>
                  </Button>
                );
              })}
            </div>
          )}

          {selectedGift && (
            <div className="text-center">
              <p className="mb-4">
                {language === "ar" ? "إرسال" : "Send"}{" "}
                <strong>{language === "ar" ? selectedGift.nameAr || selectedGift.name : selectedGift.name}</strong>{" "}
                {language === "ar" ? "إلى" : "to"}{" "}
                <strong>
                  {selectedPlayer === player1?.id ? player1?.username : player2?.username}
                </strong>
              </p>
              <p className="text-lg font-bold text-primary">
                ${parseFloat(selectedGift.price).toFixed(2)}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowGiftDialog(false);
              setSelectedGift(null);
              setSelectedPlayer(null);
            }}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            {selectedGift && selectedPlayer && (
              <Button onClick={handleSendGift} disabled={sendGiftMutation.isPending}>
                <Send className="h-4 w-4 me-2" />
                {language === "ar" ? "إرسال" : "Send"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPointsDialog} onOpenChange={setShowPointsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === "ar" ? "إضافة نقاط للتحدي" : "Add Challenge Points"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {language === "ar" 
                ? "أضف نقاط لرفع مستوى التحدي على هذا اللاعب"
                : "Add points to boost the challenge level for this player"}
            </p>

            <div>
              <label className="text-sm font-medium">
                {language === "ar" ? "عدد النقاط" : "Points Amount"}
              </label>
              <Input
                type="number"
                min="1"
                max="1000"
                value={pointsAmount}
                onChange={(e) => setPointsAmount(e.target.value)}
                placeholder="100"
                data-testid="input-points-amount"
              />
            </div>

            <div className="flex gap-2">
              {[10, 50, 100, 500].map((amount) => (
                <Button
                  key={amount}
                  variant="outline"
                  size="sm"
                  onClick={() => setPointsAmount(String(amount))}
                >
                  {amount}
                </Button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowPointsDialog(false);
              setPointsAmount("");
              setSelectedPlayer(null);
            }}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button 
              onClick={handleAddPoints} 
              disabled={!pointsAmount || addPointsMutation.isPending}
            >
              <TrendingUp className="h-4 w-4 me-2" />
              {language === "ar" ? "إضافة" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
