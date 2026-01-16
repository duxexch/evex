import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface ChessTimerProps {
  whiteTime: number;
  blackTime: number;
  currentTurn: 'w' | 'b';
  isGameActive: boolean;
  playerColor: 'w' | 'b';
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function ChessTimer({
  whiteTime,
  blackTime,
  currentTurn,
  isGameActive,
  playerColor
}: ChessTimerProps) {
  const [displayWhite, setDisplayWhite] = useState(whiteTime);
  const [displayBlack, setDisplayBlack] = useState(blackTime);

  useEffect(() => {
    setDisplayWhite(whiteTime);
    setDisplayBlack(blackTime);

    if (!isGameActive) return;

    const interval = setInterval(() => {
      if (currentTurn === 'w') {
        setDisplayWhite(prev => Math.max(0, prev - 1));
      } else {
        setDisplayBlack(prev => Math.max(0, prev - 1));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [whiteTime, blackTime, currentTurn, isGameActive]);

  const isWhiteLow = displayWhite <= 60;
  const isBlackLow = displayBlack <= 60;

  const topColor = playerColor === 'w' ? 'b' : 'w';
  const bottomColor = playerColor;

  const topTime = topColor === 'w' ? displayWhite : displayBlack;
  const bottomTime = bottomColor === 'w' ? displayWhite : displayBlack;
  const isTopActive = currentTurn === topColor && isGameActive;
  const isBottomActive = currentTurn === bottomColor && isGameActive;
  const isTopLow = topColor === 'w' ? isWhiteLow : isBlackLow;
  const isBottomLow = bottomColor === 'w' ? isWhiteLow : isBlackLow;

  return (
    <div className="flex flex-col gap-4 w-full max-w-[100px]">
      <TimerDisplay
        time={topTime}
        isActive={isTopActive}
        isLow={isTopLow}
        label={topColor === 'w' ? 'White' : 'Black'}
        color={topColor}
      />
      <div className="flex-1" />
      <TimerDisplay
        time={bottomTime}
        isActive={isBottomActive}
        isLow={isBottomLow}
        label={bottomColor === 'w' ? 'White' : 'Black'}
        color={bottomColor}
      />
    </div>
  );
}

interface TimerDisplayProps {
  time: number;
  isActive: boolean;
  isLow: boolean;
  label: string;
  color: 'w' | 'b';
}

function TimerDisplay({ time, isActive, isLow, label, color }: TimerDisplayProps) {
  const { t } = useI18n();
  const displayLabel = color === 'w' ? t('chess.white') : t('chess.black');
  
  return (
    <div
      data-testid={`timer-${color}`}
      className={cn(
        "p-3 rounded-lg transition-all",
        color === 'w' ? "bg-white text-black" : "bg-gray-900 text-white",
        isActive && "ring-2 ring-primary shadow-lg",
        isLow && isActive && "animate-pulse"
      )}
    >
      <div className="flex items-center gap-1.5 text-xs opacity-70 mb-1">
        <Clock className="w-3 h-3" />
        <span>{displayLabel}</span>
      </div>
      <div className={cn(
        "font-mono text-2xl font-bold",
        isLow && "text-red-500"
      )}>
        {formatTime(time)}
      </div>
    </div>
  );
}
