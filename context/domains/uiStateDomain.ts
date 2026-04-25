/**
 * UI State Domain - Manages UI-specific state
 * Separated from video source, forensics, and reports logic.
 */

import { create } from 'zustand';
import { SystemStatus, SystemLog } from '../../types';

interface UIState {
  // Sidebar state
  isSidebarExpanded: boolean;

  // Modal states
  selectedLogId: number | null;
  showIpCameraModal: boolean;
  showHelpModal: boolean;

  // Help message
  helpMessage: string | null;

  // System status
  systemStatus: SystemStatus;

  // System logs
  systemLogs: SystemLog[];
  maxSystemLogs: number;

  // Loading states
  isAnalyzing: boolean;

  // Callbacks
  onLogAdd?: (type: string, content: string) => void;
  onHelpRequest?: (elementId: string) => void;
}

interface UIActions {
  toggleSidebar: () => void;
  setSidebarExpanded: (expanded: boolean) => void;
  openLogDetail: (logId: number) => void;
  closeLogDetail: () => void;
  setIpCameraModalOpen: (open: boolean) => void;
  setHelpModalOpen: (open: boolean) => void;
  setHelpMessage: (msg: string | null) => void;
  setSystemStatus: (status: Partial<SystemStatus>) => void;
  addSystemLog: (type: SystemLog['type'], content: string) => void;
  clearSystemLogs: () => void;
  setAnalyzing: (analyzing: boolean) => void;
  setCallbacks: (callbacks: {
    onLogAdd?: (type: string, content: string) => void;
    onHelpRequest?: (elementId: string) => void;
  }) => void;
}

type UIStore = UIState & UIActions;

const initialState: UIState = {
  isSidebarExpanded: true,
  selectedLogId: null,
  showIpCameraModal: false,
  showHelpModal: false,
  helpMessage: 'Bienvenido a Sentinel AI. Pase el ratón sobre los elementos para obtener ayuda.',
  systemStatus: {
    neural: 'loading',
    forensic: 'pending',
    bionics: 'pending',
    vector: 'pending',
    mediapipeReady: false,
  },
  systemLogs: [],
  maxSystemLogs: 200,
  isAnalyzing: false,
};

let logIdCounter = 0;

export const createUIStateDomain = () => {
  return create<UIStore>((set, get) => ({
    ...initialState,

    toggleSidebar: () => set((s) => ({ isSidebarExpanded: !s.isSidebarExpanded })),

    setSidebarExpanded: (expanded) => set({ isSidebarExpanded: expanded }),

    openLogDetail: (logId) => set({ selectedLogId: logId }),

    closeLogDetail: () => set({ selectedLogId: null }),

    setIpCameraModalOpen: (open) => set({ showIpCameraModal: open }),

    setHelpModalOpen: (open) => set({ showHelpModal: open }),

    setHelpMessage: (msg) => set({ helpMessage: msg }),

    setSystemStatus: (status) =>
      set((s) => ({
        systemStatus: { ...s.systemStatus, ...status },
      })),

    addSystemLog: (type, content) => {
      const log: SystemLog = {
        id: `log_${++logIdCounter}`,
        timestamp: new Date().toISOString(),
        type,
        content,
      };
      set((s) => ({
        systemLogs: [log, ...s.systemLogs].slice(0, s.maxSystemLogs),
      }));
      get().onLogAdd?.(type, content);
    },

    clearSystemLogs: () => set({ systemLogs: [] }),

    setAnalyzing: (analyzing) => set({ isAnalyzing: analyzing }),

    setCallbacks: (callbacks) => {
      set(callbacks as Partial<UIState>);
    },

    reset: () => set({ ...initialState, systemLogs: [] }),
  }));
};

export const uiStateDomain = createUIStateDomain();
