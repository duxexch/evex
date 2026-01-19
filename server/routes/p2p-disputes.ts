import type { Express, Response } from "express";
import { storage } from "../storage";
import { authMiddleware, AuthRequest } from "./middleware";

export function registerP2PDisputesRoutes(app: Express) {
  const p2pDisputes: any[] = [];
  const p2pDisputeMessages: any[] = [];
  const p2pDisputeEvidence: any[] = [];
  const p2pTransactionLogs: any[] = [];

  const prewrittenResponses = [
    { id: "pr-1", category: "payment_proof", title: "Payment Completed", titleAr: "تم الدفع", message: "I have completed the payment. Please check your account and confirm receipt.", messageAr: "لقد أتممت الدفع. يرجى التحقق من حسابك وتأكيد الاستلام." },
    { id: "pr-2", category: "payment_proof", title: "Payment Screenshot Attached", titleAr: "مرفق لقطة شاشة الدفع", message: "I have attached a screenshot of the payment transaction as proof.", messageAr: "لقد أرفقت لقطة شاشة لمعاملة الدفع كإثبات." },
    { id: "pr-3", category: "payment_not_received", title: "Payment Not Received", titleAr: "لم يتم استلام الدفع", message: "I have not received the payment yet. Please provide proof of transaction.", messageAr: "لم أستلم الدفع بعد. يرجى تقديم إثبات المعاملة." },
    { id: "pr-4", category: "wrong_amount", title: "Wrong Amount Received", titleAr: "استلام مبلغ خاطئ", message: "The amount received does not match the agreed amount. Please review and correct.", messageAr: "المبلغ المستلم لا يتطابق مع المبلغ المتفق عليه. يرجى المراجعة والتصحيح." },
    { id: "pr-5", category: "release_request", title: "Request to Release", titleAr: "طلب الإفراج", message: "Please release the crypto as I have completed the payment successfully.", messageAr: "يرجى إطلاق العملة المشفرة حيث أنني أتممت الدفع بنجاح." },
    { id: "pr-6", category: "name_mismatch", title: "Name Mismatch", titleAr: "عدم تطابق الاسم", message: "The payment was made from a different account name. Please verify the payment details.", messageAr: "تم الدفع من حساب باسم مختلف. يرجى التحقق من تفاصيل الدفع." },
    { id: "pr-7", category: "bank_delay", title: "Bank Processing Delay", titleAr: "تأخير المعالجة البنكية", message: "My bank is taking time to process the payment. It should arrive within 2-4 hours.", messageAr: "البنك يستغرق وقتاً لمعالجة الدفع. يجب أن يصل خلال 2-4 ساعات." },
    { id: "pr-8", category: "cancel_request", title: "Request to Cancel", titleAr: "طلب إلغاء", message: "I would like to cancel this trade due to unforeseen circumstances.", messageAr: "أود إلغاء هذه الصفقة بسبب ظروف غير متوقعة." },
  ];

  const disputeRules = [
    { id: "rule-1", category: "proof_requirements", title: "Payment Proof Requirements", titleAr: "متطلبات إثبات الدفع", content: "All payment proofs must include: 1) Full transaction reference number, 2) Date and time of transaction, 3) Sender and receiver names, 4) Transaction amount, 5) Bank/payment method name clearly visible.", contentAr: "يجب أن تتضمن جميع إثباتات الدفع: 1) رقم مرجع المعاملة الكامل، 2) تاريخ ووقت المعاملة، 3) أسماء المرسل والمستلم، 4) مبلغ المعاملة، 5) اسم البنك/طريقة الدفع بشكل واضح.", icon: "FileCheck" },
    { id: "rule-2", category: "screenshot_guidelines", title: "Screenshot Guidelines", titleAr: "إرشادات لقطات الشاشة", content: "Screenshots must be: 1) Original and unedited, 2) Full screen captures showing complete information, 3) Clearly readable with no blurry text, 4) Showing the transaction date and time, 5) Including bank/app name in the screenshot.", contentAr: "يجب أن تكون لقطات الشاشة: 1) أصلية وغير معدلة، 2) التقاطات شاشة كاملة تظهر المعلومات الكاملة، 3) قابلة للقراءة بوضوح بدون نص ضبابي، 4) تظهر تاريخ ووقت المعاملة، 5) تتضمن اسم البنك/التطبيق.", icon: "Camera" },
    { id: "rule-3", category: "video_evidence", title: "Video Evidence Guidelines", titleAr: "إرشادات الفيديو كإثبات", content: "Video evidence should: 1) Be recorded from the official banking app, 2) Show scrolling through the full transaction details, 3) Include the current date/time on the device, 4) Be no longer than 60 seconds, 5) Clearly show all relevant information.", contentAr: "يجب أن يكون الفيديو كإثبات: 1) مسجلاً من تطبيق البنك الرسمي، 2) يظهر التمرير خلال تفاصيل المعاملة الكاملة، 3) يتضمن التاريخ/الوقت الحالي على الجهاز، 4) لا يزيد عن 60 ثانية، 5) يظهر جميع المعلومات ذات الصلة بوضوح.", icon: "Video" },
    { id: "rule-4", category: "prohibited_actions", title: "Prohibited Actions", titleAr: "الإجراءات المحظورة", content: "The following actions are prohibited and may result in account suspension: 1) Submitting fake or edited screenshots, 2) Using offensive language, 3) Making false claims, 4) Not responding within the given timeframe, 5) Trading outside the platform.", contentAr: "الإجراءات التالية محظورة وقد تؤدي إلى تعليق الحساب: 1) تقديم لقطات شاشة مزيفة أو معدلة، 2) استخدام لغة مسيئة، 3) تقديم ادعاءات كاذبة، 4) عدم الرد خلال الإطار الزمني المحدد، 5) التداول خارج المنصة.", icon: "Ban" },
    { id: "rule-5", category: "timeframe", title: "Response Timeframe", titleAr: "الإطار الزمني للرد", content: "All parties must respond within: 1) 10 minutes for peer negotiation, 2) 24 hours for evidence submission, 3) 48 hours for additional documentation if requested. Failure to respond may result in automatic resolution in favor of the responding party.", contentAr: "يجب على جميع الأطراف الرد خلال: 1) 10 دقائق للتفاوض بين الأطراف، 2) 24 ساعة لتقديم الأدلة، 3) 48 ساعة للوثائق الإضافية إذا طُلبت. قد يؤدي عدم الرد إلى حل تلقائي لصالح الطرف المستجيب.", icon: "Clock" },
  ];

  app.get("/api/p2p/prewritten-responses", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      res.json(prewrittenResponses);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/p2p/dispute-rules", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      res.json(disputeRules);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/p2p/disputes", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const myDisputes = p2pDisputes.filter(
        d => d.initiatorId === req.user!.id || d.respondentId === req.user!.id
      );
      
      if (myDisputes.length === 0) {
        res.json([
          {
            id: "dispute-demo-1",
            tradeId: "trade-demo-1",
            initiatorId: req.user!.id,
            respondentId: "user-123",
            respondentName: "CryptoTrader",
            status: "open",
            reason: "payment_not_received",
            description: "Payment has not been received after 2 hours",
            stage: "peer_negotiation",
            peerNegotiationEndsAt: new Date(Date.now() + 600000).toISOString(),
            tradeAmount: "100 USDT",
            tradeFiatAmount: "102.00 USD",
            createdAt: new Date(Date.now() - 3600000).toISOString(),
          }
        ]);
        return;
      }
      
      res.json(myDisputes);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/p2p/disputes", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { tradeId, reason, description } = req.body;
      
      const dispute = {
        id: `dispute-${Date.now()}`,
        tradeId,
        initiatorId: req.user!.id,
        initiatorName: req.user!.username,
        respondentId: "user-other",
        respondentName: "Counterparty",
        status: "open",
        reason,
        description,
        stage: "peer_negotiation",
        peerNegotiationEndsAt: new Date(Date.now() + 600000).toISOString(),
        createdAt: new Date().toISOString(),
      };
      
      p2pDisputes.push(dispute);
      
      p2pTransactionLogs.push({
        id: `log-${Date.now()}`,
        tradeId,
        disputeId: dispute.id,
        userId: req.user!.id,
        action: "dispute_opened",
        description: `Dispute opened by ${req.user!.username}. Reason: ${reason}`,
        descriptionAr: `تم فتح نزاع بواسطة ${req.user!.username}. السبب: ${reason}`,
        createdAt: new Date().toISOString(),
      });
      
      res.status(201).json(dispute);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/p2p/disputes/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      let dispute = p2pDisputes.find(d => d.id === req.params.id);
      
      if (!dispute) {
        dispute = {
          id: req.params.id,
          tradeId: "trade-demo-1",
          initiatorId: req.user!.id,
          initiatorName: req.user!.username,
          respondentId: "user-123",
          respondentName: "CryptoTrader",
          status: "open",
          reason: "payment_not_received",
          description: "Payment has not been received after 2 hours",
          stage: "peer_negotiation",
          peerNegotiationEndsAt: new Date(Date.now() + 600000).toISOString(),
          tradeAmount: "100 USDT",
          tradeFiatAmount: "102.00 USD",
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        };
      }
      
      const messages = p2pDisputeMessages.filter(m => m.disputeId === req.params.id);
      const evidence = p2pDisputeEvidence.filter(e => e.disputeId === req.params.id);
      const logs = p2pTransactionLogs.filter(l => l.disputeId === req.params.id || l.tradeId === dispute.tradeId);
      
      res.json({ dispute, messages, evidence, logs });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/p2p/disputes/:id/messages", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { message, isPrewritten, prewrittenTemplateId } = req.body;
      
      const newMessage = {
        id: `msg-${Date.now()}`,
        disputeId: req.params.id,
        senderId: req.user!.id,
        senderName: req.user!.username,
        message,
        isPrewritten: isPrewritten || false,
        prewrittenTemplateId: prewrittenTemplateId || null,
        isFromSupport: false,
        createdAt: new Date().toISOString(),
      };
      
      p2pDisputeMessages.push(newMessage);
      
      p2pTransactionLogs.push({
        id: `log-${Date.now()}`,
        tradeId: "trade-demo-1",
        disputeId: req.params.id,
        userId: req.user!.id,
        action: "dispute_message",
        description: `Message sent by ${req.user!.username}`,
        descriptionAr: `تم إرسال رسالة بواسطة ${req.user!.username}`,
        createdAt: new Date().toISOString(),
      });
      
      res.status(201).json(newMessage);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/p2p/disputes/:id/evidence", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { fileName, fileUrl, fileType, fileSize, description, evidenceType } = req.body;
      
      const evidence = {
        id: `evidence-${Date.now()}`,
        disputeId: req.params.id,
        uploaderId: req.user!.id,
        uploaderName: req.user!.username,
        fileName,
        fileUrl,
        fileType,
        fileSize,
        description,
        evidenceType,
        isVerified: false,
        createdAt: new Date().toISOString(),
      };
      
      p2pDisputeEvidence.push(evidence);
      
      p2pTransactionLogs.push({
        id: `log-${Date.now()}`,
        tradeId: "trade-demo-1",
        disputeId: req.params.id,
        userId: req.user!.id,
        action: "evidence_uploaded",
        description: `Evidence uploaded by ${req.user!.username}: ${fileName} (${evidenceType})`,
        descriptionAr: `تم رفع إثبات بواسطة ${req.user!.username}: ${fileName} (${evidenceType})`,
        createdAt: new Date().toISOString(),
      });
      
      res.status(201).json(evidence);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/p2p/disputes/:id/resolve", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { resolution, action } = req.body;
      
      const dispute = p2pDisputes.find(d => d.id === req.params.id);
      if (dispute) {
        dispute.status = "resolved";
        dispute.resolution = resolution;
        dispute.resolvedAt = new Date().toISOString();
      }
      
      p2pTransactionLogs.push({
        id: `log-${Date.now()}`,
        tradeId: "trade-demo-1",
        disputeId: req.params.id,
        userId: req.user!.id,
        action: "dispute_resolved",
        description: `Dispute resolved: ${resolution}. Action: ${action}`,
        descriptionAr: `تم حل النزاع: ${resolution}. الإجراء: ${action}`,
        createdAt: new Date().toISOString(),
      });
      
      res.json({ success: true, resolution, action });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/p2p/trades/:tradeId/logs", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      let logs = p2pTransactionLogs.filter(l => l.tradeId === req.params.tradeId);
      
      if (logs.length === 0) {
        logs = [
          {
            id: "log-1",
            tradeId: req.params.tradeId,
            userId: "user-seller",
            action: "trade_created",
            description: "Trade initiated by buyer",
            descriptionAr: "تم بدء الصفقة بواسطة المشتري",
            createdAt: new Date(Date.now() - 7200000).toISOString(),
          },
          {
            id: "log-2",
            tradeId: req.params.tradeId,
            userId: "user-seller",
            action: "escrow_held",
            description: "100 USDT held in escrow",
            descriptionAr: "تم احتجاز 100 USDT في الضمان",
            createdAt: new Date(Date.now() - 7190000).toISOString(),
          },
          {
            id: "log-3",
            tradeId: req.params.tradeId,
            userId: req.user!.id,
            action: "payment_marked",
            description: "Buyer marked payment as sent",
            descriptionAr: "قام المشتري بتأكيد إرسال الدفع",
            createdAt: new Date(Date.now() - 3600000).toISOString(),
          },
        ];
      }
      
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
