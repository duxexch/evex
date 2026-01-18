/**
 * Odds Calculator for Spectator Support System
 * 
 * Calculates fair but profitable betting odds based on player statistics.
 * Uses configurable weights and house margins to ensure a fair game with built-in house edge.
 */

/**
 * Player statistics object extracted from users table
 */
export interface PlayerStats {
  gamesWon: number;
  gamesLost: number;
  gamesPlayed: number;
  currentWinStreak: number;
  longestWinStreak?: number;
  // Game-specific stats (optional)
  chessWon?: number;
  chessPlayed?: number;
  backgammonWon?: number;
  backgammonPlayed?: number;
  dominoWon?: number;
  dominoPlayed?: number;
  tarneebWon?: number;
  tarneebPlayed?: number;
  balootWon?: number;
  balootPlayed?: number;
}

/**
 * Support settings for odds calculation
 */
export interface SupportSettings {
  winRateWeight: string | number;
  experienceWeight: string | number;
  streakWeight: string | number;
  houseFeePercent: string | number;
  defaultOddsPlayer1?: string | number;
  defaultOddsPlayer2?: string | number;
  oddsMode?: 'automatic' | 'manual';
  // Optional: Experience normalization threshold (max games to consider for experience bonus)
  experienceThreshold?: string | number;
  // Optional: Streak normalization threshold (max streak to consider for streak bonus)
  streakThreshold?: string | number;
}

/**
 * Odds calculation result
 */
export interface OddsResult {
  player1Odds: number;
  player2Odds: number;
  player1Probability: number;
  player2Probability: number;
  houseFeePercent: number;
}

/**
 * Winnings calculation result
 */
export interface WinningsResult {
  potentialWinnings: number;
  totalReturn: number;
  profit: number;
}

/**
 * Default support settings
 */
const DEFAULT_SETTINGS: SupportSettings = {
  winRateWeight: 0.60,
  experienceWeight: 0.25,
  streakWeight: 0.15,
  houseFeePercent: 0.05, // 5% house fee
  oddsMode: 'automatic',
  experienceThreshold: 100, // Games beyond this don't increase score further
  streakThreshold: 10, // Win streaks beyond this are capped for normalization
};

/**
 * Normalizes a value to a number, handling string inputs
 */
function normalizeNumber(value: string | number): number {
  return typeof value === 'string' ? parseFloat(value) : value;
}

/**
 * Calculates the win rate for a player
 * 
 * Formula: gamesWon / (gamesWon + gamesLost)
 * Returns 0.5 if player has no completed games
 * 
 * @param player Player statistics
 * @param gameType Optional game type filter (chess, backgammon, etc.)
 * @returns Win rate between 0 and 1
 */
export function calculateWinRate(player: PlayerStats, gameType?: string): number {
  let won = player.gamesWon;
  let played = player.gamesPlayed;

  // Use game-specific stats if available
  if (gameType) {
    const gameKey = gameType.toLowerCase();
    const wonKey = `${gameKey}Won` as keyof PlayerStats;
    const playedKey = `${gameKey}Played` as keyof PlayerStats;
    
    if (wonKey in player && playedKey in player) {
      won = (player[wonKey] as number) || 0;
      played = (player[playedKey] as number) || 0;
    }
  }

  // Prevent division by zero
  if (played === 0) {
    return 0.5; // New players start at 50%
  }

  return won / played;
}

/**
 * Normalizes experience (total games played) to a 0-1 score
 * Uses exponential curve for diminishing returns
 * 
 * Formula: 1 - e^(-0.01 * gamesPlayed)
 * This means:
 * - 1 game = ~0.009 bonus
 * - 100 games = ~0.632 bonus
 * - 1000 games = ~0.99 bonus (capped)
 * 
 * @param player Player statistics
 * @param threshold Optional max games to consider (default 100)
 * @returns Experience score between 0 and 1
 */
export function calculateExperienceScore(player: PlayerStats, threshold: number = 100): number {
  const games = Math.min(player.gamesPlayed, threshold);
  
  if (games === 0) {
    return 0;
  }

  // Use exponential curve for experience bonus
  // This rewards experience but with diminishing returns
  return 1 - Math.exp(-0.01 * games);
}

/**
 * Normalizes current win streak to a 0-1 score
 * Uses logarithmic curve for diminishing returns
 * 
 * Formula: log(1 + streak) / log(1 + threshold)
 * This means:
 * - 1 win streak = ~0.30 bonus
 * - 10 win streak = 1.0 bonus
 * - Higher streaks don't increase further
 * 
 * @param player Player statistics
 * @param threshold Optional max streak to consider (default 10)
 * @returns Streak score between 0 and 1
 */
export function calculateStreakScore(player: PlayerStats, threshold: number = 10): number {
  const streak = Math.min(Math.max(player.currentWinStreak, 0), threshold);
  
  if (threshold === 0) {
    return 0;
  }

  // Use logarithmic curve for streak normalization
  // This rewards momentum but caps at threshold
  return Math.log(1 + streak) / Math.log(1 + threshold);
}

/**
 * Calculates the probability of a player winning based on their statistics
 * 
 * Formula: (winRate * winRateWeight) + (experience * experienceWeight) + (streak * streakWeight)
 * The weighted components are normalized to 0-1 and then combined
 * 
 * @param player Player statistics
 * @param settings Support settings (defaults applied if not provided)
 * @param gameType Optional game type for game-specific stats
 * @returns Probability between 0 and 1
 */
export function calculatePlayerProbability(
  player: PlayerStats,
  settings?: Partial<SupportSettings>,
  gameType?: string
): number {
  const finalSettings = { ...DEFAULT_SETTINGS, ...settings };
  
  // Parse weights as numbers
  const winRateWeight = normalizeNumber(finalSettings.winRateWeight);
  const experienceWeight = normalizeNumber(finalSettings.experienceWeight);
  const streakWeight = normalizeNumber(finalSettings.streakWeight);
  
  // Calculate component scores
  const winRate = calculateWinRate(player, gameType);
  const experience = calculateExperienceScore(
    player,
    parseInt(finalSettings.experienceThreshold?.toString() ?? '100')
  );
  const streak = calculateStreakScore(
    player,
    parseInt(finalSettings.streakThreshold?.toString() ?? '10')
  );
  
  // Calculate weighted probability
  const probability = (winRate * winRateWeight) + (experience * experienceWeight) + (streak * streakWeight);
  
  // Ensure probability is within valid range (0.05 to 0.95 for fairness)
  // This prevents unrealistic odds where one player is guaranteed to win
  return Math.max(0.05, Math.min(0.95, probability));
}

/**
 * Converts a probability to decimal betting odds
 * 
 * Formula: 1 / probability
 * For example: 50% probability = 2.0 odds, 33% probability = 3.0 odds
 * 
 * @param probability Win probability (0-1)
 * @returns Decimal odds (e.g., 1.5, 2.0, 3.0)
 */
export function probabilityToOdds(probability: number): number {
  if (probability <= 0 || probability >= 1) {
    return probability <= 0 ? 100 : 1; // Extreme values
  }

  const odds = 1 / probability;
  
  // Round to 2 decimal places for standard betting format
  return Math.round(odds * 100) / 100;
}

/**
 * Applies house fee to betting odds
 * This ensures the house makes a profit while keeping odds fair
 * 
 * Formula: odds * (1 - houseFeePercent)
 * For example: 2.0 odds with 5% fee = 1.90 odds
 * 
 * @param odds Original decimal odds
 * @param houseFeePercent House fee as decimal (0.05 = 5%)
 * @returns Adjusted odds after house fee
 */
export function applyHouseFee(odds: number, houseFeePercent: number): number {
  const fee = normalizeNumber(houseFeePercent);
  const adjustedOdds = odds * (1 - fee);
  
  // Minimum odds should be at least 1.01 to avoid negative returns
  return Math.max(1.01, adjustedOdds);
}

/**
 * Calculates betting odds for two players
 * 
 * This function:
 * 1. Calculates probability for each player
 * 2. Converts probabilities to decimal odds
 * 3. Applies house fee
 * 4. Normalizes odds so they're fair and proportional
 * 
 * @param player1 First player statistics
 * @param player2 Second player statistics
 * @param settings Support settings (defaults applied if not provided)
 * @param gameType Optional game type for game-specific stats
 * @returns Odds for both players and their probabilities
 */
export function calculateOdds(
  player1: PlayerStats,
  player2: PlayerStats,
  settings?: Partial<SupportSettings>,
  gameType?: string
): OddsResult {
  const finalSettings = { ...DEFAULT_SETTINGS, ...settings };
  
  // If manual mode is enabled, return default odds
  if (finalSettings.oddsMode === 'manual') {
    return {
      player1Odds: parseFloat(finalSettings.defaultOddsPlayer1?.toString() ?? '2.0'),
      player2Odds: parseFloat(finalSettings.defaultOddsPlayer2?.toString() ?? '2.0'),
      player1Probability: 0.5,
      player2Probability: 0.5,
      houseFeePercent: parseFloat(finalSettings.houseFeePercent.toString()),
    };
  }
  
  // Calculate probabilities for both players
  const player1Probability = calculatePlayerProbability(player1, settings, gameType);
  const player2Probability = calculatePlayerProbability(player2, settings, gameType);
  
  // Normalize probabilities to ensure they sum to 1
  const totalProbability = player1Probability + player2Probability;
  const normalizedPlayer1Probability = player1Probability / totalProbability;
  const normalizedPlayer2Probability = player2Probability / totalProbability;
  
  // Convert to decimal odds
  let player1Odds = probabilityToOdds(normalizedPlayer1Probability);
  let player2Odds = probabilityToOdds(normalizedPlayer2Probability);
  
  // Apply house fee
  const houseFeePercent = parseFloat(finalSettings.houseFeePercent.toString());
  player1Odds = applyHouseFee(player1Odds, houseFeePercent);
  player2Odds = applyHouseFee(player2Odds, houseFeePercent);
  
  return {
    player1Odds: Math.round(player1Odds * 100) / 100,
    player2Odds: Math.round(player2Odds * 100) / 100,
    player1Probability: Math.round(normalizedPlayer1Probability * 10000) / 10000,
    player2Probability: Math.round(normalizedPlayer2Probability * 10000) / 10000,
    houseFeePercent,
  };
}

/**
 * Calculates potential winnings from a bet
 * 
 * Formula: 
 * - Potential Winnings = stake * (odds - 1)
 * - Total Return = stake * odds
 * - Profit = Total Return - Stake
 * 
 * For example: $100 bet at 2.0 odds
 * - Winnings: $100 (net profit)
 * - Total Return: $200 (includes original stake)
 * - Profit: $100 (net gain)
 * 
 * @param amount Stake amount
 * @param odds Decimal odds (e.g., 1.5, 2.0, 3.0)
 * @returns Potential winnings calculation
 */
export function calculatePotentialWinnings(amount: string | number, odds: string | number): WinningsResult {
  const stake = normalizeNumber(amount);
  const oddsValue = normalizeNumber(odds);
  
  // Calculate total return
  const totalReturn = stake * oddsValue;
  
  // Calculate profit (return minus original stake)
  const profit = totalReturn - stake;
  
  // Potential winnings is the profit (not including original stake)
  const potentialWinnings = profit;
  
  return {
    potentialWinnings: Math.round(potentialWinnings * 100) / 100,
    totalReturn: Math.round(totalReturn * 100) / 100,
    profit: Math.round(profit * 100) / 100,
  };
}

/**
 * Validates odds to ensure they're within reasonable bounds
 * 
 * Rules:
 * - Odds must be >= 1.01 (minimum return)
 * - Odds must be <= 100 (maximum reasonable odds)
 * - Both players can't have identical odds (unfair match)
 * 
 * @param player1Odds First player's odds
 * @param player2Odds Second player's odds
 * @returns Validation result with any error messages
 */
export function validateOdds(player1Odds: number, player2Odds: number): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (player1Odds < 1.01) {
    errors.push(`Player 1 odds (${player1Odds}) is below minimum (1.01)`);
  }
  
  if (player2Odds < 1.01) {
    errors.push(`Player 2 odds (${player2Odds}) is below minimum (1.01)`);
  }
  
  if (player1Odds > 100) {
    errors.push(`Player 1 odds (${player1Odds}) exceeds maximum (100)`);
  }
  
  if (player2Odds > 100) {
    errors.push(`Player 2 odds (${player2Odds}) exceeds maximum (100)`);
  }
  
  if (Math.abs(player1Odds - player2Odds) < 0.01) {
    errors.push('Player odds are too close, indicating potential mismatch data');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculates implied probability from decimal odds
 * This is the inverse of probabilityToOdds
 * 
 * Formula: 1 / odds
 * For example: 2.0 odds = 50% probability, 3.0 odds = 33.33% probability
 * 
 * @param odds Decimal odds
 * @returns Implied probability (0-1)
 */
export function oddsToImpliedProbability(odds: number): number {
  if (odds < 1.01) {
    return 0;
  }

  const probability = 1 / odds;
  return Math.max(0, Math.min(1, probability));
}

/**
 * Calculates the house advantage in a match
 * House edge is how much the house profits from the betting market
 * 
 * Formula: 1 - (1/player1Odds + 1/player2Odds)
 * A positive house edge means the house profits (good for casino)
 * A negative house edge means the house loses (bad for casino)
 * 
 * @param player1Odds First player's odds
 * @param player2Odds Second player's odds
 * @returns House edge as decimal (0.05 = 5% edge)
 */
export function calculateHouseEdge(player1Odds: number, player2Odds: number): number {
  const impliedProb1 = oddsToImpliedProbability(player1Odds);
  const impliedProb2 = oddsToImpliedProbability(player2Odds);
  
  const totalImpliedProb = impliedProb1 + impliedProb2;
  const houseEdge = 1 - (1 / totalImpliedProb);
  
  return Math.max(0, Math.min(1, houseEdge));
}

/**
 * Generates a detailed odds report for analysis
 * Useful for auditing and monitoring odds fairness
 * 
 * @param player1 First player statistics
 * @param player2 Second player statistics
 * @param oddsResult Calculated odds result
 * @param gameType Optional game type
 * @returns Detailed report object
 */
export function generateOddsReport(
  player1: PlayerStats,
  player2: PlayerStats,
  oddsResult: OddsResult,
  gameType?: string
) {
  const p1WinRate = calculateWinRate(player1, gameType);
  const p2WinRate = calculateWinRate(player2, gameType);
  
  const p1Experience = calculateExperienceScore(player1);
  const p2Experience = calculateExperienceScore(player2);
  
  const p1Streak = calculateStreakScore(player1);
  const p2Streak = calculateStreakScore(player2);
  
  const houseEdge = calculateHouseEdge(oddsResult.player1Odds, oddsResult.player2Odds);
  const impliedP1Prob = oddsToImpliedProbability(oddsResult.player1Odds);
  const impliedP2Prob = oddsToImpliedProbability(oddsResult.player2Odds);
  
  return {
    player1: {
      stats: {
        gamesPlayed: player1.gamesPlayed,
        gamesWon: player1.gamesWon,
        gamesLost: player1.gamesLost,
        currentWinStreak: player1.currentWinStreak,
      },
      scores: {
        winRate: Math.round(p1WinRate * 10000) / 10000,
        experience: Math.round(p1Experience * 10000) / 10000,
        streak: Math.round(p1Streak * 10000) / 10000,
      },
      odds: oddsResult.player1Odds,
      probability: oddsResult.player1Probability,
      impliedProbability: Math.round(impliedP1Prob * 10000) / 10000,
    },
    player2: {
      stats: {
        gamesPlayed: player2.gamesPlayed,
        gamesWon: player2.gamesWon,
        gamesLost: player2.gamesLost,
        currentWinStreak: player2.currentWinStreak,
      },
      scores: {
        winRate: Math.round(p2WinRate * 10000) / 10000,
        experience: Math.round(p2Experience * 10000) / 10000,
        streak: Math.round(p2Streak * 10000) / 10000,
      },
      odds: oddsResult.player2Odds,
      probability: oddsResult.player2Probability,
      impliedProbability: Math.round(impliedP2Prob * 10000) / 10000,
    },
    market: {
      houseFeePercent: oddsResult.houseFeePercent,
      houseEdgePercent: Math.round(houseEdge * 10000) / 100,
      totalImpliedProbability: Math.round((impliedP1Prob + impliedP2Prob) * 10000) / 10000,
    },
  };
}

export default {
  calculateWinRate,
  calculateExperienceScore,
  calculateStreakScore,
  calculatePlayerProbability,
  probabilityToOdds,
  applyHouseFee,
  calculateOdds,
  calculatePotentialWinnings,
  validateOdds,
  oddsToImpliedProbability,
  calculateHouseEdge,
  generateOddsReport,
};
