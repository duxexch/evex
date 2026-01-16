import type { GameEngine, MoveData, ValidationResult, ApplyMoveResult, GameStatus, PlayerView, GameEvent } from './types';

interface DominoTile {
  left: number;
  right: number;
  id: string;
}

interface DominoState {
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
  lastAction?: { type: string; playerId: string; tile?: DominoTile; end?: string };
}

export class DominoEngine implements GameEngine {
  gameType = 'domino';
  minPlayers = 2;
  maxPlayers = 4;

  createInitialState(): string {
    return JSON.stringify(this.createNewGame(['', '']));
  }

  initializeWithPlayers(playerIds: string[]): string {
    return JSON.stringify(this.createNewGame(playerIds));
  }

  private createAllTiles(): DominoTile[] {
    const tiles: DominoTile[] = [];
    for (let i = 0; i <= 6; i++) {
      for (let j = i; j <= 6; j++) {
        tiles.push({ left: i, right: j, id: `${i}-${j}` });
      }
    }
    return tiles;
  }

  private shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private createNewGame(playerIds: string[]): DominoState {
    if (playerIds.length < 2 || playerIds.length > 4) {
      throw new Error('Domino requires 2-4 players');
    }

    const tiles = this.shuffle(this.createAllTiles());
    const tilesPerPlayer = 7;

    const hands: { [playerId: string]: DominoTile[] } = {};
    let tileIndex = 0;

    for (const playerId of playerIds) {
      hands[playerId] = tiles.slice(tileIndex, tileIndex + tilesPerPlayer);
      tileIndex += tilesPerPlayer;
    }

    const boneyard = tiles.slice(tileIndex);

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

  private canPlayTile(state: DominoState, tile: DominoTile, end: 'left' | 'right'): boolean {
    if (state.board.length === 0) {
      return true;
    }
    const targetValue = end === 'left' ? state.leftEnd : state.rightEnd;
    return tile.left === targetValue || tile.right === targetValue;
  }

  private getPlayableTiles(state: DominoState, playerId: string): { tile: DominoTile; ends: ('left' | 'right')[] }[] {
    const hand = state.hands[playerId] || [];
    const playable: { tile: DominoTile; ends: ('left' | 'right')[] }[] = [];

    if (state.board.length === 0) {
      return hand.map(tile => ({ tile, ends: ['left' as const] }));
    }

    for (const tile of hand) {
      const ends: ('left' | 'right')[] = [];
      if (this.canPlayTile(state, tile, 'left')) ends.push('left');
      if (this.canPlayTile(state, tile, 'right')) ends.push('right');
      if (ends.length > 0) {
        playable.push({ tile, ends });
      }
    }

    return playable;
  }

  validateMove(stateJson: string, playerId: string, move: MoveData): ValidationResult {
    try {
      const state: DominoState = JSON.parse(stateJson);

      if (state.gameOver) {
        return { valid: false, error: 'Game is already over', errorKey: 'domino.gameAlreadyOver' };
      }

      if (state.currentPlayer !== playerId) {
        return { valid: false, error: 'Not your turn', errorKey: 'domino.notYourTurn' };
      }

      if (move.type === 'pass') {
        const playable = this.getPlayableTiles(state, playerId);
        if (playable.length > 0) {
          return { valid: false, error: 'You have playable tiles, cannot pass', errorKey: 'domino.cannotPass' };
        }
        if (state.boneyard.length > 0) {
          return { valid: false, error: 'Must draw from boneyard first', errorKey: 'domino.mustDraw' };
        }
        return { valid: true };
      }

      if (move.type === 'draw') {
        if (state.boneyard.length === 0) {
          return { valid: false, error: 'Boneyard is empty', errorKey: 'domino.boneyardEmpty' };
        }
        const playable = this.getPlayableTiles(state, playerId);
        if (playable.length > 0) {
          return { valid: false, error: 'You have playable tiles, cannot draw', errorKey: 'domino.cannotDraw' };
        }
        return { valid: true };
      }

      if (move.type === 'play') {
        const tileData = typeof move.tile === 'string' ? JSON.parse(move.tile) : move.tile;
        const end = move.end as 'left' | 'right';

        const hand = state.hands[playerId] || [];
        const hasTile = hand.some(t => t.id === tileData.id || (t.left === tileData.left && t.right === tileData.right));

        if (!hasTile) {
          return { valid: false, error: 'Tile not in your hand', errorKey: 'domino.tileNotInHand' };
        }

        if (!this.canPlayTile(state, tileData, end)) {
          return { valid: false, error: 'Cannot play this tile on this end', errorKey: 'domino.invalidPlacement' };
        }

        return { valid: true };
      }

      return { valid: false, error: 'Invalid move type', errorKey: 'domino.invalidMoveType' };
    } catch {
      return { valid: false, error: 'Invalid game state', errorKey: 'domino.invalidState' };
    }
  }

  applyMove(stateJson: string, playerId: string, move: MoveData): ApplyMoveResult {
    try {
      const state: DominoState = JSON.parse(stateJson);
      const events: GameEvent[] = [];

      const validation = this.validateMove(stateJson, playerId, move);
      if (!validation.valid) {
        return { success: false, newState: stateJson, events: [], error: validation.error };
      }

      if (move.type === 'pass') {
        state.passCount++;
        state.lastAction = { type: 'pass', playerId };

        events.push({ type: 'move', data: { action: 'pass', playerId } });

        if (state.passCount >= state.playerOrder.length) {
          state.gameOver = true;
          let lowestPips = Infinity;
          let winner = state.playerOrder[0];

          for (const pid of state.playerOrder) {
            const pips = state.hands[pid].reduce((sum, t) => sum + t.left + t.right, 0);
            if (pips < lowestPips) {
              lowestPips = pips;
              winner = pid;
            }
          }
          state.winner = winner;
          events.push({ type: 'game_over', data: { winner, reason: 'blocked' } });
        } else {
          this.advanceTurn(state);
          events.push({ type: 'turn_change', data: { nextPlayer: state.currentPlayer } });
        }

        return { success: true, newState: JSON.stringify(state), events };
      }

      if (move.type === 'draw') {
        const drawnTile = state.boneyard.pop()!;
        state.hands[playerId].push(drawnTile);
        state.lastAction = { type: 'draw', playerId, tile: drawnTile };

        events.push({ type: 'move', data: { action: 'draw', playerId, tile: drawnTile } });

        const canPlay = this.canPlayTile(state, drawnTile, 'left') || this.canPlayTile(state, drawnTile, 'right');
        if (!canPlay && state.boneyard.length === 0) {
          state.passCount++;
          if (state.passCount >= state.playerOrder.length) {
            state.gameOver = true;
            let lowestPips = Infinity;
            let winner = state.playerOrder[0];
            for (const pid of state.playerOrder) {
              const pips = state.hands[pid].reduce((sum, t) => sum + t.left + t.right, 0);
              if (pips < lowestPips) {
                lowestPips = pips;
                winner = pid;
              }
            }
            state.winner = winner;
            events.push({ type: 'game_over', data: { winner, reason: 'blocked' } });
          } else {
            this.advanceTurn(state);
            events.push({ type: 'turn_change', data: { nextPlayer: state.currentPlayer } });
          }
        }

        return { success: true, newState: JSON.stringify(state), events };
      }

      if (move.type === 'play') {
        const tileData = typeof move.tile === 'string' ? JSON.parse(move.tile) : move.tile;
        const end = move.end as 'left' | 'right';

        const tileIndex = state.hands[playerId].findIndex(
          t => t.id === tileData.id || (t.left === tileData.left && t.right === tileData.right)
        );

        const tile = state.hands[playerId].splice(tileIndex, 1)[0];

        if (state.board.length === 0) {
          state.board.push(tile);
          state.leftEnd = tile.left;
          state.rightEnd = tile.right;
        } else {
          const targetValue = end === 'left' ? state.leftEnd : state.rightEnd;
          let placedTile = tile;

          if (end === 'left') {
            if (tile.right === targetValue) {
              state.leftEnd = tile.left;
            } else {
              state.leftEnd = tile.right;
              placedTile = { ...tile, left: tile.right, right: tile.left };
            }
            state.board.unshift(placedTile);
          } else {
            if (tile.left === targetValue) {
              state.rightEnd = tile.right;
            } else {
              state.rightEnd = tile.left;
              placedTile = { ...tile, left: tile.right, right: tile.left };
            }
            state.board.push(placedTile);
          }
        }

        state.passCount = 0;
        state.lastAction = { type: 'play', playerId, tile, end };

        events.push({ type: 'move', data: { action: 'play', playerId, tile, end } });

        if (state.hands[playerId].length === 0) {
          state.gameOver = true;
          state.winner = playerId;

          let winnerScore = 0;
          for (const pid of state.playerOrder) {
            if (pid !== playerId) {
              winnerScore += state.hands[pid].reduce((sum, t) => sum + t.left + t.right, 0);
            }
          }
          state.scores[playerId] += winnerScore;

          events.push({ type: 'game_over', data: { winner: playerId, reason: 'domino', score: winnerScore } });
        } else {
          this.advanceTurn(state);
          events.push({ type: 'turn_change', data: { nextPlayer: state.currentPlayer } });
        }

        return { success: true, newState: JSON.stringify(state), events };
      }

      return { success: false, newState: stateJson, events: [], error: 'Unknown move type' };
    } catch (error) {
      return { success: false, newState: stateJson, events: [], error: 'Failed to apply move' };
    }
  }

  private advanceTurn(state: DominoState): void {
    const currentIndex = state.playerOrder.indexOf(state.currentPlayer);
    state.currentPlayer = state.playerOrder[(currentIndex + 1) % state.playerOrder.length];
  }

  getGameStatus(stateJson: string): GameStatus {
    try {
      const state: DominoState = JSON.parse(stateJson);
      return {
        isOver: state.gameOver,
        winner: state.winner,
        scores: state.scores,
        reason: state.winner ? (state.hands[state.winner]?.length === 0 ? 'domino' : 'blocked') : undefined
      };
    } catch {
      return { isOver: false };
    }
  }

  getValidMoves(stateJson: string, playerId: string): MoveData[] {
    try {
      const state: DominoState = JSON.parse(stateJson);

      if (state.gameOver || state.currentPlayer !== playerId) {
        return [];
      }

      const moves: MoveData[] = [];
      const playable = this.getPlayableTiles(state, playerId);

      for (const { tile, ends } of playable) {
        for (const end of ends) {
          moves.push({ type: 'play', tile: JSON.stringify(tile), end });
        }
      }

      if (moves.length === 0) {
        if (state.boneyard.length > 0) {
          moves.push({ type: 'draw' });
        } else {
          moves.push({ type: 'pass' });
        }
      }

      return moves;
    } catch {
      return [];
    }
  }

  getPlayerView(stateJson: string, playerId: string): PlayerView {
    try {
      const state: DominoState = JSON.parse(stateJson);
      const isPlayer = state.playerOrder.includes(playerId);

      const otherHandCounts: { [id: string]: number } = {};
      for (const pid of state.playerOrder) {
        if (pid !== playerId) {
          otherHandCounts[pid] = state.hands[pid]?.length || 0;
        }
      }

      return {
        board: state.board,
        leftEnd: state.leftEnd,
        rightEnd: state.rightEnd,
        hand: isPlayer ? state.hands[playerId] : [],
        otherHandCounts,
        boneyardCount: state.boneyard.length,
        currentTurn: state.currentPlayer,
        isMyTurn: state.currentPlayer === playerId,
        gamePhase: state.gameOver ? 'finished' : 'playing',
        validMoves: state.currentPlayer === playerId ? this.getValidMoves(stateJson, playerId) : [],
        scores: state.scores,
        playerOrder: state.playerOrder,
        lastAction: state.lastAction,
        winner: state.winner,
        passCount: state.passCount
      };
    } catch {
      return { board: undefined };
    }
  }
}

export const dominoEngine = new DominoEngine();
