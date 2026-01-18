import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth, useAuthHeaders } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Shield, Settings2, Loader2, Monitor, Smartphone, Globe, Trash2, LogOut, CheckCircle, KeyRound, Camera, Users, ImageIcon } from "lucide-react";
import { BlockedMutedSettings } from "@/components/BlockedMutedSettings";
import { format } from "date-fns";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type PasswordFormValues = z.infer<typeof passwordSchema>;

interface UserPreferences {
  language: "en" | "ar";
  currency: string;
  notifyAnnouncements: boolean;
  notifyTransactions: boolean;
  notifyPromotions: boolean;
  notifyP2P: boolean;
}

interface LoginHistoryEntry {
  id: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  status: string;
}

interface UserSession {
  id: string;
  deviceInfo: string;
  ipAddress: string;
  lastActiveAt: string;
  isCurrent: boolean;
  createdAt: string;
}

function ProfileSection() {
  const { user, updateUser, token } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const headers = useAuthHeaders();
  
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      phone: user?.phone || "",
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers,
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update profile");
      return res.json();
    },
    onSuccess: (data) => {
      updateUser(data);
      toast({ title: t("common.success"), description: t("settings.profileUpdated") });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: () => {
      toast({ title: t("common.error"), description: t("settings.profileUpdateFailed"), variant: "destructive" });
    },
  });

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  };

  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: t("common.error"), description: t("settings.fileTooLarge") || "File size must be less than 5MB", variant: "destructive" });
      return;
    }
    
    setIsUploadingPicture(true);
    try {
      const base64 = await convertToBase64(file);
      const res = await fetch("/api/user/profile-picture", {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ profilePicture: base64 }),
      });
      if (!res.ok) throw new Error("Failed to upload");
      const data = await res.json();
      updateUser(data.user);
      toast({ title: t("common.success"), description: t("settings.profilePictureUpdated") || "Profile picture updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch {
      toast({ title: t("common.error"), description: t("settings.uploadFailed") || "Failed to upload profile picture", variant: "destructive" });
    } finally {
      setIsUploadingPicture(false);
    }
  };

  const handleCoverPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: t("common.error"), description: t("settings.fileTooLarge") || "File size must be less than 10MB", variant: "destructive" });
      return;
    }
    
    setIsUploadingCover(true);
    try {
      const base64 = await convertToBase64(file);
      const res = await fetch("/api/user/cover-photo", {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ coverPhoto: base64 }),
      });
      if (!res.ok) throw new Error("Failed to upload");
      const data = await res.json();
      updateUser(data.user);
      toast({ title: t("common.success"), description: t("settings.coverPhotoUpdated") || "Cover photo updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch {
      toast({ title: t("common.error"), description: t("settings.uploadFailed") || "Failed to upload cover photo", variant: "destructive" });
    } finally {
      setIsUploadingCover(false);
    }
  };

  const getUserInitials = () => {
    const first = user?.firstName?.[0] || '';
    const last = user?.lastName?.[0] || '';
    return (first + last).toUpperCase() || 'U';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          {t("settings.profile")}
        </CardTitle>
        <CardDescription>{t("settings.profileDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative mb-16">
          <div 
            className="h-32 rounded-lg bg-gradient-to-r from-primary/20 to-primary/40 relative overflow-hidden cursor-pointer group"
            onClick={() => coverInputRef.current?.click()}
            data-testid="button-cover-photo"
          >
            {user?.coverPhoto ? (
              <img 
                src={user.coverPhoto} 
                alt="Cover" 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              {isUploadingCover ? (
                <Loader2 className="h-6 w-6 text-white animate-spin" />
              ) : (
                <div className="text-white flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  <span className="text-sm">{t("settings.changeCover") || "Change Cover"}</span>
                </div>
              )}
            </div>
            <input
              type="file"
              ref={coverInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleCoverPhotoUpload}
              data-testid="input-cover-photo"
            />
          </div>
          
          <div className="absolute -bottom-12 left-4">
            <div className="relative">
              <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                <AvatarImage src={user?.profilePicture || undefined} alt={user?.firstName || "Profile"} />
                <AvatarFallback className="text-2xl bg-primary/10">{getUserInitials()}</AvatarFallback>
              </Avatar>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleProfilePictureUpload}
                data-testid="input-profile-picture"
              />
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute bottom-0 right-0 h-8 w-8 rounded-full shadow-md"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPicture}
                data-testid="button-upload-picture"
              >
                {isUploadingPicture ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => updateProfileMutation.mutate(data))} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("settings.firstName")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t("settings.firstNamePlaceholder")} data-testid="input-firstname" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("settings.lastName")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t("settings.lastNamePlaceholder")} data-testid="input-lastname" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>{t("auth.email")}</FormLabel>
                    {user?.email && (
                      user?.emailVerified ? (
                        <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30">
                          <CheckCircle className="w-3 h-3 me-1" />
                          {t("settings.verified") || "Verified"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">
                          {t("settings.unverified") || "Unverified"}
                        </Badge>
                      )
                    )}
                  </div>
                  <FormControl>
                    <Input {...field} type="email" placeholder="email@example.com" data-testid="input-email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>{t("auth.phone")}</FormLabel>
                    {user?.phone && (
                      user?.phoneVerified ? (
                        <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30">
                          <CheckCircle className="w-3 h-3 me-1" />
                          {t("settings.verified") || "Verified"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">
                          {t("settings.unverified") || "Unverified"}
                        </Badge>
                      )
                    )}
                  </div>
                  <FormControl>
                    <Input {...field} type="tel" placeholder="+1234567890" data-testid="input-phone" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={updateProfileMutation.isPending} data-testid="button-save-profile">
              {updateProfileMutation.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("common.save")}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function VerificationSection() {
  const { user, token, updateUser, refreshUser } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const headers = useAuthHeaders();
  
  const [verifyingType, setVerifyingType] = useState<"email" | "phone" | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  
  const handleSendOtp = async (type: "email" | "phone") => {
    const contactValue = type === "email" ? user?.email : user?.phone;
    if (!contactValue) {
      toast({ 
        title: t("common.error") || "Error", 
        description: `Please add your ${type} first in the profile section above.`, 
        variant: "destructive" 
      });
      return;
    }
    
    setIsSending(true);
    setVerifyingType(type);
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers,
        body: JSON.stringify({ contactType: type, contactValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setShowOtpInput(true);
      if (data.devOtp) setDevOtp(data.devOtp);
      toast({ 
        title: t("common.success") || "Success", 
        description: data.message 
      });
    } catch (error: any) {
      toast({ 
        title: t("common.error") || "Error", 
        description: error.message, 
        variant: "destructive" 
      });
      setVerifyingType(null);
    } finally {
      setIsSending(false);
    }
  };
  
  const handleVerifyOtp = async () => {
    if (!verifyingType || !otpCode) return;
    
    setIsVerifying(true);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers,
        body: JSON.stringify({ contactType: verifyingType, code: otpCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      toast({ 
        title: t("common.success") || "Success", 
        description: data.message 
      });
      
      // Refresh user data in auth context and query cache
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      
      // Reset state
      setShowOtpInput(false);
      setVerifyingType(null);
      setOtpCode("");
      setDevOtp(null);
    } catch (error: any) {
      toast({ 
        title: t("common.error") || "Error", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setIsVerifying(false);
    }
  };
  
  const handleCancel = () => {
    setShowOtpInput(false);
    setVerifyingType(null);
    setOtpCode("");
    setDevOtp(null);
  };
  
  const hasUnverifiedContacts = (user?.email && !user?.emailVerified) || (user?.phone && !user?.phoneVerified);
  
  if (!hasUnverifiedContacts) return null;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          {t("settings.verification") || "Contact Verification"}
        </CardTitle>
        <CardDescription>
          {t("settings.verificationDescription") || "Verify your email and phone number to secure your account."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {showOtpInput ? (
          <div className="space-y-4">
            <div className="p-4 bg-accent/10 rounded-md border border-accent/20">
              <p className="text-sm">
                Enter the verification code sent to your {verifyingType}.
              </p>
              {devOtp && (
                <p className="text-xs text-muted-foreground mt-2">
                  (Dev mode) OTP: <span className="font-mono font-bold">{devOtp}</span>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Verification Code</Label>
              <Input
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="Enter 6-digit code"
                maxLength={6}
                data-testid="input-otp-code"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isVerifying}
                className="flex-1"
                data-testid="button-cancel-verify"
              >
                Cancel
              </Button>
              <Button
                onClick={handleVerifyOtp}
                disabled={isVerifying || otpCode.length !== 6}
                className="flex-1"
                data-testid="button-verify-otp"
              >
                {isVerifying && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                Verify
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {user?.email && !user?.emailVerified && (
              <div className="flex items-center justify-between p-3 rounded-md border">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-full">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{user.email}</p>
                    <p className="text-xs text-muted-foreground">Email not verified</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleSendOtp("email")}
                  disabled={isSending}
                  data-testid="button-verify-email"
                >
                  {isSending && verifyingType === "email" && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                  Verify
                </Button>
              </div>
            )}
            {user?.phone && !user?.phoneVerified && (
              <div className="flex items-center justify-between p-3 rounded-md border">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-full">
                    <Smartphone className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{user.phone}</p>
                    <p className="text-xs text-muted-foreground">Phone not verified</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleSendOtp("phone")}
                  disabled={isSending}
                  data-testid="button-verify-phone"
                >
                  {isSending && verifyingType === "phone" && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                  Verify
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PreferencesSection() {
  const { t, language, setLanguage } = useI18n();
  const { toast } = useToast();
  const headers = useAuthHeaders();

  const { data: preferences, isLoading } = useQuery<UserPreferences>({
    queryKey: ["/api/user/preferences"],
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: async (data: Partial<UserPreferences>) => {
      const res = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers,
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update preferences");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("common.success"), description: t("settings.preferencesUpdated") });
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
    },
    onError: () => {
      toast({ title: t("common.error"), description: t("settings.preferencesUpdateFailed"), variant: "destructive" });
    },
  });

  const handleLanguageChange = (newLang: "en" | "ar") => {
    setLanguage(newLang);
    updatePreferencesMutation.mutate({ language: newLang });
  };

  const handleCurrencyChange = (currency: string) => {
    updatePreferencesMutation.mutate({ currency });
  };

  const handleNotificationToggle = (key: keyof UserPreferences, value: boolean) => {
    updatePreferencesMutation.mutate({ [key]: value });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          {t("settings.preferences")}
        </CardTitle>
        <CardDescription>{t("settings.preferencesDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>{t("settings.language")}</Label>
          <Select value={language} onValueChange={handleLanguageChange}>
            <SelectTrigger className="w-full md:w-[200px]" data-testid="select-language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en" data-testid="option-language-en">English</SelectItem>
              <SelectItem value="ar" data-testid="option-language-ar">العربية</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t("settings.currency")}</Label>
          <Select value={preferences?.currency || "USD"} onValueChange={handleCurrencyChange}>
            <SelectTrigger className="w-full md:w-[280px]" data-testid="select-currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="USD">USD - US Dollar ($)</SelectItem>
              <SelectItem value="EUR">EUR - Euro (€)</SelectItem>
              <SelectItem value="GBP">GBP - British Pound (£)</SelectItem>
              <SelectItem value="JPY">JPY - Japanese Yen (¥)</SelectItem>
              <SelectItem value="CHF">CHF - Swiss Franc (CHF)</SelectItem>
              <SelectItem value="CAD">CAD - Canadian Dollar (C$)</SelectItem>
              <SelectItem value="AUD">AUD - Australian Dollar (A$)</SelectItem>
              <SelectItem value="NZD">NZD - New Zealand Dollar (NZ$)</SelectItem>
              <SelectItem value="CNY">CNY - Chinese Yuan (¥)</SelectItem>
              <SelectItem value="HKD">HKD - Hong Kong Dollar (HK$)</SelectItem>
              <SelectItem value="SGD">SGD - Singapore Dollar (S$)</SelectItem>
              <SelectItem value="KRW">KRW - South Korean Won (₩)</SelectItem>
              <SelectItem value="INR">INR - Indian Rupee (₹)</SelectItem>
              <SelectItem value="RUB">RUB - Russian Ruble (₽)</SelectItem>
              <SelectItem value="BRL">BRL - Brazilian Real (R$)</SelectItem>
              <SelectItem value="MXN">MXN - Mexican Peso (MX$)</SelectItem>
              <SelectItem value="ZAR">ZAR - South African Rand (R)</SelectItem>
              <SelectItem value="TRY">TRY - Turkish Lira (₺)</SelectItem>
              <SelectItem value="PLN">PLN - Polish Zloty (zł)</SelectItem>
              <SelectItem value="SEK">SEK - Swedish Krona (kr)</SelectItem>
              <SelectItem value="NOK">NOK - Norwegian Krone (kr)</SelectItem>
              <SelectItem value="DKK">DKK - Danish Krone (kr)</SelectItem>
              <SelectItem value="CZK">CZK - Czech Koruna (Kč)</SelectItem>
              <SelectItem value="HUF">HUF - Hungarian Forint (Ft)</SelectItem>
              <SelectItem value="ILS">ILS - Israeli Shekel (₪)</SelectItem>
              <SelectItem value="THB">THB - Thai Baht (฿)</SelectItem>
              <SelectItem value="MYR">MYR - Malaysian Ringgit (RM)</SelectItem>
              <SelectItem value="IDR">IDR - Indonesian Rupiah (Rp)</SelectItem>
              <SelectItem value="PHP">PHP - Philippine Peso (₱)</SelectItem>
              <SelectItem value="VND">VND - Vietnamese Dong (₫)</SelectItem>
              <SelectItem value="PKR">PKR - Pakistani Rupee (Rs)</SelectItem>
              <SelectItem value="BDT">BDT - Bangladeshi Taka (৳)</SelectItem>
              <SelectItem value="NGN">NGN - Nigerian Naira (₦)</SelectItem>
              <SelectItem value="EGP">EGP - Egyptian Pound (E£)</SelectItem>
              <SelectItem value="KES">KES - Kenyan Shilling (KSh)</SelectItem>
              <SelectItem value="GHS">GHS - Ghanaian Cedi (GH₵)</SelectItem>
              <SelectItem value="AED">AED - UAE Dirham (د.إ)</SelectItem>
              <SelectItem value="SAR">SAR - Saudi Riyal (ر.س)</SelectItem>
              <SelectItem value="QAR">QAR - Qatari Riyal (ر.ق)</SelectItem>
              <SelectItem value="KWD">KWD - Kuwaiti Dinar (د.ك)</SelectItem>
              <SelectItem value="BHD">BHD - Bahraini Dinar (ب.د)</SelectItem>
              <SelectItem value="OMR">OMR - Omani Rial (ر.ع)</SelectItem>
              <SelectItem value="JOD">JOD - Jordanian Dinar (د.أ)</SelectItem>
              <SelectItem value="LBP">LBP - Lebanese Pound (ل.ل)</SelectItem>
              <SelectItem value="IQD">IQD - Iraqi Dinar (ع.د)</SelectItem>
              <SelectItem value="SYP">SYP - Syrian Pound (ل.س)</SelectItem>
              <SelectItem value="YER">YER - Yemeni Rial (ر.ي)</SelectItem>
              <SelectItem value="MAD">MAD - Moroccan Dirham (د.م)</SelectItem>
              <SelectItem value="DZD">DZD - Algerian Dinar (د.ج)</SelectItem>
              <SelectItem value="TND">TND - Tunisian Dinar (د.ت)</SelectItem>
              <SelectItem value="LYD">LYD - Libyan Dinar (ل.د)</SelectItem>
              <SelectItem value="SDG">SDG - Sudanese Pound (ج.س)</SelectItem>
              <SelectItem value="ARS">ARS - Argentine Peso ($)</SelectItem>
              <SelectItem value="CLP">CLP - Chilean Peso ($)</SelectItem>
              <SelectItem value="COP">COP - Colombian Peso ($)</SelectItem>
              <SelectItem value="PEN">PEN - Peruvian Sol (S/)</SelectItem>
              <SelectItem value="VES">VES - Venezuelan Bolivar (Bs)</SelectItem>
              <SelectItem value="UYU">UYU - Uruguayan Peso ($U)</SelectItem>
              <SelectItem value="UAH">UAH - Ukrainian Hryvnia (₴)</SelectItem>
              <SelectItem value="RON">RON - Romanian Leu (lei)</SelectItem>
              <SelectItem value="BGN">BGN - Bulgarian Lev (лв)</SelectItem>
              <SelectItem value="HRK">HRK - Croatian Kuna (kn)</SelectItem>
              <SelectItem value="RSD">RSD - Serbian Dinar (din)</SelectItem>
              <SelectItem value="TWD">TWD - Taiwan Dollar (NT$)</SelectItem>
              <SelectItem value="LKR">LKR - Sri Lankan Rupee (Rs)</SelectItem>
              <SelectItem value="NPR">NPR - Nepalese Rupee (Rs)</SelectItem>
              <SelectItem value="MMK">MMK - Myanmar Kyat (K)</SelectItem>
              <SelectItem value="KHR">KHR - Cambodian Riel (៛)</SelectItem>
              <SelectItem value="LAK">LAK - Lao Kip (₭)</SelectItem>
              <SelectItem value="BND">BND - Brunei Dollar (B$)</SelectItem>
              <SelectItem value="MOP">MOP - Macanese Pataca (MOP$)</SelectItem>
              <SelectItem value="BTC">BTC - Bitcoin (₿)</SelectItem>
              <SelectItem value="ETH">ETH - Ethereum (Ξ)</SelectItem>
              <SelectItem value="USDT">USDT - Tether (₮)</SelectItem>
              <SelectItem value="BNB">BNB - Binance Coin (BNB)</SelectItem>
              <SelectItem value="XRP">XRP - Ripple (XRP)</SelectItem>
              <SelectItem value="SOL">SOL - Solana (SOL)</SelectItem>
              <SelectItem value="DOGE">DOGE - Dogecoin (Ð)</SelectItem>
              <SelectItem value="ADA">ADA - Cardano (₳)</SelectItem>
              <SelectItem value="TRX">TRX - Tron (TRX)</SelectItem>
              <SelectItem value="LTC">LTC - Litecoin (Ł)</SelectItem>
              <SelectItem value="DOT">DOT - Polkadot (DOT)</SelectItem>
              <SelectItem value="MATIC">MATIC - Polygon (MATIC)</SelectItem>
              <SelectItem value="AVAX">AVAX - Avalanche (AVAX)</SelectItem>
              <SelectItem value="LINK">LINK - Chainlink (LINK)</SelectItem>
              <SelectItem value="XLM">XLM - Stellar (XLM)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4">
          <Label className="text-base font-semibold">{t("settings.notifications")}</Label>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label>{t("settings.notifyAnnouncements")}</Label>
                <p className="text-sm text-muted-foreground">{t("settings.notifyAnnouncementsDesc")}</p>
              </div>
              <Switch
                checked={preferences?.notifyAnnouncements ?? true}
                onCheckedChange={(checked) => handleNotificationToggle("notifyAnnouncements", checked)}
                data-testid="switch-notify-announcements"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label>{t("settings.notifyTransactions")}</Label>
                <p className="text-sm text-muted-foreground">{t("settings.notifyTransactionsDesc")}</p>
              </div>
              <Switch
                checked={preferences?.notifyTransactions ?? true}
                onCheckedChange={(checked) => handleNotificationToggle("notifyTransactions", checked)}
                data-testid="switch-notify-transactions"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label>{t("settings.notifyPromotions")}</Label>
                <p className="text-sm text-muted-foreground">{t("settings.notifyPromotionsDesc")}</p>
              </div>
              <Switch
                checked={preferences?.notifyPromotions ?? true}
                onCheckedChange={(checked) => handleNotificationToggle("notifyPromotions", checked)}
                data-testid="switch-notify-promotions"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label>{t("settings.notifyP2P")}</Label>
                <p className="text-sm text-muted-foreground">{t("settings.notifyP2PDesc")}</p>
              </div>
              <Switch
                checked={preferences?.notifyP2P ?? true}
                onCheckedChange={(checked) => handleNotificationToggle("notifyP2P", checked)}
                data-testid="switch-notify-p2p"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PrivacySection() {
  const { user, updateUser, token } = useAuth();
  const { t, language } = useI18n();
  const { toast } = useToast();
  const isArabic = language === "ar";

  const updateStatusMutation = useMutation({
    mutationFn: async (data: { stealthMode?: boolean; isOnline?: boolean }) => {
      const res = await fetch("/api/user/status", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: (data) => {
      updateUser(data);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ 
        title: isArabic ? "تم التحديث" : "Updated",
        description: isArabic ? "تم تحديث إعدادات الظهور" : "Visibility settings updated" 
      });
    },
    onError: () => {
      toast({ 
        title: isArabic ? "خطأ" : "Error", 
        description: isArabic ? "فشل تحديث الإعدادات" : "Failed to update settings",
        variant: "destructive" 
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          {isArabic ? "الخصوصية والظهور" : "Privacy & Visibility"}
        </CardTitle>
        <CardDescription>
          {isArabic 
            ? "تحكم في حالة ظهورك للمستخدمين الآخرين"
            : "Control how you appear to other users"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label>{isArabic ? "الوضع الخفي" : "Stealth Mode"}</Label>
            <p className="text-sm text-muted-foreground">
              {isArabic 
                ? "إخفاء حالة نشاطك عن المستخدمين الآخرين"
                : "Hide your online status from other users"}
            </p>
          </div>
          <Switch
            checked={user?.stealthMode ?? false}
            onCheckedChange={(checked) => updateStatusMutation.mutate({ stealthMode: checked })}
            disabled={updateStatusMutation.isPending}
            data-testid="switch-stealth-mode"
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label>{isArabic ? "الحالة الحالية" : "Current Status"}</Label>
            <p className="text-sm text-muted-foreground">
              {isArabic 
                ? "حالة نشاطك المعروضة للآخرين"
                : "Your activity status shown to others"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {user?.stealthMode ? (
              <Badge variant="secondary" data-testid="badge-status-hidden">
                {isArabic ? "مخفي" : "Hidden"}
              </Badge>
            ) : user?.isOnline ? (
              <Badge className="bg-green-600" data-testid="badge-status-online">
                {isArabic ? "نشط" : "Online"}
              </Badge>
            ) : (
              <Badge variant="secondary" data-testid="badge-status-offline">
                {isArabic ? "غير نشط" : "Offline"}
              </Badge>
            )}
          </div>
        </div>

        <div className="rounded-lg border p-4 bg-muted/50">
          <p className="text-sm text-muted-foreground">
            {isArabic 
              ? "عند تفعيل الوضع الخفي، لن يتمكن المستخدمون الآخرون من رؤية حالة نشاطك. سيظهر لهم أنك غير متصل دائمًا."
              : "When stealth mode is enabled, other users won't be able to see your online status. You'll always appear as offline to them."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function SecuritySection() {
  const { t } = useI18n();
  const { toast } = useToast();
  const headers = useAuthHeaders();

  const [withdrawalPasswordEnabled, setWithdrawalPasswordEnabled] = useState(false);
  const [showSetWithdrawalPassword, setShowSetWithdrawalPassword] = useState(false);
  const [withdrawalPasswordForm, setWithdrawalPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
    currentLoginPassword: ""
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: PasswordFormValues) => {
      const res = await fetch("/api/user/change-password", {
        method: "POST",
        headers,
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to change password");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("common.success"), description: t("settings.passwordChanged") });
      passwordForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    },
  });

  const setWithdrawalPasswordMutation = useMutation({
    mutationFn: async (data: { password: string; loginPassword: string }) => {
      const res = await fetch("/api/user/withdrawal-password", {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to set withdrawal password");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("common.success"), description: "Withdrawal password set successfully" });
      setShowSetWithdrawalPassword(false);
      setWithdrawalPasswordForm({ newPassword: "", confirmPassword: "", currentLoginPassword: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
    },
    onError: () => {
      toast({ title: t("common.error"), description: "Failed to set withdrawal password", variant: "destructive" });
    },
  });

  const { data: loginHistory, isLoading: historyLoading } = useQuery<LoginHistoryEntry[]>({
    queryKey: ["/api/user/login-history"],
  });

  const { data: sessions, isLoading: sessionsLoading } = useQuery<UserSession[]>({
    queryKey: ["/api/user/sessions"],
  });

  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await fetch(`/api/user/sessions/${sessionId}/revoke`, {
        method: "POST",
        headers,
      });
      if (!res.ok) throw new Error("Failed to revoke session");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("common.success"), description: t("settings.sessionRevoked") });
      queryClient.invalidateQueries({ queryKey: ["/api/user/sessions"] });
    },
    onError: () => {
      toast({ title: t("common.error"), description: t("settings.sessionRevokeFailed"), variant: "destructive" });
    },
  });

  const revokeAllSessionsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/user/sessions/revoke-all", {
        method: "POST",
        headers,
        body: JSON.stringify({ exceptCurrent: true }),
      });
      if (!res.ok) throw new Error("Failed to revoke sessions");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("common.success"), description: t("settings.allSessionsRevoked") });
      queryClient.invalidateQueries({ queryKey: ["/api/user/sessions"] });
    },
    onError: () => {
      toast({ title: t("common.error"), description: t("settings.sessionRevokeFailed"), variant: "destructive" });
    },
  });

  const getDeviceIcon = (deviceInfo: string) => {
    const lower = deviceInfo?.toLowerCase() || "";
    if (lower.includes("mobile") || lower.includes("android") || lower.includes("iphone")) {
      return <Smartphone className="h-4 w-4" />;
    }
    if (lower.includes("mac") || lower.includes("windows") || lower.includes("linux")) {
      return <Monitor className="h-4 w-4" />;
    }
    return <Globe className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t("settings.changePassword")}
          </CardTitle>
          <CardDescription>{t("settings.changePasswordDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit((data) => changePasswordMutation.mutate(data))} className="space-y-4">
              <FormField
                control={passwordForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("settings.currentPassword")}</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" data-testid="input-current-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("settings.newPassword")}</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" data-testid="input-new-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("settings.confirmPassword")}</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" data-testid="input-confirm-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={changePasswordMutation.isPending} data-testid="button-change-password">
                {changePasswordMutation.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {t("settings.updatePassword")}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.activeSessions")}</CardTitle>
          <CardDescription>{t("settings.activeSessionsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : sessions && sessions.length > 0 ? (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/50"
                  data-testid={`session-item-${session.id}`}
                >
                  <div className="flex items-center gap-3">
                    {getDeviceIcon(session.deviceInfo)}
                    <div>
                      <p className="text-sm font-medium flex items-center gap-2">
                        {session.deviceInfo || t("settings.unknownDevice")}
                        {session.isCurrent && (
                          <Badge variant="secondary" className="text-xs">
                            <CheckCircle className="h-3 w-3 me-1" />
                            {t("settings.currentSession")}
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {session.ipAddress} • {t("settings.lastActive")}: {format(new Date(session.lastActiveAt), "PPp")}
                      </p>
                    </div>
                  </div>
                  {!session.isCurrent && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => revokeSessionMutation.mutate(session.id)}
                      disabled={revokeSessionMutation.isPending}
                      data-testid={`button-revoke-session-${session.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {sessions.length > 1 && (
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => revokeAllSessionsMutation.mutate()}
                  disabled={revokeAllSessionsMutation.isPending}
                  data-testid="button-revoke-all-sessions"
                >
                  {revokeAllSessionsMutation.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                  <LogOut className="me-2 h-4 w-4" />
                  {t("settings.revokeAllSessions")}
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("settings.noSessions")}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.loginHistory")}</CardTitle>
          <CardDescription>{t("settings.loginHistoryDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : loginHistory && loginHistory.length > 0 ? (
            <div className="space-y-2">
              {loginHistory.slice(0, 10).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-4 py-2 border-b last:border-0"
                  data-testid={`login-history-${entry.id}`}
                >
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm">{entry.ipAddress || t("settings.unknownIP")}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">{entry.userAgent || t("settings.unknownDevice")}</p>
                    </div>
                  </div>
                  <div className="text-end">
                    <Badge variant={entry.status === "success" ? "default" : "destructive"} className="text-xs">
                      {entry.status === "success" ? t("common.success") : t("settings.failed")}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(entry.createdAt), "PPp")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("settings.noLoginHistory")}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Withdrawal Password
          </CardTitle>
          <CardDescription>
            This password is required for withdrawals and P2P sells to add an extra layer of security to your funds.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label>Enable Withdrawal Password</Label>
              <p className="text-sm text-muted-foreground">
                Require a separate password for all withdrawal and P2P sell operations
              </p>
            </div>
            <Switch
              checked={withdrawalPasswordEnabled}
              onCheckedChange={(checked) => {
                setWithdrawalPasswordEnabled(checked);
                if (checked) {
                  setShowSetWithdrawalPassword(true);
                }
              }}
              data-testid="switch-withdrawal-password"
            />
          </div>

          {withdrawalPasswordEnabled && showSetWithdrawalPassword && (
            <div className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="withdrawal-new-password">New Withdrawal Password</Label>
                <Input
                  id="withdrawal-new-password"
                  type="password"
                  value={withdrawalPasswordForm.newPassword}
                  onChange={(e) => setWithdrawalPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="Enter new withdrawal password"
                  data-testid="input-withdrawal-new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="withdrawal-confirm-password">Confirm Withdrawal Password</Label>
                <Input
                  id="withdrawal-confirm-password"
                  type="password"
                  value={withdrawalPasswordForm.confirmPassword}
                  onChange={(e) => setWithdrawalPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Confirm withdrawal password"
                  data-testid="input-withdrawal-confirm-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="withdrawal-login-password">Current Login Password</Label>
                <Input
                  id="withdrawal-login-password"
                  type="password"
                  value={withdrawalPasswordForm.currentLoginPassword}
                  onChange={(e) => setWithdrawalPasswordForm(prev => ({ ...prev, currentLoginPassword: e.target.value }))}
                  placeholder="Enter your login password to confirm"
                  data-testid="input-withdrawal-login-password"
                />
              </div>
              <Button
                onClick={() => {
                  if (withdrawalPasswordForm.newPassword !== withdrawalPasswordForm.confirmPassword) {
                    toast({ title: t("common.error"), description: "Passwords don't match", variant: "destructive" });
                    return;
                  }
                  if (!withdrawalPasswordForm.newPassword || !withdrawalPasswordForm.currentLoginPassword) {
                    toast({ title: t("common.error"), description: "Please fill in all fields", variant: "destructive" });
                    return;
                  }
                  setWithdrawalPasswordMutation.mutate({
                    password: withdrawalPasswordForm.newPassword,
                    loginPassword: withdrawalPasswordForm.currentLoginPassword
                  });
                }}
                disabled={setWithdrawalPasswordMutation.isPending}
                data-testid="button-set-withdrawal-password"
              >
                {setWithdrawalPasswordMutation.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                Set Withdrawal Password
              </Button>
            </div>
          )}

          {withdrawalPasswordEnabled && !showSetWithdrawalPassword && (
            <div className="pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setShowSetWithdrawalPassword(true)}
                data-testid="button-reset-withdrawal-password"
              >
                <KeyRound className="me-2 h-4 w-4" />
                Reset Withdrawal Password
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  const { t } = useI18n();

  return (
    <div className="container max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6" data-testid="text-settings-title">{t("nav.settings")}</h1>
      
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile" data-testid="tab-profile">
            <User className="h-4 w-4 me-2" />
            {t("settings.profile")}
          </TabsTrigger>
          <TabsTrigger value="preferences" data-testid="tab-preferences">
            <Settings2 className="h-4 w-4 me-2" />
            {t("settings.preferences")}
          </TabsTrigger>
          <TabsTrigger value="privacy" data-testid="tab-privacy">
            <Globe className="h-4 w-4 me-2" />
            {t("settings.privacy") || "Privacy"}
          </TabsTrigger>
          <TabsTrigger value="security" data-testid="tab-security">
            <Shield className="h-4 w-4 me-2" />
            {t("settings.security")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="space-y-6">
            <ProfileSection />
            <VerificationSection />
          </div>
        </TabsContent>

        <TabsContent value="preferences">
          <PreferencesSection />
        </TabsContent>

        <TabsContent value="privacy">
          <div className="space-y-6">
            <PrivacySection />
            <BlockedMutedSettings />
          </div>
        </TabsContent>

        <TabsContent value="security">
          <SecuritySection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
