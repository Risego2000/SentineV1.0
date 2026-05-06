/**
 * Reports Module Router
 * Handles PDF report generation, storage, and retrieval
 * PHASE 4: Modular reports implementation
 */

import { Router } from 'express';
import type { ServerConfig } from '../../config/env.js';
import { proxyToLegacy } from '../../utils/legacyProxy.js';

export function createReportsRouter(config: ServerConfig): Router {
  const router = Router();

  // Temporary controlled proxy to legacy server.js endpoints.
  router.post('/api/reports/generate', proxyToLegacy);
  router.get('/api/reports/:id', proxyToLegacy);
  router.get('/api/reports', proxyToLegacy);
  router.post('/api/reports/save', proxyToLegacy);
  router.post('/api/reports/video', proxyToLegacy);

  return router;
}
