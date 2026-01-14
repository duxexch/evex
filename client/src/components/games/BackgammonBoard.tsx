import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dices, RotateCcw, Flag } from "lucide-react";

interface BackgammonBoardProps {
  sessionId: string;
  gameState: BackgammonState | null;
  isMyTurn: boolean;
  myColor: "white" | "black";
  onMove: (move: BackgammonMove) => void;
  onRollDice: () => void;
  onResign: () => void;
}

interface BackgammonState {
  board: number[]; // 24 points, positive = white, negative = black
  bar: { white: number; black: number };
  home: { white: number; black: number };
  dice: number[];
  currentPlayer: "white" | "black";
  usedDice: number[];
  gameOver: boolean;
  winner?: "white" | "black";
}

interface BackgammonMove {
  from: number; // -1 for bar, 24 for bearing off
  to: number;
  dieUsed: number;
}

const INITIAL_BOARD: number[] = [
  2, 0, 0, 0, 0, -5, // Points 1-6
  0, -3, 0, 0, 0, 5, // Points 7-12
  -5, 0, 0, 0, 3, 0, // Points 13-18
  5, 0, 0, 0, 0, -2  // Points 19-24
];

export function BackgammonBoard({
  sessionId,
  gameState,
  isMyTurn,
  myColor,
  onMove,
  onRollDice,
  onResign
}: BackgammonBoardProps) {
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [validMoves, setValidMoves] = useState<number[]>([]);

  const state = gameState || {
    board: [...INITIAL_BOARD],
    bar: { white: 0, black: 0 },
    home: { white: 0, black: 0 },
    dice: [],
    currentPlayer: "white" as const,
    usedDice: [],
    gameOver: false
  };

  const availableDice = state.dice.filter((d, i) => !state.usedDice.includes(i));

  // Calculate valid moves for a selected point
  const calculateValidMoves = useCallback((fromPoint: number): number[] => {
    if (!isMyTurn || availableDice.length === 0) return [];
    
    const moves: number[] = [];
    const direction = myColor === "white" ? 1 : -1;

    availableDice.forEach(die => {
      let toPoint: number;
      
      if (fromPoint === -1) {
        // Coming from bar
        toPoint = myColor === "white" ? die - 1 : 24 - die;
      } else {
        toPoint = fromPoint + (die * direction);
      }

      // Check if move is valid
      if (toPoint >= 0 && toPoint < 24) {
        const targetPieces = state.board[toPoint];
        const canMove = myColor === "white" 
          ? targetPieces >= -1 
          : targetPieces <= 1;
        
        if (canMove) moves.push(toPoint);
      }
      
      // Bearing off
      if (canBearOff() && toPoint >= 24 && myColor === "white") {
        moves.push(24);
      }
      if (canBearOff() && toPoint < 0 && myColor === "black") {
        moves.push(-1);
      }
    });

    return moves;
  }, [isMyTurn, availableDice, myColor, state.board]);

  const canBearOff = (): boolean => {
    // Check if all pieces are in home board
    if (myColor === "white") {
      for (let i = 0; i < 18; i++) {
        if (state.board[i] > 0) return false;
      }
      return state.bar.white === 0;
    } else {
      for (let i = 6; i < 24; i++) {
        if (state.board[i] < 0) return false;
      }
      return state.bar.black === 0;
    }
  };

  const handlePointClick = (pointIndex: number) => {
    if (!isMyTurn) return;

    const piecesOnPoint = state.board[pointIndex];
    const isMyPiece = myColor === "white" ? piecesOnPoint > 0 : piecesOnPoint < 0;

    // Check if we must move from bar first
    const mustMoveFromBar = myColor === "white" ? state.bar.white > 0 : state.bar.black > 0;
    
    if (mustMoveFromBar && selectedPoint !== -1) {
      setSelectedPoint(-1);
      setValidMoves(calculateValidMoves(-1));
      return;
    }

    if (selectedPoint === null) {
      if (isMyPiece) {
        setSelectedPoint(pointIndex);
        setValidMoves(calculateValidMoves(pointIndex));
      }
    } else {
      if (validMoves.includes(pointIndex)) {
        // Calculate which die was used
        const distance = Math.abs(pointIndex - selectedPoint);
        const dieUsed = availableDice.find(d => d === distance) || availableDice[0];
        
        onMove({
          from: selectedPoint,
          to: pointIndex,
          dieUsed
        });
        setSelectedPoint(null);
        setValidMoves([]);
      } else if (isMyPiece) {
        setSelectedPoint(pointIndex);
        setValidMoves(calculateValidMoves(pointIndex));
      } else {
        setSelectedPoint(null);
        setValidMoves([]);
      }
    }
  };

  const handleBarClick = () => {
    const piecesOnBar = myColor === "white" ? state.bar.white : state.bar.black;
    if (piecesOnBar > 0 && isMyTurn) {
      setSelectedPoint(-1);
      setValidMoves(calculateValidMoves(-1));
    }
  };

  const renderPoint = (index: number, isTop: boolean) => {
    const pieces = state.board[index];
    const isSelected = selectedPoint === index;
    const isValidTarget = validMoves.includes(index);
    const pieceColor = pieces > 0 ? "white" : pieces < 0 ? "black" : null;
    const pieceCount = Math.abs(pieces);

    return (
      <div
        key={index}
        data-testid={`backgammon-point-${index}`}
        onClick={() => handlePointClick(index)}
        className={`
          relative flex flex-col items-center cursor-pointer
          w-10 h-32
          ${isTop ? "justify-start" : "justify-end"}
          ${isSelected ? "ring-2 ring-primary" : ""}
          ${isValidTarget ? "ring-2 ring-green-500" : ""}
        `}
      >
        {/* Triangle */}
        <div
          className={`
            absolute inset-0
            ${isTop ? "bg-gradient-to-b" : "bg-gradient-to-t"}
            ${index % 2 === 0 ? "from-amber-800 to-amber-600" : "from-stone-700 to-stone-500"}
            ${isTop ? "clip-triangle-down" : "clip-triangle-up"}
          `}
        />
        
        {/* Pieces */}
        <div className={`relative z-10 flex flex-col ${isTop ? "" : "flex-col-reverse"} gap-0.5`}>
          {Array.from({ length: Math.min(pieceCount, 5) }).map((_, i) => (
            <div
              key={i}
              className={`
                w-8 h-8 rounded-full border-2
                ${pieceColor === "white" 
                  ? "bg-white border-gray-300 shadow-md" 
                  : "bg-gray-900 border-gray-700"}
                ${i === 0 && pieceCount > 5 ? "relative" : ""}
              `}
            >
              {i === 0 && pieceCount > 5 && (
                <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold
                  ${pieceColor === "white" ? "text-black" : "text-white"}`}>
                  {pieceCount}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Point number */}
        <span className="absolute bottom-0 text-xs text-muted-foreground">
          {index + 1}
        </span>
      </div>
    );
  };

  const renderBar = () => (
    <div 
      data-testid="backgammon-bar"
      onClick={handleBarClick}
      className={`
        w-12 h-full bg-amber-950 flex flex-col items-center justify-center gap-2
        ${selectedPoint === -1 ? "ring-2 ring-primary" : ""}
        cursor-pointer
      `}
    >
      {/* White pieces on bar */}
      {state.bar.white > 0 && (
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-white border-2 border-gray-300" />
          {state.bar.white > 1 && (
            <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-xs">
              {state.bar.white}
            </Badge>
          )}
        </div>
      )}
      
      {/* Black pieces on bar */}
      {state.bar.black > 0 && (
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-gray-900 border-2 border-gray-700" />
          {state.bar.black > 1 && (
            <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-xs">
              {state.bar.black}
            </Badge>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-4" data-testid="backgammon-board">
      {/* Game info */}
      <div className="flex items-center gap-4">
        <Badge variant={myColor === "white" ? "default" : "secondary"}>
          أنت: {myColor === "white" ? "الأبيض" : "الأسود"}
        </Badge>
        <Badge variant={state.currentPlayer === myColor ? "default" : "outline"}>
          الدور: {state.currentPlayer === "white" ? "الأبيض" : "الأسود"}
        </Badge>
      </div>

      {/* Dice display */}
      <div className="flex items-center gap-4">
        {state.dice.length > 0 ? (
          <div className="flex gap-2">
            {state.dice.map((die, i) => (
              <div
                key={i}
                data-testid={`die-${i}`}
                className={`
                  w-12 h-12 bg-white rounded-lg border-2 border-gray-300
                  flex items-center justify-center text-2xl font-bold
                  ${state.usedDice.includes(i) ? "opacity-30" : ""}
                `}
              >
                {die}
              </div>
            ))}
          </div>
        ) : isMyTurn ? (
          <Button onClick={onRollDice} data-testid="button-roll-dice">
            <Dices className="mr-2 h-4 w-4" />
            رمي النرد
          </Button>
        ) : (
          <span className="text-muted-foreground">انتظر دورك...</span>
        )}
      </div>

      {/* Board */}
      <div className="bg-amber-900 p-4 rounded-lg shadow-xl">
        {/* Top half (points 13-24) */}
        <div className="flex">
          <div className="flex">
            {[12, 13, 14, 15, 16, 17].map(i => renderPoint(i, true))}
          </div>
          {renderBar()}
          <div className="flex">
            {[18, 19, 20, 21, 22, 23].map(i => renderPoint(i, true))}
          </div>
        </div>

        {/* Divider */}
        <div className="h-8 bg-amber-950 my-2" />

        {/* Bottom half (points 1-12) */}
        <div className="flex">
          <div className="flex">
            {[11, 10, 9, 8, 7, 6].map(i => renderPoint(i, false))}
          </div>
          <div className="w-12" />
          <div className="flex">
            {[5, 4, 3, 2, 1, 0].map(i => renderPoint(i, false))}
          </div>
        </div>
      </div>

      {/* Home areas */}
      <div className="flex justify-between w-full max-w-md">
        <div className="text-center">
          <span className="text-sm text-muted-foreground">بيت الأبيض</span>
          <div className="flex gap-1 mt-1">
            {Array.from({ length: state.home.white }).map((_, i) => (
              <div key={i} className="w-4 h-4 rounded-full bg-white border border-gray-300" />
            ))}
          </div>
        </div>
        <div className="text-center">
          <span className="text-sm text-muted-foreground">بيت الأسود</span>
          <div className="flex gap-1 mt-1">
            {Array.from({ length: state.home.black }).map((_, i) => (
              <div key={i} className="w-4 h-4 rounded-full bg-gray-900 border border-gray-700" />
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="destructive" size="sm" onClick={onResign} data-testid="button-resign">
          <Flag className="mr-2 h-4 w-4" />
          استسلام
        </Button>
      </div>

      {/* Game over */}
      {state.gameOver && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card p-8 rounded-lg text-center">
            <h2 className="text-2xl font-bold mb-4">
              {state.winner === myColor ? "🎉 فزت!" : "😔 خسرت"}
            </h2>
            <p className="text-muted-foreground">
              الفائز: {state.winner === "white" ? "الأبيض" : "الأسود"}
            </p>
          </div>
        </div>
      )}

      <style>{`
        .clip-triangle-down {
          clip-path: polygon(50% 100%, 0 0, 100% 0);
        }
        .clip-triangle-up {
          clip-path: polygon(50% 0, 0 100%, 100% 100%);
        }
      `}</style>
    </div>
  );
}

export default BackgammonBoard;
