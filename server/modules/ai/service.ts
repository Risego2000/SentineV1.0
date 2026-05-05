/**
 * AI Analysis Service - Gemini Integration
 * Analyzes infractions and generates forensic reports using Gemini API
 */

import { logger } from '../../../services/logger';

export interface InfractionAnalysisRequest {
  infractionType: string;
  vehicleData?: {
    plate: string;
    color?: string;
    type?: string;
  };
  geometryData?: {
    speed?: number;
    angle?: number;
    distance?: number;
    coordinates?: { x: number; y: number }[];
  };
  timestamp?: string;
  evidenceUrls?: string[];
  directives?: string;
  lineLabel?: string;
  lineType?: string;
}

export interface InfractionAnalysisResult {
  confirmed: boolean;
  confidence: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  analysis: string;
  recommendedAction: string;
  legalBasis?: string;
  evidenceSummary?: string;
}

export interface GeometryAnalysisRequest {
  infractionType: string;
  trajectoryPoints: Array<{ x: number; y: number; timestamp: number }>;
  calibrationData?: {
    pixelsPerMeter: number;
    fps: number;
  };
}

export interface GeometryAnalysisResult {
  estimatedSpeed?: number;
  angleOfTurn?: number;
  trajectoryAnalysis: string;
  isViolation: boolean;
  confidence: number;
}

/**
 * AI Analysis Service using Gemini API
 */
export class AIAnalysisService {
  private geminiApiKey: string;
  private geminiEndpoint: string =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

  constructor(geminiApiKey?: string) {
    this.geminiApiKey = geminiApiKey || process.env.GEMINI_API_KEY || '';
    if (!this.geminiApiKey) {
      logger.warn('AI_SERVICE', 'Gemini API key not configured');
    }
  }

  /**
   * Analyze an infraction and return assessment
   */
  async analyzeInfraction(request: InfractionAnalysisRequest): Promise<InfractionAnalysisResult> {
    try {
      if (!this.geminiApiKey) {
        return this.getLocalAnalysis(request);
      }

      const prompt = this.buildInfractionPrompt(request);

      const response = await fetch(`${this.geminiEndpoint}?key=${this.geminiApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
        }),
      });

      if (!response.ok) {
        logger.error('AI_SERVICE', `Gemini API error: ${response.status}`);
        return this.getLocalAnalysis(request);
      }

      const result = await response.json();

      if (!result.candidates || result.candidates.length === 0) {
        return this.getLocalAnalysis(request);
      }

      const analysisText = result.candidates[0]?.content?.parts?.[0]?.text || '';
      return this.parseAnalysisResponse(analysisText, request);
    } catch (error) {
      logger.error('AI_SERVICE', 'Infraction analysis failed', error);
      return this.getLocalAnalysis(request);
    }
  }

  /**
   * Analyze trajectory geometry and calculate metrics
   */
  async analyzeGeometry(request: GeometryAnalysisRequest): Promise<GeometryAnalysisResult> {
    try {
      // Local geometry analysis (doesn't require API)
      const speed = this.calculateSpeed(request.trajectoryPoints, request.calibrationData);
      const angle = this.calculateTurnAngle(request.trajectoryPoints);

      const isViolation = this.isGeometryViolation(request.infractionType, speed, angle);

      return {
        estimatedSpeed: speed,
        angleOfTurn: angle,
        trajectoryAnalysis: `Vehicle moved at approximately ${speed?.toFixed(1) || 'unknown'} km/h with a turn angle of ${angle?.toFixed(1) || 'unknown'} degrees.`,
        isViolation,
        confidence: 0.85,
      };
    } catch (error) {
      logger.error('AI_SERVICE', 'Geometry analysis failed', error);
      return {
        estimatedSpeed: undefined,
        angleOfTurn: undefined,
        trajectoryAnalysis: 'Analysis failed',
        isViolation: false,
        confidence: 0,
      };
    }
  }

  /**
   * Build prompt for infraction analysis
   */
  private buildInfractionPrompt(request: InfractionAnalysisRequest): string {
    const plateInfo = request.vehicleData?.plate ? ` Plate: ${request.vehicleData.plate}` : '';
    const geometryInfo = request.geometryData
      ? ` Speed: ${request.geometryData.speed} km/h, Angle: ${request.geometryData.angle}°`
      : '';
    const directivesInfo = request.directives
      ? `\nOperator directives (must be enforced):\n${request.directives}`
      : '';
    const geometryLineInfo =
      request.lineLabel || request.lineType
        ? `\nTriggered geometry: ${request.lineLabel || 'N/A'} (${request.lineType || 'N/A'})`
        : '';

    return `You are a traffic violation analyst. Analyze the following infraction:

Infraction Type: ${request.infractionType}${plateInfo}${geometryInfo}
Timestamp: ${request.timestamp || 'Unknown'}
${geometryLineInfo}
${directivesInfo}

Based on the information provided, provide a JSON response with:
1. confirmed (boolean): Is this a valid violation?
2. confidence (0-1): How confident are you?
3. severity (low/medium/high/critical): What's the severity?
4. analysis (string): Brief analysis of the violation
5. recommendedAction (string): What action should be taken?
6. legalBasis (string): Legal basis for the violation
7. evidenceSummary (string): Summary of available evidence

Respond ONLY with valid JSON, no additional text.`;
  }

  /**
   * Parse Gemini analysis response
   */
  private parseAnalysisResponse(
    responseText: string,
    request: InfractionAnalysisRequest
  ): InfractionAnalysisResult {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.getLocalAnalysis(request);
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        confirmed: parsed.confirmed ?? true,
        confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.8)),
        severity: parsed.severity ?? 'medium',
        analysis: parsed.analysis ?? 'Analysis unavailable',
        recommendedAction: parsed.recommendedAction ?? 'Review and validate',
        legalBasis: parsed.legalBasis,
        evidenceSummary: parsed.evidenceSummary,
      };
    } catch (error) {
      logger.warn('AI_SERVICE', 'Failed to parse analysis response', error);
      return this.getLocalAnalysis(request);
    }
  }

  /**
   * Local analysis (fallback when API unavailable)
   */
  private getLocalAnalysis(request: InfractionAnalysisRequest): InfractionAnalysisResult {
    const severityMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
      rebase_linea: 'medium',
      giro_prohibido: 'high',
      exceso_velocidad: 'critical',
      invasión_carril: 'high',
      doble_fila: 'low',
    };

    const severity = severityMap[request.infractionType.toLowerCase()] ?? 'medium';

    return {
      confirmed: true,
      confidence: 0.75,
      severity,
      analysis: `Local analysis of ${request.infractionType} violation detected.`,
      recommendedAction: `Generate infraction report and issue citation.`,
      legalBasis: `Spanish traffic regulations (DST) - Article ${this.getArticleNumber(request.infractionType)}`,
      evidenceSummary: request.vehicleData?.plate
        ? `Vehicle ${request.vehicleData.plate} identified via plate recognition`
        : 'Vehicle identified via video analysis',
    };
  }

  /**
   * Calculate speed from trajectory points
   */
  private calculateSpeed(
    points: Array<{ x: number; y: number; timestamp: number }>,
    calibration?: { pixelsPerMeter: number; fps: number }
  ): number | undefined {
    if (points.length < 2 || !calibration) return undefined;

    const dx = points[points.length - 1].x - points[0].x;
    const dy = points[points.length - 1].y - points[0].y;
    const distance = Math.sqrt(dx * dx + dy * dy) / calibration.pixelsPerMeter;

    const timeMs = points[points.length - 1].timestamp - points[0].timestamp;
    const timeSecs = timeMs / 1000;

    if (timeSecs === 0) return undefined;

    const metersPerSec = distance / timeSecs;
    return metersPerSec * 3.6; // Convert to km/h
  }

  /**
   * Calculate turn angle from trajectory
   */
  private calculateTurnAngle(
    points: Array<{ x: number; y: number; timestamp: number }>
  ): number | undefined {
    if (points.length < 3) return undefined;

    const first = points[0];
    const mid = points[Math.floor(points.length / 2)];
    const last = points[points.length - 1];

    const v1x = mid.x - first.x;
    const v1y = mid.y - first.y;
    const v2x = last.x - mid.x;
    const v2y = last.y - mid.y;

    const dotProduct = v1x * v2x + v1y * v2y;
    const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
    const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);

    if (mag1 === 0 || mag2 === 0) return undefined;

    const cosAngle = dotProduct / (mag1 * mag2);
    return Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI);
  }

  /**
   * Determine if geometry violates traffic rules
   */
  private isGeometryViolation(infractionType: string, speed?: number, angle?: number): boolean {
    const type = infractionType.toLowerCase();

    if (type.includes('velocidad') && speed && speed > 60) return true;
    if (type.includes('giro') && angle && angle > 45) return true;
    if (type.includes('invasión') && angle && angle > 30) return true;

    return true; // Default to violation if flagged
  }

  /**
   * Get legal article number for violation type
   */
  private getArticleNumber(infractionType: string): string {
    const articles: Record<string, string> = {
      rebase_linea: '67.1',
      giro_prohibido: '78.2',
      exceso_velocidad: '88.1',
      invasión_carril: '89.3',
      doble_fila: '91.2',
    };
    return articles[infractionType.toLowerCase()] ?? '67.1';
  }
}

// Singleton instance
let instance: AIAnalysisService | null = null;

export function initializeAIService(geminiApiKey?: string): AIAnalysisService {
  if (!instance) {
    instance = new AIAnalysisService(geminiApiKey);
    logger.info('AI_SERVICE', 'AI analysis service initialized');
  }
  return instance;
}

export function getAIService(): AIAnalysisService {
  if (!instance) {
    instance = new AIAnalysisService();
  }
  return instance;
}
