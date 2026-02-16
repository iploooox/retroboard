import type { Context, Next } from 'hono';
import { checkAndIncrement } from '../repositories/rate-limit.repository.js';
import { formatErrorResponse } from '../utils/errors.js';

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  keyGenerator: (c: Context) => string;
}

export function rateLimit(config: RateLimitConfig) {
  return async (c: Context, next: Next) => {
    // Skip rate limiting if DISABLE_RATE_LIMIT is set (for E2E tests)
    if (process.env.DISABLE_RATE_LIMIT === 'true') {
      await next();
      return;
    }

    const key = config.keyGenerator(c);
    const allowed = await checkAndIncrement(key, config.windowMs, config.max);

    if (!allowed) {
      const retryAfterSeconds = Math.ceil(config.windowMs / 1000);
      c.header('Retry-After', String(retryAfterSeconds));
      return c.json(
        formatErrorResponse('RATE_LIMIT_EXCEEDED', 'Too many requests. Please try again later.'),
        429,
      );
    }

    await next();
  };
}
