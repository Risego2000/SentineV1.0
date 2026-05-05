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
      const body: any = req.body || {};
      let request: InfractionAnalysisRequest;

      // Frontend forensic payload compatibility:
      // { track, line, directives, auditPreset }
      if (body.track && body.line) {
        const speed = Number(body.track?.avgVelocity) || Number(body.track?.velocity) || 0;
        request = {
          infractionType:
            body.line?.violationKind || body.line?.label || body.line?.type || 'UNKNOWN',
          vehicleData: {
            plate: body.track?.plateOcr || body.track?.plate || 'DESCONOCIDO',
            type: body.track?.label || 'vehicle',
          },
          geometryData: {
            speed,
            angle: Number(body.track?.heading) || 0,
            coordinates: body.track?.tail || [],
          },
          timestamp: new Date().toISOString(),
          directives: typeof body.directives === 'string' ? body.directives : '',
          lineLabel: body.line?.label,
          lineType: body.line?.type,
        };
      } else {
        request = body as InfractionAnalysisRequest;
      }

      if (!request.infractionType) {
        res.status(400).json({ error: 'Missing infractionType or compatible track/line payload' });
        return;
      }

      const aiService = getAIService();
      const analysis = await aiService.analyzeInfraction(request);

      // Adapt response shape expected by frontend AuditResponse
      res.json({
        infraction: analysis.confirmed,
        confidence: analysis.confidence,
        severity:
          analysis.severity === 'critical'
            ? 'CRITICAL'
            : analysis.severity === 'high'
              ? 'HIGH'
              : analysis.severity === 'low'
                ? 'LOW'
                : 'MEDIUM',
        description: analysis.analysis,
        reasoning: [analysis.analysis, analysis.evidenceSummary || 'Sin resumen de evidencia'],
        legalBase: analysis.legalBasis || '',
        ruleCategory: request.infractionType || 'UNKNOWN',
        plate: request.vehicleData?.plate || 'DESCONOCIDO',
        makeModel: request.vehicleData?.type || 'DESCONOCIDO',
        color: request.vehicleData?.color || 'DESCONOCIDO',
        videoTimeCode: request.timestamp || new Date().toISOString(),
        recommendedAction: analysis.recommendedAction,
      });
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
        res
          .status(400)
          .json({ error: 'Missing required fields: infractionType, trajectoryPoints' });
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
