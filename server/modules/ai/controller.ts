/**
 * AI Controller - Handles infraction analysis requests
 */

import { Request, Response } from 'express';
import { getAIService, InfractionAnalysisRequest, GeometryAnalysisRequest } from './service';
import { logger } from '../../../services/logger';

export class AIController {
  /**
   * POST /api/ai/audit
   * Analyze an infraction and return assessment
   */
  static async analyzeInfraction(req: Request, res: Response): Promise<void> {
    try {
      const request: InfractionAnalysisRequest = req.body;

      if (!request.infractionType) {
        res.status(400).json({ error: 'Missing infractionType' });
        return;
      }

      const aiService = getAIService();
      const analysis = await aiService.analyzeInfraction(request);

      res.json(analysis);
    } catch (error) {
      logger.error('AI_CONTROLLER', 'Infraction analysis failed', error);
      res.status(500).json({
        error: 'Analysis failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/ai/geometry
   * Analyze trajectory geometry and calculate metrics
   */
  static async analyzeGeometry(req: Request, res: Response): Promise<void> {
    try {
      const request: GeometryAnalysisRequest = req.body;

      if (!request.infractionType || !request.trajectoryPoints) {
        res.status(400).json({ error: 'Missing required fields: infractionType, trajectoryPoints' });
        return;
      }

      const aiService = getAIService();
      const analysis = await aiService.analyzeGeometry(request);

      res.json(analysis);
    } catch (error) {
      logger.error('AI_CONTROLLER', 'Geometry analysis failed', error);
      res.status(500).json({
        error: 'Geometry analysis failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
