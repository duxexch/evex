/**
 * Game Inactivity Checker Service
 * Monitors active games and forfeits games that exceed inactivity timeout (15 minutes)
 * Runs as a background service every 60 seconds
 */

import { checkAndForeitInactiveSessions } from './game-abandonment';

export interface InactivityCheckerConfig {
  enabled: boolean;
  checkIntervalSeconds: number;
  inactivityThresholdMinutes: number;
  maxErrorsBeforePause: number;
}

export class GameInactivityChecker {
  private checkInterval: NodeJS.Timer | null = null;
  private config: InactivityCheckerConfig;
  private consecutiveErrors: number = 0;

  constructor(config: Partial<InactivityCheckerConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      checkIntervalSeconds: config.checkIntervalSeconds ?? 60,
      inactivityThresholdMinutes: config.inactivityThresholdMinutes ?? 15,
      maxErrorsBeforePause: config.maxErrorsBeforePause ?? 5,
    };
  }

  /**
   * Start the inactivity checker
   */
  start(): void {
    if (!this.config.enabled) {
      console.log('[Game Inactivity Checker] Disabled in configuration');
      return;
    }

    if (this.checkInterval) {
      console.warn('[Game Inactivity Checker] Already running');
      return;
    }

    console.log(
      `[Game Inactivity Checker] Started with ${this.config.checkIntervalSeconds}s interval, ${this.config.inactivityThresholdMinutes}m threshold`
    );

    // Run immediately and then every interval
    this.runCheck().catch((err) => {
      console.error('[Game Inactivity Checker] Initial check failed:', err);
    });

    this.checkInterval = setInterval(() => {
      this.runCheck().catch((err) => {
        console.error('[Game Inactivity Checker] Check failed:', err);
      });
    }, this.config.checkIntervalSeconds * 1000);
  }

  /**
   * Stop the inactivity checker
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval as any);
      this.checkInterval = null;
      console.log('[Game Inactivity Checker] Stopped');
    }
  }

  /**
   * Run a single inactivity check
   */
  private async runCheck(): Promise<void> {
    try {
      const result = await checkAndForeitInactiveSessions(
        this.config.inactivityThresholdMinutes
      );

      // Log results if there were any forfeits
      if (result.foreitCount > 0) {
        console.log(
          `[Game Inactivity Checker] Checked ${result.checkedCount} sessions, forfeited ${result.foreitCount}`
        );
      }

      // Log errors if any
      if (result.errors.length > 0) {
        console.warn('[Game Inactivity Checker] Errors:', result.errors);
        this.consecutiveErrors++;

        // Pause checker if too many errors
        if (
          this.consecutiveErrors >= this.config.maxErrorsBeforePause
        ) {
          console.error(
            `[Game Inactivity Checker] Too many consecutive errors (${this.consecutiveErrors}), pausing checker`
          );
          this.stop();
        }
      } else {
        // Reset error counter on successful check
        this.consecutiveErrors = 0;
      }
    } catch (error: any) {
      console.error('[Game Inactivity Checker] Unexpected error:', error);
      this.consecutiveErrors++;

      if (this.consecutiveErrors >= this.config.maxErrorsBeforePause) {
        console.error(
          `[Game Inactivity Checker] Too many consecutive errors (${this.consecutiveErrors}), pausing checker`
        );
        this.stop();
      }
    }
  }

  /**
   * Check if checker is running
   */
  isRunning(): boolean {
    return this.checkInterval !== null;
  }

  /**
   * Restart the checker
   */
  restart(): void {
    this.stop();
    this.start();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<InactivityCheckerConfig>): void {
    const wasRunning = this.isRunning();
    if (wasRunning) {
      this.stop();
    }

    this.config = {
      ...this.config,
      ...config,
    };

    if (wasRunning) {
      this.start();
    }

    console.log('[Game Inactivity Checker] Configuration updated:', this.config);
  }
}

// Global instance
let globalChecker: GameInactivityChecker | null = null;

/**
 * Initialize global inactivity checker
 */
export function initializeGameInactivityChecker(
  config?: Partial<InactivityCheckerConfig>
): GameInactivityChecker {
  if (globalChecker) {
    console.warn('[Game Inactivity Checker] Already initialized');
    return globalChecker;
  }

  globalChecker = new GameInactivityChecker(config);
  globalChecker.start();
  return globalChecker;
}

/**
 * Get global inactivity checker instance
 */
export function getGameInactivityChecker(): GameInactivityChecker | null {
  return globalChecker;
}

/**
 * Stop global inactivity checker
 */
export function stopGameInactivityChecker(): void {
  if (globalChecker) {
    globalChecker.stop();
    globalChecker = null;
  }
}
