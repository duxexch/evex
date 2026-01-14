import { Switch, Route, useLocation, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { I18nProvider, LanguageSwitcher, useI18n } from "@/lib/i18n";
import { SettingsProvider, useSettings } from "@/lib/settings";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Gamepad2,
  Play,
  DollarSign,
  AlertTriangle,
  Settings,
  LogOut,
  Wallet,
  ArrowLeftRight,
  Megaphone,
  Gift,
  Swords,
  Home,
  Eye,
  EyeOff,
  Headset,
  Users,
  MessageCircle,
  Loader2,
} from "lucide-react";
import { apiRequest } from "./lib/queryClient";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeProvider } from "@/lib/theme";
import { ThemeToggle } from "@/components/ThemeToggle";
import { prefetchPage } from "@/components/PrefetchLink";

import NotFound from "@/pages/not-found";
import AdminLayout from "@/pages/admin/admin-layout";

const LoginPage = lazy(() => import("@/pages/login"));
const DashboardPage = lazy(() => import("@/pages/dashboard"));
const GamesPage = lazy(() => import("@/pages/games"));
const PlayPage = lazy(() => import("@/pages/play"));
const TransactionsPage = lazy(() => import("@/pages/transactions"));
const ComplaintsPage = lazy(() => import("@/pages/complaints"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const P2PPage = lazy(() => import("@/pages/p2p"));
const AdminAnnouncementsPage = lazy(() => import("@/pages/admin/announcements"));
const FreePage = lazy(() => import("@/pages/free"));
const ChallengesPage = lazy(() => import("@/pages/challenges"));
const P2PProfilePage = lazy(() => import("@/pages/p2p-profile"));
const P2PSettingsPage = lazy(() => import("@/pages/p2p-settings"));
const WalletPage = lazy(() => import("@/pages/wallet"));
const FriendsPage = lazy(() => import("@/pages/friends"));
const MultiplayerPage = lazy(() => import("@/pages/multiplayer"));
const SupportPage = lazy(() => import("@/pages/support"));
const ChatPage = lazy(() => import("@/pages/chat"));
const ChallengeGamePage = lazy(() => import("@/pages/challenge-game"));
const ChallengeWatchPage = lazy(() => import("@/pages/challenge-watch"));

const AdminLoginPage = lazy(() => import("@/pages/admin/admin-login"));
const AdminDashboardPage = lazy(() => import("@/pages/admin/admin-dashboard"));
const AdminUsersPage = lazy(() => import("@/pages/admin/admin-users"));
const AdminP2PPage = lazy(() => import("@/pages/admin/admin-p2p"));
const AdminSectionsPage = lazy(() => import("@/pages/admin/admin-sections"));
const AdminAntiCheatPage = lazy(() => import("@/pages/admin/admin-anti-cheat"));
const AdminAnalyticsPage = lazy(() => import("@/pages/admin/admin-analytics"));
const AdminDisputesPage = lazy(() => import("@/pages/admin/admin-disputes"));
const AdminSupportPage = lazy(() => import("@/pages/admin/admin-support"));
const AdminAppSettingsPage = lazy(() => import("@/pages/admin/admin-app-settings"));
const AdminLanguagesPage = lazy(() => import("@/pages/admin/admin-languages"));
const AdminBadgesPage = lazy(() => import("@/pages/admin/admin-badges"));
const AdminNotificationsPage = lazy(() => import("@/pages/admin/admin-notifications"));
const AdminGamesPage = lazy(() => import("@/pages/admin/admin-games"));
const AdminIdVerificationPage = lazy(() => import("@/pages/admin/admin-id-verification"));
const AdminSeoPage = lazy(() => import("@/pages/admin/admin-seo"));
const AdminPaymentMethodsPage = lazy(() => import("@/pages/admin/admin-payment-methods"));
const AdminIntegrationsPage = lazy(() => import("@/pages/admin/admin-integrations"));
const AdminSocialPlatformsPage = lazy(() => import("@/pages/admin/admin-social-platforms"));
const AdminAdvertisementsPage = lazy(() => import("@/pages/admin/admin-advertisements"));
const AdminGameSectionsPage = lazy(() => import("@/pages/admin/admin-game-sections"));

function PageLoader() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    </div>
  );
}

function SidebarBalanceDisplay({ user, logout, t }: { user: any; logout: () => void; t: (key: string) => string }) {
  const [isHidden, setIsHidden] = useState(() => {
    return localStorage.getItem('hideBalance') === 'true';
  });
  
  const toggleHideBalance = () => {
    const newValue = !isHidden;
    setIsHidden(newValue);
    localStorage.setItem('hideBalance', String(newValue));
  };
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{t('common.balance')}</span>
        <div className="flex items-center gap-1">
          <span className="font-bold text-primary balance-glow" data-testid="text-balance">
            {isHidden ? '******' : `$${parseFloat(user?.balance || "0").toFixed(2)}`}
          </span>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6" 
            onClick={toggleHideBalance}
            data-testid="button-sidebar-toggle-balance"
          >
            {isHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </Button>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        @{user?.username}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start"
        onClick={logout}
        data-testid="button-logout"
      >
        <LogOut className="me-2 h-4 w-4" />
        {t('common.signOut')}
      </Button>
    </div>
  );
}

function AppSidebar({ side }: { side: "left" | "right" }) {
  const { user, logout } = useAuth();
  const { t, language } = useI18n();
  const { isSectionEnabled } = useSettings();
  const [location, setLocation] = useLocation();
  const { setOpenMobile, isMobile } = useSidebar();

  const handleNavClick = (url: string) => {
    if (isMobile) {
      setOpenMobile(false);
    }
    setLocation(url);
  };

  const playerMenuItems = [
    { title: t('nav.dashboard'), url: "/", icon: LayoutDashboard, key: "dashboard" },
    { title: t('nav.wallet'), url: "/wallet", icon: Wallet, key: "wallet" },
    { title: t('nav.multiplayer'), url: "/multiplayer", icon: Gamepad2, key: "multiplayer" },
    { title: t('nav.challenges'), url: "/challenges", icon: Swords, key: "challenges" },
    { title: t('nav.playGames'), url: "/play", icon: Play, key: "play" },
    { title: t('nav.friends'), url: "/friends", icon: Users, key: "friends" },
    { title: t('nav.chat'), url: "/chat", icon: MessageCircle, key: "chat" },
    { title: t('nav.p2p'), url: "/p2p", icon: ArrowLeftRight, key: "p2p" },
    { title: t('nav.free'), url: "/free", icon: Gift, key: "free" },
    { title: t('nav.transactions'), url: "/transactions", icon: DollarSign, key: "transactions" },
    { title: t('nav.complaints'), url: "/complaints", icon: AlertTriangle, key: "complaints" },
    { title: t('nav.support'), url: "/support", icon: Headset, key: "support" },
    { title: t('nav.settings'), url: "/settings", icon: Settings, key: "settings" },
  ];

  const adminMenuItems = [
    { title: t('nav.dashboard'), url: "/", icon: LayoutDashboard, key: "dashboard" },
    { title: t('nav.wallet'), url: "/wallet", icon: Wallet, key: "wallet" },
    { title: t('nav.multiplayer'), url: "/multiplayer", icon: Gamepad2, key: "multiplayer" },
    { title: t('nav.gameManagement'), url: "/games", icon: Gamepad2, key: "game-management" },
    { title: t('nav.announcements'), url: "/admin/announcements", icon: Megaphone, key: "announcements" },
    { title: t('nav.challenges'), url: "/challenges", icon: Swords, key: "challenges" },
    { title: t('nav.playGames'), url: "/play", icon: Play, key: "play" },
    { title: t('nav.friends'), url: "/friends", icon: Users, key: "friends" },
    { title: t('nav.chat'), url: "/chat", icon: MessageCircle, key: "chat" },
    { title: t('nav.p2p'), url: "/p2p", icon: ArrowLeftRight, key: "p2p" },
    { title: t('nav.free'), url: "/free", icon: Gift, key: "free" },
    { title: t('nav.transactions'), url: "/transactions", icon: DollarSign, key: "transactions" },
    { title: t('nav.complaints'), url: "/complaints", icon: AlertTriangle, key: "complaints" },
    { title: t('nav.support'), url: "/support", icon: Headset, key: "support" },
    { title: t('nav.settings'), url: "/settings", icon: Settings, key: "settings" },
  ];

  const baseItems = user?.role === "admin" ? adminMenuItems : playerMenuItems;
  const menuItems = baseItems.filter(item => isSectionEnabled(item.key));

  return (
    <Sidebar side={side}>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <Gamepad2 className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-bold text-lg">VEX</h2>
            <p className="text-xs text-muted-foreground capitalize">{user?.role || "Player"}</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton 
                    isActive={location === item.url}
                    onClick={() => handleNavClick(item.url)}
                    onMouseEnter={() => prefetchPage(item.url)}
                    data-testid={`link-${item.key}`}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <SidebarBalanceDisplay user={user} logout={logout} t={t} />
      </SidebarFooter>
    </Sidebar>
  );
}

function BalanceBar() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [isHidden, setIsHidden] = useState(() => {
    return localStorage.getItem('hideBalance') === 'true';
  });
  
  const toggleHideBalance = () => {
    const newValue = !isHidden;
    setIsHidden(newValue);
    localStorage.setItem('hideBalance', String(newValue));
  };
  
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-card rounded-lg border text-[13px] font-extrabold">
      <Wallet className="h-4 w-4 text-primary" />
      <span className="text-sm text-muted-foreground">{t('common.balance')}:</span>
      <span className="font-bold text-primary" data-testid="text-header-balance">
        {isHidden ? '******' : `$${parseFloat(user?.balance || "0").toFixed(2)}`}
      </span>
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-6 w-6" 
        onClick={toggleHideBalance}
        data-testid="button-toggle-balance"
      >
        {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
      <Link href="/wallet">
        <Button size="sm" data-testid="button-quick-deposit">
          {t('common.deposit')}
        </Button>
      </Link>
    </div>
  );
}

function BottomNavigation({ onChatToggle, isChatOpen }: { onChatToggle: () => void; isChatOpen: boolean }) {
  const { t, language } = useI18n();
  const [location, setLocation] = useLocation();
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const navItems = [
    { title: "P2P", url: "/p2p", icon: ArrowLeftRight, key: "p2p" },
    { title: "Main", url: "/", icon: Home, key: "main" },
    { title: "Games", url: "/play", icon: Play, key: "play" },
    { title: "Challenges", url: "/challenges", icon: Swords, key: "challenges" },
    { title: "Free", url: "/free", icon: Gift, key: "free" },
  ];

  const navigateToIndex = (direction: 'left' | 'right') => {
    const currentIndex = navItems.findIndex(item => item.url === location);
    if (currentIndex === -1) return;
    
    let newIndex: number;
    const isRTL = language === 'ar';
    
    if ((direction === 'right' && !isRTL) || (direction === 'left' && isRTL)) {
      newIndex = currentIndex < navItems.length - 1 ? currentIndex + 1 : 0;
    } else {
      newIndex = currentIndex > 0 ? currentIndex - 1 : navItems.length - 1;
    }
    
    setLocation(navItems[newIndex].url);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        navigateToIndex(e.key === 'ArrowRight' ? 'right' : 'left');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [location, setLocation, language]);

  useEffect(() => {
    const minSwipeDistance = 400;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchEndX.current = null;
    };

    const handleTouchMove = (e: TouchEvent) => {
      touchEndX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = () => {
      if (!touchStartX.current || !touchEndX.current) return;
      
      const distance = touchStartX.current - touchEndX.current;
      const isSwipe = Math.abs(distance) > minSwipeDistance;
      
      if (isSwipe) {
        if (distance > 0) {
          navigateToIndex('right');
        } else {
          navigateToIndex('left');
        }
      }
      
      touchStartX.current = null;
      touchEndX.current = null;
    };

    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [location, setLocation, language]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 flex items-center justify-around gap-1 p-2 border-t bg-background md:hidden z-50">
      {navItems.map((item) => (
        <Link key={item.key} href={item.url}>
          <Button
            variant={location === item.url ? "default" : "ghost"}
            size="icon"
            data-testid={`nav-${item.key}`}
          >
            <item.icon className="w-5 h-5" />
          </Button>
        </Link>
      ))}
      <Button
        variant={isChatOpen ? "default" : "ghost"}
        size="icon"
        onClick={onChatToggle}
        data-testid="nav-chat"
      >
        <MessageCircle className="w-5 h-5" />
      </Button>
    </nav>
  );
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { t, language, dir } = useI18n();
  const sidebarSide = language === 'ar' ? 'right' : 'left';
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "4rem",
  };

  const toggleChat = () => {
    setIsChatOpen(!isChatOpen);
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full" dir={dir}>
        <AppSidebar side={sidebarSide} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 p-3 border-b bg-background sticky top-0 z-50">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-3 flex-wrap">
              <Link href="/wallet">
                <Button variant="outline" size="sm" className="gap-2" data-testid="button-header-wallet">
                  <Wallet className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('nav.wallet')}</span>
                </Button>
              </Link>
              <ThemeToggle />
              <NotificationBell />
              <LanguageSwitcher />
            </div>
          </header>
          <main className="flex-1 overflow-auto pb-16 md:pb-0">
            {children}
          </main>
          <BottomNavigation onChatToggle={toggleChat} isChatOpen={isChatOpen} />
        </div>
        {isChatOpen && (
          <div className="fixed inset-0 z-[100] md:hidden" onClick={toggleChat}>
            <div className="absolute inset-0 bg-black/50" />
            <div 
              className="absolute bottom-16 left-0 right-0 h-[70vh] bg-background rounded-t-xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <Suspense fallback={<PageLoader />}>
                <ChatPage />
              </Suspense>
            </div>
          </div>
        )}
      </div>
    </SidebarProvider>
  );
}

function AdminRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/admin" component={AdminLoginPage} />
        <Route path="/admin/dashboard">
          <AdminLayout><AdminDashboardPage /></AdminLayout>
        </Route>
        <Route path="/admin/users">
          <AdminLayout><AdminUsersPage /></AdminLayout>
        </Route>
        <Route path="/admin/sections">
          <AdminLayout><AdminSectionsPage /></AdminLayout>
        </Route>
        <Route path="/admin/anti-cheat">
          <AdminLayout><AdminAntiCheatPage /></AdminLayout>
        </Route>
        <Route path="/admin/analytics">
          <AdminLayout><AdminAnalyticsPage /></AdminLayout>
        </Route>
        <Route path="/admin/disputes">
          <AdminLayout><AdminDisputesPage /></AdminLayout>
        </Route>
        <Route path="/admin/p2p">
          <AdminLayout><AdminP2PPage /></AdminLayout>
        </Route>
        <Route path="/admin/support">
          <AdminLayout><AdminSupportPage /></AdminLayout>
        </Route>
        <Route path="/admin/app-settings">
          <AdminLayout><AdminAppSettingsPage /></AdminLayout>
        </Route>
        <Route path="/admin/languages">
          <AdminLayout><AdminLanguagesPage /></AdminLayout>
        </Route>
        <Route path="/admin/badges">
          <AdminLayout><AdminBadgesPage /></AdminLayout>
        </Route>
        <Route path="/admin/notifications">
          <AdminLayout><AdminNotificationsPage /></AdminLayout>
        </Route>
        <Route path="/admin/games">
          <AdminLayout><AdminGamesPage /></AdminLayout>
        </Route>
        <Route path="/admin/id-verification">
          <AdminLayout><AdminIdVerificationPage /></AdminLayout>
        </Route>
        <Route path="/admin/seo">
          <AdminLayout><AdminSeoPage /></AdminLayout>
        </Route>
        <Route path="/admin/payment-methods">
          <AdminLayout><AdminPaymentMethodsPage /></AdminLayout>
        </Route>
        <Route path="/admin/integrations">
          <AdminLayout><AdminIntegrationsPage /></AdminLayout>
        </Route>
        <Route path="/admin/social-platforms">
          <AdminLayout><AdminSocialPlatformsPage /></AdminLayout>
        </Route>
        <Route path="/admin/advertisements">
          <AdminLayout><AdminAdvertisementsPage /></AdminLayout>
        </Route>
        <Route path="/admin/game-sections">
          <AdminLayout><AdminGameSectionsPage /></AdminLayout>
        </Route>
      </Switch>
    </Suspense>
  );
}

function PublicLayout({ children }: { children: React.ReactNode }) {
  const { dir } = useI18n();
  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <header className="flex items-center justify-between gap-4 p-3 border-b bg-background sticky top-0 z-50">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer">
            <Gamepad2 className="w-6 h-6 text-primary" />
            <span className="font-bold text-lg">VEX</span>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <LanguageSwitcher />
          <Link href="/">
            <Button size="sm" data-testid="button-login">Login</Button>
          </Link>
        </div>
      </header>
      <main className="p-4">
        {children}
      </main>
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  if (location.startsWith("/admin")) {
    return <AdminRouter />;
  }

  // Challenges page is public - accessible without login
  if (location === "/challenges" && !isAuthenticated) {
    return (
      <PublicLayout>
        <Suspense fallback={<PageLoader />}>
          <ChallengesPage />
        </Suspense>
      </PublicLayout>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse">
          <Gamepad2 className="w-12 h-12 text-primary" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<PageLoader />}>
        <LoginPage />
      </Suspense>
    );
  }

  return (
    <AuthenticatedLayout>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/" component={DashboardPage} />
          <Route path="/games" component={GamesPage} />
          <Route path="/play" component={PlayPage} />
          <Route path="/challenges" component={ChallengesPage} />
          <Route path="/challenge/:id/play" component={ChallengeGamePage} />
          <Route path="/challenge/:id/watch" component={ChallengeWatchPage} />
          <Route path="/p2p" component={P2PPage} />
          <Route path="/p2p/profile/:userId?" component={P2PProfilePage} />
          <Route path="/p2p/settings" component={P2PSettingsPage} />
          <Route path="/free" component={FreePage} />
          <Route path="/wallet" component={WalletPage} />
          <Route path="/transactions" component={TransactionsPage} />
          <Route path="/complaints" component={ComplaintsPage} />
          <Route path="/friends" component={FriendsPage} />
          <Route path="/multiplayer" component={MultiplayerPage} />
          <Route path="/chat" component={ChatPage} />
          <Route path="/support" component={SupportPage} />
          <Route path="/settings" component={SettingsPage} />
          <Route path="/admin/announcements" component={AdminAnnouncementsPage} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </AuthenticatedLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <I18nProvider>
            <SettingsProvider>
              <AuthProvider>
                <Toaster />
                <Router />
              </AuthProvider>
            </SettingsProvider>
          </I18nProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
