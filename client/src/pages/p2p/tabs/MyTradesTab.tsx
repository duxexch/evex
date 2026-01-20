import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowUpRight } from "lucide-react";
import { P2PTrade } from "../types";

export function MyTradesTab() {
  const { t } = useI18n();

  const { data: trades, isLoading } = useQuery<P2PTrade[]>({
    queryKey: ["/api/p2p/my-trades"],
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
