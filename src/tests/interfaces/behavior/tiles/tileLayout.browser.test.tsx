/**
 * P2-D: Tile Layout Behavior Tests
 *
 * Tests tile grid interactions using a representative test harness.
 * The harness exercises the same user interactions as the real tile grid
 * component but in isolation.
 *
 * Covers behaviors from BEHAVIORS.md:
 * - D1: Add tile
 * - D2: Select tile type
 * - D3: Move tile
 * - D4: Resize tile
 * - D5: Hide tile
 * - D6: Show hidden tile
 * - D7: Clone tile
 * - D8: Delete tile
 * - D9: Tile color
 */
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderTileGrid, createMockTiles, createMockTile } from '../fixtures/tileGridTestHarness';

// =============================================================================
// P2-D: Tile Layout
// =============================================================================

describe('P2-D: Tile Layout', () => {
  // =========================================================================
  // D1: Add tile
  // =========================================================================
  describe('D1: Add tile', () => {
    it('shows add tile button in edit mode', async () => {
      renderTileGrid({ editMode: true });

      await waitFor(() => {
        expect(screen.getByTestId('add-tile-button')).toBeInTheDocument();
      });
    });

    it('hides add tile button when not in edit mode', async () => {
      renderTileGrid({ editMode: false });

      await waitFor(() => {
        expect(screen.getByTestId('tile-grid-container')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('add-tile-button')).not.toBeInTheDocument();
    });

    it('clicking add tile button opens tile type overlay', async () => {
      const user = userEvent.setup();
      renderTileGrid({ editMode: true });

      await user.click(screen.getByTestId('add-tile-button'));

      await waitFor(() => {
        expect(screen.getByTestId('add-tile-overlay')).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // D2: Select tile type
  // =========================================================================
  describe('D2: Select tile type', () => {
    it('shows all tile type options in overlay', async () => {
      const user = userEvent.setup();
      renderTileGrid({ editMode: true });

      await user.click(screen.getByTestId('add-tile-button'));

      await waitFor(() => {
        expect(screen.getByTestId('select-tile-type-table')).toBeInTheDocument();
        expect(screen.getByTestId('select-tile-type-plot')).toBeInTheDocument();
      });
    });

    it('selecting Table type adds a Table tile', async () => {
      const user = userEvent.setup();
      const onAddTile = vi.fn();
      const { getTiles } = renderTileGrid({
        editMode: true,
        initialTiles: createMockTiles(2),
        callbacks: { onAddTile },
      });

      expect(getTiles()).toHaveLength(2);

      await user.click(screen.getByTestId('add-tile-button'));
      await user.click(screen.getByTestId('select-tile-type-table'));

      await waitFor(() => {
        expect(getTiles()).toHaveLength(3);
        expect(getTiles().some((t) => t.type === 'Table' && t.name.includes('New'))).toBe(true);
      });

      expect(onAddTile).toHaveBeenCalledWith('Table');
    });

    it('selecting Plot type adds a Plot tile', async () => {
      const user = userEvent.setup();
      const onAddTile = vi.fn();
      const { getTiles } = renderTileGrid({
        editMode: true,
        initialTiles: [],
        callbacks: { onAddTile },
      });

      await user.click(screen.getByTestId('add-tile-button'));
      await user.click(screen.getByTestId('select-tile-type-plot'));

      await waitFor(() => {
        expect(getTiles()).toHaveLength(1);
        expect(getTiles()[0].type).toBe('Plot');
      });

      expect(onAddTile).toHaveBeenCalledWith('Plot');
    });

    it('closes overlay after selecting tile type', async () => {
      const user = userEvent.setup();
      renderTileGrid({ editMode: true });

      await user.click(screen.getByTestId('add-tile-button'));

      await waitFor(() => {
        expect(screen.getByTestId('add-tile-overlay')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('select-tile-type-table'));

      await waitFor(() => {
        expect(screen.queryByTestId('add-tile-overlay')).not.toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // D3: Move tile (basic tests - full DnD is complex)
  // =========================================================================
  describe('D3: Move tile', () => {
    it('shows drag handle in edit mode', async () => {
      renderTileGrid({
        editMode: true,
        initialTiles: [createMockTile('test-tile', 'Table')],
      });

      await waitFor(() => {
        expect(screen.getByTestId('drag-handle-test-tile')).toBeInTheDocument();
      });
    });

    it('hides drag handle when not in edit mode', async () => {
      renderTileGrid({
        editMode: false,
        initialTiles: [createMockTile('test-tile', 'Table')],
      });

      await waitFor(() => {
        expect(screen.getByTestId('tile-test-tile')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('drag-handle-test-tile')).not.toBeInTheDocument();
    });

    it('tile has position data', async () => {
      const { getTile } = renderTileGrid({
        initialTiles: [createMockTile('test-tile', 'Table', { x: 2, y: 3 })],
      });

      await waitFor(() => {
        expect(screen.getByTestId('tile-test-tile')).toBeInTheDocument();
      });

      const tile = getTile('test-tile');
      expect(tile?.position.x).toBe(2);
      expect(tile?.position.y).toBe(3);
    });
  });

  // =========================================================================
  // D4: Resize tile
  // =========================================================================
  describe('D4: Resize tile', () => {
    it('shows resize handle in edit mode', async () => {
      renderTileGrid({
        editMode: true,
        initialTiles: [createMockTile('test-tile', 'Table')],
      });

      await waitFor(() => {
        expect(screen.getByTestId('resize-handle-test-tile')).toBeInTheDocument();
      });
    });

    it('hides resize handle when not in edit mode', async () => {
      renderTileGrid({
        editMode: false,
        initialTiles: [createMockTile('test-tile', 'Table')],
      });

      await waitFor(() => {
        expect(screen.getByTestId('tile-test-tile')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('resize-handle-test-tile')).not.toBeInTheDocument();
    });

    it('tile has size data', async () => {
      const { getTile } = renderTileGrid({
        initialTiles: [createMockTile('test-tile', 'Table', { width: 8, height: 6 })],
      });

      await waitFor(() => {
        expect(screen.getByTestId('tile-test-tile')).toBeInTheDocument();
      });

      const tile = getTile('test-tile');
      expect(tile?.position.width).toBe(8);
      expect(tile?.position.height).toBe(6);
    });
  });

  // =========================================================================
  // D5: Hide tile
  // =========================================================================
  describe('D5: Hide tile', () => {
    it('clicking hide button hides the tile', async () => {
      const user = userEvent.setup();
      const onHideTile = vi.fn();
      const { getVisibleTiles, getHiddenTiles } = renderTileGrid({
        editMode: true,
        initialTiles: createMockTiles(3),
        callbacks: { onHideTile },
      });

      expect(getVisibleTiles()).toHaveLength(3);
      expect(getHiddenTiles()).toHaveLength(0);

      await user.click(screen.getByTestId('hide-button-tile-1'));

      await waitFor(() => {
        expect(getVisibleTiles()).toHaveLength(2);
        expect(getHiddenTiles()).toHaveLength(1);
      });

      expect(onHideTile).toHaveBeenCalledWith('tile-1');
    });

    it('hidden tile appears in hidden tiles panel', async () => {
      const user = userEvent.setup();
      renderTileGrid({
        editMode: true,
        initialTiles: createMockTiles(2),
      });

      await user.click(screen.getByTestId('hide-button-tile-1'));

      await waitFor(() => {
        expect(screen.getByTestId('hidden-tiles-panel')).toBeInTheDocument();
        expect(screen.getByTestId('hidden-tile-tile-1')).toBeInTheDocument();
      });
    });

    it('hidden tile is not visible in grid', async () => {
      const user = userEvent.setup();
      renderTileGrid({
        editMode: true,
        initialTiles: createMockTiles(2),
      });

      await user.click(screen.getByTestId('hide-button-tile-1'));

      await waitFor(() => {
        expect(screen.queryByTestId('tile-tile-1')).not.toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // D6: Show hidden tile
  // =========================================================================
  describe('D6: Show hidden tile', () => {
    it('clicking show button restores the tile', async () => {
      const user = userEvent.setup();
      const onShowTile = vi.fn();
      const { getVisibleTiles, getHiddenTiles } = renderTileGrid({
        editMode: true,
        initialTiles: createMockTiles(2),
        callbacks: { onShowTile },
      });

      // First hide a tile
      await user.click(screen.getByTestId('hide-button-tile-1'));

      await waitFor(() => {
        expect(getHiddenTiles()).toHaveLength(1);
      });

      // Then show it
      await user.click(screen.getByTestId('show-button-tile-1'));

      await waitFor(() => {
        expect(getVisibleTiles()).toHaveLength(2);
        expect(getHiddenTiles()).toHaveLength(0);
      });

      expect(onShowTile).toHaveBeenCalledWith('tile-1');
    });

    it('restored tile appears in grid', async () => {
      const user = userEvent.setup();
      renderTileGrid({
        editMode: true,
        initialTiles: createMockTiles(2),
      });

      await user.click(screen.getByTestId('hide-button-tile-1'));

      await waitFor(() => {
        expect(screen.queryByTestId('tile-tile-1')).not.toBeInTheDocument();
      });

      await user.click(screen.getByTestId('show-button-tile-1'));

      await waitFor(() => {
        expect(screen.getByTestId('tile-tile-1')).toBeInTheDocument();
      });
    });

    it('hidden tiles panel disappears when all tiles shown', async () => {
      const user = userEvent.setup();
      renderTileGrid({
        editMode: true,
        initialTiles: createMockTiles(2),
      });

      await user.click(screen.getByTestId('hide-button-tile-1'));

      await waitFor(() => {
        expect(screen.getByTestId('hidden-tiles-panel')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('show-button-tile-1'));

      await waitFor(() => {
        expect(screen.queryByTestId('hidden-tiles-panel')).not.toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // D7: Clone tile
  // =========================================================================
  describe('D7: Clone tile', () => {
    it('clicking clone button creates a copy', async () => {
      const user = userEvent.setup();
      const onCloneTile = vi.fn();
      const { getTiles } = renderTileGrid({
        editMode: true,
        initialTiles: [createMockTile('original', 'Table')],
        callbacks: { onCloneTile },
      });

      expect(getTiles()).toHaveLength(1);

      await user.click(screen.getByTestId('clone-button-original'));

      await waitFor(() => {
        expect(getTiles()).toHaveLength(2);
        expect(getTiles().some((t) => t.name.includes('_copy'))).toBe(true);
      });

      expect(onCloneTile).toHaveBeenCalledWith('original');
    });

    it('cloned tile has same type as original', async () => {
      const user = userEvent.setup();
      const { getTiles } = renderTileGrid({
        editMode: true,
        initialTiles: [createMockTile('original', 'Plot')],
      });

      await user.click(screen.getByTestId('clone-button-original'));

      await waitFor(() => {
        const cloned = getTiles().find((t) => t.name.includes('_copy'));
        expect(cloned?.type).toBe('Plot');
      });
    });

    it('cloned tile has offset position', async () => {
      const user = userEvent.setup();
      const { getTiles, getTile } = renderTileGrid({
        editMode: true,
        initialTiles: [createMockTile('original', 'Table', { x: 2, y: 3 })],
      });

      const originalTile = getTile('original');

      await user.click(screen.getByTestId('clone-button-original'));

      await waitFor(() => {
        const cloned = getTiles().find((t) => t.name.includes('_copy'));
        expect(cloned).toBeDefined();
        // Clone should be offset from original
        expect(cloned!.position.x).toBe(originalTile!.position.x + 1);
        expect(cloned!.position.y).toBe(originalTile!.position.y + 1);
      });
    });
  });

  // =========================================================================
  // D8: Delete tile
  // =========================================================================
  describe('D8: Delete tile', () => {
    it('clicking delete button removes the tile', async () => {
      const user = userEvent.setup();
      const onDeleteTile = vi.fn();
      const { getTiles } = renderTileGrid({
        editMode: true,
        initialTiles: createMockTiles(3),
        callbacks: { onDeleteTile },
      });

      expect(getTiles()).toHaveLength(3);

      await user.click(screen.getByTestId('delete-button-tile-2'));

      await waitFor(() => {
        expect(getTiles()).toHaveLength(2);
        expect(getTiles().some((t) => t.id === 'tile-2')).toBe(false);
      });

      expect(onDeleteTile).toHaveBeenCalledWith('tile-2');
    });

    it('deleted tile is removed from grid', async () => {
      const user = userEvent.setup();
      renderTileGrid({
        editMode: true,
        initialTiles: createMockTiles(2),
      });

      await user.click(screen.getByTestId('delete-button-tile-1'));

      await waitFor(() => {
        expect(screen.queryByTestId('tile-tile-1')).not.toBeInTheDocument();
      });
    });

    it('can delete all tiles', async () => {
      const user = userEvent.setup();
      const { getTiles } = renderTileGrid({
        editMode: true,
        initialTiles: createMockTiles(2),
      });

      await user.click(screen.getByTestId('delete-button-tile-1'));
      await user.click(screen.getByTestId('delete-button-tile-2'));

      await waitFor(() => {
        expect(getTiles()).toHaveLength(0);
      });
    });
  });

  // =========================================================================
  // D9: Tile color
  // =========================================================================
  describe('D9: Tile color', () => {
    it('clicking color button changes tile color', async () => {
      const user = userEvent.setup();
      const onChangeTileColor = vi.fn();
      const { getTile } = renderTileGrid({
        editMode: true,
        initialTiles: [createMockTile('test-tile', 'Table')],
        callbacks: { onChangeTileColor },
      });

      expect(getTile('test-tile')?.color).toBeUndefined();

      await user.click(screen.getByTestId('color-button-test-tile'));

      await waitFor(() => {
        expect(getTile('test-tile')?.color).toBe('#ffebee');
      });

      expect(onChangeTileColor).toHaveBeenCalledWith('test-tile', '#ffebee');
    });

    it('color cycles through options on repeated clicks', async () => {
      const user = userEvent.setup();
      const { getTile } = renderTileGrid({
        editMode: true,
        initialTiles: [createMockTile('test-tile', 'Table')],
      });

      const colorButton = screen.getByTestId('color-button-test-tile');

      await user.click(colorButton);
      expect(getTile('test-tile')?.color).toBe('#ffebee');

      await user.click(colorButton);
      expect(getTile('test-tile')?.color).toBe('#e3f2fd');

      await user.click(colorButton);
      expect(getTile('test-tile')?.color).toBe('#e8f5e9');

      await user.click(colorButton);
      expect(getTile('test-tile')?.color).toBe('#fff3e0');

      await user.click(colorButton);
      expect(getTile('test-tile')?.color).toBeUndefined();
    });
  });

  // =========================================================================
  // Edit Mode
  // =========================================================================
  describe('Edit Mode', () => {
    it('edit mode toggle button is visible', async () => {
      renderTileGrid();

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-toggle')).toBeInTheDocument();
      });
    });

    it('clicking toggle enters edit mode', async () => {
      const user = userEvent.setup();
      const { isEditMode } = renderTileGrid({ editMode: false });

      expect(isEditMode()).toBe(false);

      await user.click(screen.getByTestId('edit-mode-toggle'));

      await waitFor(() => {
        expect(isEditMode()).toBe(true);
      });
    });

    it('clicking toggle exits edit mode', async () => {
      const user = userEvent.setup();
      const { isEditMode } = renderTileGrid({ editMode: true });

      expect(isEditMode()).toBe(true);

      await user.click(screen.getByTestId('edit-mode-toggle'));

      await waitFor(() => {
        expect(isEditMode()).toBe(false);
      });
    });

    it('edit controls appear in edit mode', async () => {
      const user = userEvent.setup();
      renderTileGrid({
        editMode: false,
        initialTiles: [createMockTile('test-tile', 'Table')],
      });

      // Not in edit mode - no controls
      expect(screen.queryByTestId('delete-button-test-tile')).not.toBeInTheDocument();
      expect(screen.queryByTestId('clone-button-test-tile')).not.toBeInTheDocument();

      // Enter edit mode
      await user.click(screen.getByTestId('edit-mode-toggle'));

      await waitFor(() => {
        expect(screen.getByTestId('delete-button-test-tile')).toBeInTheDocument();
        expect(screen.getByTestId('clone-button-test-tile')).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================
  describe('Edge cases', () => {
    it('handles empty grid', async () => {
      const { getTiles } = renderTileGrid({ initialTiles: [] });

      await waitFor(() => {
        expect(screen.getByTestId('tile-grid-container')).toBeInTheDocument();
      });

      expect(getTiles()).toHaveLength(0);
    });

    it('handles many tiles', async () => {
      const manyTiles = createMockTiles(20);
      const { getTiles } = renderTileGrid({ initialTiles: manyTiles });

      await waitFor(() => {
        expect(screen.getByTestId('tile-grid-container')).toBeInTheDocument();
      });

      expect(getTiles()).toHaveLength(20);
    });

    it('displays tile count correctly', async () => {
      renderTileGrid({ initialTiles: createMockTiles(5) });

      await waitFor(() => {
        expect(screen.getByText(/5 tiles visible/)).toBeInTheDocument();
      });
    });

    it('displays hidden tile count', async () => {
      const user = userEvent.setup();
      renderTileGrid({
        editMode: true,
        initialTiles: createMockTiles(5),
      });

      await user.click(screen.getByTestId('hide-button-tile-1'));
      await user.click(screen.getByTestId('hide-button-tile-2'));

      await waitFor(() => {
        expect(screen.getByText(/3 tiles visible/)).toBeInTheDocument();
        expect(screen.getByText(/2 hidden/)).toBeInTheDocument();
      });
    });

    it('tiles render with correct type indicator', async () => {
      renderTileGrid({
        initialTiles: [createMockTile('table-tile', 'Table'), createMockTile('plot-tile', 'Plot')],
      });

      await waitFor(() => {
        const tableTile = screen.getByTestId('tile-table-tile');
        const plotTile = screen.getByTestId('tile-plot-tile');

        expect(tableTile).toHaveAttribute('data-tile-type', 'Table');
        expect(plotTile).toHaveAttribute('data-tile-type', 'Plot');
      });
    });
  });
});
