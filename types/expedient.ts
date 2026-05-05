import { InfractionRow } from './infraction';

export type ExpedientStatus = 'DETECTED' | 'UNDER_REVIEW' | 'VALIDATED' | 'REJECTED' | 'SIGNED' | 'EXPORTED';

export interface BaseExpedient {
  id: string;
  state: ExpedientStatus;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  lastModifiedBy: string;
}

export interface DetectedExpedient extends BaseExpedient {
  state: 'DETECTED';
  infraction: InfractionRow;
  confidence?: number;
}

export interface UnderReviewExpedient extends BaseExpedient {
  state: 'UNDER_REVIEW';
  infraction: InfractionRow;
  reviewNotes?: string;
  reviewedBy: string;
}

export interface ValidatedExpedient extends BaseExpedient {
  state: 'VALIDATED';
  infraction: InfractionRow;
  validationDate: Date;
  validatedBy: string;
}

export interface RejectedExpedient extends BaseExpedient {
  state: 'REJECTED';
  infraction: InfractionRow;
  rejectionReason: string;
  rejectedBy: string;
}

export interface SignedExpedient extends BaseExpedient {
  state: 'SIGNED';
  infraction: InfractionRow;
  signatureHash: string;
  signedBy: string;
  signedAt: Date;
}

export interface ExportedExpedient extends BaseExpedient {
  state: 'EXPORTED';
  infraction: InfractionRow;
  exportPath: string;
  exportedBy: string;
  exportedAt: Date;
}

export type Expedient =
  | DetectedExpedient
  | UnderReviewExpedient
  | ValidatedExpedient
  | RejectedExpedient
  | SignedExpedient
  | ExportedExpedient;

export type ExtractByState<T extends ExpedientStatus> = Extract<
  Expedient,
  { state: T }
>;

export type CanTransitionFrom<S extends ExpedientStatus> =
  S extends 'DETECTED'
    ? 'UNDER_REVIEW'
    : S extends 'UNDER_REVIEW'
      ? 'VALIDATED' | 'REJECTED'
      : S extends 'VALIDATED'
        ? 'SIGNED' | 'REJECTED'
        : S extends 'SIGNED'
          ? 'EXPORTED'
          : S extends 'REJECTED'
            ? 'UNDER_REVIEW'
            : never;

export type StateTransition<From extends ExpedientStatus> = {
  from: From;
  to: CanTransitionFrom<From>;
};
