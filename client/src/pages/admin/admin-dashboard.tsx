import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Link } from "wouter";
import {
  Users,
  DollarSign,
  Gamepad2,
  AlertTriangle,
  TrendingUp,
  Search,
  Settings,
  Palette,
  Shield,
  BarChart3,
  Activity,
} from "lucide-react";

function getAdminToken() {
  return localStorage.getItem("adminToken");
}

async function adminFetch(url: string) {
  const token = getAdminToken();
  const res = await fetch(url, {
    headers: { "x-admin-token": token || "" },
  });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

export default function AdminDashboardPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: () => adminFetch("/api/admin/stats"),
  });

  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ["/api/admin/search", searchQuery],
    queryFn: () => adminFetch(`/api/admin/search?q=${encodeURIComponent(searchQuery)}`),
    enabled: searchQuery.length >= 2,
  });

  const statCards = [
    {
      title: "Total Users",
      value: stats?.totalUsers || 0,
      icon: Users,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Active Today",
      value: stats?.activeToday || 0,
      icon: Activity,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Total Balance",
      value: `$${(stats?.totalBalance || 0).toLocaleString()}`,
      icon: DollarSign,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
    },
    {
      title: "Total Games",
      value: stats?.totalGames || 0,
      icon: Gamepad2,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      title: "Open Complaints",
      value: stats?.openComplaints || 0,
      icon: AlertTriangle,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
    {
      title: "Pending Disputes",
      value: stats?.pendingDisputes || 0,
      icon: Shield,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
  ];

  const quickLinks = [
    { title: "User Management", icon: Users, href: "/admin/users", desc: "Manage users, ban, suspend, rewards" },
    { title: "Section Controls", icon: Settings, href: "/admin/sections", desc: "Enable/disable app sections" },
    { title: "Theme Management", icon: Palette, href: "/admin/themes", desc: "Configure app themes" },
    { title: "Anti-Cheat", icon: Shield, href: "/admin/anti-cheat", desc: "Monitor suspicious activity" },
    { title: "Analytics", icon: BarChart3, href: "/admin/analytics", desc: "User behavior analytics" },
    { title: "Disputes", icon: AlertTriangle, href: "/admin/disputes", desc: "Manage P2P disputes" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Complete control over VEX platform</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users, transactions, games..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-admin-search"
          />
        </div>
      </div>

      {searchQuery.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Search Results</CardTitle>
          </CardHeader>
          <CardContent>
            {searchLoading ? (
              <p className="text-muted-foreground">Searching...</p>
            ) : searchResults ? (
              <div className="space-y-4">
                {searchResults.users?.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Users</h4>
                    <div className="space-y-2">
                      {searchResults.users.map((user: any) => (
                        <div key={user.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                          <div>
                            <span className="font-medium">{user.username}</span>
                            <span className="text-muted-foreground ml-2">({user.email})</span>
                          </div>
                          <Badge variant={user.status === "active" ? "default" : "destructive"}>
                            {user.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {searchResults.transactions?.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Transactions</h4>
                    <div className="space-y-2">
                      {searchResults.transactions.map((tx: any) => (
                        <div key={tx.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                          <span>{tx.type} - ${tx.amount}</span>
                          <Badge>{tx.status}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(!searchResults.users?.length && !searchResults.transactions?.length) && (
                  <p className="text-muted-foreground">No results found</p>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold mt-1" data-testid={`stat-${stat.title.toLowerCase().replace(' ', '-')}`}>
                    {statsLoading ? "..." : stat.value}
                  </p>
                </div>
                <div className={`p-3 rounded-full ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <Card className="cursor-pointer hover-elevate transition-all">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <link.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{link.title}</h3>
                      <p className="text-sm text-muted-foreground">{link.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
