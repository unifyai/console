import { StateCreator } from 'zustand';
import { StoreSlice } from './slice';

// Helper functions for localStorage persistence
const GLOBAL_EDIT_MODE_KEY = 'unify:globalEditMode';
const GLOBAL_DASHBOARD_MODE_KEY = 'unify:globalDashboardMode';

const loadGlobalEditMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const saved = localStorage.getItem(GLOBAL_EDIT_MODE_KEY);
    return saved === 'true';
  } catch {
    return false;
  }
};

const loadGlobalDashboardMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const saved = localStorage.getItem(GLOBAL_DASHBOARD_MODE_KEY);
    return saved === 'true';
  } catch {
    return false;
  }
};

const saveGlobalEditMode = (editMode: boolean): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(GLOBAL_EDIT_MODE_KEY, String(editMode));
  } catch {
    // Ignore errors
  }
};

const saveGlobalDashboardMode = (dashboardMode: boolean): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(GLOBAL_DASHBOARD_MODE_KEY, String(dashboardMode));
  } catch {
    // Ignore errors
  }
};

export interface GlobalState {
  // Global states
  projects: string[];
  activeProjectId: string | null;
  activeInterfaceId: string | null;
  activeTabId: string | null;
  selectProjectsOpen: boolean;
  createProjectOpen: boolean;
  deleteProjectOpen: boolean;
  fileUploadOpen: boolean;
  focusPaneOpen: boolean;
  globalContextOpen: boolean;
  saveInterfaceOpen: boolean;
  // Global UI mode settings
  globalEditMode: boolean;
  globalDashboardMode: boolean;
}

export interface GlobalActions {
  // Global actions
  setProjects: (projects: string[]) => void;
  resetState: (newState: Partial<StoreSlice>) => void;
  updateState: (updates: Partial<StoreSlice>) => void;
  setSelectProjectsOpen: (open: boolean) => void;
  setCreateProjectOpen: (open: boolean) => void;
  setDeleteProjectOpen: (open: boolean) => void;
  setFileUploadOpen: (open: boolean) => void;
  setFocusPaneOpen: (open: boolean) => void;
  setGlobalContextOpen: (open: boolean) => void;
  setSaveInterfaceOpen: (open: boolean) => void;
  // Global UI mode actions
  setGlobalEditMode: (editMode: boolean) => void;
  setGlobalDashboardMode: (dashboardMode: boolean) => void;
}

export type GlobalSlice = GlobalState & GlobalActions;

export const createGlobalSlice: StateCreator<
  StoreSlice,
  [['zustand/immer', never]],
  [],
  GlobalSlice
> = (set) => ({
  // Global state
  projects: [],
  activeProjectId: null,
  activeInterfaceId: null,
  activeTabId: null,
  selectProjectsOpen: false,
  createProjectOpen: false,
  deleteProjectOpen: false,
  fileUploadOpen: false,
  focusPaneOpen: false,
  globalContextOpen: false,
  saveInterfaceOpen: false,
  // Initialize global UI mode settings from localStorage
  globalEditMode: loadGlobalEditMode(),
  globalDashboardMode: loadGlobalDashboardMode(),

  // Global actions
  setProjects: (projects: string[]) =>
    set((state) => {
      state.projects = projects;
    }),

  // Global state reset action
  resetState: (newState) => set({ ...newState }),

  // Global state update action
  updateState: (updates) =>
    set((state) => ({
      ...state,
      ...updates,
    })),

  setSelectProjectsOpen: (open) =>
    set((state) => {
      state.selectProjectsOpen = open;
    }),

  setCreateProjectOpen: (open) =>
    set((state) => {
      state.createProjectOpen = open;
    }),

  setDeleteProjectOpen: (open) =>
    set((state) => {
      state.deleteProjectOpen = open;
    }),

  setFileUploadOpen: (open) =>
    set((state) => {
      state.fileUploadOpen = open;
    }),

  setFocusPaneOpen: (open) =>
    set((state) => {
      state.focusPaneOpen = open;
    }),

  setGlobalContextOpen: (open) =>
    set((state) => {
      state.globalContextOpen = open;
    }),

  setSaveInterfaceOpen: (open) =>
    set((state) => {
      state.saveInterfaceOpen = open;
    }),

  setGlobalEditMode: (editMode) =>
    set((state) => {
      state.globalEditMode = editMode;
      saveGlobalEditMode(editMode);
    }),

  setGlobalDashboardMode: (dashboardMode) =>
    set((state) => {
      state.globalDashboardMode = dashboardMode;
      saveGlobalDashboardMode(dashboardMode);
    }),
});
