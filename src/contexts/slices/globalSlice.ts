import { StateCreator } from "zustand";
import { StoreSlice } from "./slice";

export interface GlobalState {
  // Global states
  projects: string[];
  activeProjectId: string | null;
  activeInterfaceId: string | null;
  activeTabId: string | null;
}

export interface GlobalActions {
  // Global actions
  setProjects: (projects: string[]) => void;
  resetState: (newState: Partial<StoreSlice>) => void;
  updateState: (updates: Partial<StoreSlice>) => void;
}

export type GlobalSlice = GlobalState & GlobalActions;

export const createGlobalSlice: StateCreator<
  StoreSlice,
  [["zustand/immer", never]],
  [],
  GlobalSlice
> = (set) => ({
  // Global state
  projects: [],
  activeProjectId: null,
  activeInterfaceId: null,
  activeTabId: null,

  // Global actions
  setProjects: (projects: string[]) => set(state => {
    state.projects = projects;
  }),

  // Global state reset action
  resetState: (newState) => set({ ...newState }),

  // Global state update action
  updateState: (updates) => set((state) => ({
    ...state,
    ...updates,
  })),
}); 