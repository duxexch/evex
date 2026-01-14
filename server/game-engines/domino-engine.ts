// Domino Engine - Server-side game logic

export interface DominoTile {
  left: number;
  right: number;
  id: string;
}

export interface DominoState {
  board: DominoTile[];
  leftEnd: number;
  rightEnd: number;
  hands: { [playerId: string]: DominoTile[] };
  boneyard: DominoTile[];
  currentPlayer: string;
  playerOrder: string[];
  passCount: number;
  gameOver: boolean;
  winner?: string;
  scores: { [playerId: string]: number };
}

export interface DominoMove {
  tile: DominoTile;
  end: 'left' | 'right';
  isPass?: boolean;
}

export interface DominoMoveResult {
  valid: boolean;
  newState?: DominoState;
  error?: string;
}

function createAllTiles(): DominoTile[] {
  const tiles: DominoTile[] = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
      tiles.push({ left: i, right: j, id: `${i}-${j}` });
    }
  }
  return tiles;
}

function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function createInitialState(playerIds: string[]): DominoState {
  if (playerIds.length < 2 || playerIds.length > 4) {
    throw new Error('Domino requires 2-4 players');
  }
  
  const tiles = shuffle(createAllTiles());
  const tilesPerPlayer = playerIds.length === 2 ? 7 : playerIds.length === 3 ? 7 : 7;
  
  const hands: { [playerId: string]: DominoTile[] } = {};
  let tileIndex = 0;
  
  for (const playerId of playerIds) {
    hands[playerId] = tiles.slice(tileIndex, tileIndex + tilesPerPlayer);
    tileIndex += tilesPerPlayer;
  }
  
  const boneyard = tiles.slice(tileIndex);
  
  // Find player with highest double to start
  let startingPlayer = playerIds[0];
  let highestDouble = -1;
  
  for (const playerId of playerIds) {
    for (const tile of hands[playerId]) {
      if (tile.left === tile.right && tile.left > highestDouble) {
        highestDouble = tile.left;
        startingPlayer = playerId;
      }
    }
  }
  
  return {
    board: [],
    leftEnd: -1,
    rightEnd: -1,
    hands,
    boneyard,
    currentPlayer: startingPlayer,
    playerOrder: playerIds,
    passCount: 0,
    gameOver: false,
    scores: Object.fromEntries(playerIds.map(id => [id, 0])),
  };
}

export function canPlayTile(state: DominoState, tile: DominoTile, end: 'left' | 'right'): boolean {
  if (state.board.length === 0) {
    return true;
  }
  
  const targetValue = end === 'left' ? state.leftEnd : state.rightEnd;
  return tile.left === targetValue || tile.right === targetValue;
}

export function getPlayableTiles(state: DominoState, playerId: string): { tile: DominoTile; ends: ('left' | 'right')[] }[] {
  const hand = state.hands[playerId] || [];
  const playable: { tile: DominoTile; ends: ('left' | 'right')[] }[] = [];
  
  if (state.board.length === 0) {
    return hand.map(tile => ({ tile, ends: ['left' as const] }));
  }
  
  for (const tile of hand) {
    const ends: ('left' | 'right')[] = [];
    if (canPlayTile(state, tile, 'left')) ends.push('left');
    if (canPlayTile(state, tile, 'right')) ends.push('right');
    if (ends.length > 0) {
      playable.push({ tile, ends });
    }
  }
  
  return playable;
}

export function makeMove(state: DominoState, playerId: string, move: DominoMove): DominoMoveResult {
  if (state.gameOver) {
    return { valid: false, error: 'Game is already over' };
  }
  
  if (state.currentPlayer !== playerId) {
    return { valid: false, error: 'Not your turn' };
  }
  
  const newState: DominoState = {
    ...state,
    board: [...state.board],
    hands: Object.fromEntries(
      Object.entries(state.hands).map(([id, tiles]) => [id, [...tiles]])
    ),
    boneyard: [...state.boneyard],
    scores: { ...state.scores },
  };
  
  // Handle pass
  if (move.isPass) {
    const playable = getPlayableTiles(state, playerId);
    
    // Must draw from boneyard if possible and no playable tiles
    if (playable.length === 0 && newState.boneyard.length > 0) {
      const drawnTile = newState.boneyard.pop()!;
      newState.hands[playerId].push(drawnTile);
      
      // Check if drawn tile can be played
      const canPlay = canPlayTile(newState, drawnTile, 'left') || canPlayTile(newState, drawnTile, 'right');
      if (canPlay) {
        // Player must play the drawn tile if possible
        return { valid: false, error: 'You drew a playable tile, you must play it' };
      }
    } else if (playable.length > 0) {
      return { valid: false, error: 'You have playable tiles, cannot pass' };
    }
    
    newState.passCount++;
    
    // Check for blocked game
    if (newState.passCount >= newState.playerOrder.length) {
      newState.gameOver = true;
      // Lowest pip count wins
      let lowestPips = Infinity;
      let winner = newState.playerOrder[0];
      
      for (const pid of newState.playerOrder) {
        const pips = newState.hands[pid].reduce((sum, t) => sum + t.left + t.right, 0);
        if (pips < lowestPips) {
          lowestPips = pips;
          winner = pid;
        }
      }
      newState.winner = winner;
    } else {
      // Next player
      const currentIndex = newState.playerOrder.indexOf(playerId);
      newState.currentPlayer = newState.playerOrder[(currentIndex + 1) % newState.playerOrder.length];
    }
    
    return { valid: true, newState };
  }
  
  // Playing a tile
  const tileIndex = newState.hands[playerId].findIndex(
    t => t.id === move.tile.id || (t.left === move.tile.left && t.right === move.tile.right)
  );
  
  if (tileIndex === -1) {
    return { valid: false, error: 'Tile not in your hand' };
  }
  
  if (!canPlayTile(state, move.tile, move.end)) {
    return { valid: false, error: 'Cannot play this tile on this end' };
  }
  
  // Remove tile from hand
  const tile = newState.hands[playerId].splice(tileIndex, 1)[0];
  
  // Place tile on board
  if (newState.board.length === 0) {
    newState.board.push(tile);
    newState.leftEnd = tile.left;
    newState.rightEnd = tile.right;
  } else {
    const targetValue = move.end === 'left' ? newState.leftEnd : newState.rightEnd;
    
    // Orient tile correctly
    let placedTile = tile;
    if (move.end === 'left') {
      if (tile.right === targetValue) {
        newState.leftEnd = tile.left;
      } else {
        newState.leftEnd = tile.right;
        placedTile = { ...tile, left: tile.right, right: tile.left };
      }
      newState.board.unshift(placedTile);
    } else {
      if (tile.left === targetValue) {
        newState.rightEnd = tile.right;
      } else {
        newState.rightEnd = tile.left;
        placedTile = { ...tile, left: tile.right, right: tile.left };
      }
      newState.board.push(placedTile);
    }
  }
  
  newState.passCount = 0;
  
  // Check for win
  if (newState.hands[playerId].length === 0) {
    newState.gameOver = true;
    newState.winner = playerId;
    
    // Calculate score (sum of all pips in other players' hands)
    let winnerScore = 0;
    for (const pid of newState.playerOrder) {
      if (pid !== playerId) {
        winnerScore += newState.hands[pid].reduce((sum, t) => sum + t.left + t.right, 0);
      }
    }
    newState.scores[playerId] += winnerScore;
  } else {
    // Next player
    const currentIndex = newState.playerOrder.indexOf(playerId);
    newState.currentPlayer = newState.playerOrder[(currentIndex + 1) % newState.playerOrder.length];
  }
  
  return { valid: true, newState };
}

export function drawFromBoneyard(state: DominoState, playerId: string): DominoMoveResult {
  if (state.currentPlayer !== playerId) {
    return { valid: false, error: 'Not your turn' };
  }
  
  if (state.boneyard.length === 0) {
    return { valid: false, error: 'Boneyard is empty' };
  }
  
  const playable = getPlayableTiles(state, playerId);
  if (playable.length > 0) {
    return { valid: false, error: 'You have playable tiles, cannot draw' };
  }
  
  const newState: DominoState = {
    ...state,
    hands: Object.fromEntries(
      Object.entries(state.hands).map(([id, tiles]) => [id, [...tiles]])
    ),
    boneyard: [...state.boneyard],
  };
  
  const drawnTile = newState.boneyard.pop()!;
  newState.hands[playerId].push(drawnTile);
  
  return { valid: true, newState };
}

export function getGameStatus(state: DominoState): {
  isGameOver: boolean;
  winner?: string;
  scores: { [playerId: string]: number };
} {
  return {
    isGameOver: state.gameOver,
    winner: state.winner,
    scores: state.scores,
  };
}

export function serializeState(state: DominoState): string {
  return JSON.stringify(state);
}

export function deserializeState(data: string): DominoState {
  return JSON.parse(data);
}
