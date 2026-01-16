import { useMemo } from 'react';
import { useParams, useLocation } from 'wouter';
import { TarneebBoard } from '@/components/games/TarneebBoard';
import { useGameWebSocket } from '@/hooks/useGameWebSocket';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Wifi, WifiOff, Users, ArrowLeft, Share2, AlertCircle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function TarneebGame() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();

  const {
    connectionStatus,
    gameState,
    spectatorCount,
    gameResult,
    error,
    makeMove,
    forceReconnect
  } = useGameWebSocket(sessionId || null);

  const tarneebState = gameState as any;

  const isValidTarneebState = useMemo(() => {
    if (!tarneebState) return false;
    return tarneebState.hand !== undefined && 
           tarneebState.gamePhase !== undefined &&
           tarneebState.currentTurn !== undefined;
  }, [tarneebState]);

  const playerPosition = useMemo(() => {
    if (!user?.id || !tarneebState?.playerOrder) return 0;
    const pos = tarneebState.playerOrder.indexOf(String(user.id));
    return pos >= 0 ? pos : 0;
  }, [tarneebState?.playerOrder, user?.id]);

  const boardState = useMemo(() => {
    if (!tarneebState) return null;
    
    const hands: { [playerId: string]: any[] } = {};
    if (user?.id && tarneebState.hand) {
      hands[String(user.id)] = tarneebState.hand;
    }
    if (tarneebState.otherHandCounts) {
      for (const [pid, count] of Object.entries(tarneebState.otherHandCounts)) {
        hands[pid] = Array(count as number).fill({ suit: 'spades', rank: 'X', value: 0, hidden: true });
      }
    }

    const serverTricksWon = tarneebState.tricksWon || { team0: 0, team1: 0 };
    const serverScores = tarneebState.totalScores || { team0: 0, team1: 0 };

    return {
      phase: tarneebState.gamePhase === 'bidding' ? 'bidding' : 
             tarneebState.gamePhase === 'finished' ? 'finished' : 'playing',
      hands,
      currentTrick: tarneebState.currentTrick || [],
      trumpSuit: tarneebState.trumpSuit || null,
      currentPlayer: tarneebState.currentTurn || '',
      bids: tarneebState.bids || [],
      highestBid: tarneebState.highestBid || null,
      tricksWon: { team1: serverTricksWon.team0, team2: serverTricksWon.team1 },
      scores: { team1: serverScores.team0, team2: serverScores.team1 },
      dealerId: tarneebState.playerOrder?.[0] || '',
      winningTeam: tarneebState.winner ? 
        (tarneebState.playerOrder?.indexOf(tarneebState.winner) % 2 === 0 ? 1 : 2) : undefined
    };
  }, [tarneebState, user?.id]);

  const handleBid = (bid: number) => {
    makeMove({ type: 'bid', bid });
  };

  const handlePass = () => {
    makeMove({ type: 'bid', bid: null });
  };

  const handlePlayCard = (card: any) => {
    makeMove({ type: 'playCard', card });
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: t('tarneeb.title'),
          text: t('tarneeb.shareText'),
          url: shareUrl
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast({
          title: t('common.success'),
          description: t('tarneeb.linkCopied')
        });
      }
    } catch (e) {
      console.error('Share failed:', e);
    }
  };

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">{t('tarneeb.invalidSession')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <p className="text-destructive">{error}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setLocation('/challenges')} data-testid="button-back-challenges">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('common.back')}
          </Button>
          <Button onClick={forceReconnect} data-testid="button-reconnect">
            <RefreshCw className="w-4 h-4 mr-2" />
            {t('common.reconnect')}
          </Button>
        </div>
      </div>
    );
  }

  if (connectionStatus === 'connecting' || connectionStatus === 'reconnecting') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground">
          {connectionStatus === 'reconnecting' 
            ? t('common.reconnecting') 
            : t('tarneeb.connecting')}
        </p>
      </div>
    );
  }

  if (!gameState || !isValidTarneebState || !boardState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground">{t('tarneeb.loadingGame')}</p>
      </div>
    );
  }

  const myTeam = tarneebState.myTeam ?? (playerPosition % 2);
  const winnerTeam = (gameResult as any)?.winningTeam ?? boardState.winningTeam;

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setLocation('/challenges')}
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold">{t('tarneeb.title')}</h1>
          </div>
          <div className="flex items-center gap-2">
            {spectatorCount > 0 && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {spectatorCount}
              </Badge>
            )}
            <Badge 
              variant={connectionStatus === 'connected' ? 'default' : 'secondary'}
              className="flex items-center gap-1"
            >
              {connectionStatus === 'connected' ? (
                <Wifi className="w-3 h-3" />
              ) : (
                <WifiOff className="w-3 h-3" />
              )}
            </Badge>
            <Button variant="outline" size="icon" onClick={handleShare} data-testid="button-share">
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {gameResult && (
          <Card className="bg-card/80 backdrop-blur">
            <CardContent className="pt-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">
                  {t('tarneeb.gameOver')}
                </h2>
                <p className={`text-lg ${winnerTeam === myTeam ? 'text-green-500' : 'text-red-500'}`}>
                  {winnerTeam === myTeam ? t('tarneeb.youWon') : t('tarneeb.youLost')}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <TarneebBoard
          sessionId={sessionId}
          gameState={boardState}
          playerId={String(user?.id || '')}
          playerPosition={playerPosition}
          onPlayCard={handlePlayCard}
          onBid={handleBid}
          onPass={handlePass}
        />
      </div>
    </div>
  );
}
