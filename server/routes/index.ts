import type { Express, Router } from "express";
import { registerHealthRoutes } from "./health";
import { registerUsersRoutes } from "./users";
import { registerGamesRoutes } from "./games";
import { registerTransactionsRoutes } from "./transactions";
import { registerAuthRoutes } from "./auth";
import { registerP2PTradingRoutes } from "./p2p-trading";
import { registerP2PDisputesRoutes } from "./p2p-disputes";
import { registerChallengesRoutes } from "./challenges-refactored";
import { registerSpectatorRoutes } from "./spectator";
import { setupGameStartQueueRoutes } from "./game-start-queue";
import gameStartStatusRouter from "./game-start-status";
import express from "express";

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
  
  // Setup game start queue polling routes
  const queueRouter = express.Router();
  setupGameStartQueueRoutes(queueRouter);
  app.use(queueRouter);
  
  // Setup game start status routes
  app.use('/api/game-start', gameStartStatusRouter);
}
