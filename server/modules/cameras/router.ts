/**
 * Cameras Module Router
 * Handles IP camera stream validation and management
 * PHASE 4: Modular cameras implementation
 */

import { Router } from 'express';
import type { ServerConfig } from '../../config/env.js';

export function createCamerasRouter(config: ServerConfig): Router {
  const router = Router();

  // TODO: Implement POST /api/cameras/validate endpoint
  // Validate IP camera connection and RTSP stream
  router.post('/api/cameras/validate', async (req, res) => {
    res.status(501).json({ error: 'Endpoint not yet implemented' });
  });

  // TODO: Implement GET /api/cameras endpoint (list)
  router.get('/api/cameras', async (req, res) => {
    res.status(501).json({ error: 'Endpoint not yet implemented' });
  });

  return router;
}
