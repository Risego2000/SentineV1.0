/**
 * Security Module Router
 * Handles authentication, CORS validation, token verification
 * PHASE 4: Modular security implementation
 */

import { Router, Request, Response } from 'express';
import type { ServerConfig } from '../../config/env.js';

export function createSecurityRouter(config: ServerConfig): Router {
  const router = Router();

  router.use((req: Request, res: Response, next) => {
    if (
      !req.path.startsWith('/api/') ||
      req.path.startsWith('/api/health') ||
      req.path.startsWith('/api/ready')
    ) {
      return next();
    }

    const origin = req.header('origin');
    const hasOrigin = typeof origin === 'string' && origin.length > 0;
    let isLoopbackOrigin = false;
    if (hasOrigin) {
      try {
        const parsed = new URL(origin as string);
        isLoopbackOrigin =
          parsed.hostname === 'localhost' ||
          parsed.hostname === '127.0.0.1' ||
          parsed.hostname === '::1';
      } catch {
        isLoopbackOrigin = false;
      }
    }

    if (process.env.NODE_ENV === 'test' || !hasOrigin || isLoopbackOrigin) {
      return next();
    }

    if (!config.apiToken) {
      return res.status(500).json({ error: 'Server auth misconfigured.' });
    }

    const bearer = req.header('Authorization')?.replace(/^Bearer\s+/i, '') || '';
    const alt = req.header('X-Sentinel-Token') || '';
    const provided = bearer || alt;
    if (provided !== config.apiToken) {
      return res.status(401).json({ error: 'Invalid or missing API token' });
    }
    return next();
  });

  return router;
}
