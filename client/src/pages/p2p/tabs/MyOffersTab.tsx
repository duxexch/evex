import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { P2POffer } from "../types";

const createOfferSchema = z.object({
  type: z.enum(["buy", "sell"]),
  amount: z.string().min(1, "Amount is required"),
  price: z.string().min(1, "Price is required"),
  currency: z.string().min(1, "Currency is required"),
  minLimit: z.string().min(1, "Min limit is required"),
  maxLimit: z.string().min(1, "Max limit is required"),
  paymentMethods: z.string().min(1, "Select at least one payment method"),
});

export type CreateOfferForm = z.infer<typeof createOfferSchema>;

export function MyOffersTab() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { data: myOffers, isLoading } = useQuery<P2POffer[]>({
    queryKey: ["/api/p2p/my-offers"],
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
      toast({ title: t('common.success'), description: t('p2p.offerCreated') });
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
      toast({ title: t('common.success'), description: t('p2p.offerDeleted') });
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
