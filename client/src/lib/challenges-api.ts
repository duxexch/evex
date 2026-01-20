/**
 * Challenges API Client
 * Type-safe API client for all challenge endpoints
 * Includes offline support via localStorage caching
 */

import { apiRequest } from '@/lib/queryClient';
import { offlineStorage } from '@/lib/offline-storage';

// Types
export interface ChallengeCreateRequest {
  gameType: string;
  betAmount: number;
  currencyType?: 'usd' | 'project';
  visibility?: 'public' | 'private';
  opponentType?: 'random' | 'friend';
  friendAccountId?: string;
  timeLimit?: number;
}

export interface ChallengeAcceptRequest {
  challengeId: string;
}

export interface Challenge {
  id: string;
  gameType: string;
  betAmount: number;
  currencyType: 'usd' | 'project';
  visibility: 'public' | 'private';
  status: 'waiting' | 'active' | 'completed' | 'cancelled';
  player1Id: string;
  player1Name?: string;
  player2Id?: string;
  player2Name?: string;
  timeLimit: number;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
}

export interface GameSession {
  id: string;
  challengeId: string;
  gameType: string;
  status: 'waiting_players' | 'in_progress' | 'completed';
  player1Id: string;
  player2Id: string;
  winnerId?: string;
  spectatorCount: number;
  totalGiftsValue: string;
  startedAt: string;
  endedAt?: string;
}

// API Functions

/**
 * Create a new challenge
 */
export async function createChallenge(
  request: ChallengeCreateRequest
): Promise<Challenge> {
  return (await apiRequest('POST', '/api/challenges', {
    ...request,
    currencyType: request.currencyType || 'project',
    visibility: request.visibility || 'public',
    opponentType: request.opponentType || 'random',
  })) as unknown as Challenge;
}

/**
 * Get available challenges to join
 */
export async function getAvailableChallenges(): Promise<Challenge[]> {
  try {
    const result = await apiRequest('GET', '/api/challenges/available');
    offlineStorage.saveAvailableChallenges(result as unknown as Challenge[]);
    return result as unknown as Challenge[];
  } catch (error) {
    console.warn('[Challenges API] Failed to fetch available challenges, using offline cache');
    const cached = offlineStorage.getAvailableChallenges();
    if (cached) {
      return cached;
    }
    throw error;
  }
}

/**
 * Get all public/active challenges for Arena
 */
export async function getPublicChallenges(): Promise<Challenge[]> {
  try {
    const result = await apiRequest('GET', '/api/challenges/public');
    offlineStorage.savePublicChallenges(result as unknown as Challenge[]);
    return result as unknown as Challenge[];
  } catch (error) {
    console.warn('[Challenges API] Failed to fetch public challenges, using offline cache');
    const cached = offlineStorage.getPublicChallenges();
    if (cached) {
      return cached;
    }
    throw error;
  }
}

/**
 * Get user's own challenges
 */
export async function getUserChallenges(): Promise<Challenge[]> {
  try {
    const result = await apiRequest('GET', '/api/challenges/my');
    offlineStorage.saveMyChallenges(result as unknown as Challenge[]);
    return result as unknown as Challenge[];
  } catch (error) {
    console.warn('[Challenges API] Failed to fetch user challenges, using offline cache');
    const cached = offlineStorage.getMyChallenges();
    if (cached) {
      return cached;
    }
    throw error;
  }
}

/**
 * Get specific challenge details
 */
export async function getChallengeDetails(challengeId: string): Promise<Challenge> {
  return (await apiRequest('GET', `/api/challenges/${challengeId}`)) as unknown as Challenge;
}

/**
 * Accept/Join a challenge
 */
export async function acceptChallenge(challengeId: string): Promise<Challenge> {
  return (await apiRequest('POST', `/api/challenges/${challengeId}/join`)) as unknown as Challenge;
}

/**
 * Withdraw/Cancel a challenge (30% penalty applied)
 */
export async function withdrawChallenge(
  challengeId: string
): Promise<{ success: boolean; penalty: number; refund: number }> {
  const response = await apiRequest('POST', `/api/challenges/${challengeId}/withdraw`);
  return response as unknown as { success: boolean; penalty: number; refund: number };
}

/**
 * Get game session for a challenge
 */
export async function getGameSession(challengeId: string): Promise<GameSession | null> {
  const response = await apiRequest('GET', `/api/challenges/${challengeId}/session`);
  return response as unknown as GameSession | null;
}

/**
 * Send activity heartbeat to prevent inactivity timeout
 */
export async function sendActivityHeartbeat(sessionId: string): Promise<{ success: boolean }> {
  const response = await apiRequest('POST', `/api/game-sessions/${sessionId}/activity`);
  return response as unknown as { success: boolean };
}

/**
 * Resign from a game (voluntary forfeit)
 */
export async function resignFromGame(sessionId: string): Promise<{ success: boolean }> {
  const response = await apiRequest('POST', `/api/game-sessions/${sessionId}/resign`);
  return response as unknown as { success: boolean };
}

/**
 * Place a spectator support/bet
 */
export async function placeSpectatorSupport(
  challengeId: string,
  backedPlayerId: string,
  stakeAmount: number
): Promise<any> {
  return (await apiRequest('POST', `/api/challenges/${challengeId}/stake`, {
    backedPlayerId,
    stakeAmount,
  })) as any;
}

/**
 * Send a gift to a player
 */
export async function sendGift(
  challengeId: string,
  recipientId: string,
  giftItemId: string,
  quantity: number = 1,
  message?: string
): Promise<any> {
  return (await apiRequest('POST', `/api/challenges/${challengeId}/gift`, {
    recipientId,
    giftItemId,
    quantity,
    message,
  })) as any;
}

/**
 * Get all supports/bets for a challenge
 */
export async function getChallengeSupports(challengeId: string): Promise<any[]> {
  const response = await apiRequest('GET', `/api/challenges/${challengeId}/stakes`);
  return response as unknown as any[];
}

/**
 * Get all gifts sent in a challenge
 */
export async function getChallengeGifts(challengeId: string): Promise<any[]> {
  const response = await apiRequest('GET', `/api/challenges/${challengeId}/gifts`);
  return response as unknown as any[];
}
/**
 * Get pending game start messages (polling fallback)
 * Used when WebSocket is not available or delayed
 */
export async function getPendingGameStartMessages(): Promise<{
  messages: any[];
  count: number;
}> {
  return (await apiRequest('GET', '/api/game-start-messages/pending')) as any;
}

/**
 * Acknowledge a game start message was received
 */
export async function acknowledgeGameStartMessage(challengeId: string): Promise<any> {
  return (await apiRequest('POST', `/api/game-start-messages/${challengeId}/acknowledge`)) as any;
}