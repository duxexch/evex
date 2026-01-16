import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { BackButton } from "@/components/BackButton";
import { ChessBoard } from "@/components/games/ChessBoard";
import { DominoBoard } from "@/components/games/DominoBoard";
import { GameChat } from "@/components/games/GameChat";
import { VoiceChat } from "@/components/games/VoiceChat";
import { SpectatorPanel } from "@/components/games/SpectatorPanel";
import { ShareMatchButton } from "@/components/games/ShareMatchButton";
import {
  Crown,
  Target,
  Clock,
  Trophy,
  MessageCircle,
  Mic,
  MicOff,
  Eye,
  Users,
  Gift,
  Star,
  Send,
  Share2,
  Flag,
  X,
  Check,
  Loader2,
  Volume2,
  VolumeX,
} from "lucide-react";

interface Player {
  id: string;
  username: string;
  avatarUrl?: string;
  vipLevel?: number;
  rating?: {
    wins: number;
    losses: number;
    winRate: number;
    rank: string;
  };
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
  totalGiftsValue: string;
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

const QUICK_MESSAGES = [
  { key: "good_luck", en: "Good luck!", ar: "حظاً موفقاً!" },
  { key: "nice_move", en: "Nice move!", ar: "حركة رائعة!" },
  { key: "gg", en: "GG!", ar: "لعبة جيدة!" },
  { key: "thanks", en: "Thanks!", ar: "شكراً!" },
  { key: "hurry", en: "Hurry up!", ar: "أسرع!" },
  { key: "rematch", en: "Rematch?", ar: "إعادة المباراة؟" },
];

export default function ChallengeGamePage() {
  const [, params] = useRoute("/challenge/:id/play");
  const [, setLocation] = useLocation();
  const { t, language } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const challengeId = params?.id;

  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [showResignDialog, setShowResignDialog] = useState(false);
  const [spectators, setSpectators] = useState<any[]>([]);
  const [receivedGifts, setReceivedGifts] = useState<any[]>([]);
  
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { data: challenge, isLoading } = useQuery<Challenge>({
    queryKey: ["/api/challenges", challengeId],
    enabled: !!challengeId,
  });

  const isPlayer = user && (challenge?.player1Id === user.id || challenge?.player2Id === user.id);
  const isSpectator = !isPlayer;
  const myColor = challenge?.player1Id === user?.id ? "white" : "black";

  useEffect(() => {
    if (!challengeId || !user) return;

    const token = localStorage.getItem("token");
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "auth", token }));
      ws.send(JSON.stringify({ 
        type: "join_challenge_game", 
        challengeId,
        isSpectator 
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    };

    ws.onclose = () => {
      console.log("WebSocket closed");
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "leave_challenge_game", challengeId }));
      }
      ws.close();
    };
  }, [challengeId, user, isSpectator]);

  const handleWebSocketMessage = useCallback((data: any) => {
    switch (data.type) {
      case "game_state_sync":
        setGameSession(data.session);
        break;
      case "game_move":
        setGameSession(prev => prev ? { ...prev, ...data.session } : null);
        break;
      case "chat_message":
        setMessages(prev => [...prev, data.message]);
        break;
      case "spectator_joined":
        setSpectators(prev => [...prev, data.spectator]);
        break;
      case "spectator_left":
        setSpectators(prev => prev.filter(s => s.id !== data.spectatorId));
        break;
      case "gift_received":
        setReceivedGifts(prev => [...prev, data.gift]);
        toast({
          title: language === "ar" ? "هدية جديدة!" : "New Gift!",
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

  const sendMove = useCallback((move: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "game_move",
        challengeId,
        move,
      }));
    }
  }, [challengeId]);

  const sendChatMessage = useCallback((message: string, isQuickMessage = false, quickMessageKey?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "challenge_chat",
        challengeId,
        message,
        isQuickMessage,
        quickMessageKey,
      }));
    }
    setMessageInput("");
  }, [challengeId]);

  const handleResign = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "game_resign",
        challengeId,
      }));
    }
    setShowResignDialog(false);
  }, [challengeId]);

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

  const opponent = challenge.player1Id === user?.id ? challenge.player2 : challenge.player1;
  const myTimeRemaining = challenge.player1Id === user?.id 
    ? gameSession?.player1TimeRemaining || challenge.timeLimit 
    : gameSession?.player2TimeRemaining || challenge.timeLimit;
  const opponentTimeRemaining = challenge.player1Id === user?.id 
    ? gameSession?.player2TimeRemaining || challenge.timeLimit 
    : gameSession?.player1TimeRemaining || challenge.timeLimit;

  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col lg:flex-row h-screen">
        <div className="flex-1 flex flex-col">
          <header className="flex items-center justify-between gap-4 p-3 border-b bg-card">
            <div className="flex items-center gap-3">
              <BackButton />
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
              
              {isPlayer && (
                <VoiceChat
                  challengeId={challengeId!}
                  isEnabled={isVoiceEnabled}
                  onToggle={() => setIsVoiceEnabled(!isVoiceEnabled)}
                  isMuted={isMuted}
                  onMuteToggle={() => setIsMuted(!isMuted)}
                />
              )}
            </div>
          </header>

          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            <div className="flex-1 p-4 flex flex-col items-center justify-center">
              <div className="w-full max-w-lg mb-4">
                <div className="flex items-center justify-between p-3 bg-card rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={opponent?.avatarUrl} />
                      <AvatarFallback>{opponent?.username?.[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{opponent?.username || "Waiting..."}</p>
                      {opponent?.rating && (
                        <p className="text-xs text-muted-foreground">
                          {opponent.rating.wins}W / {opponent.rating.losses}L
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className={`font-mono text-lg ${opponentTimeRemaining < 30 ? "text-destructive" : ""}`}>
                      {formatTime(opponentTimeRemaining)}
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
                    <div className="bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg">
                      <Gift className="h-6 w-6 inline-block me-2" />
                      {gift.giftName} from {gift.senderName}
                    </div>
                  </div>
                ))}
                
                {challenge.gameType === "chess" ? (
                  <ChessBoard
                    gameState={gameSession?.gameState}
                    currentTurn={gameSession?.currentTurn}
                    myColor={myColor}
                    isMyTurn={gameSession?.currentTurn === user?.id}
                    isSpectator={isSpectator}
                    onMove={sendMove}
                    status={gameSession?.status}
                  />
                ) : (
                  <DominoBoard
                    gameState={gameSession?.gameState}
                    currentTurn={gameSession?.currentTurn}
                    isMyTurn={gameSession?.currentTurn === user?.id}
                    isSpectator={isSpectator}
                    onMove={sendMove}
                    status={gameSession?.status}
                  />
                )}
              </div>

              <div className="w-full max-w-lg mt-4">
                <div className="flex items-center justify-between p-3 bg-card rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 ring-2 ring-primary">
                      <AvatarImage src={user?.profilePicture || undefined} />
                      <AvatarFallback>{user?.username?.[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{user?.username} (You)</p>
                      <p className="text-xs text-muted-foreground">
                        {myColor === "white" ? "⚪" : "⚫"} {myColor}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className={`font-mono text-lg ${myTimeRemaining < 30 ? "text-destructive" : ""}`}>
                      {formatTime(myTimeRemaining)}
                    </span>
                  </div>
                </div>
              </div>

              {isPlayer && gameSession?.status === "playing" && (
                <div className="mt-4">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowResignDialog(true)}
                    data-testid="button-resign"
                  >
                    <Flag className="h-4 w-4 me-2" />
                    {language === "ar" ? "استسلام" : "Resign"}
                  </Button>
                </div>
              )}
            </div>

            <div className="w-full lg:w-80 border-s flex flex-col bg-card">
              {isSpectator ? (
                <SpectatorPanel
                  challengeId={challengeId!}
                  player1={challenge.player1}
                  player2={challenge.player2}
                  spectatorCount={gameSession?.spectatorCount || 0}
                />
              ) : (
                <GameChat
                  messages={messages}
                  onSendMessage={sendChatMessage}
                  quickMessages={QUICK_MESSAGES}
                  language={language}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showResignDialog} onOpenChange={setShowResignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === "ar" ? "تأكيد الاستسلام" : "Confirm Resignation"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            {language === "ar" 
              ? "هل أنت متأكد من الاستسلام؟ ستخسر المباراة والتحدي."
              : "Are you sure you want to resign? You will lose the match and your stake."}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResignDialog(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button variant="destructive" onClick={handleResign}>
              {language === "ar" ? "استسلام" : "Resign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {gameSession?.status === "finished" && (
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-center">
                {gameSession.winnerId === user?.id ? (
                  <div className="flex flex-col items-center gap-2">
                    <Trophy className="h-12 w-12 text-yellow-500" />
                    <span className="text-2xl">
                      {language === "ar" ? "مبروك! فزت!" : "Congratulations! You Won!"}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <X className="h-12 w-12 text-destructive" />
                    <span className="text-2xl">
                      {language === "ar" ? "للأسف خسرت" : "You Lost"}
                    </span>
                  </div>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="text-center text-muted-foreground">
              <p>
                {gameSession.winReason === "checkmate" && (language === "ar" ? "كش مات!" : "Checkmate!")}
                {gameSession.winReason === "timeout" && (language === "ar" ? "انتهى الوقت" : "Time out")}
                {gameSession.winReason === "resignation" && (language === "ar" ? "استسلام" : "Resignation")}
                {gameSession.winReason === "domino_blocked" && (language === "ar" ? "اللعبة محظورة" : "Game blocked")}
              </p>
              {gameSession.winnerId === user?.id && (
                <p className="text-lg font-bold text-green-500 mt-2">
                  +${(parseFloat(challenge.betAmount) * 2 * 0.95).toFixed(2)}
                </p>
              )}
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setLocation("/challenges")}>
                {language === "ar" ? "العودة للتحديات" : "Back to Challenges"}
              </Button>
              <Button onClick={() => {
                setLocation("/challenges");
              }}>
                {language === "ar" ? "مباراة جديدة" : "New Match"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
