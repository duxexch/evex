/**
 * Challenge Game Guard
 * Prevents player abandonment and unauthorized navigation during active games
 */

import { useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';

export interface GameGuardConfig {
  enabled: boolean;
  sessionId: string;
  challengeId: string;
  userId: string;
  playerRole: 'player' | 'spectator';
  onAbandonmentDetected?: (reason: string) => void;
}

/**
 * React Hook for protecting active game sessions
 * Prevents accidental or intentional player abandonment
 */
export function useGameSessionGuard(config: GameGuardConfig) {
  const [, setLocation] = useLocation();

  const handleBeforeUnload = useCallback((event: BeforeUnloadEvent) => {
    if (!config.enabled || config.playerRole === 'spectator') {
      return;
    }

    // Show browser warning
    event.preventDefault();
    event.returnValue = '';
    
    if (config.onAbandonmentDetected) {
      config.onAbandonmentDetected('page_close_attempt');
    }
  }, [config, setLocation]);

  const handleUnload = useCallback(() => {
    if (!config.enabled || config.playerRole === 'spectator') {
      return;
    }

    // Send abandonment signal to server
    // Use navigator.sendBeacon to ensure it completes even if page is closing
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        `/api/game-sessions/${config.sessionId}/abandon`,
        JSON.stringify({
          reason: 'page_unload',
          timestamp: new Date().toISOString(),
        })
      );
    }
  }, [config.sessionId]);

  const handleHashChange = useCallback(() => {
    if (!config.enabled || config.playerRole === 'spectator') {
      return;
    }

    // Prevent navigation away from game
    const currentHash = window.location.hash;
    const gameHashPattern = /^#\/challenge\/[^\/]+\/play/;

    if (!gameHashPattern.test(currentHash)) {
      // User tried to navigate away, send forfeit
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          `/api/game-sessions/${config.sessionId}/abandon`,
          JSON.stringify({
            reason: 'navigation_away',
            timestamp: new Date().toISOString(),
          })
        );
      }
    }
  }, [config]);

  const handlePopState = useCallback(() => {
    if (!config.enabled || config.playerRole === 'spectator') {
      return;
    }

    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        `/api/game-sessions/${config.sessionId}/abandon`,
        JSON.stringify({
          reason: 'back_button',
          timestamp: new Date().toISOString(),
        })
      );
    }
  }, [config.sessionId]);

  useEffect(() => {
    if (!config.enabled) {
      return;
    }

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleUnload);
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handlePopState);

    // Cleanup
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleUnload);
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [
    config.enabled,
    handleBeforeUnload,
    handleUnload,
    handleHashChange,
    handlePopState,
  ]);

  /**
   * Send heartbeat to server to keep session alive (prevents inactivity timeout)
   */
  const sendActivityHeartbeat = useCallback(async () => {
    if (!config.enabled) {
      return;
    }

    try {
      await fetch(`/api/game-sessions/${config.sessionId}/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('[Game Guard] Failed to send heartbeat:', error);
    }
  }, [config.sessionId, config.enabled]);

  /**
   * Resign voluntarily from game
   */
  const resign = useCallback(async () => {
    if (!config.enabled) {
      return;
    }

    try {
      const response = await fetch(
        `/api/game-sessions/${config.sessionId}/resign`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reason: 'player_resignation',
            timestamp: new Date().toISOString(),
          }),
        }
      );

      if (response.ok) {
        // Navigate to challenges page
        setLocation('/challenges');
      }
    } catch (error) {
      console.error('[Game Guard] Failed to resign:', error);
    }
  }, [config.sessionId, config.enabled, setLocation]);

  return {
    sendActivityHeartbeat,
    resign,
  };
}

/**
 * Dialog component for confirming page exit
 */
export function GameAbandonmentConfirmDialog(props: {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { isOpen, onConfirm, onCancel } = props;

  if (!isOpen) {
    return null;
  }

  // This is a simple React component - implement with UI library of choice
  // For now, returning null as JSX would require React import
  return null;
}
