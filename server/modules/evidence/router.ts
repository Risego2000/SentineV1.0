/**
 * Evidence Module Router
 * Handles evidence storage, retrieval, and chain of custody
 * PHASE 4: Modular evidence implementation
 */

import { Router } from 'express';
import type { ServerConfig } from '../../config/env.js';

export function createEvidenceRouter(config: ServerConfig): Router {
  const router = Router();

  // TODO: Implement POST /api/evidence endpoint
  // Store evidence with chain of custody
  router.post('/api/evidence', async (req, res) => {
    res.status(501).json({ error: 'Endpoint not yet implemented' });
  });

  // TODO: Implement GET /api/evidence/:id endpoint
  router.get('/api/evidence/:id', async (req, res) => {
    res.status(501).json({ error: 'Endpoint not yet implemented' });
  });

  // TODO: Implement GET /api/evidence endpoint (list)
  router.get('/api/evidence', async (req, res) => {
    res.status(501).json({ error: 'Endpoint not yet implemented' });
  });

  // TODO: Implement GET /api/evidence/:id/manifest endpoint
  router.get('/api/evidence/:id/manifest', async (req, res) => {
    res.status(501).json({ error: 'Endpoint not yet implemented' });
  });

  return router;
}
