import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";

interface ChessBoardProps {
  gameState?: string;
  currentTurn?: string;
  myColor: "white" | "black";
  isMyTurn: boolean;
  isSpectator: boolean;
  onMove: (move: ChessMove) => void;
  status?: string;
}

interface ChessMove {
  from: string;
  to: string;
  piece: string;
  captured?: string;
  promotion?: string;
}

interface Square {
  row: number;
  col: number;
  piece: string | null;
  color: "white" | "black";
}

type PieceType = "K" | "Q" | "R" | "B" | "N" | "P" | "k" | "q" | "r" | "b" | "n" | "p";

const PIECE_SYMBOLS: Record<string, string> = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

function parseFEN(fen: string): string[][] {
  const [position] = fen.split(" ");
  const rows = position.split("/");
  const board: string[][] = [];

  for (const row of rows) {
    const boardRow: string[] = [];
    for (const char of row) {
      if (isNaN(parseInt(char))) {
        boardRow.push(char);
      } else {
        for (let i = 0; i < parseInt(char); i++) {
          boardRow.push("");
        }
      }
    }
    board.push(boardRow);
  }

  return board;
}

function squareToCoords(square: string): [number, number] {
  const file = square.charCodeAt(0) - 97;
  const rank = 8 - parseInt(square[1]);
  return [rank, file];
}

function coordsToSquare(row: number, col: number): string {
  return FILES[col] + RANKS[row];
}

function isWhitePiece(piece: string): boolean {
  return piece === piece.toUpperCase() && piece !== "";
}

function getPieceColor(piece: string): "white" | "black" | null {
  if (!piece) return null;
  return isWhitePiece(piece) ? "white" : "black";
}

function getValidMoves(board: string[][], row: number, col: number, piece: string): string[] {
  const moves: string[] = [];
  const isWhite = isWhitePiece(piece);
  const pieceType = piece.toUpperCase();

  const addMoveIfValid = (r: number, c: number, canCapture = true, mustCapture = false): boolean => {
    if (r < 0 || r > 7 || c < 0 || c > 7) return false;
    const target = board[r][c];
    if (!target) {
      if (!mustCapture) moves.push(coordsToSquare(r, c));
      return true;
    }
    if (canCapture && getPieceColor(target) !== (isWhite ? "white" : "black")) {
      if (!mustCapture || target) moves.push(coordsToSquare(r, c));
    }
    return false;
  };

  const addLineMoves = (dr: number, dc: number) => {
    for (let i = 1; i < 8; i++) {
      if (!addMoveIfValid(row + dr * i, col + dc * i)) break;
      if (board[row + dr * i]?.[col + dc * i]) break;
    }
  };

  switch (pieceType) {
    case "P": {
      const dir = isWhite ? -1 : 1;
      const startRow = isWhite ? 6 : 1;
      
      if (!board[row + dir]?.[col]) {
        moves.push(coordsToSquare(row + dir, col));
        if (row === startRow && !board[row + dir * 2]?.[col]) {
          moves.push(coordsToSquare(row + dir * 2, col));
        }
      }
      
      [-1, 1].forEach(dc => {
        const target = board[row + dir]?.[col + dc];
        if (target && getPieceColor(target) !== (isWhite ? "white" : "black")) {
          moves.push(coordsToSquare(row + dir, col + dc));
        }
      });
      break;
    }
    case "N":
      [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]].forEach(([dr, dc]) => {
        addMoveIfValid(row + dr, col + dc);
      });
      break;
    case "B":
      [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([dr, dc]) => addLineMoves(dr, dc));
      break;
    case "R":
      [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => addLineMoves(dr, dc));
      break;
    case "Q":
      [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]].forEach(([dr, dc]) => addLineMoves(dr, dc));
      break;
    case "K":
      [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]].forEach(([dr, dc]) => {
        addMoveIfValid(row + dr, col + dc);
      });
      break;
  }

  return moves;
}

export function ChessBoard({
  gameState,
  currentTurn,
  myColor,
  isMyTurn,
  isSpectator,
  onMove,
  status,
}: ChessBoardProps) {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [showPromotion, setShowPromotion] = useState<{ from: string; to: string } | null>(null);

  const board = useMemo(() => {
    try {
      if (gameState) {
        const parsed = JSON.parse(gameState);
        return parseFEN(parsed.fen || INITIAL_FEN);
      }
    } catch {
      return parseFEN(INITIAL_FEN);
    }
    return parseFEN(INITIAL_FEN);
  }, [gameState]);

  const flippedBoard = useMemo(() => {
    if (myColor === "black") {
      return board.map(row => [...row].reverse()).reverse();
    }
    return board;
  }, [board, myColor]);

  const handleSquareClick = useCallback((row: number, col: number) => {
    if (isSpectator || !isMyTurn || status === "finished") return;

    const actualRow = myColor === "black" ? 7 - row : row;
    const actualCol = myColor === "black" ? 7 - col : col;
    const square = coordsToSquare(actualRow, actualCol);
    const piece = board[actualRow][actualCol];

    if (selectedSquare) {
      if (validMoves.includes(square)) {
        const fromPiece = board[squareToCoords(selectedSquare)[0]][squareToCoords(selectedSquare)[1]];
        const isPawn = fromPiece.toUpperCase() === "P";
        const isPromotion = isPawn && (actualRow === 0 || actualRow === 7);

        if (isPromotion) {
          setShowPromotion({ from: selectedSquare, to: square });
        } else {
          const move: ChessMove = {
            from: selectedSquare,
            to: square,
            piece: fromPiece.toUpperCase(),
            captured: piece || undefined,
          };
          onMove(move);
          setLastMove({ from: selectedSquare, to: square });
        }
        setSelectedSquare(null);
        setValidMoves([]);
      } else if (piece && getPieceColor(piece) === myColor) {
        setSelectedSquare(square);
        setValidMoves(getValidMoves(board, actualRow, actualCol, piece));
      } else {
        setSelectedSquare(null);
        setValidMoves([]);
      }
    } else {
      if (piece && getPieceColor(piece) === myColor) {
        setSelectedSquare(square);
        setValidMoves(getValidMoves(board, actualRow, actualCol, piece));
      }
    }
  }, [selectedSquare, validMoves, board, myColor, isMyTurn, isSpectator, onMove, status]);

  const handlePromotion = (promotionPiece: string) => {
    if (!showPromotion) return;
    const fromCoords = squareToCoords(showPromotion.from);
    const fromPiece = board[fromCoords[0]][fromCoords[1]];
    const toCoords = squareToCoords(showPromotion.to);
    const capturedPiece = board[toCoords[0]][toCoords[1]];

    const move: ChessMove = {
      from: showPromotion.from,
      to: showPromotion.to,
      piece: "P",
      captured: capturedPiece || undefined,
      promotion: promotionPiece,
    };
    onMove(move);
    setLastMove({ from: showPromotion.from, to: showPromotion.to });
    setShowPromotion(null);
  };

  const getSquareColor = (row: number, col: number): string => {
    const actualRow = myColor === "black" ? 7 - row : row;
    const actualCol = myColor === "black" ? 7 - col : col;
    const square = coordsToSquare(actualRow, actualCol);
    
    const isLight = (row + col) % 2 === 0;
    let className = isLight ? "bg-amber-100 dark:bg-amber-200" : "bg-amber-700 dark:bg-amber-800";

    if (selectedSquare === square) {
      className = "bg-yellow-400 dark:bg-yellow-500";
    } else if (validMoves.includes(square)) {
      className = isLight ? "bg-green-200 dark:bg-green-300" : "bg-green-600 dark:bg-green-700";
    } else if (lastMove && (lastMove.from === square || lastMove.to === square)) {
      className = isLight ? "bg-yellow-200 dark:bg-yellow-300" : "bg-yellow-600 dark:bg-yellow-700";
    }

    return className;
  };

  return (
    <div className="relative">
      <div className="grid grid-cols-8 border-2 border-amber-900 rounded-lg overflow-hidden shadow-lg">
        {flippedBoard.map((rowPieces, row) => (
          rowPieces.map((piece, col) => {
            const actualRow = myColor === "black" ? 7 - row : row;
            const actualCol = myColor === "black" ? 7 - col : col;
            const square = coordsToSquare(actualRow, actualCol);
            const isValidMove = validMoves.includes(square);
            
            return (
              <div
                key={`${row}-${col}`}
                className={cn(
                  "w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 flex items-center justify-center cursor-pointer relative transition-colors",
                  getSquareColor(row, col),
                  isMyTurn && !isSpectator && "hover:brightness-110"
                )}
                onClick={() => handleSquareClick(row, col)}
                data-testid={`chess-square-${square}`}
              >
                {piece && (
                  <span 
                    className={cn(
                      "text-2xl sm:text-3xl md:text-4xl select-none",
                      isWhitePiece(piece) ? "text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" : "text-gray-900"
                    )}
                  >
                    {PIECE_SYMBOLS[piece]}
                  </span>
                )}
                {isValidMove && !piece && (
                  <div className="absolute w-3 h-3 rounded-full bg-green-500/50" />
                )}
                {isValidMove && piece && (
                  <div className="absolute inset-0 border-4 border-green-500/50 rounded-full" />
                )}
                {col === 0 && (
                  <span className="absolute top-0.5 left-0.5 text-xs font-bold text-amber-900/70">
                    {myColor === "black" ? row + 1 : 8 - row}
                  </span>
                )}
                {row === 7 && (
                  <span className="absolute bottom-0.5 right-0.5 text-xs font-bold text-amber-900/70">
                    {myColor === "black" ? FILES[7 - col] : FILES[col]}
                  </span>
                )}
              </div>
            );
          })
        ))}
      </div>

      {showPromotion && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card p-4 rounded-lg shadow-xl">
            <p className="text-center mb-3 font-medium">Choose promotion:</p>
            <div className="flex gap-2">
              {["Q", "R", "B", "N"].map((p) => (
                <button
                  key={p}
                  onClick={() => handlePromotion(p)}
                  className="w-14 h-14 bg-amber-100 hover:bg-amber-200 rounded-lg flex items-center justify-center text-3xl"
                  data-testid={`promotion-${p}`}
                >
                  {PIECE_SYMBOLS[myColor === "white" ? p : p.toLowerCase()]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {status === "finished" && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
          <span className="text-2xl font-bold text-white drop-shadow-lg">Game Over</span>
        </div>
      )}
    </div>
  );
}
