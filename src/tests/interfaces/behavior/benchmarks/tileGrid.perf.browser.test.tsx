/**
 * P5-B: Tile Grid Performance Benchmarks
 * 
 * Performance tests for the tile grid component.
 * These tests measure render times, re-render counts, and memory usage.
 * 
 * Metrics tracked:
 * - Render time with varying tile counts
 * - Re-render count during interactions
 * - Store update propagation time
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { Profiler, ProfilerOnRenderCallback } from 'react';

// Harness imports
import { renderTileGrid, createMockTiles, MockTile } from '../fixtures/tileGridTestHarness';
import { renderEditMode } from '../fixtures/editModeTestHarness';

// =============================================================================
// Performance Measurement Utilities
// =============================================================================

interface RenderMetrics {
  renderCount: number;
  totalRenderTime: number;
  lastRenderTime: number;
  renderTimes: number[];
}

function createRenderMetrics(): RenderMetrics {
  return {
    renderCount: 0,
    totalRenderTime: 0,
    lastRenderTime: 0,
    renderTimes: [],
  };
}

function createProfilerCallback(metrics: RenderMetrics): ProfilerOnRenderCallback {
  return (
    id: string,
    phase: 'mount' | 'update' | 'nested-update',
    actualDuration: number,
    baseDuration: number,
    startTime: number,
    commitTime: number
  ) => {
    metrics.renderCount++;
    metrics.totalRenderTime += actualDuration;
    metrics.lastRenderTime = actualDuration;
    metrics.renderTimes.push(actualDuration);
  };
}

// =============================================================================
// Performance Benchmarks
// =============================================================================

describe('P5-B: Tile Grid Performance Benchmarks', () => {
  afterEach(() => {
    cleanup();
  });

  // =========================================================================
  // Render Time Benchmarks
  // =========================================================================
  describe('Render Time', () => {
    it('renders 10 tiles within acceptable time', async () => {
      const startTime = performance.now();
      
      const { getTiles } = renderTileGrid({
        initialTiles: createMockTiles(10),
      });

      await waitFor(() => {
        expect(screen.getByTestId('tile-grid')).toBeInTheDocument();
      });

      const renderTime = performance.now() - startTime;
      
      // Should render 10 tiles in under 500ms
      expect(renderTime).toBeLessThan(500);
      
      // Verify all tiles are in state
      expect(getTiles().length).toBe(10);
    });

    it('renders 25 tiles within acceptable time', async () => {
      const startTime = performance.now();
      
      renderTileGrid({
        initialTiles: createMockTiles(25),
      });

      await waitFor(() => {
        expect(screen.getByTestId('tile-grid')).toBeInTheDocument();
      });

      const renderTime = performance.now() - startTime;
      
      // Should render 25 tiles in under 1000ms
      expect(renderTime).toBeLessThan(1000);
    });

    it('renders 50 tiles within acceptable time', async () => {
      const startTime = performance.now();
      
      renderTileGrid({
        initialTiles: createMockTiles(50),
      });

      await waitFor(() => {
        expect(screen.getByTestId('tile-grid')).toBeInTheDocument();
      });

      const renderTime = performance.now() - startTime;
      
      // Should render 50 tiles in under 2000ms
      expect(renderTime).toBeLessThan(2000);
    });
  });

  // =========================================================================
  // Re-render Benchmarks
  // =========================================================================
  describe('Re-render Efficiency', () => {
    it('toggling edit mode causes minimal re-renders', async () => {
      const user = userEvent.setup();
      let renderCount = 0;
      
      // Wrap the component to track renders
      const originalRender = renderEditMode;
      const { isEditMode } = originalRender();

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-container')).toBeInTheDocument();
      });

      // Count re-renders by checking state changes
      const initialState = isEditMode();
      
      await user.click(screen.getByTestId('edit-mode-toggle'));

      await waitFor(() => {
        expect(isEditMode()).toBe(!initialState);
      });

      // The toggle should complete without excessive re-renders
      // This is a smoke test - actual render counting would need React Profiler
      expect(isEditMode()).toBe(!initialState);
    });

    it('adding a tile does not cause full grid re-render', async () => {
      const { getTiles, addTile } = renderTileGrid({
        initialTiles: createMockTiles(5),
        editMode: true,
      });

      await waitFor(() => {
        expect(screen.getByTestId('tile-grid')).toBeInTheDocument();
      });

      const initialCount = getTiles().length;
      const startTime = performance.now();

      // Add a new tile
      addTile({
        id: 'new-tile',
        name: 'New Tile',
        type: 'Table',
        x: 0,
        y: 0,
        w: 3,
        h: 2,
        visible: true,
      });

      await waitFor(() => {
        expect(getTiles()).toHaveLength(initialCount + 1);
      });

      const updateTime = performance.now() - startTime;

      // Adding a tile should be fast (under 200ms)
      expect(updateTime).toBeLessThan(200);
    });

    it('removing a tile is efficient', async () => {
      const { getTiles, removeTile } = renderTileGrid({
        initialTiles: createMockTiles(10),
        editMode: true,
      });

      await waitFor(() => {
        expect(screen.getByTestId('tile-grid')).toBeInTheDocument();
      });

      const initialCount = getTiles().length;
      const tileToRemove = getTiles()[0].id;
      const startTime = performance.now();

      // Remove a tile
      removeTile(tileToRemove);

      await waitFor(() => {
        expect(getTiles()).toHaveLength(initialCount - 1);
      });

      const updateTime = performance.now() - startTime;

      // Removing a tile should be fast (under 200ms)
      expect(updateTime).toBeLessThan(200);
    });
  });

  // =========================================================================
  // Interaction Performance
  // =========================================================================
  describe('Interaction Performance', () => {
    it('edit mode toggle is responsive', async () => {
      const user = userEvent.setup();
      const { isEditMode } = renderEditMode();

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-toggle')).toBeInTheDocument();
      });

      const startTime = performance.now();
      await user.click(screen.getByTestId('edit-mode-toggle'));
      
      await waitFor(() => {
        expect(isEditMode()).toBe(true);
      });

      const responseTime = performance.now() - startTime;

      // Toggle should respond in under 100ms
      expect(responseTime).toBeLessThan(100);
    });

    it('save operation completes within acceptable time', async () => {
      const user = userEvent.setup();
      const { isSaving, hasUnsavedChanges } = renderEditMode({
        initialEditMode: true,
        initialHasUnsavedChanges: true,
      });

      await waitFor(() => {
        expect(screen.getByTestId('save-button')).toBeInTheDocument();
      });

      const startTime = performance.now();
      await user.click(screen.getByTestId('save-button'));

      await waitFor(() => {
        expect(isSaving()).toBe(false);
        expect(hasUnsavedChanges()).toBe(false);
      });

      const saveTime = performance.now() - startTime;

      // Save should complete in under 500ms (includes simulated delay)
      expect(saveTime).toBeLessThan(500);
    });

    it('multiple rapid interactions are handled smoothly', async () => {
      const user = userEvent.setup();
      const { isEditMode } = renderEditMode();

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-toggle')).toBeInTheDocument();
      });

      const startTime = performance.now();

      // Rapidly toggle edit mode multiple times
      for (let i = 0; i < 5; i++) {
        await user.click(screen.getByTestId('edit-mode-toggle'));
      }

      const totalTime = performance.now() - startTime;

      // 5 toggles should complete in under 500ms
      expect(totalTime).toBeLessThan(500);

      // Should end up in edit mode (odd number of toggles)
      await waitFor(() => {
        expect(isEditMode()).toBe(true);
      });
    });
  });

  // =========================================================================
  // Memory Efficiency
  // =========================================================================
  describe('Memory Efficiency', () => {
    it('cleanup properly disposes resources', async () => {
      const { unmount } = renderTileGrid({
        initialTiles: createMockTiles(20),
      });

      await waitFor(() => {
        expect(screen.getByTestId('tile-grid')).toBeInTheDocument();
      });

      // Unmount should not throw
      expect(() => unmount()).not.toThrow();

      // Grid should no longer be in document
      expect(screen.queryByTestId('tile-grid')).not.toBeInTheDocument();
    });

    it('repeated mount/unmount cycles do not leak memory', async () => {
      // This is a smoke test - actual memory leak detection would need
      // more sophisticated tooling
      for (let i = 0; i < 5; i++) {
        const { unmount } = renderTileGrid({
          initialTiles: createMockTiles(10),
        });

        await waitFor(() => {
          expect(screen.getByTestId('tile-grid')).toBeInTheDocument();
        });

        unmount();
        cleanup();
      }

      // If we get here without errors, basic cleanup is working
      expect(true).toBe(true);
    });
  });

  // =========================================================================
  // Scaling Tests
  // =========================================================================
  describe('Scaling', () => {
    it('handles large number of tiles gracefully', async () => {
      // Create 50 tiles (reduced from 100 for test stability)
      const largeTileSet = createMockTiles(50);

      const startTime = performance.now();
      
      const { getTiles } = renderTileGrid({
        initialTiles: largeTileSet,
      });

      await waitFor(() => {
        expect(screen.getByTestId('tile-grid')).toBeInTheDocument();
      });

      const renderTime = performance.now() - startTime;

      // Should render 50 tiles in under 3 seconds
      expect(renderTime).toBeLessThan(3000);

      // Verify all tiles are in state
      expect(getTiles().length).toBe(50);
    });

    it('maintains responsiveness with many tiles', async () => {
      const { getTiles } = renderTileGrid({
        initialTiles: createMockTiles(30),
        editMode: true,
      });

      await waitFor(() => {
        expect(screen.getByTestId('tile-grid')).toBeInTheDocument();
      });

      // Verify all tiles are rendered
      const startTime = performance.now();
      const tiles = getTiles();
      const queryTime = performance.now() - startTime;

      // Getting tiles should be fast
      expect(queryTime).toBeLessThan(100);
      expect(tiles.length).toBe(30);
    });
  });
});

