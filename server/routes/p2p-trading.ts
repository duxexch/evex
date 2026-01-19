import type { Express, Response } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { p2pSettings } from "@shared/schema";
import { authMiddleware, AuthRequest } from "./middleware";

async function calculateP2PFee(tradeAmount: number): Promise<number> {
  const [settings] = await db.select().from(p2pSettings).limit(1);
  if (!settings) {
    return tradeAmount * 0.005;
  }
  
  let fee = 0;
  const percentageRate = parseFloat(settings.platformFeePercentage);
  const fixedAmount = parseFloat(settings.platformFeeFixed);
  const minFee = parseFloat(settings.minFee);
  const maxFee = settings.maxFee ? parseFloat(settings.maxFee) : null;
  
  switch (settings.feeType) {
    case "percentage":
      fee = tradeAmount * percentageRate;
      break;
    case "fixed":
      fee = fixedAmount;
      break;
    case "hybrid":
      fee = (tradeAmount * percentageRate) + fixedAmount;
      break;
    default:
      fee = tradeAmount * 0.005;
  }
  
  if (fee < minFee) fee = minFee;
  if (maxFee !== null && fee > maxFee) fee = maxFee;
  
  return fee;
}

export function registerP2PTradingRoutes(app: Express) {
  const mockP2POffers = [
    {
      id: "p2p-offer-1",
      userId: "user-1",
      username: "CryptoTrader",
      type: "sell",
      amount: "500",
      price: "1.02",
      currency: "USDT",
      minLimit: "50",
      maxLimit: "500",
      paymentMethods: ["bank_transfer", "vodafone_cash"],
      rating: 4.8,
      completedTrades: 156,
      status: "active",
      createdAt: new Date().toISOString(),
    },
    {
      id: "p2p-offer-2",
      userId: "user-2",
      username: "FastExchange",
      type: "buy",
      amount: "1000",
      price: "0.98",
      currency: "USD",
      minLimit: "100",
      maxLimit: "1000",
      paymentMethods: ["instapay"],
      rating: 4.5,
      completedTrades: 89,
      status: "active",
      createdAt: new Date().toISOString(),
    },
    {
      id: "p2p-offer-3",
      userId: "user-3",
      username: "EuroDealer",
      type: "sell",
      amount: "750",
      price: "1.05",
      currency: "EUR",
      minLimit: "25",
      maxLimit: "750",
      paymentMethods: ["bank_transfer"],
      rating: 4.9,
      completedTrades: 234,
      status: "active",
      createdAt: new Date().toISOString(),
    },
  ];

  const userP2POffers: any[] = [];
  const userP2PTrades: any[] = [];

  app.get("/api/p2p/offers", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { type, currency, payment } = req.query;
      let offers = [...mockP2POffers, ...userP2POffers.filter(o => o.status === "active")];
      
      if (type && type !== "all") {
        offers = offers.filter(o => o.type === type);
      }
      if (currency && currency !== "all") {
        offers = offers.filter(o => o.currency === currency);
      }
      if (payment && payment !== "all") {
        offers = offers.filter(o => o.paymentMethods.includes(payment as string));
      }
      
      res.json(offers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/p2p/offers", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { type, amount, price, currency, minLimit, maxLimit, paymentMethods } = req.body;
      const user = await storage.getUser(req.user!.id);
      
      const newOffer = {
        id: `p2p-offer-${Date.now()}`,
        userId: req.user!.id,
        username: user?.username || "Unknown",
        type,
        amount,
        price,
        currency,
        minLimit,
        maxLimit,
        paymentMethods: Array.isArray(paymentMethods) ? paymentMethods : [paymentMethods],
        rating: 5.0,
        completedTrades: 0,
        status: "active",
        createdAt: new Date().toISOString(),
      };
      
      userP2POffers.push(newOffer);
      res.status(201).json(newOffer);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/p2p/my-offers", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const myOffers = userP2POffers.filter(o => o.userId === req.user!.id);
      res.json(myOffers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/p2p/offers/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const index = userP2POffers.findIndex(o => o.id === req.params.id && o.userId === req.user!.id);
      if (index === -1) {
        return res.status(404).json({ error: "Offer not found" });
      }
      userP2POffers.splice(index, 1);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/p2p/my-trades", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const myTrades = userP2PTrades.filter(
        t => t.buyerId === req.user!.id || t.sellerId === req.user!.id
      );
      
      if (myTrades.length === 0) {
        res.json([
          {
            id: "trade-demo-1",
            offerId: "p2p-offer-1",
            buyerId: req.user!.id,
            sellerId: "user-1",
            amount: "100 USDT",
            price: "1.02",
            totalPrice: "102.00",
            status: "completed",
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            completedAt: new Date(Date.now() - 86000000).toISOString(),
            counterpartyUsername: "CryptoTrader",
          },
          {
            id: "trade-demo-2",
            offerId: "p2p-offer-2",
            buyerId: "user-2",
            sellerId: req.user!.id,
            amount: "250 USD",
            price: "0.98",
            totalPrice: "245.00",
            status: "pending",
            createdAt: new Date().toISOString(),
            completedAt: null,
            counterpartyUsername: "FastExchange",
          },
        ]);
        return;
      }
      
      res.json(myTrades);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/p2p/trades", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { offerId, amount, paymentMethod, currencyType = 'usd' } = req.body;
      
      if (!offerId || typeof offerId !== 'string') {
        return res.status(400).json({ error: "Valid offer ID is required" });
      }
      
      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ error: "Valid positive amount is required" });
      }
      
      if (!paymentMethod || typeof paymentMethod !== 'string') {
        return res.status(400).json({ error: "Payment method is required" });
      }
      
      if (currencyType === 'project') {
        const settings = await storage.getProjectCurrencySettings();
        if (!settings?.isActive || !settings?.useInP2P) {
          return res.status(400).json({ error: "Project currency is not available for P2P trading" });
        }
      }
      
      const offer = await storage.getP2POffer(offerId);
      if (!offer) {
        return res.status(404).json({ error: "Offer not found" });
      }
      
      if (offer.userId === req.user!.id) {
        return res.status(400).json({ error: "Cannot trade with your own offer" });
      }
      
      const tradeAmount = parseFloat(amount);
      const minLimit = parseFloat(offer.minLimit);
      const maxLimit = parseFloat(offer.maxLimit);
      
      if (tradeAmount < minLimit || tradeAmount > maxLimit) {
        return res.status(400).json({ error: `Amount must be between ${minLimit} and ${maxLimit}` });
      }
      
      const price = parseFloat(offer.price);
      const fiatAmount = tradeAmount * price;
      const platformFee = await calculateP2PFee(tradeAmount);
      
      const isBuyer = offer.type === "sell";
      const buyerId = isBuyer ? req.user!.id : offer.userId;
      const sellerId = isBuyer ? offer.userId : req.user!.id;
      
      let result;
      if (currencyType === 'project') {
        result = await storage.createP2PTradeProjectCurrencyAtomic({
          offerId,
          buyerId,
          sellerId,
          amount: amount.toString(),
          fiatAmount: fiatAmount.toFixed(2),
          price: offer.price,
          paymentMethod,
          platformFee: platformFee.toFixed(8),
          expiresAt: new Date(Date.now() + (offer.paymentTimeLimit * 60 * 1000)),
        });
      } else {
        result = await storage.createP2PTradeAtomic({
          offerId,
          buyerId,
          sellerId,
          amount: amount.toString(),
          fiatAmount: fiatAmount.toFixed(2),
          price: offer.price,
          paymentMethod,
          platformFee: platformFee.toFixed(8),
          expiresAt: new Date(Date.now() + (offer.paymentTimeLimit * 60 * 1000)),
        });
      }
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      await storage.createP2PTradeMessage({
        tradeId: result.trade.id,
        senderId: req.user!.id,
        message: "Trade started",
        isSystemMessage: true,
      });
      
      res.status(201).json(result.trade);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/p2p/trades/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const trade = await storage.getP2PTrade(req.params.id);
      if (!trade) {
        return res.status(404).json({ error: "Trade not found" });
      }
      
      if (trade.buyerId !== req.user!.id && trade.sellerId !== req.user!.id) {
        return res.status(403).json({ error: "Not authorized to view this trade" });
      }
      
      const buyer = await storage.getUser(trade.buyerId);
      const seller = await storage.getUser(trade.sellerId);
      
      res.json({
        ...trade,
        buyer: buyer ? { id: buyer.id, username: buyer.username, nickname: buyer.nickname } : null,
        seller: seller ? { id: seller.id, username: seller.username, nickname: seller.nickname } : null,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/p2p/trades/:id/pay", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const trade = await storage.getP2PTrade(req.params.id);
      if (!trade) {
        return res.status(404).json({ error: "Trade not found" });
      }
      
      if (trade.buyerId !== req.user!.id) {
        return res.status(403).json({ error: "Only the buyer can mark payment" });
      }
      
      if (trade.status !== "pending") {
        return res.status(400).json({ error: "Trade is not in pending status" });
      }
      
      const { paymentReference } = req.body;
      
      const updated = await storage.updateP2PTrade(trade.id, {
        status: "paid",
        paymentReference,
        paidAt: new Date(),
      });
      
      await storage.createP2PTradeMessage({
        tradeId: trade.id,
        senderId: req.user!.id,
        message: "Payment marked as sent",
        isSystemMessage: true,
      });
      
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/p2p/trades/:id/confirm", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const trade = await storage.getP2PTrade(req.params.id);
      if (!trade) {
        return res.status(404).json({ error: "Trade not found" });
      }
      
      if (trade.sellerId !== req.user!.id) {
        return res.status(403).json({ error: "Only the seller can confirm payment" });
      }
      
      if (trade.status !== "paid") {
        return res.status(400).json({ error: "Trade payment not marked yet" });
      }
      
      const updated = await storage.updateP2PTrade(trade.id, {
        status: "confirmed",
        confirmedAt: new Date(),
      });
      
      await storage.createP2PTradeMessage({
        tradeId: trade.id,
        senderId: req.user!.id,
        message: "Payment confirmed",
        isSystemMessage: true,
      });
      
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/p2p/trades/:id/complete", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const existingTrade = await storage.getP2PTrade(req.params.id);
      if (!existingTrade) {
        return res.status(404).json({ error: "Trade not found" });
      }
      
      let result;
      if (existingTrade.currencyType === 'project') {
        result = await storage.completeP2PTradeProjectCurrencyAtomic(req.params.id, req.user!.id);
      } else {
        result = await storage.completeP2PTradeAtomic(req.params.id, req.user!.id);
      }
      
      if (!result.success) {
        const statusCode = result.error?.includes('not found') ? 404 :
                          result.error?.includes('Only the seller') ? 403 : 400;
        return res.status(statusCode).json({ error: result.error });
      }
      
      const trade = result.trade;
      
      await storage.createP2PTradeMessage({
        tradeId: trade.id,
        senderId: req.user!.id,
        message: "Trade completed, funds released",
        isSystemMessage: true,
      });
      
      const metrics = await storage.getP2PTraderMetrics(trade.buyerId);
      await storage.updateP2PTraderMetrics(trade.buyerId, {
        totalTrades: (metrics?.totalTrades || 0) + 1,
        completedTrades: (metrics?.completedTrades || 0) + 1,
        totalBuyTrades: (metrics?.totalBuyTrades || 0) + 1,
        lastTradeAt: new Date(),
      });
      
      const sellerMetrics = await storage.getP2PTraderMetrics(trade.sellerId);
      await storage.updateP2PTraderMetrics(trade.sellerId, {
        totalTrades: (sellerMetrics?.totalTrades || 0) + 1,
        completedTrades: (sellerMetrics?.completedTrades || 0) + 1,
        totalSellTrades: (sellerMetrics?.totalSellTrades || 0) + 1,
        lastTradeAt: new Date(),
      });
      
      res.json(trade);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/p2p/trades/:id/cancel", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { reason } = req.body;
      
      const existingTrade = await storage.getP2PTrade(req.params.id);
      if (!existingTrade) {
        return res.status(404).json({ error: "Trade not found" });
      }
      
      let result;
      if (existingTrade.currencyType === 'project') {
        result = await storage.cancelP2PTradeProjectCurrencyAtomic(req.params.id, req.user!.id, reason);
      } else {
        result = await storage.cancelP2PTradeAtomic(req.params.id, req.user!.id, reason);
      }
      
      if (!result.success) {
        const statusCode = result.error?.includes('not found') ? 404 :
                          result.error?.includes('Not authorized') ? 403 : 400;
        return res.status(statusCode).json({ error: result.error });
      }
      
      const trade = result.trade;
      
      await storage.createP2PTradeMessage({
        tradeId: trade.id,
        senderId: req.user!.id,
        message: `Trade cancelled: ${reason || "No reason provided"}`,
        isSystemMessage: true,
      });
      
      const buyerMetrics = await storage.getP2PTraderMetrics(trade.buyerId);
      await storage.updateP2PTraderMetrics(trade.buyerId, {
        totalTrades: (buyerMetrics?.totalTrades || 0) + 1,
        cancelledTrades: (buyerMetrics?.cancelledTrades || 0) + 1,
      });
      
      const sellerMetrics = await storage.getP2PTraderMetrics(trade.sellerId);
      await storage.updateP2PTraderMetrics(trade.sellerId, {
        totalTrades: (sellerMetrics?.totalTrades || 0) + 1,
        cancelledTrades: (sellerMetrics?.cancelledTrades || 0) + 1,
      });
      
      res.json(trade);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/p2p/trades/:id/rate", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const trade = await storage.getP2PTrade(req.params.id);
      if (!trade) {
        return res.status(404).json({ error: "Trade not found" });
      }
      
      if (trade.buyerId !== req.user!.id && trade.sellerId !== req.user!.id) {
        return res.status(403).json({ error: "Not authorized to rate this trade" });
      }
      
      if (trade.status !== "completed") {
        return res.status(400).json({ error: "Can only rate completed trades" });
      }
      
      const { rating, comment } = req.body;
      
      if (rating === undefined || rating === null || typeof rating !== 'number') {
        return res.status(400).json({ error: "Rating is required" });
      }
      
      if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
        return res.status(400).json({ error: "Rating must be an integer between 1 and 5" });
      }
      
      if (comment && (typeof comment !== 'string' || comment.length > 500)) {
        return res.status(400).json({ error: "Comment must be a string under 500 characters" });
      }
      
      const ratedUserId = trade.buyerId === req.user!.id ? trade.sellerId : trade.buyerId;
      
      const existingRatings = await storage.getP2PTraderRatings(ratedUserId);
      const alreadyRated = existingRatings.find(r => r.tradeId === trade.id && r.raterId === req.user!.id);
      
      if (alreadyRated) {
        return res.status(400).json({ error: "Already rated this trade" });
      }
      
      const newRating = await storage.createP2PTraderRating({
        tradeId: trade.id,
        raterId: req.user!.id,
        ratedUserId,
        rating,
        comment: comment || null,
      });
      
      const allRatings = await storage.getP2PTraderRatings(ratedUserId);
      const totalRatings = allRatings.length;
      const positiveRatings = allRatings.filter(r => r.rating >= 4).length;
      const negativeRatings = allRatings.filter(r => r.rating <= 2).length;
      const avgRating = allRatings.reduce((sum, r) => sum + r.rating, 0) / totalRatings;
      
      await storage.updateP2PTraderMetrics(ratedUserId, {
        positiveRatings,
        negativeRatings,
        overallRating: avgRating.toFixed(2),
      });
      
      res.status(201).json(newRating);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/p2p/trades/:id/messages", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const trade = await storage.getP2PTrade(req.params.id);
      if (!trade) {
        return res.status(404).json({ error: "Trade not found" });
      }
      
      if (trade.buyerId !== req.user!.id && trade.sellerId !== req.user!.id) {
        return res.status(403).json({ error: "Not authorized to view trade messages" });
      }
      
      const messages = await storage.getP2PTradeMessages(req.params.id);
      
      const messagesWithSender = await Promise.all(messages.map(async (msg: any) => {
        const sender = await storage.getUser(msg.senderId);
        return {
          ...msg,
          sender: sender ? { id: sender.id, username: sender.username, nickname: sender.nickname } : null,
        };
      }));
      
      res.json(messagesWithSender);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/p2p/trades/:id/messages", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const trade = await storage.getP2PTrade(req.params.id);
      if (!trade) {
        return res.status(404).json({ error: "Trade not found" });
      }
      
      if (trade.buyerId !== req.user!.id && trade.sellerId !== req.user!.id) {
        return res.status(403).json({ error: "Not authorized to message in this trade" });
      }
      
      if (trade.status === "completed" || trade.status === "cancelled") {
        return res.status(400).json({ error: "Cannot message in closed trades" });
      }
      
      const { message, isPrewritten } = req.body;
      
      if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: "Message cannot be empty" });
      }
      
      if (message.length > 1000) {
        return res.status(400).json({ error: "Message too long" });
      }
      
      const newMessage = await storage.createP2PTradeMessage({
        tradeId: req.params.id,
        senderId: req.user!.id,
        message: message.trim(),
        isPrewritten: isPrewritten || false,
        isSystemMessage: false,
      });
      
      const sender = await storage.getUser(req.user!.id);
      
      res.status(201).json({
        ...newMessage,
        sender: sender ? { id: sender.id, username: sender.username, nickname: sender.nickname } : null,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
