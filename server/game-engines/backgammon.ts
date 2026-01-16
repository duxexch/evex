import type { GameEngine, MoveData, ValidationResult, ApplyMoveResult, GameStatus, PlayerView, GameEvent } from './types';

interface BackgammonState {
  board: number[];
  bar: { white: number; black: number };
  borneOff: { white: number; black: number };
  players: { white: string; black: string };
  currentTurn: 'white' | 'black';
  dice: number[];
  diceUsed: boolean[];
  doublingCube: number;
  cubeOwner: 'white' | 'black' | null;
  gamePhase: 'rolling' | 'moving' | 'finished';
  startTime: number;
  lastMoveTime: number;
  moveHistory: MoveRecord[];
  mustRoll: boolean;
}

interface MoveRecord {
  player: 'white' | 'black';
  dice: number[];
  moves: SingleMove[];
}

interface SingleMove {
  from: number;
  to: number;
  hit: boolean;
}

export class BackgammonEngine implements GameEngine {
  gameType = 'backgammon';
  minPlayers = 2;
  maxPlayers = 2;

  createInitialState(): string {
    return JSON.stringify(this.createNewGame('', ''));
  }

  initializeWithPlayers(player1Id: string, player2Id: string): string {
    return JSON.stringify(this.createNewGame(player1Id, player2Id));
  }

  private createNewGame(whitePlayerId: string, blackPlayerId: string): BackgammonState {
    const board: number[] = new Array(24).fill(0);
    
    board[0] = 2;
    board[11] = 5;
    board[16] = 3;
    board[18] = 5;
    
    board[23] = -2;
    board[12] = -5;
    board[7] = -3;
    board[5] = -5;

    return {
      board,
      bar: { white: 0, black: 0 },
      borneOff: { white: 0, black: 0 },
      players: { white: whitePlayerId, black: blackPlayerId },
      currentTurn: 'white',
      dice: [],
      diceUsed: [],
      doublingCube: 1,
      cubeOwner: null,
      gamePhase: 'rolling',
      startTime: Date.now(),
      lastMoveTime: Date.now(),
      moveHistory: [],
      mustRoll: true
    };
  }

  validateMove(stateJson: string, playerId: string, move: MoveData): ValidationResult {
    try {
      const state: BackgammonState = JSON.parse(stateJson);
      
      const playerColor = this.getPlayerColor(state, playerId);
      if (!playerColor) {
        return { valid: false, error: 'You are not a player in this game', errorKey: 'backgammon.notPlayer' };
      }

      if (state.currentTurn !== playerColor) {
        return { valid: false, error: 'It is not your turn', errorKey: 'backgammon.notYourTurn' };
      }

      if (move.type === 'roll') {
        if (!state.mustRoll) {
          return { valid: false, error: 'You have already rolled', errorKey: 'backgammon.alreadyRolled' };
        }
        return { valid: true };
      }

      if (move.type === 'move') {
        if (state.mustRoll) {
          return { valid: false, error: 'You must roll the dice first', errorKey: 'backgammon.mustRoll' };
        }

        const from = move.from as unknown as number;
        const to = move.to as unknown as number;

        const validation = this.validateSingleMove(state, playerColor, from, to);
        if (!validation.valid) {
          return validation;
        }

        return { valid: true };
      }

      if (move.type === 'end_turn') {
        if (state.mustRoll) {
          return { valid: false, error: 'You must roll first', errorKey: 'backgammon.mustRoll' };
        }
        
        const availableMoves = this.getAllValidMoves(state, playerColor);
        if (availableMoves.length > 0) {
          return { valid: false, error: 'You still have valid moves available', errorKey: 'backgammon.hasValidMoves' };
        }
        
        return { valid: true };
      }

      return { valid: false, error: 'Invalid move type', errorKey: 'backgammon.invalidMoveType' };
    } catch (error) {
      return { valid: false, error: 'Invalid game state', errorKey: 'backgammon.invalidState' };
    }
  }

  private validateSingleMove(state: BackgammonState, playerColor: 'white' | 'black', from: number, to: number): ValidationResult {
    const direction = playerColor === 'white' ? 1 : -1;
    const homeStart = playerColor === 'white' ? 18 : 0;
    const homeEnd = playerColor === 'white' ? 23 : 5;
    const barPosition = playerColor === 'white' ? -1 : 24;
    const bearOffPosition = playerColor === 'white' ? 24 : -1;

    if (from === barPosition) {
      const barCount = state.bar[playerColor];
      if (barCount === 0) {
        return { valid: false, error: 'No checkers on the bar', errorKey: 'backgammon.noCheckersOnBar' };
      }
    } else {
      if (from < 0 || from > 23) {
        return { valid: false, error: 'Invalid from position', errorKey: 'backgammon.invalidFrom' };
      }
      
      const checkerValue = state.board[from];
      const hasOwnChecker = playerColor === 'white' ? checkerValue > 0 : checkerValue < 0;
      if (!hasOwnChecker) {
        return { valid: false, error: 'No checker at that position', errorKey: 'backgammon.noChecker' };
      }

      if (state.bar[playerColor] > 0) {
        return { valid: false, error: 'Must move checkers from bar first', errorKey: 'backgammon.mustMoveFromBar' };
      }
    }

    const isBearingOff = to === bearOffPosition;
    
    if (isBearingOff) {
      if (!this.canBearOff(state, playerColor)) {
        return { valid: false, error: 'Cannot bear off yet', errorKey: 'backgammon.cannotBearOff' };
      }
    } else {
      if (to < 0 || to > 23) {
        return { valid: false, error: 'Invalid to position', errorKey: 'backgammon.invalidTo' };
      }
      
      const targetValue = state.board[to];
      const blockedByOpponent = playerColor === 'white' ? targetValue < -1 : targetValue > 1;
      if (blockedByOpponent) {
        return { valid: false, error: 'Point is blocked by opponent', errorKey: 'backgammon.pointBlocked' };
      }
    }

    let distance: number;
    if (from === barPosition) {
      distance = playerColor === 'white' ? to + 1 : 24 - to;
    } else if (isBearingOff) {
      distance = playerColor === 'white' ? 24 - from : from + 1;
    } else {
      distance = Math.abs(to - from);
      const correctDirection = playerColor === 'white' ? to > from : to < from;
      if (!correctDirection) {
        return { valid: false, error: 'Must move in correct direction', errorKey: 'backgammon.wrongDirection' };
      }
    }

    const unusedDice = state.dice.filter((d, i) => !state.diceUsed[i]);
    const hasMatchingDie = unusedDice.includes(distance);
    
    if (!hasMatchingDie) {
      if (isBearingOff) {
        const highestDie = Math.max(...unusedDice);
        const maxDistance = playerColor === 'white' ? 24 - from : from + 1;
        const isHighestChecker = this.isHighestCheckerInHome(state, playerColor, from);
        
        if (!(highestDie > maxDistance && isHighestChecker)) {
          return { valid: false, error: 'No matching die for this move', errorKey: 'backgammon.noDieMatch' };
        }
      } else {
        return { valid: false, error: 'No matching die for this move', errorKey: 'backgammon.noDieMatch' };
      }
    }

    return { valid: true };
  }

  private isHighestCheckerInHome(state: BackgammonState, playerColor: 'white' | 'black', fromPoint: number): boolean {
    if (playerColor === 'white') {
      for (let i = 18; i < fromPoint; i++) {
        if (state.board[i] > 0) return false;
      }
      return true;
    } else {
      for (let i = 5; i > fromPoint; i--) {
        if (state.board[i] < 0) return false;
      }
      return true;
    }
  }

  private canBearOff(state: BackgammonState, playerColor: 'white' | 'black'): boolean {
    if (state.bar[playerColor] > 0) return false;

    if (playerColor === 'white') {
      for (let i = 0; i < 18; i++) {
        if (state.board[i] > 0) return false;
      }
    } else {
      for (let i = 6; i < 24; i++) {
        if (state.board[i] < 0) return false;
      }
    }
    return true;
  }

  applyMove(stateJson: string, playerId: string, move: MoveData): ApplyMoveResult {
    try {
      const state: BackgammonState = JSON.parse(stateJson);
      const playerColor = this.getPlayerColor(state, playerId);
      
      if (!playerColor) {
        return { success: false, newState: stateJson, events: [], error: 'Not a player' };
      }

      const events: GameEvent[] = [];

      if (move.type === 'roll') {
        const die1 = Math.floor(Math.random() * 6) + 1;
        const die2 = Math.floor(Math.random() * 6) + 1;
        
        if (die1 === die2) {
          state.dice = [die1, die1, die1, die1];
          state.diceUsed = [false, false, false, false];
        } else {
          state.dice = [die1, die2];
          state.diceUsed = [false, false];
        }
        
        state.mustRoll = false;
        state.gamePhase = 'moving';
        
        events.push({
          type: 'move',
          data: { action: 'roll', dice: state.dice, player: playerColor }
        });

        const availableMoves = this.getAllValidMoves(state, playerColor);
        if (availableMoves.length === 0) {
          this.endTurn(state, events);
        }

        return {
          success: true,
          newState: JSON.stringify(state),
          events
        };
      }

      if (move.type === 'move') {
        const from = move.from as unknown as number;
        const to = move.to as unknown as number;
        
        const result = this.applySingleMove(state, playerColor, from, to, events);
        if (!result.success) {
          return { success: false, newState: stateJson, events: [], error: result.error };
        }

        const unusedDice = state.dice.filter((_, i) => !state.diceUsed[i]);
        if (unusedDice.length === 0) {
          this.endTurn(state, events);
        } else {
          const availableMoves = this.getAllValidMoves(state, playerColor);
          if (availableMoves.length === 0) {
            this.endTurn(state, events);
          }
        }

        const status = this.getGameStatus(JSON.stringify(state));
        if (status.isOver) {
          state.gamePhase = 'finished';
          events.push({
            type: 'game_over',
            data: { winner: status.winner, reason: status.reason }
          });
        }

        return {
          success: true,
          newState: JSON.stringify(state),
          events
        };
      }

      if (move.type === 'end_turn') {
        this.endTurn(state, events);
        return {
          success: true,
          newState: JSON.stringify(state),
          events
        };
      }

      return { success: false, newState: stateJson, events: [], error: 'Unknown move type' };
    } catch (error) {
      return { success: false, newState: stateJson, events: [], error: 'Failed to apply move' };
    }
  }

  private applySingleMove(
    state: BackgammonState, 
    playerColor: 'white' | 'black', 
    from: number, 
    to: number,
    events: GameEvent[]
  ): { success: boolean; error?: string } {
    const barPosition = playerColor === 'white' ? -1 : 24;
    const bearOffPosition = playerColor === 'white' ? 24 : -1;
    const checkerValue = playerColor === 'white' ? 1 : -1;

    let distance: number;
    if (from === barPosition) {
      distance = playerColor === 'white' ? to + 1 : 24 - to;
    } else if (to === bearOffPosition) {
      distance = playerColor === 'white' ? 24 - from : from + 1;
    } else {
      distance = Math.abs(to - from);
    }

    let dieIndex = state.dice.findIndex((d, i) => !state.diceUsed[i] && d === distance);
    
    if (dieIndex === -1 && to === bearOffPosition) {
      const unusedDice = state.dice.map((d, i) => ({ die: d, index: i }))
        .filter(x => !state.diceUsed[x.index]);
      const higherDie = unusedDice.find(x => x.die > distance);
      if (higherDie && this.isHighestCheckerInHome(state, playerColor, from)) {
        dieIndex = higherDie.index;
      }
    }

    if (dieIndex === -1) {
      return { success: false, error: 'No matching die' };
    }

    state.diceUsed[dieIndex] = true;

    if (from === barPosition) {
      state.bar[playerColor]--;
    } else {
      state.board[from] -= checkerValue;
    }

    let hit = false;
    if (to === bearOffPosition) {
      state.borneOff[playerColor]++;
      events.push({
        type: 'move',
        data: { action: 'bear_off', from, player: playerColor }
      });
    } else {
      const targetValue = state.board[to];
      const opponentColor = playerColor === 'white' ? 'black' : 'white';
      const opponentChecker = playerColor === 'white' ? targetValue === -1 : targetValue === 1;
      
      if (opponentChecker) {
        state.board[to] = checkerValue;
        state.bar[opponentColor]++;
        hit = true;
        events.push({
          type: 'capture',
          data: { point: to, hitPlayer: opponentColor }
        });
      } else {
        state.board[to] += checkerValue;
      }

      events.push({
        type: 'move',
        data: { action: 'move', from, to, hit, player: playerColor }
      });
    }

    state.lastMoveTime = Date.now();

    return { success: true };
  }

  private endTurn(state: BackgammonState, events: GameEvent[]): void {
    const previousTurn = state.currentTurn;
    state.currentTurn = state.currentTurn === 'white' ? 'black' : 'white';
    state.dice = [];
    state.diceUsed = [];
    state.mustRoll = true;
    state.gamePhase = 'rolling';

    events.push({
      type: 'turn_change',
      data: { 
        previousTurn,
        nextTurn: state.currentTurn,
        nextPlayer: state.players[state.currentTurn]
      }
    });
  }

  getGameStatus(stateJson: string): GameStatus {
    try {
      const state: BackgammonState = JSON.parse(stateJson);

      if (state.borneOff.white === 15) {
        const isGammon = state.borneOff.black === 0;
        const isBackgammon = isGammon && (state.bar.black > 0 || this.hasCheckerInOpponentHome(state, 'black'));
        
        return {
          isOver: true,
          winner: state.players.white,
          reason: isBackgammon ? 'backgammon' : (isGammon ? 'gammon' : 'normal')
        };
      }

      if (state.borneOff.black === 15) {
        const isGammon = state.borneOff.white === 0;
        const isBackgammon = isGammon && (state.bar.white > 0 || this.hasCheckerInOpponentHome(state, 'white'));
        
        return {
          isOver: true,
          winner: state.players.black,
          reason: isBackgammon ? 'backgammon' : (isGammon ? 'gammon' : 'normal')
        };
      }

      return { isOver: false };
    } catch {
      return { isOver: false };
    }
  }

  private hasCheckerInOpponentHome(state: BackgammonState, playerColor: 'white' | 'black'): boolean {
    if (playerColor === 'white') {
      for (let i = 18; i <= 23; i++) {
        if (state.board[i] > 0) return true;
      }
    } else {
      for (let i = 0; i <= 5; i++) {
        if (state.board[i] < 0) return true;
      }
    }
    return false;
  }

  getValidMoves(stateJson: string, playerId: string): MoveData[] {
    try {
      const state: BackgammonState = JSON.parse(stateJson);
      const playerColor = this.getPlayerColor(state, playerId);
      
      if (!playerColor || state.currentTurn !== playerColor) {
        return [];
      }

      if (state.mustRoll) {
        return [{ type: 'roll' }];
      }

      return this.getAllValidMoves(state, playerColor);
    } catch {
      return [];
    }
  }

  private getAllValidMoves(state: BackgammonState, playerColor: 'white' | 'black'): MoveData[] {
    const moves: MoveData[] = [];
    const direction = playerColor === 'white' ? 1 : -1;
    const barPosition = playerColor === 'white' ? -1 : 24;
    const bearOffPosition = playerColor === 'white' ? 24 : -1;
    const unusedDice = state.dice.filter((_, i) => !state.diceUsed[i]);

    if (unusedDice.length === 0) {
      return [];
    }

    if (state.bar[playerColor] > 0) {
      for (const die of new Set(unusedDice)) {
        const to = playerColor === 'white' ? die - 1 : 24 - die;
        if (to >= 0 && to <= 23) {
          const targetValue = state.board[to];
          const blocked = playerColor === 'white' ? targetValue < -1 : targetValue > 1;
          if (!blocked) {
            moves.push({ type: 'move', from: barPosition.toString(), to: to.toString() });
          }
        }
      }
      return moves;
    }

    for (let point = 0; point < 24; point++) {
      const checkerValue = state.board[point];
      const hasChecker = playerColor === 'white' ? checkerValue > 0 : checkerValue < 0;
      
      if (hasChecker) {
        for (const die of new Set(unusedDice)) {
          const to = point + (die * direction);
          
          if (to >= 0 && to <= 23) {
            const targetValue = state.board[to];
            const blocked = playerColor === 'white' ? targetValue < -1 : targetValue > 1;
            if (!blocked) {
              moves.push({ type: 'move', from: point.toString(), to: to.toString() });
            }
          }
        }

        if (this.canBearOff(state, playerColor)) {
          const distanceToOff = playerColor === 'white' ? 24 - point : point + 1;
          
          for (const die of new Set(unusedDice)) {
            if (die === distanceToOff) {
              moves.push({ type: 'move', from: point.toString(), to: bearOffPosition.toString() });
            } else if (die > distanceToOff && this.isHighestCheckerInHome(state, playerColor, point)) {
              moves.push({ type: 'move', from: point.toString(), to: bearOffPosition.toString() });
              break;
            }
          }
        }
      }
    }

    return moves;
  }

  getPlayerView(stateJson: string, playerId: string): PlayerView {
    try {
      const state: BackgammonState = JSON.parse(stateJson);
      const playerColor = this.getPlayerColor(state, playerId);
      const isMyTurn = playerColor === state.currentTurn;

      return {
        board: state.board,
        bar: state.bar,
        borneOff: state.borneOff,
        dice: state.dice,
        diceUsed: state.diceUsed,
        currentTurn: state.currentTurn,
        currentTurnPlayer: state.players[state.currentTurn],
        myColor: playerColor || 'spectator',
        isMyTurn: isMyTurn && playerColor !== null,
        gamePhase: state.gamePhase,
        mustRoll: state.mustRoll,
        doublingCube: state.doublingCube,
        cubeOwner: state.cubeOwner,
        validMoves: isMyTurn && playerColor ? this.getAllValidMoves(state, playerColor) : [],
        players: state.players,
        canBearOff: playerColor ? this.canBearOff(state, playerColor) : false
      };
    } catch {
      return { board: null };
    }
  }

  private getPlayerColor(state: BackgammonState, playerId: string): 'white' | 'black' | null {
    if (state.players.white === playerId) return 'white';
    if (state.players.black === playerId) return 'black';
    return null;
  }
}

export const backgammonEngine = new BackgammonEngine();
