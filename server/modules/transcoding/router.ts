/**
 * Transcoding Module Router
 * Handles video transcoding via FFmpeg
 * PHASE 4: Modular transcoding implementation
 */

import { Router } from 'express';
import type { ServerConfig } from '../../config/env.js';
import { proxyToLegacy } from '../../utils/legacyProxy.js';

export function createTranscodingRouter(config: ServerConfig): Router {
  const router = Router();

  // Temporary controlled proxy to legacy server.js endpoints.
  router.post('/api/transcode', proxyToLegacy);
  router.get('/api/transcode/:jobId', proxyToLegacy);
  router.get('/api/transcode/progress', proxyToLegacy);
  router.get('/api/transcode/status', proxyToLegacy);

  return router;
}
