import { useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

interface BackgammonBoardProps {
  board: number[];
  bar: { white: number; black: number };
  borneOff: { white: number; black: number };
  dice: number[];
  diceUsed: boolean[];
  currentTurn: 'white' | 'black';
  playerColor: 'white' | 'black' | 'spectator';
  validMoves: Array<{ type: string; from: string; to: string }>;
  mustRoll: boolean;
  onMove: (from: number, to: number) => void;
  onRoll: () => void;
  disabled?: boolean;
}

const CHECKER_COLORS = {
  white: 'bg-amber-100 border-amber-300 shadow-amber-200',
  black: 'bg-stone-800 border-stone-600 shadow-stone-900'
};

export function BackgammonBoard({
  board,
  bar,
  borneOff,
  dice,
  diceUsed,
  currentTurn,
  playerColor,
  validMoves,
  mustRoll,
  onMove,
  onRoll,
  disabled = false
}: BackgammonBoardProps) {
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [highlightedPoints, setHighlightedPoints] = useState<number[]>([]);
  const { t } = useI18n();

  const isPlayerTurn = playerColor !== 'spectator' && currentTurn === playerColor;
  const flipped = playerColor === 'black';

  const barPosition = playerColor === 'white' ? -1 : 24;
  const bearOffPosition = playerColor === 'white' ? 24 : -1;

  const getValidMovesForPoint = useCallback((point: number): number[] => {
    return validMoves
      .filter(move => parseInt(move.from) === point)
      .map(move => parseInt(move.to));
  }, [validMoves]);

  const handlePointClick = useCallback((point: number) => {
    if (disabled || !isPlayerTurn || mustRoll) return;

    const checkerValue = point === barPosition ? (playerColor === 'white' ? bar.white : bar.black) :
                         point >= 0 && point <= 23 ? board[point] : 0;
    
    const hasOwnChecker = point === barPosition ? checkerValue > 0 :
                          playerColor === 'white' ? checkerValue > 0 : checkerValue < 0;

    if (selectedPoint !== null) {
      if (highlightedPoints.includes(point)) {
        onMove(selectedPoint, point);
        setSelectedPoint(null);
        setHighlightedPoints([]);
      } else if (hasOwnChecker) {
        setSelectedPoint(point);
        setHighlightedPoints(getValidMovesForPoint(point));
      } else {
        setSelectedPoint(null);
        setHighlightedPoints([]);
      }
    } else {
      if (hasOwnChecker) {
        const moves = getValidMovesForPoint(point);
        if (moves.length > 0) {
          setSelectedPoint(point);
          setHighlightedPoints(moves);
        }
      }
    }
  }, [disabled, isPlayerTurn, mustRoll, selectedPoint, highlightedPoints, playerColor, bar, board, barPosition, onMove, getValidMovesForPoint]);

  const renderChecker = (color: 'white' | 'black', count: number, stackIndex: number) => {
    const maxVisible = 5;
    const displayed = Math.min(count, maxVisible);
    const showCount = count > maxVisible;

    return (
      <div className="flex flex-col items-center gap-0.5">
        {Array.from({ length: displayed }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-8 h-8 rounded-full border-2 shadow-md transition-transform",
              CHECKER_COLORS[color],
              stackIndex === displayed - 1 && showCount && "relative"
            )}
          >
            {i === displayed - 1 && showCount && (
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                {count}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderPoint = (pointIndex: number, isTop: boolean) => {
    const checkerCount = board[pointIndex];
    const color = checkerCount > 0 ? 'white' : checkerCount < 0 ? 'black' : null;
    const count = Math.abs(checkerCount);
    const isSelected = selectedPoint === pointIndex;
    const isHighlighted = highlightedPoints.includes(pointIndex);
    const isEven = pointIndex % 2 === 0;

    const displayIndex = flipped ? 23 - pointIndex : pointIndex;
    const triangleColor = isEven ? 'bg-amber-700' : 'bg-stone-700';

    return (
      <div
        key={pointIndex}
        data-testid={`backgammon-point-${pointIndex}`}
        className={cn(
          "relative flex-1 flex items-center cursor-pointer transition-all",
          isTop ? "flex-col-reverse pb-2" : "flex-col pt-2",
          isSelected && "ring-2 ring-primary ring-inset",
          isHighlighted && "ring-2 ring-green-500 ring-inset bg-green-500/20"
        )}
        onClick={() => handlePointClick(pointIndex)}
      >
        <div
          className={cn(
            "absolute w-full",
            isTop ? "bottom-0" : "top-0",
            triangleColor
          )}
          style={{
            height: '80%',
            clipPath: isTop 
              ? 'polygon(50% 100%, 0% 0%, 100% 0%)' 
              : 'polygon(50% 0%, 0% 100%, 100% 100%)'
          }}
        />
        <div className={cn(
          "relative z-10 flex gap-0.5",
          isTop ? "flex-col" : "flex-col-reverse"
        )}>
          {color && renderChecker(color, count, count - 1)}
        </div>
        <span className={cn(
          "absolute text-xs text-muted-foreground font-medium",
          isTop ? "top-1" : "bottom-1"
        )}>
          {displayIndex + 1}
        </span>
      </div>
    );
  };

  const renderBar = () => {
    const whiteOnBar = bar.white;
    const blackOnBar = bar.black;
    const canClickBar = isPlayerTurn && !mustRoll && (
      (playerColor === 'white' && whiteOnBar > 0) ||
      (playerColor === 'black' && blackOnBar > 0)
    );
    const isSelected = selectedPoint === barPosition;

    return (
      <div
        data-testid="backgammon-bar"
        className={cn(
          "w-12 bg-amber-900 flex flex-col items-center justify-center gap-4 py-4",
          canClickBar && "cursor-pointer hover-elevate",
          isSelected && "ring-2 ring-primary"
        )}
        onClick={() => canClickBar && handlePointClick(barPosition)}
      >
        {whiteOnBar > 0 && (
          <div className="flex flex-col items-center">
            {renderChecker('white', whiteOnBar, whiteOnBar - 1)}
          </div>
        )}
        {blackOnBar > 0 && (
          <div className="flex flex-col items-center">
            {renderChecker('black', blackOnBar, blackOnBar - 1)}
          </div>
        )}
      </div>
    );
  };

  const renderBearOff = (color: 'white' | 'black') => {
    const count = borneOff[color];
    const isHighlighted = highlightedPoints.includes(color === 'white' ? 24 : -1);

    return (
      <div
        data-testid={`backgammon-bearoff-${color}`}
        className={cn(
          "w-10 flex flex-col items-center justify-center gap-1 py-2",
          "bg-stone-900/50 rounded-md border border-stone-700",
          isHighlighted && "ring-2 ring-green-500 bg-green-500/20 cursor-pointer"
        )}
        onClick={() => isHighlighted && onMove(selectedPoint!, color === 'white' ? 24 : -1)}
      >
        <span className="text-xs text-muted-foreground">{t('backgammon.off')}</span>
        <span className="text-lg font-bold">{count}</span>
        <div className={cn("w-6 h-6 rounded-full border-2", CHECKER_COLORS[color])} />
      </div>
    );
  };

  const renderDice = () => {
    if (dice.length === 0) return null;

    return (
      <div className="flex gap-2 items-center justify-center">
        {dice.map((die, index) => (
          <div
            key={index}
            data-testid={`backgammon-die-${index}`}
            className={cn(
              "w-10 h-10 bg-white rounded-lg border-2 border-stone-300 shadow-md",
              "flex items-center justify-center text-xl font-bold",
              diceUsed[index] && "opacity-30"
            )}
          >
            {die}
          </div>
        ))}
      </div>
    );
  };

  const topPoints = flipped 
    ? Array.from({ length: 12 }, (_, i) => i)
    : Array.from({ length: 12 }, (_, i) => 12 + i);
  
  const bottomPoints = flipped
    ? Array.from({ length: 12 }, (_, i) => 23 - i)
    : Array.from({ length: 12 }, (_, i) => 11 - i);

  return (
    <div className="flex flex-col gap-4" data-testid="backgammon-board">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {renderBearOff('black')}
        </div>
        {renderDice()}
        <div className="flex items-center gap-2">
          {mustRoll && isPlayerTurn && (
            <button
              data-testid="button-roll-dice"
              onClick={onRoll}
              disabled={disabled}
              className={cn(
                "px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium",
                "hover-elevate active-elevate-2",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              {t('backgammon.rollDice')}
            </button>
          )}
        </div>
      </div>

      <div 
        className="flex bg-amber-800 rounded-lg overflow-hidden border-4 border-amber-900 shadow-xl"
        style={{ minHeight: '400px' }}
      >
        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex">
            {topPoints.slice(6).reverse().map(i => renderPoint(i, true))}
          </div>
          <div className="flex-1 flex">
            {bottomPoints.slice(0, 6).map(i => renderPoint(i, false))}
          </div>
        </div>

        {renderBar()}

        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex">
            {topPoints.slice(0, 6).reverse().map(i => renderPoint(i, true))}
          </div>
          <div className="flex-1 flex">
            {bottomPoints.slice(6).map(i => renderPoint(i, false))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {renderBearOff('white')}
        </div>
        <div className="text-center">
          <span className={cn(
            "text-sm font-medium px-3 py-1 rounded-full",
            currentTurn === playerColor ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}>
            {currentTurn === playerColor 
              ? t('backgammon.yourTurn') 
              : t('backgammon.opponentTurn')}
          </span>
        </div>
      </div>
    </div>
  );
}
