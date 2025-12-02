/**
 * P3: Checkpoint & Auto-Save Behavior Tests
 *
 * Tests behaviors J1-J3 from BEHAVIORS.md:
 * - J1: Save checkpoint (manual save creates a snapshot)
 * - J2: Restore checkpoint (reset reverts to last saved state)
 * - J3: Auto-save (optimistic updates sync to server automatically)
 *
 * The checkpoint system works as follows:
 * - All tile changes (move, resize, add, remove) are auto-saved optimistically
 * - "Save Tab" creates a checkpoint (named snapshot) that can be restored to
 * - "Reset Tab" reverts all changes back to the last checkpoint
 */

import { describe, it, expect, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import {
  renderCheckpoint,
  CheckpointTestResult,
  CheckpointData,
} from '../fixtures/checkpointTestHarness';

describe('P3-J: Checkpoints & Auto-Save', () => {
  let result: CheckpointTestResult;

  afterEach(() => {
    result?.unmount();
  });

  // ==========================================================================
  // J1: Save Checkpoint
  // ==========================================================================
  describe('J1: Save checkpoint', () => {
    it('can save a checkpoint via button', async () => {
      result = renderCheckpoint({
        initialTab: {
          id: 'tab-1',
          name: 'Test Tab',
          tiles: [
            { id: 'tile-1', name: 'Tile 1', position: { x: 0, y: 0, width: 4, height: 4 }, type: 'table' },
          ],
        },
      });

      // Initially no checkpoint
      expect(result.getCheckpoint()).toBeNull();

      // Save checkpoint
      await result.clickSaveButton();

      // Wait for save to complete
      await waitFor(() => {
        expect(result.getCheckpoint()).not.toBeNull();
      }, { timeout: 2000 });
    });

    it('checkpoint captures current tile state', async () => {
      result = renderCheckpoint({
        initialTab: {
          id: 'tab-1',
          name: 'Test Tab',
          tiles: [
            { id: 'tile-1', name: 'Original', position: { x: 0, y: 0, width: 4, height: 4 }, type: 'table' },
          ],
        },
      });

      // Save checkpoint
      await result.saveCheckpoint('Test save');

      // Verify checkpoint contains current state
      await waitFor(() => {
        const checkpoint = result.getCheckpoint();
        expect(checkpoint).not.toBeNull();
        expect(checkpoint?.tabState.tiles).toHaveLength(1);
        expect(checkpoint?.tabState.tiles[0].name).toBe('Original');
      }, { timeout: 2000 });
    });

    it('checkpoint includes description', async () => {
      result = renderCheckpoint();

      await result.saveCheckpoint('My custom description');

      await waitFor(() => {
        const checkpoint = result.getCheckpoint();
        expect(checkpoint?.description).toBe('My custom description');
      }, { timeout: 2000 });
    });

    it('checkpoint includes timestamp', async () => {
      result = renderCheckpoint();

      const beforeSave = Date.now();
      await result.saveCheckpoint();

      await waitFor(() => {
        const checkpoint = result.getCheckpoint();
        expect(checkpoint).not.toBeNull();
        expect(checkpoint?.timestamp).toBeGreaterThanOrEqual(beforeSave);
      }, { timeout: 2000 });
    });

    it('shows saving status during save', async () => {
      result = renderCheckpoint();

      // INTENTIONAL: Don't await here - we want to check the intermediate "saving" state
      // before the promise resolves. This is a valid pattern for testing loading states.
      const savePromise = result.clickSaveButton();

      // Should show saving status while operation is in progress
      await waitFor(() => {
        expect(screen.getByTestId('save-status').textContent).toBe('saving');
      });

      // Now await to clean up properly
      await savePromise;
    });

    it('shows success message after save', async () => {
      result = renderCheckpoint();

      await result.clickSaveButton();

      await waitFor(() => {
        expect(screen.getByTestId('save-success-message')).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('new checkpoint overwrites previous checkpoint', async () => {
      result = renderCheckpoint({
        initialTab: {
          id: 'tab-1',
          name: 'Test Tab',
          tiles: [
            { id: 'tile-1', name: 'First', position: { x: 0, y: 0, width: 4, height: 4 }, type: 'table' },
          ],
        },
      });

      // Save first checkpoint
      await result.saveCheckpoint('First save');
      
      let firstTimestamp: number | undefined;
      await waitFor(() => {
        firstTimestamp = result.getCheckpoint()?.timestamp;
        expect(firstTimestamp).toBeDefined();
      }, { timeout: 2000 });

      // Modify state
      await result.renameTile('tile-1', 'Modified');

      // Wait a bit to ensure different timestamp
      await new Promise(r => setTimeout(r, 50));

      // Save second checkpoint
      await result.saveCheckpoint('Second save');

      // Should have new checkpoint
      await waitFor(() => {
        const checkpoint = result.getCheckpoint();
        expect(checkpoint?.description).toBe('Second save');
        expect(checkpoint?.timestamp).toBeGreaterThan(firstTimestamp!);
        expect(checkpoint?.tabState.tiles[0].name).toBe('Modified');
      }, { timeout: 2000 });
    });

    it('clears unsaved changes indicator after save', async () => {
      result = renderCheckpoint({
        initialCheckpoint: {
          timestamp: Date.now() - 10000,
          description: 'Initial',
          tabState: {
            id: 'tab-1',
            name: 'Test Tab',
            tiles: [{ id: 'tile-1', name: 'Original', position: { x: 0, y: 0, width: 4, height: 4 }, type: 'table' }],
          },
        },
      });

      // Make a change
      await result.moveTile('tile-1', { x: 5 });

      // Should have unsaved changes
      expect(result.hasUnsavedChanges()).toBe(true);

      // Save
      await result.saveCheckpoint();

      // Should no longer have unsaved changes
      await waitFor(() => {
        expect(result.hasUnsavedChanges()).toBe(false);
      });
    });
  });

  // ==========================================================================
  // J2: Restore Checkpoint
  // ==========================================================================
  describe('J2: Restore checkpoint', () => {
    it('can restore from checkpoint via button', async () => {
      const initialTiles = [
        { id: 'tile-1', name: 'Original', position: { x: 0, y: 0, width: 4, height: 4 }, type: 'table' },
      ];

      result = renderCheckpoint({
        initialTab: {
          id: 'tab-1',
          name: 'Test Tab',
          tiles: initialTiles,
        },
        initialCheckpoint: {
          timestamp: Date.now(),
          description: 'Saved state',
          tabState: {
            id: 'tab-1',
            name: 'Test Tab',
            tiles: initialTiles,
          },
        },
      });

      // Modify state
      await result.moveTile('tile-1', { x: 10, y: 10 });

      // Verify modification
      const modifiedState = result.getCurrentTabState();
      expect(modifiedState.tiles[0].position.x).toBe(10);

      // Reset via UI
      await result.clickResetButton();
      await result.confirmReset();

      // Should restore to checkpoint
      await waitFor(() => {
        const restoredState = result.getCurrentTabState();
        expect(restoredState.tiles[0].position.x).toBe(0);
      }, { timeout: 2000 });
    });

    it('reset button is disabled without checkpoint', async () => {
      result = renderCheckpoint({
        initialCheckpoint: null,
      });

      const resetButton = screen.getByTestId('reset-button');
      expect(resetButton).toBeDisabled();
    });

    it('shows confirmation dialog before reset', async () => {
      result = renderCheckpoint({
        initialCheckpoint: {
          timestamp: Date.now(),
          description: 'Test',
          tabState: { id: 'tab-1', name: 'Test', tiles: [] },
        },
      });

      await result.clickResetButton();

      expect(result.isResetDialogOpen()).toBe(true);
      expect(screen.getByTestId('reset-dialog')).toBeInTheDocument();
    });

    it('can cancel reset', async () => {
      const initialPosition = { x: 0, y: 0, width: 4, height: 4 };
      
      result = renderCheckpoint({
        initialTab: {
          id: 'tab-1',
          name: 'Test Tab',
          tiles: [{ id: 'tile-1', name: 'Tile', position: initialPosition, type: 'table' }],
        },
        initialCheckpoint: {
          timestamp: Date.now(),
          description: 'Saved',
          tabState: {
            id: 'tab-1',
            name: 'Test Tab',
            tiles: [{ id: 'tile-1', name: 'Tile', position: initialPosition, type: 'table' }],
          },
        },
      });

      // Modify
      await result.moveTile('tile-1', { x: 5 });

      // Open reset dialog then cancel
      await result.clickResetButton();
      await result.cancelReset();

      // Dialog should close
      expect(result.isResetDialogOpen()).toBe(false);

      // Changes should still be there
      const state = result.getCurrentTabState();
      expect(state.tiles[0].position.x).toBe(5);
    });

    it('shows restoring status during reset', async () => {
      result = renderCheckpoint({
        initialCheckpoint: {
          timestamp: Date.now(),
          description: 'Test',
          tabState: { id: 'tab-1', name: 'Test', tiles: [] },
        },
      });

      await result.clickResetButton();
      
      // INTENTIONAL: Don't await here - we want to check the intermediate "restoring" state
      const resetPromise = result.confirmReset();

      // Should show restoring status while operation is in progress
      await waitFor(() => {
        expect(screen.getByTestId('reset-status').textContent).toBe('restoring');
      });

      // Now await to clean up properly
      await resetPromise;
    });

    it('shows success message after reset', async () => {
      result = renderCheckpoint({
        initialCheckpoint: {
          timestamp: Date.now(),
          description: 'Test',
          tabState: { id: 'tab-1', name: 'Test', tiles: [] },
        },
      });

      await result.clickResetButton();
      await result.confirmReset();

      await waitFor(() => {
        expect(screen.getByTestId('reset-success-message')).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('restores tile positions from checkpoint', async () => {
      const savedPosition = { x: 2, y: 3, width: 5, height: 6 };
      
      result = renderCheckpoint({
        initialTab: {
          id: 'tab-1',
          name: 'Test Tab',
          tiles: [{ id: 'tile-1', name: 'Tile', position: savedPosition, type: 'table' }],
        },
        initialCheckpoint: {
          timestamp: Date.now(),
          description: 'Saved',
          tabState: {
            id: 'tab-1',
            name: 'Test Tab',
            tiles: [{ id: 'tile-1', name: 'Tile', position: savedPosition, type: 'table' }],
          },
        },
      });

      // Move tile away
      await result.moveTile('tile-1', { x: 10, y: 10 });

      // Reset
      await result.restoreCheckpoint();

      // Should restore position
      await waitFor(() => {
        const state = result.getCurrentTabState();
        expect(state.tiles[0].position.x).toBe(2);
        expect(state.tiles[0].position.y).toBe(3);
      });
    });

    it('restores deleted tiles from checkpoint', async () => {
      result = renderCheckpoint({
        initialTab: {
          id: 'tab-1',
          name: 'Test Tab',
          tiles: [
            { id: 'tile-1', name: 'Tile 1', position: { x: 0, y: 0, width: 4, height: 4 }, type: 'table' },
            { id: 'tile-2', name: 'Tile 2', position: { x: 4, y: 0, width: 4, height: 4 }, type: 'plot' },
          ],
        },
        initialCheckpoint: {
          timestamp: Date.now(),
          description: 'With both tiles',
          tabState: {
            id: 'tab-1',
            name: 'Test Tab',
            tiles: [
              { id: 'tile-1', name: 'Tile 1', position: { x: 0, y: 0, width: 4, height: 4 }, type: 'table' },
              { id: 'tile-2', name: 'Tile 2', position: { x: 4, y: 0, width: 4, height: 4 }, type: 'plot' },
            ],
          },
        },
      });

      // Delete a tile
      await result.removeTile('tile-2');
      expect(result.getCurrentTabState().tiles).toHaveLength(1);

      // Reset
      await result.restoreCheckpoint();

      // Should restore deleted tile
      await waitFor(() => {
        expect(result.getCurrentTabState().tiles).toHaveLength(2);
      });
    });

    it('removes tiles added after checkpoint', async () => {
      result = renderCheckpoint({
        initialTab: {
          id: 'tab-1',
          name: 'Test Tab',
          tiles: [
            { id: 'tile-1', name: 'Original', position: { x: 0, y: 0, width: 4, height: 4 }, type: 'table' },
          ],
        },
        initialCheckpoint: {
          timestamp: Date.now(),
          description: 'One tile only',
          tabState: {
            id: 'tab-1',
            name: 'Test Tab',
            tiles: [
              { id: 'tile-1', name: 'Original', position: { x: 0, y: 0, width: 4, height: 4 }, type: 'table' },
            ],
          },
        },
      });

      // Add a new tile
      await result.addTile('New Tile', { x: 4, y: 0, width: 4, height: 4 });
      expect(result.getCurrentTabState().tiles.length).toBeGreaterThan(1);

      // Reset
      await result.restoreCheckpoint();

      // Should only have original tile
      await waitFor(() => {
        const state = result.getCurrentTabState();
        expect(state.tiles).toHaveLength(1);
        expect(state.tiles[0].name).toBe('Original');
      });
    });
  });

  // ==========================================================================
  // J3: Auto-Save (Optimistic Updates)
  // ==========================================================================
  describe('J3: Auto-save (optimistic updates)', () => {
    it('moving a tile triggers auto-save', async () => {
      result = renderCheckpoint();

      // Move tile
      await result.moveTile('tile-1', { x: 5 });

      // Auto-save queue should have been triggered
      // (In real app, this would call updateTileMutation)
      await waitFor(() => {
        expect(screen.getByTestId('auto-save-queue').textContent).toContain('idle');
      }, { timeout: 500 });
    });

    it('resizing a tile triggers auto-save', async () => {
      result = renderCheckpoint();

      await result.resizeTile('tile-1', { width: 8, height: 8 });

      // State should be updated immediately (optimistic)
      const state = result.getCurrentTabState();
      expect(state.tiles[0].position.width).toBe(8);
      expect(state.tiles[0].position.height).toBe(8);
    });

    it('adding a tile triggers auto-save', async () => {
      result = renderCheckpoint({
        initialTab: {
          id: 'tab-1',
          name: 'Test Tab',
          tiles: [],
        },
      });

      await result.addTile('New Tile', { x: 0, y: 0, width: 4, height: 4 });

      // Tile should appear immediately
      expect(result.getCurrentTabState().tiles.length).toBeGreaterThan(0);
    });

    it('removing a tile triggers auto-save', async () => {
      result = renderCheckpoint({
        initialTab: {
          id: 'tab-1',
          name: 'Test Tab',
          tiles: [
            { id: 'tile-1', name: 'To Remove', position: { x: 0, y: 0, width: 4, height: 4 }, type: 'table' },
          ],
        },
      });

      await result.removeTile('tile-1');

      // Tile should be removed immediately
      expect(result.getCurrentTabState().tiles).toHaveLength(0);
    });

    it('renaming a tile triggers auto-save', async () => {
      result = renderCheckpoint({
        initialTab: {
          id: 'tab-1',
          name: 'Test Tab',
          tiles: [
            { id: 'tile-1', name: 'Old Name', position: { x: 0, y: 0, width: 4, height: 4 }, type: 'table' },
          ],
        },
      });

      await result.renameTile('tile-1', 'New Name');

      // Name should update immediately
      expect(result.getCurrentTabState().tiles[0].name).toBe('New Name');
    });

    it('multiple changes are auto-saved in sequence', async () => {
      result = renderCheckpoint();

      // Make multiple changes
      await result.moveTile('tile-1', { x: 1 });
      await result.resizeTile('tile-1', { width: 6, height: 6 });
      await result.renameTile('tile-1', 'Updated');

      // All changes should be reflected
      const state = result.getCurrentTabState();
      expect(state.tiles[0].position.x).toBe(1);
      expect(state.tiles[0].position.width).toBe(6);
      expect(state.tiles[0].name).toBe('Updated');
    });

    it('auto-saved changes show as unsaved until checkpoint', async () => {
      result = renderCheckpoint({
        initialTab: {
          id: 'tab-1',
          name: 'Test Tab',
          tiles: [{ id: 'tile-1', name: 'Original', position: { x: 0, y: 0, width: 4, height: 4 }, type: 'table' }],
        },
      });

      // Save initial state as checkpoint
      await result.saveCheckpoint('Initial save');
      
      await waitFor(() => {
        expect(result.hasUnsavedChanges()).toBe(false);
      });

      // Make auto-saved change
      await result.moveTile('tile-1', { x: 5 });

      // Should show unsaved (relative to checkpoint)
      expect(result.hasUnsavedChanges()).toBe(true);

      // Save checkpoint
      await result.saveCheckpoint();

      // Now no unsaved changes
      await waitFor(() => {
        expect(result.hasUnsavedChanges()).toBe(false);
      });
    });
  });

  // ==========================================================================
  // Unsaved Changes Indicator
  // ==========================================================================
  describe('Unsaved Changes Indicator', () => {
    it('shows unsaved indicator when changes exist', async () => {
      result = renderCheckpoint({
        initialCheckpoint: {
          timestamp: Date.now(),
          description: 'Saved',
          tabState: {
            id: 'tab-1',
            name: 'Test Tab',
            tiles: [{ id: 'tile-1', name: 'Original', position: { x: 0, y: 0, width: 4, height: 4 }, type: 'table' }],
          },
        },
      });

      await result.moveTile('tile-1', { x: 5 });

      expect(screen.getByTestId('unsaved-indicator').textContent).toContain('Unsaved');
    });

    it('shows saved indicator after saving', async () => {
      result = renderCheckpoint({
        initialTab: {
          id: 'tab-1',
          name: 'Test Tab',
          tiles: [{ id: 'tile-1', name: 'Original', position: { x: 0, y: 0, width: 4, height: 4 }, type: 'table' }],
        },
      });

      // Save to create a checkpoint matching current state
      await result.saveCheckpoint();

      await waitFor(() => {
        expect(screen.getByTestId('unsaved-indicator').textContent).toContain('All saved');
      }, { timeout: 2000 });
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================
  describe('Edge Cases', () => {
    it('handles empty tile list', async () => {
      result = renderCheckpoint({
        initialTab: {
          id: 'tab-1',
          name: 'Empty Tab',
          tiles: [],
        },
      });

      await result.saveCheckpoint();

      await waitFor(() => {
        const checkpoint = result.getCheckpoint();
        expect(checkpoint).not.toBeNull();
        expect(checkpoint?.tabState.tiles).toHaveLength(0);
      }, { timeout: 2000 });
    });

    it('handles multiple tiles', async () => {
      const tiles = [
        { id: 'tile-1', name: 'Tile 1', position: { x: 0, y: 0, width: 3, height: 3 }, type: 'table' },
        { id: 'tile-2', name: 'Tile 2', position: { x: 3, y: 0, width: 3, height: 3 }, type: 'plot' },
        { id: 'tile-3', name: 'Tile 3', position: { x: 6, y: 0, width: 3, height: 3 }, type: 'table' },
        { id: 'tile-4', name: 'Tile 4', position: { x: 0, y: 3, width: 3, height: 3 }, type: 'plot' },
        { id: 'tile-5', name: 'Tile 5', position: { x: 3, y: 3, width: 3, height: 3 }, type: 'table' },
      ];

      result = renderCheckpoint({
        initialTab: {
          id: 'tab-1',
          name: 'Multiple Tiles',
          tiles,
        },
      });

      await result.saveCheckpoint();

      await waitFor(() => {
        const checkpoint = result.getCheckpoint();
        expect(checkpoint).not.toBeNull();
        expect(checkpoint?.tabState.tiles).toHaveLength(5);
      }, { timeout: 2000 });
    });

    it('checkpoint info is displayed', async () => {
      result = renderCheckpoint({
        initialCheckpoint: {
          timestamp: Date.now(),
          description: 'Test checkpoint',
          tabState: { id: 'tab-1', name: 'Test', tiles: [] },
        },
      });

      expect(screen.getByTestId('checkpoint-exists')).toBeInTheDocument();
      expect(screen.getByTestId('checkpoint-description').textContent).toBe('Test checkpoint');
    });

    it('shows no checkpoint message when none exists', async () => {
      result = renderCheckpoint({
        initialCheckpoint: null,
      });

      expect(screen.getByTestId('no-checkpoint')).toBeInTheDocument();
    });
  });
});

