import type { Express } from "express";
import { registerHealthRoutes } from "./health";
import { registerUsersRoutes } from "./users";
import { registerGamesRoutes } from "./games";
import { registerTransactionsRoutes } from "./transactions";
import { registerAuthRoutes } from "./auth";
import { registerP2PTradingRoutes } from "./p2p-trading";
import { registerP2PDisputesRoutes } from "./p2p-disputes";
import { registerChallengesRoutes } from "./challenges";
import { registerSpectatorRoutes } from "./spectator";

export function registerModularRoutes(app: Express): void {
  registerHealthRoutes(app);
  registerUsersRoutes(app);
  registerGamesRoutes(app);
  registerTransactionsRoutes(app);
  registerAuthRoutes(app);
  registerP2PTradingRoutes(app);
  registerP2PDisputesRoutes(app);
  registerChallengesRoutes(app);
  registerSpectatorRoutes(app);
}
