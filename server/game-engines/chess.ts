import { Chess } from 'chess.js';
import type { GameEngine, MoveData, ValidationResult, ApplyMoveResult, GameStatus, PlayerView, GameEvent } from './types';

interface ChessState {
  fen: string;
  history: string[];
  players: {
    white: string;
    black: string;
  };
  currentTurn: 'white' | 'black';
  startTime: number;
  lastMoveTime: number;
}

export class ChessEngine implements GameEngine {
  gameType = 'chess';
  minPlayers = 2;
  maxPlayers = 2;

  createInitialState(): string {
    const state: ChessState = {
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      history: [],
      players: {
        white: '',
        black: ''
      },
      currentTurn: 'white',
      startTime: Date.now(),
      lastMoveTime: Date.now()
    };
    return JSON.stringify(state);
  }

  initializeWithPlayers(player1Id: string, player2Id: string): string {
    const state: ChessState = {
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      history: [],
      players: {
        white: player1Id,
        black: player2Id
      },
      currentTurn: 'white',
      startTime: Date.now(),
      lastMoveTime: Date.now()
    };
    return JSON.stringify(state);
  }

  validateMove(stateJson: string, playerId: string, move: MoveData): ValidationResult {
    try {
      const state: ChessState = JSON.parse(stateJson);
      const chess = new Chess(state.fen);

      const playerColor = state.players.white === playerId ? 'white' : 
                         state.players.black === playerId ? 'black' : null;

      if (!playerColor) {
        return { valid: false, error: 'You are not a player in this game', errorKey: 'chess.notPlayer' };
      }

      if (state.currentTurn !== playerColor) {
        return { valid: false, error: 'It is not your turn', errorKey: 'chess.notYourTurn' };
      }

      const result = chess.move({
        from: move.from!,
        to: move.to!,
        promotion: move.promotion
      });

      if (!result) {
        return { valid: false, error: 'Invalid move', errorKey: 'chess.invalidMove' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'Invalid game state', errorKey: 'chess.invalidState' };
    }
  }

  applyMove(stateJson: string, playerId: string, move: MoveData): ApplyMoveResult {
    try {
      const state: ChessState = JSON.parse(stateJson);
      const chess = new Chess(state.fen);

      const result = chess.move({
        from: move.from!,
        to: move.to!,
        promotion: move.promotion
      });

      if (!result) {
        return { success: false, newState: stateJson, events: [], error: 'Invalid move' };
      }

      const events: GameEvent[] = [];

      events.push({
        type: 'move',
        data: {
          from: move.from,
          to: move.to,
          piece: result.piece,
          san: result.san,
          captured: result.captured
        }
      });

      if (result.captured) {
        events.push({
          type: 'capture',
          data: { piece: result.captured, square: move.to }
        });
      }

      if (chess.isCheck()) {
        events.push({
          type: 'check',
          data: { color: chess.turn() === 'w' ? 'white' : 'black' }
        });
      }

      if (chess.isCheckmate()) {
        const winner = state.currentTurn === 'white' ? state.players.white : state.players.black;
        events.push({
          type: 'checkmate',
          data: { winner, loser: winner === state.players.white ? state.players.black : state.players.white }
        });
        events.push({
          type: 'game_over',
          data: { winner, reason: 'checkmate' }
        });
      }

      if (chess.isDraw()) {
        events.push({
          type: 'draw',
          data: { reason: this.getDrawReason(chess) }
        });
        events.push({
          type: 'game_over',
          data: { isDraw: true, reason: this.getDrawReason(chess) }
        });
      }

      events.push({
        type: 'turn_change',
        data: { 
          nextTurn: state.currentTurn === 'white' ? 'black' : 'white',
          nextPlayer: state.currentTurn === 'white' ? state.players.black : state.players.white
        }
      });

      const newState: ChessState = {
        ...state,
        fen: chess.fen(),
        history: [...state.history, result.san],
        currentTurn: state.currentTurn === 'white' ? 'black' : 'white',
        lastMoveTime: Date.now()
      };

      return {
        success: true,
        newState: JSON.stringify(newState),
        events
      };
    } catch (error) {
      return { success: false, newState: stateJson, events: [], error: 'Failed to apply move' };
    }
  }

  private getDrawReason(chess: Chess): string {
    if (chess.isStalemate()) return 'stalemate';
    if (chess.isThreefoldRepetition()) return 'threefold_repetition';
    if (chess.isInsufficientMaterial()) return 'insufficient_material';
    if (chess.isDraw()) return 'fifty_move_rule';
    return 'draw';
  }

  getGameStatus(stateJson: string): GameStatus {
    try {
      const state: ChessState = JSON.parse(stateJson);
      const chess = new Chess(state.fen);

      if (chess.isCheckmate()) {
        const winner = state.currentTurn === 'black' ? state.players.white : state.players.black;
        return {
          isOver: true,
          winner,
          reason: 'checkmate'
        };
      }

      if (chess.isDraw()) {
        return {
          isOver: true,
          isDraw: true,
          reason: this.getDrawReason(chess)
        };
      }

      return { isOver: false };
    } catch {
      return { isOver: false };
    }
  }

  getValidMoves(stateJson: string, playerId: string): MoveData[] {
    try {
      const state: ChessState = JSON.parse(stateJson);
      const chess = new Chess(state.fen);

      const playerColor = state.players.white === playerId ? 'white' : 
                         state.players.black === playerId ? 'black' : null;

      if (!playerColor || state.currentTurn !== playerColor) {
        return [];
      }

      const moves = chess.moves({ verbose: true });
      return moves.map(m => ({
        type: 'move',
        from: m.from,
        to: m.to,
        piece: m.piece,
        promotion: m.promotion
      }));
    } catch {
      return [];
    }
  }

  getPlayerView(stateJson: string, playerId: string): PlayerView {
    try {
      const state: ChessState = JSON.parse(stateJson);
      const chess = new Chess(state.fen);

      const playerColor = state.players.white === playerId ? 'white' : 
                         state.players.black === playerId ? 'black' : 'spectator';

      const isMyTurn = playerColor !== 'spectator' && state.currentTurn === playerColor;

      return {
        board: this.fenToBoard(state.fen),
        fen: state.fen,
        history: state.history,
        currentTurn: state.currentTurn,
        currentTurnPlayer: state.currentTurn === 'white' ? state.players.white : state.players.black,
        myColor: playerColor,
        isMyTurn,
        isCheck: chess.isCheck(),
        isCheckmate: chess.isCheckmate(),
        isDraw: chess.isDraw(),
        isGameOver: chess.isGameOver(),
        validMoves: isMyTurn ? this.getValidMoves(stateJson, playerId) : [],
        players: state.players
      };
    } catch {
      return { board: null };
    }
  }

  private fenToBoard(fen: string): string[][] {
    const board: string[][] = [];
    const rows = fen.split(' ')[0].split('/');
    
    for (const row of rows) {
      const boardRow: string[] = [];
      for (const char of row) {
        if (isNaN(parseInt(char))) {
          boardRow.push(char);
        } else {
          for (let i = 0; i < parseInt(char); i++) {
            boardRow.push('');
          }
        }
      }
      board.push(boardRow);
    }
    
    return board;
  }
}

export const chessEngine = new ChessEngine();
