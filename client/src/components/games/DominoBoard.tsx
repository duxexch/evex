import { useState, useEffect, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

interface DominoBoardProps {
  gameState?: string;
  currentTurn?: string;
  isMyTurn: boolean;
  isSpectator: boolean;
  onMove: (move: DominoMove) => void;
  status?: string;
}

interface DominoMove {
  tileLeft: number;
  tileRight: number;
  placedEnd: "left" | "right";
  isPassed: boolean;
}

interface DominoTile {
  left: number;
  right: number;
}

interface GameState {
  myHand: DominoTile[];
  opponentTileCount: number;
  boardTiles: { tile: DominoTile; rotation: number }[];
  leftEnd: number;
  rightEnd: number;
  boneyard: number;
}

const INITIAL_STATE: GameState = {
  myHand: [],
  opponentTileCount: 7,
  boardTiles: [],
  leftEnd: -1,
  rightEnd: -1,
  boneyard: 14,
};

function DominoTileComponent({ 
  tile, 
  isSelected, 
  onClick, 
  isPlayable,
  size = "md",
  rotation = 0,
}: { 
  tile: DominoTile; 
  isSelected?: boolean; 
  onClick?: () => void;
  isPlayable?: boolean;
  size?: "sm" | "md" | "lg";
  rotation?: number;
}) {
  const sizes = {
    sm: "w-8 h-16",
    md: "w-12 h-24",
    lg: "w-16 h-32",
  };

  const dotSizes = {
    sm: "w-1.5 h-1.5",
    md: "w-2 h-2",
    lg: "w-3 h-3",
  };

  const renderDots = (value: number, isTop: boolean) => {
    const dotPositions: Record<number, number[][]> = {
      0: [],
      1: [[1, 1]],
      2: [[0, 0], [2, 2]],
      3: [[0, 0], [1, 1], [2, 2]],
      4: [[0, 0], [0, 2], [2, 0], [2, 2]],
      5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
      6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
    };

    const positions = dotPositions[value] || [];

    return (
      <div className="grid grid-cols-3 grid-rows-3 gap-0.5 p-1 w-full h-full">
        {[0, 1, 2].map(row =>
          [0, 1, 2].map(col => {
            const hasDot = positions.some(([r, c]) => r === row && c === col);
            return (
              <div
                key={`${row}-${col}`}
                className={cn(
                  "rounded-full",
                  hasDot ? `${dotSizes[size]} bg-gray-800` : ""
                )}
              />
            );
          })
        )}
      </div>
    );
  };

  const rotationClass = rotation === 90 ? "rotate-90" : rotation === -90 ? "-rotate-90" : "";

  return (
    <div
      onClick={onClick}
      className={cn(
        sizes[size],
        "bg-white rounded-lg border-2 flex flex-col cursor-pointer transition-all",
        isSelected ? "border-primary ring-2 ring-primary scale-110 z-10" : "border-gray-400",
        isPlayable ? "hover:scale-105 hover:shadow-lg" : "opacity-60",
        onClick ? "cursor-pointer" : "cursor-default",
        rotationClass
      )}
      data-testid={`domino-tile-${tile.left}-${tile.right}`}
    >
      <div className="flex-1 flex items-center justify-center border-b border-gray-300">
        {renderDots(tile.left, true)}
      </div>
      <div className="flex-1 flex items-center justify-center">
        {renderDots(tile.right, false)}
      </div>
    </div>
  );
}

function PlaceholderTile({ count }: { count: number }) {
  return (
    <div className="flex gap-1 items-center">
      {Array.from({ length: Math.min(count, 7) }).map((_, i) => (
        <div
          key={i}
          className="w-8 h-16 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg border-2 border-blue-900 flex items-center justify-center"
        >
          <div className="w-6 h-6 rounded-full bg-blue-400/30" />
        </div>
      ))}
      {count > 7 && (
        <span className="text-sm font-medium text-muted-foreground">+{count - 7}</span>
      )}
    </div>
  );
}

export function DominoBoard({
  gameState,
  currentTurn,
  isMyTurn,
  isSpectator,
  onMove,
  status,
}: DominoBoardProps) {
  const { language } = useI18n();
  const [selectedTile, setSelectedTile] = useState<number | null>(null);
  const [canPass, setCanPass] = useState(false);

  const state = useMemo<GameState>(() => {
    try {
      if (gameState) {
        return JSON.parse(gameState);
      }
    } catch {
      return INITIAL_STATE;
    }
    return INITIAL_STATE;
  }, [gameState]);

  const getPlayableTiles = useCallback(() => {
    if (state.boardTiles.length === 0) {
      return state.myHand.map((_, i) => ({ index: i, ends: ["left", "right"] as ("left" | "right")[] }));
    }

    const playable: { index: number; ends: ("left" | "right")[] }[] = [];
    
    state.myHand.forEach((tile, index) => {
      const ends: ("left" | "right")[] = [];
      
      if (tile.left === state.leftEnd || tile.right === state.leftEnd) {
        ends.push("left");
      }
      if (tile.left === state.rightEnd || tile.right === state.rightEnd) {
        ends.push("right");
      }
      
      if (ends.length > 0) {
        playable.push({ index, ends });
      }
    });

    return playable;
  }, [state]);

  const playableTiles = useMemo(() => getPlayableTiles(), [getPlayableTiles]);

  useEffect(() => {
    setCanPass(playableTiles.length === 0 && state.boneyard === 0);
  }, [playableTiles, state.boneyard]);

  const handleTileClick = (index: number) => {
    if (isSpectator || !isMyTurn || status === "finished") return;
    
    const playable = playableTiles.find(p => p.index === index);
    if (!playable) return;

    if (selectedTile === index) {
      setSelectedTile(null);
    } else {
      setSelectedTile(index);
    }
  };

  const handlePlaceTile = (end: "left" | "right") => {
    if (selectedTile === null) return;
    
    const tile = state.myHand[selectedTile];
    const move: DominoMove = {
      tileLeft: tile.left,
      tileRight: tile.right,
      placedEnd: end,
      isPassed: false,
    };
    
    onMove(move);
    setSelectedTile(null);
  };

  const handlePass = () => {
    const move: DominoMove = {
      tileLeft: 0,
      tileRight: 0,
      placedEnd: "left",
      isPassed: true,
    };
    onMove(move);
  };

  const handleDraw = () => {
    onMove({
      tileLeft: -1,
      tileRight: -1,
      placedEnd: "left",
      isPassed: false,
    });
  };

  const selectedTileData = selectedTile !== null ? state.myHand[selectedTile] : null;
  const selectedPlayable = selectedTile !== null ? playableTiles.find(p => p.index === selectedTile) : null;

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-2">
          {language === "ar" ? "قطع الخصم" : "Opponent's tiles"}
        </p>
        <div className="flex justify-center">
          <PlaceholderTile count={state.opponentTileCount} />
        </div>
      </div>

      <div className="bg-green-800 rounded-xl p-6 min-h-[200px] flex items-center justify-center">
        {state.boardTiles.length === 0 ? (
          <p className="text-white/70 text-lg">
            {language === "ar" ? "ضع أول قطعة" : "Place the first tile"}
          </p>
        ) : (
          <div className="flex items-center gap-1 flex-wrap justify-center">
            {state.boardTiles.map((item, index) => (
              <DominoTileComponent
                key={index}
                tile={item.tile}
                size="sm"
                rotation={item.rotation}
              />
            ))}
          </div>
        )}
      </div>

      {selectedTile !== null && selectedPlayable && (
        <div className="flex justify-center gap-4">
          {selectedPlayable.ends.includes("left") && (
            <Button
              onClick={() => handlePlaceTile("left")}
              data-testid="button-place-left"
            >
              {language === "ar" ? "ضع يساراً" : "Place Left"}
            </Button>
          )}
          {selectedPlayable.ends.includes("right") && (
            <Button
              onClick={() => handlePlaceTile("right")}
              data-testid="button-place-right"
            >
              {language === "ar" ? "ضع يميناً" : "Place Right"}
            </Button>
          )}
        </div>
      )}

      <div className="bg-card rounded-xl p-4 border">
        <p className="text-sm text-muted-foreground mb-3 text-center">
          {language === "ar" ? "قطعك" : "Your tiles"} ({state.myHand.length})
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          {state.myHand.map((tile, index) => {
            const isPlayable = playableTiles.some(p => p.index === index);
            return (
              <DominoTileComponent
                key={index}
                tile={tile}
                isSelected={selectedTile === index}
                onClick={() => handleTileClick(index)}
                isPlayable={isMyTurn && isPlayable && !isSpectator}
              />
            );
          })}
        </div>
      </div>

      <div className="flex justify-center gap-4">
        {state.boneyard > 0 && playableTiles.length === 0 && isMyTurn && !isSpectator && (
          <Button
            variant="secondary"
            onClick={handleDraw}
            data-testid="button-draw"
          >
            {language === "ar" ? `اسحب من البنك (${state.boneyard})` : `Draw (${state.boneyard} left)`}
          </Button>
        )}
        {canPass && isMyTurn && !isSpectator && (
          <Button
            variant="outline"
            onClick={handlePass}
            data-testid="button-pass"
          >
            {language === "ar" ? "تمرير" : "Pass"}
          </Button>
        )}
      </div>

      {status === "finished" && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-xl">
          <span className="text-2xl font-bold text-white drop-shadow-lg">
            {language === "ar" ? "انتهت اللعبة" : "Game Over"}
          </span>
        </div>
      )}
    </div>
  );
}
