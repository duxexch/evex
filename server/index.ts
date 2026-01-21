import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { registerAdminRoutes } from "./admin-routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { setupGameWebSocket } from "./game-websocket";
import { seedBotAccounts } from "./bot-seeder";
import { seedMultiplayerGames, seedGiftCatalog } from "./seed";
import { startBotSimulator } from "./bot-game-simulator";
import { initializeServices, shutdownServices } from "./services-init";
import { registerMonitoringRoutes, initializeMonitoring } from "./routes/monitoring";
import { registerPermissionsRoutes } from "./routes/permissions";

const app = express();
const httpServer = createServer(app);

const gameWss = setupGameWebSocket(httpServer);

// Initialize monitoring system
initializeMonitoring();

const isProduction = process.env.NODE_ENV === "production";

// Trust proxy for rate limiting behind nginx/load balancers
// Enable in Replit environment or production (both use proxies)
// Number of proxies between user and server (1 for nginx/Replit proxy)
const isReplit = process.env.REPLIT || process.env.REPL_ID;
app.set("trust proxy", isProduction || isReplit ? 1 : false);

// ==================== SECURITY MIDDLEWARE ====================

// Security headers (Helmet-like protection without external dependency)
app.use((req: Request, res: Response, next: NextFunction) => {
  // Prevent clickjacking attacks
  res.setHeader("X-Frame-Options", "DENY");
  
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  
  // Enable XSS filter in browsers
  res.setHeader("X-XSS-Protection", "1; mode=block");
  
  // Control referrer information
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // Permissions policy - restrict browser features
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  
  // Content Security Policy (CSP) - prevent XSS and injection attacks
  if (isProduction) {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' data:; " +
      "connect-src 'self' wss: https:; " +
      "frame-ancestors 'none';"
    );
    
    // Strict Transport Security (HSTS) - force HTTPS
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }
  
  // Remove X-Powered-By header (hide Express)
  res.removeHeader("X-Powered-By");
  
  next();
});

// Request size limits to prevent DoS attacks
app.use(express.json({ 
  limit: "10mb", // Max JSON body size
  verify: (req, _res, buf) => {
    (req as any).rawBody = buf;
  },
}));

app.use(express.urlencoded({ extended: false, limit: "10mb" }));

// Protect against prototype pollution attacks (safe, non-destructive)
const sanitizeKeys = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(sanitizeKeys);
  }
  if (obj && typeof obj === "object") {
    const sanitized: any = {};
    for (const key of Object.keys(obj)) {
      // Block prototype pollution attacks only
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        console.warn(`[SECURITY] Blocked prototype pollution attempt: ${key}`);
        continue;
      }
      sanitized[key] = sanitizeKeys(obj[key]);
    }
    return sanitized;
  }
  return obj;
};

// Apply prototype pollution protection only (preserves user data)
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeKeys(req.body);
  }
  next();
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

// Process-level error handlers to prevent silent crashes
process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught Exception:', error.message);
  console.error(error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

(async () => {
  try {
    // Initialize all background services
    await initializeServices();

    await registerRoutes(httpServer, app);
    registerAdminRoutes(app);

    // Register comprehensive admin routes
    const { registerAdminAuthRoutes } = await import("./routes/admin-auth");
    const { registerAdminUsersRoutes } = await import("./routes/admin-users");
    const { registerAdminComplaintsRoutes } = await import("./routes/admin-complaints");
    const { registerAdminTransactionsRoutes } = await import("./routes/admin-transactions");

    registerAdminAuthRoutes(app);
    registerAdminUsersRoutes(app);
    registerAdminComplaintsRoutes(app);
    registerAdminTransactionsRoutes(app);

    // Register monitoring and permissions routes
    registerMonitoringRoutes(app);
    registerPermissionsRoutes(app);

  // Global error handler - catches unhandled errors without crashing the server
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = process.env.NODE_ENV === "production" 
      ? "Internal Server Error" 
      : err.message || "Internal Server Error";

    // Log error details for debugging (never crash)
    const errorLog = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      status,
      error: err.message,
      stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
    };
    console.error("[ERROR]", JSON.stringify(errorLog));

    // Only send response if headers haven't been sent
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    async () => {
      log(`serving on port ${port}`);
      
      // Seed multiplayer games and gift catalog (runs on both dev and production)
      try {
        await seedMultiplayerGames();
        await seedGiftCatalog();
      } catch (error: any) {
        log(`Seed error: ${error.message}`, "seed");
      }
      
      // Initialize bot accounts and start game simulator
      setTimeout(async () => {
        try {
          log("Seeding bot accounts...", "bot");
          await seedBotAccounts();
          log("Starting bot game simulator...", "bot");
          await startBotSimulator();
        } catch (error: any) {
          log(`Bot system error: ${error.message}`, "bot");
        }
      }, 15000); // Wait 15 seconds for server to fully initialize and respond to users first
    },
  );
  } catch (error: any) {
    console.error('[FATAL] Server startup failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
