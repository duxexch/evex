/**
 * Services Initialization
 * Initializes all background services on server startup
 */

import { initializeGameInactivityChecker } from './services/game/game-inactivity-checker';
import { processGameStartMessageQueue } from './services/challenges/core/game-start-queue';
import { broadcastToUser } from './websocket';
import { log } from './index';

let messageQueueIntervalId: NodeJS.Timeout | null = null;

export async function initializeServices(): Promise<void> {
  try {
    log('Initializing services...', 'services');

    // Initialize game inactivity checker
    // Monitors games for 15-minute inactivity and auto-forfeits
    const inactivityChecker = initializeGameInactivityChecker({
      enabled: true,
      checkIntervalSeconds: 60, // Check every 60 seconds
      inactivityThresholdMinutes: 15, // Forfeit after 15 minutes
      maxErrorsBeforePause: 5,
    });

    log('✅ Game Inactivity Checker initialized', 'services');
    log(`   - Enabled: true`, 'services');
    log(`   - Check interval: 60 seconds`, 'services');
    log(`   - Inactivity threshold: 15 minutes`, 'services');

    // Initialize game start message queue processor
    // Retries failed WebSocket broadcasts and manages message delivery
    messageQueueIntervalId = setInterval(() => {
      processGameStartMessageQueue(broadcastToUser);
    }, 2000); // Process queue every 2 seconds

    log('✅ Game Start Message Queue initialized', 'services');
    log(`   - Processing interval: 2 seconds`, 'services');
    log(`   - Retry strategy: Exponential backoff`, 'services');

    log('✅ All services initialized successfully', 'services');
  } catch (error: any) {
    log(`❌ Service initialization failed: ${error.message}`, 'services');
    throw error;
  }
}

export async function shutdownServices(): Promise<void> {
  try {
    log('Shutting down services...', 'services');

    // Clear message queue processor interval
    if (messageQueueIntervalId) {
      clearInterval(messageQueueIntervalId);
      log('✅ Game Start Message Queue stopped', 'services');
    }

    log('✅ All services shut down successfully', 'services');
  } catch (error: any) {
    log(`❌ Service shutdown failed: ${error.message}`, 'services');
  }
}
