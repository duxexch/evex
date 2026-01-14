// Card Game Engine - Shared logic for Tarneeb and Baloot

export interface PlayingCard {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: string;
  value: number;
}

export interface TarneebState {
  phase: 'bidding' | 'playing' | 'finished';
  hands: { [playerId: string]: PlayingCard[] };
  currentTrick: { playerId: string; card: PlayingCard }[];
  trumpSuit: 'hearts' | 'diamonds' | 'clubs' | 'spades' | null;
  currentPlayer: string;
  playerOrder: string[]; // [player0, player1, player2, player3]
  bids: { playerId: string; bid: number | null }[];
  highestBid: { playerId: string; bid: number } | null;
  biddingTeam: number | null; // 0 or 1
  tricksWon: { team0: number; team1: number };
  roundScores: { team0: number; team1: number };
  totalScores: { team0: number; team1: number };
  dealerId: string;
  trickLeader: string;
  roundNumber: number;
  targetScore: number;
}

export interface BalootState {
  phase: 'choosing' | 'playing' | 'finished';
  hands: { [playerId: string]: PlayingCard[] };
  currentTrick: { playerId: string; card: PlayingCard }[];
  gameType: 'sun' | 'hokm' | null;
  trumpSuit: 'hearts' | 'diamonds' | 'clubs' | 'spades' | null;
  currentPlayer: string;
  playerOrder: string[];
  choosingPlayer: string;
  tricksWon: { team0: number; team1: number };
  roundPoints: { team0: number; team1: number };
  totalPoints: { team0: number; team1: number };
  projects: { playerId: string; project: string; points: number }[];
  dealerId: string;
  trickLeader: string;
  roundNumber: number;
  targetPoints: number;
}

// Card deck creation
function createDeck(): PlayingCard[] {
  const suits: PlayingCard['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck: PlayingCard[] = [];
  
  for (const suit of suits) {
    for (let i = 0; i < ranks.length; i++) {
      deck.push({ suit, rank: ranks[i], value: i });
    }
  }
  
  return deck;
}

function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ============ TARNEEB ============

export function createTarneebState(playerIds: string[], targetScore: number = 31): TarneebState {
  if (playerIds.length !== 4) {
    throw new Error('Tarneeb requires exactly 4 players');
  }
  
  const deck = shuffle(createDeck());
  const hands: { [playerId: string]: PlayingCard[] } = {};
  
  // Deal 13 cards to each player (52 / 4 = 13)
  for (let i = 0; i < 4; i++) {
    hands[playerIds[i]] = deck.slice(i * 13, (i + 1) * 13);
  }
  
  return {
    phase: 'bidding',
    hands,
    currentTrick: [],
    trumpSuit: null,
    currentPlayer: playerIds[1], // Player after dealer starts bidding
    playerOrder: playerIds,
    bids: [],
    highestBid: null,
    biddingTeam: null,
    tricksWon: { team0: 0, team1: 0 },
    roundScores: { team0: 0, team1: 0 },
    totalScores: { team0: 0, team1: 0 },
    dealerId: playerIds[0],
    trickLeader: playerIds[1],
    roundNumber: 1,
    targetScore,
  };
}

export function tarneebBid(state: TarneebState, playerId: string, bid: number | null): { valid: boolean; newState?: TarneebState; error?: string } {
  if (state.phase !== 'bidding') {
    return { valid: false, error: 'Not in bidding phase' };
  }
  
  if (state.currentPlayer !== playerId) {
    return { valid: false, error: 'Not your turn to bid' };
  }
  
  // Validate bid
  if (bid !== null) {
    if (bid < 7 || bid > 13) {
      return { valid: false, error: 'Bid must be between 7 and 13' };
    }
    if (state.highestBid && bid <= state.highestBid.bid) {
      return { valid: false, error: 'Bid must be higher than current highest' };
    }
  }
  
  const newState: TarneebState = {
    ...state,
    bids: [...state.bids, { playerId, bid }],
    highestBid: bid !== null ? { playerId, bid } : state.highestBid,
  };
  
  // Move to next player
  const currentIndex = state.playerOrder.indexOf(playerId);
  const nextIndex = (currentIndex + 1) % 4;
  newState.currentPlayer = state.playerOrder[nextIndex];
  
  // Check if bidding is complete (all 4 players have bid)
  if (newState.bids.length === 4) {
    if (!newState.highestBid) {
      // All passed - redeal
      return { valid: true, newState: createTarneebState(state.playerOrder, state.targetScore) };
    }
    
    // Move to playing phase
    newState.phase = 'playing';
    newState.currentPlayer = newState.highestBid.playerId;
    newState.trickLeader = newState.highestBid.playerId;
    newState.biddingTeam = state.playerOrder.indexOf(newState.highestBid.playerId) % 2;
  }
  
  return { valid: true, newState };
}

export function tarneebSetTrump(state: TarneebState, playerId: string, suit: TarneebState['trumpSuit']): { valid: boolean; newState?: TarneebState; error?: string } {
  if (state.phase !== 'playing' || state.trumpSuit !== null) {
    return { valid: false, error: 'Cannot set trump now' };
  }
  
  if (!state.highestBid || state.highestBid.playerId !== playerId) {
    return { valid: false, error: 'Only winning bidder can set trump' };
  }
  
  return {
    valid: true,
    newState: { ...state, trumpSuit: suit },
  };
}

function getCardValue(card: PlayingCard, trumpSuit: string | null, leadSuit: string): number {
  let value = card.value;
  
  // Trump cards are highest
  if (trumpSuit && card.suit === trumpSuit) {
    value += 100;
  } else if (card.suit === leadSuit) {
    value += 50;
  }
  
  return value;
}

export function tarneebPlayCard(state: TarneebState, playerId: string, card: PlayingCard): { valid: boolean; newState?: TarneebState; error?: string } {
  if (state.phase !== 'playing') {
    return { valid: false, error: 'Not in playing phase' };
  }
  
  if (state.currentPlayer !== playerId) {
    return { valid: false, error: 'Not your turn' };
  }
  
  if (!state.trumpSuit) {
    return { valid: false, error: 'Trump suit not set yet' };
  }
  
  const hand = state.hands[playerId];
  const cardIndex = hand.findIndex(c => c.suit === card.suit && c.rank === card.rank);
  
  if (cardIndex === -1) {
    return { valid: false, error: 'Card not in hand' };
  }
  
  // Check if following suit
  if (state.currentTrick.length > 0) {
    const leadSuit = state.currentTrick[0].card.suit;
    const hasSuit = hand.some(c => c.suit === leadSuit);
    if (hasSuit && card.suit !== leadSuit) {
      return { valid: false, error: 'Must follow suit' };
    }
  }
  
  const newState: TarneebState = {
    ...state,
    hands: {
      ...state.hands,
      [playerId]: hand.filter((_, i) => i !== cardIndex),
    },
    currentTrick: [...state.currentTrick, { playerId, card }],
  };
  
  // Check if trick is complete
  if (newState.currentTrick.length === 4) {
    // Determine winner
    const leadSuit = newState.currentTrick[0].card.suit;
    let winnerIndex = 0;
    let highestValue = getCardValue(newState.currentTrick[0].card, state.trumpSuit, leadSuit);
    
    for (let i = 1; i < 4; i++) {
      const value = getCardValue(newState.currentTrick[i].card, state.trumpSuit, leadSuit);
      if (value > highestValue) {
        highestValue = value;
        winnerIndex = i;
      }
    }
    
    const winnerId = newState.currentTrick[winnerIndex].playerId;
    const winnerTeam = state.playerOrder.indexOf(winnerId) % 2;
    
    if (winnerTeam === 0) {
      newState.tricksWon.team0++;
    } else {
      newState.tricksWon.team1++;
    }
    
    newState.currentTrick = [];
    newState.currentPlayer = winnerId;
    newState.trickLeader = winnerId;
    
    // Check if round is complete (all 13 tricks played)
    if (newState.tricksWon.team0 + newState.tricksWon.team1 === 13) {
      const biddingTeam = state.biddingTeam!;
      const biddingTeamTricks = biddingTeam === 0 ? newState.tricksWon.team0 : newState.tricksWon.team1;
      const bidValue = state.highestBid!.bid;
      
      if (biddingTeamTricks >= bidValue) {
        // Bid made
        if (biddingTeam === 0) {
          newState.roundScores.team0 = bidValue;
        } else {
          newState.roundScores.team1 = bidValue;
        }
      } else {
        // Bid failed
        if (biddingTeam === 0) {
          newState.roundScores.team0 = -bidValue;
          newState.roundScores.team1 = 13 - biddingTeamTricks;
        } else {
          newState.roundScores.team1 = -bidValue;
          newState.roundScores.team0 = 13 - biddingTeamTricks;
        }
      }
      
      newState.totalScores.team0 += newState.roundScores.team0;
      newState.totalScores.team1 += newState.roundScores.team1;
      
      // Check for game end
      if (newState.totalScores.team0 >= state.targetScore || newState.totalScores.team1 >= state.targetScore) {
        newState.phase = 'finished';
      } else {
        // Start new round
        const nextDealerIndex = (state.playerOrder.indexOf(state.dealerId) + 1) % 4;
        return { valid: true, newState: createTarneebState(
          [...state.playerOrder.slice(nextDealerIndex), ...state.playerOrder.slice(0, nextDealerIndex)],
          state.targetScore
        ) };
      }
    }
  } else {
    // Move to next player
    const currentIndex = state.playerOrder.indexOf(playerId);
    newState.currentPlayer = state.playerOrder[(currentIndex + 1) % 4];
  }
  
  return { valid: true, newState };
}

// ============ BALOOT ============

const BALOOT_HOKM_VALUES: { [key: string]: number } = {
  'J': 20, '9': 14, 'A': 11, '10': 10, 'K': 4, 'Q': 3, '8': 0, '7': 0
};

const BALOOT_SUN_VALUES: { [key: string]: number } = {
  'A': 11, '10': 10, 'K': 4, 'Q': 3, 'J': 2, '9': 0, '8': 0, '7': 0
};

export function createBalootState(playerIds: string[], targetPoints: number = 152): BalootState {
  if (playerIds.length !== 4) {
    throw new Error('Baloot requires exactly 4 players');
  }
  
  const deck = shuffle(createDeck());
  const hands: { [playerId: string]: PlayingCard[] } = {};
  
  // Deal 8 cards to each player (32 / 4 = 8)
  for (let i = 0; i < 4; i++) {
    hands[playerIds[i]] = deck.slice(i * 8, (i + 1) * 8);
  }
  
  return {
    phase: 'choosing',
    hands,
    currentTrick: [],
    gameType: null,
    trumpSuit: null,
    currentPlayer: playerIds[1],
    playerOrder: playerIds,
    choosingPlayer: playerIds[1],
    tricksWon: { team0: 0, team1: 0 },
    roundPoints: { team0: 0, team1: 0 },
    totalPoints: { team0: 0, team1: 0 },
    projects: [],
    dealerId: playerIds[0],
    trickLeader: playerIds[1],
    roundNumber: 1,
    targetPoints,
  };
}

export function balootChoose(state: BalootState, playerId: string, gameType: 'sun' | 'hokm', trumpSuit?: BalootState['trumpSuit']): { valid: boolean; newState?: BalootState; error?: string } {
  if (state.phase !== 'choosing') {
    return { valid: false, error: 'Not in choosing phase' };
  }
  
  if (state.choosingPlayer !== playerId) {
    return { valid: false, error: 'Not your turn to choose' };
  }
  
  if (gameType === 'hokm' && !trumpSuit) {
    return { valid: false, error: 'Must specify trump suit for hokm' };
  }
  
  return {
    valid: true,
    newState: {
      ...state,
      phase: 'playing',
      gameType,
      trumpSuit: gameType === 'hokm' ? trumpSuit! : null,
      currentPlayer: state.playerOrder[(state.playerOrder.indexOf(playerId) + 1) % 4],
    },
  };
}

export function balootPass(state: BalootState, playerId: string): { valid: boolean; newState?: BalootState; error?: string } {
  if (state.phase !== 'choosing') {
    return { valid: false, error: 'Not in choosing phase' };
  }
  
  if (state.choosingPlayer !== playerId) {
    return { valid: false, error: 'Not your turn' };
  }
  
  const currentIndex = state.playerOrder.indexOf(playerId);
  const nextIndex = (currentIndex + 1) % 4;
  
  // If back to dealer's partner, they must choose
  if (state.playerOrder[nextIndex] === state.dealerId) {
    // Force sun game
    return {
      valid: true,
      newState: {
        ...state,
        phase: 'playing',
        gameType: 'sun',
        trumpSuit: null,
        currentPlayer: state.playerOrder[(state.playerOrder.indexOf(state.dealerId) + 1) % 4],
      },
    };
  }
  
  return {
    valid: true,
    newState: {
      ...state,
      choosingPlayer: state.playerOrder[nextIndex],
      currentPlayer: state.playerOrder[nextIndex],
    },
  };
}

function getBalootCardValue(card: PlayingCard, gameType: 'sun' | 'hokm', trumpSuit: string | null, leadSuit: string): number {
  const values = gameType === 'hokm' && card.suit === trumpSuit ? BALOOT_HOKM_VALUES : BALOOT_SUN_VALUES;
  let value = values[card.rank] || 0;
  
  if (trumpSuit && card.suit === trumpSuit) {
    value += 100;
  } else if (card.suit === leadSuit) {
    value += 50;
  }
  
  return value;
}

function getBalootCardPoints(card: PlayingCard, gameType: 'sun' | 'hokm', isTrump: boolean): number {
  const values = gameType === 'hokm' && isTrump ? BALOOT_HOKM_VALUES : BALOOT_SUN_VALUES;
  return values[card.rank] || 0;
}

export function balootPlayCard(state: BalootState, playerId: string, card: PlayingCard): { valid: boolean; newState?: BalootState; error?: string } {
  if (state.phase !== 'playing') {
    return { valid: false, error: 'Not in playing phase' };
  }
  
  if (state.currentPlayer !== playerId) {
    return { valid: false, error: 'Not your turn' };
  }
  
  const hand = state.hands[playerId];
  const cardIndex = hand.findIndex(c => c.suit === card.suit && c.rank === card.rank);
  
  if (cardIndex === -1) {
    return { valid: false, error: 'Card not in hand' };
  }
  
  // Check if following suit
  if (state.currentTrick.length > 0) {
    const leadSuit = state.currentTrick[0].card.suit;
    const hasSuit = hand.some(c => c.suit === leadSuit);
    
    if (hasSuit && card.suit !== leadSuit) {
      return { valid: false, error: 'Must follow suit' };
    }
    
    // In hokm, if can't follow suit, must play trump if have it
    if (state.gameType === 'hokm' && !hasSuit && state.trumpSuit) {
      const hasTrump = hand.some(c => c.suit === state.trumpSuit);
      if (hasTrump && card.suit !== state.trumpSuit) {
        return { valid: false, error: 'Must play trump' };
      }
    }
  }
  
  const newState: BalootState = {
    ...state,
    hands: {
      ...state.hands,
      [playerId]: hand.filter((_, i) => i !== cardIndex),
    },
    currentTrick: [...state.currentTrick, { playerId, card }],
  };
  
  // Check if trick is complete
  if (newState.currentTrick.length === 4) {
    const leadSuit = newState.currentTrick[0].card.suit;
    let winnerIndex = 0;
    let highestValue = getBalootCardValue(newState.currentTrick[0].card, state.gameType!, state.trumpSuit, leadSuit);
    let trickPoints = 0;
    
    for (let i = 0; i < 4; i++) {
      const c = newState.currentTrick[i].card;
      const value = getBalootCardValue(c, state.gameType!, state.trumpSuit, leadSuit);
      if (value > highestValue) {
        highestValue = value;
        winnerIndex = i;
      }
      trickPoints += getBalootCardPoints(c, state.gameType!, state.trumpSuit === c.suit);
    }
    
    const winnerId = newState.currentTrick[winnerIndex].playerId;
    const winnerTeam = state.playerOrder.indexOf(winnerId) % 2;
    
    if (winnerTeam === 0) {
      newState.tricksWon.team0++;
      newState.roundPoints.team0 += trickPoints;
    } else {
      newState.tricksWon.team1++;
      newState.roundPoints.team1 += trickPoints;
    }
    
    newState.currentTrick = [];
    newState.currentPlayer = winnerId;
    newState.trickLeader = winnerId;
    
    // Check if round is complete
    if (newState.tricksWon.team0 + newState.tricksWon.team1 === 8) {
      // Last trick bonus (10 points)
      if (winnerTeam === 0) {
        newState.roundPoints.team0 += 10;
      } else {
        newState.roundPoints.team1 += 10;
      }
      
      // Add round points to total
      newState.totalPoints.team0 += newState.roundPoints.team0;
      newState.totalPoints.team1 += newState.roundPoints.team1;
      
      // Check for game end
      if (newState.totalPoints.team0 >= state.targetPoints || newState.totalPoints.team1 >= state.targetPoints) {
        newState.phase = 'finished';
      } else {
        // Start new round
        const nextDealerIndex = (state.playerOrder.indexOf(state.dealerId) + 1) % 4;
        const newOrder = [...state.playerOrder.slice(nextDealerIndex), ...state.playerOrder.slice(0, nextDealerIndex)];
        return { valid: true, newState: createBalootState(newOrder, state.targetPoints) };
      }
    }
  } else {
    const currentIndex = state.playerOrder.indexOf(playerId);
    newState.currentPlayer = state.playerOrder[(currentIndex + 1) % 4];
  }
  
  return { valid: true, newState };
}

export function getTeam(playerOrder: string[], playerId: string): number {
  return playerOrder.indexOf(playerId) % 2;
}
