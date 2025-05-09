import { StateCreator } from "zustand";
import { StoreSlice } from "./slice";
import * as tabLogic from "./selectors/tab";
import * as interfaceLogic from "./selectors/interface";
import * as sliceUtils from "../utils/sliceUtils";

export interface TabState {
  // State
  tabsById: Record<string, tabLogic.Tab>;
}

export interface TabActions {
  // Actions
  initTab: (interfaceId: string, tabId: string, initialState?: Partial<tabLogic.Tab>) => void;
  addTab: (interfaceId: string, newTabId: string, newTabName: string, initialState?: Partial<tabLogic.Tab>) => void;
  removeTab: (interfaceId: string, tabId: string) => void;
  renameTab: (interfaceId: string, sourceTabId: string, newTabName: string) => void;
  updateTab: (tabId: string, updates: Partial<tabLogic.Tab>) => void;
  setActiveTab: (interfaceId: string, tabId: string | null) => void;
  removeContextFromTab: (tabId: string, context: string) => void;
  setFocusDialog: (tabId: string, focusDialog: boolean) => void;
  setEditTile: (tabId: string, editTile: string | undefined) => void;
}

export type TabSlice = TabState & TabActions;

export const createTabSlice: StateCreator<
  StoreSlice,
  [["zustand/immer", never]],
  [],
  TabSlice
> = (set) => ({
  // State
  tabsById: {},
  
  // Actions
  initTab: (interfaceId, tabId, initialState) => set(state => {
    const interfaceObj = state.interfacesById[interfaceId];
    if (!interfaceObj) return;
    
    // Only initialize if it doesn't exist
    if (!state.tabsById[tabId]) {
      const newTab = tabLogic.initTab(tabId, initialState);
      state.tabsById[tabId] = newTab;
    }
    
    // Update the interface's tabIds array using the proper function
    state.interfacesById[interfaceId] = interfaceLogic.addTabId(interfaceObj, tabId);
  }),

  addTab: (interfaceId, newTabId, newTabName, initialState) => set(state => {
    sliceUtils.addTab(state, interfaceId, newTabId, newTabName, initialState);
  }),
  
  removeTab: (interfaceId, tabId) => set(state => {
    sliceUtils.removeTab(state, interfaceId, tabId);
  }),

  renameTab: (interfaceId, sourceTabId, newTabName) => set(state => {
    sliceUtils.renameTab(state, interfaceId, sourceTabId, newTabName);
  }),
  
  updateTab: (tabId, updates) => set(state => {
    const tab = state.tabsById[tabId];
    if (tab) {
      // Filter out unchanged fields with the extended partially shallow logic
      const filteredUpdates = sliceUtils.filterUnchangedUpdates(tab, updates);
      if (Object.keys(filteredUpdates).length === 0) return;
      state.tabsById[tabId] = tabLogic.updateTab(tab, filteredUpdates);
    }
  }),
  
  setActiveTab: (interfaceId, tabId) => set(state => {
    // Set active tab in the global state
    state.activeTabId = tabId;

    // Update the active tab in the interface
    if (state.interfacesById[interfaceId]) {
      const iface = state.interfacesById[interfaceId];
      
      // Deactivate the currently active tab if any
      if (iface.activeTabId && iface.tabIds[iface.activeTabId as unknown as number]) {
        state.tabsById[iface.activeTabId].active = false;
      }
      
      // Set the new active tab
      state.interfacesById[interfaceId].activeTabId = tabId;
      
      // Mark the new tab as active if it exists
      if (tabId && iface.tabIds[tabId as unknown as number]) {
        state.tabsById[tabId].active = true;
      }
    }
  }),

  removeContextFromTab: (tabId, context) => set(state => {
    sliceUtils.removeContextFromTab(state, tabId, context);
  }),

  setFocusDialog: (tabId, focusDialog) => set(state => {
    state.tabsById[tabId].focusDialog = focusDialog;
  }),

  setEditTile: (tabId, editTile) => set(state => {
    state.tabsById[tabId].editTile = editTile;
  }),
  
}); 