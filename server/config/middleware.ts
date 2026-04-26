/**
 * Express Middleware Configuration
 * Centralizes CORS, security headers, rate limiting, and request logging
 * PHASE 4: Modularization of middleware setup
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { logger } from '../../services/logger.js';
import type { ServerConfig } from './env.js';

/**
 * Simple in-memory rate limiter
 * TODO: Replace with Redis-backed limiter in production
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  constructor(
    private windowMs: number,
    private maxRequests: number
  ) {}

  check(clientId: string): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(clientId) || [];

    // Remove old requests outside the window
    const recent = timestamps.filter((t) => now - t < this.windowMs);

    if (recent.length >= this.maxRequests) {
      return false; // Rate limit exceeded
    }

    recent.push(now);
    this.requests.set(clientId, recent);
    return true;
  }
}

/**
 * Setup all Express middleware for the application
 */
export function setupMiddleware(app: express.Application, config: ServerConfig): void {
  // CORS Configuration
  app.use(
    cors({
      origin: config.allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Sentinel-Token'],
    })
  );

  // Security Headers
  app.use((req: Request, res: Response, next: NextFunction) => {
    // HTTPS enforcement in production
    if (config.isProduction && req.header('x-forwarded-proto') !== 'https') {
      return res.status(403).send('HTTPS required');
    }

    // HSTS (HTTP Strict Transport Security)
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // XSS Protection
    res.setHeader('X-XSS-Protection', '1; mode=block');

    next();
  });

  // Request Logging
  app.use((req: Request, res: Response, next: NextFunction) => {
    logger.debug('HTTP', `${req.method} ${req.path}`);
    next();
  });

  // Rate Limiting
  const rateLimiter = new RateLimiter(config.rateLimitWindowMs, config.rateLimitMaxRequests);
  app.use((req: Request, res: Response, next: NextFunction) => {
    const clientId = req.ip || 'unknown';
    if (!rateLimiter.check(clientId)) {
      logger.warn('RATE_LIMIT', `Rate limit exceeded for ${clientId}`);
      return res.status(429).json({ error: 'Too many requests' });
    }
    next();
  });

  // JSON body parser with size limits
  app.use(express.json({ limit: '10mb' }));

  // URL-encoded body parser
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
}
