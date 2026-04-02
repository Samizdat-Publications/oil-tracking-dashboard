import { create } from 'zustand';
import type { GeoEvent, SimulationRequest } from '../types';
import { DEFAULT_EVENTS } from '../lib/constants';
import { subMonths, subYears, format } from 'date-fns';

export type DateRangePreset = '1M' | '3M' | '6M' | '1Y' | '2Y' | '5Y' | 'ALL';

function getStartDate(preset: DateRangePreset): string | undefined {
  const now = new Date();
  switch (preset) {
    case '1M': return format(subMonths(now, 1), 'yyyy-MM-dd');
    case '3M': return format(subMonths(now, 3), 'yyyy-MM-dd');
    case '6M': return format(subMonths(now, 6), 'yyyy-MM-dd');
    case '1Y': return format(subYears(now, 1), 'yyyy-MM-dd');
    case '2Y': return format(subYears(now, 2), 'yyyy-MM-dd');
    case '5Y': return format(subYears(now, 5), 'yyyy-MM-dd');
    case 'ALL': return '1986-01-01';
  }
}

interface DashboardState {
  selectedSeries: 'wti' | 'brent';
  setSelectedSeries: (s: 'wti' | 'brent') => void;

  dateRangePreset: DateRangePreset;
  dateRangeStart: string | undefined;
  setDateRange: (preset: DateRangePreset) => void;

  simulationParams: SimulationRequest;
  setSimulationParams: (p: Partial<SimulationRequest>) => void;

  events: GeoEvent[];
  toggleEvent: (id: string) => void;
  addEvent: (e: GeoEvent) => void;
  removeEvent: (id: string) => void;

  showSMA: { sma20: boolean; sma50: boolean; sma200: boolean };
  toggleSMA: (key: 'sma20' | 'sma50' | 'sma200') => void;

  simulationControlsOpen: boolean;
  toggleSimulationControls: () => void;

  dataTableExpanded: boolean;
  toggleDataTable: () => void;

  showEras: boolean;
  toggleEras: () => void;

  supplyChainPanelOpen: boolean;
  selectedCommodityKey: string | null;
  openCommodityPanel: (key: string) => void;
  closeCommodityPanel: () => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  selectedSeries: 'wti',
  setSelectedSeries: (s) => set({ selectedSeries: s }),

  dateRangePreset: 'ALL',
  dateRangeStart: getStartDate('ALL'),
  setDateRange: (preset) => set({ dateRangePreset: preset, dateRangeStart: getStartDate(preset) }),

  simulationParams: {
    series: 'wti',
    lookback_years: 2,
    n_paths: 5000,
    horizon_days: 126,
    model: 'jump_diffusion',
  },
  setSimulationParams: (p) =>
    set((state) => ({
      simulationParams: { ...state.simulationParams, ...p },
    })),

  events: DEFAULT_EVENTS,
  toggleEvent: (id) =>
    set((state) => ({
      events: state.events.map((e) => (e.id === id ? { ...e, visible: !e.visible } : e)),
    })),
  addEvent: (e) => set((state) => ({ events: [...state.events, e] })),
  removeEvent: (id) => set((state) => ({ events: state.events.filter((e) => e.id !== id) })),

  showSMA: { sma20: false, sma50: false, sma200: false },
  toggleSMA: (key) =>
    set((state) => ({
      showSMA: { ...state.showSMA, [key]: !state.showSMA[key] },
    })),

  simulationControlsOpen: false,
  toggleSimulationControls: () =>
    set((state) => ({ simulationControlsOpen: !state.simulationControlsOpen })),

  dataTableExpanded: false,
  toggleDataTable: () =>
    set((state) => ({ dataTableExpanded: !state.dataTableExpanded })),

  showEras: false,
  toggleEras: () => set((state) => ({ showEras: !state.showEras })),

  supplyChainPanelOpen: false,
  selectedCommodityKey: null,
  openCommodityPanel: (key) => set({ supplyChainPanelOpen: true, selectedCommodityKey: key }),
  closeCommodityPanel: () => set({ supplyChainPanelOpen: false, selectedCommodityKey: null }),
}));
