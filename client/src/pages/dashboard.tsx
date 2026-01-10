import { useQuery } from "@tanstack/react-query";
import { useAuth, useAuthHeaders } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, Gamepad2, DollarSign, AlertTriangle, 
  TrendingUp, TrendingDown, Activity, Clock,
  Wallet, Eye, EyeOff, ArrowUpRight, ArrowDownRight, Trophy, Gift
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface DashboardStats {
  totalUsers: number;
  totalAgents: number;
  totalAffiliates: number;
  totalGames: number;
  pendingTransactions: number;
  openComplaints: number;
  totalDeposits: number;
  totalWithdrawals: number;
  netRevenue: number;
}

function PlayerDashboard({ user, dir }: { user: any; dir: string }) {
  const { t } = useI18n();
  const [isBalanceHidden, setIsBalanceHidden] = useState(() => {
    return localStorage.getItem('hideBalance') === 'true';
  });

  const toggleBalanceVisibility = () => {
    const newValue = !isBalanceHidden;
    setIsBalanceHidden(newValue);
    localStorage.setItem('hideBalance', String(newValue));
  };

  const balance = parseFloat(user?.balance || "0");
  const totalDeposited = parseFloat(user?.totalDeposited || "0");
  const totalWithdrawn = parseFloat(user?.totalWithdrawn || "0");
  const totalWagered = parseFloat(user?.totalWagered || "0");
  const totalWon = parseFloat(user?.totalWon || "0");

  const quickActions = [
    { title: t('nav.wallet'), url: "/wallet", icon: Wallet, color: "bg-primary/10 text-primary" },
    { title: t('nav.playGames'), url: "/play", icon: Gamepad2, color: "bg-blue-500/10 text-blue-500" },
    { title: t('nav.challenges'), url: "/challenges", icon: Trophy, color: "bg-orange-500/10 text-orange-500" },
    { title: t('nav.free'), url: "/free", icon: Gift, color: "bg-purple-500/10 text-purple-500" },
  ];

  return (
    <div className="p-6 space-y-6" dir={dir}>
      <h1 className="text-2xl font-bold">{t('dashboard.welcome')}, {user?.username}</h1>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 text-[12px]">
          <CardTitle className="text-lg">{t('dashboard.accountSummary')}</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleBalanceVisibility}
            data-testid="button-toggle-dashboard-balance"
          >
            {isBalanceHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </CardHeader>
        <CardContent className="p-6 pt-0 space-y-4 text-[12px] font-medium">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('common.balance')}</span>
            <span className="text-3xl font-bold text-primary balance-glow" data-testid="text-dashboard-balance">
              {isBalanceHidden ? '******' : `$${balance.toFixed(2)}`}
            </span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-muted-foreground text-sm">
                <ArrowDownRight className="h-3 w-3 text-primary" />
                {t('dashboard.deposited')}
              </div>
              <p className="font-semibold" data-testid="text-total-deposited">
                {isBalanceHidden ? '***' : `$${totalDeposited.toFixed(2)}`}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-muted-foreground text-sm">
                <ArrowUpRight className="h-3 w-3 text-red-500" />
                {t('dashboard.withdrawn')}
              </div>
              <p className="font-semibold" data-testid="text-total-withdrawn">
                {isBalanceHidden ? '***' : `$${totalWithdrawn.toFixed(2)}`}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-muted-foreground text-sm">
                <Gamepad2 className="h-3 w-3 text-blue-500" />
                {t('dashboard.wagered')}
              </div>
              <p className="font-semibold" data-testid="text-total-wagered">
                {isBalanceHidden ? '***' : `$${totalWagered.toFixed(2)}`}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-muted-foreground text-sm">
                <Trophy className="h-3 w-3 text-orange-500" />
                {t('dashboard.won')}
              </div>
              <p className="font-semibold" data-testid="text-total-won">
                {isBalanceHidden ? '***' : `$${totalWon.toFixed(2)}`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickActions.map((action) => (
          <Link key={action.url} href={action.url}>
            <Card className="hover-elevate cursor-pointer">
              <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                <div className={`p-3 rounded-full ${action.color}`}>
                  <action.icon className="h-6 w-6" />
                </div>
                <span className="font-medium text-sm">{action.title}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const headers = useAuthHeaders();
  const { dir } = useI18n();
  
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/stats", { headers });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: user?.role === "admin",
  });

  if (user?.role !== "admin") {
    return <PlayerDashboard user={user} dir={dir} />;
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6" dir={dir}>
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Users",
      value: stats?.totalUsers || 0,
      icon: Users,
      color: "text-blue-500",
    },
    {
      title: "Active Games",
      value: stats?.totalGames || 0,
      icon: Gamepad2,
      color: "text-primary",
    },
    {
      title: "Total Agents",
      value: stats?.totalAgents || 0,
      icon: Activity,
      color: "text-purple-500",
    },
    {
      title: "Affiliates",
      value: stats?.totalAffiliates || 0,
      icon: TrendingUp,
      color: "text-orange-500",
    },
    {
      title: "Total Deposits",
      value: `$${(stats?.totalDeposits || 0).toLocaleString()}`,
      icon: DollarSign,
      color: "text-primary",
    },
    {
      title: "Total Withdrawals",
      value: `$${(stats?.totalWithdrawals || 0).toLocaleString()}`,
      icon: TrendingDown,
      color: "text-red-500",
    },
    {
      title: "Pending Transactions",
      value: stats?.pendingTransactions || 0,
      icon: Clock,
      color: "text-yellow-500",
      badge: stats?.pendingTransactions ? "Action Required" : null,
    },
    {
      title: "Open Complaints",
      value: stats?.openComplaints || 0,
      icon: AlertTriangle,
      color: "text-red-500",
      badge: stats?.openComplaints ? "Needs Attention" : null,
    },
  ];

  return (
    <div className="p-6 space-y-6" dir={dir}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <Badge variant="outline" className="text-primary border-primary">
          Net Revenue: ${(stats?.netRevenue || 0).toLocaleString()}
        </Badge>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title} data-testid={`card-stat-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              {stat.badge && (
                <Badge variant="destructive" className="mt-2 text-xs">
                  {stat.badge}
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
