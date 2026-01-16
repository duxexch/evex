import { Button } from '@/components/ui/button';
import { Flag, Handshake } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useI18n } from '@/lib/i18n';

interface ChessControlsProps {
  onResign: () => void;
  onOfferDraw: () => void;
  drawOffered?: boolean;
  isGameActive: boolean;
}

export function ChessControls({
  onResign,
  onOfferDraw,
  drawOffered,
  isGameActive
}: ChessControlsProps) {
  const { t } = useI18n();
  
  if (!isGameActive) return null;

  return (
    <div className="flex gap-2">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            data-testid="button-resign"
          >
            <Flag className="w-4 h-4 mr-1.5" />
            {t('chess.resign')}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('chess.confirmResign')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('chess.resignWarning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-resign">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={onResign}
              data-testid="button-confirm-resign"
            >
              {t('common.yes')}, {t('chess.resign')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Button
        variant="outline"
        size="sm"
        onClick={onOfferDraw}
        disabled={drawOffered}
        data-testid="button-offer-draw"
      >
        <Handshake className="w-4 h-4 mr-1.5" />
        {drawOffered ? t('chess.drawOffered') : t('chess.offerDraw')}
      </Button>
    </div>
  );
}

interface DrawOfferDialogProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
  opponentName: string;
}

export function DrawOfferDialog({
  isOpen,
  onAccept,
  onDecline,
  opponentName
}: DrawOfferDialogProps) {
  const { t } = useI18n();
  
  if (!isOpen) return null;

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('chess.offerDraw')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('chess.drawOfferReceived')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            onClick={onDecline}
            data-testid="button-decline-draw"
          >
            {t('chess.declineDraw')}
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onAccept}
            data-testid="button-accept-draw"
          >
            {t('chess.acceptDraw')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
