/**
 * Expedient State Machine Tests - PHASE 8
 * Unit tests for legal workflow and transitions
 */

import { createExpedient, isExpedientReadyForSignature, isExpedientReadyForExport } from '../domain/Expedient';
import { ExpedientStateMachine } from '../domain/ExpedientStateMachine';

describe('Expedient State Machine - PHASE 8', () => {
  describe('State Transitions - Valid Paths', () => {
    it('should allow DETECTED → UNDER_REVIEW', () => {
      const exp = createExpedient('INF-001', 'STOP', 'Calle Main', Date.now(), 'EV-001', 'AB-1234');

      expect(exp.state).toBe('DETECTED');

      const result = ExpedientStateMachine.transitionToUnderReview(exp, 'officer1');

      expect(result.success).toBe(true);
      expect(exp.state).toBe('UNDER_REVIEW');
    });

    it('should allow UNDER_REVIEW → VALIDATED', () => {
      const exp = createExpedient('INF-001', 'STOP', 'Calle Main', Date.now(), 'EV-001', 'AB-1234');
      ExpedientStateMachine.transitionToUnderReview(exp, 'officer1');

      const result = ExpedientStateMachine.transitionToValidated(exp, 'officer1', {
        evidenceVerified: true,
        plateVerified: true,
        speedVerified: true,
      });

      expect(result.success).toBe(true);
      expect(exp.state).toBe('VALIDATED');
    });

    it('should allow VALIDATED → SIGNED', () => {
      const exp = createExpedient('INF-001', 'STOP', 'Calle Main', Date.now(), 'EV-001', 'AB-1234');
      exp.photosCount = 5;
      ExpedientStateMachine.transitionToUnderReview(exp, 'officer1');
      ExpedientStateMachine.transitionToValidated(exp, 'officer1', {
        evidenceVerified: true,
        plateVerified: true,
        speedVerified: true,
      });

      const result = ExpedientStateMachine.transitionToSigned(exp, 'supervisor1', 'sig_hash_' + Date.now());

      expect(result.success).toBe(true);
      expect(exp.state).toBe('SIGNED');
      expect(exp.signature.isSigned).toBe(true);
    });

    it('should allow SIGNED → EXPORTED', () => {
      const exp = createExpedient('INF-001', 'STOP', 'Calle Main', Date.now(), 'EV-001', 'AB-1234');
      exp.photosCount = 5;
      ExpedientStateMachine.transitionToUnderReview(exp, 'officer1');
      ExpedientStateMachine.transitionToValidated(exp, 'officer1', {
        evidenceVerified: true,
        plateVerified: true,
        speedVerified: true,
      });
      ExpedientStateMachine.transitionToSigned(exp, 'supervisor1', 'sig_hash_' + Date.now());

      const result = ExpedientStateMachine.transitionToExported(exp, 'system');

      expect(result.success).toBe(true);
      expect(exp.state).toBe('EXPORTED');
    });

    it('should allow EXPORTED → ARCHIVED', () => {
      const exp = createExpedient('INF-001', 'STOP', 'Calle Main', Date.now(), 'EV-001', 'AB-1234');
      exp.photosCount = 5;
      ExpedientStateMachine.transitionToUnderReview(exp, 'officer1');
      ExpedientStateMachine.transitionToValidated(exp, 'officer1', {
        evidenceVerified: true,
        plateVerified: true,
        speedVerified: true,
      });
      ExpedientStateMachine.transitionToSigned(exp, 'supervisor1', 'sig_hash_' + Date.now());
      ExpedientStateMachine.transitionToExported(exp, 'system');

      const result = ExpedientStateMachine.transitionToArchived(exp, 'system');

      expect(result.success).toBe(true);
      expect(exp.state).toBe('ARCHIVED');
    });
  });

  describe('State Transitions - Rejections', () => {
    it('should allow DETECTED → REJECTED', () => {
      const exp = createExpedient('INF-001', 'STOP', 'Calle Main', Date.now(), 'EV-001', 'AB-1234');

      const result = ExpedientStateMachine.transitionToRejected(exp, 'officer1', 'No evidence of violation');

      expect(result.success).toBe(true);
      expect(exp.state).toBe('REJECTED');
      expect(exp.rejectionReason).toBe('No evidence of violation');
    });

    it('should allow UNDER_REVIEW → REJECTED', () => {
      const exp = createExpedient('INF-001', 'STOP', 'Calle Main', Date.now(), 'EV-001', 'AB-1234');
      ExpedientStateMachine.transitionToUnderReview(exp, 'officer1');

      const result = ExpedientStateMachine.transitionToRejected(exp, 'officer1', 'Plate could not be verified');

      expect(result.success).toBe(true);
      expect(exp.state).toBe('REJECTED');
    });

    it('should allow REJECTED → UNDER_REVIEW (reopen)', () => {
      const exp = createExpedient('INF-001', 'STOP', 'Calle Main', Date.now(), 'EV-001', 'AB-1234');
      ExpedientStateMachine.transitionToUnderReview(exp, 'officer1');
      ExpedientStateMachine.transitionToRejected(exp, 'officer1', 'Need more evidence');

      const result = ExpedientStateMachine.transitionToUnderReview(exp, 'supervisor1');

      expect(result.success).toBe(true);
      expect(exp.state).toBe('UNDER_REVIEW');
    });

    it('should require minimum length for rejection reason', () => {
      const exp = createExpedient('INF-001', 'STOP', 'Calle Main', Date.now(), 'EV-001', 'AB-1234');

      const result = ExpedientStateMachine.transitionToRejected(exp, 'officer1', 'Short');

      expect(result.success).toBe(false);
      expect(result.error).toContain('at least 10');
    });
  });

  describe('Invalid State Transitions', () => {
    it('should NOT allow DETECTED → VALIDATED (skip UNDER_REVIEW)', () => {
      const exp = createExpedient('INF-001', 'STOP', 'Calle Main', Date.now(), 'EV-001', 'AB-1234');

      const result = ExpedientStateMachine.transitionToValidated(exp, 'officer1', {
        evidenceVerified: true,
        plateVerified: true,
        speedVerified: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot transition');
    });

    it('should NOT allow DETECTED → SIGNED (skip multiple)', () => {
      const exp = createExpedient('INF-001', 'STOP', 'Calle Main', Date.now(), 'EV-001', 'AB-1234');

      const result = ExpedientStateMachine.transitionToSigned(exp, 'supervisor1', 'sig_hash');

      expect(result.success).toBe(false);
    });

    it('should NOT allow VALIDATED → UNDER_REVIEW (go backwards)', () => {
      const exp = createExpedient('INF-001', 'STOP', 'Calle Main', Date.now(), 'EV-001', 'AB-1234');
      ExpedientStateMachine.transitionToUnderReview(exp, 'officer1');
      ExpedientStateMachine.transitionToValidated(exp, 'officer1', {
        evidenceVerified: true,
        plateVerified: true,
        speedVerified: true,
      });

      const result = ExpedientStateMachine.transitionToUnderReview(exp, 'officer1');

      expect(result.success).toBe(false);
    });

    it('should NOT allow ARCHIVED → anything', () => {
      const exp = createExpedient('INF-001', 'STOP', 'Calle Main', Date.now(), 'EV-001', 'AB-1234');
      exp.photosCount = 5;
      ExpedientStateMachine.transitionToUnderReview(exp, 'officer1');
      ExpedientStateMachine.transitionToValidated(exp, 'officer1', {
        evidenceVerified: true,
        plateVerified: true,
        speedVerified: true,
      });
      ExpedientStateMachine.transitionToSigned(exp, 'supervisor1', 'sig_hash_' + Date.now());
      ExpedientStateMachine.transitionToExported(exp, 'system');
      ExpedientStateMachine.transitionToArchived(exp, 'system');

      const result = ExpedientStateMachine.transitionToUnderReview(exp, 'officer1');

      expect(result.success).toBe(false);
    });
  });

  describe('Validation Requirements', () => {
    it('should require evidence verification before VALIDATED', () => {
      const exp = createExpedient('INF-001', 'STOP', 'Calle Main', Date.now(), 'EV-001', 'AB-1234');
      ExpedientStateMachine.transitionToUnderReview(exp, 'officer1');

      const result = ExpedientStateMachine.transitionToValidated(exp, 'officer1', {
        evidenceVerified: false, // Not verified!
        plateVerified: true,
        speedVerified: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('verified');
    });

    it('should require validation before SIGNED', () => {
      const exp = createExpedient('INF-001', 'STOP', 'Calle Main', Date.now(), 'EV-001', 'AB-1234');
      exp.photosCount = 5;
      ExpedientStateMachine.transitionToUnderReview(exp, 'officer1');
      // Skip VALIDATED

      const result = ExpedientStateMachine.transitionToSigned(exp, 'supervisor1', 'sig_hash_' + Date.now());

      expect(result.success).toBe(false);
      expect(result.error).toContain('validated');
    });

    it('should require signature before EXPORTED', () => {
      const exp = createExpedient('INF-001', 'STOP', 'Calle Main', Date.now(), 'EV-001', 'AB-1234');
      exp.photosCount = 5;
      ExpedientStateMachine.transitionToUnderReview(exp, 'officer1');
      ExpedientStateMachine.transitionToValidated(exp, 'officer1', {
        evidenceVerified: true,
        plateVerified: true,
        speedVerified: true,
      });
      // Skip SIGNED

      const result = ExpedientStateMachine.transitionToExported(exp, 'system');

      expect(result.success).toBe(false);
      expect(result.error).toContain('signed');
    });
  });

  describe('State History & Audit Trail', () => {
    it('should record all state transitions', () => {
      const exp = createExpedient('INF-001', 'STOP', 'Calle Main', Date.now(), 'EV-001', 'AB-1234');
      const initialHistoryLength = exp.stateHistory.length; // 1 (CREATED)

      ExpedientStateMachine.transitionToUnderReview(exp, 'officer1');
      ExpedientStateMachine.transitionToValidated(exp, 'officer1', {
        evidenceVerified: true,
        plateVerified: true,
        speedVerified: true,
      });

      expect(exp.stateHistory.length).toBe(initialHistoryLength + 2);
      expect(exp.stateHistory[exp.stateHistory.length - 1].to).toBe('VALIDATED');
    });

    it('should record actor for each transition', () => {
      const exp = createExpedient('INF-001', 'STOP', 'Calle Main', Date.now(), 'EV-001', 'AB-1234');

      ExpedientStateMachine.transitionToUnderReview(exp, 'officer_alice');

      const lastTransition = exp.stateHistory[exp.stateHistory.length - 1];
      expect(lastTransition.actor).toBe('officer_alice');
    });

    it('should record timestamp for each transition', () => {
      const exp = createExpedient('INF-001', 'STOP', 'Calle Main', Date.now(), 'EV-001', 'AB-1234');
      const beforeTime = Date.now();

      ExpedientStateMachine.transitionToUnderReview(exp, 'officer1');

      const afterTime = Date.now();
      const lastTransition = exp.stateHistory[exp.stateHistory.length - 1];

      expect(lastTransition.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(lastTransition.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should generate comprehensive audit report', () => {
      const exp = createExpedient('INF-001', 'STOP', 'Calle Main', Date.now(), 'EV-001', 'AB-1234');
      ExpedientStateMachine.transitionToUnderReview(exp, 'officer1');
      ExpedientStateMachine.transitionToRejected(exp, 'officer1', 'Need more evidence');

      const report = ExpedientStateMachine.generateAuditReport(exp);

      expect(report).toContain(exp.id);
      expect(report).toContain('DETECTED');
      expect(report).toContain('UNDER_REVIEW');
      expect(report).toContain('REJECTED');
      expect(report).toContain('officer1');
    });
  });

  describe('Modifiability Lock', () => {
    it('should allow modification in DETECTED state', () => {
      const exp = createExpedient('INF-001', 'STOP', 'Calle Main', Date.now(), 'EV-001', 'AB-1234');

      expect(ExpedientStateMachine.isModifiable(exp)).toBe(true);
    });

    it('should allow modification in VALIDATED state', () => {
      const exp = createExpedient('INF-001', 'STOP', 'Calle Main', Date.now(), 'EV-001', 'AB-1234');
      ExpedientStateMachine.transitionToUnderReview(exp, 'officer1');
      ExpedientStateMachine.transitionToValidated(exp, 'officer1', {
        evidenceVerified: true,
        plateVerified: true,
        speedVerified: true,
      });

      expect(ExpedientStateMachine.isModifiable(exp)).toBe(true);
    });

    it('should PREVENT modification in SIGNED state', () => {
      const exp = createExpedient('INF-001', 'STOP', 'Calle Main', Date.now(), 'EV-001', 'AB-1234');
      exp.photosCount = 5;
      ExpedientStateMachine.transitionToUnderReview(exp, 'officer1');
      ExpedientStateMachine.transitionToValidated(exp, 'officer1', {
        evidenceVerified: true,
        plateVerified: true,
        speedVerified: true,
      });
      ExpedientStateMachine.transitionToSigned(exp, 'supervisor1', 'sig_hash_' + Date.now());

      expect(ExpedientStateMachine.isModifiable(exp)).toBe(false);
    });

    it('should PREVENT modification in EXPORTED state', () => {
      const exp = createExpedient('INF-001', 'STOP', 'Calle Main', Date.now(), 'EV-001', 'AB-1234');
      exp.photosCount = 5;
      ExpedientStateMachine.transitionToUnderReview(exp, 'officer1');
      ExpedientStateMachine.transitionToValidated(exp, 'officer1', {
        evidenceVerified: true,
        plateVerified: true,
        speedVerified: true,
      });
      ExpedientStateMachine.transitionToSigned(exp, 'supervisor1', 'sig_hash_' + Date.now());
      ExpedientStateMachine.transitionToExported(exp, 'system');

      expect(ExpedientStateMachine.isModifiable(exp)).toBe(false);
    });

    it('should PREVENT modification in ARCHIVED state', () => {
      const exp = createExpedient('INF-001', 'STOP', 'Calle Main', Date.now(), 'EV-001', 'AB-1234');
      exp.photosCount = 5;
      ExpedientStateMachine.transitionToUnderReview(exp, 'officer1');
      ExpedientStateMachine.transitionToValidated(exp, 'officer1', {
        evidenceVerified: true,
        plateVerified: true,
        speedVerified: true,
      });
      ExpedientStateMachine.transitionToSigned(exp, 'supervisor1', 'sig_hash_' + Date.now());
      ExpedientStateMachine.transitionToExported(exp, 'system');
      ExpedientStateMachine.transitionToArchived(exp, 'system');

      expect(ExpedientStateMachine.isModifiable(exp)).toBe(false);
    });
  });

  describe('Readiness Checks', () => {
    it('should require VALIDATED state for signature', () => {
      const exp = createExpedient('INF-001', 'STOP', 'Calle Main', Date.now(), 'EV-001', 'AB-1234');

      expect(isExpedientReadyForSignature(exp)).toBe(false); // DETECTED state
    });

    it('should check all signature requirements', () => {
      const exp = createExpedient('INF-001', 'STOP', 'Calle Main', Date.now(), 'EV-001', 'AB-1234');
      exp.photosCount = 5;
      ExpedientStateMachine.transitionToUnderReview(exp, 'officer1');
      ExpedientStateMachine.transitionToValidated(exp, 'officer1', {
        evidenceVerified: true,
        plateVerified: true,
        speedVerified: true,
      });

      expect(isExpedientReadyForSignature(exp)).toBe(true);
    });

    it('should require SIGNED state for export', () => {
      const exp = createExpedient('INF-001', 'STOP', 'Calle Main', Date.now(), 'EV-001', 'AB-1234');

      expect(isExpedientReadyForExport(exp)).toBe(false);
    });

    it('should check export requirements', () => {
      const exp = createExpedient('INF-001', 'STOP', 'Calle Main', Date.now(), 'EV-001', 'AB-1234');
      exp.photosCount = 5;
      ExpedientStateMachine.transitionToUnderReview(exp, 'officer1');
      ExpedientStateMachine.transitionToValidated(exp, 'officer1', {
        evidenceVerified: true,
        plateVerified: true,
        speedVerified: true,
      });
      ExpedientStateMachine.transitionToSigned(exp, 'supervisor1', 'sig_hash_' + Date.now());

      expect(isExpedientReadyForExport(exp)).toBe(true);
    });
  });
});
