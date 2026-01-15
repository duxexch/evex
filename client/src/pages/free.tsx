import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Gift, 
  Play, 
  Users, 
  Calendar, 
  Video, 
  Copy, 
  Check, 
  Coins, 
  Trophy,
  Star,
  Clock,
  Zap,
  Share2
} from "lucide-react";

export default function FreePage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);

  const referralCode = user?.accountId || "";
  const referralLink = `${window.location.origin}?ref=${referralCode}`;

  interface FreeRewards {
    dailyBonus?: { available: boolean; amount: number; streak: number; nextClaim: string | null };
    adsWatched: number;
    maxAdsPerDay: number;
    adReward: number;
    referrals: number;
    referralReward: number;
    trialGamesPlayed: number;
    trialReward: number;
  }

  const { data: freeRewards, isLoading } = useQuery<FreeRewards>({
    queryKey: ['/api/free/rewards'],
  });

  const claimDailyMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/free/claim-daily'),
    onSuccess: () => {
      toast({ title: t('common.success'), description: t('free.dailyClaimed') });
      queryClient.invalidateQueries({ queryKey: ['/api/free/rewards'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    },
    onError: (err: any) => {
      toast({ title: t('common.error'), description: err.message, variant: "destructive" });
    }
  });

  const watchAdMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/free/watch-ad'),
    onSuccess: () => {
      toast({ title: t('common.success'), description: t('free.adWatched') });
      queryClient.invalidateQueries({ queryKey: ['/api/free/rewards'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    },
    onError: (err: any) => {
      toast({ title: t('common.error'), description: err.message, variant: "destructive" });
    }
  });

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast({ title: t('common.success'), description: t('free.linkCopied') });
    setTimeout(() => setCopied(false), 2000);
  };

  const shareReferral = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'VEX - Join and Get Free Balance!',
          text: `Join VEX using my referral code: ${referralCode}`,
          url: referralLink,
        });
      } catch (err) {
        copyReferralLink();
      }
    } else {
      setShowShareDialog(true);
    }
  };

  const rewards = freeRewards || {
    dailyBonus: { available: true, amount: 0.50, streak: 0, nextClaim: null },
    adsWatched: 0,
    maxAdsPerDay: 10,
    adReward: 0.10,
    referrals: 0,
    referralReward: 5.00,
    trialGamesPlayed: 0,
    trialReward: 0.25,
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/20">
          <Gift className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-free-title">{t('free.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('free.subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <Calendar className="w-8 h-8 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold text-primary">{rewards.dailyBonus?.streak || 0}</p>
            <p className="text-xs text-muted-foreground">{t('free.dayStreak')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Video className="w-8 h-8 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold text-primary">{rewards.adsWatched}/{rewards.maxAdsPerDay}</p>
            <p className="text-xs text-muted-foreground">{t('free.adsToday')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="w-8 h-8 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold text-primary">{rewards.referrals}</p>
            <p className="text-xs text-muted-foreground">{t('free.referrals')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Trophy className="w-8 h-8 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold text-primary">{rewards.trialGamesPlayed}</p>
            <p className="text-xs text-muted-foreground">{t('free.trialsPlayed')}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="daily" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="daily" data-testid="tab-daily">
            <Calendar className="w-4 h-4 me-1" />
            <span className="hidden sm:inline">{t('free.daily')}</span>
          </TabsTrigger>
          <TabsTrigger value="ads" data-testid="tab-ads">
            <Video className="w-4 h-4 me-1" />
            <span className="hidden sm:inline">{t('free.ads')}</span>
          </TabsTrigger>
          <TabsTrigger value="referral" data-testid="tab-referral">
            <Users className="w-4 h-4 me-1" />
            <span className="hidden sm:inline">{t('free.referral')}</span>
          </TabsTrigger>
          <TabsTrigger value="trials" data-testid="tab-trials">
            <Play className="w-4 h-4 me-1" />
            <span className="hidden sm:inline">{t('free.trials')}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                {t('free.dailyBonus')}
              </CardTitle>
              <CardDescription>{t('free.dailyBonusDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-primary/20">
                    <Coins className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold">${rewards.dailyBonus?.amount?.toFixed(2) || '0.50'}</p>
                    <p className="text-xs text-muted-foreground">{t('free.dailyReward')}</p>
                  </div>
                </div>
                <Button 
                  onClick={() => claimDailyMutation.mutate()}
                  disabled={!rewards.dailyBonus?.available || claimDailyMutation.isPending}
                  data-testid="button-claim-daily"
                >
                  {claimDailyMutation.isPending ? (
                    <Clock className="w-4 h-4 animate-spin me-2" />
                  ) : (
                    <Gift className="w-4 h-4 me-2" />
                  )}
                  {rewards.dailyBonus?.available ? t('free.claim') : t('free.claimed')}
                </Button>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{t('free.streakProgress')}</span>
                  <span>{rewards.dailyBonus?.streak || 0}/7 {t('free.days')}</span>
                </div>
                <Progress value={((rewards.dailyBonus?.streak || 0) / 7) * 100} />
                <p className="text-xs text-muted-foreground">{t('free.streakBonus')}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ads" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="w-5 h-5 text-primary" />
                {t('free.watchAds')}
              </CardTitle>
              <CardDescription>{t('free.watchAdsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-primary/20">
                    <Coins className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold">${rewards.adReward?.toFixed(2) || '0.10'}</p>
                    <p className="text-xs text-muted-foreground">{t('free.perAd')}</p>
                  </div>
                </div>
                <Button 
                  onClick={() => watchAdMutation.mutate()}
                  disabled={rewards.adsWatched >= rewards.maxAdsPerDay || watchAdMutation.isPending}
                  data-testid="button-watch-ad"
                >
                  {watchAdMutation.isPending ? (
                    <Clock className="w-4 h-4 animate-spin me-2" />
                  ) : (
                    <Play className="w-4 h-4 me-2" />
                  )}
                  {t('free.watchAd')}
                </Button>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{t('free.adsWatched')}</span>
                  <span>{rewards.adsWatched}/{rewards.maxAdsPerDay}</span>
                </div>
                <Progress value={(rewards.adsWatched / rewards.maxAdsPerDay) * 100} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="referral" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                {t('free.inviteFriends')}
              </CardTitle>
              <CardDescription>{t('free.inviteFriendsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">{t('free.yourReferralCode')}</p>
                <div className="flex items-center gap-2">
                  <Input 
                    value={referralCode} 
                    readOnly 
                    className="font-mono font-bold text-lg"
                    data-testid="input-referral-code"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={copyReferralLink}
                    data-testid="button-copy-referral"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                  <Button 
                    size="icon"
                    onClick={shareReferral}
                    data-testid="button-share-referral"
                  >
                    <Share2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg border border-primary/20">
                <div>
                  <p className="font-bold text-primary">${rewards.referralReward?.toFixed(2) || '5.00'}</p>
                  <p className="text-xs text-muted-foreground">{t('free.perReferral')}</p>
                </div>
                <Badge variant="secondary">
                  <Star className="w-3 h-3 me-1" />
                  {rewards.referrals} {t('free.referred')}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trials" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="w-5 h-5 text-primary" />
                {t('free.trialGames')}
              </CardTitle>
              <CardDescription>{t('free.trialGamesDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {['Dice', 'Coin Flip', 'Lucky Wheel'].map((game, i) => (
                  <div key={game} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/20">
                        <Zap className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{game}</p>
                        <p className="text-xs text-muted-foreground">{t('free.tryFree')}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" data-testid={`button-trial-${i}`}>
                      <Play className="w-4 h-4 me-1" />
                      {t('free.play')}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('free.shareReferral')}</DialogTitle>
            <DialogDescription>{t('free.shareReferralDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input value={referralLink} readOnly className="font-mono text-sm" />
            <Button onClick={copyReferralLink} className="w-full">
              <Copy className="w-4 h-4 me-2" />
              {t('free.copyLink')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
