/**
 * Reports Module Router
 * Handles PDF report generation, storage, and retrieval
 * PHASE 4: Modular reports implementation
 */

import { Router } from 'express';
import type { ServerConfig } from '../../config/env.js';

export function createReportsRouter(config: ServerConfig): Router {
  const router = Router();

  // TODO: Implement POST /api/reports/generate endpoint
  router.post('/api/reports/generate', async (req, res) => {
    res.status(501).json({ error: 'Endpoint not yet implemented' });
  });

  // TODO: Implement GET /api/reports/:id endpoint
  router.get('/api/reports/:id', async (req, res) => {
    res.status(501).json({ error: 'Endpoint not yet implemented' });
  });

  // TODO: Implement GET /api/reports endpoint (list)
  router.get('/api/reports', async (req, res) => {
    res.status(501).json({ error: 'Endpoint not yet implemented' });
  });

  return router;
}
