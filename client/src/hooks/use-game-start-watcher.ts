/**
 * Use Game Start Watcher
 * Watches for game start event and manages modal display
 * Replaces manual redirect with automatic WebSocket-driven flow
 */

import { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/i18n';
import { apiRequest } from '@/lib/queryClient';

export interface GameStartEvent {
  challengeId: string;
  sessionId: string;
  gameType: string;
  player1Id: string;
  player1Name: string;
  player2Id: string;
  player2Name: string;
  redirectUrl: string;
}

interface UseGameStartWatcherReturn {
  isWaiting: boolean;
  gameStartEvent: GameStartEvent | null;
  showGameStartModal: boolean;
  setShowGameStartModal: (show: boolean) => void;
  navigateToGame: (challengeId: string) => void;
}

export function useGameStartWatcher(): UseGameStartWatcherReturn {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { language } = useI18n();
  
  const [isWaiting, setIsWaiting] = useState(false);
  const [gameStartEvent, setGameStartEvent] = useState<GameStartEvent | null>(null);
  const [showGameStartModal, setShowGameStartModal] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Check if we're waiting for a game start
  useEffect(() => {
    const awaitingGameStart = sessionStorage.getItem('awaiting_game_start');
    if (awaitingGameStart) {
      console.log('[GameStartWatcher] Found awaiting_game_start:', awaitingGameStart);
      setIsWaiting(true);
      
      // Start polling for the game status
      pollGameStatus(awaitingGameStart);
    }
  }, []);

  // Poll for game status
  const pollGameStatus = useCallback(async (challengeId: string) => {
    console.log('[GameStartWatcher] Polling game status for:', challengeId);
    
    try {
      const response = await apiRequest('GET', `/api/game-start/status/${challengeId}`);
      const data = await response.json();
      
      if (data.ready) {
        console.log('[GameStartWatcher] ✓ Game is ready!', data);
        
        // If we already have the event from WebSocket, use it
        // Otherwise construct one from the response
        const event: GameStartEvent = gameStartEvent || {
          challengeId: data.challenge.id,
          sessionId: data.session.id,
          gameType: data.challenge.gameType,
          player1Id: data.session.player1Id,
          player1Name: 'Player 1',
          player2Id: data.session.player2Id,
          player2Name: 'Player 2',
          redirectUrl: `/challenge/${challengeId}/play`,
        };
        
        setGameStartEvent(event);
        setShowGameStartModal(true);
        setIsWaiting(false);
        
        // Clear the polling interval
        if (pollingInterval) clearTimeout(pollingInterval);
        
        // Clear the flag
        sessionStorage.removeItem('awaiting_game_start');
        
        toast({
          title: language === 'ar' ? 'بدأت المباراة!' : 'Game Started!',
          description: language === 'ar' 
            ? 'تم فتح النموذج الإجباري' 
            : 'Game modal is now open',
        });
      } else {
        // Not ready yet, schedule another poll
        console.log('[GameStartWatcher] Game not ready yet, will check again in 1 second');
        const timeout = setTimeout(() => {
          pollGameStatus(challengeId);
        }, 1000);
        setPollingInterval(timeout);
      }
    } catch (error) {
      console.error('[GameStartWatcher] Error polling game status:', error);
      
      // Retry after 2 seconds on error
      const timeout = setTimeout(() => {
        pollGameStatus(challengeId);
      }, 2000);
      setPollingInterval(timeout);
    }
  }, [gameStartEvent, toast, language, pollingInterval]);

  // Navigate to game
  const navigateToGame = useCallback((challengeId: string) => {
    console.log('[GameStartWatcher] Navigating to game:', challengeId);
    setShowGameStartModal(false);
    sessionStorage.removeItem('awaiting_game_start');
    setGameStartEvent(null);
    
    if (pollingInterval) clearTimeout(pollingInterval);
    
    setLocation(`/challenge/${challengeId}/play`);
  }, [setLocation, pollingInterval]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearTimeout(pollingInterval);
      }
    };
  }, [pollingInterval]);

  return {
    isWaiting,
    gameStartEvent,
    showGameStartModal,
    setShowGameStartModal,
    navigateToGame,
  };
}
