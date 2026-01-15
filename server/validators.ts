import { z } from "zod";
import { Response } from "express";

export const usernameSchema = z.string()
  .min(3, "Username must be at least 3 characters")
  .max(50, "Username must not exceed 50 characters")
  .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores");

export const passwordSchema = z.string()
  .min(6, "Password must be at least 6 characters")
  .max(100, "Password must not exceed 100 characters");

export const emailSchema = z.string()
  .email("Invalid email format")
  .max(255, "Email must not exceed 255 characters")
  .optional()
  .or(z.literal(""));

export const phoneSchema = z.string()
  .min(5, "Phone number is too short")
  .max(20, "Phone number is too long")
  .regex(/^\+?[\d\s-]+$/, "Invalid phone format")
  .optional()
  .or(z.literal(""));

export const accountIdSchema = z.string()
  .min(8, "Invalid account ID")
  .max(50, "Invalid account ID")
  .optional()
  .or(z.literal(""));

export const uuidSchema = z.string()
  .uuid("Invalid ID format");

export const idParamSchema = z.object({
  id: z.string().min(1, "ID is required")
});

export const moneyAmountSchema = z.union([
  z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount format"),
  z.number().positive("Amount must be positive")
]).transform(val => typeof val === "string" ? parseFloat(val) : val)
  .refine(val => val > 0, "Amount must be positive")
  .refine(val => val <= 1000000, "Amount exceeds maximum limit");

export const textContentSchema = z.string()
  .max(5000, "Content is too long")
  .transform(val => val.trim());

export const loginSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});

export const loginByAccountSchema = z.object({
  accountId: z.string().min(1, "Account ID is required"),
  password: passwordSchema,
});

export const loginByPhoneSchema = z.object({
  phone: z.string().min(5, "Phone number is required"),
  password: passwordSchema,
});

export const registerSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  referralCode: z.string().max(20).optional(),
  nickname: z.string().max(50).optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  currency: z.string().max(10).optional(),
  preferredLanguage: z.string().max(10).optional(),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  accountId: accountIdSchema.optional(),
}).refine(data => data.email || data.phone || data.accountId, {
  message: "Email, phone, or account ID is required",
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: passwordSchema.optional(),
  newPassword: passwordSchema.optional(),
}).refine(data => data.password || data.newPassword, {
  message: "Password is required",
}).transform(data => ({
  token: data.token,
  password: data.password || data.newPassword!,
}));

export const depositSchema = z.object({
  amount: moneyAmountSchema,
  paymentMethod: z.string().max(50).optional(),
  paymentReference: z.string().min(1, "Payment reference is required").max(100),
  walletNumber: z.string().max(50).optional(),
});

export const withdrawSchema = z.object({
  amount: moneyAmountSchema,
  method: z.string().max(50).optional(),
  accountDetails: z.object({
    accountNumber: z.string().max(100).optional(),
    accountName: z.string().max(100).optional(),
    bankName: z.string().max(100).optional(),
    walletAddress: z.string().max(200).optional(),
  }).optional(),
  withdrawalPassword: z.string().min(1).max(100).optional(),
});

export const p2pEvidenceSchema = z.object({
  fileName: z.string().min(1, "File name is required").max(255),
  fileUrl: z.string().min(1, "File URL is required").max(1000),
  fileType: z.string().max(50).optional(),
  fileSize: z.union([z.string(), z.number()]).optional(),
  description: z.string().max(2000).optional(),
  evidenceType: z.string().max(50).optional(),
});

export const p2pResolveSchema = z.object({
  resolution: z.string().min(1, "Resolution is required").max(100),
  action: z.string().max(100).optional(),
});

export const p2pDisputeMessageSchema = z.object({
  message: z.string().min(1, "Message is required").max(5000),
  isPrewritten: z.boolean().optional(),
  prewrittenTemplateId: z.string().max(100).optional(),
});

const p2pAmountSchema = z.union([
  z.string().regex(/^\d+(\.\d{1,8})?$/, "Invalid amount format"),
  z.number().positive("Amount must be positive")
]).transform(val => typeof val === "string" ? parseFloat(val) : val)
  .refine(val => val > 0, "Amount must be positive")
  .refine(val => val <= 10000000, "Amount exceeds maximum limit")
  .refine(val => !isNaN(val), "Invalid amount");

export const p2pOfferSchema = z.object({
  type: z.enum(["buy", "sell"]),
  amount: p2pAmountSchema,
  price: p2pAmountSchema,
  currency: z.string().min(1).max(10),
  paymentMethods: z.union([
    z.array(z.string().max(50)).max(10),
    z.string().max(50).transform(val => [val])
  ]).optional(),
  minLimit: p2pAmountSchema.optional(),
  maxLimit: p2pAmountSchema.optional(),
});

export const p2pTradeInitiateSchema = z.object({
  offerId: z.string().min(1, "Offer ID is required"),
  amount: p2pAmountSchema,
  paymentMethodId: z.string().max(100).optional(),
});

export const p2pTradeActionSchema = z.object({
  withdrawalPassword: z.string().max(100).optional(),
});

export const p2pDisputeSchema = z.object({
  tradeId: z.string().min(1, "Trade ID is required"),
  reason: z.string().min(1, "Reason is required").max(100),
  description: z.string().min(1, "Description is required").max(5000),
  evidence: z.array(z.string().max(500)).max(10).optional(),
});

export const p2pMessageSchema = z.object({
  content: textContentSchema,
});

export const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export function validateBody<T extends z.ZodSchema>(
  schema: T,
  body: unknown,
  res: Response
): z.infer<T> | null {
  const result = schema.safeParse(body);
  if (!result.success) {
    res.status(400).json({
      error: "Validation failed",
      details: result.error.errors.map(e => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
    return null;
  }
  return result.data;
}

export function validateQuery<T extends z.ZodSchema>(
  schema: T,
  query: unknown,
  res: Response
): z.infer<T> | null {
  return validateBody(schema, query, res);
}

export function validateParams<T extends z.ZodSchema>(
  schema: T,
  params: unknown,
  res: Response
): z.infer<T> | null {
  return validateBody(schema, params, res);
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, 5000);
}
