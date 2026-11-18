import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types';

export interface RateLimitOptions {
  /** Unique namespace so independent route limiters never collide */
  name: string;
  windowMs: number;
  maxRequests: number;
  message?: string;
  /** Prefer authenticated userId, falling back to client IP */
  keyBy?: 'userOrIp' | 'ip';
  skip?: (req: Request) => boolean;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const storesByLimiter = new Map<string, Map<string, RateLimitBucket>>();

export function clearRateLimitStoresForTest(): void {
  storesByLimiter.clear();
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/**
 * Lightweight fixed-window rate limiter middleware (no external dependencies).
 */
export function createRateLimitMiddleware(options: RateLimitOptions) {
  let store = storesByLimiter.get(options.name);
  if (!store) {
    store = new Map<string, RateLimitBucket>();
    storesByLimiter.set(options.name, store);
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    if (options.skip?.(req)) {
      next();
      return;
    }

    const now = Date.now();
    if (store!.size > 5000) {
      for (const [k, entry] of store!.entries()) {
        if (entry.resetAt <= now) store!.delete(k);
      }
    }

    const identity =
      options.keyBy === 'ip'
        ? getClientIp(req)
        : req.userId || (req as any).user?.id || getClientIp(req);
    const key = `${options.name}:${identity}`;

    const existing = store!.get(key);
    if (!existing || existing.resetAt <= now) {
      store!.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    if (existing.count >= options.maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      next(
        new AppError(
          options.message || 'ส่งคำขอบ่อยเกินกำหนด กรุณารอสักครู่แล้วลองใหม่อีกครั้ง',
          429,
          'RATE_LIMITED'
        )
      );
      return;
    }

    existing.count += 1;
    next();
  };
}
