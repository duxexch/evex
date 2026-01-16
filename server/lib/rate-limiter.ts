interface RateLimitEntry {
  count: number;
  windowStart: number;
}

interface RateLimiterConfig {
  maxMessages: number;
  windowMs: number;
}

const userRateLimits = new Map<string, RateLimitEntry>();

const DEFAULT_CONFIG: RateLimiterConfig = {
  maxMessages: 5,
  windowMs: 3000
};

export function checkRateLimit(
  userId: string,
  config: RateLimiterConfig = DEFAULT_CONFIG
): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const entry = userRateLimits.get(userId);

  if (!entry || now - entry.windowStart >= config.windowMs) {
    userRateLimits.set(userId, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (entry.count >= config.maxMessages) {
    const retryAfterMs = config.windowMs - (now - entry.windowStart);
    return { allowed: false, retryAfterMs };
  }

  entry.count++;
  return { allowed: true };
}

export function resetRateLimit(userId: string): void {
  userRateLimits.delete(userId);
}

setInterval(() => {
  const now = Date.now();
  for (const [userId, entry] of userRateLimits.entries()) {
    if (now - entry.windowStart >= 60000) {
      userRateLimits.delete(userId);
    }
  }
}, 60000);

export const chatRateLimiter = {
  check: (userId: string) => checkRateLimit(userId, { maxMessages: 5, windowMs: 3000 }),
  reset: resetRateLimit
};

export const giftRateLimiter = {
  check: (userId: string) => checkRateLimit(userId, { maxMessages: 3, windowMs: 10000 }),
  reset: resetRateLimit
};
