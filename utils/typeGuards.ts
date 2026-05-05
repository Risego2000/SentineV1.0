import { Expedient, DetectedExpedient, UnderReviewExpedient, ValidatedExpedient, RejectedExpedient, SignedExpedient, ExportedExpedient } from '../types/expedient';
import { InfractionRow } from '../types/infraction';

export function isDetectedExpedient(expedient: Expedient): expedient is DetectedExpedient {
  return expedient.state === 'DETECTED';
}

export function isUnderReviewExpedient(expedient: Expedient): expedient is UnderReviewExpedient {
  return expedient.state === 'UNDER_REVIEW';
}

export function isValidatedExpedient(expedient: Expedient): expedient is ValidatedExpedient {
  return expedient.state === 'VALIDATED';
}

export function isRejectedExpedient(expedient: Expedient): expedient is RejectedExpedient {
  return expedient.state === 'REJECTED';
}

export function isSignedExpedient(expedient: Expedient): expedient is SignedExpedient {
  return expedient.state === 'SIGNED';
}

export function isExportedExpedient(expedient: Expedient): expedient is ExportedExpedient {
  return expedient.state === 'EXPORTED';
}

export function assertIsInfraction(data: unknown): asserts data is InfractionRow {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid infraction: not an object');
  }

  const infraction = data as Record<string, unknown>;

  if (typeof infraction.id !== 'string' && infraction.id !== undefined) {
    throw new Error('Invalid infraction: id must be string');
  }

  if (typeof infraction.plate !== 'string' && infraction.plate !== undefined) {
    throw new Error('Invalid infraction: plate must be string');
  }

  if (typeof infraction.severity !== 'string' && infraction.severity !== undefined) {
    throw new Error('Invalid infraction: severity must be string');
  }
}

export function isValidInfraction(data: unknown): data is InfractionRow {
  try {
    assertIsInfraction(data);
    return true;
  } catch {
    return false;
  }
}

export function assertIsExpedient(data: unknown): asserts data is Expedient {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid expedient: not an object');
  }

  const expedient = data as Record<string, unknown>;
  const validStates = ['DETECTED', 'UNDER_REVIEW', 'VALIDATED', 'REJECTED', 'SIGNED', 'EXPORTED'];

  if (!validStates.includes(expedient.state as string)) {
    throw new Error(`Invalid expedient state: ${expedient.state}`);
  }

  if (typeof expedient.id !== 'string') {
    throw new Error('Invalid expedient: id must be string');
  }

  if (!expedient.infraction || typeof expedient.infraction !== 'object') {
    throw new Error('Invalid expedient: missing infraction');
  }
}

export function isValidExpedient(data: unknown): data is Expedient {
  try {
    assertIsExpedient(data);
    return true;
  } catch {
    return false;
  }
}
