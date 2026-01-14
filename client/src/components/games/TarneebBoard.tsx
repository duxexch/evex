import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Trophy, RotateCcw } from "lucide-react";

interface TarneebBoardProps {
  sessionId: string;
  gameState: TarneebState | null;
  playerId: string;
  playerPosition: number; // 0, 1, 2, 3 (0 and 2 are team, 1 and 3 are opponents)
  onPlayCard: (card: PlayingCard) => void;
  onBid: (bid: number) => void;
  onPass: () => void;
}

interface PlayingCard {
  suit: "hearts" | "diamonds" | "clubs" | "spades";
  rank: string; // 2-10, J, Q, K, A
  value: number;
}

interface TarneebState {
  phase: "bidding" | "playing" | "finished";
  hands: { [playerId: string]: PlayingCard[] };
  currentTrick: { playerId: string; card: PlayingCard }[];
  trumpSuit: "hearts" | "diamonds" | "clubs" | "spades" | null;
  currentPlayer: string;
  bids: { playerId: string; bid: number }[];
  highestBid: { playerId: string; bid: number } | null;
  tricksWon: { team1: number; team2: number };
  scores: { team1: number; team2: number };
  dealerId: string;
  winningTeam?: number;
}

const SUITS = {
  hearts: { symbol: "♥", color: "text-red-500", name: "كبة" },
  diamonds: { symbol: "♦", color: "text-red-500", name: "ديناري" },
  clubs: { symbol: "♣", color: "text-foreground", name: "سباتي" },
  spades: { symbol: "♠", color: "text-foreground", name: "بستوني" }
};

const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

export function TarneebBoard({
  sessionId,
  gameState,
  playerId,
  playerPosition,
  onPlayCard,
  onBid,
  onPass
}: TarneebBoardProps) {
  const [selectedCard, setSelectedCard] = useState<PlayingCard | null>(null);
  const [showBidOptions, setShowBidOptions] = useState(false);

  const state = gameState || {
    phase: "bidding" as const,
    hands: {},
    currentTrick: [],
    trumpSuit: null,
    currentPlayer: "",
    bids: [],
    highestBid: null,
    tricksWon: { team1: 0, team2: 0 },
    scores: { team1: 0, team2: 0 },
    dealerId: ""
  };

  const myHand = state.hands[playerId] || [];
  const isMyTurn = state.currentPlayer === playerId;

  const handleCardClick = (card: PlayingCard) => {
    if (!isMyTurn || state.phase !== "playing") return;
    
    // Check if card is valid to play
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
    return true;
  };

  const renderCard = (card: PlayingCard, isPlayable: boolean, index: number) => {
    const suit = SUITS[card.suit];
    const isSelected = selectedCard?.suit === card.suit && selectedCard?.rank === card.rank;

    return (
      <div
        key={`${card.suit}-${card.rank}`}
        data-testid={`card-${card.suit}-${card.rank}`}
        onClick={() => isPlayable && handleCardClick(card)}
        className={`
          relative w-16 h-24 bg-white rounded-lg border-2 shadow-md
          flex flex-col items-center justify-between p-1
          transition-all duration-200
          ${isPlayable ? "cursor-pointer hover:-translate-y-2" : "opacity-70"}
          ${isSelected ? "ring-2 ring-primary -translate-y-4" : ""}
          ${!isPlayable ? "cursor-not-allowed" : ""}
        `}
        style={{ marginLeft: index > 0 ? "-30px" : "0" }}
      >
        <div className={`text-sm font-bold ${suit.color}`}>
          {card.rank}
        </div>
        <div className={`text-3xl ${suit.color}`}>
          {suit.symbol}
        </div>
        <div className={`text-sm font-bold ${suit.color} rotate-180`}>
          {card.rank}
        </div>
      </div>
    );
  };

  const renderOpponentHand = (position: "top" | "left" | "right", cardCount: number) => {
    const isVertical = position === "left" || position === "right";
    
    return (
      <div 
        className={`flex ${isVertical ? "flex-col" : ""} items-center`}
        data-testid={`opponent-hand-${position}`}
      >
        {Array.from({ length: cardCount }).map((_, i) => (
          <div
            key={i}
            className={`
              w-12 h-16 bg-gradient-to-br from-blue-900 to-blue-700
              rounded-lg border-2 border-blue-800 shadow-md
              ${isVertical ? "mt-[-30px]" : "ml-[-30px]"}
            `}
            style={i === 0 ? { marginLeft: 0, marginTop: 0 } : {}}
          />
        ))}
      </div>
    );
  };

  const renderTrick = () => (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="relative w-32 h-32">
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
              className="absolute w-14 h-20 bg-white rounded-lg border shadow-lg flex flex-col items-center justify-center"
              style={pos as any}
            >
              <span className={`text-lg font-bold ${suit.color}`}>
                {play.card.rank}
              </span>
              <span className={`text-2xl ${suit.color}`}>
                {suit.symbol}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderBiddingPhase = () => (
    <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10">
      <Card className="w-80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            مرحلة المزايدة
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Current bids */}
          <div className="mb-4 space-y-2">
            {state.bids.map((bid, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span>لاعب {i + 1}</span>
                <Badge>{bid.bid > 0 ? bid.bid : "باس"}</Badge>
              </div>
            ))}
          </div>

          {/* Highest bid */}
          {state.highestBid && (
            <div className="mb-4 p-2 bg-primary/10 rounded-lg text-center">
              أعلى مزايدة: <strong>{state.highestBid.bid}</strong>
            </div>
          )}

          {/* Bid options */}
          {isMyTurn && (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2">
                {[7, 8, 9, 10, 11, 12, 13].map(bid => (
                  <Button
                    key={bid}
                    variant="outline"
                    size="sm"
                    disabled={!!(state.highestBid && bid <= state.highestBid.bid)}
                    onClick={() => onBid(bid)}
                    data-testid={`button-bid-${bid}`}
                  >
                    {bid}
                  </Button>
                ))}
              </div>
              <Button
                variant="secondary"
                className="w-full"
                onClick={onPass}
                data-testid="button-pass"
              >
                باس
              </Button>
            </div>
          )}

          {!isMyTurn && (
            <p className="text-center text-muted-foreground">
              انتظر دورك في المزايدة...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="relative w-full h-[600px] bg-green-800 rounded-xl p-4" data-testid="tarneeb-board">
      {/* Game info */}
      <div className="absolute top-2 left-2 right-2 flex justify-between items-center z-20">
        <div className="flex gap-2">
          <Badge variant="outline" className="bg-background/80">
            فريق 1: {state.tricksWon.team1} لفات
          </Badge>
          <Badge variant="outline" className="bg-background/80">
            فريق 2: {state.tricksWon.team2} لفات
          </Badge>
        </div>
        {state.trumpSuit && (
          <Badge className="bg-background/80">
            الحكم: {SUITS[state.trumpSuit].symbol} {SUITS[state.trumpSuit].name}
          </Badge>
        )}
      </div>

      {/* Scores */}
      <div className="absolute top-2 right-2 flex gap-2 z-20">
        <Badge className="bg-blue-600">فريقك: {state.scores.team1}</Badge>
        <Badge className="bg-red-600">الخصم: {state.scores.team2}</Badge>
      </div>

      {/* Opponent hands */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2">
        {renderOpponentHand("top", 13 - Math.floor(state.currentTrick.length / 4))}
      </div>
      <div className="absolute left-4 top-1/2 -translate-y-1/2">
        {renderOpponentHand("left", 13 - Math.floor(state.currentTrick.length / 4))}
      </div>
      <div className="absolute right-4 top-1/2 -translate-y-1/2">
        {renderOpponentHand("right", 13 - Math.floor(state.currentTrick.length / 4))}
      </div>

      {/* Current trick */}
      {state.phase === "playing" && renderTrick()}

      {/* My hand */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex" data-testid="my-hand">
        {myHand.map((card, i) => renderCard(card, isMyTurn && state.phase === "playing", i))}
      </div>

      {/* Play button */}
      {selectedCard && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2">
          <Button onClick={handlePlayCard} data-testid="button-play-card">
            العب الورقة
          </Button>
        </div>
      )}

      {/* Bidding phase overlay */}
      {state.phase === "bidding" && renderBiddingPhase()}

      {/* Game finished */}
      {state.phase === "finished" && state.winningTeam !== undefined && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-30">
          <Card className="w-80 text-center">
            <CardHeader>
              <CardTitle>
                {state.winningTeam === (playerPosition % 2 === 0 ? 1 : 2) 
                  ? "🎉 فريقك فاز!" 
                  : "😔 فريقك خسر"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold">
                {state.scores.team1} - {state.scores.team2}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Turn indicator */}
      {isMyTurn && state.phase === "playing" && (
        <div className="absolute bottom-36 left-1/2 -translate-x-1/2">
          <Badge className="animate-pulse bg-primary">دورك!</Badge>
        </div>
      )}
    </div>
  );
}

export default TarneebBoard;
