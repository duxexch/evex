import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
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
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  LayoutDashboard,
  Users,
  Settings,
  Shield,
  BarChart3,
  AlertTriangle,
  LogOut,
  Gamepad2,
  Home,
  Headset,
  ArrowLeftRight,
  Cog,
  Languages,
  Award,
  Bell,
  IdCard,
  Search,
  CreditCard,
  Share2,
  Palette,
} from "lucide-react";

interface AdminLayoutProps {
  children: React.ReactNode;
}

function AdminSidebar() {
  const [location, setLocation] = useLocation();
  const { setOpenMobile, isMobile } = useSidebar();

  const handleNavClick = (url: string) => {
    if (isMobile) {
      setOpenMobile(false);
    }
    setLocation(url);
  };

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminUser");
    setLocation("/admin");
  };

  const menuItems = [
    { title: "Dashboard", url: "/admin/dashboard", icon: LayoutDashboard },
    { title: "Users", url: "/admin/users", icon: Users },
    { title: "Games", url: "/admin/games", icon: Gamepad2 },
    { title: "P2P Management", url: "/admin/p2p", icon: ArrowLeftRight },
    { title: "ID Verification", url: "/admin/id-verification", icon: IdCard },
    { title: "Support Contacts", url: "/admin/support", icon: Headset },
    { title: "Anti-Cheat", url: "/admin/anti-cheat", icon: Shield },
    { title: "Analytics", url: "/admin/analytics", icon: BarChart3 },
    { title: "Disputes", url: "/admin/disputes", icon: AlertTriangle },
  ];

  const settingsItems = [
    { title: "App Settings", url: "/admin/app-settings", icon: Cog },
    { title: "Themes", url: "/admin/themes", icon: Palette },
    { title: "SEO Settings", url: "/admin/seo", icon: Search },
    { title: "Section Controls", url: "/admin/sections", icon: Settings },
    { title: "Social Platforms", url: "/admin/social-platforms", icon: Share2 },
    { title: "Languages", url: "/admin/languages", icon: Languages },
    { title: "Badges", url: "/admin/badges", icon: Award },
    { title: "Notifications", url: "/admin/notifications", icon: Bell },
    { title: "Payment Methods", url: "/admin/payment-methods", icon: CreditCard },
    { title: "Integrations", url: "/admin/integrations", icon: Settings },
  ];

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-destructive flex items-center justify-center">
            <Shield className="w-4 h-4 text-destructive-foreground" />
          </div>
          <div>
            <h2 className="font-bold text-lg">VEX Admin</h2>
            <p className="text-xs text-muted-foreground">Control Panel</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    isActive={location === item.url}
                    onClick={() => handleNavClick(item.url)}
                    data-testid={`admin-link-${item.title.toLowerCase().replace(' ', '-')}`}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    isActive={location === item.url}
                    onClick={() => handleNavClick(item.url)}
                    data-testid={`admin-link-${item.title.toLowerCase().replace(' ', '-')}`}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Quick Links</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => window.open("/", "_blank")}>
                  <Home />
                  <span>View User App</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="space-y-3">
          <div className="text-sm">
            <span className="text-muted-foreground">Logged in as</span>
            <p className="font-semibold">Administrator</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={handleLogout}
            data-testid="button-admin-logout"
          >
            <LogOut className="me-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [, setLocation] = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      setLocation("/admin");
    } else {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, [setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse">
          <Shield className="w-12 h-12 text-destructive" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AdminSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 p-3 border-b bg-background sticky top-0 z-50">
            <SidebarTrigger data-testid="button-admin-sidebar-toggle" />
            <div className="flex items-center gap-3">
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
