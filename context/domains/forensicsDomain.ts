/**
 * ForensicsDomain - Manages forensic analysis pipeline
 * Separated from video source and UI logic.
 */

import { create } from 'zustand';
import { AuditJob, AuditJobStatus, InfractionLog } from '../types';
import { ForensicRule, FORENSIC_RULES } from '../types/forensicRules';
import { ForensicQueue, forensicQueue } from '../../services/ForensicQueue';
import { logger } from '../../services/logger';

interface ForensicsState {
  // Queue state
  pendingCount: number;
  isProcessing: boolean;

  // Audit jobs
  jobs: AuditJob[];

  // Active forensic rules
  activeRules: ForensicRule[];

  // Directives and presets
  directives: string;
  auditPreset: string;

  // Callbacks
  onInfractionDetected?: (log: InfractionLog) => void;
  onJobStatusChange?: (jobId: string, status: AuditJobStatus) => void;
}

interface ForensicsActions {
  updateContext: (directives: string, preset: string) => void;
  setRules: (rules: ForensicRule[]) => void;
  toggleRule: (ruleId: string) => void;
  addJob: (job: AuditJob) => void;
  updateJobStatus: (jobId: string, status: AuditJobStatus) => void;
  abortJob: (jobId: string) => boolean;
  clearJobs: () => void;
  setCallbacks: (callbacks: {
    onInfractionDetected?: (log: InfractionLog) => void;
    onJobStatusChange?: (jobId: string, status: AuditJobStatus) => void;
  }) => void;
  getQueueInfo: () => { pending: number; processing: boolean };
  waitForIdle: () => Promise<void>;
}

type ForensicsStore = ForensicsState & ForensicsActions;

const initialState: ForensicsState = {
  pendingCount: 0,
  isProcessing: false,
  jobs: [],
  activeRules: [...FORENSIC_RULES],
  directives: '',
  auditPreset: 'senior',
};

export const createForensicsDomain = () => {
  return create<ForensicsStore>((set, get) => ({
    ...initialState,

    updateContext: (directives, preset) => {
      logger.info('FORENSICS', `Context updated. Preset: ${preset}`);
      set({ directives, auditPreset: preset });
      forensicQueue.updateContext(directives, preset as any);
    },

    setRules: (rules) => set({ activeRules: rules }),

    toggleRule: (ruleId) =>
      set((s) => ({
        activeRules: s.activeRules.map((r) =>
          r.id === ruleId ? { ...r, enabled: !r.enabled } : r
        ),
      })),

    addJob: (job) =>
      set((s) => ({
        jobs: [job, ...s.jobs].slice(0, 100),
        pendingCount: s.pendingCount + 1,
      })),

    updateJobStatus: (jobId, status) => {
      const { onJobStatusChange } = get();
      set((s) => ({
        jobs: s.jobs.map((j) =>
          j.id === jobId ? { ...j, status, statusChangedAt: Date.now() } : j
        ),
        isProcessing: status === 'processing',
        pendingCount: status !== 'pending' ? Math.max(0, s.pendingCount - 1) : s.pendingCount,
      }));
      onJobStatusChange?.(jobId, status);
    },

    abortJob: (jobId) => {
      const result = forensicQueue.abort(jobId);
      if (result) {
        set((s) => ({
          jobs: s.jobs.filter((j) => j.id !== jobId),
          pendingCount: Math.max(0, s.pendingCount - 1),
        }));
      }
      return result;
    },

    clearJobs: () => {
      forensicQueue.clear();
      set({ jobs: [], pendingCount: 0, isProcessing: false });
    },

    setCallbacks: (callbacks) => {
      const { onInfractionDetected } = callbacks;
      set(callbacks as Partial<ForensicsState>);
      if (onInfractionDetected) {
        forensicQueue.setCallback(onInfractionDetected);
      }
    },

    getQueueInfo: () => {
      const count = forensicQueue.getPendingCount();
      return { pending: count, processing: count > 0 };
    },

    waitForIdle: () => forensicQueue.waitForIdle(),

    reset: () => set(initialState),
  }));
};

export const forensicsDomain = createForensicsDomain();
