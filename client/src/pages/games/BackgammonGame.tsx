import { useMemo } from 'react';
import { useParams, useLocation } from 'wouter';
import { BackgammonBoard } from '@/components/games/backgammon/BackgammonBoard';
import { GiftAnimation } from '@/components/games/GiftAnimation';
import { useGameWebSocket } from '@/hooks/useGameWebSocket';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Wifi, WifiOff, Users, ArrowLeft, Share2, AlertCircle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function BackgammonGame() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();

  const {
    connectionStatus,
    gameType,
    gameState,
    playerColor,
    opponent,
    spectatorCount,
    gameResult,
    error,
    makeMove,
    forceReconnect,
    lastGift,
    clearLastGift
  } = useGameWebSocket(sessionId || null);

  const bgState = gameState as any;

  const isValidBackgammonState = useMemo(() => {
    if (!bgState) return false;
    return Array.isArray(bgState.board) && 
           bgState.board.length === 24 &&
           typeof bgState.currentTurn === 'string' &&
           bgState.bar !== undefined &&
           bgState.borneOff !== undefined;
  }, [bgState]);

  const mappedPlayerColor = useMemo(() => {
    if (!bgState?.myColor) return 'spectator';
    return bgState.myColor as 'white' | 'black' | 'spectator';
  }, [bgState?.myColor]);

  const isGameActive = !gameResult && bgState && isValidBackgammonState &&
    bgState.gamePhase !== 'finished';

  const handleRoll = () => {
    makeMove({ type: 'roll' });
  };

  const handleMove = (from: number, to: number) => {
    makeMove({ type: 'move', from: from.toString(), to: to.toString() });
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: t('backgammon.title'),
          text: t('backgammon.shareText'),
          url: shareUrl
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast({
          title: t('common.success'),
          description: t('backgammon.linkCopied')
        });
      }
    } catch (e) {
      console.error('Share failed:', e);
    }
  };

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">{t('backgammon.invalidSession')}</p>
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
            ? t('backgammon.reconnecting') 
            : t('backgammon.connecting')}
        </p>
      </div>
    );
  }

  if (!gameState || !isValidBackgammonState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground">{t('backgammon.loadingGame')}</p>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setLocation('/challenges')}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">{t('backgammon.title')}</h1>
          <Badge variant={connectionStatus === 'connected' ? 'default' : 'destructive'}>
            {connectionStatus === 'connected' ? (
              <><Wifi className="w-3 h-3 mr-1" />{t('common.connected')}</>
            ) : (
              <><WifiOff className="w-3 h-3 mr-1" />{t('common.disconnected')}</>
            )}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            <Users className="w-3 h-3 mr-1" />
            {spectatorCount} {t('common.spectators')}
          </Badge>
          <Button variant="outline" size="icon" onClick={handleShare} data-testid="button-share">
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-4">
              <BackgammonBoard
                board={bgState.board}
                bar={bgState.bar}
                borneOff={bgState.borneOff}
                dice={bgState.dice || []}
                diceUsed={bgState.diceUsed || []}
                currentTurn={bgState.currentTurn}
                playerColor={mappedPlayerColor}
                validMoves={bgState.validMoves || []}
                mustRoll={bgState.mustRoll || false}
                onMove={handleMove}
                onRoll={handleRoll}
                disabled={!isGameActive || mappedPlayerColor === 'spectator'}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{t('backgammon.gameInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t('backgammon.you')}</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{user?.username}</span>
                  <Badge variant={mappedPlayerColor === 'white' ? 'default' : 'secondary'}>
                    {mappedPlayerColor === 'white' ? t('backgammon.white') : t('backgammon.black')}
                  </Badge>
                </div>
              </div>
              
              {opponent && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{t('backgammon.opponent')}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{opponent.username}</span>
                    <Badge variant={mappedPlayerColor === 'white' ? 'secondary' : 'default'}>
                      {mappedPlayerColor === 'white' ? t('backgammon.black') : t('backgammon.white')}
                    </Badge>
                  </div>
                </div>
              )}

              <div className="border-t pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{t('backgammon.borneOff')}</span>
                </div>
                <div className="flex justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-amber-100 border border-amber-300" />
                    <span>{bgState.borneOff?.white || 0}/15</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-stone-800 border border-stone-600" />
                    <span>{bgState.borneOff?.black || 0}/15</span>
                  </div>
                </div>
              </div>

              {(bgState.bar?.white > 0 || bgState.bar?.black > 0) && (
                <div className="border-t pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{t('backgammon.onBar')}</span>
                  </div>
                  <div className="flex justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-amber-100 border border-amber-300" />
                      <span>{bgState.bar?.white || 0}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-stone-800 border border-stone-600" />
                      <span>{bgState.bar?.black || 0}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {gameResult && (
            <Card className="border-primary">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{t('backgammon.gameOver')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-medium">
                  {gameResult.winner === user?.id 
                    ? t('backgammon.youWon')
                    : t('backgammon.youLost')}
                </p>
                {gameResult.reason && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {gameResult.reason === 'backgammon' && t('backgammon.byBackgammon')}
                    {gameResult.reason === 'gammon' && t('backgammon.byGammon')}
                    {gameResult.reason === 'normal' && t('backgammon.byNormal')}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <GiftAnimation
        gift={lastGift ? { id: Date.now().toString(), ...lastGift } : null}
        onComplete={clearLastGift}
      />
    </div>
  );
}
