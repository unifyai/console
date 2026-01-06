/**
 * Checkpoint Test Harness
 *
 * Tests checkpoint/save/reset behaviors (J1-J3):
 * - J1: Save checkpoint (creates a snapshot of current state)
 * - J2: Restore checkpoint (reverts to last saved state)
 * - J3: Auto-save (optimistic updates to server)
 *
 * This harness uses the REAL mutation hooks:
 * - useSaveTabWithTilesQuery for saving checkpoints
 * - useRestoreLastSavedTabWithTilesQuery for restoring from checkpoints
 *
 * API actions are mocked to simulate server responses without network calls.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback, act } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useStore } from 'zustand';

// Shared test utilities
import { TestProviders } from '../utils';

// Real Store Imports
import { useStoreApiContext } from '@/contexts/providers/StoreProvider';
import { StoreState } from '@/contexts/slices/slice';
import { useSaveTabWithTilesQuery } from '@/hooks/Interfaces/Query/useSaveTabWithTilesQuery';
import { useRestoreLastSavedTabWithTilesQuery } from '@/hooks/Interfaces/Query/useRestoreLastSavedTabWithTilesQuery';
import { GranularInterfaceActions, GranularTabActions, GranularTileActions } from '@/types/interfaces/grid';

// ============================================================================
// Types
// ============================================================================

interface TilePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TileState {
  id: string;
  name: string;
  position: TilePosition;
  type: string;
  context?: string;
}

interface TabState {
  id: string;
  name: string;
  tiles: TileState[];
  context?: string;
}

interface CheckpointData {
  timestamp: number;
  description: string;
  tabState: TabState;
}

interface CheckpointTestOptions {
  projectId?: string;
  interfaceId?: string;
  initialTab?: TabState;
  initialCheckpoint?: CheckpointData | null;
}

// ============================================================================
// Mock Actions Factory
// ============================================================================

/**
 * Creates mock granular actions that simulate API behavior.
 * These track checkpointed state in memory and return appropriate responses.
 */
function createMockActions(
  options: CheckpointTestOptions,
  checkpointStore: React.MutableRefObject<{
    interface: any;
    tab: any;
    tiles: any[];
  } | null>,
  getCurrentState: () => { tab: TabState; tiles: TileState[] }
): {
  interfaceActions: GranularInterfaceActions;
  tabActions: GranularTabActions;
  tileActions: GranularTileActions;
} {
  const projectId = options.projectId || 'test-project';
  const interfaceId = options.interfaceId || 'test-interface';
  const tabId = options.initialTab?.id || 'tab-1';

  const interfaceActions: GranularInterfaceActions = {
    list: async () => [{ id: interfaceId, name: 'Test Interface', project_id: projectId }] as any,
    getById: async (id: string) => ({
      id,
      name: 'Test Interface',
      project_id: projectId,
      active_tab_id: tabId,
    }) as any,
    getByName: async (projId: string, name: string) => ({
      id: interfaceId,
      name,
      project_id: projId,
      active_tab_id: tabId,
    }) as any,
    get: async (params: any) => ({
      id: params.interface_id || interfaceId,
      name: 'Test Interface',
      project_id: params.projectId || projectId,
      active_tab_id: tabId,
    }) as any,
    getCheckpointById: async (id: string) => {
      if (checkpointStore.current?.interface) {
        return checkpointStore.current.interface;
      }
      return { id, name: 'Test Interface', project_id: projectId, active_tab_id: tabId } as any;
    },
    getCheckpointByName: async (projId: string, name: string) => {
      if (checkpointStore.current?.interface) {
        return checkpointStore.current.interface;
      }
      return { id: interfaceId, name, project_id: projId, active_tab_id: tabId } as any;
    },
    getCheckpoint: async (params: any) => {
      if (checkpointStore.current?.interface) {
        return checkpointStore.current.interface;
      }
      return { id: params.interface_id || interfaceId, name: 'Test Interface', project_id: projectId, active_tab_id: tabId } as any;
    },
    create: async () => ({ id: interfaceId, name: 'Test Interface', project_id: projectId }) as any,
    updateById: async (id: string, data: any) => ({ id, ...data }) as any,
    updateByName: async (projId: string, name: string, data: any) => ({ id: interfaceId, name, project_id: projId, ...data }) as any,
    update: async (params: any) => ({ id: params.interface_id || interfaceId, ...params.data }) as any,
    deleteById: async () => ({ success: true }) as any,
    deleteByName: async () => ({ success: true }) as any,
    delete: async () => ({ success: true }) as any,
    checkpointById: async (id: string, description?: string) => {
      checkpointStore.current = {
        interface: { id, name: 'Test Interface', project_id: projectId, active_tab_id: tabId },
        tab: checkpointStore.current?.tab || null,
        tiles: checkpointStore.current?.tiles || [],
      };
      return { info: 'Checkpoint created', detail: description } as any;
    },
    checkpointByName: async (projId: string, name: string, description?: string) => {
      checkpointStore.current = {
        interface: { id: interfaceId, name, project_id: projId, active_tab_id: tabId },
        tab: checkpointStore.current?.tab || null,
        tiles: checkpointStore.current?.tiles || [],
      };
      return { info: 'Checkpoint created', detail: description } as any;
    },
    checkpoint: async (params: any) => {
      checkpointStore.current = {
        interface: { id: params.interface_id || interfaceId, name: 'Test Interface', project_id: projectId, active_tab_id: tabId },
        tab: checkpointStore.current?.tab || null,
        tiles: checkpointStore.current?.tiles || [],
      };
      return { info: 'Checkpoint created', detail: params.description } as any;
    },
    exportTemplate: async () => ({ template: {}, metadata: {} }) as any,
    importTemplate: async () => ({ success: true }) as any,
  };

  const tabActions: GranularTabActions = {
    list: async () => [{ id: tabId, name: options.initialTab?.name || 'Main Tab', interface_id: interfaceId }] as any,
    getById: async (id: string) => ({
      id,
      name: options.initialTab?.name || 'Main Tab',
      interface_id: interfaceId,
      context: options.initialTab?.context,
    }) as any,
    getByName: async (intId: string, name: string) => ({
      id: tabId,
      name,
      interface_id: intId,
      context: options.initialTab?.context,
    }) as any,
    get: async (params: any) => ({
      id: params.id || tabId,
      name: options.initialTab?.name || 'Main Tab',
      interface_id: params.interface_id || interfaceId,
      context: options.initialTab?.context,
    }) as any,
    getTabWithTilesById: async (id: string) => ({
      id,
      name: options.initialTab?.name || 'Main Tab',
      interface_id: interfaceId,
      tiles: getCurrentState().tiles,
    }) as any,
    getTabWithTilesByName: async (intId: string, name: string) => ({
      id: tabId,
      name,
      interface_id: intId,
      tiles: getCurrentState().tiles,
    }) as any,
    getTabWithTiles: async (params: any) => ({
      id: params.id || tabId,
      name: options.initialTab?.name || 'Main Tab',
      interface_id: params.interface_id || interfaceId,
      tiles: getCurrentState().tiles,
    }) as any,
    getCheckpointById: async (id: string) => {
      if (checkpointStore.current?.tab) {
        return checkpointStore.current.tab;
      }
      return { id, name: options.initialTab?.name || 'Main Tab', interface_id: interfaceId } as any;
    },
    getCheckpointByName: async (intId: string, name: string) => {
      if (checkpointStore.current?.tab) {
        return checkpointStore.current.tab;
      }
      return { id: tabId, name, interface_id: intId } as any;
    },
    getCheckpoint: async (params: any) => {
      if (checkpointStore.current?.tab) {
        return checkpointStore.current.tab;
      }
      return { id: params.id || tabId, name: options.initialTab?.name || 'Main Tab', interface_id: interfaceId } as any;
    },
    create: async () => ({ id: tabId, name: 'New Tab', interface_id: interfaceId }) as any,
    updateById: async (id: string, data: any) => ({ id, ...data }) as any,
    updateByName: async (intId: string, name: string, data: any) => ({ id: tabId, name, interface_id: intId, ...data }) as any,
    update: async (params: any) => ({ id: params.id || tabId, ...params.data }) as any,
    deleteById: async () => ({ success: true }) as any,
    deleteByName: async () => ({ success: true }) as any,
    delete: async () => ({ success: true }) as any,
    checkpointById: async (id: string, description?: string) => {
      const state = getCurrentState();
      checkpointStore.current = {
        interface: checkpointStore.current?.interface || null,
        tab: { id, name: state.tab.name, interface_id: interfaceId, context: state.tab.context },
        tiles: checkpointStore.current?.tiles || [],
      };
      return { info: 'Checkpoint created', detail: description } as any;
    },
    checkpointByName: async (intId: string, name: string, description?: string) => {
      const state = getCurrentState();
      checkpointStore.current = {
        interface: checkpointStore.current?.interface || null,
        tab: { id: tabId, name, interface_id: intId, context: state.tab.context },
        tiles: checkpointStore.current?.tiles || [],
      };
      return { info: 'Checkpoint created', detail: description } as any;
    },
    checkpoint: async (params: any) => {
      const state = getCurrentState();
      checkpointStore.current = {
        interface: checkpointStore.current?.interface || null,
        tab: { id: params.id || tabId, name: state.tab.name, interface_id: interfaceId, context: state.tab.context },
        tiles: checkpointStore.current?.tiles || [],
      };
      return { info: 'Checkpoint created', detail: params.description } as any;
    },
    exportTemplate: async () => ({ template: {}, metadata: {} }) as any,
    importTemplate: async () => ({ success: true }) as any,
  };

  const tileActions: GranularTileActions = {
    list: async (tId: string, type?: string, checkpoint?: boolean) => {
      if (checkpoint && checkpointStore.current?.tiles) {
        return checkpointStore.current.tiles.map(tile => ({
          id: tile.id,
          name: tile.name,
          tab_id: tabId,
          position: tile.position,
          type: tile.type,
          visible: true,
        })) as any;
      }
      const state = getCurrentState();
      return state.tiles.map(tile => ({
        id: tile.id,
        name: tile.name,
        tab_id: tabId,
        position: tile.position,
        type: tile.type,
        visible: true,
      })) as any;
    },
    getById: async (id: string) => {
      const state = getCurrentState();
      const tile = state.tiles.find(t => t.id === id);
      return tile ? { ...tile, tab_id: tabId, visible: true } as any : null;
    },
    getByName: async (tId: string, name: string) => {
      const state = getCurrentState();
      const tile = state.tiles.find(t => t.name === name);
      return tile ? { ...tile, tab_id: tabId, visible: true } as any : null;
    },
    get: async (params: any) => {
      const state = getCurrentState();
      const tile = params.id 
        ? state.tiles.find(t => t.id === params.id)
        : state.tiles.find(t => t.name === params.name);
      return tile ? { ...tile, tab_id: tabId, visible: true } as any : null;
    },
    getCheckpointById: async (id: string) => {
      if (checkpointStore.current?.tiles) {
        const tile = checkpointStore.current.tiles.find((t: any) => t.id === id);
        return tile ? { ...tile, tab_id: tabId, visible: true } as any : null;
      }
      return null;
    },
    getCheckpointByName: async (tId: string, name: string) => {
      if (checkpointStore.current?.tiles) {
        const tile = checkpointStore.current.tiles.find((t: any) => t.name === name);
        return tile ? { ...tile, tab_id: tabId, visible: true } as any : null;
      }
      return null;
    },
    getCheckpoint: async (params: any) => {
      if (checkpointStore.current?.tiles) {
        const tile = params.id 
          ? checkpointStore.current.tiles.find((t: any) => t.id === params.id)
          : checkpointStore.current.tiles.find((t: any) => t.name === params.name);
        return tile ? { ...tile, tab_id: tabId, visible: true } as any : null;
      }
      return null;
    },
    create: async (tId: string, name: string, position: any, extra?: any, tile_id?: string, type?: string) => ({
      id: tile_id || `tile-${Date.now()}`,
      name,
      tab_id: tId,
      position,
      type: type || 'Table',
      visible: true,
      ...extra,
    }) as any,
    updateById: async (id: string, data: any) => ({ id, ...data }) as any,
    updateByName: async (tId: string, name: string, data: any) => ({ id: `tile-${name}`, name, ...data }) as any,
    update: async (params: any) => ({ id: params.id, ...params.data }) as any,
    patchById: async (id: string, data: any) => ({ id, ...data }) as any,
    patchByName: async (tId: string, name: string, data: any) => ({ id: `tile-${name}`, name, ...data }) as any,
    patch: async (params: any) => ({ id: params.id, ...params.updateData }) as any,
    patchSpecializedById: async (id: string, tileType: any, data: any) => ({ id, type: tileType, ...data }) as any,
    patchSpecializedByName: async (tId: string, name: string, tileType: any, data: any) => ({ id: `tile-${name}`, name, type: tileType, ...data }) as any,
    patchSpecialized: async (params: any) => ({ id: params.id, type: params.tileType, ...params.updateData }) as any,
    deleteById: async () => ({ success: true }) as any,
    deleteByName: async () => ({ success: true }) as any,
    delete: async () => ({ success: true }) as any,
    checkpointById: async (id: string, description?: string) => {
      const state = getCurrentState();
      const tile = state.tiles.find(t => t.id === id);
      if (tile) {
        const existingTiles = checkpointStore.current?.tiles || [];
        const tileIndex = existingTiles.findIndex((t: any) => t.id === id);
        if (tileIndex >= 0) {
          existingTiles[tileIndex] = { ...tile };
        } else {
          existingTiles.push({ ...tile });
        }
        checkpointStore.current = {
          interface: checkpointStore.current?.interface || null,
          tab: checkpointStore.current?.tab || null,
          tiles: existingTiles,
        };
      }
      return { info: 'Checkpoint created', detail: description } as any;
    },
    checkpointByName: async (tId: string, name: string, description?: string) => {
      const state = getCurrentState();
      const tile = state.tiles.find(t => t.name === name);
      if (tile) {
        const existingTiles = checkpointStore.current?.tiles || [];
        const tileIndex = existingTiles.findIndex((t: any) => t.name === name);
        if (tileIndex >= 0) {
          existingTiles[tileIndex] = { ...tile };
        } else {
          existingTiles.push({ ...tile });
        }
        checkpointStore.current = {
          interface: checkpointStore.current?.interface || null,
          tab: checkpointStore.current?.tab || null,
          tiles: existingTiles,
        };
      }
      return { info: 'Checkpoint created', detail: description } as any;
    },
    checkpoint: async (params: any) => {
      const state = getCurrentState();
      const tile = params.id 
        ? state.tiles.find(t => t.id === params.id)
        : state.tiles.find(t => t.name === params.name);
      if (tile) {
        const existingTiles = checkpointStore.current?.tiles || [];
        const tileIndex = existingTiles.findIndex((t: any) => t.id === tile.id);
        if (tileIndex >= 0) {
          existingTiles[tileIndex] = { ...tile };
        } else {
          existingTiles.push({ ...tile });
        }
        checkpointStore.current = {
          interface: checkpointStore.current?.interface || null,
          tab: checkpointStore.current?.tab || null,
          tiles: existingTiles,
        };
      }
      return { info: 'Checkpoint created', detail: params.description } as any;
    },
    exportTemplate: async () => ({ template: {}, metadata: {} }) as any,
    importTemplate: async () => ({ success: true }) as any,
  };

  return { interfaceActions, tabActions, tileActions };
}

interface CheckpointTestResult {
  container: HTMLElement;
  // State queries
  getCurrentTabState: () => TabState;
  getCheckpoint: () => CheckpointData | null;
  hasUnsavedChanges: () => boolean;
  isSaving: () => boolean;
  isRestoring: () => boolean;
  // Tile operations (auto-saved)
  moveTile: (tileId: string, newPosition: Partial<TilePosition>) => Promise<void>;
  resizeTile: (tileId: string, newSize: { width: number; height: number }) => Promise<void>;
  addTile: (name: string, position: TilePosition) => Promise<void>;
  removeTile: (tileId: string) => Promise<void>;
  renameTile: (tileId: string, newName: string) => Promise<void>;
  // Checkpoint operations
  saveCheckpoint: (description?: string) => Promise<void>;
  restoreCheckpoint: () => Promise<void>;
  // UI interactions
  clickSaveButton: () => Promise<void>;
  clickResetButton: () => Promise<void>;
  confirmReset: () => Promise<void>;
  cancelReset: () => Promise<void>;
  // State checks
  getSaveStatus: () => 'idle' | 'saving' | 'success' | 'error';
  getResetStatus: () => 'idle' | 'restoring' | 'success' | 'error';
  isResetDialogOpen: () => boolean;
  // Cleanup
  unmount: () => void;
}

// ============================================================================
// Initial State Builder
// ============================================================================

function createInitialStoreState(options: CheckpointTestOptions): Partial<StoreState> {
  const projectId = options.projectId || 'test-project';
  const interfaceId = options.interfaceId || 'test-interface';
  const initialTab = options.initialTab || {
    id: 'tab-1',
    name: 'Main Tab',
    tiles: [
      { id: 'tile-1', name: 'Tile 1', position: { x: 0, y: 0, width: 4, height: 4 }, type: 'table' },
      { id: 'tile-2', name: 'Tile 2', position: { x: 4, y: 0, width: 4, height: 4 }, type: 'plot' },
    ],
  };

  // Build tilesById
  const tilesById: Record<string, any> = {};
  initialTab.tiles.forEach(tile => {
    tilesById[tile.id] = {
      id: tile.id,
      name: tile.name,
      position: tile.position,
      type: tile.type,
      context: tile.context,
      visible: true,
    };
  });

  return {
    projects: [projectId],
    projectsById: {
      [projectId]: {
        id: projectId,
        name: projectId,
        description: '',
        contexts: [],
        interfaceIds: [interfaceId],
        activeInterfaceId: interfaceId,
      },
    },
    activeProjectId: projectId,

    interfacesById: {
      [interfaceId]: {
        id: interfaceId,
        name: 'Test Interface',
        projectId,
        tabIds: [initialTab.id],
        tabNames: [initialTab.name],
        activeTabId: initialTab.id,
      },
    },
    activeInterfaceId: interfaceId,

    tabsById: {
      [initialTab.id]: {
        // Meta
        id: initialTab.id,
        name: initialTab.name,
        visible: true,
        active: true,
        order: 0,
        // Data
        globalContext: initialTab.context,
        tileIds: initialTab.tiles.map(t => t.id),
        tileNames: initialTab.tiles.map(t => t.name),
        itemsNeedRecompute: false,
        // UI
        interfaceId,
        focusedTileNames: [undefined, undefined] as [string | undefined, string | undefined],
        saveSuccess: undefined,
        resetting: false,
        edit: true,
        interactive: true,
        help: true,
        copied: undefined,
        deleting: false,
        refreshing: false,
        color: undefined,
        hoveredLog: undefined,
        editTile: undefined,
        dataPending: false,
        pending: false,
      },
    },
    activeTabId: initialTab.id,

    tilesById,
  };
}

// ============================================================================
// Inner Component
// ============================================================================

interface StateContainer {
  getCurrentTabState: () => TabState;
  getCheckpoint: () => CheckpointData | null;
  hasUnsavedChanges: () => boolean;
  isSaving: () => boolean;
  isRestoring: () => boolean;
  moveTile: (tileId: string, newPosition: Partial<TilePosition>) => void;
  resizeTile: (tileId: string, newSize: { width: number; height: number }) => void;
  addTile: (name: string, position: TilePosition) => void;
  removeTile: (tileId: string) => void;
  renameTile: (tileId: string, newName: string) => void;
  saveCheckpoint: (description?: string) => Promise<void>;
  restoreCheckpoint: () => Promise<void>;
  getSaveStatus: () => 'idle' | 'saving' | 'success' | 'error';
  getResetStatus: () => 'idle' | 'restoring' | 'success' | 'error';
}

interface CheckpointInnerProps {
  stateContainerRef: React.MutableRefObject<StateContainer | null>;
  initialCheckpoint: CheckpointData | null;
  tabId: string;
  interfaceId: string;
  projectId: string;
  interfaceActions: GranularInterfaceActions;
  tabActions: GranularTabActions;
  tileActions: GranularTileActions;
  checkpointStore: React.MutableRefObject<{ interface: any; tab: any; tiles: any[] } | null>;
}

function CheckpointInner({ 
  stateContainerRef, 
  initialCheckpoint, 
  tabId, 
  interfaceId,
  projectId,
  interfaceActions,
  tabActions,
  tileActions,
  checkpointStore,
}: CheckpointInnerProps) {
  const storeApi = useStoreApiContext();
  const store = useStore(storeApi);
  
  // Checkpoint state (local tracking for UI display)
  const [checkpoint, setCheckpoint] = useState<CheckpointData | null>(initialCheckpoint);
  
  // Track last saved state - initialize from checkpoint if available
  const initialSavedState = useMemo(() => {
    if (initialCheckpoint) {
      return JSON.stringify(initialCheckpoint.tabState);
    }
    return null;
  }, []);
  const [lastSavedState, setLastSavedState] = useState<string | null>(initialSavedState);
  
  // Operation states
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [resetStatus, setResetStatus] = useState<'idle' | 'restoring' | 'success' | 'error'>('idle');
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  
  // Auto-save tracking
  const [autoSaveQueue, setAutoSaveQueue] = useState<string[]>([]);

  // Track mounted state to prevent state updates after unmount
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Get current state from store
  const tabState = store.tabsById?.[tabId];
  const tileIds = tabState?.tileIds || [];
  const tilesById = store.tilesById || {};

  // Initialize the REAL mutation hooks with our mock actions
  const saveTabWithTilesMutation = useSaveTabWithTilesQuery(tabActions, tileActions, "Manual save");
  const restoreTabWithTilesMutation = useRestoreLastSavedTabWithTilesQuery();

  // Build current tab state - memoized to avoid recreating on every render
  const getCurrentTabState = useCallback((): TabState => {
    const tiles: TileState[] = tileIds
      .map(id => tilesById[id])
      .filter(Boolean)
      .map(tile => ({
        id: tile.id,
        name: tile.name,
        position: tile.position,
        type: tile.type || 'table',
        context: tile.context || undefined,
      }));

    return {
      id: tabId,
      name: tabState?.name || '',
      tiles,
      context: tabState?.globalContext,
    };
  }, [tileIds, tilesById, tabId, tabState?.name, tabState?.globalContext]);

  // Check for unsaved changes - memoized
  const hasUnsavedChanges = useCallback((): boolean => {
    if (!lastSavedState) return tileIds.length > 0;
    const currentState = JSON.stringify(getCurrentTabState());
    return currentState !== lastSavedState;
  }, [lastSavedState, tileIds.length, getCurrentTabState]);

  // Simulate auto-save (optimistic update) - memoized
  const simulateAutoSave = useCallback((operation: string) => {
    act(() => {
      setAutoSaveQueue(prev => [...prev, operation]);
    });
    // Simulate async save completing
    setTimeout(() => {
      if (isMountedRef.current) {
        act(() => {
          setAutoSaveQueue(prev => prev.slice(1));
        });
      }
    }, 100);
  }, []);

  // Expose state container
  useEffect(() => {
    stateContainerRef.current = {
      getCurrentTabState,
      getCheckpoint: () => checkpoint,
      hasUnsavedChanges,
      isSaving: () => saveStatus === 'saving',
      isRestoring: () => resetStatus === 'restoring',
      
      moveTile: (tileId, newPosition) => {
        const tile = tilesById[tileId];
        if (tile) {
          act(() => {
            store.updateTile(tileId, {
              position: { ...tile.position, ...newPosition },
            });
          });
          simulateAutoSave(`move:${tileId}`);
        }
      },
      
      resizeTile: (tileId, newSize) => {
        const tile = tilesById[tileId];
        if (tile) {
          act(() => {
            store.updateTile(tileId, {
              position: { ...tile.position, ...newSize },
            });
          });
          simulateAutoSave(`resize:${tileId}`);
        }
      },
      
      addTile: (name, position) => {
        const newId = `tile-${Date.now()}`;
        act(() => {
          store.initTile(tabId, newId, { name, position, type: 'Table', visible: true });
        });
        simulateAutoSave(`add:${newId}`);
      },
      
      removeTile: (tileId) => {
        act(() => {
          store.removeTile(tabId, tileId);
        });
        simulateAutoSave(`remove:${tileId}`);
      },
      
      renameTile: (tileId, newName) => {
        act(() => {
          store.updateTile(tileId, { name: newName });
        });
        simulateAutoSave(`rename:${tileId}`);
      },
      
      // Use the REAL saveTabWithTilesMutation hook
      saveCheckpoint: async (description = 'Manual save') => {
        act(() => {
          setSaveStatus('saving');
        });
        try {
          // The real hook requires at least one tile, but for empty tabs
          // we still want to save the tab state. Handle edge case.
          if (tileIds.length > 0) {
            // Call the real mutation with our mock actions
            await saveTabWithTilesMutation.mutateAsync({
              tab_id: tabId,
              interface_id: interfaceId,
              tab_name: tabState?.name || 'Test Tab',
              tile_ids: tileIds,
            });
          } else {
            // For empty tabs, just checkpoint the tab itself via mock actions
            await tabActions.checkpointById(tabId, description);
          }
          
          const currentState = getCurrentTabState();
          const newCheckpoint: CheckpointData = {
            timestamp: Date.now(),
            description,
            tabState: currentState,
          };
          
          act(() => {
            setCheckpoint(newCheckpoint);
            setLastSavedState(JSON.stringify(currentState));
            setSaveStatus('success');
          });
          
          // Reset status after delay
          setTimeout(() => {
            if (isMountedRef.current) {
              act(() => {
                setSaveStatus('idle');
              });
            }
          }, 1000);
        } catch (error) {
          act(() => {
            setSaveStatus('error');
          });
          setTimeout(() => {
            if (isMountedRef.current) {
              act(() => {
                setSaveStatus('idle');
              });
            }
          }, 2000);
        }
      },
      
      // Use the REAL restoreTabWithTilesMutation hook
      restoreCheckpoint: async () => {
        if (!checkpoint) return;
        
        act(() => {
          setResetStatus('restoring');
        });
        try {
          // Call the real mutation with our mock actions
          await restoreTabWithTilesMutation.mutateAsync({
            interface_id: interfaceId,
            project_id: projectId,
            interface_actions: interfaceActions,
            tab_actions: tabActions,
            tile_actions: tileActions,
          });
          
          // After restore, update local Zustand state from checkpoint
          const checkpointTiles = checkpoint.tabState.tiles;
          
          // Remove tiles not in checkpoint
          const currentTileIds = [...tileIds];
          act(() => {
            currentTileIds.forEach(id => {
              if (!checkpointTiles.find(t => t.id === id)) {
                store.removeTile(tabId, id);
              }
            });
            
            // Update/add tiles from checkpoint
            checkpointTiles.forEach(tile => {
              if (tilesById[tile.id]) {
                store.updateTile(tile.id, {
                  name: tile.name,
                  position: tile.position,
                  type: tile.type,
                  context: tile.context,
                });
              } else {
                store.initTile(tabId, tile.id, {
                  name: tile.name,
                  position: tile.position,
                  type: tile.type === 'table' ? 'Table' : tile.type === 'plot' ? 'Plot' : 'Table',
                  visible: true,
                  context: tile.context,
                });
              }
            });
            
            setResetStatus('success');
          });
          
          setTimeout(() => {
            if (isMountedRef.current) {
              act(() => {
                setResetStatus('idle');
              });
            }
          }, 1000);
        } catch (error) {
          act(() => {
            setResetStatus('error');
          });
          setTimeout(() => {
            if (isMountedRef.current) {
              act(() => {
                setResetStatus('idle');
              });
            }
          }, 2000);
        }
      },
      
      getSaveStatus: () => saveStatus,
      getResetStatus: () => resetStatus,
    };
  }, [store, tabId, interfaceId, projectId, checkpoint, lastSavedState, saveStatus, resetStatus, tileIds, tilesById, getCurrentTabState, hasUnsavedChanges, simulateAutoSave, saveTabWithTilesMutation, restoreTabWithTilesMutation, interfaceActions, tabActions, tileActions, tabState?.name]);

  const handleSave = async () => {
    await stateContainerRef.current?.saveCheckpoint();
  };

  const handleResetClick = () => {
    setResetDialogOpen(true);
  };

  const handleConfirmReset = async () => {
    setResetDialogOpen(false);
    await stateContainerRef.current?.restoreCheckpoint();
  };

  const handleCancelReset = () => {
    setResetDialogOpen(false);
  };

  const tiles = tileIds.map(id => tilesById[id]).filter(Boolean);

  return (
    <div data-testid="checkpoint-harness">
      {/* Status Display */}
      <div data-testid="status-section">
        <span data-testid="save-status">{saveStatus}</span>
        <span data-testid="reset-status">{resetStatus}</span>
        <span data-testid="unsaved-indicator">
          {hasUnsavedChanges() ? 'Unsaved changes' : 'All saved'}
        </span>
        <span data-testid="auto-save-queue">
          {autoSaveQueue.length > 0 ? `Auto-saving: ${autoSaveQueue.length}` : 'Auto-save idle'}
        </span>
      </div>

      {/* Checkpoint Info */}
      <div data-testid="checkpoint-info">
        {checkpoint ? (
          <>
            <span data-testid="checkpoint-exists">Checkpoint exists</span>
            <span data-testid="checkpoint-description">{checkpoint.description}</span>
            <span data-testid="checkpoint-time">{new Date(checkpoint.timestamp).toISOString()}</span>
          </>
        ) : (
          <span data-testid="no-checkpoint">No checkpoint saved</span>
        )}
      </div>

      {/* Tile List */}
      <div data-testid="tile-list">
        {tiles.map((tile: any) => (
          <div key={tile.id} data-testid={`tile-${tile.id}`}>
            <span data-testid={`tile-name-${tile.id}`}>{tile.name}</span>
            <span data-testid={`tile-position-${tile.id}`}>
              {`${tile.position.x},${tile.position.y},${tile.position.width},${tile.position.height}`}
            </span>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div data-testid="action-buttons">
        <button
          data-testid="save-button"
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
        >
          {saveStatus === 'saving' ? 'Saving...' : 'Save Tab'}
        </button>
        <button
          data-testid="reset-button"
          onClick={handleResetClick}
          disabled={!checkpoint || resetStatus === 'restoring'}
        >
          {resetStatus === 'restoring' ? 'Resetting...' : 'Reset Tab'}
        </button>
      </div>

      {/* Reset Confirmation Dialog */}
      {resetDialogOpen && (
        <div data-testid="reset-dialog" role="alertdialog">
          <h3>Reset Tab</h3>
          <p>This will revert all changes to the last saved state. Continue?</p>
          <button data-testid="reset-confirm" onClick={handleConfirmReset}>
            Reset
          </button>
          <button data-testid="reset-cancel" onClick={handleCancelReset}>
            Cancel
          </button>
        </div>
      )}

      {/* Save/Reset Overlay */}
      {(saveStatus === 'saving' || resetStatus === 'restoring') && (
        <div data-testid="operation-overlay">
          <span>{saveStatus === 'saving' ? 'Saving tab...' : 'Resetting tab...'}</span>
        </div>
      )}

      {/* Success/Error Messages */}
      {saveStatus === 'success' && (
        <div data-testid="save-success-message">Tab saved successfully!</div>
      )}
      {saveStatus === 'error' && (
        <div data-testid="save-error-message">Failed to save tab</div>
      )}
      {resetStatus === 'success' && (
        <div data-testid="reset-success-message">Tab reset successfully!</div>
      )}
      {resetStatus === 'error' && (
        <div data-testid="reset-error-message">Failed to reset tab</div>
      )}
    </div>
  );
}

// ============================================================================
// Render Function
// ============================================================================

export function renderCheckpoint(
  options: CheckpointTestOptions = {}
): CheckpointTestResult {
  const stateContainerRef: React.MutableRefObject<StateContainer | null> = { current: null };
  const projectId = options.projectId || 'test-project';
  const interfaceId = options.interfaceId || 'test-interface';
  const tabId = options.initialTab?.id || 'tab-1';

  // Checkpoint store to simulate server-side checkpoint storage
  const checkpointStore: React.MutableRefObject<{ interface: any; tab: any; tiles: any[] } | null> = { current: null };

  // Initialize checkpoint store from initialCheckpoint if provided
  if (options.initialCheckpoint) {
    checkpointStore.current = {
      interface: { id: interfaceId, name: 'Test Interface', project_id: projectId, active_tab_id: tabId },
      tab: { id: tabId, name: options.initialCheckpoint.tabState.name, interface_id: interfaceId },
      tiles: options.initialCheckpoint.tabState.tiles.map(tile => ({
        ...tile,
        tab_id: tabId,
        visible: true,
      })),
    };
  }

  const initialState = createInitialStoreState(options);

  // We need a way to get current state for the mock actions
  // This will be set up after we have access to the store
  let getCurrentStateFromStore: () => { tab: TabState; tiles: TileState[] } = () => ({
    tab: { id: tabId, name: 'Test Tab', tiles: [] },
    tiles: [],
  });

  // Create mock actions
  const { interfaceActions, tabActions, tileActions } = createMockActions(
    options,
    checkpointStore,
    () => getCurrentStateFromStore()
  );

  // Wrapper component that sets up getCurrentStateFromStore using shared TestProviders
  function TestWrapper({ children }: { children: React.ReactNode }) {
    return (
      <TestProviders initialState={initialState}>
        <StoreStateReader setGetCurrentState={(fn) => { getCurrentStateFromStore = fn; }}>
          {children}
        </StoreStateReader>
      </TestProviders>
    );
  }

  // Helper component to read store state
  function StoreStateReader({ 
    children, 
    setGetCurrentState 
  }: { 
    children: React.ReactNode; 
    setGetCurrentState: (fn: () => { tab: TabState; tiles: TileState[] }) => void;
  }) {
    const storeApi = useStoreApiContext();
    const store = useStore(storeApi);
    
    useEffect(() => {
      setGetCurrentState(() => {
        const tabData = store.tabsById?.[tabId];
        const tileIdsList = tabData?.tileIds || [];
        const tiles: TileState[] = tileIdsList
          .map((id: string) => store.tilesById?.[id])
          .filter(Boolean)
          .map((tile: any) => ({
            id: tile.id,
            name: tile.name,
            position: tile.position,
            type: tile.type || 'table',
            context: tile.context,
          }));
        
        return {
          tab: {
            id: tabId,
            name: tabData?.name || 'Test Tab',
            tiles,
            context: tabData?.globalContext,
          },
          tiles,
        };
      });
    }, [store, setGetCurrentState]);
    
    return <>{children}</>;
  }

  const { container, unmount } = render(
    <TestWrapper>
      <CheckpointInner
        stateContainerRef={stateContainerRef}
        initialCheckpoint={options.initialCheckpoint || null}
        tabId={tabId}
        interfaceId={interfaceId}
        projectId={projectId}
        interfaceActions={interfaceActions}
        tabActions={tabActions}
        tileActions={tileActions}
        checkpointStore={checkpointStore}
      />
    </TestWrapper>
  );

  return {
    container,

    // State queries
    getCurrentTabState: () => stateContainerRef.current?.getCurrentTabState() ?? { id: '', name: '', tiles: [] },
    getCheckpoint: () => stateContainerRef.current?.getCheckpoint() ?? null,
    hasUnsavedChanges: () => stateContainerRef.current?.hasUnsavedChanges() ?? false,
    isSaving: () => stateContainerRef.current?.isSaving() ?? false,
    isRestoring: () => stateContainerRef.current?.isRestoring() ?? false,

    // Tile operations
    moveTile: async (tileId, newPosition) => {
      stateContainerRef.current?.moveTile(tileId, newPosition);
      await waitFor(() => {});
    },
    resizeTile: async (tileId, newSize) => {
      stateContainerRef.current?.resizeTile(tileId, newSize);
      await waitFor(() => {});
    },
    addTile: async (name, position) => {
      stateContainerRef.current?.addTile(name, position);
      await waitFor(() => {});
    },
    removeTile: async (tileId) => {
      stateContainerRef.current?.removeTile(tileId);
      await waitFor(() => {});
    },
    renameTile: async (tileId, newName) => {
      stateContainerRef.current?.renameTile(tileId, newName);
      await waitFor(() => {});
    },

    // Checkpoint operations
    saveCheckpoint: async (description) => {
      await stateContainerRef.current?.saveCheckpoint(description);
    },
    restoreCheckpoint: async () => {
      await stateContainerRef.current?.restoreCheckpoint();
    },

    // UI interactions
    clickSaveButton: async () => {
      const user = userEvent.setup();
      const button = screen.getByTestId('save-button');
      await user.click(button);
    },
    clickResetButton: async () => {
      const user = userEvent.setup();
      const button = screen.getByTestId('reset-button');
      await user.click(button);
    },
    confirmReset: async () => {
      const user = userEvent.setup();
      const button = screen.getByTestId('reset-confirm');
      await user.click(button);
    },
    cancelReset: async () => {
      const user = userEvent.setup();
      const button = screen.getByTestId('reset-cancel');
      await user.click(button);
    },

    // State checks
    getSaveStatus: () => stateContainerRef.current?.getSaveStatus() ?? 'idle',
    getResetStatus: () => stateContainerRef.current?.getResetStatus() ?? 'idle',
    isResetDialogOpen: () => screen.queryByTestId('reset-dialog') !== null,

    unmount,
  };
}

// Export types
export type { CheckpointTestOptions, CheckpointTestResult, CheckpointData, TabState, TileState, TilePosition };

