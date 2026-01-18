import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bot,
  Play,
  Square,
  RefreshCw,
  Settings,
  Users,
  Gamepad2,
  Trophy,
  Clock,
  Eye,
  Power,
  Pencil,
  UserCircle,
  Activity,
  Timer,
  DollarSign,
  StopCircle,
  Plus,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface BotAccount {
  id: string;
  nickname: string | null;
  username: string;
  email: string;
  profilePicture: string | null;
  isActive: boolean;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  winRate: number;
  isOnline: boolean;
  lastActiveAt: string | null;
  createdAt: string;
}

interface SimulatorConfig {
  isEnabled: boolean;
  enabledGameTypes: string[];
  minBetAmount: number;
  maxBetAmount: number;
  moveDelayMin: number;
  moveDelayMax: number;
  gameCreationIntervalMin: number;
  gameCreationIntervalMax: number;
  maxActiveGames: number;
  targetActiveGames: number;
}

interface SimulatorStatus {
  isRunning: boolean;
  activeGames: number;
  botCount: number;
  activeBotCount: number;
  config: SimulatorConfig;
}

interface ActiveGame {
  challengeId: string;
  gameType: string;
  players: string[];
  player1Name: string;
  player2Name: string;
  startTime: string;
  moveCount: number;
  duration: number;
}

const GAME_TYPES = [
  { key: "chess", nameEn: "Chess", nameAr: "شطرنج" },
  { key: "backgammon", nameEn: "Backgammon", nameAr: "طاولة" },
  { key: "domino", nameEn: "Domino", nameAr: "دومينو" },
];

export default function AdminBotManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("bots");
  const [editingBot, setEditingBot] = useState<BotAccount | null>(null);
  const [editNickname, setEditNickname] = useState("");
  const [showCreateGame, setShowCreateGame] = useState(false);
  const [newGameType, setNewGameType] = useState("chess");
  const [newGamePlayer1, setNewGamePlayer1] = useState("");
  const [newGamePlayer2, setNewGamePlayer2] = useState("");
  const [newGameBetAmount, setNewGameBetAmount] = useState("100");

  const { data: bots, isLoading: botsLoading, refetch: refetchBots } = useQuery<BotAccount[]>({
    queryKey: ["/api/admin/bots"],
  });

  const { data: simulatorStatus, isLoading: statusLoading, refetch: refetchStatus } = useQuery<SimulatorStatus>({
    queryKey: ["/api/admin/bot-simulator"],
    refetchInterval: 5000,
  });

  const { data: activeGames, isLoading: gamesLoading, refetch: refetchGames } = useQuery<ActiveGame[]>({
    queryKey: ["/api/admin/bot-simulator/games"],
    refetchInterval: 3000,
  });

  const toggleBotMutation = useMutation({
    mutationFn: async ({ botId, isActive }: { botId: string; isActive: boolean }) => {
      return apiRequest("POST", `/api/admin/bots/${botId}/toggle`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bots"] });
      toast({ title: "تم تحديث حالة البوت" });
    },
    onError: () => {
      toast({ title: "فشل تحديث الحالة", variant: "destructive" });
    },
  });

  const updateBotMutation = useMutation({
    mutationFn: async ({ botId, nickname }: { botId: string; nickname: string }) => {
      return apiRequest("PATCH", `/api/admin/bots/${botId}`, { nickname });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bots"] });
      setEditingBot(null);
      toast({ title: "تم تحديث البوت" });
    },
    onError: () => {
      toast({ title: "فشل التحديث", variant: "destructive" });
    },
  });

  const simulatorActionMutation = useMutation({
    mutationFn: async (action: "start" | "stop") => {
      return apiRequest("POST", "/api/admin/bot-simulator", { action });
    },
    onSuccess: (_, action) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bot-simulator"] });
      toast({ title: action === "start" ? "تم تشغيل المحاكي" : "تم إيقاف المحاكي" });
    },
    onError: () => {
      toast({ title: "فشل العملية", variant: "destructive" });
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (config: Partial<SimulatorConfig>) => {
      return apiRequest("PATCH", "/api/admin/bot-simulator/config", config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bot-simulator"] });
      toast({ title: "تم تحديث الإعدادات" });
    },
    onError: () => {
      toast({ title: "فشل التحديث", variant: "destructive" });
    },
  });

  const createGameMutation = useMutation({
    mutationFn: async (data: { gameType: string; player1Id?: string; player2Id?: string; betAmount: number }) => {
      return apiRequest("POST", "/api/admin/bot-simulator/games", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bot-simulator/games"] });
      setShowCreateGame(false);
      toast({ title: "تم إنشاء المباراة" });
    },
    onError: () => {
      toast({ title: "فشل إنشاء المباراة", variant: "destructive" });
    },
  });

  const endGameMutation = useMutation({
    mutationFn: async (challengeId: string) => {
      return apiRequest("POST", `/api/admin/bot-simulator/games/${challengeId}/end`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bot-simulator/games"] });
      toast({ title: "تم إنهاء المباراة" });
    },
    onError: () => {
      toast({ title: "فشل إنهاء المباراة", variant: "destructive" });
    },
  });

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getGameTypeName = (key: string) => {
    return GAME_TYPES.find(g => g.key === key)?.nameAr || key;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">إدارة البوتات والمباريات العشوائية</h1>
          <p className="text-muted-foreground">إدارة حسابات البوتات ومحاكي المباريات</p>
        </div>
        <div className="flex items-center gap-2">
          {simulatorStatus && (
            <Badge variant={simulatorStatus.isRunning ? "default" : "secondary"} className="gap-1">
              <Activity className="h-3 w-3" />
              {simulatorStatus.isRunning ? "يعمل" : "متوقف"}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchBots();
              refetchStatus();
              refetchGames();
            }}
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="bots" className="gap-1" data-testid="tab-bots">
            <Users className="h-4 w-4" />
            البوتات
          </TabsTrigger>
          <TabsTrigger value="simulator" className="gap-1" data-testid="tab-simulator">
            <Settings className="h-4 w-4" />
            المحاكي
          </TabsTrigger>
          <TabsTrigger value="games" className="gap-1" data-testid="tab-games">
            <Gamepad2 className="h-4 w-4" />
            المباريات
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bots" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                حسابات البوتات ({bots?.length || 0})
              </CardTitle>
              <CardDescription>
                إدارة حسابات البوتات الوهمية وإحصائياتها
              </CardDescription>
            </CardHeader>
            <CardContent>
              {botsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الحساب</TableHead>
                      <TableHead>الإحصائيات</TableHead>
                      <TableHead>نسبة الفوز</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bots?.map(bot => (
                      <TableRow key={bot.id} data-testid={`row-bot-${bot.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={bot.profilePicture || undefined} />
                              <AvatarFallback>
                                <Bot className="h-5 w-5" />
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{bot.nickname || bot.username}</div>
                              <div className="text-xs text-muted-foreground">{bot.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-green-500">{bot.gamesWon} فوز</span>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-red-500">{bot.gamesLost} خسارة</span>
                            <span className="text-muted-foreground">({bot.gamesPlayed} إجمالي)</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={bot.winRate >= 50 ? "default" : "secondary"}>
                            {bot.winRate}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${bot.isOnline ? "bg-green-500" : "bg-gray-400"}`} />
                            <span className="text-sm">{bot.isOnline ? "متصل" : "غير متصل"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={bot.isActive}
                              onCheckedChange={(checked) => 
                                toggleBotMutation.mutate({ botId: bot.id, isActive: checked })
                              }
                              data-testid={`switch-bot-active-${bot.id}`}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingBot(bot);
                                setEditNickname(bot.nickname || "");
                              }}
                              data-testid={`button-edit-bot-${bot.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => window.open(`/player/${bot.id}`, "_blank")}
                              data-testid={`button-view-bot-${bot.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="simulator" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Power className="h-5 w-5" />
                  التحكم بالمحاكي
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {statusLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : simulatorStatus ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 rounded-lg bg-muted">
                        <div className="text-2xl font-bold">{simulatorStatus.activeGames}</div>
                        <div className="text-sm text-muted-foreground">مباريات نشطة</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-muted">
                        <div className="text-2xl font-bold">{simulatorStatus.activeBotCount}/{simulatorStatus.botCount}</div>
                        <div className="text-sm text-muted-foreground">بوتات نشطة</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        variant={simulatorStatus.isRunning ? "destructive" : "default"}
                        onClick={() => simulatorActionMutation.mutate(simulatorStatus.isRunning ? "stop" : "start")}
                        disabled={simulatorActionMutation.isPending}
                        data-testid="button-toggle-simulator"
                      >
                        {simulatorStatus.isRunning ? (
                          <>
                            <Square className="h-4 w-4 mr-2" />
                            إيقاف المحاكي
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            تشغيل المحاكي
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  إعدادات المحاكي
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {simulatorStatus?.config && (
                  <>
                    <div className="space-y-2">
                      <Label>الألعاب المفعلة</Label>
                      <div className="flex flex-wrap gap-2">
                        {GAME_TYPES.map(game => (
                          <Badge
                            key={game.key}
                            variant={simulatorStatus.config.enabledGameTypes.includes(game.key) ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => {
                              const current = simulatorStatus.config.enabledGameTypes;
                              const newTypes = current.includes(game.key)
                                ? current.filter(g => g !== game.key)
                                : [...current, game.key];
                              if (newTypes.length > 0) {
                                updateConfigMutation.mutate({ enabledGameTypes: newTypes });
                              }
                            }}
                            data-testid={`badge-game-${game.key}`}
                          >
                            {game.nameAr}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>حدود مبلغ التحدي</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          placeholder="الحد الأدنى"
                          value={simulatorStatus.config.minBetAmount}
                          onChange={(e) => updateConfigMutation.mutate({ minBetAmount: parseInt(e.target.value) || 5 })}
                          className="w-24"
                          data-testid="input-min-bet"
                        />
                        <span>-</span>
                        <Input
                          type="number"
                          placeholder="الحد الأقصى"
                          value={simulatorStatus.config.maxBetAmount}
                          onChange={(e) => updateConfigMutation.mutate({ maxBetAmount: parseInt(e.target.value) || 1000 })}
                          className="w-24"
                          data-testid="input-max-bet"
                        />
                        <span className="text-sm text-muted-foreground">$</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>الحد الأقصى للمباريات النشطة</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[simulatorStatus.config.targetActiveGames]}
                          min={1}
                          max={20}
                          step={1}
                          onValueChange={(value) => updateConfigMutation.mutate({ targetActiveGames: value[0] })}
                          className="flex-1"
                          data-testid="slider-target-games"
                        />
                        <span className="w-8 text-center">{simulatorStatus.config.targetActiveGames}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>فترة إنشاء المباريات (ثانية)</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={Math.round(simulatorStatus.config.gameCreationIntervalMin / 1000)}
                          onChange={(e) => updateConfigMutation.mutate({ 
                            gameCreationIntervalMin: (parseInt(e.target.value) || 15) * 1000 
                          })}
                          className="w-20"
                          data-testid="input-interval-min"
                        />
                        <span>-</span>
                        <Input
                          type="number"
                          value={Math.round(simulatorStatus.config.gameCreationIntervalMax / 1000)}
                          onChange={(e) => updateConfigMutation.mutate({ 
                            gameCreationIntervalMax: (parseInt(e.target.value) || 30) * 1000 
                          })}
                          className="w-20"
                          data-testid="input-interval-max"
                        />
                        <span className="text-sm text-muted-foreground">ثانية</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="games" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Gamepad2 className="h-5 w-5" />
                    المباريات الجارية ({activeGames?.length || 0})
                  </CardTitle>
                  <CardDescription>
                    مراقبة وإدارة المباريات النشطة
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setShowCreateGame(true)}
                  data-testid="button-create-game"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  مباراة يدوية
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {gamesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : activeGames && activeGames.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>اللعبة</TableHead>
                      <TableHead>اللاعبين</TableHead>
                      <TableHead>الحركات</TableHead>
                      <TableHead>المدة</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeGames.map(game => (
                      <TableRow key={game.challengeId} data-testid={`row-game-${game.challengeId}`}>
                        <TableCell>
                          <Badge variant="outline">
                            {getGameTypeName(game.gameType)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{game.player1Name}</span>
                            <span className="text-muted-foreground">vs</span>
                            <span>{game.player2Name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{game.moveCount} حركة</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {formatDuration(game.duration)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => endGameMutation.mutate(game.challengeId)}
                            disabled={endGameMutation.isPending}
                            data-testid={`button-end-game-${game.challengeId}`}
                          >
                            <StopCircle className="h-4 w-4 mr-1" />
                            إنهاء
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Gamepad2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>لا توجد مباريات نشطة حالياً</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editingBot} onOpenChange={() => setEditingBot(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل البوت</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>الاسم المستعار</Label>
              <Input
                value={editNickname}
                onChange={(e) => setEditNickname(e.target.value)}
                placeholder="اسم البوت"
                data-testid="input-edit-nickname"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingBot(null)}>
              إلغاء
            </Button>
            <Button
              onClick={() => editingBot && updateBotMutation.mutate({ botId: editingBot.id, nickname: editNickname })}
              disabled={updateBotMutation.isPending}
              data-testid="button-save-bot"
            >
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateGame} onOpenChange={setShowCreateGame}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إنشاء مباراة يدوية</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>نوع اللعبة</Label>
              <Select value={newGameType} onValueChange={setNewGameType}>
                <SelectTrigger data-testid="select-game-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GAME_TYPES.map(game => (
                    <SelectItem key={game.key} value={game.key}>
                      {game.nameAr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>اللاعب الأول (اختياري)</Label>
              <Select value={newGamePlayer1} onValueChange={setNewGamePlayer1}>
                <SelectTrigger data-testid="select-player1">
                  <SelectValue placeholder="عشوائي" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">عشوائي</SelectItem>
                  {bots?.filter(b => b.isActive).map(bot => (
                    <SelectItem key={bot.id} value={bot.id}>
                      {bot.nickname || bot.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>اللاعب الثاني (اختياري)</Label>
              <Select value={newGamePlayer2} onValueChange={setNewGamePlayer2}>
                <SelectTrigger data-testid="select-player2">
                  <SelectValue placeholder="عشوائي" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">عشوائي</SelectItem>
                  {bots?.filter(b => b.isActive && b.id !== newGamePlayer1).map(bot => (
                    <SelectItem key={bot.id} value={bot.id}>
                      {bot.nickname || bot.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>مبلغ التحدي ($)</Label>
              <Input
                type="number"
                value={newGameBetAmount}
                onChange={(e) => setNewGameBetAmount(e.target.value)}
                placeholder="100"
                data-testid="input-bet-amount"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateGame(false)}>
              إلغاء
            </Button>
            <Button
              onClick={() => createGameMutation.mutate({
                gameType: newGameType,
                player1Id: newGamePlayer1 || undefined,
                player2Id: newGamePlayer2 || undefined,
                betAmount: parseInt(newGameBetAmount) || 100,
              })}
              disabled={createGameMutation.isPending}
              data-testid="button-create-game-submit"
            >
              إنشاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
