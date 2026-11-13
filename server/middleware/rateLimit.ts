import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.ts';
import { ParsedTrustProxyConfig, resolveClientIp } from '../config/trustProxy.ts';

export interface RateLimitOptions {
  name: string;
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  message?: string;
}

export interface RateLimiterMiddleware {
  (req: Request, res: Response, next: NextFunction): void;
  reset: () => void;
}

export function getClientIp(req: Request): string {
  const trustConfig = (req.app?.get('sautiTrustProxy') as ParsedTrustProxyConfig | undefined) ?? env.trustProxy;
  return resolveClientIp(req, trustConfig);
}

export function createRateLimiter(options: RateLimitOptions): RateLimiterMiddleware {
  const hits = new Map<string, number[]>();

  const sweepTimer = setInterval(() => {
    const cutoff = Date.now() - options.windowMs;
    for (const [key, timestamps] of hits.entries()) {
      const fresh = timestamps.filter((t) => t > cutoff);
      if (fresh.length === 0) hits.delete(key);
      else hits.set(key, fresh);
    }
  }, Math.max(30_000, options.windowMs));
  sweepTimer.unref?.();

  const middleware = ((req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const cutoff = now - options.windowMs;
    const key = options.keyGenerator ? options.keyGenerator(req) : `ip:${getClientIp(req)}`;
    const existing = hits.get(key) || [];
    const recent = existing.filter((ts) => ts > cutoff);

    if (recent.length >= options.maxRequests) {
      const oldest = recent[0] ?? now;
      const retryAfterSec = Math.max(1, Math.ceil((oldest + options.windowMs - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.setHeader('X-RateLimit-Limit', String(options.maxRequests));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.status(429).json({
        error: options.message || 'Too many requests. Please wait a moment before trying again.',
        retryAfterSeconds: retryAfterSec,
      });
      return;
    }

    recent.push(now);
    hits.set(key, recent);
    res.setHeader('X-RateLimit-Limit', String(options.maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, options.maxRequests - recent.length)));
    next();
  }) as RateLimiterMiddleware;

  middleware.reset = () => {
    hits.clear();
  };

  return middleware;
}
