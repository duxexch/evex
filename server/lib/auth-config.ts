/**
 * Centralized Authentication Configuration
 * 
 * This module provides separate JWT secrets for user and admin authentication,
 * enforcing security best practices by isolating credentials.
 * 
 * Security Requirements:
 * - In production, both JWT_USER_SECRET and JWT_ADMIN_SECRET must be set
 * - Secrets must be at least 32 characters long
 * - User and Admin secrets must be different
 */

import crypto from 'crypto';

// Environment variable validation
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

// User JWT Configuration
const userSecretFromEnv = process.env.JWT_USER_SECRET || process.env.SESSION_SECRET;
const fallbackUserSecret = 'dev-user-secret-do-not-use-in-production';

// Admin JWT Configuration (completely separate from user)
const adminSecretFromEnv = process.env.JWT_ADMIN_SECRET;
const fallbackAdminSecret = 'dev-admin-secret-do-not-use-in-production';

// Production validation
if (isProduction) {
  if (!userSecretFromEnv || userSecretFromEnv.length < 32) {
    throw new Error('CRITICAL: JWT_USER_SECRET (or SESSION_SECRET) must be set to at least 32 characters in production!');
  }
  if (!adminSecretFromEnv || adminSecretFromEnv.length < 32) {
    throw new Error('CRITICAL: JWT_ADMIN_SECRET must be set to at least 32 characters in production!');
  }
  if (userSecretFromEnv === adminSecretFromEnv) {
    throw new Error('CRITICAL: JWT_USER_SECRET and JWT_ADMIN_SECRET must be different in production!');
  }
}

// Export the secrets
export const JWT_USER_SECRET = userSecretFromEnv || fallbackUserSecret;
export const JWT_ADMIN_SECRET = adminSecretFromEnv || 
  (userSecretFromEnv ? `admin_${crypto.createHash('sha256').update(userSecretFromEnv).digest('hex').slice(0, 32)}` : fallbackAdminSecret);

// Token expiration times
export const JWT_USER_EXPIRY = '7d';
export const JWT_ADMIN_EXPIRY = '24h';

// Token types for validation
export const TokenType = {
  USER: 'user',
  ADMIN: 'admin',
} as const;

export type TokenTypeValue = typeof TokenType[keyof typeof TokenType];

// Helper to get the correct secret based on token type
export function getJwtSecret(type: TokenTypeValue): string {
  return type === TokenType.ADMIN ? JWT_ADMIN_SECRET : JWT_USER_SECRET;
}

// Log configuration (only in development)
if (!isProduction) {
  console.log('[Auth Config] Development mode - using fallback secrets if not configured');
  console.log(`[Auth Config] User secret configured: ${!!userSecretFromEnv}`);
  console.log(`[Auth Config] Admin secret configured: ${!!adminSecretFromEnv}`);
}
