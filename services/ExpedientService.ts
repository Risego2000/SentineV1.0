/**
 * Expedient Service - PHASE 7
 * Business logic for managing expedient lifecycle
 * Integrates state machine, signatures, and storage
 */

import { Expedient, createExpedient } from '../domain/Expedient';
import { ExpedientStateMachine } from '../domain/ExpedientStateMachine';
import { SignatureService } from './SignatureService';
import { logger } from './logger';
import { evidenceDB } from './EvidenceDB';
import {
  ExpedientRepository,
  initializeExpedientRepository,
  getExpedientRepository,
} from './ExpedientRepository';
import { supabase } from '../utils/supabaseClient';

export interface CreateExpedientRequest {
  infractionId: string;
  violationType: 'STOP' | 'FORBIDDEN_TURN' | 'SPEED_VIOLATION' | 'OTHER';
  location: string;
  timestamp: number;
  evidenceId: string;
  licensePlate: string;
}

export interface ValidateExpedientRequest {
  operatorName: string;
  evidenceVerified: boolean;
  plateVerified: boolean;
  speedVerified: boolean;
  notes?: string;
}

export interface SignExpedientRequest {
  supervisorName: string;
  supervisorEmail?: string;
  organization?: string;
}

export interface ExportExpedientRequest {
  format: 'pdf' | 'json' | 'txt';
  includeAuditTrail: boolean;
}

/**
 * Expedient Service - Manage legal case lifecycle
 * Uses ExpedientRepository for persistence
 */
export class ExpedientService {
  private repository: ExpedientRepository | null = null;

  constructor() {
    // Initialize repository with Supabase client
    this.repository = initializeExpedientRepository(supabase as any);
  }

  private async hydrateEvidence(expedient: Expedient): Promise<Expedient> {
    if (
      expedient.image ||
      expedient.extraSnapshots?.length ||
      expedient.zoomSnapshots?.length ||
      expedient.videoClip
    ) {
      return expedient;
    }

    try {
      // 1) Primary source: raw evidence package by evidenceId (IndexedDB/memory).
      const rawEvidence = expedient.evidenceId
        ? await evidenceDB.getEvidence(String(expedient.evidenceId))
        : null;

      let hydratedFromEvidence: Expedient = expedient;
      if (rawEvidence) {
        hydratedFromEvidence = {
          ...hydratedFromEvidence,
          image:
            hydratedFromEvidence.image ||
            rawEvidence.zoomSnapshots?.[rawEvidence.zoomSnapshots.length - 1] ||
            rawEvidence.contextSnapshots?.[0] ||
            rawEvidence.snapshots?.[0],
          extraSnapshots: hydratedFromEvidence.extraSnapshots?.length
            ? hydratedFromEvidence.extraSnapshots
            : rawEvidence.contextSnapshots || hydratedFromEvidence.extraSnapshots,
          zoomSnapshots: hydratedFromEvidence.zoomSnapshots?.length
            ? hydratedFromEvidence.zoomSnapshots
            : rawEvidence.zoomSnapshots || hydratedFromEvidence.zoomSnapshots,
          videoClip:
            hydratedFromEvidence.videoClip || rawEvidence.clip || hydratedFromEvidence.videoClip,
          ocrResults: hydratedFromEvidence.ocrResults?.length
            ? hydratedFromEvidence.ocrResults
            : rawEvidence.ocrResults || hydratedFromEvidence.ocrResults,
          photosCount:
            hydratedFromEvidence.photosCount ||
            (rawEvidence.contextSnapshots?.length || 0) + (rawEvidence.zoomSnapshots?.length || 0),
        };
      }

      // If we already have evidence populated after rawEvidence hydration, return early.
      if (
        hydratedFromEvidence.image ||
        hydratedFromEvidence.extraSnapshots?.length ||
        hydratedFromEvidence.zoomSnapshots?.length ||
        hydratedFromEvidence.videoClip
      ) {
        return hydratedFromEvidence;
      }

      // 2) Secondary source: infraction logs cache (legacy/fallback).
      const infractions = await evidenceDB.getAllInfractions();
      const match = infractions.find((infraction) => {
        const id = String(infraction.id);
        return id === hydratedFromEvidence.infractionId || id === hydratedFromEvidence.evidenceId;
      });

      if (!match) return hydratedFromEvidence;

      return {
        ...hydratedFromEvidence,
        image: match.image ?? hydratedFromEvidence.image,
        extraSnapshots: match.extraSnapshots ?? hydratedFromEvidence.extraSnapshots,
        zoomSnapshots: match.zoomSnapshots ?? hydratedFromEvidence.zoomSnapshots,
        ocrResults: match.ocrResults ?? hydratedFromEvidence.ocrResults,
        plateOcr: match.plateOcr ?? hydratedFromEvidence.plateOcr,
        plateOcrCandidates: match.plateOcrCandidates ?? hydratedFromEvidence.plateOcrCandidates,
        videoClip: match.videoClip ?? hydratedFromEvidence.videoClip,
        playbackTime: match.playbackTime ?? hydratedFromEvidence.playbackTime,
        videoTimeCode: match.videoTimeCode ?? hydratedFromEvidence.videoTimeCode,
        visualTimestamp: match.visualTimestamp ?? hydratedFromEvidence.visualTimestamp,
        makeModel: match.makeModel ?? hydratedFromEvidence.makeModel,
        vehicleDescription: match.makeModel ?? hydratedFromEvidence.vehicleDescription,
        color: match.color ?? hydratedFromEvidence.color,
        description: match.description ?? hydratedFromEvidence.description,
        descripcionDetalladaHechos:
          match.description ?? hydratedFromEvidence.descripcionDetalladaHechos,
        severity: match.severity ?? hydratedFromEvidence.severity,
        ruleCategory: match.ruleCategory ?? hydratedFromEvidence.ruleCategory,
        legalBase: match.legalBase ?? hydratedFromEvidence.legalBase,
        reasoning: match.reasoning ?? hydratedFromEvidence.reasoning,
        telemetrySpeedEstimated:
          match.telemetry?.speedEstimated ?? hydratedFromEvidence.telemetrySpeedEstimated,
        telemetryBehaviorAnomalies:
          match.telemetry?.behaviorAnomalies ?? hydratedFromEvidence.telemetryBehaviorAnomalies,
        operativeCode: match.operativeCode ?? hydratedFromEvidence.operativeCode,
        priority: match.priority ?? hydratedFromEvidence.priority,
        priorityLevel: match.priorityLevel ?? hydratedFromEvidence.priorityLevel,
        fineAmount: match.fineAmount ?? hydratedFromEvidence.fineAmount,
        pointsDeducted: match.pointsDeducted ?? hydratedFromEvidence.pointsDeducted,
        photosCount:
          hydratedFromEvidence.photosCount ||
          Number(Boolean(match.image)) +
            (match.extraSnapshots?.length || 0) +
            (match.zoomSnapshots?.length || 0),
      };
    } catch (error) {
      logger.warn(
        'EXPEDIENT_SERVICE',
        'Could not hydrate expedient evidence from local cache',
        error
      );
      return expedient;
    }
  }

  private async hydrateEvidenceList(expedients: Expedient[]): Promise<Expedient[]> {
    return Promise.all(expedients.map((expedient) => this.hydrateEvidence(expedient)));
  }

  /**
   * Create new expedient from infraction detection
   */
  async createExpedient(request: CreateExpedientRequest): Promise<Expedient> {
    try {
      const expedient = createExpedient(
        request.infractionId,
        request.violationType,
        request.location,
        request.timestamp,
        request.evidenceId,
        request.licensePlate
      );

      // Persist to database
      if (this.repository) {
        await this.repository.create(expedient);
      }

      logger.info('EXPEDIENT_SERVICE', `Created expedient ${expedient.id}`, {
        violationType: request.violationType,
        licensePlate: request.licensePlate,
      });

      return expedient;
    } catch (error) {
      logger.error('EXPEDIENT_SERVICE', 'Failed to create expedient', error);
      throw error;
    }
  }

  /**
   * Get expedient by ID
   */
  async getExpedient(id: string): Promise<Expedient | null> {
    try {
      if (!this.repository) {
        return null;
      }
      const expedient = await this.repository.getById(id);
      return expedient ? await this.hydrateEvidence(expedient) : null;
    } catch (error) {
      logger.error('EXPEDIENT_SERVICE', 'Failed to get expedient', error);
      return null;
    }
  }

  /**
   * Start manual review (transition to UNDER_REVIEW)
   */
  async reviewExpedient(id: string, operatorName: string): Promise<Expedient | null> {
    try {
      const expedient = await this.getExpedient(id);
      if (!expedient) {
        logger.warn('EXPEDIENT_SERVICE', `Expedient not found: ${id}`);
        return null;
      }

      const result = ExpedientStateMachine.transitionToUnderReview(expedient, operatorName);

      if (!result.success) {
        logger.warn('EXPEDIENT_SERVICE', `Cannot review expedient: ${result.error}`);
        return null;
      }

      // Persist to database
      if (this.repository) {
        await this.repository.update(expedient);
      }

      return expedient;
    } catch (error) {
      logger.error('EXPEDIENT_SERVICE', 'Failed to review expedient', error);
      return null;
    }
  }

  /**
   * Validate expedient (approve after review)
   */
  async validateExpedient(
    id: string,
    request: ValidateExpedientRequest
  ): Promise<Expedient | null> {
    try {
      const expedient = await this.getExpedient(id);
      if (!expedient) {
        logger.warn('EXPEDIENT_SERVICE', `Expedient not found: ${id}`);
        return null;
      }

      const validation = {
        isValid: true,
        evidenceVerified: request.evidenceVerified,
        plateVerified: request.plateVerified,
        speedVerified: request.speedVerified,
        notes: request.notes,
      };

      const result = ExpedientStateMachine.transitionToValidated(
        expedient,
        request.operatorName,
        validation
      );

      if (!result.success) {
        logger.warn('EXPEDIENT_SERVICE', `Cannot validate expedient: ${result.error}`);
        return null;
      }

      // Persist to database
      if (this.repository) {
        await this.repository.update(expedient);
      }

      logger.info('EXPEDIENT_SERVICE', `Expedient ${id} validated by ${request.operatorName}`, {
        evidenceVerified: request.evidenceVerified,
        plateVerified: request.plateVerified,
      });

      return expedient;
    } catch (error) {
      logger.error('EXPEDIENT_SERVICE', 'Failed to validate expedient', error);
      return null;
    }
  }

  /**
   * Reject expedient (do not proceed with infraction)
   */
  async rejectExpedient(
    id: string,
    operatorName: string,
    reason: string
  ): Promise<Expedient | null> {
    try {
      const expedient = await this.getExpedient(id);
      if (!expedient) {
        logger.warn('EXPEDIENT_SERVICE', `Expedient not found: ${id}`);
        return null;
      }

      const result = ExpedientStateMachine.transitionToRejected(expedient, operatorName, reason);

      if (!result.success) {
        logger.warn('EXPEDIENT_SERVICE', `Cannot reject expedient: ${result.error}`);
        return null;
      }

      // Persist to database
      if (this.repository) {
        await this.repository.update(expedient);
      }

      logger.info('EXPEDIENT_SERVICE', `Expedient ${id} rejected`, { reason });

      return expedient;
    } catch (error) {
      logger.error('EXPEDIENT_SERVICE', 'Failed to reject expedient', error);
      return null;
    }
  }

  /**
   * Sign expedient (create official legal document)
   */
  async signExpedient(id: string, request: SignExpedientRequest): Promise<Expedient | null> {
    try {
      const expedient = await this.getExpedient(id);
      if (!expedient) {
        logger.warn('EXPEDIENT_SERVICE', `Expedient not found: ${id}`);
        return null;
      }

      // Generate signature
      const signatureHash = await SignatureService.signExpedient(
        expedient,
        request.supervisorName,
        { method: 'digital' }
      );

      const certFingerprint = SignatureService.generateCertFingerprint(
        `${request.supervisorName}_${Date.now()}`
      );

      const result = ExpedientStateMachine.transitionToSigned(
        expedient,
        request.supervisorName,
        signatureHash,
        certFingerprint
      );

      if (!result.success) {
        logger.warn('EXPEDIENT_SERVICE', `Cannot sign expedient: ${result.error}`);
        return null;
      }

      // Persist to database
      if (this.repository) {
        await this.repository.update(expedient);
      }

      logger.info('EXPEDIENT_SERVICE', `Expedient ${id} signed by ${request.supervisorName}`, {
        signature: signatureHash.substring(0, 16),
      });

      return expedient;
    } catch (error) {
      logger.error('EXPEDIENT_SERVICE', 'Failed to sign expedient', error);
      return null;
    }
  }

  /**
   * Export expedient as official report
   */
  async exportExpedient(id: string, request: ExportExpedientRequest): Promise<string | null> {
    try {
      const expedient = await this.getExpedient(id);
      if (!expedient) {
        logger.warn('EXPEDIENT_SERVICE', `Expedient not found: ${id}`);
        return null;
      }

      // Verify signature before export
      const verification = await SignatureService.verifyExpedientSignature(expedient);
      if (!verification.isValid) {
        logger.warn('EXPEDIENT_SERVICE', `Expedient signature invalid: ${id}`);
        return null;
      }

      // Generate manifest
      const manifest = await SignatureService.generateSignedManifest(expedient);

      // Transition to EXPORTED
      const result = ExpedientStateMachine.transitionToExported(expedient, 'SYSTEM');
      if (!result.success) {
        logger.warn('EXPEDIENT_SERVICE', `Cannot export expedient: ${result.error}`);
        return null;
      }

      // Persist to database
      if (this.repository) {
        await this.repository.update(expedient);
      }

      logger.info('EXPEDIENT_SERVICE', `Expedient ${id} exported`, { format: request.format });

      return manifest;
    } catch (error) {
      logger.error('EXPEDIENT_SERVICE', 'Failed to export expedient', error);
      return null;
    }
  }

  /**
   * Archive expedient (end of lifecycle)
   */
  async archiveExpedient(id: string): Promise<Expedient | null> {
    try {
      const expedient = await this.getExpedient(id);
      if (!expedient) {
        logger.warn('EXPEDIENT_SERVICE', `Expedient not found: ${id}`);
        return null;
      }

      const result = ExpedientStateMachine.transitionToArchived(expedient, 'SYSTEM');
      if (!result.success) {
        logger.warn('EXPEDIENT_SERVICE', `Cannot archive expedient: ${result.error}`);
        return null;
      }

      // Persist to database
      if (this.repository) {
        await this.repository.update(expedient);
      }

      logger.info('EXPEDIENT_SERVICE', `Expedient ${id} archived`);

      return expedient;
    } catch (error) {
      logger.error('EXPEDIENT_SERVICE', 'Failed to archive expedient', error);
      return null;
    }
  }

  /**
   * Get expedient audit report
   */
  async getAuditReport(id: string): Promise<string | null> {
    try {
      const expedient = await this.getExpedient(id);
      if (!expedient) {
        return null;
      }

      return ExpedientStateMachine.generateAuditReport(expedient);
    } catch (error) {
      logger.error('EXPEDIENT_SERVICE', 'Failed to get audit report', error);
      return null;
    }
  }

  /**
   * List all expedients by state
   */
  async getExpedientsByState(state: string): Promise<Expedient[]> {
    try {
      if (!this.repository) {
        return [];
      }
      return await this.hydrateEvidenceList(await this.repository.getByState(state));
    } catch (error) {
      logger.error('EXPEDIENT_SERVICE', 'Failed to get expedients by state', error);
      return [];
    }
  }

  /**
   * Get all expedients
   */
  async getAllExpedients(): Promise<Expedient[]> {
    try {
      if (!this.repository) {
        return [];
      }
      return await this.hydrateEvidenceList(await this.repository.getAll());
    } catch (error) {
      logger.error('EXPEDIENT_SERVICE', 'Failed to get all expedients', error);
      return [];
    }
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<{
    total: number;
    byState: Record<string, number>;
    avgTimeToSignature: number;
  }> {
    try {
      const expedients = await this.getAllExpedients();

      const byState: Record<string, number> = {};
      let totalTimeToSignature = 0;
      let signedCount = 0;

      for (const exp of expedients) {
        byState[exp.state] = (byState[exp.state] || 0) + 1;

        if (exp.signature.isSigned) {
          totalTimeToSignature += exp.signature.signedAt - exp.createdAt;
          signedCount++;
        }
      }

      return {
        total: expedients.length,
        byState,
        avgTimeToSignature: signedCount > 0 ? totalTimeToSignature / signedCount : 0,
      };
    } catch (error) {
      logger.error('EXPEDIENT_SERVICE', 'Failed to get statistics', error);
      return {
        total: 0,
        byState: {},
        avgTimeToSignature: 0,
      };
    }
  }

  /**
   * Update expedient in database
   * Used after state transitions to persist changes
   */
  async updateExpedient(expedient: Expedient): Promise<void> {
    try {
      if (this.repository) {
        await this.repository.update(expedient);
        logger.info('EXPEDIENT_SERVICE', `Updated expedient ${expedient.id}`, {
          state: expedient.state,
        });
      }
    } catch (error) {
      logger.error('EXPEDIENT_SERVICE', `Failed to update expedient ${expedient.id}`, error);
      throw error;
    }
  }

  /**
   * Delete expedient permanently
   */
  async deleteExpedient(id: string): Promise<boolean> {
    try {
      if (!this.repository) return false;
      const ok = await this.repository.deleteById(id);
      if (ok) {
        logger.info('EXPEDIENT_SERVICE', `Deleted expedient ${id}`);
      }
      return ok;
    } catch (error) {
      logger.error('EXPEDIENT_SERVICE', `Failed to delete expedient ${id}`, error);
      return false;
    }
  }
}

// Singleton instance
let instance: ExpedientService | null = null;

export function initializeExpedientService(): ExpedientService {
  if (!instance) {
    instance = new ExpedientService();
  }
  return instance;
}

export function getExpedientService(): ExpedientService {
  if (!instance) {
    instance = new ExpedientService();
  }
  return instance;
}
