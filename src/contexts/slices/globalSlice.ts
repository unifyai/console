import { StateCreator } from "zustand";
import { StoreSlice } from "./slice";

export interface GlobalState {
  // Global states
  projects: string[];
  activeProjectId: string | null;
  activeInterfaceId: string | null;
  activeTabId: string | null;
  createProjectOpen: boolean;
  deleteProjectOpen: boolean;
}

export interface GlobalActions {
  // Global actions
  setProjects: (projects: string[]) => void;
  resetState: (newState: Partial<StoreSlice>) => void;
  updateState: (updates: Partial<StoreSlice>) => void;
  setCreateProjectOpen: (open: boolean) => void;
  setDeleteProjectOpen: (open: boolean) => void;
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
  createProjectOpen: false,
  deleteProjectOpen: false,

  // Global actions
  setProjects: (projects: string[]) => set(state => {
    state.projects = projects;
  }),

  setCreateProjectOpen: (open) => set(state => {
    state.createProjectOpen = open;
  }),

  setDeleteProjectOpen: (open) => set(state => {
    state.deleteProjectOpen = open;
  }),

  // Global state reset action
  resetState: (newState) => set({ ...newState }),

  // Global state update action
  updateState: (updates) => set((state) => ({
    ...state,
    ...updates,
  })),
}); 