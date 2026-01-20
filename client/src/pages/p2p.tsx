import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { Link } from "wouter";
import { Scale, Settings, User } from "lucide-react";
import { MarketplaceTab } from "./p2p/tabs/MarketplaceTab";
import { MyOffersTab } from "./p2p/tabs/MyOffersTab";
import { MyTradesTab } from "./p2p/tabs/MyTradesTab";
import { DisputesTab } from "./p2p/tabs/DisputesTab";

export default function P2PPage() {
  const { t, dir } = useI18n();

  return (
    <div className="p-2 md:p-3" dir={dir}>
      <div className="mb-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-p2p-title">{t('nav.p2p')}</h1>
          <p className="text-muted-foreground">{t('p2p.description')}</p>
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
  );
}
