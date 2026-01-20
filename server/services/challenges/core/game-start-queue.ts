/**
 * Game Start Message Service
 * Ensures game start messages are delivered even if WebSocket is not ready
 * Uses queue + retry + polling fallback
 */

import { db } from "../../../db";
import { challenges as challengesTable } from "@shared/schema";
import { eq } from "drizzle-orm";

// In-memory message queue for failed broadcasts
const gameStartMessageQueue = new Map<string, {
  message: any;
  attempts: number;
  maxAttempts: number;
  nextRetryTime: Date;
}>();

// Track if a message was successfully delivered
const deliveredMessages = new Set<string>();

export interface GameStartMessage {
  type: 'game_start';
  payload: {
    challengeId: string;
    sessionId: string;
    gameType: string;
    player1Id: string;
    player1Name: string;
    player2Id: string;
    player2Name: string;
    redirectUrl: string;
  };
}

/**
 * Queue a game start message with retry logic
 */
export function queueGameStartMessage(
  userId: string,
  message: GameStartMessage
) {
  const queueKey = `${message.payload.challengeId}-${userId}`;
  
  gameStartMessageQueue.set(queueKey, {
    message,
    attempts: 0,
    maxAttempts: 5,
    nextRetryTime: new Date(),
  });
  
  console.log(`[GameStartQueue] Queued message for ${userId} in challenge ${message.payload.challengeId}`);
}

/**
 * Mark a message as delivered
 */
export function markMessageAsDelivered(
  challengeId: string,
  userId: string
) {
  const messageKey = `${challengeId}-${userId}`;
  deliveredMessages.add(messageKey);
  
  // Remove from queue
  gameStartMessageQueue.delete(messageKey);
  
  console.log(`[GameStartQueue] Marked delivered: ${messageKey}`);
}

/**
 * Check if a message was delivered
 */
export function isMessageDelivered(
  challengeId: string,
  userId: string
): boolean {
  return deliveredMessages.has(`${challengeId}-${userId}`);
}

/**
 * Get pending messages for a user
 * Used as fallback when WebSocket is not available
 */
export function getPendingMessagesForUser(userId: string): GameStartMessage[] {
  const pendingMessages: GameStartMessage[] = [];
  
  gameStartMessageQueue.forEach((value, key) => {
    if (
      (value.message.payload.player1Id === userId || 
       value.message.payload.player2Id === userId) &&
      new Date() >= value.nextRetryTime
    ) {
      pendingMessages.push(value.message);
    }
  });
  
  return pendingMessages;
}

/**
 * Process queued messages (called periodically by a scheduler)
 */
export async function processGameStartMessageQueue(
  broadcastToUser: (userId: string, message: any) => void
) {
  const now = new Date();
  const messagesToRetry: string[] = [];
  
  gameStartMessageQueue.forEach((value, key) => {
    if (now >= value.nextRetryTime && value.attempts < value.maxAttempts) {
      value.attempts++;
      
      // Retry broadcast
      const userId = key.split('-')[1]; // Extract userId from key format
      broadcastToUser(userId, value.message);
      
      // Set next retry time (exponential backoff: 1s, 2s, 4s, 8s, 16s)
      const backoffMs = Math.pow(2, value.attempts - 1) * 1000;
      value.nextRetryTime = new Date(now.getTime() + backoffMs);
      
      console.log(`[GameStartQueue] Retry attempt ${value.attempts} for ${key}, next retry in ${backoffMs}ms`);
    } else if (value.attempts >= value.maxAttempts) {
      messagesToRetry.push(key);
    }
  });
  
  // Clean up exhausted messages
  messagesToRetry.forEach(key => {
    gameStartMessageQueue.delete(key);
    console.warn(`[GameStartQueue] Removed message ${key} after max retries`);
  });
}

/**
 * Get queue status for monitoring
 */
export function getQueueStatus() {
  return {
    queuedMessages: gameStartMessageQueue.size,
    deliveredMessages: deliveredMessages.size,
    messages: Array.from(gameStartMessageQueue.entries()).map(([key, value]) => ({
      key,
      attempts: value.attempts,
      maxAttempts: value.maxAttempts,
      nextRetryTime: value.nextRetryTime.toISOString(),
    })),
  };
}

/**
 * Clear old delivered messages (cleanup)
 */
export function clearOldDeliveredMessages(maxAgeMinutes: number = 60) {
  // In a real implementation, store delivery time with timestamp
  // For now, we'll keep it simple
  if (deliveredMessages.size > 10000) {
    // Clear half of the old entries if we accumulate too many
    let count = 0;
    deliveredMessages.forEach(msg => {
      if (count < deliveredMessages.size / 2) {
        deliveredMessages.delete(msg);
        count++;
      }
    });
  }
}
