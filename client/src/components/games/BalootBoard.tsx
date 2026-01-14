import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Crown, Zap } from "lucide-react";

interface BalootBoardProps {
  sessionId: string;
  gameState: BalootState | null;
  playerId: string;
  playerPosition: number;
  onPlayCard: (card: PlayingCard) => void;
  onChooseTrump: (type: "sun" | "hokm", suit?: string) => void;
  onDeclareProject: (project: string) => void;
  onPass: () => void;
}

interface PlayingCard {
  suit: "hearts" | "diamonds" | "clubs" | "spades";
  rank: string;
  value: number;
}

interface BalootState {
  phase: "choosing" | "playing" | "finished";
  hands: { [playerId: string]: PlayingCard[] };
  currentTrick: { playerId: string; card: PlayingCard }[];
  gameType: "sun" | "hokm" | null;
  trumpSuit: string | null;
  currentPlayer: string;
  choosingPlayer: string;
  tricksWon: { team1: number; team2: number };
  points: { team1: number; team2: number };
  roundPoints: { team1: number; team2: number };
  projects: { playerId: string; project: string; points: number }[];
  dealerId: string;
  winningTeam?: number;
  doubleRound: boolean;
}

const SUITS = {
  hearts: { symbol: "♥", color: "text-red-500", nameAr: "هاص" },
  diamonds: { symbol: "♦", color: "text-red-500", nameAr: "ديناري" },
  clubs: { symbol: "♣", color: "text-foreground", nameAr: "كلفس" },
  spades: { symbol: "♠", color: "text-foreground", nameAr: "سبيت" }
};

// Card values in Hokm (trump)
const HOKM_VALUES: { [key: string]: number } = {
  "J": 20, "9": 14, "A": 11, "10": 10, "K": 4, "Q": 3, "8": 0, "7": 0
};

// Card values in Sun (no trump)
const SUN_VALUES: { [key: string]: number } = {
  "A": 11, "10": 10, "K": 4, "Q": 3, "J": 2, "9": 0, "8": 0, "7": 0
};

export function BalootBoard({
  sessionId,
  gameState,
  playerId,
  playerPosition,
  onPlayCard,
  onChooseTrump,
  onDeclareProject,
  onPass
}: BalootBoardProps) {
  const [selectedCard, setSelectedCard] = useState<PlayingCard | null>(null);

  const state = gameState || {
    phase: "choosing" as const,
    hands: {},
    currentTrick: [],
    gameType: null,
    trumpSuit: null,
    currentPlayer: "",
    choosingPlayer: "",
    tricksWon: { team1: 0, team2: 0 },
    points: { team1: 0, team2: 0 },
    roundPoints: { team1: 0, team2: 0 },
    projects: [],
    dealerId: "",
    doubleRound: false
  };

  const myHand = state.hands[playerId] || [];
  const isMyTurn = state.currentPlayer === playerId;
  const isMyChoice = state.choosingPlayer === playerId;

  const handleCardClick = (card: PlayingCard) => {
    if (!isMyTurn || state.phase !== "playing") return;
    
    if (isValidPlay(card)) {
      setSelectedCard(card);
    }
  };

  const handlePlayCard = () => {
    if (selectedCard) {
      onPlayCard(selectedCard);
      setSelectedCard(null);
    }
  };

  const isValidPlay = (card: PlayingCard): boolean => {
    if (state.currentTrick.length === 0) return true;
    
    const leadSuit = state.currentTrick[0].card.suit;
    const hasSuit = myHand.some(c => c.suit === leadSuit);
    
    if (hasSuit) {
      return card.suit === leadSuit;
    }

    // In Hokm, if you don't have lead suit, you must play trump if you have it
    if (state.gameType === "hokm" && state.trumpSuit) {
      const hasTrump = myHand.some(c => c.suit === state.trumpSuit);
      if (hasTrump) {
        return card.suit === state.trumpSuit;
      }
    }

    return true;
  };

  const renderCard = (card: PlayingCard, isPlayable: boolean, index: number) => {
    const suit = SUITS[card.suit];
    const isSelected = selectedCard?.suit === card.suit && selectedCard?.rank === card.rank;
    const isTrump = state.trumpSuit === card.suit;

    return (
      <div
        key={`${card.suit}-${card.rank}`}
        data-testid={`baloot-card-${card.suit}-${card.rank}`}
        onClick={() => isPlayable && handleCardClick(card)}
        className={`
          relative w-14 h-20 bg-white rounded-lg border-2 shadow-md
          flex flex-col items-center justify-between p-1
          transition-all duration-200
          ${isPlayable ? "cursor-pointer hover:-translate-y-2" : "opacity-70"}
          ${isSelected ? "ring-2 ring-primary -translate-y-4" : ""}
          ${isTrump ? "ring-1 ring-yellow-500" : ""}
          ${!isPlayable ? "cursor-not-allowed" : ""}
        `}
        style={{ marginLeft: index > 0 ? "-24px" : "0" }}
      >
        <div className={`text-xs font-bold ${suit.color}`}>
          {card.rank}
        </div>
        <div className={`text-2xl ${suit.color}`}>
          {suit.symbol}
        </div>
        <div className={`text-xs font-bold ${suit.color} rotate-180`}>
          {card.rank}
        </div>
        {isTrump && (
          <Crown className="absolute -top-1 -right-1 h-3 w-3 text-yellow-500" />
        )}
      </div>
    );
  };

  const renderOpponentHand = (position: "top" | "left" | "right", cardCount: number) => {
    const isVertical = position === "left" || position === "right";
    
    return (
      <div 
        className={`flex ${isVertical ? "flex-col" : ""} items-center`}
        data-testid={`baloot-opponent-${position}`}
      >
        {Array.from({ length: Math.min(cardCount, 8) }).map((_, i) => (
          <div
            key={i}
            className={`
              w-10 h-14 bg-gradient-to-br from-green-900 to-green-700
              rounded-lg border-2 border-green-800 shadow-md
              ${isVertical ? "mt-[-24px]" : "ml-[-24px]"}
            `}
            style={i === 0 ? { marginLeft: 0, marginTop: 0 } : {}}
          />
        ))}
      </div>
    );
  };

  const renderTrick = () => (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="relative w-28 h-28">
        {state.currentTrick.map((play, i) => {
          const positions = [
            { bottom: 0, left: "50%", transform: "translateX(-50%)" },
            { left: 0, top: "50%", transform: "translateY(-50%)" },
            { top: 0, left: "50%", transform: "translateX(-50%)" },
            { right: 0, top: "50%", transform: "translateY(-50%)" }
          ];
          const pos = positions[i % 4];
          const suit = SUITS[play.card.suit];

          return (
            <div
              key={i}
              className="absolute w-12 h-16 bg-white rounded-lg border shadow-lg flex flex-col items-center justify-center"
              style={pos as any}
            >
              <span className={`text-sm font-bold ${suit.color}`}>
                {play.card.rank}
              </span>
              <span className={`text-xl ${suit.color}`}>
                {suit.symbol}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderChoosingPhase = () => (
    <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10">
      <Card className="w-96">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            اختر نوع اللعب
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isMyChoice ? (
            <div className="space-y-4">
              {/* Sun option */}
              <Button
                variant="outline"
                className="w-full h-16 text-lg"
                onClick={() => onChooseTrump("sun")}
                data-testid="button-choose-sun"
              >
                <Zap className="mr-2 h-6 w-6 text-yellow-500" />
                صن (بدون حكم)
              </Button>

              {/* Hokm options */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground text-center">أو اختر الحكم:</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(SUITS).map(([suit, info]) => (
                    <Button
                      key={suit}
                      variant="outline"
                      className="h-12"
                      onClick={() => onChooseTrump("hokm", suit)}
                      data-testid={`button-choose-hokm-${suit}`}
                    >
                      <span className={`text-2xl ${info.color} mr-2`}>{info.symbol}</span>
                      {info.nameAr}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Pass option */}
              <Button
                variant="secondary"
                className="w-full"
                onClick={onPass}
                data-testid="button-baloot-pass"
              >
                باس
              </Button>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              انتظر اختيار اللاعب...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="relative w-full h-[550px] bg-emerald-800 rounded-xl p-4" data-testid="baloot-board">
      {/* Game info header */}
      <div className="absolute top-2 left-2 right-2 flex justify-between items-center z-20">
        <div className="flex gap-2">
          <Badge variant="outline" className="bg-background/80">
            نحن: {state.roundPoints.team1}
          </Badge>
          <Badge variant="outline" className="bg-background/80">
            هم: {state.roundPoints.team2}
          </Badge>
        </div>
        
        {state.gameType && (
          <Badge className={`bg-background/80 ${state.gameType === "sun" ? "text-yellow-500" : ""}`}>
            {state.gameType === "sun" ? (
              <>
                <Zap className="h-3 w-3 mr-1" />
                صن
              </>
            ) : (
              <>
                <span className={SUITS[state.trumpSuit as keyof typeof SUITS]?.color}>
                  {SUITS[state.trumpSuit as keyof typeof SUITS]?.symbol}
                </span>
                <span className="mr-1">حكم</span>
              </>
            )}
          </Badge>
        )}

        {state.doubleRound && (
          <Badge className="bg-red-600 animate-pulse">
            مضاعف!
          </Badge>
        )}
      </div>

      {/* Total scores */}
      <div className="absolute top-10 left-2 right-2 flex justify-center gap-4 z-20">
        <Badge className="bg-blue-600">مجموع نحن: {state.points.team1}</Badge>
        <Badge className="bg-red-600">مجموع هم: {state.points.team2}</Badge>
      </div>

      {/* Projects display */}
      {state.projects.length > 0 && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 flex gap-1 z-20">
          {state.projects.map((p, i) => (
            <Badge key={i} variant="secondary" className="text-xs">
              {p.project}: +{p.points}
            </Badge>
          ))}
        </div>
      )}

      {/* Opponent hands */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2">
        {renderOpponentHand("top", 8)}
      </div>
      <div className="absolute left-2 top-1/2 -translate-y-1/2">
        {renderOpponentHand("left", 8)}
      </div>
      <div className="absolute right-2 top-1/2 -translate-y-1/2">
        {renderOpponentHand("right", 8)}
      </div>

      {/* Current trick */}
      {state.phase === "playing" && renderTrick()}

      {/* My hand */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex" data-testid="baloot-my-hand">
        {myHand.map((card, i) => renderCard(card, isMyTurn && state.phase === "playing", i))}
      </div>

      {/* Play button */}
      {selectedCard && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2">
          <Button onClick={handlePlayCard} data-testid="button-baloot-play">
            العب
          </Button>
        </div>
      )}

      {/* Choosing phase overlay */}
      {state.phase === "choosing" && renderChoosingPhase()}

      {/* Game finished */}
      {state.phase === "finished" && state.winningTeam !== undefined && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-30">
          <Card className="w-80 text-center">
            <CardHeader>
              <CardTitle className="text-2xl">
                {state.winningTeam === (playerPosition % 2 === 0 ? 1 : 2) 
                  ? "🎉 فزتم!" 
                  : "😔 خسرتم"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold mb-2">
                {state.points.team1} - {state.points.team2}
              </p>
              <p className="text-sm text-muted-foreground">
                نقاط الجولة: {state.roundPoints.team1} - {state.roundPoints.team2}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Turn indicator */}
      {isMyTurn && state.phase === "playing" && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2">
          <Badge className="animate-pulse bg-primary">دورك!</Badge>
        </div>
      )}
    </div>
  );
}

export default BalootBoard;
