import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Share2, Eye, Clock, Trophy, Star, Download, 
  Film, Calendar, Lock, Globe, Trash2, ArrowLeft 
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { ReplayPlayerComponent } from '@/components/games/ReplayPlayer';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface ReplayEvent {
  id: string;
  eventType: string;
  eventData: string;
  timestamp: number;
  sequenceNumber: number;
  playerId?: string;
}

interface ReplayPlayer {
  id: string;
  userId: string;
  username?: string;
  nickname?: string;
  profilePicture?: string;
  isWinner: boolean;
  color?: string;
  position: number;
}

interface ReplayData {
  id: string;
  matchId: string;
  gameId: string;
  gameName?: string;
  gameCategory?: string;
  title?: string;
  status: string;
  duration: number;
  totalMoves: number;
  viewCount: number;
  isPublic: boolean;
  isFeatured: boolean;
  winnerId?: string;
  createdAt: string;
  completedAt?: string;
  events: ReplayEvent[];
  players: ReplayPlayer[];
}

export default function ReplayViewPage() {
  const { t } = useI18n();
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: replay, isLoading, error } = useQuery<ReplayData>({
    queryKey: ['/api/replays', id],
    enabled: !!id,
  });

  const visibilityMutation = useMutation({
    mutationFn: async (isPublic: boolean) => {
      return apiRequest(`/api/replays/${id}/visibility`, 'PATCH', { isPublic });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/replays', id] });
      toast({
        title: t('replay.visibilityUpdated'),
        description: t('replay.visibilityUpdatedDesc'),
      });
    },
    onError: () => {
      toast({
        title: t('error'),
        description: t('replay.visibilityError'),
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/replays/${id}`, 'DELETE');
    },
    onSuccess: () => {
      toast({
        title: t('replay.deleted'),
        description: t('replay.deletedDesc'),
      });
      navigate('/replays');
    },
    onError: () => {
      toast({
        title: t('error'),
        description: t('replay.deleteError'),
        variant: 'destructive',
      });
    },
  });

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: replay?.title || t('replay.shareTitle'),
          url,
        });
      } catch {
        await navigator.clipboard.writeText(url);
        toast({ title: t('replay.linkCopied') });
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: t('replay.linkCopied') });
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 max-w-4xl space-y-4">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-[400px] w-full" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  if (error || !replay) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <Card>
          <CardContent className="py-12 text-center">
            <Film className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">{t('replay.notFound')}</h3>
            <p className="text-muted-foreground mb-4">{t('replay.notFoundDesc')}</p>
            <Button onClick={() => navigate('/replays')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('replay.backToReplays')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderGameState = (currentEvent: ReplayEvent | null, events: ReplayEvent[]) => {
    if (events.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          {t('replay.pressPlayToStart')}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground mb-2">
          {t('replay.currentState')}:
        </div>
        {currentEvent && (
          <div className="bg-background p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Badge>{currentEvent.eventType}</Badge>
              <span className="text-xs text-muted-foreground">
                Seq: {currentEvent.sequenceNumber}
              </span>
            </div>
            <pre className="text-xs overflow-x-auto">
              {JSON.stringify(JSON.parse(currentEvent.eventData || '{}'), null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/replays')}
          data-testid="button-back-to-replays"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('replay.backToReplays')}
        </Button>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleShare}
            data-testid="button-share-replay"
          >
            <Share2 className="h-4 w-4 mr-2" />
            {t('share')}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                {replay.isFeatured && (
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                )}
                <Badge variant="secondary">{replay.gameName}</Badge>
                {replay.gameCategory && (
                  <Badge variant="outline">{replay.gameCategory}</Badge>
                )}
              </div>
              <CardTitle>{replay.title || t('replay.untitled')}</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {replay.isPublic ? (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  {t('replay.public')}
                </Badge>
              ) : (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  {t('replay.private')}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              {replay.viewCount} {t('replay.views')}
            </span>
            <span className="flex items-center gap-1">
              <Film className="h-4 w-4" />
              {replay.totalMoves} {t('replay.moves')}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {formatDate(replay.createdAt)}
            </span>
          </div>
        </CardContent>
      </Card>

      <ReplayPlayerComponent
        events={replay.events}
        players={replay.players}
        duration={replay.duration}
        gameName={replay.gameName}
        renderGameState={renderGameState}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('replay.settings')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t('replay.publicVisibility')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('replay.publicVisibilityDesc')}
              </p>
            </div>
            <Switch
              data-testid="switch-replay-visibility"
              checked={replay.isPublic}
              onCheckedChange={(checked) => visibilityMutation.mutate(checked)}
              disabled={visibilityMutation.isPending}
            />
          </div>

          <div className="pt-4 border-t">
            <Button
              data-testid="button-delete-replay"
              variant="destructive"
              onClick={() => {
                if (confirm(t('replay.deleteConfirm'))) {
                  deleteMutation.mutate();
                }
              }}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t('replay.delete')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
