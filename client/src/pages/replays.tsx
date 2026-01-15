import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Play, Eye, Clock, Trophy, Star, Search, 
  ChevronRight, Film, Users, Calendar 
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { BackButton } from '@/components/BackButton';

interface ReplayPlayer {
  id: string;
  userId: string;
  username?: string;
  nickname?: string;
  profilePicture?: string;
  isWinner: boolean;
  color?: string;
}

interface Replay {
  id: string;
  matchId: string;
  gameId: string;
  gameName?: string;
  title?: string;
  status: string;
  duration: number;
  totalMoves: number;
  viewCount: number;
  isPublic: boolean;
  isFeatured: boolean;
  createdAt: string;
  completedAt?: string;
  players: ReplayPlayer[];
}

function ReplayCard({ replay }: { replay: Replay }) {
  const { t } = useI18n();
  const [, navigate] = useLocation();

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const winner = replay.players.find(p => p.isWinner);

  return (
    <Card 
      className="hover-elevate cursor-pointer transition-all"
      onClick={() => navigate(`/replays/${replay.id}`)}
      data-testid={`card-replay-${replay.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              {replay.isFeatured && (
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
              )}
              <Badge variant="secondary">{replay.gameName || 'Game'}</Badge>
              {replay.title && (
                <span className="text-sm font-medium">{replay.title}</span>
              )}
            </div>

            <div className="flex items-center gap-4">
              {replay.players.slice(0, 2).map((player, idx) => (
                <div key={player.id} className="flex items-center gap-1">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={player.profilePicture || undefined} />
                    <AvatarFallback className="text-xs">
                      {(player.nickname || player.username || 'P')[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">
                    {player.nickname || player.username || `Player ${idx + 1}`}
                  </span>
                  {player.isWinner && (
                    <Trophy className="h-3 w-3 text-yellow-500" />
                  )}
                </div>
              ))}
              {replay.players.length > 2 && (
                <Badge variant="outline">+{replay.players.length - 2}</Badge>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(replay.duration)}
              </span>
              <span className="flex items-center gap-1">
                <Film className="h-3 w-3" />
                {replay.totalMoves} {t('replay.moves')}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {replay.viewCount}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(replay.createdAt)}
              </span>
            </div>
          </div>

          <Button variant="ghost" size="icon">
            <Play className="h-5 w-5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ReplayListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-64" />
              </div>
              <Skeleton className="h-10 w-10 rounded-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function ReplaysPage() {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('featured');

  const { data: featuredReplays, isLoading: featuredLoading } = useQuery<Replay[]>({
    queryKey: ['/api/replays', { featured: 'true', limit: '20' }],
  });

  const { data: allReplays, isLoading: allLoading } = useQuery<Replay[]>({
    queryKey: ['/api/replays', { limit: '50' }],
  });

  const { data: myReplays, isLoading: myLoading } = useQuery<Replay[]>({
    queryKey: ['/api/replays/my'],
  });

  const filterReplays = (replays: Replay[] | undefined) => {
    if (!replays) return [];
    if (!searchQuery) return replays;
    
    const query = searchQuery.toLowerCase();
    return replays.filter(r => 
      r.gameName?.toLowerCase().includes(query) ||
      r.title?.toLowerCase().includes(query) ||
      r.players.some(p => 
        p.username?.toLowerCase().includes(query) ||
        p.nickname?.toLowerCase().includes(query)
      )
    );
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <BackButton />
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Film className="h-6 w-6" />
            {t('replay.title')}
          </h1>
          <p className="text-muted-foreground">{t('replay.subtitle')}</p>
        </div>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            data-testid="input-replay-search"
            placeholder={t('replay.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger data-testid="tab-featured" value="featured">
            <Star className="h-4 w-4 mr-2" />
            {t('replay.featured')}
          </TabsTrigger>
          <TabsTrigger data-testid="tab-all" value="all">
            <Users className="h-4 w-4 mr-2" />
            {t('replay.all')}
          </TabsTrigger>
          <TabsTrigger data-testid="tab-my" value="my">
            <Trophy className="h-4 w-4 mr-2" />
            {t('replay.myReplays')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="featured" className="space-y-3">
          {featuredLoading ? (
            <ReplayListSkeleton />
          ) : filterReplays(featuredReplays)?.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Star className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">{t('replay.noFeatured')}</h3>
                <p className="text-muted-foreground">{t('replay.noFeaturedDesc')}</p>
              </CardContent>
            </Card>
          ) : (
            filterReplays(featuredReplays)?.map((replay) => (
              <ReplayCard key={replay.id} replay={replay} />
            ))
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-3">
          {allLoading ? (
            <ReplayListSkeleton />
          ) : filterReplays(allReplays)?.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Film className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">{t('replay.noReplays')}</h3>
                <p className="text-muted-foreground">{t('replay.noReplaysDesc')}</p>
              </CardContent>
            </Card>
          ) : (
            filterReplays(allReplays)?.map((replay) => (
              <ReplayCard key={replay.id} replay={replay} />
            ))
          )}
        </TabsContent>

        <TabsContent value="my" className="space-y-3">
          {myLoading ? (
            <ReplayListSkeleton />
          ) : filterReplays(myReplays)?.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">{t('replay.noMyReplays')}</h3>
                <p className="text-muted-foreground">{t('replay.noMyReplaysDesc')}</p>
                <Button asChild className="mt-4">
                  <Link href="/multiplayer">
                    {t('replay.playNow')}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            filterReplays(myReplays)?.map((replay) => (
              <ReplayCard key={replay.id} replay={replay} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
