/**
 * Game Start Modal
 * Mandatory popup that forces user to open game board immediately
 * Similar to Ludo King behavior
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, Play, Timer } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export interface GameStartModalProps {
  isOpen: boolean;
  challengeId: string;
  gameType: string;
  player1Name: string;
  player2Name: string;
  onOpen: (challengeId: string) => void;
  onDismiss?: () => void;
}

export function GameStartModal({
  isOpen,
  challengeId,
  gameType,
  player1Name,
  player2Name,
  onOpen,
  onDismiss,
}: GameStartModalProps) {
  const [, setLocation] = useLocation();
  const { t, language } = useI18n();
  const [countdown, setCountdown] = useState(5);
  const [autoOpen, setAutoOpen] = useState(true);

  // Auto-redirect after countdown
  useEffect(() => {
    if (!isOpen || !autoOpen) return;

    if (countdown <= 0) {
      handleOpenGame();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, isOpen, autoOpen]);

  const handleOpenGame = () => {
    setCountdown(5);
    setAutoOpen(true);
    onOpen(challengeId);
    setLocation(`/challenge/${challengeId}/play`);
  };

  const handleCancel = () => {
    setCountdown(5);
    setAutoOpen(false);
    if (onDismiss) {
      onDismiss();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) handleCancel();
    }}>
      <DialogContent className="max-w-md border-2 border-primary/30 bg-gradient-to-b from-primary/5 to-transparent">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <AlertCircle className="h-5 w-5 text-green-500 animate-pulse" />
            {language === 'ar' ? 'بدأت المباراة!' : 'Game Started!'}
          </DialogTitle>
          <DialogDescription className="text-base">
            {language === 'ar' 
              ? `${player1Name} vs ${player2Name}` 
              : `${player1Name} vs ${player2Name}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Game Info */}
          <div className="rounded-lg bg-primary/10 p-4">
            <p className="text-sm text-muted-foreground mb-2">
              {language === 'ar' ? 'نوع اللعبة' : 'Game Type'}
            </p>
            <p className="text-lg font-bold capitalize">{gameType}</p>
          </div>

          {/* Auto-Open Countdown */}
          {autoOpen && (
            <div className="rounded-lg bg-green-500/10 p-4 text-center border border-green-500/30">
              <p className="text-sm text-green-700 dark:text-green-400 mb-2">
                {language === 'ar' ? 'فتح لوحة اللعب في' : 'Opening game board in'}
              </p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-500">
                {countdown}
              </p>
              <p className="text-xs text-green-600/60 mt-1">
                {language === 'ar' ? 'ثانية' : 'seconds'}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
              onClick={handleOpenGame}
              size="lg"
            >
              <Play className="h-4 w-4" />
              {language === 'ar' ? 'ابدأ اللعبة الآن' : 'Play Now'}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleCancel}
              size="lg"
            >
              {language === 'ar' ? 'لاحقًا' : 'Later'}
            </Button>
          </div>

          {/* Info Text */}
          <p className="text-xs text-muted-foreground text-center">
            {language === 'ar' 
              ? 'ستُفتح لوحة اللعب تلقائيًا قريبًا. يمكنك الانتظار أو الضغط على "ابدأ اللعبة الآن"' 
              : 'Game board will open automatically. Click "Play Now" to start immediately'}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
