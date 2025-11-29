/**
 * Edit Mode Test Harness
 * 
 * A reusable wrapper for testing edit mode behaviors including
 * toggle, save, reset, and unsaved changes detection.
 * 
 * IMPROVED: Uses REAL Zustand store for global edit mode state.
 * Note: "Unsaved Changes" logic is currently mocked as it depends on 
 * specific implementation details (e.g. diffing state vs persisted) 
 * that are not yet centralized in the store.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { render, RenderResult } from '@testing-library/react';
import { flushSync } from 'react-dom';
import { Hammer, Save, RotateCcw, AlertTriangle, GripVertical } from 'lucide-react';

// Real Store Imports
import { StoreProvider, useStoreContext, useStoreApiContext } from '../../../../contexts/providers/StoreProvider';
import { useGlobalUIMode } from '../../../../contexts/hooks/useGlobalUIMode';
import { IStoreState } from '../../../../contexts/store';

// Act wrapper utilities for proper test state management
import { actSync, actAsync } from '../utils/actWrapper';

// =============================================================================
// Types
// =============================================================================

export interface EditModeCallbacks {
  onToggleEditMode?: (isEdit: boolean) => void;
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
}

function EditModeInner({
  initialHasUnsavedChanges = false,
  callbacks = {},
  saveSucceeds = true,
  tileCount = 3,
  stateContainerRef,
}: EditModeInnerProps) {
  // Use real hook for Edit Mode
  const { isEditMode, toggleEditMode, setEditMode } = useGlobalUIMode();
  
  // Mock "Unsaved Changes" state (as there is no central store selector for this yet)
  const [hasChanges, setHasChanges] = useState(initialHasUnsavedChanges);
  
  const [saving, setSaving] = useState(false);
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
    // We can't easily predict the next state here because toggle is async in terms of React updates,
    // but for the callback we can assume it toggles. 
    // Better to assume the consumer checks the state after.
    callbacks.onToggleEditMode?.(!isEditMode); 
  }, [isEditMode, toggleEditMode, callbacks]);

  const handleMakeChange = useCallback(() => {
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveSuccess(null);
    
    try {
      if (callbacks.onSave) {
        await callbacks.onSave();
      } else {
        // Simulate API delay with cleanup-safe promise
        await new Promise<void>((resolve) => {
          const timeoutId = setTimeout(() => resolve(), 100);
          // Return cleanup function for when component unmounts
          return () => clearTimeout(timeoutId);
        });
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
        setSaving(false);
      }
    }
  }, [callbacks, saveSucceeds]);

  const handleReset = useCallback(() => {
    setShowResetConfirm(false);
    setHasChanges(false);
    callbacks.onReset?.();
  }, [callbacks]);

  const handleAttemptNavigate = useCallback(() => {
    if (hasChanges) {
      // Use flushSync to ensure state updates are synchronous when called from tests
      flushSync(() => {
        setShowNavigateWarning(true);
      });
      return callbacks.onNavigateAway?.() ?? false;
    }
    return true;
  }, [hasChanges, callbacks]);

  // ==========================================================================
  // Expose state to test via ref
  // ==========================================================================

  // Update ref on every render
  useEffect(() => {
    stateContainerRef.current = {
      isEditMode: () => isEditMode,
      hasUnsavedChanges: () => hasChanges,
      isSaving: () => saving,
      toggleEditMode: handleToggleEditMode,
      makeChange: handleMakeChange,
      save: handleSave,
      reset: handleReset,
      attemptNavigate: handleAttemptNavigate,
    };
  });

  // Immediate ref for first render
  if (!stateContainerRef.current) {
    stateContainerRef.current = {
      isEditMode: () => isEditMode,
      hasUnsavedChanges: () => hasChanges,
      isSaving: () => saving,
      toggleEditMode: handleToggleEditMode,
      makeChange: handleMakeChange,
      save: handleSave,
      reset: handleReset,
      attemptNavigate: handleAttemptNavigate,
    };
  }

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
              disabled={saving || !hasChanges}
              className={`flex items-center gap-2 px-3 py-2 rounded ${
                hasChanges && !saving
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
              data-testid="save-button"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save'}
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

function createInitialStoreState(initialEditMode: boolean): Partial<IStoreState> {
  return {
    globalEditMode: initialEditMode
  };
}

export function renderEditMode(options: EditModeTestOptions = {}): EditModeTestResult {
  const stateContainerRef: React.MutableRefObject<StateContainer | null> = { current: null };
  const { initialEditMode = false, ...innerOptions } = options;

  const initialState = createInitialStoreState(initialEditMode);

  const renderResult = render(
    <StoreProvider initialState={initialState}>
      <EditModeInner {...innerOptions} stateContainerRef={stateContainerRef} />
    </StoreProvider>
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
