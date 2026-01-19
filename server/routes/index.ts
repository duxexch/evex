import type { Express } from "express";
import { registerHealthRoutes } from "./health";
import { registerUsersRoutes } from "./users";
import { registerGamesRoutes } from "./games";
import { registerTransactionsRoutes } from "./transactions";

export function registerModularRoutes(app: Express): void {
  registerHealthRoutes(app);
  registerUsersRoutes(app);
  registerGamesRoutes(app);
  registerTransactionsRoutes(app);
}
