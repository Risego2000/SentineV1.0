/**
 * Transcoding Module Router
 * Handles video transcoding via FFmpeg
 * PHASE 4: Modular transcoding implementation
 */

import { Router } from 'express';
import type { ServerConfig } from '../../config/env.js';

export function createTranscodingRouter(config: ServerConfig): Router {
  const router = Router();

  // TODO: Implement POST /api/transcode endpoint
  // - Accept video file upload
  // - Queue for FFmpeg processing
  // - Return job ID for status tracking

  router.post('/api/transcode', async (req, res) => {
    res.status(501).json({ error: 'Endpoint not yet implemented' });
  });

  router.get('/api/transcode/:jobId', async (req, res) => {
    res.status(501).json({ error: 'Endpoint not yet implemented' });
  });

  return router;
}
