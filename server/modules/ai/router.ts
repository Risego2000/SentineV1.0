/**
 * AI Module Router
 * Handles Gemini AI analysis (trajectory, geometry generation)
 * PHASE 4: Modular AI implementation
 */

import { Router } from 'express';
import type { ServerConfig } from '../../config/env.js';
import { AIController } from './controller';

export function createAIRouter(config: ServerConfig): Router {
  const router = Router();

  /**
   * POST /api/ai/audit
   * Analyze an infraction and return assessment
   */
  router.post('/api/ai/audit', AIController.analyzeInfraction);

  /**
   * POST /api/ai/geometry
   * Analyze trajectory geometry and calculate metrics
   */
  router.post('/api/ai/geometry', AIController.analyzeGeometry);

  return router;
}
