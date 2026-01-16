import { useMemo } from 'react';
import { useParams, useLocation } from 'wouter';
import { DominoBoard } from '@/components/games/DominoBoard';
import { GiftAnimation } from '@/components/games/GiftAnimation';
import { useGameWebSocket } from '@/hooks/useGameWebSocket';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Wifi, WifiOff, Users, ArrowLeft, Share2, AlertCircle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function DominoGame() {
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
    forceReconnect,
    lastGift,
    clearLastGift
  } = useGameWebSocket(sessionId || null);

  const dominoState = gameState as any;

  const isValidDominoState = useMemo(() => {
    if (!dominoState) return false;
    return dominoState.hand !== undefined && 
           dominoState.board !== undefined &&
           dominoState.currentTurn !== undefined;
  }, [dominoState]);

  const isMyTurn = dominoState?.isMyTurn || false;
  const isSpectator = !dominoState?.playerOrder?.includes(String(user?.id));
  const isGameActive = !gameResult && dominoState && isValidDominoState &&
    dominoState.gamePhase !== 'finished';

  const boardState = useMemo(() => {
    if (!dominoState) return null;
    
    const opponentTileCount = dominoState.otherHandCounts 
      ? Object.values(dominoState.otherHandCounts as Record<string, number>).reduce((sum: number, count: number) => sum + count, 0)
      : 0;

    const boardTiles = (dominoState.board || []).map((tile: any, index: number) => ({
      tile: { left: tile.left, right: tile.right },
      rotation: index === 0 ? 0 : 90
    }));

    return {
      myHand: dominoState.hand || [],
      opponentTileCount,
      boardTiles,
      leftEnd: dominoState.leftEnd ?? -1,
      rightEnd: dominoState.rightEnd ?? -1,
      boneyard: dominoState.boneyardCount ?? 0
    };
  }, [dominoState]);

  const handleMove = (move: { tileLeft: number; tileRight: number; placedEnd: 'left' | 'right'; isPassed: boolean }) => {
    if (move.isPassed) {
      if (boardState && boardState.boneyard > 0) {
        makeMove({ type: 'draw' });
      } else {
        makeMove({ type: 'pass' });
      }
    } else {
      const tile = { left: move.tileLeft, right: move.tileRight, id: `${move.tileLeft}-${move.tileRight}` };
      makeMove({ 
        type: 'play', 
        tile,
        end: move.placedEnd 
      });
    }
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: t('domino.title'),
          text: t('domino.shareText'),
          url: shareUrl
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast({
          title: t('common.success'),
          description: t('domino.linkCopied')
        });
      }
    } catch (e) {
      console.error('Share failed:', e);
    }
  };

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">{t('domino.invalidSession')}</p>
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
            : t('domino.connecting')}
        </p>
      </div>
    );
  }

  if (!gameState || !isValidDominoState || !boardState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground">{t('domino.loadingGame')}</p>
      </div>
    );
  }

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
            <h1 className="text-2xl font-bold">{t('domino.title')}</h1>
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
                  {t('domino.gameOver')}
                </h2>
                <p className={`text-lg ${gameResult.winner === String(user?.id) ? 'text-green-500' : 'text-red-500'}`}>
                  {gameResult.winner === String(user?.id) ? t('domino.youWon') : t('domino.youLost')}
                </p>
                {gameResult.reason === 'blocked' && (
                  <p className="text-muted-foreground mt-1">{t('domino.blocked')}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <DominoBoard
          gameState={JSON.stringify(boardState)}
          currentTurn={dominoState.currentTurn}
          isMyTurn={isMyTurn}
          isSpectator={isSpectator}
          onMove={handleMove}
          status={dominoState.gamePhase}
        />
      </div>

      <GiftAnimation
        gift={lastGift ? { id: Date.now().toString(), ...lastGift } : null}
        onComplete={clearLastGift}
      />
    </div>
  );
}
