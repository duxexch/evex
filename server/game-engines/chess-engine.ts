// Chess Engine - Server-side game logic and move validation

export interface ChessPosition {
  board: (ChessPiece | null)[][];
  currentPlayer: 'white' | 'black';
  castlingRights: {
    whiteKingSide: boolean;
    whiteQueenSide: boolean;
    blackKingSide: boolean;
    blackQueenSide: boolean;
  };
  enPassantSquare: { row: number; col: number } | null;
  halfMoveClock: number;
  fullMoveNumber: number;
}

export interface ChessPiece {
  type: 'pawn' | 'rook' | 'knight' | 'bishop' | 'queen' | 'king';
  color: 'white' | 'black';
}

export interface ChessMove {
  from: { row: number; col: number };
  to: { row: number; col: number };
  promotion?: 'queen' | 'rook' | 'bishop' | 'knight';
}

export interface MoveResult {
  valid: boolean;
  newPosition?: ChessPosition;
  capturedPiece?: ChessPiece;
  isCheck?: boolean;
  isCheckmate?: boolean;
  isStalemate?: boolean;
  isDraw?: boolean;
  notation?: string;
  error?: string;
}

const PIECE_CHARS: Record<string, string> = {
  'white-king': 'K', 'white-queen': 'Q', 'white-rook': 'R',
  'white-bishop': 'B', 'white-knight': 'N', 'white-pawn': 'P',
  'black-king': 'k', 'black-queen': 'q', 'black-rook': 'r',
  'black-bishop': 'b', 'black-knight': 'n', 'black-pawn': 'p',
};

export function createInitialPosition(): ChessPosition {
  const board: (ChessPiece | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
  
  // Setup pawns
  for (let col = 0; col < 8; col++) {
    board[1][col] = { type: 'pawn', color: 'black' };
    board[6][col] = { type: 'pawn', color: 'white' };
  }
  
  // Setup pieces
  const pieceOrder: ChessPiece['type'][] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
  for (let col = 0; col < 8; col++) {
    board[0][col] = { type: pieceOrder[col], color: 'black' };
    board[7][col] = { type: pieceOrder[col], color: 'white' };
  }
  
  return {
    board,
    currentPlayer: 'white',
    castlingRights: {
      whiteKingSide: true,
      whiteQueenSide: true,
      blackKingSide: true,
      blackQueenSide: true,
    },
    enPassantSquare: null,
    halfMoveClock: 0,
    fullMoveNumber: 1,
  };
}

export function positionToFEN(position: ChessPosition): string {
  let fen = '';
  
  // Board
  for (let row = 0; row < 8; row++) {
    let emptyCount = 0;
    for (let col = 0; col < 8; col++) {
      const piece = position.board[row][col];
      if (piece) {
        if (emptyCount > 0) {
          fen += emptyCount;
          emptyCount = 0;
        }
        fen += PIECE_CHARS[`${piece.color}-${piece.type}`];
      } else {
        emptyCount++;
      }
    }
    if (emptyCount > 0) fen += emptyCount;
    if (row < 7) fen += '/';
  }
  
  // Active color
  fen += ` ${position.currentPlayer === 'white' ? 'w' : 'b'}`;
  
  // Castling rights
  let castling = '';
  if (position.castlingRights.whiteKingSide) castling += 'K';
  if (position.castlingRights.whiteQueenSide) castling += 'Q';
  if (position.castlingRights.blackKingSide) castling += 'k';
  if (position.castlingRights.blackQueenSide) castling += 'q';
  fen += ` ${castling || '-'}`;
  
  // En passant
  if (position.enPassantSquare) {
    const col = String.fromCharCode(97 + position.enPassantSquare.col);
    const row = 8 - position.enPassantSquare.row;
    fen += ` ${col}${row}`;
  } else {
    fen += ' -';
  }
  
  // Half move clock and full move number
  fen += ` ${position.halfMoveClock} ${position.fullMoveNumber}`;
  
  return fen;
}

export function fenToPosition(fen: string): ChessPosition {
  const parts = fen.split(' ');
  const boardPart = parts[0];
  const rows = boardPart.split('/');
  
  const board: (ChessPiece | null)[][] = [];
  
  for (const row of rows) {
    const boardRow: (ChessPiece | null)[] = [];
    for (const char of row) {
      if (/\d/.test(char)) {
        for (let i = 0; i < parseInt(char); i++) {
          boardRow.push(null);
        }
      } else {
        const color: 'white' | 'black' = char === char.toUpperCase() ? 'white' : 'black';
        const typeMap: Record<string, ChessPiece['type']> = {
          'k': 'king', 'q': 'queen', 'r': 'rook', 'b': 'bishop', 'n': 'knight', 'p': 'pawn'
        };
        boardRow.push({ type: typeMap[char.toLowerCase()], color });
      }
    }
    board.push(boardRow);
  }
  
  return {
    board,
    currentPlayer: parts[1] === 'w' ? 'white' : 'black',
    castlingRights: {
      whiteKingSide: parts[2].includes('K'),
      whiteQueenSide: parts[2].includes('Q'),
      blackKingSide: parts[2].includes('k'),
      blackQueenSide: parts[2].includes('q'),
    },
    enPassantSquare: parts[3] === '-' ? null : {
      col: parts[3].charCodeAt(0) - 97,
      row: 8 - parseInt(parts[3][1]),
    },
    halfMoveClock: parseInt(parts[4]) || 0,
    fullMoveNumber: parseInt(parts[5]) || 1,
  };
}

function clonePosition(position: ChessPosition): ChessPosition {
  return {
    board: position.board.map(row => row.map(piece => piece ? { ...piece } : null)),
    currentPlayer: position.currentPlayer,
    castlingRights: { ...position.castlingRights },
    enPassantSquare: position.enPassantSquare ? { ...position.enPassantSquare } : null,
    halfMoveClock: position.halfMoveClock,
    fullMoveNumber: position.fullMoveNumber,
  };
}

function findKing(board: (ChessPiece | null)[][], color: 'white' | 'black'): { row: number; col: number } | null {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.type === 'king' && piece.color === color) {
        return { row, col };
      }
    }
  }
  return null;
}

function isSquareAttacked(board: (ChessPiece | null)[][], square: { row: number; col: number }, byColor: 'white' | 'black'): boolean {
  // Check for pawn attacks
  const pawnDirection = byColor === 'white' ? 1 : -1;
  const pawnRow = square.row + pawnDirection;
  if (pawnRow >= 0 && pawnRow < 8) {
    for (const colOffset of [-1, 1]) {
      const col = square.col + colOffset;
      if (col >= 0 && col < 8) {
        const piece = board[pawnRow][col];
        if (piece && piece.type === 'pawn' && piece.color === byColor) {
          return true;
        }
      }
    }
  }
  
  // Check for knight attacks
  const knightMoves = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  for (const [dr, dc] of knightMoves) {
    const row = square.row + dr;
    const col = square.col + dc;
    if (row >= 0 && row < 8 && col >= 0 && col < 8) {
      const piece = board[row][col];
      if (piece && piece.type === 'knight' && piece.color === byColor) {
        return true;
      }
    }
  }
  
  // Check for king attacks
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const row = square.row + dr;
      const col = square.col + dc;
      if (row >= 0 && row < 8 && col >= 0 && col < 8) {
        const piece = board[row][col];
        if (piece && piece.type === 'king' && piece.color === byColor) {
          return true;
        }
      }
    }
  }
  
  // Check for rook/queen attacks (straight lines)
  const straightDirections = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  for (const [dr, dc] of straightDirections) {
    let row = square.row + dr;
    let col = square.col + dc;
    while (row >= 0 && row < 8 && col >= 0 && col < 8) {
      const piece = board[row][col];
      if (piece) {
        if (piece.color === byColor && (piece.type === 'rook' || piece.type === 'queen')) {
          return true;
        }
        break;
      }
      row += dr;
      col += dc;
    }
  }
  
  // Check for bishop/queen attacks (diagonals)
  const diagonalDirections = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (const [dr, dc] of diagonalDirections) {
    let row = square.row + dr;
    let col = square.col + dc;
    while (row >= 0 && row < 8 && col >= 0 && col < 8) {
      const piece = board[row][col];
      if (piece) {
        if (piece.color === byColor && (piece.type === 'bishop' || piece.type === 'queen')) {
          return true;
        }
        break;
      }
      row += dr;
      col += dc;
    }
  }
  
  return false;
}

function isInCheck(board: (ChessPiece | null)[][], color: 'white' | 'black'): boolean {
  const kingPos = findKing(board, color);
  if (!kingPos) return false;
  return isSquareAttacked(board, kingPos, color === 'white' ? 'black' : 'white');
}

function getPseudoLegalMoves(position: ChessPosition, from: { row: number; col: number }): ChessMove[] {
  const piece = position.board[from.row][from.col];
  if (!piece || piece.color !== position.currentPlayer) return [];
  
  const moves: ChessMove[] = [];
  
  const addMove = (toRow: number, toCol: number, promotion?: ChessMove['promotion']) => {
    if (toRow >= 0 && toRow < 8 && toCol >= 0 && toCol < 8) {
      const target = position.board[toRow][toCol];
      if (!target || target.color !== piece.color) {
        moves.push({ from, to: { row: toRow, col: toCol }, promotion });
      }
    }
  };
  
  switch (piece.type) {
    case 'pawn': {
      const direction = piece.color === 'white' ? -1 : 1;
      const startRow = piece.color === 'white' ? 6 : 1;
      const promotionRow = piece.color === 'white' ? 0 : 7;
      
      // Forward move
      const oneForward = from.row + direction;
      if (oneForward >= 0 && oneForward < 8 && !position.board[oneForward][from.col]) {
        if (oneForward === promotionRow) {
          for (const promo of ['queen', 'rook', 'bishop', 'knight'] as const) {
            moves.push({ from, to: { row: oneForward, col: from.col }, promotion: promo });
          }
        } else {
          moves.push({ from, to: { row: oneForward, col: from.col } });
        }
        
        // Double move from start
        if (from.row === startRow) {
          const twoForward = from.row + 2 * direction;
          if (!position.board[twoForward][from.col]) {
            moves.push({ from, to: { row: twoForward, col: from.col } });
          }
        }
      }
      
      // Captures
      for (const colOffset of [-1, 1]) {
        const captureCol = from.col + colOffset;
        if (captureCol >= 0 && captureCol < 8) {
          const target = position.board[oneForward][captureCol];
          const isEnPassant = position.enPassantSquare && 
            position.enPassantSquare.row === oneForward && 
            position.enPassantSquare.col === captureCol;
          
          if ((target && target.color !== piece.color) || isEnPassant) {
            if (oneForward === promotionRow) {
              for (const promo of ['queen', 'rook', 'bishop', 'knight'] as const) {
                moves.push({ from, to: { row: oneForward, col: captureCol }, promotion: promo });
              }
            } else {
              moves.push({ from, to: { row: oneForward, col: captureCol } });
            }
          }
        }
      }
      break;
    }
    
    case 'knight': {
      const knightMoves = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
      for (const [dr, dc] of knightMoves) {
        addMove(from.row + dr, from.col + dc);
      }
      break;
    }
    
    case 'bishop': {
      const directions = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
      for (const [dr, dc] of directions) {
        let row = from.row + dr;
        let col = from.col + dc;
        while (row >= 0 && row < 8 && col >= 0 && col < 8) {
          const target = position.board[row][col];
          if (target) {
            if (target.color !== piece.color) {
              moves.push({ from, to: { row, col } });
            }
            break;
          }
          moves.push({ from, to: { row, col } });
          row += dr;
          col += dc;
        }
      }
      break;
    }
    
    case 'rook': {
      const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      for (const [dr, dc] of directions) {
        let row = from.row + dr;
        let col = from.col + dc;
        while (row >= 0 && row < 8 && col >= 0 && col < 8) {
          const target = position.board[row][col];
          if (target) {
            if (target.color !== piece.color) {
              moves.push({ from, to: { row, col } });
            }
            break;
          }
          moves.push({ from, to: { row, col } });
          row += dr;
          col += dc;
        }
      }
      break;
    }
    
    case 'queen': {
      const directions = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];
      for (const [dr, dc] of directions) {
        let row = from.row + dr;
        let col = from.col + dc;
        while (row >= 0 && row < 8 && col >= 0 && col < 8) {
          const target = position.board[row][col];
          if (target) {
            if (target.color !== piece.color) {
              moves.push({ from, to: { row, col } });
            }
            break;
          }
          moves.push({ from, to: { row, col } });
          row += dr;
          col += dc;
        }
      }
      break;
    }
    
    case 'king': {
      // Normal king moves
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          addMove(from.row + dr, from.col + dc);
        }
      }
      
      // Castling
      if (!isInCheck(position.board, piece.color)) {
        const row = piece.color === 'white' ? 7 : 0;
        
        // King side
        const kingSide = piece.color === 'white' ? position.castlingRights.whiteKingSide : position.castlingRights.blackKingSide;
        if (kingSide && !position.board[row][5] && !position.board[row][6]) {
          if (!isSquareAttacked(position.board, { row, col: 5 }, piece.color === 'white' ? 'black' : 'white') &&
              !isSquareAttacked(position.board, { row, col: 6 }, piece.color === 'white' ? 'black' : 'white')) {
            moves.push({ from, to: { row, col: 6 } });
          }
        }
        
        // Queen side
        const queenSide = piece.color === 'white' ? position.castlingRights.whiteQueenSide : position.castlingRights.blackQueenSide;
        if (queenSide && !position.board[row][1] && !position.board[row][2] && !position.board[row][3]) {
          if (!isSquareAttacked(position.board, { row, col: 2 }, piece.color === 'white' ? 'black' : 'white') &&
              !isSquareAttacked(position.board, { row, col: 3 }, piece.color === 'white' ? 'black' : 'white')) {
            moves.push({ from, to: { row, col: 2 } });
          }
        }
      }
      break;
    }
  }
  
  return moves;
}

function applyMove(position: ChessPosition, move: ChessMove): ChessPosition {
  const newPosition = clonePosition(position);
  const piece = newPosition.board[move.from.row][move.from.col]!;
  const capturedPiece = newPosition.board[move.to.row][move.to.col];
  
  // Move piece
  newPosition.board[move.to.row][move.to.col] = piece;
  newPosition.board[move.from.row][move.from.col] = null;
  
  // Handle pawn promotion
  if (piece.type === 'pawn' && move.promotion) {
    newPosition.board[move.to.row][move.to.col] = { type: move.promotion, color: piece.color };
  }
  
  // Handle en passant capture
  if (piece.type === 'pawn' && position.enPassantSquare &&
      move.to.row === position.enPassantSquare.row && move.to.col === position.enPassantSquare.col) {
    const capturedPawnRow = piece.color === 'white' ? move.to.row + 1 : move.to.row - 1;
    newPosition.board[capturedPawnRow][move.to.col] = null;
  }
  
  // Set en passant square for double pawn push
  if (piece.type === 'pawn' && Math.abs(move.to.row - move.from.row) === 2) {
    newPosition.enPassantSquare = {
      row: (move.from.row + move.to.row) / 2,
      col: move.from.col,
    };
  } else {
    newPosition.enPassantSquare = null;
  }
  
  // Handle castling
  if (piece.type === 'king' && Math.abs(move.to.col - move.from.col) === 2) {
    const row = move.from.row;
    if (move.to.col === 6) { // King side
      newPosition.board[row][5] = newPosition.board[row][7];
      newPosition.board[row][7] = null;
    } else if (move.to.col === 2) { // Queen side
      newPosition.board[row][3] = newPosition.board[row][0];
      newPosition.board[row][0] = null;
    }
  }
  
  // Update castling rights
  if (piece.type === 'king') {
    if (piece.color === 'white') {
      newPosition.castlingRights.whiteKingSide = false;
      newPosition.castlingRights.whiteQueenSide = false;
    } else {
      newPosition.castlingRights.blackKingSide = false;
      newPosition.castlingRights.blackQueenSide = false;
    }
  }
  if (piece.type === 'rook') {
    if (move.from.row === 7 && move.from.col === 0) newPosition.castlingRights.whiteQueenSide = false;
    if (move.from.row === 7 && move.from.col === 7) newPosition.castlingRights.whiteKingSide = false;
    if (move.from.row === 0 && move.from.col === 0) newPosition.castlingRights.blackQueenSide = false;
    if (move.from.row === 0 && move.from.col === 7) newPosition.castlingRights.blackKingSide = false;
  }
  
  // Update half move clock
  if (piece.type === 'pawn' || capturedPiece) {
    newPosition.halfMoveClock = 0;
  } else {
    newPosition.halfMoveClock++;
  }
  
  // Update full move number
  if (position.currentPlayer === 'black') {
    newPosition.fullMoveNumber++;
  }
  
  // Switch player
  newPosition.currentPlayer = position.currentPlayer === 'white' ? 'black' : 'white';
  
  return newPosition;
}

function getAllLegalMoves(position: ChessPosition): ChessMove[] {
  const legalMoves: ChessMove[] = [];
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = position.board[row][col];
      if (piece && piece.color === position.currentPlayer) {
        const pseudoLegal = getPseudoLegalMoves(position, { row, col });
        for (const move of pseudoLegal) {
          const newPosition = applyMove(position, move);
          if (!isInCheck(newPosition.board, position.currentPlayer)) {
            legalMoves.push(move);
          }
        }
      }
    }
  }
  
  return legalMoves;
}

function squareToNotation(square: { row: number; col: number }): string {
  return String.fromCharCode(97 + square.col) + (8 - square.row);
}

function getMoveNotation(position: ChessPosition, move: ChessMove): string {
  const piece = position.board[move.from.row][move.from.col]!;
  const capturedPiece = position.board[move.to.row][move.to.col];
  const isEnPassant = piece.type === 'pawn' && position.enPassantSquare &&
    move.to.row === position.enPassantSquare.row && move.to.col === position.enPassantSquare.col;
  
  // Castling
  if (piece.type === 'king' && Math.abs(move.to.col - move.from.col) === 2) {
    return move.to.col === 6 ? 'O-O' : 'O-O-O';
  }
  
  let notation = '';
  
  // Piece letter (except pawns)
  if (piece.type !== 'pawn') {
    notation += piece.type.charAt(0).toUpperCase();
    if (piece.type === 'knight') notation = 'N';
  }
  
  // Disambiguation
  // (simplified - just add from column for pawns when capturing)
  if (piece.type === 'pawn' && (capturedPiece || isEnPassant)) {
    notation += String.fromCharCode(97 + move.from.col);
  }
  
  // Capture symbol
  if (capturedPiece || isEnPassant) {
    notation += 'x';
  }
  
  // Target square
  notation += squareToNotation(move.to);
  
  // Promotion
  if (move.promotion) {
    notation += '=' + (move.promotion === 'knight' ? 'N' : move.promotion.charAt(0).toUpperCase());
  }
  
  // Check/Checkmate
  const newPosition = applyMove(position, move);
  if (isInCheck(newPosition.board, newPosition.currentPlayer)) {
    const legalMoves = getAllLegalMoves(newPosition);
    notation += legalMoves.length === 0 ? '#' : '+';
  }
  
  return notation;
}

export function validateAndMakeMove(position: ChessPosition, move: ChessMove): MoveResult {
  const piece = position.board[move.from.row][move.from.col];
  
  if (!piece) {
    return { valid: false, error: 'No piece at source square' };
  }
  
  if (piece.color !== position.currentPlayer) {
    return { valid: false, error: 'Not your piece' };
  }
  
  // Get all legal moves from this square
  const legalMoves = getAllLegalMoves(position);
  const isLegal = legalMoves.some(m => 
    m.from.row === move.from.row && m.from.col === move.from.col &&
    m.to.row === move.to.row && m.to.col === move.to.col &&
    m.promotion === move.promotion
  );
  
  if (!isLegal) {
    return { valid: false, error: 'Illegal move' };
  }
  
  const capturedPiece = position.board[move.to.row][move.to.col];
  const notation = getMoveNotation(position, move);
  const newPosition = applyMove(position, move);
  
  const opponentMoves = getAllLegalMoves(newPosition);
  const inCheck = isInCheck(newPosition.board, newPosition.currentPlayer);
  const isCheckmate = inCheck && opponentMoves.length === 0;
  const isStalemate = !inCheck && opponentMoves.length === 0;
  const isDraw = newPosition.halfMoveClock >= 100 || isStalemate;
  
  return {
    valid: true,
    newPosition,
    capturedPiece: capturedPiece || undefined,
    isCheck: inCheck,
    isCheckmate,
    isStalemate,
    isDraw,
    notation,
  };
}

export function getLegalMovesForPiece(position: ChessPosition, square: { row: number; col: number }): ChessMove[] {
  const allMoves = getAllLegalMoves(position);
  return allMoves.filter(m => m.from.row === square.row && m.from.col === square.col);
}

export function getGameStatus(position: ChessPosition): {
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  winner?: 'white' | 'black';
} {
  const legalMoves = getAllLegalMoves(position);
  const inCheck = isInCheck(position.board, position.currentPlayer);
  const isCheckmate = inCheck && legalMoves.length === 0;
  const isStalemate = !inCheck && legalMoves.length === 0;
  const isDraw = position.halfMoveClock >= 100 || isStalemate;
  
  return {
    isCheck: inCheck,
    isCheckmate,
    isStalemate,
    isDraw,
    winner: isCheckmate ? (position.currentPlayer === 'white' ? 'black' : 'white') : undefined,
  };
}
