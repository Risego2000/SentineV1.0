/**
 * Expedient State Machine - PHASE 7
 * Implements state transitions with validation and audit trail
 * Ensures legal compliance and prevents invalid operations
 */

import {
  Expedient,
  ExpedientState,
  ExpedientStateTransition,
  ExpedientValidation,
} from './Expedient';
import { logger } from '../services/logger';

export interface StateTransitionResult {
  success: boolean;
  newState?: ExpedientState;
  error?: string;
  reason?: string;
}

/**
 * Define allowed state transitions
 */
const ALLOWED_TRANSITIONS: Record<ExpedientState, ExpedientState[]> = {
  DETECTED: ['UNDER_REVIEW', 'REJECTED'], // Auto-detection → manual review or reject
  UNDER_REVIEW: ['VALIDATED', 'REJECTED'], // Review → approve or reject
  VALIDATED: ['SIGNED', 'REJECTED'], // Validated → sign or reject (reconsidered)
  REJECTED: ['UNDER_REVIEW'], // Rejected → can reopen for review
  SIGNED: ['EXPORTED', 'REJECTED'], // Signed → export or reject if compromise found
  EXPORTED: ['ARCHIVED'], // Exported → archive when done
  ARCHIVED: [], // Terminal state
};

/**
 * Expedient State Machine
 */
export class ExpedientStateMachine {
  /**
   * Validate if transition is allowed
   */
  static canTransition(from: ExpedientState, to: ExpedientState): boolean {
    const allowed = ALLOWED_TRANSITIONS[from] || [];
    return allowed.includes(to);
  }

  /**
   * Get allowed next states
   */
  static getAllowedTransitions(currentState: ExpedientState): ExpedientState[] {
    return ALLOWED_TRANSITIONS[currentState] || [];
  }

  /**
   * Transition to UNDER_REVIEW (operator starts review)
   */
  static transitionToUnderReview(expedient: Expedient, operator: string): StateTransitionResult {
    if (!this.canTransition(expedient.state, 'UNDER_REVIEW')) {
      return {
        success: false,
        error: `No se puede transicionar de ${expedient.state} a UNDER_REVIEW`,
      };
    }

    const transition: ExpedientStateTransition = {
      from: expedient.state,
      to: 'UNDER_REVIEW',
      actor: operator,
      timestamp: Date.now(),
      reason: 'Operator started manual review',
    };

    expedient.stateHistory.push(transition);
    expedient.state = 'UNDER_REVIEW';
    expedient.updatedAt = Date.now();
    expedient.operator = operator;

    this.logTransition(expedient, transition);

    return {
      success: true,
      newState: 'UNDER_REVIEW',
    };
  }

  /**
   * Transition to VALIDATED (operator approves)
   */
  static transitionToValidated(
    expedient: Expedient,
    operator: string,
    validation: Omit<ExpedientValidation, 'validatedBy' | 'validatedAt'>
  ): StateTransitionResult {
    if (!this.canTransition(expedient.state, 'VALIDATED')) {
      return {
        success: false,
        error: `No se puede transicionar de ${expedient.state} a VALIDATED`,
      };
    }

    // Ensure evidence has been reviewed
    if (!validation.evidenceVerified || !validation.plateVerified) {
      return {
        success: false,
        error: 'Evidence and plate must be verified before validation',
      };
    }

    const validationData: ExpedientValidation = {
      ...validation,
      isValid: true,
      validatedBy: operator,
      validatedAt: Date.now(),
    };

    const transition: ExpedientStateTransition = {
      from: expedient.state,
      to: 'VALIDATED',
      actor: operator,
      timestamp: Date.now(),
      reason: 'Operator validated infraction',
    };

    expedient.validation = validationData;
    expedient.stateHistory.push(transition);
    expedient.state = 'VALIDATED';
    expedient.updatedAt = Date.now();
    expedient.operator = operator;

    this.logTransition(expedient, transition);

    return {
      success: true,
      newState: 'VALIDATED',
    };
  }

  /**
   * Transition to REJECTED (operator rejects)
   */
  static transitionToRejected(
    expedient: Expedient,
    operator: string,
    reason: string
  ): StateTransitionResult {
    if (!this.canTransition(expedient.state, 'REJECTED')) {
      return {
        success: false,
        error: `No se puede transicionar de ${expedient.state} a REJECTED`,
      };
    }

    if (!reason || reason.length < 10) {
      return {
        success: false,
        error: 'Rejection reason must be at least 10 characters',
      };
    }

    const transition: ExpedientStateTransition = {
      from: expedient.state,
      to: 'REJECTED',
      actor: operator,
      timestamp: Date.now(),
      reason,
    };

    expedient.stateHistory.push(transition);
    expedient.state = 'REJECTED';
    expedient.rejectionReason = reason;
    expedient.updatedAt = Date.now();

    this.logTransition(expedient, transition);

    return {
      success: true,
      newState: 'REJECTED',
      reason,
    };
  }

  /**
   * Transition to SIGNED (supervisor approves and signs)
   */
  static transitionToSigned(
    expedient: Expedient,
    supervisor: string,
    signatureHash: string,
    certFingerprint?: string
  ): StateTransitionResult {
    if (!this.canTransition(expedient.state, 'SIGNED')) {
      return {
        success: false,
        error: `No se puede transicionar de ${expedient.state} a SIGNED`,
      };
    }

    if (!expedient.validation?.isValid) {
      return {
        success: false,
        error: 'Expedient must be validated before signing',
      };
    }

    const transition: ExpedientStateTransition = {
      from: expedient.state,
      to: 'SIGNED',
      actor: supervisor,
      timestamp: Date.now(),
      reason: 'Digitally signed for official report',
      signature: signatureHash,
    };

    expedient.signature = {
      isSigned: true,
      signedBy: supervisor,
      signedAt: Date.now(),
      signatureHash,
      certFingerprint,
      method: 'digital',
    };

    expedient.stateHistory.push(transition);
    expedient.state = 'SIGNED';
    expedient.updatedAt = Date.now();
    expedient.supervisor = supervisor;

    this.logTransition(expedient, transition);

    return {
      success: true,
      newState: 'SIGNED',
    };
  }

  /**
   * Transition to EXPORTED (generate official report)
   */
  static transitionToExported(expedient: Expedient, actor: string): StateTransitionResult {
    if (!this.canTransition(expedient.state, 'EXPORTED')) {
      return {
        success: false,
        error: `No se puede transicionar de ${expedient.state} a EXPORTED`,
      };
    }

    if (!expedient.signature.isSigned) {
      return {
        success: false,
        error: 'Expedient must be signed before exporting official report',
      };
    }

    const transition: ExpedientStateTransition = {
      from: expedient.state,
      to: 'EXPORTED',
      actor,
      timestamp: Date.now(),
      reason: 'Official report generated and exported',
    };

    expedient.stateHistory.push(transition);
    expedient.state = 'EXPORTED';
    expedient.updatedAt = Date.now();

    this.logTransition(expedient, transition);

    return {
      success: true,
      newState: 'EXPORTED',
    };
  }

  /**
   * Transition to ARCHIVED (end of lifecycle)
   */
  static transitionToArchived(expedient: Expedient, actor: string): StateTransitionResult {
    if (!this.canTransition(expedient.state, 'ARCHIVED')) {
      return {
        success: false,
        error: `No se puede transicionar de ${expedient.state} a ARCHIVED`,
      };
    }

    const transition: ExpedientStateTransition = {
      from: expedient.state,
      to: 'ARCHIVED',
      actor,
      timestamp: Date.now(),
      reason: 'End of lifecycle - case closed',
    };

    expedient.stateHistory.push(transition);
    expedient.state = 'ARCHIVED';
    expedient.updatedAt = Date.now();

    this.logTransition(expedient, transition);

    return {
      success: true,
      newState: 'ARCHIVED',
    };
  }

  /**
   * Check if expedient can be modified
   * Once SIGNED, no modifications allowed except EXPORTED/ARCHIVED
   */
  static isModifiable(expedient: Expedient): boolean {
    const nonModifiableStates: ExpedientState[] = ['SIGNED', 'EXPORTED', 'ARCHIVED'];
    return !nonModifiableStates.includes(expedient.state);
  }

  /**
   * Get readable state name (Spanish)
   */
  static getStateName(state: ExpedientState): string {
    const names: Record<ExpedientState, string> = {
      DETECTED: 'Detectada',
      UNDER_REVIEW: 'Bajo revisión',
      VALIDATED: 'Validada',
      REJECTED: 'Rechazada',
      SIGNED: 'Firmada',
      EXPORTED: 'Exportada',
      ARCHIVED: 'Archivada',
    };
    return names[state] || state;
  }

  /**
   * Log state transition for audit
   */
  private static logTransition(expedient: Expedient, transition: ExpedientStateTransition): void {
    const auditEntry = {
      timestamp: transition.timestamp,
      action: `STATE_TRANSITION_${transition.from}_TO_${transition.to}`,
      actor: transition.actor,
      details: {
        from: transition.from,
        to: transition.to,
        reason: transition.reason,
        signature: transition.signature ? transition.signature.substring(0, 16) + '...' : undefined,
      },
    };

    expedient.auditLog.push(auditEntry);

    logger.info(
      'EXPEDIENT_STATE',
      `${expedient.id}: ${transition.from} → ${transition.to} by ${transition.actor}`,
      { reason: transition.reason }
    );
  }

  /**
   * Generate audit report
   */
  static generateAuditReport(expedient: Expedient): string {
    const lines = [
      `Expedient ID: ${expedient.id}`,
      `Infraction ID: ${expedient.infractionId}`,
      `State: ${this.getStateName(expedient.state)}`,
      `License Plate: ${expedient.licensePlate}`,
      `Violation Type: ${expedient.violationType}`,
      `Created: ${new Date(expedient.createdAt).toISOString()}`,
      `Updated: ${new Date(expedient.updatedAt).toISOString()}`,
      '',
      '=== State History ===',
      ...expedient.stateHistory.map(
        (t) =>
          `${new Date(t.timestamp).toISOString()} | ${t.from} → ${t.to} | Actor: ${t.actor} | Reason: ${t.reason || 'N/A'}`
      ),
      '',
      '=== Audit Log ===',
      ...expedient.auditLog.map(
        (e) =>
          `${new Date(e.timestamp).toISOString()} | ${e.action} | Actor: ${e.actor}${e.details ? ` | Details: ${JSON.stringify(e.details)}` : ''}`
      ),
    ];

    return lines.join('\n');
  }
}
