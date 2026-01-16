export interface GameEngine {
  gameType: string;
  minPlayers: number;
  maxPlayers: number;
  
  createInitialState(): string;
  validateMove(state: string, playerId: string, move: MoveData): ValidationResult;
  applyMove(state: string, playerId: string, move: MoveData): ApplyMoveResult;
  getGameStatus(state: string): GameStatus;
  getValidMoves(state: string, playerId: string): MoveData[];
  getPlayerView(state: string, playerId: string): PlayerView;
}

export interface MoveData {
  type: string;
  from?: string;
  to?: string;
  piece?: string;
  promotion?: string;
  card?: string;
  tile?: string;
  dice?: number[];
  bid?: number;
  suit?: string;
  [key: string]: any;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  errorKey?: string;
}

export interface ApplyMoveResult {
  success: boolean;
  newState: string;
  events: GameEvent[];
  error?: string;
}

export interface GameEvent {
  type: 'move' | 'capture' | 'check' | 'checkmate' | 'draw' | 'win' | 'score' | 'turn_change' | 'game_over';
  data: any;
}

export interface GameStatus {
  isOver: boolean;
  winner?: string;
  winningTeam?: number;
  isDraw?: boolean;
  reason?: string;
  scores?: { [playerId: string]: number };
  teamScores?: { team1: number; team2: number };
}

export interface PlayerView {
  board?: any;
  hand?: any[];
  validMoves?: MoveData[];
  scores?: { [playerId: string]: number };
  currentTurn?: string;
  gamePhase?: string;
  [key: string]: any;
}

export interface WebSocketMessage {
  type: string;
  payload: any;
}

export interface JoinGamePayload {
  sessionId: string;
  token: string;
}

export interface MakeMovePayload {
  sessionId: string;
  move: MoveData;
}

export interface ChatPayload {
  sessionId: string;
  message: string;
}

export interface SpectatePayload {
  sessionId: string;
  token?: string;
}

export interface SendGiftPayload {
  sessionId: string;
  recipientId: string;
  giftItemId: string;
  quantity: number;
  message?: string;
}
