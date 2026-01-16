import { useState, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

interface ChessPiece {
  type: 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
  color: 'w' | 'b';
}

interface ChessBoardProps {
  position: Record<string, ChessPiece>;
  currentTurn: 'w' | 'b';
  playerColor: 'w' | 'b';
  validMoves: string[];
  lastMove?: { from: string; to: string };
  isCheck: boolean;
  onMove: (from: string, to: string, promotion?: string) => void;
  disabled?: boolean;
}

const PIECE_UNICODE: Record<string, string> = {
  'wk': '♔', 'wq': '♕', 'wr': '♖', 'wb': '♗', 'wn': '♘', 'wp': '♙',
  'bk': '♚', 'bq': '♛', 'br': '♜', 'bb': '♝', 'bn': '♞', 'bp': '♟'
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export function ChessBoard({
  position,
  currentTurn,
  playerColor,
  validMoves,
  lastMove,
  isCheck,
  onMove,
  disabled = false
}: ChessBoardProps) {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [highlightedMoves, setHighlightedMoves] = useState<string[]>([]);
  const [draggedPiece, setDraggedPiece] = useState<string | null>(null);
  const [showPromotion, setShowPromotion] = useState<{ from: string; to: string } | null>(null);

  const isPlayerTurn = currentTurn === playerColor;
  const flipped = playerColor === 'b';

  const displayRanks = useMemo(() => flipped ? [...RANKS].reverse() : RANKS, [flipped]);
  const displayFiles = useMemo(() => flipped ? [...FILES].reverse() : FILES, [flipped]);

  const getSquareFromMove = useCallback((move: string): { from: string; to: string } | null => {
    if (move.length >= 4) {
      return { from: move.slice(0, 2), to: move.slice(2, 4) };
    }
    return null;
  }, []);

  const getValidMovesForSquare = useCallback((square: string): string[] => {
    return validMoves
      .filter(move => move.startsWith(square))
      .map(move => move.slice(2, 4));
  }, [validMoves]);

  const handleSquareClick = useCallback((square: string) => {
    if (disabled || !isPlayerTurn) return;

    const piece = position[square];

    if (selectedSquare) {
      if (highlightedMoves.includes(square)) {
        const piece = position[selectedSquare];
        if (piece?.type === 'p') {
          const rank = square[1];
          if ((piece.color === 'w' && rank === '8') || (piece.color === 'b' && rank === '1')) {
            setShowPromotion({ from: selectedSquare, to: square });
            return;
          }
        }
        onMove(selectedSquare, square);
        setSelectedSquare(null);
        setHighlightedMoves([]);
      } else if (piece && piece.color === playerColor) {
        setSelectedSquare(square);
        setHighlightedMoves(getValidMovesForSquare(square));
      } else {
        setSelectedSquare(null);
        setHighlightedMoves([]);
      }
    } else {
      if (piece && piece.color === playerColor) {
        setSelectedSquare(square);
        setHighlightedMoves(getValidMovesForSquare(square));
      }
    }
  }, [disabled, isPlayerTurn, selectedSquare, highlightedMoves, position, playerColor, onMove, getValidMovesForSquare]);

  const handleDragStart = useCallback((e: React.DragEvent, square: string) => {
    if (disabled || !isPlayerTurn) {
      e.preventDefault();
      return;
    }
    const piece = position[square];
    if (!piece || piece.color !== playerColor) {
      e.preventDefault();
      return;
    }
    setDraggedPiece(square);
    setSelectedSquare(square);
    setHighlightedMoves(getValidMovesForSquare(square));
    e.dataTransfer.effectAllowed = 'move';
  }, [disabled, isPlayerTurn, position, playerColor, getValidMovesForSquare]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetSquare: string) => {
    e.preventDefault();
    if (!draggedPiece) return;

    if (highlightedMoves.includes(targetSquare)) {
      const piece = position[draggedPiece];
      if (piece?.type === 'p') {
        const rank = targetSquare[1];
        if ((piece.color === 'w' && rank === '8') || (piece.color === 'b' && rank === '1')) {
          setShowPromotion({ from: draggedPiece, to: targetSquare });
          setDraggedPiece(null);
          return;
        }
      }
      onMove(draggedPiece, targetSquare);
    }

    setDraggedPiece(null);
    setSelectedSquare(null);
    setHighlightedMoves([]);
  }, [draggedPiece, highlightedMoves, position, onMove]);

  const handlePromotion = useCallback((promotionPiece: string) => {
    if (showPromotion) {
      onMove(showPromotion.from, showPromotion.to, promotionPiece);
      setShowPromotion(null);
      setSelectedSquare(null);
      setHighlightedMoves([]);
    }
  }, [showPromotion, onMove]);

  const findKingSquare = useCallback((color: 'w' | 'b'): string | null => {
    for (const [square, piece] of Object.entries(position)) {
      if (piece.type === 'k' && piece.color === color) {
        return square;
      }
    }
    return null;
  }, [position]);

  const kingInCheckSquare = isCheck ? findKingSquare(currentTurn) : null;
  const { t } = useI18n();

  return (
    <div className="relative">
      <div 
        className="grid grid-cols-8 border-2 border-border rounded-lg overflow-hidden shadow-lg"
        style={{ aspectRatio: '1/1', maxWidth: '600px' }}
      >
        {displayRanks.map((rank, rankIndex) =>
          displayFiles.map((file, fileIndex) => {
            const square = `${file}${rank}`;
            const isLight = (rankIndex + fileIndex) % 2 === 0;
            const piece = position[square];
            const isSelected = selectedSquare === square;
            const isValidMove = highlightedMoves.includes(square);
            const isLastMoveSquare = lastMove && (lastMove.from === square || lastMove.to === square);
            const isKingInCheck = kingInCheckSquare === square;

            return (
              <div
                key={square}
                data-testid={`square-${square}`}
                className={cn(
                  "relative flex items-center justify-center cursor-pointer transition-all",
                  isLight ? "bg-amber-100 dark:bg-amber-200" : "bg-amber-800 dark:bg-amber-900",
                  isSelected && "ring-2 ring-primary ring-inset",
                  isLastMoveSquare && "bg-yellow-300/50 dark:bg-yellow-600/50",
                  isKingInCheck && "bg-red-500/60",
                  !disabled && isPlayerTurn && "hover:brightness-110"
                )}
                onClick={() => handleSquareClick(square)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, square)}
              >
                {fileIndex === 0 && (
                  <span className={cn(
                    "absolute top-0.5 left-0.5 text-xs font-semibold",
                    isLight ? "text-amber-800" : "text-amber-100"
                  )}>
                    {rank}
                  </span>
                )}
                {rankIndex === 7 && (
                  <span className={cn(
                    "absolute bottom-0.5 right-0.5 text-xs font-semibold",
                    isLight ? "text-amber-800" : "text-amber-100"
                  )}>
                    {file}
                  </span>
                )}

                {isValidMove && !piece && (
                  <div className="absolute w-3 h-3 rounded-full bg-primary/40" />
                )}

                {isValidMove && piece && (
                  <div className="absolute inset-1 rounded-full ring-4 ring-primary/40" />
                )}

                {piece && (
                  <span
                    draggable={!disabled && isPlayerTurn && piece.color === playerColor}
                    onDragStart={(e) => handleDragStart(e, square)}
                    className={cn(
                      "text-4xl md:text-5xl lg:text-6xl select-none transition-transform",
                      piece.color === 'w' ? "text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]" : "text-gray-900 drop-shadow-[0_2px_2px_rgba(255,255,255,0.3)]",
                      !disabled && isPlayerTurn && piece.color === playerColor && "cursor-grab active:cursor-grabbing hover:scale-110"
                    )}
                  >
                    {PIECE_UNICODE[`${piece.color}${piece.type}`]}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {showPromotion && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-50">
          <div className="bg-card p-4 rounded-lg shadow-xl border">
            <p className="text-center mb-3 font-medium">{t('chess.choosePromotion')}</p>
            <div className="flex gap-2">
              {['q', 'r', 'b', 'n'].map((piece) => (
                <button
                  key={piece}
                  data-testid={`promote-${piece}`}
                  onClick={() => handlePromotion(piece)}
                  className="w-14 h-14 bg-amber-100 dark:bg-amber-200 rounded-lg hover:ring-2 ring-primary flex items-center justify-center text-4xl transition-all hover-elevate"
                >
                  {PIECE_UNICODE[`${playerColor}${piece}`]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
