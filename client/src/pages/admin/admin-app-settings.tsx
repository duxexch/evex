import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import {
  Settings,
  Palette,
  Shield,
  Gamepad2,
  MessageSquare,
  Phone,
  Mail,
  Save,
  Loader2,
} from "lucide-react";
import { SiGoogle, SiFacebook, SiTelegram, SiX } from "react-icons/si";

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

interface AppSetting {
  id: string;
  key: string;
  value: string | null;
  valueAr: string | null;
  category: string | null;
}

interface LoginMethodConfig {
  id: string;
  method: string;
  isEnabled: boolean;
  otpEnabled: boolean;
  otpLength: number;
  otpExpiryMinutes: number;
  settings: string | null;
}

interface GameplaySetting {
  id: string;
  key: string;
  value: string;
  description: string | null;
  descriptionAr: string | null;
}

interface ChatSetting {
  id: string;
  key: string;
  value: string | null;
}

const loginMethods = [
  { method: "phone", icon: Phone, label: "Phone", labelAr: "الهاتف" },
  { method: "email", icon: Mail, label: "Email", labelAr: "البريد الإلكتروني" },
  { method: "google", icon: SiGoogle, label: "Google", labelAr: "جوجل" },
  { method: "facebook", icon: SiFacebook, label: "Facebook", labelAr: "فيسبوك" },
  { method: "telegram", icon: SiTelegram, label: "Telegram", labelAr: "تيليجرام" },
  { method: "twitter", icon: SiX, label: "Twitter/X", labelAr: "تويتر/إكس" },
];

function SectionSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72 mt-2" />
      </CardHeader>
      <CardContent className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function AdminAppSettingsPage() {
  const { toast } = useToast();
  const { t, language } = useI18n();
  const isArabic = language === "ar";

  const [brandingForm, setBrandingForm] = useState({
    appName: "",
    appNameAr: "",
    appIconUrl: "",
    primaryColor: "",
    secondaryColor: "",
    accentColor: "",
  });

  const [gameplayForm, setGameplayForm] = useState({
    freePlayLimit: "5",
    minBet: "1.00",
    maxBet: "1000.00",
    houseEdge: "5.00",
    defaultRtp: "95.00",
  });

  const [chatForm, setChatForm] = useState({
    chatEnabled: true,
    maxMessageLength: "500",
    chatRateLimit: "10",
  });

  const { data: appSettings, isLoading: loadingAppSettings } = useQuery({
    queryKey: ["/api/admin/app-settings"],
    queryFn: () => adminFetch("/api/admin/app-settings"),
  });

  const { data: loginConfigs, isLoading: loadingLoginConfigs } = useQuery({
    queryKey: ["/api/admin/login-configs"],
    queryFn: () => adminFetch("/api/admin/login-configs"),
  });

  const { data: gameplaySettings, isLoading: loadingGameplay } = useQuery({
    queryKey: ["/api/admin/gameplay-settings"],
    queryFn: () => adminFetch("/api/admin/gameplay-settings"),
  });

  const { data: chatSettings, isLoading: loadingChat } = useQuery({
    queryKey: ["/api/admin/chat-settings"],
    queryFn: () => adminFetch("/api/admin/chat-settings"),
  });

  useState(() => {
    if (appSettings) {
      const settings = appSettings as AppSetting[];
      const getVal = (key: string) => settings.find((s) => s.key === key)?.value || "";
      const getValAr = (key: string) => settings.find((s) => s.key === key)?.valueAr || "";
      setBrandingForm({
        appName: getVal("app_name"),
        appNameAr: getValAr("app_name"),
        appIconUrl: getVal("app_icon_url"),
        primaryColor: getVal("primary_color"),
        secondaryColor: getVal("secondary_color"),
        accentColor: getVal("accent_color"),
      });
    }
  });

  useState(() => {
    if (gameplaySettings) {
      const settings = gameplaySettings as GameplaySetting[];
      const getVal = (key: string) => settings.find((s) => s.key === key)?.value || "";
      setGameplayForm({
        freePlayLimit: getVal("free_play_limit") || "5",
        minBet: getVal("min_bet") || "1.00",
        maxBet: getVal("max_bet") || "1000.00",
        houseEdge: getVal("house_edge") || "5.00",
        defaultRtp: getVal("default_rtp") || "95.00",
      });
    }
  });

  useState(() => {
    if (chatSettings) {
      const settings = chatSettings as ChatSetting[];
      const getVal = (key: string) => settings.find((s) => s.key === key)?.value || "";
      setChatForm({
        chatEnabled: getVal("chat_enabled") !== "false",
        maxMessageLength: getVal("max_message_length") || "500",
        chatRateLimit: getVal("chat_rate_limit") || "10",
      });
    }
  });

  const updateAppSettingMutation = useMutation({
    mutationFn: async ({ key, value, valueAr, category }: { key: string; value: string; valueAr?: string; category?: string }) => {
      return adminFetch(`/api/admin/app-settings/${key}`, {
        method: "PUT",
        body: JSON.stringify({ value, valueAr, category }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/app-settings"] });
    },
    onError: () => {
      toast({ title: isArabic ? "خطأ" : "Error", description: isArabic ? "فشل حفظ الإعداد" : "Failed to save setting", variant: "destructive" });
    },
  });

  const updateLoginConfigMutation = useMutation({
    mutationFn: async ({ method, ...data }: { method: string; isEnabled?: boolean; otpEnabled?: boolean; otpLength?: number; otpExpiryMinutes?: number }) => {
      return adminFetch(`/api/admin/login-configs/${method}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/login-configs"] });
      toast({ title: isArabic ? "تم الحفظ" : "Saved", description: isArabic ? "تم تحديث طريقة تسجيل الدخول" : "Login method updated" });
    },
    onError: () => {
      toast({ title: isArabic ? "خطأ" : "Error", description: isArabic ? "فشل التحديث" : "Failed to update", variant: "destructive" });
    },
  });

  const updateGameplaySettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      return adminFetch(`/api/admin/gameplay-settings/${key}`, {
        method: "PUT",
        body: JSON.stringify({ value }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gameplay-settings"] });
    },
    onError: () => {
      toast({ title: isArabic ? "خطأ" : "Error", description: isArabic ? "فشل حفظ الإعداد" : "Failed to save setting", variant: "destructive" });
    },
  });

  const updateChatSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      return adminFetch(`/api/admin/chat-settings/${key}`, {
        method: "PUT",
        body: JSON.stringify({ value }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/chat-settings"] });
    },
    onError: () => {
      toast({ title: isArabic ? "خطأ" : "Error", description: isArabic ? "فشل حفظ الإعداد" : "Failed to save setting", variant: "destructive" });
    },
  });

  const initializeGameplaySettingsMutation = useMutation({
    mutationFn: async () => {
      return adminFetch("/api/admin/gameplay-settings", { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gameplay-settings"] });
      toast({ title: isArabic ? "تم الإعداد" : "Initialized", description: isArabic ? "تم إنشاء الإعدادات الافتراضية" : "Default settings created" });
    },
  });

  const saveBranding = async () => {
    const updates = [
      { key: "app_name", value: brandingForm.appName, valueAr: brandingForm.appNameAr, category: "branding" },
      { key: "app_icon_url", value: brandingForm.appIconUrl, category: "branding" },
      { key: "primary_color", value: brandingForm.primaryColor, category: "branding" },
      { key: "secondary_color", value: brandingForm.secondaryColor, category: "branding" },
      { key: "accent_color", value: brandingForm.accentColor, category: "branding" },
    ];

    try {
      for (const update of updates) {
        await updateAppSettingMutation.mutateAsync(update);
      }
      toast({ title: isArabic ? "تم الحفظ" : "Saved", description: isArabic ? "تم حفظ إعدادات العلامة التجارية" : "Branding settings saved" });
    } catch (error) {
      console.error("Error saving branding:", error);
    }
  };

  const saveGameplay = async () => {
    const updates = [
      { key: "free_play_limit", value: gameplayForm.freePlayLimit },
      { key: "min_bet", value: gameplayForm.minBet },
      { key: "max_bet", value: gameplayForm.maxBet },
      { key: "house_edge", value: gameplayForm.houseEdge },
      { key: "default_rtp", value: gameplayForm.defaultRtp },
    ];

    try {
      for (const update of updates) {
        await updateGameplaySettingMutation.mutateAsync(update);
      }
      toast({ title: isArabic ? "تم الحفظ" : "Saved", description: isArabic ? "تم حفظ إعدادات اللعب" : "Gameplay settings saved" });
    } catch (error) {
      console.error("Error saving gameplay:", error);
    }
  };

  const saveChat = async () => {
    const updates = [
      { key: "chat_enabled", value: chatForm.chatEnabled ? "true" : "false" },
      { key: "max_message_length", value: chatForm.maxMessageLength },
      { key: "chat_rate_limit", value: chatForm.chatRateLimit },
    ];

    try {
      for (const update of updates) {
        await updateChatSettingMutation.mutateAsync(update);
      }
      toast({ title: isArabic ? "تم الحفظ" : "Saved", description: isArabic ? "تم حفظ إعدادات المحادثة" : "Chat settings saved" });
    } catch (error) {
      console.error("Error saving chat:", error);
    }
  };

  const getLoginConfig = (method: string): LoginMethodConfig | undefined => {
    return (loginConfigs as LoginMethodConfig[])?.find((c) => c.method === method);
  };

  const isSaving = updateAppSettingMutation.isPending || 
                   updateLoginConfigMutation.isPending || 
                   updateGameplaySettingMutation.isPending || 
                   updateChatSettingMutation.isPending;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings className="h-8 w-8" />
          {isArabic ? "إعدادات التطبيق" : "App Settings"}
        </h1>
        <p className="text-muted-foreground">
          {isArabic ? "إدارة إعدادات التطبيق والعلامة التجارية وطرق تسجيل الدخول" : "Manage app configuration, branding, and login methods"}
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              {isArabic ? "العلامة التجارية" : "App Branding"}
            </CardTitle>
            <CardDescription>
              {isArabic ? "تخصيص مظهر التطبيق والألوان" : "Customize app appearance and colors"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingAppSettings ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="appName">{isArabic ? "اسم التطبيق (إنجليزي)" : "App Name (English)"}</Label>
                    <Input
                      id="appName"
                      value={brandingForm.appName}
                      onChange={(e) => setBrandingForm((prev) => ({ ...prev, appName: e.target.value }))}
                      placeholder="VEX Gaming"
                      data-testid="input-app-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="appNameAr">{isArabic ? "اسم التطبيق (عربي)" : "App Name (Arabic)"}</Label>
                    <Input
                      id="appNameAr"
                      value={brandingForm.appNameAr}
                      onChange={(e) => setBrandingForm((prev) => ({ ...prev, appNameAr: e.target.value }))}
                      placeholder="فيكس للألعاب"
                      dir="rtl"
                      data-testid="input-app-name-ar"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="appIconUrl">{isArabic ? "رابط شعار التطبيق" : "App Icon/Logo URL"}</Label>
                  <Input
                    id="appIconUrl"
                    value={brandingForm.appIconUrl}
                    onChange={(e) => setBrandingForm((prev) => ({ ...prev, appIconUrl: e.target.value }))}
                    placeholder="https://example.com/logo.png"
                    data-testid="input-app-icon-url"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="primaryColor">{isArabic ? "اللون الأساسي" : "Primary Color"}</Label>
                    <div className="flex gap-2">
                      <Input
                        id="primaryColor"
                        value={brandingForm.primaryColor}
                        onChange={(e) => setBrandingForm((prev) => ({ ...prev, primaryColor: e.target.value }))}
                        placeholder="#00c853"
                        data-testid="input-primary-color"
                      />
                      <input
                        type="color"
                        value={brandingForm.primaryColor || "#00c853"}
                        onChange={(e) => setBrandingForm((prev) => ({ ...prev, primaryColor: e.target.value }))}
                        className="w-10 h-10 rounded cursor-pointer border"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secondaryColor">{isArabic ? "اللون الثانوي" : "Secondary Color"}</Label>
                    <div className="flex gap-2">
                      <Input
                        id="secondaryColor"
                        value={brandingForm.secondaryColor}
                        onChange={(e) => setBrandingForm((prev) => ({ ...prev, secondaryColor: e.target.value }))}
                        placeholder="#ff9800"
                        data-testid="input-secondary-color"
                      />
                      <input
                        type="color"
                        value={brandingForm.secondaryColor || "#ff9800"}
                        onChange={(e) => setBrandingForm((prev) => ({ ...prev, secondaryColor: e.target.value }))}
                        className="w-10 h-10 rounded cursor-pointer border"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accentColor">{isArabic ? "لون التمييز" : "Accent Color"}</Label>
                    <div className="flex gap-2">
                      <Input
                        id="accentColor"
                        value={brandingForm.accentColor}
                        onChange={(e) => setBrandingForm((prev) => ({ ...prev, accentColor: e.target.value }))}
                        placeholder="#1a2332"
                        data-testid="input-accent-color"
                      />
                      <input
                        type="color"
                        value={brandingForm.accentColor || "#1a2332"}
                        onChange={(e) => setBrandingForm((prev) => ({ ...prev, accentColor: e.target.value }))}
                        className="w-10 h-10 rounded cursor-pointer border"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button 
                    onClick={saveBranding} 
                    disabled={isSaving}
                    data-testid="button-save-branding"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    {isArabic ? "حفظ العلامة التجارية" : "Save Branding"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {isArabic ? "طرق تسجيل الدخول" : "Login Method Settings"}
            </CardTitle>
            <CardDescription>
              {isArabic ? "تكوين طرق المصادقة وإعدادات OTP" : "Configure authentication methods and OTP settings"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingLoginConfigs ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <Skeleton className="h-6 w-12" />
                  </div>
                ))}
              </div>
            ) : (
              <Accordion type="multiple" className="w-full">
                {loginMethods.map((lm) => {
                  const config = getLoginConfig(lm.method);
                  const Icon = lm.icon;
                  return (
                    <AccordionItem key={lm.method} value={lm.method}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center justify-between gap-4 w-full pr-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded bg-muted">
                              <Icon className="h-4 w-4" />
                            </div>
                            <span className="font-medium">{isArabic ? lm.labelAr : lm.label}</span>
                          </div>
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <Switch
                              checked={config?.isEnabled ?? false}
                              onCheckedChange={(checked) =>
                                updateLoginConfigMutation.mutate({ method: lm.method, isEnabled: checked })
                              }
                              data-testid={`switch-login-${lm.method}`}
                            />
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-4 space-y-4">
                        <div className="grid gap-4 md:grid-cols-3 p-4 bg-muted/30 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`otp-${lm.method}`}>{isArabic ? "تفعيل OTP" : "Enable OTP"}</Label>
                            <Switch
                              id={`otp-${lm.method}`}
                              checked={config?.otpEnabled ?? false}
                              onCheckedChange={(checked) =>
                                updateLoginConfigMutation.mutate({ method: lm.method, otpEnabled: checked })
                              }
                              data-testid={`switch-otp-${lm.method}`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>{isArabic ? "طول OTP" : "OTP Length"}</Label>
                            <Select
                              value={String(config?.otpLength ?? 6)}
                              onValueChange={(val) =>
                                updateLoginConfigMutation.mutate({ method: lm.method, otpLength: parseInt(val) })
                              }
                            >
                              <SelectTrigger data-testid={`select-otp-length-${lm.method}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="4">4 {isArabic ? "أرقام" : "digits"}</SelectItem>
                                <SelectItem value="5">5 {isArabic ? "أرقام" : "digits"}</SelectItem>
                                <SelectItem value="6">6 {isArabic ? "أرقام" : "digits"}</SelectItem>
                                <SelectItem value="8">8 {isArabic ? "أرقام" : "digits"}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>{isArabic ? "انتهاء OTP (دقائق)" : "OTP Expiry (minutes)"}</Label>
                            <Select
                              value={String(config?.otpExpiryMinutes ?? 5)}
                              onValueChange={(val) =>
                                updateLoginConfigMutation.mutate({ method: lm.method, otpExpiryMinutes: parseInt(val) })
                              }
                            >
                              <SelectTrigger data-testid={`select-otp-expiry-${lm.method}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="2">2 {isArabic ? "دقائق" : "minutes"}</SelectItem>
                                <SelectItem value="5">5 {isArabic ? "دقائق" : "minutes"}</SelectItem>
                                <SelectItem value="10">10 {isArabic ? "دقائق" : "minutes"}</SelectItem>
                                <SelectItem value="15">15 {isArabic ? "دقائق" : "minutes"}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gamepad2 className="h-5 w-5" />
              {isArabic ? "إعدادات اللعب" : "Gameplay Settings"}
            </CardTitle>
            <CardDescription>
              {isArabic ? "تكوين حدود الرهان ونسب العائد" : "Configure bet limits and return percentages"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingGameplay ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {(!gameplaySettings || (gameplaySettings as GameplaySetting[]).length === 0) && (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground mb-4">
                      {isArabic ? "لا توجد إعدادات للعب. انقر لإنشاء الإعدادات الافتراضية." : "No gameplay settings found. Click to create defaults."}
                    </p>
                    <Button 
                      onClick={() => initializeGameplaySettingsMutation.mutate()}
                      disabled={initializeGameplaySettingsMutation.isPending}
                      data-testid="button-init-gameplay"
                    >
                      {initializeGameplaySettingsMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      {isArabic ? "إنشاء الإعدادات الافتراضية" : "Create Default Settings"}
                    </Button>
                  </div>
                )}

                {gameplaySettings && (gameplaySettings as GameplaySetting[]).length > 0 && (
                  <>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="freePlayLimit">{isArabic ? "حد اللعب المجاني" : "Free Play Limit"}</Label>
                        <Input
                          id="freePlayLimit"
                          type="number"
                          min="0"
                          value={gameplayForm.freePlayLimit}
                          onChange={(e) => setGameplayForm((prev) => ({ ...prev, freePlayLimit: e.target.value }))}
                          data-testid="input-free-play-limit"
                        />
                        <p className="text-xs text-muted-foreground">
                          {isArabic ? "عدد اللعبات المجانية في اليوم" : "Number of free plays per day"}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="minBet">{isArabic ? "الحد الأدنى" : "Min Amount"}</Label>
                        <Input
                          id="minBet"
                          type="number"
                          step="0.01"
                          min="0"
                          value={gameplayForm.minBet}
                          onChange={(e) => setGameplayForm((prev) => ({ ...prev, minBet: e.target.value }))}
                          data-testid="input-min-bet"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="maxBet">{isArabic ? "الحد الأقصى" : "Max Amount"}</Label>
                        <Input
                          id="maxBet"
                          type="number"
                          step="0.01"
                          min="0"
                          value={gameplayForm.maxBet}
                          onChange={(e) => setGameplayForm((prev) => ({ ...prev, maxBet: e.target.value }))}
                          data-testid="input-max-bet"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="houseEdge">{isArabic ? "نسبة ربح المنزل (%)" : "House Edge (%)"}</Label>
                        <Input
                          id="houseEdge"
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={gameplayForm.houseEdge}
                          onChange={(e) => setGameplayForm((prev) => ({ ...prev, houseEdge: e.target.value }))}
                          data-testid="input-house-edge"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="defaultRtp">{isArabic ? "نسبة العائد الافتراضية (%)" : "Default RTP (%)"}</Label>
                        <Input
                          id="defaultRtp"
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={gameplayForm.defaultRtp}
                          onChange={(e) => setGameplayForm((prev) => ({ ...prev, defaultRtp: e.target.value }))}
                          data-testid="input-default-rtp"
                        />
                        <p className="text-xs text-muted-foreground">
                          {isArabic ? "نسبة العائد للاعب" : "Return to Player percentage"}
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4">
                      <Button 
                        onClick={saveGameplay} 
                        disabled={isSaving}
                        data-testid="button-save-gameplay"
                      >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        {isArabic ? "حفظ إعدادات اللعب" : "Save Gameplay Settings"}
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {isArabic ? "إعدادات المحادثة" : "Chat Settings"}
            </CardTitle>
            <CardDescription>
              {isArabic ? "تكوين إعدادات المحادثة والرسائل" : "Configure chat and messaging settings"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingChat ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <div>
                    <Label className="text-base">{isArabic ? "تفعيل المحادثة" : "Enable Chat Globally"}</Label>
                    <p className="text-sm text-muted-foreground">
                      {isArabic ? "السماح للمستخدمين بالتواصل" : "Allow users to communicate"}
                    </p>
                  </div>
                  <Switch
                    checked={chatForm.chatEnabled}
                    onCheckedChange={(checked) => setChatForm((prev) => ({ ...prev, chatEnabled: checked }))}
                    data-testid="switch-chat-enabled"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="maxMessageLength">{isArabic ? "الحد الأقصى لطول الرسالة" : "Max Message Length"}</Label>
                    <Input
                      id="maxMessageLength"
                      type="number"
                      min="50"
                      max="5000"
                      value={chatForm.maxMessageLength}
                      onChange={(e) => setChatForm((prev) => ({ ...prev, maxMessageLength: e.target.value }))}
                      data-testid="input-max-message-length"
                    />
                    <p className="text-xs text-muted-foreground">
                      {isArabic ? "الحد الأقصى لعدد الأحرف في الرسالة" : "Maximum characters per message"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="chatRateLimit">{isArabic ? "معدل الرسائل" : "Chat Rate Limit"}</Label>
                    <Input
                      id="chatRateLimit"
                      type="number"
                      min="1"
                      max="60"
                      value={chatForm.chatRateLimit}
                      onChange={(e) => setChatForm((prev) => ({ ...prev, chatRateLimit: e.target.value }))}
                      data-testid="input-chat-rate-limit"
                    />
                    <p className="text-xs text-muted-foreground">
                      {isArabic ? "الحد الأقصى للرسائل في الدقيقة" : "Messages per minute limit"}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button 
                    onClick={saveChat} 
                    disabled={isSaving}
                    data-testid="button-save-chat"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    {isArabic ? "حفظ إعدادات المحادثة" : "Save Chat Settings"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
