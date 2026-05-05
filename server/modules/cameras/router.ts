/**
 * Cameras Module Router
 * Handles IP camera stream validation and management
 * PHASE 4: Modular cameras implementation
 */

import { Router } from 'express';
import type { ServerConfig } from '../../config/env.js';
import { proxyToLegacy } from '../../utils/legacyProxy.js';

export function createCamerasRouter(config: ServerConfig): Router {
  const router = Router();

  // Temporary controlled proxy to legacy server.js endpoints.
  router.post('/api/cameras/validate', proxyToLegacy);
  router.get('/api/cameras', proxyToLegacy);
  router.post('/api/ip-camera/session', proxyToLegacy);
  router.get('/api/ip-camera/sessions', proxyToLegacy);
  router.delete('/api/ip-camera/session/:sessionId', proxyToLegacy);
  router.get('/api/ip-camera/stream/:sessionId', proxyToLegacy);

  return router;
}
