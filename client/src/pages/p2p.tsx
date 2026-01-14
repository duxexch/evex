import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useWebSocket } from "@/lib/websocket";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Wallet, Plus, ArrowUpRight, ArrowDownRight, Star, Filter, RefreshCw, Trash2, Edit2, Check, ChevronsUpDown, AlertTriangle, MessageSquare, Upload, FileCheck, Camera, Video, Ban, Clock, ChevronRight, Send, Paperclip, Eye, Shield, Scale, History, User, Settings } from "lucide-react";
import { Link } from "wouter";
import { BackButton } from "@/components/BackButton";
import { cn } from "@/lib/utils";

const WORLD_CURRENCIES = [
  { code: "all", name: "All Currencies" },
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "AED", name: "UAE Dirham" },
  { code: "SAR", name: "Saudi Riyal" },
  { code: "EGP", name: "Egyptian Pound" },
  { code: "KWD", name: "Kuwaiti Dinar" },
  { code: "QAR", name: "Qatari Riyal" },
  { code: "BHD", name: "Bahraini Dinar" },
  { code: "OMR", name: "Omani Rial" },
  { code: "JOD", name: "Jordanian Dinar" },
  { code: "LBP", name: "Lebanese Pound" },
  { code: "IQD", name: "Iraqi Dinar" },
  { code: "SYP", name: "Syrian Pound" },
  { code: "TRY", name: "Turkish Lira" },
  { code: "INR", name: "Indian Rupee" },
  { code: "PKR", name: "Pakistani Rupee" },
  { code: "BDT", name: "Bangladeshi Taka" },
  { code: "IDR", name: "Indonesian Rupiah" },
  { code: "MYR", name: "Malaysian Ringgit" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "THB", name: "Thai Baht" },
  { code: "VND", name: "Vietnamese Dong" },
  { code: "PHP", name: "Philippine Peso" },
  { code: "KRW", name: "South Korean Won" },
  { code: "HKD", name: "Hong Kong Dollar" },
  { code: "TWD", name: "Taiwan Dollar" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "NZD", name: "New Zealand Dollar" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "SEK", name: "Swedish Krona" },
  { code: "NOK", name: "Norwegian Krone" },
  { code: "DKK", name: "Danish Krone" },
  { code: "PLN", name: "Polish Zloty" },
  { code: "CZK", name: "Czech Koruna" },
  { code: "HUF", name: "Hungarian Forint" },
  { code: "RON", name: "Romanian Leu" },
  { code: "BGN", name: "Bulgarian Lev" },
  { code: "HRK", name: "Croatian Kuna" },
  { code: "RUB", name: "Russian Ruble" },
  { code: "UAH", name: "Ukrainian Hryvnia" },
  { code: "ZAR", name: "South African Rand" },
  { code: "NGN", name: "Nigerian Naira" },
  { code: "KES", name: "Kenyan Shilling" },
  { code: "GHS", name: "Ghanaian Cedi" },
  { code: "MAD", name: "Moroccan Dirham" },
  { code: "TND", name: "Tunisian Dinar" },
  { code: "DZD", name: "Algerian Dinar" },
  { code: "BRL", name: "Brazilian Real" },
  { code: "MXN", name: "Mexican Peso" },
  { code: "ARS", name: "Argentine Peso" },
  { code: "CLP", name: "Chilean Peso" },
  { code: "COP", name: "Colombian Peso" },
  { code: "PEN", name: "Peruvian Sol" },
  { code: "USDT", name: "Tether USDT" },
  { code: "USDC", name: "USD Coin" },
  { code: "BTC", name: "Bitcoin" },
  { code: "ETH", name: "Ethereum" },
  { code: "BNB", name: "Binance Coin" },
  { code: "XRP", name: "Ripple" },
  { code: "SOL", name: "Solana" },
  { code: "DOGE", name: "Dogecoin" },
  { code: "LTC", name: "Litecoin" },
  { code: "TRX", name: "TRON" },
  { code: "MATIC", name: "Polygon" },
  { code: "DOT", name: "Polkadot" },
  { code: "AVAX", name: "Avalanche" },
  { code: "LINK", name: "Chainlink" },
  { code: "XLM", name: "Stellar" },
  { code: "ATOM", name: "Cosmos" },
  { code: "VET", name: "VeChain" },
  { code: "FIL", name: "Filecoin" },
  { code: "ICP", name: "Internet Computer" },
  { code: "APT", name: "Aptos" },
  { code: "ARB", name: "Arbitrum" },
  { code: "OP", name: "Optimism" },
  { code: "YER", name: "Yemeni Rial" },
  { code: "AFN", name: "Afghan Afghani" },
  { code: "ALL", name: "Albanian Lek" },
  { code: "AMD", name: "Armenian Dram" },
  { code: "AZN", name: "Azerbaijani Manat" },
  { code: "BAM", name: "Bosnia Mark" },
  { code: "BYN", name: "Belarusian Ruble" },
  { code: "GEL", name: "Georgian Lari" },
  { code: "ISK", name: "Icelandic Krona" },
  { code: "MKD", name: "Macedonian Denar" },
  { code: "MDL", name: "Moldovan Leu" },
  { code: "RSD", name: "Serbian Dinar" },
  { code: "LYD", name: "Libyan Dinar" },
  { code: "SDG", name: "Sudanese Pound" },
  { code: "ETB", name: "Ethiopian Birr" },
  { code: "TZS", name: "Tanzanian Shilling" },
  { code: "UGX", name: "Ugandan Shilling" },
  { code: "ZMW", name: "Zambian Kwacha" },
  { code: "BWP", name: "Botswana Pula" },
  { code: "MUR", name: "Mauritian Rupee" },
  { code: "XOF", name: "West African CFA" },
  { code: "XAF", name: "Central African CFA" },
  { code: "UYU", name: "Uruguayan Peso" },
  { code: "PYG", name: "Paraguayan Guarani" },
  { code: "BOB", name: "Bolivian Boliviano" },
  { code: "VES", name: "Venezuelan Bolivar" },
  { code: "CRC", name: "Costa Rican Colon" },
  { code: "GTQ", name: "Guatemalan Quetzal" },
  { code: "HNL", name: "Honduran Lempira" },
  { code: "NIO", name: "Nicaraguan Cordoba" },
  { code: "PAB", name: "Panamanian Balboa" },
  { code: "DOP", name: "Dominican Peso" },
  { code: "JMD", name: "Jamaican Dollar" },
  { code: "TTD", name: "Trinidad Dollar" },
  { code: "BBD", name: "Barbados Dollar" },
  { code: "BSD", name: "Bahamian Dollar" },
  { code: "KZT", name: "Kazakhstani Tenge" },
  { code: "UZS", name: "Uzbekistani Som" },
  { code: "TMT", name: "Turkmen Manat" },
  { code: "KGS", name: "Kyrgystani Som" },
  { code: "TJS", name: "Tajikistani Somoni" },
  { code: "MNT", name: "Mongolian Tugrik" },
  { code: "NPR", name: "Nepalese Rupee" },
  { code: "LKR", name: "Sri Lankan Rupee" },
  { code: "MMK", name: "Myanmar Kyat" },
  { code: "KHR", name: "Cambodian Riel" },
  { code: "LAK", name: "Laotian Kip" },
  { code: "BND", name: "Brunei Dollar" },
  { code: "FJD", name: "Fijian Dollar" },
  { code: "PGK", name: "Papua New Guinea Kina" },
];

interface P2POffer {
  id: string;
  userId: string;
  username: string;
  type: "buy" | "sell";
  amount: string;
  price: string;
  currency: string;
  minLimit: string;
  maxLimit: string;
  paymentMethods: string[];
  rating: number;
  completedTrades: number;
  status: "active" | "inactive" | "completed";
  createdAt: string;
}

interface P2PTrade {
  id: string;
  offerId: string;
  buyerId: string;
  sellerId: string;
  amount: string;
  price: string;
  totalPrice: string;
  status: "pending" | "processing" | "completed" | "cancelled" | "disputed";
  createdAt: string;
  completedAt: string | null;
  counterpartyUsername: string;
}

interface P2PDispute {
  id: string;
  tradeId: string;
  initiatorId: string;
  initiatorName?: string;
  respondentId: string;
  respondentName: string;
  status: "open" | "investigating" | "resolved" | "closed";
  reason: string;
  description: string;
  stage: "peer_negotiation" | "support_review" | "resolved";
  peerNegotiationEndsAt: string;
  tradeAmount: string;
  tradeFiatAmount: string;
  createdAt: string;
}

interface P2PDisputeMessage {
  id: string;
  disputeId: string;
  senderId: string;
  senderName: string;
  message: string;
  isPrewritten: boolean;
  isFromSupport: boolean;
  createdAt: string;
}

interface P2PDisputeEvidence {
  id: string;
  disputeId: string;
  uploaderId: string;
  uploaderName: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  description: string;
  evidenceType: string;
  isVerified: boolean;
  createdAt: string;
}

interface P2PTransactionLog {
  id: string;
  tradeId: string;
  disputeId?: string;
  userId: string;
  action: string;
  description: string;
  descriptionAr?: string;
  createdAt: string;
}

interface PrewrittenResponse {
  id: string;
  category: string;
  title: string;
  titleAr?: string;
  message: string;
  messageAr?: string;
}

interface DisputeRule {
  id: string;
  category: string;
  title: string;
  titleAr?: string;
  content: string;
  contentAr?: string;
  icon: string;
}

const createOfferSchema = z.object({
  type: z.enum(["buy", "sell"]),
  amount: z.string().min(1, "Amount is required"),
  price: z.string().min(1, "Price is required"),
  currency: z.string().min(1, "Currency is required"),
  minLimit: z.string().min(1, "Min limit is required"),
  maxLimit: z.string().min(1, "Max limit is required"),
  paymentMethods: z.string().min(1, "Select at least one payment method"),
});

type CreateOfferForm = z.infer<typeof createOfferSchema>;

function MarketplaceTab() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [currencyFilter, setCurrencyFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [currencyOpen, setCurrencyOpen] = useState(false);

  const { data: offers, isLoading, refetch } = useQuery<P2POffer[]>({
    queryKey: ["/api/p2p/offers", { type: typeFilter, currency: currencyFilter, payment: paymentFilter }],
    staleTime: 30_000,
    gcTime: 60_000,
  });

  const filteredOffers = offers?.filter(offer => {
    if (typeFilter !== "all" && offer.type !== typeFilter) return false;
    if (currencyFilter !== "all" && offer.currency !== currencyFilter) return false;
    if (paymentFilter !== "all" && !offer.paymentMethods.includes(paymentFilter)) return false;
    return true;
  }) || [];

  const handleTrade = (offerId: string) => {
    toast({
      title: t('p2p.tradeInitiated'),
      description: t('p2p.tradeInitiatedDesc'),
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      inactive: "secondary",
      completed: "outline",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full" data-testid="select-type-filter">
            <SelectValue placeholder={t('p2p.type')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('p2p.all')}</SelectItem>
            <SelectItem value="buy">{t('p2p.buy')}</SelectItem>
            <SelectItem value="sell">{t('p2p.sell')}</SelectItem>
          </SelectContent>
        </Select>
        <Popover open={currencyOpen} onOpenChange={setCurrencyOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={currencyOpen}
              className="w-full justify-between font-normal"
              data-testid="select-currency-filter"
            >
              {currencyFilter === "all" ? t('p2p.all') : currencyFilter}
              <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command>
              <CommandInput placeholder={t('p2p.searchCurrency')} />
              <CommandList>
                <CommandEmpty>{t('p2p.noCurrencyFound')}</CommandEmpty>
                <CommandGroup>
                  {WORLD_CURRENCIES.map((currency) => (
                    <CommandItem
                      key={currency.code}
                      value={`${currency.code} ${currency.name}`}
                      onSelect={() => {
                        setCurrencyFilter(currency.code);
                        setCurrencyOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "me-2 h-4 w-4",
                          currencyFilter === currency.code ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="font-medium">{currency.code}</span>
                      <span className="ms-2 text-muted-foreground text-xs truncate">{currency.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-full" data-testid="select-payment-filter">
            <SelectValue placeholder={t('p2p.paymentMethod')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('p2p.all')}</SelectItem>
            <SelectItem value="bank_transfer">{t('p2p.bankTransfer')}</SelectItem>
            <SelectItem value="vodafone_cash">{t('p2p.vodafoneCash')}</SelectItem>
            <SelectItem value="instapay">{t('p2p.instapay')}</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" className="w-full" onClick={() => refetch()} data-testid="button-refresh-offers">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {filteredOffers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">{t('p2p.noOffers')}</h3>
            <p className="text-sm text-muted-foreground">{t('p2p.noOffersDesc')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('p2p.trader')}</TableHead>
                <TableHead>{t('p2p.type')}</TableHead>
                <TableHead>{t('common.amount')}</TableHead>
                <TableHead>{t('p2p.price')}</TableHead>
                <TableHead>{t('p2p.limit')}</TableHead>
                <TableHead>{t('p2p.paymentMethods')}</TableHead>
                <TableHead>{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOffers.map((offer) => (
                <TableRow key={offer.id} data-testid={`row-offer-${offer.id}`}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium" data-testid={`text-trader-${offer.id}`}>{offer.username}</span>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                        <span>{offer.rating.toFixed(1)}</span>
                        <span>({offer.completedTrades} {t('p2p.trades')})</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={offer.type === "buy" ? "default" : "secondary"}>
                      {offer.type === "buy" ? t('p2p.buy') : t('p2p.sell')}
                    </Badge>
                  </TableCell>
                  <TableCell data-testid={`text-amount-${offer.id}`}>
                    {offer.amount} {offer.currency}
                  </TableCell>
                  <TableCell data-testid={`text-price-${offer.id}`}>${offer.price}</TableCell>
                  <TableCell>
                    ${offer.minLimit} - ${offer.maxLimit}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {offer.paymentMethods.map((method) => (
                        <Badge key={method} variant="outline">
                          {method.replace("_", " ")}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      onClick={() => handleTrade(offer.id)}
                      data-testid={`button-trade-${offer.id}`}
                    >
                      {t('p2p.trade')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function MyOffersTab() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { data: myOffers, isLoading } = useQuery<P2POffer[]>({
    queryKey: ["/api/p2p/my-offers"],
    staleTime: 30_000,
    gcTime: 60_000,
  });

  const form = useForm<CreateOfferForm>({
    resolver: zodResolver(createOfferSchema),
    defaultValues: {
      type: "sell",
      amount: "",
      price: "",
      currency: "USD",
      minLimit: "",
      maxLimit: "",
      paymentMethods: "",
    },
  });

  const createOfferMutation = useMutation({
    mutationFn: async (data: CreateOfferForm) => {
      const res = await apiRequest("POST", "/api/p2p/offers", {
        ...data,
        paymentMethods: data.paymentMethods.split(",").map(m => m.trim()),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/p2p/my-offers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/p2p/offers"] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({
        title: t('common.success'),
        description: t('p2p.offerCreated'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteOfferMutation = useMutation({
    mutationFn: async (offerId: string) => {
      const res = await apiRequest("DELETE", `/api/p2p/offers/${offerId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/p2p/my-offers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/p2p/offers"] });
      toast({
        title: t('common.success'),
        description: t('p2p.offerDeleted'),
      });
    },
  });

  const onSubmit = (data: CreateOfferForm) => {
    createOfferMutation.mutate(data);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      inactive: "secondary",
      completed: "outline",
    };
    const labels: Record<string, string> = {
      active: t('p2p.statusActive'),
      inactive: t('p2p.statusInactive'),
      completed: t('p2p.statusCompleted'),
    };
    return <Badge variant={variants[status] || "default"} >{labels[status] || status}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">{t('p2p.yourOffers')}</h3>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-offer">
              <Plus className="h-4 w-4 me-2" />
              {t('p2p.createOffer')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('p2p.createOffer')}</DialogTitle>
              <DialogDescription>{t('p2p.createOfferDesc')}</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('p2p.type')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-offer-type">
                            <SelectValue placeholder={t('p2p.selectType')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="buy">{t('p2p.buy')}</SelectItem>
                          <SelectItem value="sell">{t('p2p.sell')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('common.amount')}</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" placeholder="100" data-testid="input-offer-amount" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('p2p.currency')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-offer-currency">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="USDT">USDT</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('p2p.price')} (USD)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" placeholder="1.00" data-testid="input-offer-price" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="minLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('p2p.minLimit')}</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" placeholder="10" data-testid="input-offer-min" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="maxLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('p2p.maxLimit')}</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" placeholder="1000" data-testid="input-offer-max" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="paymentMethods"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('p2p.paymentMethods')}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="bank_transfer, vodafone_cash" data-testid="input-offer-payment" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" disabled={createOfferMutation.isPending} data-testid="button-submit-offer">
                    {createOfferMutation.isPending ? t('common.loading') : t('common.submit')}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {!myOffers || myOffers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Plus className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">{t('p2p.noMyOffers')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t('p2p.noMyOffersDesc')}</p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 me-2" />
              {t('p2p.createFirstOffer')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('p2p.type')}</TableHead>
                <TableHead>{t('common.amount')}</TableHead>
                <TableHead>{t('p2p.price')}</TableHead>
                <TableHead>{t('p2p.limit')}</TableHead>
                <TableHead>{t('p2p.paymentMethods')}</TableHead>
                <TableHead>{t('common.status')}</TableHead>
                <TableHead>{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myOffers.map((offer) => (
                <TableRow key={offer.id} data-testid={`row-my-offer-${offer.id}`}>
                  <TableCell>
                    <Badge variant={offer.type === "buy" ? "default" : "secondary"}>
                      {offer.type === "buy" ? t('p2p.buy') : t('p2p.sell')}
                    </Badge>
                  </TableCell>
                  <TableCell>{offer.amount} {offer.currency}</TableCell>
                  <TableCell>${offer.price}</TableCell>
                  <TableCell>${offer.minLimit} - ${offer.maxLimit}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {offer.paymentMethods.map((method) => (
                        <Badge key={method} variant="outline">
                          {method.replace("_", " ")}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(offer.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" data-testid={`button-edit-offer-${offer.id}`}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteOfferMutation.mutate(offer.id)}
                        disabled={deleteOfferMutation.isPending}
                        data-testid={`button-delete-offer-${offer.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function MyTradesTab() {
  const { t } = useI18n();

  const { data: trades, isLoading } = useQuery<P2PTrade[]>({
    queryKey: ["/api/p2p/my-trades"],
    staleTime: 60_000,
    gcTime: 120_000,
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      processing: "default",
      completed: "outline",
      cancelled: "destructive",
      disputed: "destructive",
    };
    const labels: Record<string, string> = {
      pending: t('p2p.tradePending'),
      processing: t('p2p.tradeProcessing'),
      completed: t('p2p.tradeCompleted'),
      cancelled: t('p2p.tradeCancelled'),
      disputed: t('p2p.tradeDisputed'),
    };
    return <Badge variant={variants[status] || "default"} >{labels[status] || status}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">{t('p2p.tradeHistory')}</h3>

      {!trades || trades.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ArrowUpRight className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">{t('p2p.noTrades')}</h3>
            <p className="text-sm text-muted-foreground">{t('p2p.noTradesDesc')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('p2p.tradeId')}</TableHead>
                <TableHead>{t('p2p.counterparty')}</TableHead>
                <TableHead>{t('common.amount')}</TableHead>
                <TableHead>{t('p2p.totalPrice')}</TableHead>
                <TableHead>{t('common.status')}</TableHead>
                <TableHead>{t('common.date')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades.map((trade) => (
                <TableRow key={trade.id} data-testid={`row-trade-${trade.id}`}>
                  <TableCell className="font-mono text-sm" data-testid={`text-trade-id-${trade.id}`}>
                    {trade.id.slice(0, 8)}...
                  </TableCell>
                  <TableCell data-testid={`text-counterparty-${trade.id}`}>
                    {trade.counterpartyUsername}
                  </TableCell>
                  <TableCell data-testid={`text-trade-amount-${trade.id}`}>
                    {trade.amount}
                  </TableCell>
                  <TableCell data-testid={`text-trade-total-${trade.id}`}>
                    ${trade.totalPrice}
                  </TableCell>
                  <TableCell>{getStatusBadge(trade.status)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(trade.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

const DISPUTE_REASONS = [
  { category: 'payment', reasons: [
    { id: 'no_payment', icon: Ban },
    { id: 'underpaid', icon: ArrowDownRight },
    { id: 'overpaid', icon: ArrowUpRight },
    { id: 'payment_pending', icon: Clock },
    { id: 'wrong_payment_method', icon: AlertTriangle },
  ]},
  { category: 'release', reasons: [
    { id: 'crypto_not_released', icon: Ban },
    { id: 'wrong_amount_released', icon: AlertTriangle },
  ]},
  { category: 'conduct', reasons: [
    { id: 'unresponsive', icon: Clock },
    { id: 'abusive', icon: Ban },
    { id: 'suspected_fraud', icon: Shield },
  ]},
  { category: 'compliance', reasons: [
    { id: 'name_mismatch', icon: AlertTriangle },
    { id: 'third_party_payment', icon: AlertTriangle },
    { id: 'chargeback_threat', icon: Ban },
  ]},
  { category: 'other', reasons: [
    { id: 'system_error', icon: AlertTriangle },
    { id: 'other', icon: MessageSquare },
  ]},
];

function DisputesTab() {
  const { t, language } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedDispute, setSelectedDispute] = useState<string | null>(null);
  const [showFileDispute, setShowFileDispute] = useState(false);
  const [disputeStep, setDisputeStep] = useState(1);
  const [selectedTrade, setSelectedTrade] = useState<P2PTrade | null>(null);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [additionalDetails, setAdditionalDetails] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

  const { data: disputes, isLoading: disputesLoading, refetch: refetchDisputes } = useQuery<P2PDispute[]>({
    queryKey: ['/api/p2p/disputes'],
  });

  const { data: trades } = useQuery<P2PTrade[]>({
    queryKey: ['/api/p2p/my-trades'],
  });

  const { data: disputeDetails, refetch: refetchDispute } = useQuery<{
    dispute: P2PDispute;
    messages: P2PDisputeMessage[];
    evidence: P2PDisputeEvidence[];
    logs: P2PTransactionLog[];
  }>({
    queryKey: ['/api/p2p/disputes', selectedDispute],
    enabled: !!selectedDispute,
  });

  const createDisputeMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", `/api/p2p/disputes`, data);
    },
    onSuccess: () => {
      toast({ title: t('p2p.dispute.submitted'), description: t('p2p.dispute.submittedDesc') });
      setShowFileDispute(false);
      resetDisputeForm();
      refetchDisputes();
    },
    onError: (err: any) => {
      toast({ title: t('common.error'), description: err.message, variant: "destructive" });
    }
  });

  const respondDisputeMutation = useMutation({
    mutationFn: async (data: { action: string; evidence?: File[]; details?: string }) => {
      return apiRequest("POST", `/api/p2p/disputes/${selectedDispute}/respond`, data);
    },
    onSuccess: () => {
      toast({ title: t('common.success') });
      refetchDispute();
    },
  });

  const resetDisputeForm = () => {
    setDisputeStep(1);
    setSelectedTrade(null);
    setSelectedReason(null);
    setUploadedFiles([]);
    setAdditionalDetails("");
    setAcknowledged(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files).filter(f => f.size <= 10 * 1024 * 1024);
      setUploadedFiles(prev => [...prev, ...newFiles].slice(0, 5));
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmitDispute = () => {
    if (!selectedTrade || !selectedReason) return;
    createDisputeMutation.mutate({
      tradeId: selectedTrade.id,
      reason: selectedReason,
      description: additionalDetails,
      evidenceCount: uploadedFiles.length,
    });
  };

  const eligibleTrades = trades?.filter(t => 
    t.status === 'processing' || t.status === 'pending'
  ) || [];

  const getActionBadgeColor = (action: string) => {
    const colors: Record<string, string> = {
      trade_created: "bg-blue-500/20 text-blue-400",
      payment_marked: "bg-yellow-500/20 text-yellow-400",
      payment_confirmed: "bg-green-500/20 text-green-400",
      trade_completed: "bg-green-500/20 text-green-400",
      trade_cancelled: "bg-red-500/20 text-red-400",
      dispute_opened: "bg-orange-500/20 text-orange-400",
      dispute_message: "bg-purple-500/20 text-purple-400",
      evidence_uploaded: "bg-cyan-500/20 text-cyan-400",
      dispute_resolved: "bg-green-500/20 text-green-400",
      escrow_held: "bg-blue-500/20 text-blue-400",
      escrow_released: "bg-green-500/20 text-green-400",
      escrow_returned: "bg-yellow-500/20 text-yellow-400",
    };
    return colors[action] || "bg-muted text-muted-foreground";
  };

  if (disputesLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (showFileDispute) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => { setShowFileDispute(false); resetDisputeForm(); }}>
            <ChevronRight className="h-4 w-4 rotate-180 me-1" />
            {t('common.back')}
          </Button>
          <h3 className="font-semibold">{t('p2p.dispute.fileDispute')}</h3>
        </div>

        <div className="flex items-center justify-center gap-1 mb-6">
          {[
            { step: 1, label: t('p2p.dispute.stepReason'), icon: AlertTriangle },
            { step: 2, label: t('p2p.dispute.stepEvidence'), icon: Upload },
            { step: 3, label: t('p2p.dispute.stepConfirm'), icon: Check }
          ].map(({ step, label, icon: Icon }) => (
            <div key={step} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                  disputeStep >= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className={cn(
                  "text-xs font-medium",
                  disputeStep >= step ? "text-primary" : "text-muted-foreground"
                )}>{label}</span>
              </div>
              {step < 3 && <div className={cn("w-16 h-0.5 mx-2", disputeStep > step ? "bg-primary" : "bg-muted")} />}
            </div>
          ))}
        </div>

        {disputeStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('p2p.dispute.selectReason')}</CardTitle>
              <CardDescription>{t('p2p.dispute.selectReasonDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!selectedTrade && (
                <div className="space-y-3">
                  <Label>{t('p2p.myTrades')}</Label>
                  {eligibleTrades.length === 0 ? (
                    <p className="text-muted-foreground text-sm">{t('p2p.noTrades')}</p>
                  ) : (
                    <div className="space-y-2">
                      {eligibleTrades.map(trade => (
                        <div
                          key={trade.id}
                          className="p-3 border rounded-lg cursor-pointer hover-elevate"
                          onClick={() => setSelectedTrade(trade)}
                          data-testid={`select-trade-${trade.id}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="font-medium">{trade.amount} - ${trade.totalPrice}</p>
                              <p className="text-sm text-muted-foreground">{t('p2p.dispute.with')} {trade.counterpartyUsername}</p>
                            </div>
                            <Badge variant="outline">{trade.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {selectedTrade && (
                <>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">{t('p2p.myTrades')}</p>
                    <p className="font-medium">{selectedTrade.amount} - ${selectedTrade.totalPrice} {t('p2p.dispute.with')} {selectedTrade.counterpartyUsername}</p>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedTrade(null)}>
                      {t('common.change')}
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {DISPUTE_REASONS.map(category => (
                      <div key={category.category}>
                        <h4 className="font-medium mb-2 text-sm text-muted-foreground">
                          {t(`p2p.dispute.category.${category.category}`)}
                        </h4>
                        <div className="grid gap-2">
                          {category.reasons.map(reason => {
                            const Icon = reason.icon;
                            const isSelected = selectedReason === reason.id;
                            return (
                              <div
                                key={reason.id}
                                className={cn(
                                  "p-3 border rounded-lg cursor-pointer transition-colors",
                                  isSelected ? "border-primary bg-primary/10" : "hover-elevate"
                                )}
                                onClick={() => setSelectedReason(reason.id)}
                                data-testid={`reason-${reason.id}`}
                              >
                                <div className="flex items-start gap-3">
                                  <Icon className={cn("h-5 w-5 mt-0.5", isSelected ? "text-primary" : "text-muted-foreground")} />
                                  <div className="flex-1">
                                    <p className="font-medium">{t(`p2p.dispute.reason.${reason.id}`)}</p>
                                    <p className="text-sm text-muted-foreground">{t(`p2p.dispute.reason.${reason.id}_desc`)}</p>
                                  </div>
                                  {isSelected && <Check className="h-5 w-5 text-primary" />}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="flex justify-end">
                <Button 
                  onClick={() => setDisputeStep(2)} 
                  disabled={!selectedTrade || !selectedReason}
                  data-testid="button-next-step"
                >
                  {t('common.next')}
                  <ChevronRight className="h-4 w-4 ms-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {disputeStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('p2p.dispute.uploadEvidence')}</CardTitle>
              <CardDescription>{t('p2p.dispute.uploadEvidenceDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div 
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => document.getElementById('evidence-upload')?.click()}
              >
                <input
                  id="evidence-upload"
                  type="file"
                  className="hidden"
                  accept="image/*,video/*,.pdf"
                  multiple
                  onChange={handleFileSelect}
                  data-testid="input-evidence-files"
                />
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">{t('p2p.dispute.dragDropFiles')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('p2p.dispute.supportedFormats')}</p>
              </div>

              {uploadedFiles.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {uploadedFiles.map((file, index) => {
                    const isImage = file.type.startsWith('image/');
                    const previewUrl = isImage ? URL.createObjectURL(file) : null;
                    return (
                      <div key={index} className="relative group border rounded-lg overflow-hidden">
                        {isImage && previewUrl ? (
                          <div className="aspect-video bg-muted">
                            <img 
                              src={previewUrl} 
                              alt={file.name}
                              className="w-full h-full object-cover"
                              onLoad={() => URL.revokeObjectURL(previewUrl)}
                            />
                          </div>
                        ) : (
                          <div className="aspect-video bg-muted flex items-center justify-center">
                            {file.type.startsWith('video/') ? (
                              <Video className="h-8 w-8 text-muted-foreground" />
                            ) : (
                              <FileCheck className="h-8 w-8 text-muted-foreground" />
                            )}
                          </div>
                        )}
                        <div className="p-2 bg-background">
                          <p className="text-xs font-medium truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        <Button 
                          variant="destructive" 
                          size="icon" 
                          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeFile(index)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="space-y-2">
                <Label>{t('p2p.dispute.additionalDetails')}</Label>
                <Textarea
                  value={additionalDetails}
                  onChange={(e) => setAdditionalDetails(e.target.value)}
                  placeholder={t('p2p.dispute.additionalDetailsPlaceholder')}
                  className="min-h-[100px]"
                  data-testid="input-additional-details"
                />
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setDisputeStep(1)}>
                  <ChevronRight className="h-4 w-4 rotate-180 me-1" />
                  {t('common.back')}
                </Button>
                <Button onClick={() => setDisputeStep(3)} data-testid="button-next-step-2">
                  {t('common.next')}
                  <ChevronRight className="h-4 w-4 ms-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {disputeStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('p2p.dispute.confirmSubmit')}</CardTitle>
              <CardDescription>{t('p2p.dispute.confirmSubmitDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <Card className="bg-muted/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{t('p2p.dispute.tradeInfo')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('p2p.dispute.tradeAmount')}</span>
                      <span className="font-medium">{selectedTrade?.amount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('p2p.dispute.fiatAmount')}</span>
                      <span className="font-medium">${selectedTrade?.totalPrice}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('p2p.dispute.counterparty')}</span>
                      <span className="font-medium">{selectedTrade?.counterpartyUsername}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-muted/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{t('p2p.dispute.disputeReason')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-start gap-3 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium">{selectedReason && t(`p2p.dispute.reason.${selectedReason}`)}</p>
                        <p className="text-sm text-muted-foreground">{selectedReason && t(`p2p.dispute.reason.${selectedReason}_desc`)}</p>
                      </div>
                    </div>
                    {additionalDetails && (
                      <div className="mt-3">
                        <p className="text-sm text-muted-foreground mb-1">{t('p2p.dispute.additionalDetails')}</p>
                        <p className="text-sm p-2 bg-muted rounded-lg">{additionalDetails}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {uploadedFiles.length > 0 && (
                  <Card className="bg-muted/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{t('p2p.dispute.evidence')} ({uploadedFiles.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {uploadedFiles.map((file, index) => (
                          <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded-lg text-sm">
                            {file.type.startsWith('image/') ? (
                              <Camera className="h-4 w-4 text-primary" />
                            ) : file.type.startsWith('video/') ? (
                              <Video className="h-4 w-4 text-primary" />
                            ) : (
                              <FileCheck className="h-4 w-4 text-primary" />
                            )}
                            <span className="truncate max-w-32">{file.name}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="acknowledge"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-1"
                  data-testid="checkbox-acknowledge"
                />
                <Label htmlFor="acknowledge" className="text-sm cursor-pointer">
                  {t('p2p.dispute.acknowledgement')}
                </Label>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setDisputeStep(2)}>
                  <ChevronRight className="h-4 w-4 rotate-180 me-1" />
                  {t('common.back')}
                </Button>
                <Button 
                  onClick={handleSubmitDispute} 
                  disabled={!acknowledged || createDisputeMutation.isPending}
                  data-testid="button-submit-dispute"
                >
                  {createDisputeMutation.isPending ? t('p2p.dispute.submitting') : t('p2p.dispute.submitDispute')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold flex items-center gap-2">
          <Scale className="h-5 w-5" />
          {t('p2p.dispute.title')}
        </h3>
        <Button onClick={() => setShowFileDispute(true)} data-testid="button-file-dispute">
          <Plus className="h-4 w-4 me-2" />
          {t('p2p.dispute.fileDispute')}
        </Button>
      </div>

      {!selectedDispute ? (
        <>
          {disputes && disputes.length > 0 ? (
            <div className="space-y-3">
              {disputes.map((dispute) => (
                <Card 
                  key={dispute.id} 
                  className="cursor-pointer hover-elevate"
                  onClick={() => setSelectedDispute(dispute.id)}
                  data-testid={`card-dispute-${dispute.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-orange-500/20">
                          <AlertTriangle className="h-5 w-5 text-orange-500" />
                        </div>
                        <div>
                          <p className="font-medium">{t('p2p.dispute.with')} {dispute.respondentName}</p>
                          <p className="text-sm text-muted-foreground">
                            {t(`p2p.dispute.reason.${dispute.reason}`)} - {dispute.tradeAmount}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={dispute.status === 'open' ? 'destructive' : dispute.status === 'resolved' ? 'default' : 'secondary'}>
                          {t(`p2p.dispute.status.${dispute.status}`)}
                        </Badge>
                        <Badge variant="outline">{t(`p2p.dispute.stage.${dispute.stage}`)}</Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Scale className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{t('p2p.dispute.noDisputes')}</p>
                <Button className="mt-4" onClick={() => setShowFileDispute(true)}>
                  <Plus className="h-4 w-4 me-2" />
                  {t('p2p.dispute.fileDispute')}
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedDispute(null)} data-testid="button-back-disputes">
            <ChevronRight className="h-4 w-4 rotate-180 me-1" />
            {t('common.back')}
          </Button>

          {disputeDetails && (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                      {t('p2p.dispute.details')}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Badge variant={disputeDetails.dispute.status === 'open' ? 'destructive' : 'default'}>
                        {t(`p2p.dispute.status.${disputeDetails.dispute.status}`)}
                      </Badge>
                      <Badge variant="outline">{t(`p2p.dispute.stage.${disputeDetails.dispute.stage}`)}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">{t('p2p.dispute.tradeAmount')}:</span>
                      <span className="ms-2 font-medium">{disputeDetails.dispute.tradeAmount}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('p2p.dispute.fiatAmount')}:</span>
                      <span className="ms-2 font-medium">{disputeDetails.dispute.tradeFiatAmount}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('p2p.dispute.reason')}:</span>
                      <span className="ms-2 font-medium">{t(`p2p.dispute.reason.${disputeDetails.dispute.reason}`)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('p2p.dispute.counterparty')}:</span>
                      <span className="ms-2 font-medium">{disputeDetails.dispute.respondentName}</span>
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <span className="text-muted-foreground text-sm">{t('p2p.dispute.descriptionLabel')}:</span>
                    <p className="mt-1">{disputeDetails.dispute.description}</p>
                  </div>
                </CardContent>
              </Card>

              {disputeDetails.dispute.respondentId === user?.id && disputeDetails.dispute.status === 'open' && (
                <Card className="border-orange-500/30 bg-orange-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                      {t('p2p.dispute.respondToDispute')}
                    </CardTitle>
                    <CardDescription>{t('p2p.dispute.respondDesc')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3">
                      <div 
                        className="p-4 border rounded-lg cursor-pointer hover-elevate"
                        onClick={() => respondDisputeMutation.mutate({ action: 'accept' })}
                        data-testid="button-accept-dispute"
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-full bg-green-500/20">
                            <Check className="h-5 w-5 text-green-500" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{t('p2p.dispute.acceptDispute')}</p>
                            <p className="text-sm text-muted-foreground">{t('p2p.dispute.acceptDisputeDesc')}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div 
                        className="p-4 border rounded-lg cursor-pointer hover-elevate"
                        onClick={() => respondDisputeMutation.mutate({ action: 'contest' })}
                        data-testid="button-contest-dispute"
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-full bg-blue-500/20">
                            <Shield className="h-5 w-5 text-blue-500" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{t('p2p.dispute.contestDispute')}</p>
                            <p className="text-sm text-muted-foreground">{t('p2p.dispute.contestDisputeDesc')}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div 
                        className="p-4 border rounded-lg cursor-pointer hover-elevate"
                        onClick={() => respondDisputeMutation.mutate({ action: 'escalate' })}
                        data-testid="button-escalate-dispute"
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-full bg-orange-500/20">
                            <AlertTriangle className="h-5 w-5 text-orange-500" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{t('p2p.dispute.escalateToSupport')}</p>
                            <p className="text-sm text-muted-foreground">{t('p2p.dispute.escalateDesc')}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {respondDisputeMutation.isPending && (
                      <div className="flex items-center justify-center p-4">
                        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      {t('p2p.dispute.evidence')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      {disputeDetails.evidence.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">{t('p2p.dispute.noEvidence')}</p>
                      ) : (
                        <div className="space-y-2">
                          {disputeDetails.evidence.map((ev) => (
                            <div key={ev.id} className="flex items-center justify-between p-2 border rounded-md">
                              <div className="flex items-center gap-2">
                                {ev.fileType.startsWith('image/') ? (
                                  <Camera className="h-4 w-4 text-primary" />
                                ) : ev.fileType.startsWith('video/') ? (
                                  <Video className="h-4 w-4 text-primary" />
                                ) : (
                                  <FileCheck className="h-4 w-4 text-primary" />
                                )}
                                <div>
                                  <p className="text-sm font-medium">{ev.fileName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {ev.uploaderName} - {new Date(ev.createdAt).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {ev.isVerified && (
                                  <Badge variant="default" className="text-xs">
                                    <Check className="h-3 w-3 me-1" />
                                    {t('p2p.dispute.verified')}
                                  </Badge>
                                )}
                                <Button variant="ghost" size="icon" asChild>
                                  <a href={ev.fileUrl} target="_blank" rel="noopener noreferrer">
                                    <Eye className="h-4 w-4" />
                                  </a>
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <History className="h-4 w-4" />
                      {t('p2p.dispute.transactionLog')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      {disputeDetails.logs.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">{t('p2p.dispute.noLogs')}</p>
                      ) : (
                        <div className="space-y-2">
                          {disputeDetails.logs.map((log) => (
                            <div key={log.id} className="flex items-start gap-3 p-2 border-s-2 border-primary/30 ps-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge className={cn("text-xs", getActionBadgeColor(log.action))}>
                                    {log.action.replace(/_/g, ' ')}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(log.createdAt).toLocaleString()}
                                  </span>
                                </div>
                                <p className="text-sm">
                                  {language === 'ar' && log.descriptionAr ? log.descriptionAr : log.description}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function P2PPage() {
  const { t, dir } = useI18n();
  const { lastMessage } = useWebSocket();

  useEffect(() => {
    if (lastMessage?.type === "balance_updated") {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    }
  }, [lastMessage]);

  return (
    <div className="p-2 md:p-3" dir={dir}>
      <div className="mb-4 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <BackButton fallbackPath="/dashboard" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-p2p-title">{t('nav.p2p')}</h1>
            <p className="text-muted-foreground">{t('p2p.description')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/p2p/profile/me">
            <Button variant="outline" data-testid="button-p2p-profile">
              <User className="h-4 w-4 me-2" />
              {t('p2p.profile.myProfile')}
            </Button>
          </Link>
          <Link href="/p2p/settings">
            <Button variant="outline" data-testid="button-p2p-settings">
              <Settings className="h-4 w-4 me-2" />
              {t('p2p.settings.title')}
            </Button>
          </Link>
        </div>
      </div>

      <div>
        <div className="pt-2">
          <Tabs defaultValue="marketplace">
            <TabsList className="mb-4 flex-wrap">
              <TabsTrigger value="marketplace" data-testid="tab-marketplace">
                {t('p2p.marketplace')}
              </TabsTrigger>
              <TabsTrigger value="my-offers" data-testid="tab-my-offers">
                {t('p2p.myOffers')}
              </TabsTrigger>
              <TabsTrigger value="my-trades" data-testid="tab-my-trades">
                {t('p2p.myTrades')}
              </TabsTrigger>
              <TabsTrigger value="disputes" data-testid="tab-disputes">
                <Scale className="h-4 w-4 me-1" />
                {t('p2p.disputes')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="marketplace">
              <MarketplaceTab />
            </TabsContent>

            <TabsContent value="my-offers">
              <MyOffersTab />
            </TabsContent>

            <TabsContent value="my-trades">
              <MyTradesTab />
            </TabsContent>

            <TabsContent value="disputes">
              <DisputesTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
