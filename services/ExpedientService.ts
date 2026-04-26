/**
 * Expedient Service - PHASE 7
 * Business logic for managing expedient lifecycle
 * Integrates state machine, signatures, and storage
 */

import { Expedient, createExpedient } from '../domain/Expedient';
import { ExpedientStateMachine } from '../domain/ExpedientStateMachine';
import { SignatureService } from './SignatureService';
import { logger } from './logger';
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
      return await this.repository.getById(id);
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
  async signExpedient(
    id: string,
    request: SignExpedientRequest
  ): Promise<Expedient | null> {
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
  async exportExpedient(
    id: string,
    request: ExportExpedientRequest
  ): Promise<string | null> {
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
      return await this.repository.getByState(state);
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
      return await this.repository.getAll();
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
}

// Singleton instance
let instance: ExpedientService | null = null;

export function initializeExpedientService(): ExpedientService {
  if (!instance) {
    instance = new ExpedientService();
    logger.info('EXPEDIENT_SERVICE', 'Expedient service initialized');
  }
  return instance;
}

export function getExpedientService(): ExpedientService {
  if (!instance) {
    instance = new ExpedientService();
  }
  return instance;
}
