import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Gamepad2, Loader2, Copy, Check, Smartphone, Mail, User, Zap, KeyRound, Share2 } from "lucide-react";
import { SiGoogle, SiFacebook, SiTelegram, SiWhatsapp, SiX, SiApple } from "react-icons/si";
import { ThemeToggle } from "@/components/ThemeToggle";

interface AuthSettings {
  oneClickEnabled: boolean;
  phoneLoginEnabled: boolean;
  emailLoginEnabled: boolean;
  googleLoginEnabled: boolean;
  facebookLoginEnabled: boolean;
  telegramLoginEnabled: boolean;
  twitterLoginEnabled: boolean;
}

interface SocialPlatform {
  id: string;
  name: string;
  displayName: string;
  displayNameAr: string | null;
  icon: string;
  type: "oauth" | "otp" | "both";
  otpEnabled: boolean;
}

const PLATFORM_ICONS: Record<string, any> = {
  SiGoogle: SiGoogle,
  SiFacebook: SiFacebook,
  SiTelegram: SiTelegram,
  SiWhatsapp: SiWhatsapp,
  SiX: SiX,
  SiApple: SiApple,
};

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login, loginByAccount, loginByPhone, oneClickRegister, confirmOneClickLogin, register } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [authSettings, setAuthSettings] = useState<AuthSettings | null>(null);
  const [socialPlatforms, setSocialPlatforms] = useState<SocialPlatform[]>([]);
  
  const getEnabledTabs = () => {
    if (!authSettings) return ["account"];
    const tabs: string[] = [];
    if (authSettings.oneClickEnabled !== false) tabs.push("one-click");
    tabs.push("account");
    if (authSettings.phoneLoginEnabled !== false) tabs.push("phone");
    if (authSettings.emailLoginEnabled !== false) tabs.push("email");
    return tabs;
  };
  
  const enabledTabs = getEnabledTabs();
  const currentTab = activeTab && enabledTabs.includes(activeTab) ? activeTab : enabledTabs[0];
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [nickname, setNickname] = useState("");
  const [nicknameError, setNicknameError] = useState("");
  const [isCheckingNickname, setIsCheckingNickname] = useState(false);
  const [generatedCredentials, setGeneratedCredentials] = useState<{ accountId: string; password: string } | null>(null);
  const [pendingUser, setPendingUser] = useState<any>(null);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordStep, setForgotPasswordStep] = useState<"request" | "reset">("request");
  const [resetToken, setResetToken] = useState("");
  
  const [accountLoginForm, setAccountLoginForm] = useState({ accountId: "", password: "" });
  const [phoneLoginForm, setPhoneLoginForm] = useState({ phone: "", password: "" });
  const [emailLoginForm, setEmailLoginForm] = useState({ username: "", password: "" });
  const [forgotPasswordForm, setForgotPasswordForm] = useState({ identifier: "", newPassword: "", confirmPassword: "" });

  useEffect(() => {
    fetch("/api/auth/settings")
      .then(res => res.json())
      .then(setAuthSettings)
      .catch(() => {});
    
    fetch("/api/social-platforms")
      .then(res => res.json())
      .then(setSocialPlatforms)
      .catch(() => {});
  }, []);

  const handleOneClickRegister = async () => {
    setIsLoading(true);
    try {
      const result = await oneClickRegister();
      setGeneratedCredentials(result.credentials);
      setPendingUser(result.user);
      setPendingToken(result.token);
      setShowCredentialsModal(true);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccountLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await loginByAccount(accountLoginForm.accountId, accountLoginForm.password);
      setLocation("/");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await loginByPhone(phoneLoginForm.phone, phoneLoginForm.password);
      setLocation("/");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(emailLoginForm.username, emailLoginForm.password);
      setLocation("/");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          accountId: forgotPasswordForm.identifier,
          email: forgotPasswordForm.identifier.includes("@") ? forgotPasswordForm.identifier : undefined,
          phone: forgotPasswordForm.identifier.match(/^[0-9+]+$/) ? forgotPasswordForm.identifier : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResetToken(data.token);
      setForgotPasswordStep("reset");
      toast({ title: "Success", description: "Reset token generated" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotPasswordForm.newPassword !== forgotPasswordForm.confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, newPassword: forgotPasswordForm.newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Success", description: "Password reset successfully" });
      setShowForgotPassword(false);
      setForgotPasswordStep("request");
      setForgotPasswordForm({ identifier: "", newPassword: "", confirmPassword: "" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast({ title: "Copied!", description: "Copied to clipboard" });
    setTimeout(() => setCopiedField(null), 2000);
  };

  const copyAllCredentials = () => {
    const text = `VEX Account Credentials\n\nAccount ID: ${generatedCredentials?.accountId}\nPassword: ${generatedCredentials?.password}\n\nKeep these safe!`;
    navigator.clipboard.writeText(text);
    setCopiedField("all");
    toast({ title: "Copied!", description: "All credentials copied to clipboard" });
    setTimeout(() => setCopiedField(null), 2000);
  };

  const shareCredentials = async () => {
    const text = `VEX Account Credentials\n\nAccount ID: ${generatedCredentials?.accountId}\nPassword: ${generatedCredentials?.password}\n\nKeep these safe!`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'VEX Account Credentials',
          text: text,
        });
      } catch (err) {
        copyAllCredentials();
      }
    } else {
      copyAllCredentials();
    }
  };

  const checkNicknameAvailability = async (value: string) => {
    if (value.length < 3) {
      setNicknameError("Nickname must be at least 3 characters");
      return false;
    }
    setIsCheckingNickname(true);
    try {
      const res = await fetch(`/api/user/check-nickname/${encodeURIComponent(value)}`);
      const data = await res.json();
      if (!data.available) {
        setNicknameError("Nickname already taken");
        return false;
      }
      setNicknameError("");
      return true;
    } catch {
      setNicknameError("Error checking nickname");
      return false;
    } finally {
      setIsCheckingNickname(false);
    }
  };

  const handleCredentialsSaved = async () => {
    setShowCredentialsModal(false);
    setShowNicknameModal(true);
  };

  const handleNicknameSubmit = async () => {
    const isAvailable = await checkNicknameAvailability(nickname);
    if (!isAvailable) return;

    try {
      setIsLoading(true);
      const token = pendingToken;
      const res = await fetch("/api/user/nickname", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ nickname }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast({ title: "Error", description: data.error || "Failed to set nickname", variant: "destructive" });
        return;
      }

      if (pendingUser && pendingToken) {
        confirmOneClickLogin(pendingUser, pendingToken);
      }
      setShowNicknameModal(false);
      setPendingUser(null);
      setPendingToken(null);
      setNickname("");
      setLocation("/");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md border-primary/20">
        <div className="p-6 text-center border-b border-border">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/20">
              <Gamepad2 className="w-10 h-10 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">VEX</h1>
          <p className="text-muted-foreground text-sm mt-1">Gaming & Trading Platform</p>
        </div>
        
        <CardContent className="p-0">
          <Tabs value={currentTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className={`w-full grid rounded-none border-b border-border h-auto p-0 bg-transparent`} style={{ gridTemplateColumns: `repeat(${enabledTabs.length}, 1fr)` }}>
              {enabledTabs.includes("one-click") && (
                <TabsTrigger 
                  value="one-click" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 text-xs"
                  data-testid="tab-one-click"
                >
                  <Zap className="w-4 h-4 mr-1" />
                  Quick
                </TabsTrigger>
              )}
              {enabledTabs.includes("account") && (
                <TabsTrigger 
                  value="account" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 text-xs"
                  data-testid="tab-account"
                >
                  <User className="w-4 h-4 mr-1" />
                  Account
                </TabsTrigger>
              )}
              {enabledTabs.includes("phone") && (
                <TabsTrigger 
                  value="phone" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 text-xs"
                  data-testid="tab-phone"
                >
                  <Smartphone className="w-4 h-4 mr-1" />
                  Phone
                </TabsTrigger>
              )}
              {enabledTabs.includes("email") && (
                <TabsTrigger 
                  value="email" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 text-xs"
                  data-testid="tab-email"
                >
                  <Mail className="w-4 h-4 mr-1" />
                  Email
                </TabsTrigger>
              )}
            </TabsList>
            
            <div className="p-6 space-y-4">
              {enabledTabs.includes("one-click") && (
                <TabsContent value="one-click" className="m-0 space-y-4">
                  <div className="text-center space-y-4">
                    <div className="p-4 bg-accent/10 rounded-md border border-accent/20">
                      <Zap className="w-12 h-12 text-accent mx-auto mb-2" />
                      <h3 className="font-semibold text-foreground">One-Click Registration</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Create an account instantly. Your login credentials will be generated automatically.
                      </p>
                    </div>
                    <Button 
                      onClick={handleOneClickRegister} 
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                      disabled={isLoading}
                      data-testid="button-one-click-register"
                    >
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                      Register in One Click
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      You will receive a unique account ID and password. Make sure to save them!
                    </p>
                  </div>
                </TabsContent>
              )}
              
              {enabledTabs.includes("account") && (
                <TabsContent value="account" className="m-0">
                  <form onSubmit={handleAccountLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="accountId">Account ID</Label>
                      <Input
                        id="accountId"
                        data-testid="input-account-id"
                        value={accountLoginForm.accountId}
                        onChange={e => setAccountLoginForm(prev => ({ ...prev, accountId: e.target.value }))}
                        placeholder="Enter your account ID"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="accountPassword">Password</Label>
                      <Input
                        id="accountPassword"
                        type="password"
                        data-testid="input-account-password"
                        value={accountLoginForm.password}
                        onChange={e => setAccountLoginForm(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Enter your password"
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-account-login">
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Sign In
                    </Button>
                  </form>
                </TabsContent>
              )}
              
              {enabledTabs.includes("phone") && (
                <TabsContent value="phone" className="m-0">
                  <form onSubmit={handlePhoneLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        data-testid="input-phone"
                        value={phoneLoginForm.phone}
                        onChange={e => setPhoneLoginForm(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="+1234567890"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phonePassword">Password</Label>
                      <Input
                        id="phonePassword"
                        type="password"
                        data-testid="input-phone-password"
                        value={phoneLoginForm.password}
                        onChange={e => setPhoneLoginForm(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Enter your password"
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-phone-login">
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Sign In
                    </Button>
                  </form>
                </TabsContent>
              )}
              
              {enabledTabs.includes("email") && (
                <TabsContent value="email" className="m-0">
                  <form onSubmit={handleEmailLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="username">Username / Email</Label>
                      <Input
                        id="username"
                        data-testid="input-username"
                        value={emailLoginForm.username}
                        onChange={e => setEmailLoginForm(prev => ({ ...prev, username: e.target.value }))}
                        placeholder="Enter username or email"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="emailPassword">Password</Label>
                      <Input
                        id="emailPassword"
                        type="password"
                        data-testid="input-email-password"
                        value={emailLoginForm.password}
                        onChange={e => setEmailLoginForm(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Enter your password"
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-email-login">
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Sign In
                    </Button>
                  </form>
                </TabsContent>
              )}
              
              <div className="pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 mx-auto"
                  data-testid="button-forgot-password"
                >
                  <KeyRound className="w-3 h-3" />
                  Forgot Password?
                </button>
              </div>
              
              {socialPlatforms.length > 0 && (
                <div className="pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground text-center mb-3">Or continue with</p>
                  <div className="flex justify-center gap-3 flex-wrap">
                    {socialPlatforms.map((platform) => {
                      const Icon = PLATFORM_ICONS[platform.icon];
                      return (
                        <Button
                          key={platform.id}
                          variant="outline"
                          size="icon"
                          className="w-12 h-12 rounded-full"
                          data-testid={`button-${platform.name}-login`}
                        >
                          {Icon && <Icon className="w-5 h-5" />}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={showCredentialsModal} onOpenChange={setShowCredentialsModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Check className="w-5 h-5" />
              Account Created Successfully!
            </DialogTitle>
            <DialogDescription>
              Please save your login credentials. You will need them to access your account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-md">
              <p className="text-sm text-destructive font-medium">
                Save these credentials now! They will not be shown again.
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                <div>
                  <p className="text-xs text-muted-foreground">Account ID</p>
                  <p className="font-mono font-bold text-lg" data-testid="text-generated-account-id">
                    {generatedCredentials?.accountId}
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => copyToClipboard(generatedCredentials?.accountId || "", "accountId")}
                  data-testid="button-copy-account-id"
                >
                  {copiedField === "accountId" ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                <div>
                  <p className="text-xs text-muted-foreground">Password</p>
                  <p className="font-mono font-bold text-lg" data-testid="text-generated-password">
                    {generatedCredentials?.password}
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => copyToClipboard(generatedCredentials?.password || "", "password")}
                  data-testid="button-copy-password"
                >
                  {copiedField === "password" ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={copyAllCredentials} 
                className="flex-1" 
                data-testid="button-copy-all"
              >
                <Copy className="w-4 h-4 me-2" />
                {copiedField === "all" ? "Copied!" : "Copy All"}
              </Button>
              <Button 
                variant="outline" 
                onClick={shareCredentials} 
                className="flex-1" 
                data-testid="button-share-credentials"
              >
                <Share2 className="w-4 h-4 me-2" />
                Share
              </Button>
            </div>
            
            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground text-center mb-3">Share via</p>
              <div className="flex justify-center gap-3 flex-wrap">
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => {
                    const text = encodeURIComponent(`VEX Account\nAccount ID: ${generatedCredentials?.accountId}\nPassword: ${generatedCredentials?.password}`);
                    window.open(`https://wa.me/?text=${text}`, '_blank');
                  }}
                  data-testid="button-share-whatsapp"
                  className="bg-[#25D366]/10 hover:bg-[#25D366]/20 border-[#25D366]/30"
                >
                  <SiWhatsapp className="w-4 h-4 text-[#25D366]" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => {
                    const text = encodeURIComponent(`VEX Account\nAccount ID: ${generatedCredentials?.accountId}\nPassword: ${generatedCredentials?.password}`);
                    window.open(`https://t.me/share/url?text=${text}`, '_blank');
                  }}
                  data-testid="button-share-telegram"
                  className="bg-[#0088cc]/10 hover:bg-[#0088cc]/20 border-[#0088cc]/30"
                >
                  <SiTelegram className="w-4 h-4 text-[#0088cc]" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => {
                    const text = encodeURIComponent(`VEX Account\nAccount ID: ${generatedCredentials?.accountId}\nPassword: ${generatedCredentials?.password}`);
                    window.open(`mailto:?subject=VEX Account Credentials&body=${text}`, '_blank');
                  }}
                  data-testid="button-share-email"
                  className="bg-muted hover:bg-muted/80"
                >
                  <Mail className="w-4 h-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => {
                    const text = encodeURIComponent(`VEX Account\nAccount ID: ${generatedCredentials?.accountId}\nPassword: ${generatedCredentials?.password}`);
                    window.open(`sms:?body=${text}`, '_blank');
                  }}
                  data-testid="button-share-sms"
                  className="bg-muted hover:bg-muted/80"
                >
                  <Smartphone className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <Button onClick={handleCredentialsSaved} className="w-full" data-testid="button-credentials-saved">
              I have saved my credentials
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5" />
              {forgotPasswordStep === "request" ? "Reset Password" : "Set New Password"}
            </DialogTitle>
            <DialogDescription>
              {forgotPasswordStep === "request" 
                ? "Enter your account ID, email, or phone number to reset your password."
                : "Enter your new password below."}
            </DialogDescription>
          </DialogHeader>
          {forgotPasswordStep === "request" ? (
            <form onSubmit={handleForgotPassword} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="identifier">Account ID / Email / Phone</Label>
                <Input
                  id="identifier"
                  data-testid="input-forgot-identifier"
                  value={forgotPasswordForm.identifier}
                  onChange={e => setForgotPasswordForm(prev => ({ ...prev, identifier: e.target.value }))}
                  placeholder="Enter your account ID, email, or phone"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-request-reset">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Request Reset
              </Button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  data-testid="input-new-password"
                  value={forgotPasswordForm.newPassword}
                  onChange={e => setForgotPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="Enter new password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  data-testid="input-confirm-password"
                  value={forgotPasswordForm.confirmPassword}
                  onChange={e => setForgotPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Confirm new password"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-reset-password">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reset Password
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showNicknameModal} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Choose Your Nickname
            </DialogTitle>
            <DialogDescription>
              Choose a unique nickname that other users will see. This is required to complete registration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nickname">Nickname</Label>
              <div className="relative">
                <Input
                  id="nickname"
                  data-testid="input-nickname"
                  value={nickname}
                  onChange={(e) => {
                    setNickname(e.target.value);
                    setNicknameError("");
                  }}
                  onBlur={() => nickname.length >= 3 && checkNicknameAvailability(nickname)}
                  placeholder="Enter your unique nickname"
                  className={nicknameError ? "border-destructive" : ""}
                />
                {isCheckingNickname && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {nicknameError && (
                <p className="text-xs text-destructive">{nicknameError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Minimum 3 characters. This will be visible to other users.
              </p>
            </div>
            <Button
              onClick={handleNicknameSubmit}
              disabled={isLoading || isCheckingNickname || nickname.length < 3}
              className="w-full"
              data-testid="button-set-nickname"
            >
              {isLoading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              Set Nickname
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
