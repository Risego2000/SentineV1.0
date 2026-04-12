/**
 * Forensics Store - Audit jobs and queue management
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { AuditJob, AuditJobStatus } from '../types';

interface ForensicsState {
  // Active audit jobs
  jobs: AuditJob[];

  // Current processing job ID
  processingJobId: string | null;

  // Queue statistics
  totalProcessed: number;
  totalInfractions: number;
  totalCleared: number;
  totalFailed: number;

  // Buffer status for evidence capture
  bufferStatus: {
    state: 'idle' | 'recording' | 'capturing' | 'processing';
    seconds: number;
    activeTracks: number;
  };

  // Actions
  addJob: (job: AuditJob) => void;
  updateJobStatus: (jobId: string, status: AuditJobStatus) => void;
  setProcessingJob: (jobId: string | null) => void;
  removeJob: (jobId: string) => void;
  clearJobs: () => void;
  setBufferStatus: (status: Partial<ForensicsState['bufferStatus']>) => void;
  incrementStats: (infraction: boolean) => void;
}

export const useForensicsStore = create<ForensicsState>()(
  subscribeWithSelector((set, get) => ({
    jobs: [],
    processingJobId: null,
    totalProcessed: 0,
    totalInfractions: 0,
    totalCleared: 0,
    totalFailed: 0,
    bufferStatus: {
      state: 'idle',
      seconds: 0,
      activeTracks: 0,
    },

    addJob: (job) =>
      set((s) => ({
        jobs: [job, ...s.jobs].slice(0, 100), // Keep last 100
      })),

    updateJobStatus: (jobId, status) =>
      set((s) => ({
        jobs: s.jobs.map((j) =>
          j.id === jobId ? { ...j, status, statusChangedAt: Date.now() } : j
        ),
      })),

    setProcessingJob: (jobId) => set({ processingJobId: jobId }),

    removeJob: (jobId) =>
      set((s) => ({
        jobs: s.jobs.filter((j) => j.id !== jobId),
      })),

    clearJobs: () =>
      set({
        jobs: [],
        processingJobId: null,
        totalProcessed: 0,
        totalInfractions: 0,
        totalCleared: 0,
        totalFailed: 0,
      }),

    setBufferStatus: (status) =>
      set((s) => ({
        bufferStatus: { ...s.bufferStatus, ...status },
      })),

    incrementStats: (infraction) =>
      set((s) => ({
        totalProcessed: s.totalProcessed + 1,
        totalInfractions: infraction ? s.totalInfractions + 1 : s.totalInfractions,
        totalCleared: !infraction ? s.totalCleared + 1 : s.totalCleared,
      })),
  }))
);

// Selectors
export const selectJobs = (s: ForensicsState) => s.jobs;
export const selectPendingJobs = (s: ForensicsState) =>
  s.jobs.filter((j) => j.status === 'pending');
export const selectCompletedJobs = (s: ForensicsState) =>
  s.jobs.filter((j) => j.status === 'completed');
export const selectProcessingJob = (s: ForensicsState) =>
  s.jobs.find((j) => j.id === s.processingJobId);
export const selectBufferState = (s: ForensicsState) => s.bufferStatus;
