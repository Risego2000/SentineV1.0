export interface InfractionRow {
  id?: string;
  plate?: string;
  make_model?: string;
  color?: string;
  severity?: 'CRÍTICA' | 'ALTA' | 'MEDIA' | 'BAJA';
  image_url?: string;
  video_clip_url?: string;
  video_clip?: string;
  rule_category?: string;
  description?: string;
  fine_amount?: number;
  points_deducted?: number;
  created_at?: string | number;
  video_time_code?: string;
  extra_data?: Record<string, unknown>;
  extra_snapshots?: string[];
  zoom_snapshots?: string[];
  context_snapshots?: string[];
}

export type InfractionStatus = 'DETECTED' | 'UNDER_REVIEW' | 'VALIDATED' | 'REJECTED' | 'SIGNED' | 'EXPORTED';

export interface InfractionState {
  status: InfractionStatus;
  lastModified: Date;
  modifiedBy: string;
}

export type InfractionWithState = InfractionRow & InfractionState;

export type InfractionDraft = Partial<InfractionRow>;

export type ValidatedInfraction = Required<Pick<InfractionRow, 'id' | 'plate' | 'severity'>>;
