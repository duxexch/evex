import type { Express } from "express";
import type { Server } from "http";
import { registerHealthRoutes } from "./health";

export function registerModularRoutes(app: Express): void {
  registerHealthRoutes(app);
}
