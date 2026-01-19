import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { games } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { insertGameSchema } from "@shared/schema";
import { authMiddleware, adminMiddleware, type AuthRequest } from "./middleware";

export function registerGamesRoutes(app: Express): void {
  app.get("/api/games", async (req: Request, res: Response) => {
    try {
      const { status, section } = req.query;
      const games = await storage.listGames(status as string, section as string);
      res.json(games);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/games/available", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const availableGames = await db.select().from(games).where(eq(games.status, "active"));
      res.json(availableGames);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/games/most-played", async (_req: Request, res: Response) => {
    try {
      const mostPlayed = await db.select().from(games)
        .where(eq(games.status, "active"))
        .orderBy(sql`${games.playCount} DESC`)
        .limit(10);
      res.json(mostPlayed);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get("/api/games/:id", async (req: Request, res: Response) => {
    try {
      const game = await storage.getGame(req.params.id);
      if (!game) {
        return res.status(404).json({ error: "Game not found" });
      }
      res.json(game);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post("/api/games", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const data = insertGameSchema.parse({ ...req.body, createdBy: req.user!.id });
      const game = await storage.createGame(data);
      res.status(201).json(game);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });
  
  app.patch("/api/games/:id", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const game = await storage.updateGame(req.params.id, req.body);
      if (!game) {
        return res.status(404).json({ error: "Game not found" });
      }
      res.json(game);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.delete("/api/games/:id", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      await storage.deleteGame(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
