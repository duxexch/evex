import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Wallet, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  History, 
  CreditCard,
  Building2,
  Smartphone,
  Bitcoin,
  Eye,
  EyeOff,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw
} from "lucide-react";

export default function WalletPage() {
  const { t, language } = useI18n();
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [isBalanceHidden, setIsBalanceHidden] = useState(() => {
    return localStorage.getItem('hideBalance') === 'true';
  });

  const { data: transactions, isLoading: loadingTransactions } = useQuery<any[]>({
    queryKey: ['/api/transactions'],
  });

  const { data: walletStats } = useQuery<any>({
    queryKey: ['/api/wallet/stats'],
  });

  const depositMutation = useMutation({
    mutationFn: (data: { amount: number; paymentMethod: string }) =>
      apiRequest('/api/transactions/deposit', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: t('common.success'), description: t('wallet.depositSuccess') });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      refreshUser?.();
      setShowDeposit(false);
      setDepositAmount("");
    },
    onError: (err: any) => {
      toast({ title: t('common.error'), description: err.message, variant: "destructive" });
    }
  });

  const withdrawMutation = useMutation({
    mutationFn: (data: { amount: number; paymentMethod: string }) =>
      apiRequest('/api/transactions/withdraw', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: t('common.success'), description: t('wallet.withdrawSuccess') });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      refreshUser?.();
      setShowWithdraw(false);
      setWithdrawAmount("");
    },
    onError: (err: any) => {
      toast({ title: t('common.error'), description: err.message, variant: "destructive" });
    }
  });

  const toggleBalanceVisibility = () => {
    const newValue = !isBalanceHidden;
    setIsBalanceHidden(newValue);
    localStorage.setItem('hideBalance', String(newValue));
  };

  const recentTransactions = transactions?.slice(0, 10) || [];

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit': return <ArrowDownToLine className="h-4 w-4 text-green-500" />;
      case 'withdrawal': return <ArrowUpFromLine className="h-4 w-4 text-red-500" />;
      case 'bet': return <TrendingDown className="h-4 w-4 text-orange-500" />;
      case 'win': return <TrendingUp className="h-4 w-4 text-green-500" />;
      default: return <History className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 me-1" />{t('wallet.completed')}</Badge>;
      case 'pending': return <Badge variant="secondary"><Clock className="h-3 w-3 me-1" />{t('wallet.pending')}</Badge>;
      case 'rejected': return <Badge variant="destructive"><XCircle className="h-3 w-3 me-1" />{t('wallet.rejected')}</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const paymentMethods = [
    { id: 'bank', name: t('wallet.bankTransfer'), icon: Building2 },
    { id: 'card', name: t('wallet.creditCard'), icon: CreditCard },
    { id: 'ewallet', name: t('wallet.eWallet'), icon: Smartphone },
    { id: 'crypto', name: t('wallet.crypto'), icon: Bitcoin },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-7 w-7 text-primary" />
            {t('wallet.title')}
          </h1>
          <p className="text-muted-foreground">{t('wallet.description')}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle>{t('wallet.currentBalance')}</CardTitle>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={toggleBalanceVisibility}
                data-testid="button-toggle-wallet-balance"
              >
                {isBalanceHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary balance-glow mb-4" data-testid="text-wallet-balance">
              {isBalanceHidden ? '******' : `$${parseFloat(user?.balance || "0").toFixed(2)}`}
            </div>
            <div className="flex gap-3 flex-wrap">
              <Button onClick={() => setShowDeposit(true)} data-testid="button-deposit">
                <ArrowDownToLine className="h-4 w-4 me-2" />
                {t('wallet.deposit')}
              </Button>
              <Button variant="outline" onClick={() => setShowWithdraw(true)} data-testid="button-withdraw">
                <ArrowUpFromLine className="h-4 w-4 me-2" />
                {t('wallet.withdraw')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('wallet.quickStats')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('wallet.totalDeposited')}</span>
              <span className="font-medium text-green-500">${parseFloat(user?.totalDeposited || "0").toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('wallet.totalWithdrawn')}</span>
              <span className="font-medium text-red-500">${parseFloat(user?.totalWithdrawn || "0").toFixed(2)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('wallet.totalWagered')}</span>
              <span className="font-medium">${parseFloat(user?.totalWagered || "0").toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('wallet.totalWon')}</span>
              <span className="font-medium text-primary">${parseFloat(user?.totalWon || "0").toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            {t('wallet.recentTransactions')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTransactions ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse h-16 bg-muted rounded-lg" />
              ))}
            </div>
          ) : recentTransactions.length > 0 ? (
            <div className="space-y-3">
              {recentTransactions.map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg" data-testid={`row-transaction-${tx.id}`}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-background">
                      {getTransactionIcon(tx.type)}
                    </div>
                    <div>
                      <p className="font-medium capitalize">{t(`wallet.type.${tx.type}`)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-bold ${tx.type === 'deposit' || tx.type === 'win' ? 'text-green-500' : 'text-red-500'}`}>
                      {tx.type === 'deposit' || tx.type === 'win' ? '+' : '-'}${parseFloat(tx.amount).toFixed(2)}
                    </span>
                    {getStatusBadge(tx.status)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('wallet.noTransactions')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDeposit} onOpenChange={setShowDeposit}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownToLine className="h-5 w-5 text-green-500" />
              {t('wallet.deposit')}
            </DialogTitle>
            <DialogDescription>{t('wallet.depositDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('wallet.amount')}</Label>
              <Input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.00"
                className="mt-2"
                data-testid="input-deposit-amount"
              />
            </div>
            <div>
              <Label>{t('wallet.paymentMethod')}</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {paymentMethods.map(method => {
                  const Icon = method.icon;
                  return (
                    <Button
                      key={method.id}
                      variant={paymentMethod === method.id ? "default" : "outline"}
                      className="h-auto py-3 flex-col"
                      onClick={() => setPaymentMethod(method.id)}
                      data-testid={`button-method-${method.id}`}
                    >
                      <Icon className="h-5 w-5 mb-1" />
                      <span className="text-xs">{method.name}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeposit(false)}>{t('common.cancel')}</Button>
            <Button 
              onClick={() => depositMutation.mutate({ amount: parseFloat(depositAmount), paymentMethod })}
              disabled={!depositAmount || !paymentMethod || depositMutation.isPending}
              data-testid="button-confirm-deposit"
            >
              {depositMutation.isPending && <RefreshCw className="h-4 w-4 me-2 animate-spin" />}
              {t('wallet.confirmDeposit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showWithdraw} onOpenChange={setShowWithdraw}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpFromLine className="h-5 w-5 text-red-500" />
              {t('wallet.withdraw')}
            </DialogTitle>
            <DialogDescription>{t('wallet.withdrawDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg text-sm">
              <span className="text-muted-foreground">{t('wallet.availableBalance')}: </span>
              <span className="font-bold text-primary">${parseFloat(user?.balance || "0").toFixed(2)}</span>
            </div>
            <div>
              <Label>{t('wallet.amount')}</Label>
              <Input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="0.00"
                className="mt-2"
                data-testid="input-withdraw-amount"
              />
            </div>
            <div>
              <Label>{t('wallet.paymentMethod')}</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {paymentMethods.map(method => {
                  const Icon = method.icon;
                  return (
                    <Button
                      key={method.id}
                      variant={paymentMethod === method.id ? "default" : "outline"}
                      className="h-auto py-3 flex-col"
                      onClick={() => setPaymentMethod(method.id)}
                    >
                      <Icon className="h-5 w-5 mb-1" />
                      <span className="text-xs">{method.name}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWithdraw(false)}>{t('common.cancel')}</Button>
            <Button 
              onClick={() => withdrawMutation.mutate({ amount: parseFloat(withdrawAmount), paymentMethod })}
              disabled={!withdrawAmount || !paymentMethod || withdrawMutation.isPending || parseFloat(withdrawAmount) > parseFloat(user?.balance || "0")}
              data-testid="button-confirm-withdraw"
            >
              {withdrawMutation.isPending && <RefreshCw className="h-4 w-4 me-2 animate-spin" />}
              {t('wallet.confirmWithdraw')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
