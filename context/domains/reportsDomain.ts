/**
 * ReportsDomain - Manages report generation and export
 * Separated from video source and forensics logic.
 */

import { create } from 'zustand';
import { InfractionLog } from '../types';
import { ReportService } from '../services/ReportService';
import { logger } from '../services/logger';

interface ReportState {
  // Report generation
  isGenerating: boolean;
  currentReportId: string | null;
  lastGeneratedPath: string | null;

  // Export status
  isExporting: boolean;
  exportProgress: number;

  // History
  reportHistory: Array<{
    id: string;
    path: string;
    generatedAt: number;
    infractions: number;
  }>;

  // Callbacks
  onReportGenerated?: (path: string, filename: string) => void;
  onError?: (error: string) => void;
}

interface ReportActions {
  generateInfractionPdf: (log: InfractionLog) => Promise<{ path: string; filename: string }>;
  generateBatchPdf: (logs: InfractionLog[]) => Promise<{ path: string; filename: string }>;
  exportCsv: (logs: InfractionLog[], filename?: string) => Promise<string>;
  saveVideoEvidence: (videoBuffer: ArrayBuffer, filename: string) => Promise<string>;
  setCallbacks: (callbacks: {
    onReportGenerated?: (path: string, filename: string) => void;
    onError?: (error: string) => void;
  }) => void;
  setGenerating: (generating: boolean) => void;
  setExportProgress: (progress: number) => void;
  addToHistory: (report: ReportState['reportHistory'][0]) => void;
}

type ReportsStore = ReportState & ReportActions;

const initialState: ReportState = {
  isGenerating: false,
  currentReportId: null,
  lastGeneratedPath: null,
  isExporting: false,
  exportProgress: 0,
  reportHistory: [],
};

export const createReportsDomain = () => {
  return create<ReportsStore>((set, get) => ({
    ...initialState,

    generateInfractionPdf: async (log) => {
      set({ isGenerating: true, currentReportId: log.id.toString() });
      try {
        const result = await ReportService.generateAndSaveInfractionPdf(log);
        set({
          isGenerating: false,
          currentReportId: null,
          lastGeneratedPath: result.path,
        });
        get().addToHistory({
          id: result.filename,
          path: result.path,
          generatedAt: Date.now(),
          infractions: 1,
        });
        get().onReportGenerated?.(result.path, result.filename);
        return result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        set({ isGenerating: false, currentReportId: null });
        get().onError?.(msg);
        logger.error('REPORTS', `Failed to generate PDF: ${msg}`, error);
        throw error;
      }
    },

    generateBatchPdf: async (logs) => {
      if (logs.length === 0) {
        throw new Error('No infractions to report');
      }
      set({ isGenerating: true, currentReportId: 'batch' });
      try {
        const result = await ReportService.generateAndSaveBatchPdf(logs);
        set({
          isGenerating: false,
          currentReportId: null,
          lastGeneratedPath: result.path,
        });
        get().addToHistory({
          id: result.filename,
          path: result.path,
          generatedAt: Date.now(),
          infractions: logs.length,
        });
        get().onReportGenerated?.(result.path, result.filename);
        return result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        set({ isGenerating: false, currentReportId: null });
        get().onError?.(msg);
        logger.error('REPORTS', `Failed to generate batch PDF: ${msg}`, error);
        throw error;
      }
    },

    exportCsv: async (logs, filename) => {
      set({ isExporting: true, exportProgress: 0 });
      try {
        const csvFilename = filename || `Sentinel_Report_${Date.now()}.csv`;
        await ReportService.exportToCsv(logs, csvFilename);
        set({ isExporting: false, exportProgress: 100 });
        return csvFilename;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        set({ isExporting: false, exportProgress: 0 });
        get().onError?.(msg);
        throw error;
      }
    },

    saveVideoEvidence: async (videoBuffer, filename, dateStr?: string) => {
      try {
        await ReportService.saveVideoToDisk(videoBuffer, filename, dateStr);
        logger.success('REPORTS', `Video evidence saved: ${filename}`);
        return filename;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        get().onError?.(msg);
        throw error;
      }
    },

    setCallbacks: (callbacks) => {
      set(callbacks as Partial<ReportState>);
    },

    setGenerating: (generating) => set({ isGenerating: generating }),

    setExportProgress: (progress) => set({ exportProgress: progress }),

    addToHistory: (report) =>
      set((s) => ({
        reportHistory: [report, ...s.reportHistory].slice(0, 50),
      })),

    reset: () => set(initialState),
  }));
};

export const reportsDomain = createReportsDomain();
