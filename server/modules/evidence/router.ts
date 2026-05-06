/**
 * Evidence Module Router
 * Handles evidence storage, retrieval, and chain of custody
 * PHASE 4: Modular evidence implementation
 */

import { Router } from 'express';
import type { ServerConfig } from '../../config/env.js';
import { proxyToLegacy } from '../../utils/legacyProxy.js';

export function createEvidenceRouter(config: ServerConfig): Router {
  const router = Router();

  // Temporary controlled proxy to legacy server.js endpoints.
  router.post('/api/evidence', proxyToLegacy);
  router.get('/api/evidence/:id', proxyToLegacy);
  router.get('/api/evidence', proxyToLegacy);
  router.get('/api/evidence/:id/manifest', proxyToLegacy);

  return router;
}
