/**
 * Game Start Manager Service
 * Handles all aspects of game start workflow with retry logic and delivery confirmation
 * This is the single source of truth for initiating games
 */

import { db } from "../../../db";
import { 
  liveGameSessions, 
  challenges, 
  notifications 
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { broadcastToUser } from "../../../websocket";
import { queueGameStartMessage } from "./game-start-queue";

interface GameStartPayload {
  challengeId: string;
  sessionId: string;
  gameType: string;
  player1Id: string;
  player1Name: string;
  player2Id: string;
  player2Name: string;
  redirectUrl: string;
}

interface DeliveryStatus {
  challengeId: string;
  player1Delivered: boolean;
  player2Delivered: boolean;
  timestamp: Date;
}

// Track delivery status for debugging
const deliveryLog = new Map<string, DeliveryStatus>();

export async function initiateGameStart(
  challengeId: string,
  sessionId: string,
  gameType: string,
  player1Id: string,
  player1Name: string,
  player2Id: string,
  player2Name: string
): Promise<{
  success: boolean;
  message?: string;
  deliveryStatus?: DeliveryStatus;
}> {
  const startTime = Date.now();
  const correlationId = `${challengeId}-${Date.now()}`;
  
  console.log(`[GameStartManager] Starting game initiation (${correlationId})`);
  console.log(`  Challenge: ${challengeId}`);
  console.log(`  Players: ${player1Id} vs ${player2Id}`);
  console.log(`  Session: ${sessionId}`);
  console.log(`  Game Type: ${gameType}`);

  try {
    // Create the game start payload
    const payload: GameStartPayload = {
      challengeId,
      sessionId,
      gameType,
      player1Id,
      player1Name,
      player2Id,
      player2Name,
      redirectUrl: `/challenge/${challengeId}/play`,
    };

    const gameStartMessage = {
      type: "game_start",
      payload,
      timestamp: new Date().toISOString(),
      correlationId,
    };

    console.log(`[GameStartManager] Broadcasting game_start message (${correlationId})`);

    // Attempt to send to both players with delivery tracking
    let player1Delivered = false;
    let player2Delivered = false;

    // Send to Player 1
    console.log(`[GameStartManager] Sending to Player 1: ${player1Id}`);
    const player1Result = broadcastToUser(player1Id, gameStartMessage);
    player1Delivered = player1Result;
    
    if (player1Delivered) {
      console.log(`[GameStartManager] ✓ Player 1 broadcast successful`);
      markDelivered(challengeId, player1Id, true);
    } else {
      console.log(`[GameStartManager] ✗ Player 1 WebSocket unavailable, queuing`);
      queueGameStartMessage(player1Id, gameStartMessage);
    }

    // Send to Player 2
    console.log(`[GameStartManager] Sending to Player 2: ${player2Id}`);
    const player2Result = broadcastToUser(player2Id, gameStartMessage);
    player2Delivered = player2Result;
    
    if (player2Delivered) {
      console.log(`[GameStartManager] ✓ Player 2 broadcast successful`);
      markDelivered(challengeId, player2Id, true);
    } else {
      console.log(`[GameStartManager] ✗ Player 2 WebSocket unavailable, queuing`);
      queueGameStartMessage(player2Id, gameStartMessage);
    }

    const deliveryStatus: DeliveryStatus = {
      challengeId,
      player1Delivered,
      player2Delivered,
      timestamp: new Date(),
    };

    deliveryLog.set(correlationId, deliveryStatus);

    const elapsedMs = Date.now() - startTime;
    console.log(`[GameStartManager] Game start message sent (${elapsedMs}ms)`);
    console.log(`  Player 1 (${player1Id}): ${player1Delivered ? '✓ Delivered' : '⚠ Queued'}`);
    console.log(`  Player 2 (${player2Id}): ${player2Delivered ? '✓ Delivered' : '⚠ Queued'}`);
    console.log(`  Correlation ID: ${correlationId}`);

    // Return success even if WebSocket delivery failed
    // Messages will be queued and delivered via polling
    return {
      success: true,
      deliveryStatus,
    };
  } catch (error: any) {
    console.error(`[GameStartManager] Error initiating game start:`, error);
    return {
      success: false,
      message: error.message || "Failed to initiate game start",
    };
  }
}

function markDelivered(challengeId: string, userId: string, delivered: boolean) {
  console.log(`[GameStartManager] Marking delivery: ${userId} = ${delivered}`);
  // This would be extended to track in database if needed
}

export function getDeliveryLog(correlationId: string): DeliveryStatus | undefined {
  return deliveryLog.get(correlationId);
}

export function getDeliveryHistory(): Array<[string, DeliveryStatus]> {
  // Return last 100 entries
  return Array.from(deliveryLog.entries()).slice(-100);
}
