import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Check, Palette } from "lucide-react";

function getAdminToken() {
  return localStorage.getItem("adminToken");
}

async function adminFetch(url: string, options?: RequestInit) {
  const token = getAdminToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": token || "",
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

const themePresets = [
  {
    name: "VEX Dark",
    description: "Default dark theme with green accents",
    primaryColor: "#00c853",
    backgroundColor: "#0f1419",
    accentColor: "#ff9800",
  },
  {
    name: "Midnight Blue",
    description: "Deep blue theme for night gaming",
    primaryColor: "#3b82f6",
    backgroundColor: "#0c1222",
    accentColor: "#22d3ee",
  },
  {
    name: "Crimson Night",
    description: "Bold red theme for intense gaming",
    primaryColor: "#ef4444",
    backgroundColor: "#1a0a0a",
    accentColor: "#f97316",
  },
  {
    name: "Emerald Forest",
    description: "Nature-inspired green theme",
    primaryColor: "#10b981",
    backgroundColor: "#0a1a14",
    accentColor: "#84cc16",
  },
  {
    name: "Royal Gold",
    description: "Luxurious gold and purple theme",
    primaryColor: "#eab308",
    backgroundColor: "#1a1a0a",
    accentColor: "#a855f7",
  },
];

export default function AdminThemesPage() {
  const { toast } = useToast();

  const { data: themes, isLoading } = useQuery({
    queryKey: ["/api/admin/themes"],
    queryFn: () => adminFetch("/api/admin/themes"),
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (themeId: string) => {
      return adminFetch(`/api/admin/themes/${themeId}/activate`, {
        method: "PATCH",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/themes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/public"] });
      toast({
        title: "Theme Updated",
        description: "Default theme has been changed",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update theme",
        variant: "destructive",
      });
    },
  });

  const createThemeMutation = useMutation({
    mutationFn: async (theme: typeof themePresets[0]) => {
      return adminFetch("/api/admin/themes", {
        method: "POST",
        body: JSON.stringify(theme),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/themes"] });
      toast({
        title: "Theme Created",
        description: "New theme has been added",
      });
    },
  });

  const getThemeById = (name: string) => {
    return themes?.find((t: any) => t.name === name);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Theme Management</h1>
        <p className="text-muted-foreground">Choose the default theme for all users</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {themePresets.map((preset) => {
          const existingTheme = getThemeById(preset.name);
          const isDefault = existingTheme?.isDefault;

          return (
            <Card 
              key={preset.name} 
              className={`relative overflow-visible ${isDefault ? 'ring-2 ring-primary' : ''}`}
            >
              <CardContent className="p-6 space-y-4">
                <div 
                  className="h-20 rounded-lg flex items-end p-3"
                  style={{ backgroundColor: preset.backgroundColor }}
                >
                  <div className="flex gap-2">
                    <div 
                      className="w-6 h-6 rounded-full"
                      style={{ backgroundColor: preset.primaryColor }}
                    />
                    <div 
                      className="w-6 h-6 rounded-full"
                      style={{ backgroundColor: preset.accentColor }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{preset.name}</h3>
                    {isDefault && (
                      <Badge variant="default" className="flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        Active
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{preset.description}</p>
                </div>

                <div className="flex gap-2">
                  {existingTheme ? (
                    <Button
                      className="flex-1"
                      variant={isDefault ? "secondary" : "default"}
                      disabled={isDefault || setDefaultMutation.isPending}
                      onClick={() => setDefaultMutation.mutate(existingTheme.id)}
                      data-testid={`button-set-theme-${preset.name.toLowerCase().replace(' ', '-')}`}
                    >
                      {isDefault ? "Current Theme" : "Set as Default"}
                    </Button>
                  ) : (
                    <Button
                      className="flex-1"
                      variant="outline"
                      disabled={createThemeMutation.isPending}
                      onClick={() => createThemeMutation.mutate(preset)}
                      data-testid={`button-create-theme-${preset.name.toLowerCase().replace(' ', '-')}`}
                    >
                      <Palette className="h-4 w-4 mr-2" />
                      Create Theme
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Themes in Database</CardTitle>
        </CardHeader>
        <CardContent>
          {themes?.length > 0 ? (
            <div className="space-y-2">
              {themes.map((theme: any) => (
                <div 
                  key={theme.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: theme.primaryColor }}
                    />
                    <span className="font-medium">{theme.name}</span>
                  </div>
                  <Badge variant={theme.isDefault ? "default" : "secondary"}>
                    {theme.isDefault ? "Default" : "Available"}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No themes in database. Create one above.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
