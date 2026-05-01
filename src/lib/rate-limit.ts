/**
 * Simple in-memory rate limiter for API routes.
 * 
 * Note: In a true serverless environment (like Vercel functions), memory is ephemeral
 * and not shared across instances. However, this still provides a basic level of 
 * protection against DoS from a single instance, and works perfectly for a single Node.js server.
 */
import 'server-only';

interface RateLimitTracker {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitTracker>();

// Clean up expired entries every 5 minutes to prevent memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, tracker] of rateLimitMap.entries()) {
      if (now > tracker.resetAt) {
        rateLimitMap.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

export function applyRateLimit(
  identifier: string,
  limit: number = 60, // allowed requests
  windowMs: number = 60 * 1000 // timeframe
): { success: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const tracker = rateLimitMap.get(identifier);

  if (!tracker || now > tracker.resetAt) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (tracker.count >= limit) {
    return { success: false, remaining: 0, resetAt: tracker.resetAt };
  }

  tracker.count++;
  return { success: true, remaining: limit - tracker.count, resetAt: tracker.resetAt };
}
