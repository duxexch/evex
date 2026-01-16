import { useMemo } from 'react';
import { useParams, useLocation } from 'wouter';
import { BalootBoard } from '@/components/games/BalootBoard';
import { useGameWebSocket } from '@/hooks/useGameWebSocket';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Wifi, WifiOff, Users, ArrowLeft, Share2, AlertCircle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function BalootGame() {
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

  const balootState = gameState as any;

  const isValidBalootState = useMemo(() => {
    if (!balootState) return false;
    return balootState.hand !== undefined && 
           balootState.gamePhase !== undefined &&
           balootState.currentTurn !== undefined;
  }, [balootState]);

  const playerPosition = useMemo(() => {
    if (!user?.id || !balootState?.playerOrder) return 0;
    const pos = balootState.playerOrder.indexOf(String(user.id));
    return pos >= 0 ? pos : 0;
  }, [balootState?.playerOrder, user?.id]);

  const boardState = useMemo(() => {
    if (!balootState) return null;
    
    const hands: { [playerId: string]: any[] } = {};
    if (user?.id && balootState.hand) {
      hands[String(user.id)] = balootState.hand;
    }
    if (balootState.otherHandCounts) {
      for (const [pid, count] of Object.entries(balootState.otherHandCounts)) {
        hands[pid] = Array(count as number).fill({ suit: 'spades', rank: 'X', value: 0, hidden: true });
      }
    }

    const serverTricksWon = balootState.tricksWon || { team0: 0, team1: 0 };
    const serverPoints = balootState.totalPoints || { team0: 0, team1: 0 };
    const serverRoundPoints = balootState.roundPoints || { team0: 0, team1: 0 };

    return {
      phase: balootState.gamePhase === 'choosing' ? 'choosing' : 
             balootState.gamePhase === 'finished' ? 'finished' : 'playing',
      hands,
      currentTrick: balootState.currentTrick || [],
      gameType: balootState.gameType || null,
      trumpSuit: balootState.trumpSuit || null,
      currentPlayer: balootState.currentTurn || '',
      choosingPlayer: balootState.choosingPlayer || balootState.playerOrder?.[0] || '',
      tricksWon: { team1: serverTricksWon.team0, team2: serverTricksWon.team1 },
      points: { team1: serverPoints.team0, team2: serverPoints.team1 },
      roundPoints: { team1: serverRoundPoints.team0, team2: serverRoundPoints.team1 },
      projects: balootState.projects || [],
      dealerId: balootState.playerOrder?.[0] || '',
      winningTeam: balootState.winner ? 
        (balootState.playerOrder?.indexOf(balootState.winner) % 2 === 0 ? 1 : 2) : undefined,
      doubleRound: false
    };
  }, [balootState, user?.id]);

  const handleChooseTrump = (type: 'sun' | 'hokm', suit?: string) => {
    makeMove({ type: 'choose', gameType: type, trumpSuit: suit });
  };

  const handlePass = () => {
    makeMove({ type: 'pass' });
  };

  const handlePlayCard = (card: any) => {
    makeMove({ type: 'playCard', card });
  };

  const handleDeclareProject = (project: string) => {
    makeMove({ type: 'declareProject', project });
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: t('baloot.title'),
          text: t('baloot.shareText'),
          url: shareUrl
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast({
          title: t('common.success'),
          description: t('baloot.linkCopied')
        });
      }
    } catch (e) {
      console.error('Share failed:', e);
    }
  };

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">{t('baloot.invalidSession')}</p>
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
            : t('baloot.connecting')}
        </p>
      </div>
    );
  }

  if (!gameState || !isValidBalootState || !boardState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground">{t('baloot.loadingGame')}</p>
      </div>
    );
  }

  const myTeam = balootState.myTeam ?? (playerPosition % 2);
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
            <h1 className="text-2xl font-bold">{t('baloot.title')}</h1>
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
                  {t('baloot.gameOver')}
                </h2>
                <p className={`text-lg ${winnerTeam === myTeam ? 'text-green-500' : 'text-red-500'}`}>
                  {winnerTeam === myTeam ? t('baloot.youWon') : t('baloot.youLost')}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <BalootBoard
          sessionId={sessionId}
          gameState={boardState}
          playerId={String(user?.id || '')}
          playerPosition={playerPosition}
          onPlayCard={handlePlayCard}
          onChooseTrump={handleChooseTrump}
          onDeclareProject={handleDeclareProject}
          onPass={handlePass}
        />
      </div>
    </div>
  );
}
