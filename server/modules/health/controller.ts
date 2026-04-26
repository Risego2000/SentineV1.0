/**
 * Health Check Controller
 * Endpoints for system health and readiness checks
 * PHASE 4: Modular health check implementation
 */

import { Request, Response } from 'express';
import { HealthService } from './service.js';
import { logger } from '../../../services/logger.js';

export class HealthController {
  constructor(private service: HealthService) {}

  async getHealth(req: Request, res: Response): Promise<void> {
    try {
      const health = await this.service.checkHealth();
      res.status(200).json(health);
    } catch (error) {
      logger.error('HEALTH', 'Error checking health', error);
      res.status(500).json({ error: 'Health check failed' });
    }
  }

  async getReady(req: Request, res: Response): Promise<void> {
    try {
      const ready = await this.service.checkReady();

      if (ready.ready) {
        res.status(200).json(ready);
      } else {
        res.status(503).json(ready);
      }
    } catch (error) {
      logger.error('HEALTH', 'Error checking readiness', error);
      res.status(500).json({ error: 'Readiness check failed' });
    }
  }
}
