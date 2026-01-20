import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, RefreshCw, Star, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { P2POffer } from "../types";

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

export function MarketplaceTab() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [currencyFilter, setCurrencyFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [currencyOpen, setCurrencyOpen] = useState(false);

  const { data: offers, isLoading, refetch } = useQuery<P2POffer[]>({
    queryKey: ["/api/p2p/offers", { type: typeFilter, currency: currencyFilter, payment: paymentFilter }],
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
