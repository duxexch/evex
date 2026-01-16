import { useMemo } from 'react';
import { useParams, useLocation } from 'wouter';
import { ChessBoard } from '@/components/games/chess/ChessBoard';
import { ChessTimer } from '@/components/games/chess/ChessTimer';
import { ChessMoveList } from '@/components/games/chess/ChessMoveList';
import { ChessControls, DrawOfferDialog } from '@/components/games/chess/ChessControls';
import { ChessChat } from '@/components/games/chess/ChessChat';
import { useGameWebSocket } from '@/hooks/useGameWebSocket';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Wifi, WifiOff, Users, ArrowLeft, Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ChessPiece {
  type: 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
  color: 'w' | 'b';
}

function fenToPosition(fen: string): Record<string, ChessPiece> {
  const position: Record<string, ChessPiece> = {};
  const [boardPart] = fen.split(' ');
  const ranks = boardPart.split('/');
  
  const pieceMap: Record<string, { type: ChessPiece['type']; color: ChessPiece['color'] }> = {
    'P': { type: 'p', color: 'w' }, 'N': { type: 'n', color: 'w' },
    'B': { type: 'b', color: 'w' }, 'R': { type: 'r', color: 'w' },
    'Q': { type: 'q', color: 'w' }, 'K': { type: 'k', color: 'w' },
    'p': { type: 'p', color: 'b' }, 'n': { type: 'n', color: 'b' },
    'b': { type: 'b', color: 'b' }, 'r': { type: 'r', color: 'b' },
    'q': { type: 'q', color: 'b' }, 'k': { type: 'k', color: 'b' },
  };
  
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  
  ranks.forEach((rank, rankIndex) => {
    let fileIndex = 0;
    for (const char of rank) {
      if (isNaN(parseInt(char))) {
        const square = `${files[fileIndex]}${8 - rankIndex}`;
        const piece = pieceMap[char];
        if (piece) {
          position[square] = piece;
        }
        fileIndex++;
      } else {
        fileIndex += parseInt(char);
      }
    }
  });
  
  return position;
}

export default function ChessGame() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();

  const {
    connectionStatus,
    gameState,
    playerColor,
    opponent,
    chatMessages,
    spectators,
    drawOffered,
    drawOfferReceived,
    gameResult,
    error,
    makeMove,
    sendChat,
    resign,
    offerDraw,
    respondDraw
  } = useGameWebSocket(sessionId || null);

  const position = useMemo(() => {
    if (!gameState?.fen) return {};
    return fenToPosition(gameState.fen);
  }, [gameState?.fen]);

  const isGameActive = !gameResult && gameState && 
    !gameState.isCheckmate && !gameState.isStalemate && !gameState.isDraw;

  const handleShare = async () => {
    const shareUrl = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: t('chess.title'),
          text: t('chess.title'),
          url: shareUrl
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast({
          title: t('common.success'),
          description: t('chess.share')
        });
      }
    } catch (e) {
      console.error('Share failed:', e);
    }
  };

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">{t('chess.invalidSession')}</p>
      </div>
    );
  }

  if (connectionStatus === 'connecting') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground">{t('chess.connecting')}</p>
      </div>
    );
  }

  if (connectionStatus === 'error' || error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <WifiOff className="w-12 h-12 text-destructive" />
        <p className="text-destructive font-medium">{error || t('chess.connectionError')}</p>
        <Button onClick={() => window.location.reload()} data-testid="button-retry">
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setLocation('/play')}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{t('chess.title')}</h1>
            {opponent && (
              <p className="text-muted-foreground text-sm">
                vs {opponent.username}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge 
            variant={connectionStatus === 'connected' ? 'default' : 'secondary'}
            className="gap-1.5"
          >
            {connectionStatus === 'connected' ? (
              <Wifi className="w-3 h-3" />
            ) : (
              <WifiOff className="w-3 h-3" />
            )}
            {connectionStatus === 'connected' ? t('common.live') : t('common.offline')}
          </Badge>

          {spectators.length > 0 && (
            <Badge variant="outline" className="gap-1.5">
              <Users className="w-3 h-3" />
              {spectators.length}
            </Badge>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            data-testid="button-share"
          >
            <Share2 className="w-4 h-4 mr-1.5" />
            {t('chess.share')}
          </Button>
        </div>
      </div>

      {gameResult && (
        <Card className="mb-6 border-primary">
          <CardContent className="py-4">
            <div className="text-center">
              <h2 className="text-xl font-bold mb-1">
                {gameResult.winner === user?.id 
                  ? t('chess.youWon')
                  : gameResult.winner === null 
                    ? t('chess.draw')
                    : t('chess.youLost')}
              </h2>
              <p className="text-muted-foreground">{gameResult.reason}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-[1fr_300px] gap-6">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-start gap-4 w-full justify-center">
            {gameState && playerColor && (
              <ChessTimer
                whiteTime={gameState.whiteTime}
                blackTime={gameState.blackTime}
                currentTurn={gameState.currentTurn}
                isGameActive={!!isGameActive}
                playerColor={playerColor}
              />
            )}

            {gameState && playerColor && (
              <ChessBoard
                position={position}
                currentTurn={gameState.currentTurn}
                playerColor={playerColor}
                validMoves={gameState.validMoves}
                lastMove={gameState.lastMove}
                isCheck={gameState.isCheck}
                onMove={makeMove}
                disabled={!isGameActive || gameState.currentTurn !== playerColor}
              />
            )}
          </div>

          <ChessControls
            onResign={resign}
            onOfferDraw={offerDraw}
            drawOffered={drawOffered}
            isGameActive={!!isGameActive}
          />
        </div>

        <div className="space-y-4">
          {gameState && (
            <ChessMoveList
              moves={gameState.moveHistory.map((m, i) => ({
                moveNumber: m.moveNumber,
                notation: m.notation,
                player: m.player
              }))}
            />
          )}

          {user && (
            <ChessChat
              messages={chatMessages}
              onSendMessage={sendChat}
              currentUserId={user.id}
            />
          )}
        </div>
      </div>

      <DrawOfferDialog
        isOpen={drawOfferReceived}
        onAccept={() => respondDraw(true)}
        onDecline={() => respondDraw(false)}
        opponentName={opponent?.username || 'Opponent'}
      />
    </div>
  );
}
