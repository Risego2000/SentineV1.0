/**
 * Health Module Router
 * Exports health check routes
 * PHASE 4: Modular router setup
 */

import { Router } from 'express';
import { HealthController } from './controller.js';
import { HealthService } from './service.js';
import type { ServerConfig } from '../../config/env.js';

export function createHealthRouter(config: ServerConfig): Router {
  const router = Router();
  const service = new HealthService(config);
  const controller = new HealthController(service);

  router.get('/health', controller.getHealth.bind(controller));
  router.get('/ready', controller.getReady.bind(controller));
  // Backward compatibility with existing frontend/electron clients.
  router.get('/api/health', controller.getHealth.bind(controller));
  router.get('/api/ready', controller.getReady.bind(controller));

  return router;
}
