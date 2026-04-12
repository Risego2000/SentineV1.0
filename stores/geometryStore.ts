/**
 * Geometry Store - Geometric zones and forensic rules configuration
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { GeometryLine } from '../types';
import { ForensicRule, FORENSIC_RULES } from '../types/forensicRules';

interface GeometryState {
  // Current geometry lines/zones
  lines: GeometryLine[];

  // Active forensic rules
  activeRules: ForensicRule[];

  // Selected line for editing
  selectedLineId: string | null;

  // Drawing mode
  isDrawing: boolean;

  // Actions
  setLines: (lines: GeometryLine[]) => void;
  addLine: (line: GeometryLine) => void;
  updateLine: (id: string, updates: Partial<GeometryLine>) => void;
  removeLine: (id: string) => void;
  setSelectedLine: (id: string | null) => void;
  setDrawingMode: (enabled: boolean) => void;
  setActiveRules: (rules: ForensicRule[]) => void;
  toggleRule: (ruleId: string) => void;
  reset: () => void;
}

const initialState: GeometryState = {
  lines: [],
  activeRules: [...FORENSIC_RULES],
  selectedLineId: null,
  isDrawing: false,
};

export const useGeometryStore = create<GeometryState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    setLines: (lines) => set({ lines }),

    addLine: (line) => set((s) => ({ lines: [...s.lines, line] })),

    updateLine: (id, updates) =>
      set((s) => ({
        lines: s.lines.map((l) => (l.id === id ? { ...l, ...updates } : l)),
      })),

    removeLine: (id) =>
      set((s) => ({
        lines: s.lines.filter((l) => l.id !== id),
        selectedLineId: s.selectedLineId === id ? null : s.selectedLineId,
      })),

    setSelectedLine: (id) => set({ selectedLineId: id }),

    setDrawingMode: (enabled) => set({ isDrawing: enabled }),

    setActiveRules: (rules) => set({ activeRules: rules }),

    toggleRule: (ruleId) =>
      set((s) => ({
        activeRules: s.activeRules.map((r) =>
          r.id === ruleId ? { ...r, enabled: !r.enabled } : r
        ),
      })),

    reset: () => set(initialState),
  }))
);

// Selectors
export const selectLines = (s: GeometryState) => s.lines;
export const selectLineById = (s: GeometryState, id: string) => s.lines.find((l) => l.id === id);
export const selectLinesByType = (s: GeometryState, type: string) =>
  s.lines.filter((l) => l.type === type);
export const selectROI = (s: GeometryState) => s.lines.filter((l) => l.type.startsWith('roi_'));
export const selectActiveRules = (s: GeometryState) => s.activeRules.filter((r) => r.enabled);
