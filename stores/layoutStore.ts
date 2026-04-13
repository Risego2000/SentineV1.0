import { create } from 'zustand';

export type GridSize = 1 | 2 | 3 | 4;

export interface LayoutState {
  // Number of active viewers (1 to 4)
  gridSize: GridSize;

  // The viewer currently focused in the UI (for sidebars)
  focusedViewerId: string;

  // Array of active viewer IDs
  activeViewers: string[];

  // Actions
  setGridSize: (size: GridSize) => void;
  setFocusedViewer: (id: string) => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  gridSize: 1,
  focusedViewerId: 'visor_0',
  activeViewers: ['visor_0'],

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
}));
