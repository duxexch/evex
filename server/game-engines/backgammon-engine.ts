// Backgammon Engine - Server-side game logic

export interface BackgammonState {
  board: number[]; // 24 points, positive = white pieces, negative = black pieces
  bar: { white: number; black: number };
  home: { white: number; black: number };
  dice: number[];
  usedDice: boolean[];
  currentPlayer: 'white' | 'black';
  gameOver: boolean;
  winner?: 'white' | 'black';
  doubleValue: number;
  canDouble: { white: boolean; black: boolean };
}

export interface BackgammonMove {
  from: number; // -1 = bar, 24+ = bearing off
  to: number;
  dieIndex: number;
}

export interface BackgammonMoveResult {
  valid: boolean;
  newState?: BackgammonState;
  isHit?: boolean;
  error?: string;
}

// Initial board setup
// Point indices: 0-23 (0 is white's home board, 23 is black's home board)
const INITIAL_BOARD: number[] = [
  2, 0, 0, 0, 0, -5, // Points 1-6 (white home board)
  0, -3, 0, 0, 0, 5, // Points 7-12
  -5, 0, 0, 0, 3, 0, // Points 13-18
  5, 0, 0, 0, 0, -2  // Points 19-24 (black home board)
];

export function createInitialState(): BackgammonState {
  return {
    board: [...INITIAL_BOARD],
    bar: { white: 0, black: 0 },
    home: { white: 0, black: 0 },
    dice: [],
    usedDice: [],
    currentPlayer: 'white',
    gameOver: false,
    doubleValue: 1,
    canDouble: { white: true, black: true },
  };
}

export function rollDice(): number[] {
  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  
  // Doubles give 4 moves
  if (die1 === die2) {
    return [die1, die1, die1, die1];
  }
  return [die1, die2];
}

export function setDice(state: BackgammonState, dice: number[]): BackgammonState {
  return {
    ...state,
    dice,
    usedDice: new Array(dice.length).fill(false),
  };
}

function getPlayerPieces(board: number[], player: 'white' | 'black'): number[] {
  const positions: number[] = [];
  for (let i = 0; i < 24; i++) {
    if ((player === 'white' && board[i] > 0) || (player === 'black' && board[i] < 0)) {
      positions.push(i);
    }
  }
  return positions;
}

function canBearOff(state: BackgammonState, player: 'white' | 'black'): boolean {
  const barCount = player === 'white' ? state.bar.white : state.bar.black;
  if (barCount > 0) return false;
  
  // All pieces must be in home board
  if (player === 'white') {
    // White home board: points 18-23 (indices 18-23)
    for (let i = 0; i < 18; i++) {
      if (state.board[i] > 0) return false;
    }
  } else {
    // Black home board: points 0-5 (indices 0-5)
    for (let i = 6; i < 24; i++) {
      if (state.board[i] < 0) return false;
    }
  }
  return true;
}

function isValidMove(state: BackgammonState, move: BackgammonMove): { valid: boolean; error?: string } {
  const player = state.currentPlayer;
  const direction = player === 'white' ? 1 : -1;
  
  // Check if die is available
  if (move.dieIndex < 0 || move.dieIndex >= state.dice.length) {
    return { valid: false, error: 'Invalid die index' };
  }
  if (state.usedDice[move.dieIndex]) {
    return { valid: false, error: 'Die already used' };
  }
  
  const dieValue = state.dice[move.dieIndex];
  const barCount = player === 'white' ? state.bar.white : state.bar.black;
  
  // Must move from bar first
  if (barCount > 0 && move.from !== -1) {
    return { valid: false, error: 'Must move from bar first' };
  }
  
  // Entering from bar
  if (move.from === -1) {
    if (barCount === 0) {
      return { valid: false, error: 'No pieces on bar' };
    }
    
    // White enters on points 0-5, Black enters on points 18-23
    const entryPoint = player === 'white' ? dieValue - 1 : 24 - dieValue;
    if (move.to !== entryPoint) {
      return { valid: false, error: 'Invalid entry point' };
    }
    
    // Check if entry point is blocked
    const targetPieces = state.board[entryPoint];
    if ((player === 'white' && targetPieces < -1) || (player === 'black' && targetPieces > 1)) {
      return { valid: false, error: 'Entry point blocked' };
    }
    
    return { valid: true };
  }
  
  // Regular move
  if (move.from < 0 || move.from > 23) {
    return { valid: false, error: 'Invalid from position' };
  }
  
  const fromPieces = state.board[move.from];
  if ((player === 'white' && fromPieces <= 0) || (player === 'black' && fromPieces >= 0)) {
    return { valid: false, error: 'No piece at from position' };
  }
  
  const expectedTo = move.from + (dieValue * direction);
  
  // Bearing off
  if ((player === 'white' && expectedTo >= 24) || (player === 'black' && expectedTo < 0)) {
    if (!canBearOff(state, player)) {
      return { valid: false, error: 'Cannot bear off yet' };
    }
    
    // Can bear off exact or from highest point
    if (player === 'white') {
      if (expectedTo === 24 || move.from === getHighestPoint(state, 'white')) {
        return { valid: true };
      }
      // Check if there are pieces on higher points
      for (let i = move.from + 1; i < 24; i++) {
        if (state.board[i] > 0) {
          return { valid: false, error: 'Must move higher pieces first' };
        }
      }
    } else {
      if (expectedTo === -1 || move.from === getHighestPoint(state, 'black')) {
        return { valid: true };
      }
      for (let i = move.from - 1; i >= 0; i--) {
        if (state.board[i] < 0) {
          return { valid: false, error: 'Must move higher pieces first' };
        }
      }
    }
    return { valid: true };
  }
  
  if (move.to !== expectedTo) {
    return { valid: false, error: 'Move distance does not match die' };
  }
  
  // Check if target is blocked
  const targetPieces = state.board[move.to];
  if ((player === 'white' && targetPieces < -1) || (player === 'black' && targetPieces > 1)) {
    return { valid: false, error: 'Target point blocked' };
  }
  
  return { valid: true };
}

function getHighestPoint(state: BackgammonState, player: 'white' | 'black'): number {
  if (player === 'white') {
    for (let i = 23; i >= 18; i--) {
      if (state.board[i] > 0) return i;
    }
  } else {
    for (let i = 0; i <= 5; i++) {
      if (state.board[i] < 0) return i;
    }
  }
  return -1;
}

export function makeMove(state: BackgammonState, move: BackgammonMove): BackgammonMoveResult {
  const validation = isValidMove(state, move);
  if (!validation.valid) {
    return { valid: false, error: validation.error };
  }
  
  const player = state.currentPlayer;
  const newState: BackgammonState = {
    ...state,
    board: [...state.board],
    bar: { ...state.bar },
    home: { ...state.home },
    usedDice: [...state.usedDice],
  };
  
  let isHit = false;
  
  // Handle move from bar
  if (move.from === -1) {
    if (player === 'white') {
      newState.bar.white--;
    } else {
      newState.bar.black--;
    }
  } else {
    // Remove piece from source
    newState.board[move.from] += player === 'white' ? -1 : 1;
  }
  
  // Handle bearing off
  const direction = player === 'white' ? 1 : -1;
  const dieValue = state.dice[move.dieIndex];
  const expectedTo = move.from === -1 
    ? (player === 'white' ? dieValue - 1 : 24 - dieValue)
    : move.from + (dieValue * direction);
  
  if ((player === 'white' && expectedTo >= 24) || (player === 'black' && expectedTo < 0)) {
    if (player === 'white') {
      newState.home.white++;
    } else {
      newState.home.black++;
    }
  } else {
    // Check for hit
    const targetPieces = newState.board[move.to];
    if ((player === 'white' && targetPieces === -1) || (player === 'black' && targetPieces === 1)) {
      isHit = true;
      if (player === 'white') {
        newState.bar.black++;
        newState.board[move.to] = 0;
      } else {
        newState.bar.white++;
        newState.board[move.to] = 0;
      }
    }
    
    // Add piece to target
    newState.board[move.to] += player === 'white' ? 1 : -1;
  }
  
  // Mark die as used
  newState.usedDice[move.dieIndex] = true;
  
  // Check for win
  if ((player === 'white' && newState.home.white === 15) ||
      (player === 'black' && newState.home.black === 15)) {
    newState.gameOver = true;
    newState.winner = player;
  }
  
  return { valid: true, newState, isHit };
}

export function hasLegalMoves(state: BackgammonState): boolean {
  const player = state.currentPlayer;
  const availableDice = state.dice.filter((_, i) => !state.usedDice[i]);
  
  if (availableDice.length === 0) return false;
  
  const barCount = player === 'white' ? state.bar.white : state.bar.black;
  
  // Check bar moves
  if (barCount > 0) {
    for (let dieIndex = 0; dieIndex < state.dice.length; dieIndex++) {
      if (state.usedDice[dieIndex]) continue;
      
      const dieValue = state.dice[dieIndex];
      const entryPoint = player === 'white' ? dieValue - 1 : 24 - dieValue;
      const targetPieces = state.board[entryPoint];
      
      if ((player === 'white' && targetPieces >= -1) || (player === 'black' && targetPieces <= 1)) {
        return true;
      }
    }
    return false;
  }
  
  // Check regular moves
  for (let from = 0; from < 24; from++) {
    const pieces = state.board[from];
    if ((player === 'white' && pieces <= 0) || (player === 'black' && pieces >= 0)) {
      continue;
    }
    
    for (let dieIndex = 0; dieIndex < state.dice.length; dieIndex++) {
      if (state.usedDice[dieIndex]) continue;
      
      const dieValue = state.dice[dieIndex];
      const direction = player === 'white' ? 1 : -1;
      const to = from + (dieValue * direction);
      
      const validation = isValidMove(state, { from, to, dieIndex });
      if (validation.valid) {
        return true;
      }
    }
  }
  
  return false;
}

export function endTurn(state: BackgammonState): BackgammonState {
  return {
    ...state,
    currentPlayer: state.currentPlayer === 'white' ? 'black' : 'white',
    dice: [],
    usedDice: [],
  };
}

export function getGameStatus(state: BackgammonState): {
  isGameOver: boolean;
  winner?: 'white' | 'black';
  homeCount: { white: number; black: number };
} {
  return {
    isGameOver: state.gameOver,
    winner: state.winner,
    homeCount: state.home,
  };
}

export function serializeState(state: BackgammonState): string {
  return JSON.stringify(state);
}

export function deserializeState(data: string): BackgammonState {
  return JSON.parse(data);
}
