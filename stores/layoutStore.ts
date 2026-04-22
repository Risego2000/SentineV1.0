import { create } from 'zustand';
import type { EvidenceFile } from '../services/evidenceStorageService';

export type GridSize = 1 | 2 | 3 | 4;
export type AppView = 'analysis' | 'database';

export interface LayoutState {
  // Number of active viewers (1 to 4)
  gridSize: GridSize;

  // Current active view
  currentView: AppView;

  // The viewer currently focused in the UI (for sidebars)
  focusedViewerId: string;

  // Array of active viewer IDs
  activeViewers: string[];

  // Sidebar states
  isSidebarCollapsed: boolean;
  isRightSidebarCollapsed: boolean;

  // Visibility toggles
  showDetections: boolean;
  showROIs: boolean;

  // Evidence tracking
  selectedInfractionId: string | null;
  evidenceFiles: Record<string, EvidenceFile[]>;

  // Actions
  setGridSize: (size: GridSize) => void;
  setView: (view: AppView) => void;
  setFocusedViewer: (id: string) => void;
  toggleSidebar: () => void;
  toggleRightSidebar: () => void;
  toggleDetections: () => void;
  toggleROIs: () => void;
  setShowDetections: (show: boolean) => void;
  setShowROIs: (show: boolean) => void;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  setSelectedInfraction: (id: string | null) => void;
  setEvidenceFiles: (infractionId: string, files: EvidenceFile[]) => void;
  clearEvidenceCache: (infractionId: string) => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  gridSize: 1,
  currentView: 'analysis',
  focusedViewerId: 'visor_0',
  activeViewers: ['visor_0'],
  isSidebarCollapsed: false,
  isRightSidebarCollapsed: false,
  showDetections: true,
  showROIs: true,
  selectedInfractionId: null,
  evidenceFiles: {},

  setGridSize: (size) =>
    set((state) => {
      const viewers = [];
      for (let i = 0; i < size; i++) {
        viewers.push(`visor_${i}`);
      }
      return {
        gridSize: size,
        activeViewers: viewers,
        focusedViewerId: viewers.includes(state.focusedViewerId)
          ? state.focusedViewerId
          : viewers[0],
      };
    }),

  setView: (view) => set({ currentView: view }),
  setFocusedViewer: (id) => set({ focusedViewerId: id }),
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  toggleRightSidebar: () =>
    set((state) => ({ isRightSidebarCollapsed: !state.isRightSidebarCollapsed })),
  toggleDetections: () => set((state) => ({ showDetections: !state.showDetections })),
  toggleROIs: () => set((state) => ({ showROIs: !state.showROIs })),
  setShowDetections: (show) => set({ showDetections: show }),
  setShowROIs: (show) => set({ showROIs: show }),
  setIsSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
  setSelectedInfraction: (id) => set({ selectedInfractionId: id }),
  setEvidenceFiles: (infractionId, files) =>
    set((state) => ({
      evidenceFiles: {
        ...state.evidenceFiles,
        [infractionId]: files,
      },
    })),
  clearEvidenceCache: (infractionId) =>
    set((state) => {
      const { [infractionId]: _, ...rest } = state.evidenceFiles;
      return { evidenceFiles: rest };
    }),
}));
