/**
 * Simple in-memory rate limiter for serverless functions
 * Tracks requests per IP address
 */

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach((key) => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  interval: number; // in milliseconds
  maxRequests: number;
}

export function rateLimit(identifier: string, config: RateLimitConfig): boolean {
  const now = Date.now();
  const entry = store[identifier];

  if (!entry || entry.resetTime < now) {
    // First request or window has reset
    store[identifier] = {
      count: 1,
      resetTime: now + config.interval,
    };
    return true;
  }

  if (entry.count >= config.maxRequests) {
    // Rate limit exceeded
    return false;
  }

  // Increment count
  entry.count++;
  return true;
}

export function getRateLimitInfo(identifier: string, config: RateLimitConfig) {
  const entry = store[identifier];
  const now = Date.now();

  if (!entry || entry.resetTime < now) {
    return {
      remaining: config.maxRequests,
      resetTime: now + config.interval,
    };
  }

  return {
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetTime: entry.resetTime,
  };
}
