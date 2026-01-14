import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { BackButton } from "@/components/BackButton";
import { ChessBoard } from "@/components/games/ChessBoard";
import { DominoBoard } from "@/components/games/DominoBoard";
import { SpectatorPanel } from "@/components/games/SpectatorPanel";
import { ShareMatchButton } from "@/components/games/ShareMatchButton";
import {
  Crown,
  Target,
  Clock,
  Trophy,
  Eye,
  Loader2,
  X,
} from "lucide-react";

interface Player {
  id: string;
  username: string;
  avatarUrl?: string;
  vipLevel?: number;
}

interface GameSession {
  id: string;
  challengeId: string;
  gameType: "chess" | "domino";
  currentTurn: string;
  player1TimeRemaining: number;
  player2TimeRemaining: number;
  gameState: string;
  status: "waiting" | "playing" | "paused" | "finished";
  winnerId?: string;
  winReason?: string;
  totalMoves: number;
  spectatorCount: number;
}

interface Challenge {
  id: string;
  gameType: string;
  betAmount: string;
  visibility: "public" | "private";
  status: string;
  player1Id: string;
  player2Id?: string;
  player1?: Player;
  player2?: Player;
  timeLimit: number;
}

export default function ChallengeWatchPage() {
  const [, params] = useRoute("/challenge/:id/watch");
  const [, setLocation] = useLocation();
  const { t, language } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const challengeId = params?.id;

  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [receivedGifts, setReceivedGifts] = useState<any[]>([]);
  
  const wsRef = useRef<WebSocket | null>(null);

  const { data: challenge, isLoading } = useQuery<Challenge>({
    queryKey: ["/api/challenges", challengeId],
    enabled: !!challengeId,
  });

  useEffect(() => {
    if (!challengeId) return;

    const token = localStorage.getItem("token");
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (token) {
        ws.send(JSON.stringify({ type: "auth", token }));
      }
      ws.send(JSON.stringify({ 
        type: "join_challenge_game", 
        challengeId,
        isSpectator: true 
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "leave_challenge_game", challengeId }));
      }
      ws.close();
    };
  }, [challengeId]);

  const handleWebSocketMessage = useCallback((data: any) => {
    switch (data.type) {
      case "game_state_sync":
        setGameSession(data.session);
        break;
      case "game_move":
        setGameSession(prev => prev ? { ...prev, ...data.session } : null);
        break;
      case "gift_received":
        setReceivedGifts(prev => [...prev, data.gift]);
        toast({
          title: language === "ar" ? "هدية!" : "Gift!",
          description: `${data.gift.senderName} sent ${data.gift.giftName}`,
        });
        setTimeout(() => {
          setReceivedGifts(prev => prev.filter(g => g.id !== data.gift.id));
        }, 3000);
        break;
      case "game_ended":
        setGameSession(prev => prev ? { ...prev, status: "finished", winnerId: data.winnerId, winReason: data.reason } : null);
        break;
      case "spectator_count":
        setGameSession(prev => prev ? { ...prev, spectatorCount: data.count } : null);
        break;
    }
  }, [language, toast]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6 text-center">
            <p>{language === "ar" ? "التحدي غير موجود" : "Challenge not found"}</p>
            <Button className="mt-4" onClick={() => setLocation("/challenges")}>
              {language === "ar" ? "العودة للتحديات" : "Back to Challenges"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col lg:flex-row h-screen">
        <div className="flex-1 flex flex-col">
          <header className="flex items-center justify-between gap-4 p-3 border-b bg-card">
            <div className="flex items-center gap-3">
              <BackButton />
              <Badge variant="outline" className="gap-1">
                <Eye className="h-3 w-3" />
                {language === "ar" ? "مشاهدة" : "Watching"}
              </Badge>
              <div className="flex items-center gap-2">
                {challenge.gameType === "chess" ? (
                  <Crown className="h-5 w-5 text-primary" />
                ) : (
                  <Target className="h-5 w-5 text-primary" />
                )}
                <span className="font-semibold">
                  {challenge.gameType === "chess" 
                    ? (language === "ar" ? "الشطرنج" : "Chess")
                    : (language === "ar" ? "الدومينو" : "Domino")}
                </span>
              </div>
              <Badge variant="secondary">
                ${parseFloat(challenge.betAmount).toFixed(2)}
              </Badge>
            </div>
            
            <div className="flex items-center gap-2">
              <ShareMatchButton challengeId={challengeId!} gameType={challenge.gameType} />
              
              <div className="flex items-center gap-1 text-muted-foreground">
                <Eye className="h-4 w-4" />
                <span className="text-sm">{gameSession?.spectatorCount || 0}</span>
              </div>
            </div>
          </header>

          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            <div className="flex-1 p-4 flex flex-col items-center justify-center">
              <div className="w-full max-w-lg mb-4">
                <div className="flex items-center justify-between p-3 bg-card rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={challenge.player1?.avatarUrl} />
                      <AvatarFallback>{challenge.player1?.username?.[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{challenge.player1?.username || "Player 1"}</p>
                      <p className="text-xs text-muted-foreground">
                        {challenge.gameType === "chess" ? "⚪ White" : "Player 1"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className={`font-mono text-lg ${(gameSession?.player1TimeRemaining || 0) < 30 ? "text-destructive" : ""}`}>
                      {formatTime(gameSession?.player1TimeRemaining || challenge.timeLimit)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="relative">
                {receivedGifts.map((gift) => (
                  <div
                    key={gift.id}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none z-50 animate-bounce"
                  >
                    <div className="bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg shadow-lg">
                      {gift.giftName} from {gift.senderName}
                    </div>
                  </div>
                ))}
                
                {challenge.gameType === "chess" ? (
                  <ChessBoard
                    gameState={gameSession?.gameState}
                    currentTurn={gameSession?.currentTurn}
                    myColor="white"
                    isMyTurn={false}
                    isSpectator={true}
                    onMove={() => {}}
                    status={gameSession?.status}
                  />
                ) : (
                  <DominoBoard
                    gameState={gameSession?.gameState}
                    currentTurn={gameSession?.currentTurn}
                    isMyTurn={false}
                    isSpectator={true}
                    onMove={() => {}}
                    status={gameSession?.status}
                  />
                )}
              </div>

              <div className="w-full max-w-lg mt-4">
                <div className="flex items-center justify-between p-3 bg-card rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={challenge.player2?.avatarUrl} />
                      <AvatarFallback>{challenge.player2?.username?.[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{challenge.player2?.username || "Waiting..."}</p>
                      <p className="text-xs text-muted-foreground">
                        {challenge.gameType === "chess" ? "⚫ Black" : "Player 2"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className={`font-mono text-lg ${(gameSession?.player2TimeRemaining || 0) < 30 ? "text-destructive" : ""}`}>
                      {formatTime(gameSession?.player2TimeRemaining || challenge.timeLimit)}
                    </span>
                  </div>
                </div>
              </div>

              {!user && (
                <div className="mt-4">
                  <Button onClick={() => setLocation("/")}>
                    {language === "ar" ? "سجل دخول للمشاركة" : "Login to participate"}
                  </Button>
                </div>
              )}
            </div>

            <div className="w-full lg:w-80 border-s flex flex-col bg-card">
              <SpectatorPanel
                challengeId={challengeId!}
                player1={challenge.player1}
                player2={challenge.player2}
                spectatorCount={gameSession?.spectatorCount || 0}
              />
            </div>
          </div>
        </div>
      </div>

      {gameSession?.status === "finished" && (
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-center">
                <div className="flex flex-col items-center gap-2">
                  <Trophy className="h-12 w-12 text-yellow-500" />
                  <span className="text-2xl">
                    {language === "ar" ? "انتهت المباراة!" : "Match Ended!"}
                  </span>
                </div>
              </DialogTitle>
            </DialogHeader>
            <div className="text-center text-muted-foreground">
              <p className="text-lg font-medium">
                {language === "ar" ? "الفائز:" : "Winner:"}{" "}
                {gameSession.winnerId === challenge.player1Id 
                  ? challenge.player1?.username 
                  : challenge.player2?.username}
              </p>
              <p className="mt-2">
                {gameSession.winReason === "checkmate" && (language === "ar" ? "كش مات!" : "Checkmate!")}
                {gameSession.winReason === "timeout" && (language === "ar" ? "انتهى الوقت" : "Time out")}
                {gameSession.winReason === "resignation" && (language === "ar" ? "استسلام" : "Resignation")}
                {gameSession.winReason === "domino_blocked" && (language === "ar" ? "اللعبة محظورة" : "Game blocked")}
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => setLocation("/challenges")}>
                {language === "ar" ? "العودة للتحديات" : "Back to Challenges"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
