import { create } from 'zustand';

export type GridSize = 1 | 2 | 3 | 4;

export interface LayoutState {
  // Number of active viewers (1 to 4)
  gridSize: GridSize;

  // The viewer currently focused in the UI (for sidebars)
  focusedViewerId: string;

  // Array of active viewer IDs
  activeViewers: string[];

  // Global help message
  helpMsg: string | null;

  // Sidebar visibility (especially for mobile)
  isSidebarOpen: boolean;
  isRightSidebarOpen: boolean;

  // Actions
  setGridSize: (size: GridSize) => void;
  setFocusedViewer: (id: string) => void;
  setHelpMsg: (msg: string | null) => void;
  toggleSidebar: () => void;
  toggleRightSidebar: () => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  gridSize: 1,
  focusedViewerId: 'visor_0',
  activeViewers: ['visor_0'],
  helpMsg: 'Bienvenido a Sentinel AI. Pase el ratón sobre los elementos para obtener ayuda.',
  isSidebarOpen: false,
  isRightSidebarOpen: false,

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

  setFocusedViewer: (id) => set({ focusedViewerId: id }),
  setHelpMsg: (msg) => set({ helpMsg: msg }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  toggleRightSidebar: () => set((state) => ({ isRightSidebarOpen: !state.isRightSidebarOpen })),
}));
