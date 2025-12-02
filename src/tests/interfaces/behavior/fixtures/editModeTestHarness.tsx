/**
 * Edit Mode Test Harness
 * 
 * A reusable wrapper for testing edit mode behaviors including
 * toggle, save, reset, and unsaved changes detection.
 * 
 * Uses REAL components:
 * - useGlobalUIMode hook for edit mode state (from Zustand store)
 * - useSaveTabWithTilesQuery for save operations
 * - useRestoreLastSavedTabWithTilesQuery for reset operations
 * - Tab UI state from store for save success/failure
 */
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { render, RenderResult } from '@testing-library/react';
import { Hammer, Save, RotateCcw, AlertTriangle, GripVertical } from 'lucide-react';

// Shared test utilities
import { TestProviders, useStateContainer, actSync, actAsync } from '../utils';

// Real Store Imports
import { useStoreContext, useStoreApiContext } from '../../../../contexts/providers/StoreProvider';
import { useGlobalUIMode } from '../../../../contexts/hooks/useGlobalUIMode';
import { IStoreState } from '../../../../contexts/store';
import { useStore } from 'zustand';

// Real Mutation Hooks
import { useSaveTabWithTilesQuery } from '@/hooks/Interfaces/Query/useSaveTabWithTilesQuery';
import { useRestoreLastSavedTabWithTilesQuery } from '@/hooks/Interfaces/Query/useRestoreLastSavedTabWithTilesQuery';
import { GranularInterfaceActions, GranularTabActions, GranularTileActions } from '@/types/interfaces/grid';

// =============================================================================
// Types
// =============================================================================

export interface EditModeCallbacks {
  /** Called after edit mode is toggled. Query isEditMode() for the new state. */
  onToggleEditMode?: () => void;
  onSave?: () => Promise<void>;
  onReset?: () => void;
  onNavigateAway?: () => boolean; // Returns true if navigation should proceed
}

export interface EditModeTestOptions {
  /** Initial edit mode state */
  initialEditMode?: boolean;
  /** Initial unsaved changes state */
  initialHasUnsavedChanges?: boolean;
  /** Callbacks for actions */
  callbacks?: EditModeCallbacks;
  /** Whether save should succeed */
  saveSucceeds?: boolean;
  /** Simulated tiles for showing drag handles */
  tileCount?: number;
  /** Project ID for save/reset operations */
  projectId?: string;
  /** Interface ID for save/reset operations */
  interfaceId?: string;
  /** Tab ID for save/reset operations */
  tabId?: string;
}

// =============================================================================
// Mock Actions Factory (for save/reset operations)
// =============================================================================

interface TileSnapshot {
  id: string;
  name: string;
  position: { x: number; y: number; width: number; height: number };
  type: string;
}

function createMockActions(
  projectId: string,
  interfaceId: string,
  tabId: string,
  saveSucceeds: boolean,
  checkpointStore: React.MutableRefObject<{
    interface: any;
    tab: any;
    tiles: TileSnapshot[];
  } | null>
): {
  interfaceActions: GranularInterfaceActions;
  tabActions: GranularTabActions;
  tileActions: GranularTileActions;
} {
  // Cast to the action types - we only implement the methods used by the hooks
  const interfaceActions = {
    list: async () => [{ id: interfaceId, name: 'Test Interface', project_id: projectId }],
    getById: async (id: string) => ({
      id,
      name: 'Test Interface',
      project_id: projectId,
      active_tab_id: tabId,
    }),
    getByName: async (projId: string, name: string) => ({
      id: interfaceId,
      name,
      project_id: projId,
      active_tab_id: tabId,
    }),
    getCheckpointById: async (id: string) => {
      if (checkpointStore.current?.interface) {
        return checkpointStore.current.interface;
      }
      return { id, name: 'Test Interface', project_id: projectId, active_tab_id: tabId };
    },
    getCheckpointByName: async (projId: string, name: string) => {
      if (checkpointStore.current?.interface) {
        return checkpointStore.current.interface;
      }
      return { id: interfaceId, name, project_id: projId, active_tab_id: tabId };
    },
    create: async () => ({ id: interfaceId, name: 'Test Interface', project_id: projectId }),
    updateById: async (id: string, data: any) => ({ id, ...data }),
    updateByName: async (projId: string, name: string, data: any) => ({ id: interfaceId, name, project_id: projId, ...data }),
    deleteById: async () => ({ success: true }),
    deleteByName: async () => ({ success: true }),
    checkpointById: async (id: string, description?: string) => {
      if (!saveSucceeds) throw new Error('Save failed');
      checkpointStore.current = {
        interface: { id, name: 'Test Interface', project_id: projectId, active_tab_id: tabId },
        tab: checkpointStore.current?.tab || null,
        tiles: checkpointStore.current?.tiles || [],
      };
      return { id, description };
    },
    checkpointByName: async (projId: string, name: string, description?: string) => {
      if (!saveSucceeds) throw new Error('Save failed');
      checkpointStore.current = {
        interface: { id: interfaceId, name, project_id: projId, active_tab_id: tabId },
        tab: checkpointStore.current?.tab || null,
        tiles: checkpointStore.current?.tiles || [],
      };
      return { id: interfaceId, description };
    },
  } as unknown as GranularInterfaceActions;

  const tabActions = {
    list: async () => [{ id: tabId, name: 'Test Tab', interface_id: interfaceId }],
    getById: async (id: string) => ({
      id,
      name: 'Test Tab',
      interface_id: interfaceId,
    }),
    getByName: async (intId: string, name: string) => ({
      id: tabId,
      name,
      interface_id: intId,
    }),
    getCheckpointById: async (id: string) => {
      if (checkpointStore.current?.tab) {
        return checkpointStore.current.tab;
      }
      return { id, name: 'Test Tab', interface_id: interfaceId };
    },
    getCheckpointByName: async (intId: string, name: string) => {
      if (checkpointStore.current?.tab) {
        return checkpointStore.current.tab;
      }
      return { id: tabId, name, interface_id: intId };
    },
    create: async () => ({ id: tabId, name: 'New Tab', interface_id: interfaceId }),
    updateById: async (id: string, data: any) => ({ id, ...data }),
    updateByName: async (intId: string, name: string, data: any) => ({ id: tabId, name, interface_id: intId, ...data }),
    deleteById: async () => ({ success: true }),
    deleteByName: async () => ({ success: true }),
    checkpointById: async (id: string, description?: string) => {
      if (!saveSucceeds) throw new Error('Save failed');
      checkpointStore.current = {
        interface: checkpointStore.current?.interface || null,
        tab: { id, name: 'Test Tab', interface_id: interfaceId },
        tiles: checkpointStore.current?.tiles || [],
      };
      return { id, description };
    },
    checkpointByName: async (intId: string, name: string, description?: string) => {
      if (!saveSucceeds) throw new Error('Save failed');
      checkpointStore.current = {
        interface: checkpointStore.current?.interface || null,
        tab: { id: tabId, name, interface_id: intId },
        tiles: checkpointStore.current?.tiles || [],
      };
      return { id: tabId, description };
    },
  } as unknown as GranularTabActions;

  const tileActions = {
    list: async (tId: string, name?: string, checkpoint?: boolean) => {
      if (checkpoint && checkpointStore.current?.tiles) {
        return checkpointStore.current.tiles.map(tile => ({
          ...tile,
          tab_id: tabId,
          visible: true,
        }));
      }
      return [];
    },
    getById: async (id: string) => ({ id, name: 'Tile', tab_id: tabId, position: { x: 0, y: 0, width: 2, height: 2 }, type: 'Table', visible: true }),
    getByName: async (tId: string, name: string) => ({ id: `tile-${name}`, name, tab_id: tId, position: { x: 0, y: 0, width: 2, height: 2 }, type: 'Table', visible: true }),
    getCheckpointById: async (id: string) => ({ id, name: 'Tile', tab_id: tabId, position: { x: 0, y: 0, width: 2, height: 2 }, type: 'Table', visible: true }),
    getCheckpointByName: async (tId: string, name: string) => ({ id: `tile-${name}`, name, tab_id: tId, position: { x: 0, y: 0, width: 2, height: 2 }, type: 'Table', visible: true }),
    create: async (tId: string, name: string, position: any, extra?: any, type?: string) => ({
      id: `tile-${Date.now()}`,
      name,
      tab_id: tId,
      position,
      type: type || 'Table',
      visible: true,
      ...extra,
    }),
    updateById: async (id: string, data: any) => ({ id, ...data }),
    updateByName: async (tId: string, name: string, data: any) => ({ id: `tile-${name}`, name, ...data }),
    deleteById: async () => ({ success: true }),
    deleteByName: async () => ({ success: true }),
    checkpointById: async (id: string, description?: string) => {
      if (!saveSucceeds) throw new Error('Save failed');
      return { id, description };
    },
    checkpointByName: async (tId: string, name: string, description?: string) => {
      if (!saveSucceeds) throw new Error('Save failed');
      return { id: `tile-${name}`, description };
    },
  } as unknown as GranularTileActions;

  return { interfaceActions, tabActions, tileActions };
}

export interface EditModeTestResult extends RenderResult {
  /** Check if edit mode is active */
  isEditMode: () => boolean;
  /** Check if there are unsaved changes */
  hasUnsavedChanges: () => boolean;
  /** Check if save is in progress */
  isSaving: () => boolean;
  /** Toggle edit mode */
  toggleEditMode: () => void;
  /** Make a change (sets unsaved changes flag) */
  makeChange: () => void;
  /** Trigger save */
  save: () => Promise<void>;
  /** Trigger reset */
  reset: () => void;
  /** Attempt to navigate away */
  attemptNavigate: () => boolean;
}

// =============================================================================
// Internal State Container
// =============================================================================

interface StateContainer {
  isEditMode: () => boolean;
  hasUnsavedChanges: () => boolean;
  isSaving: () => boolean;
  toggleEditMode: () => void;
  makeChange: () => void;
  save: () => Promise<void>;
  reset: () => void;
  attemptNavigate: () => boolean;
}

// =============================================================================
// Edit Mode Inner Component (Connected to Store)
// =============================================================================

interface EditModeInnerProps extends EditModeTestOptions {
  stateContainerRef: React.MutableRefObject<StateContainer | null>;
  interfaceActions: GranularInterfaceActions;
  tabActions: GranularTabActions;
  tileActions: GranularTileActions;
  checkpointStore: React.MutableRefObject<{ interface: any; tab: any; tiles: TileSnapshot[] } | null>;
}

function EditModeInner({
  initialHasUnsavedChanges = false,
  callbacks = {},
  saveSucceeds = true,
  tileCount = 3,
  projectId = 'test-project',
  interfaceId = 'test-interface',
  tabId = 'tab-1',
  stateContainerRef,
  interfaceActions,
  tabActions,
  tileActions,
  checkpointStore,
}: EditModeInnerProps) {
  // Use REAL hook for Edit Mode (from Zustand store)
  const { isEditMode, toggleEditMode, setEditMode } = useGlobalUIMode();
  
  // Use REAL mutation hooks for save/reset operations
  const saveTabMutation = useSaveTabWithTilesQuery(tabActions, tileActions, "Manual save");
  const restoreTabMutation = useRestoreLastSavedTabWithTilesQuery();
  
  // Get store for tile IDs (used by real save mutation)
  const storeApi = useStoreApiContext();
  const store = useStore(storeApi);
  const tileIds = useMemo(() => {
    const tabData = store.tabsById?.[tabId];
    return tabData?.tileIds || [];
  }, [store.tabsById, tabId]);
  
  // Simple hasChanges state for UI consistency (matches original harness behavior)
  // This allows tests to use initialHasUnsavedChanges and makeChange() predictably
  const [hasChanges, setHasChanges] = useState(initialHasUnsavedChanges);
  
  // Track saving state (both mutation and callback)
  const [isSavingState, setIsSavingState] = useState(false);
  
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showNavigateWarning, setShowNavigateWarning] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean | null>(null);
  
  // Track mounted state to prevent state updates after unmount
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const handleToggleEditMode = useCallback(() => {
    toggleEditMode();
    // Callback is called without predicted state - tests should query isEditMode() after
    callbacks.onToggleEditMode?.();
  }, [toggleEditMode, callbacks]);

  const handleMakeChange = useCallback(() => {
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(async () => {
    setIsSavingState(true);
    setSaveSuccess(null);
    
    try {
      // Call the callback first if provided (allows tests to control timing)
      if (callbacks.onSave) {
        await callbacks.onSave();
      }
      
      // Use the REAL mutation hook for save (if we have tiles and no callback)
      if (!callbacks.onSave) {
        if (tileIds.length > 0) {
          await saveTabMutation.mutateAsync({
            tab_id: tabId,
            interface_id: interfaceId,
            tab_name: 'Test Tab',
            tile_ids: tileIds,
          });
        } else {
          // For empty tabs, just checkpoint the tab via mock actions
          await tabActions.checkpointById(tabId, 'Manual save');
        }
      }
      
      // Only update state if still mounted
      if (!isMountedRef.current) return;
      
      if (saveSucceeds) {
        setHasChanges(false);
        setSaveSuccess(true);
      } else {
        throw new Error('Save failed');
      }
    } catch {
      if (isMountedRef.current) {
        setSaveSuccess(false);
      }
    } finally {
      if (isMountedRef.current) {
        setIsSavingState(false);
      }
    }
  }, [callbacks, tileIds, saveTabMutation, tabId, interfaceId, tabActions, saveSucceeds]);

  const handleReset = useCallback(async () => {
    setShowResetConfirm(false);
    
    try {
      // Use the REAL mutation hook for reset
      await restoreTabMutation.mutateAsync({
        interface_id: interfaceId,
        project_id: projectId,
        interface_actions: interfaceActions,
        tab_actions: tabActions,
        tile_actions: tileActions,
      });
      
      // Clear changes state
      setHasChanges(false);
      
      // Call callback if provided
      callbacks.onReset?.();
    } catch (error) {
      console.error('Reset failed:', error);
    }
  }, [callbacks, restoreTabMutation, interfaceId, projectId, interfaceActions, tabActions, tileActions]);

  const handleAttemptNavigate = useCallback(() => {
    if (hasChanges) {
      setShowNavigateWarning(true);
      return callbacks.onNavigateAway?.() ?? false;
    }
    return true;
  }, [hasChanges, callbacks]);

  // ==========================================================================
  // Expose state to test via ref (using shared hook)
  // ==========================================================================

  // Derive saving state from our state OR mutation
  const isSaving = isSavingState || saveTabMutation.isPending;
  
  useStateContainer(stateContainerRef, () => ({
    isEditMode: () => isEditMode,
    hasUnsavedChanges: () => hasChanges,
    isSaving: () => isSaving,
    toggleEditMode: handleToggleEditMode,
    makeChange: handleMakeChange,
    save: handleSave,
    reset: handleReset,
    attemptNavigate: handleAttemptNavigate,
  }), [isEditMode, hasChanges, isSaving, handleToggleEditMode, handleMakeChange, handleSave, handleReset, handleAttemptNavigate]);

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <div data-testid="edit-mode-container" className="min-h-screen bg-gray-50">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-4 bg-white border-b" data-testid="edit-toolbar">
        <button
          onClick={handleToggleEditMode}
          className={`flex items-center gap-2 px-3 py-2 rounded ${
            isEditMode ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
          }`}
          data-testid="edit-mode-toggle"
          aria-pressed={isEditMode}
        >
          <Hammer className="h-4 w-4" />
          {isEditMode ? 'Editing' : 'Edit'}
        </button>

        {isEditMode && (
          <>
            <button
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className={`flex items-center gap-2 px-3 py-2 rounded ${
                hasChanges && !isSaving
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
              data-testid="save-button"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save'}
            </button>

            <button
              onClick={() => setShowResetConfirm(true)}
              disabled={!hasChanges}
              className={`flex items-center gap-2 px-3 py-2 rounded ${
                hasChanges
                  ? 'bg-gray-100 hover:bg-gray-200'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
              data-testid="reset-button"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>

            {hasChanges && (
              <div
                className="flex items-center gap-1 text-amber-600"
                data-testid="unsaved-indicator"
              >
                <span className="w-2 h-2 bg-amber-500 rounded-full" />
                Unsaved changes
              </div>
            )}

            {saveSuccess === true && (
              <div className="text-green-600" data-testid="save-success">
                Saved successfully
              </div>
            )}

            {saveSuccess === false && (
              <div className="text-red-600" data-testid="save-error">
                Save failed
              </div>
            )}
          </>
        )}
      </div>

      {/* Simulated tile grid */}
      <div className="p-4 grid grid-cols-3 gap-4" data-testid="tile-grid">
        {Array.from({ length: tileCount }, (_, i) => (
          <div
            key={i}
            className="bg-white border rounded-lg p-4 relative"
            data-testid={`tile-${i + 1}`}
          >
            {isEditMode && (
              <div
                className="absolute top-2 left-2 cursor-grab"
                data-testid={`drag-handle-${i + 1}`}
              >
                <GripVertical className="h-5 w-5 text-gray-400" />
              </div>
            )}
            <div className={isEditMode ? 'ml-8' : ''}>
              Tile {i + 1}
            </div>
            {isEditMode && (
              <button
                onClick={handleMakeChange}
                className="mt-2 text-sm text-blue-500 hover:underline"
                data-testid={`change-tile-${i + 1}`}
              >
                Make change
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Reset confirmation dialog */}
      {showResetConfirm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center"
          data-testid="reset-confirm-dialog"
        >
          <div className="bg-white rounded-lg p-6 max-w-md">
            <div className="flex items-center gap-2 text-amber-600 mb-4">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="font-semibold">Reset Changes?</h3>
            </div>
            <p className="mb-4">
              This will discard all unsaved changes. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200"
                data-testid="reset-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                data-testid="reset-confirm"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation warning dialog */}
      {showNavigateWarning && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center"
          data-testid="navigate-warning-dialog"
        >
          <div className="bg-white rounded-lg p-6 max-w-md">
            <div className="flex items-center gap-2 text-amber-600 mb-4">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="font-semibold">Unsaved Changes</h3>
            </div>
            <p className="mb-4">
              You have unsaved changes. Do you want to save before leaving?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowNavigateWarning(false)}
                className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200"
                data-testid="navigate-cancel"
              >
                Stay
              </button>
              <button
                onClick={() => {
                  setShowNavigateWarning(false);
                  setHasChanges(false);
                }}
                className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600"
                data-testid="navigate-discard"
              >
                Discard & Leave
              </button>
              <button
                onClick={async () => {
                  await handleSave();
                  setShowNavigateWarning(false);
                }}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                data-testid="navigate-save"
              >
                Save & Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Export: renderEditMode
// =============================================================================

function createInitialStoreState(
  initialEditMode: boolean,
  tabId: string,
  interfaceId: string,
  projectId: string
): Partial<IStoreState> {
  return {
    globalEditMode: initialEditMode,
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
        tabIds: [tabId],
        tabNames: ['Test Tab'],
        activeTabId: tabId,
      },
    },
    activeInterfaceId: interfaceId,
    tabsById: {
      [tabId]: {
        id: tabId,
        name: 'Test Tab',
        visible: true,
        active: true,
        order: 0,
        globalContext: undefined,
        tileIds: [],
        tileNames: [],
        itemsNeedRecompute: false,
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
    activeTabId: tabId,
    tilesById: {},
  };
}

export function renderEditMode(options: EditModeTestOptions = {}): EditModeTestResult {
  const stateContainerRef: React.MutableRefObject<StateContainer | null> = { current: null };
  const { 
    initialEditMode = false, 
    projectId = 'test-project',
    interfaceId = 'test-interface',
    tabId = 'tab-1',
    saveSucceeds = true,
    ...innerOptions 
  } = options;

  // Checkpoint store for save/reset operations
  const checkpointStore: React.MutableRefObject<{ interface: any; tab: any; tiles: TileSnapshot[] } | null> = { 
    current: null 
  };

  // Create mock actions
  const { interfaceActions, tabActions, tileActions } = createMockActions(
    projectId,
    interfaceId,
    tabId,
    saveSucceeds,
    checkpointStore
  );

  const initialState = createInitialStoreState(initialEditMode, tabId, interfaceId, projectId);

  const renderResult = render(
    <TestProviders initialState={initialState}>
      <EditModeInner 
        {...innerOptions} 
        projectId={projectId}
        interfaceId={interfaceId}
        tabId={tabId}
        saveSucceeds={saveSucceeds}
        stateContainerRef={stateContainerRef}
        interfaceActions={interfaceActions}
        tabActions={tabActions}
        tileActions={tileActions}
        checkpointStore={checkpointStore}
      />
    </TestProviders>
  );

  // Wrap state-changing operations in actSync to avoid act() warnings
  return {
    ...renderResult,
    isEditMode: () => stateContainerRef.current?.isEditMode() ?? false,
    hasUnsavedChanges: () => stateContainerRef.current?.hasUnsavedChanges() ?? false,
    isSaving: () => stateContainerRef.current?.isSaving() ?? false,
    toggleEditMode: () => actSync(() => stateContainerRef.current?.toggleEditMode()),
    makeChange: () => actSync(() => stateContainerRef.current?.makeChange()),
    save: async () => {
      await actAsync(async () => {
        await stateContainerRef.current?.save();
      });
    },
    reset: () => actSync(() => stateContainerRef.current?.reset()),
    attemptNavigate: () => actSync(() => stateContainerRef.current?.attemptNavigate() ?? true),
  };
}
