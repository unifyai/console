/**
 * Tile Grid Test Harness
 *
 * A reusable wrapper that provides all the mocking and state management
 * needed to test tile layout behaviors in isolation.
 *
 * Uses REAL components:
 * - Zustand store for all tile/tab state management
 * - useTilesFromTab hook to get tiles from store
 * - useGlobalUIMode hook for edit mode state
 * - initTile/initTab selectors for state initialization
 * - Store actions for tile CRUD operations
 *
 * Mock view layer (DnD) is used to avoid react-grid-layout complexity in tests.
 */
import React, { useState, useCallback, useRef } from 'react';
import { render, RenderResult } from '@testing-library/react';
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  useSensor,
  useSensors,
  MouseSensor,
} from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { Plus, Trash2, Copy, EyeOff, Eye, Palette, Move } from 'lucide-react';

// Shared test utilities
import { useStateContainer } from '../utils';

// Real Store Imports
import {
  StoreProvider,
  useStoreApiContext,
  useStoreContext,
} from '../../../../contexts/providers/StoreProvider';
import { IStoreState } from '../../../../contexts/store';
import { useTilesFromTab } from '../../../../contexts/hooks/useStore';
import { initTile, Tile, TileType, TilePosition } from '../../../../contexts/slices/selectors/tile';
import { initTab } from '../../../../contexts/slices/selectors/tab';
import { useGlobalUIMode } from '../../../../contexts/hooks/useGlobalUIMode';

// =============================================================================
// Constants
// =============================================================================

const TAB_ID = 'test-tab';

// =============================================================================
// Types
// =============================================================================

// Use the real Tile type where possible, or map to it
export type { TileType, TilePosition };
export type MockTile = Tile;

export interface TileGridCallbacks {
  onAddTile?: (type: TileType) => void;
  onMoveTile?: (tileId: string, newPosition: TilePosition) => void;
  onResizeTile?: (tileId: string, newPosition: TilePosition) => void;
  onDeleteTile?: (tileId: string) => void;
  onHideTile?: (tileId: string) => void;
  onShowTile?: (tileId: string) => void;
  onCloneTile?: (tileId: string) => void;
  onChangeTileColor?: (tileId: string, color: string) => void;
}

export interface TileGridTestOptions {
  /** Initial tiles */
  initialTiles?: Partial<Tile>[];
  /** Whether edit mode is enabled */
  editMode?: boolean;
  /** Callbacks for actions */
  callbacks?: TileGridCallbacks;
  /** Grid columns */
  columns?: number;
  /** Grid row height */
  rowHeight?: number;
}

export interface TileGridTestResult extends RenderResult {
  /** Get all tiles */
  getTiles: () => Tile[];
  /** Get visible tiles */
  getVisibleTiles: () => Tile[];
  /** Get hidden tiles */
  getHiddenTiles: () => Tile[];
  /** Get a specific tile by ID */
  getTile: (id: string) => Tile | undefined;
  /** Check if edit mode is active */
  isEditMode: () => boolean;
  /** Toggle edit mode */
  toggleEditMode: () => void;
  /** Programmatically add a tile */
  addTile: (tile: Partial<Tile>) => void;
  /** Programmatically remove a tile */
  removeTile: (tileId: string) => void;
}

// =============================================================================
// Mock Data Factories
// =============================================================================

/**
 * Creates mock tile data with default positions.
 */
export function createMockTiles(count: number = 4): Partial<Tile>[] {
  const types: TileType[] = ['Table', 'Plot', 'Editor', 'Terminal'];

  return Array.from({ length: count }, (_, i) => ({
    id: `tile-${i + 1}`,
    name: `${types[i % types.length]} ${i + 1}`,
    type: types[i % types.length],
    position: {
      x: (i % 2) * 6,
      y: Math.floor(i / 2) * 4,
      width: 6,
      height: 4,
    },
    visible: true, // Map 'hidden' concept to real 'visible' property
  }));
}

/**
 * Creates a single mock tile.
 */
export function createMockTile(
  id: string,
  type: TileType,
  position: Partial<TilePosition> = {}
): Partial<Tile> {
  return {
    id,
    name: `${type} Tile`,
    type,
    position: {
      x: position.x ?? 0,
      y: position.y ?? 0,
      width: position.width ?? 6,
      height: position.height ?? 4,
    },
    visible: true,
  };
}

// =============================================================================
// Internal State Container
// =============================================================================

interface StateContainer {
  getTiles: () => Tile[];
  getVisibleTiles: () => Tile[];
  getHiddenTiles: () => Tile[];
  getTile: (id: string) => Tile | undefined;
  isEditMode: () => boolean;
  toggleEditMode: () => void;
  addTile: (tile: Partial<Tile>) => void;
  removeTile: (tileId: string) => void;
}

// =============================================================================
// Draggable Tile Component (View Layer Mock)
// =============================================================================

interface DraggableTileProps {
  tile: Tile;
  editMode: boolean;
  columns: number;
  rowHeight: number;
  onDelete: (tileId: string) => void;
  onHide: (tileId: string) => void;
  onClone: (tileId: string) => void;
  onChangeColor: (tileId: string) => void;
}

function DraggableTile({
  tile,
  editMode,
  columns,
  rowHeight,
  onDelete,
  onHide,
  onClone,
  onChangeColor,
}: DraggableTileProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: tile.id,
    disabled: !editMode,
  });

  const cellWidth = 100 / columns;
  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${tile.position.x * cellWidth}%`,
    top: `${tile.position.y * rowHeight}px`,
    width: `${tile.position.width * cellWidth}%`,
    height: `${tile.position.height * rowHeight}px`,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
    transition: isDragging ? 'none' : 'all 0.2s ease',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`overflow-hidden rounded-lg border bg-white shadow-sm ${
        editMode ? 'ring-2 ring-blue-300' : ''
      }`}
      data-testid={`tile-${tile.id}`}
      data-tile-type={tile.type}
    >
      {/* Tile Header */}
      <div
        className="flex items-center justify-between border-b bg-gray-50 px-3 py-2"
        style={{ backgroundColor: tile.color }}
      >
        <div className="flex items-center gap-2">
          {editMode && (
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab rounded p-1 hover:bg-gray-200"
              aria-label={`Drag ${tile.name}`}
              data-testid={`drag-handle-${tile.id}`}
            >
              <Move className="h-4 w-4 text-gray-500" />
            </button>
          )}
          <span className="truncate text-sm font-medium">{tile.name}</span>
          <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-500">
            {tile.type}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {editMode && (
            <>
              <button
                onClick={() => onChangeColor(tile.id)}
                className="rounded p-1 hover:bg-gray-200"
                aria-label={`Change color of ${tile.name}`}
                data-testid={`color-button-${tile.id}`}
              >
                <Palette className="h-4 w-4" />
              </button>
              <button
                onClick={() => onClone(tile.id)}
                className="rounded p-1 hover:bg-gray-200"
                aria-label={`Clone ${tile.name}`}
                data-testid={`clone-button-${tile.id}`}
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                onClick={() => onHide(tile.id)}
                className="rounded p-1 hover:bg-gray-200"
                aria-label={`Hide ${tile.name}`}
                data-testid={`hide-button-${tile.id}`}
              >
                <EyeOff className="h-4 w-4" />
              </button>
              <button
                onClick={() => onDelete(tile.id)}
                className="rounded p-1 text-red-600 hover:bg-red-100"
                aria-label={`Delete ${tile.name}`}
                data-testid={`delete-button-${tile.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tile Content */}
      <div className="h-full p-3" data-testid={`tile-content-${tile.id}`}>
        <div className="text-sm text-gray-400">{tile.type} content placeholder</div>
      </div>

      {/* Resize Handle (only in edit mode) */}
      {editMode && (
        <div
          className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize rounded-tl bg-blue-500"
          aria-label={`Resize ${tile.name}`}
          data-testid={`resize-handle-${tile.id}`}
        />
      )}
    </div>
  );
}

// =============================================================================
// Hidden Tiles Panel
// =============================================================================

interface HiddenTilesPanelProps {
  tiles: Tile[];
  onShow: (tileId: string) => void;
}

function HiddenTilesPanel({ tiles, onShow }: HiddenTilesPanelProps) {
  if (tiles.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 rounded-lg border bg-white p-3 shadow-lg"
      data-testid="hidden-tiles-panel"
    >
      <h4 className="mb-2 text-sm font-medium">Hidden Tiles ({tiles.length})</h4>
      <div className="space-y-1">
        {tiles.map((tile) => (
          <div
            key={tile.id}
            className="flex items-center justify-between gap-2 text-sm"
            data-testid={`hidden-tile-${tile.id}`}
          >
            <span>{tile.name}</span>
            <button
              onClick={() => onShow(tile.id)}
              className="rounded p-1 hover:bg-gray-100"
              aria-label={`Show ${tile.name}`}
              data-testid={`show-button-${tile.id}`}
            >
              <Eye className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Add Tile Overlay
// =============================================================================

interface AddTileOverlayProps {
  onSelect: (type: TileType) => void;
  onClose: () => void;
}

function AddTileOverlay({ onSelect, onClose }: AddTileOverlayProps) {
  const tileTypes: TileType[] = ['Table', 'Plot', 'Editor', 'Terminal'];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      data-testid="add-tile-overlay"
      onClick={onClose}
    >
      <div className="rounded-lg bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-semibold">Select Tile Type</h3>
        <div className="grid grid-cols-2 gap-3">
          {tileTypes.map((type) => (
            <button
              key={type}
              onClick={() => onSelect(type)}
              className="rounded-lg border p-4 text-center hover:bg-gray-50"
              data-testid={`select-tile-type-${type.toLowerCase()}`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Tile Grid Inner Component (Connected to Store)
// =============================================================================

interface TileGridInnerProps extends TileGridTestOptions {
  stateContainerRef: React.MutableRefObject<StateContainer | null>;
}

function TileGridInner({
  editMode: initialEditMode = false,
  callbacks = {},
  columns = 12,
  rowHeight = 100,
  stateContainerRef,
}: TileGridInnerProps) {
  const storeApi = useStoreApiContext();

  // Use REAL hook for Edit Mode (from Zustand store)
  const { isEditMode, toggleEditMode, setEditMode } = useGlobalUIMode();
  const editMode = isEditMode;

  const [showAddOverlay, setShowAddOverlay] = useState(false);

  // Access data using REAL hooks
  const tiles = useTilesFromTab(TAB_ID);

  // DnD sensors
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 8 } }));

  // ==========================================================================
  // Handlers (Now using Store Actions)
  // ==========================================================================

  const handleAddTile = useCallback(
    (type: TileType) => {
      const id = `tile-${Date.now()}`;
      const newTile: Partial<Tile> = {
        id,
        name: `New ${type}`,
        type,
        position: { x: 0, y: 0, width: 6, height: 4 },
        visible: true,
      };

      storeApi.getState().initTile(TAB_ID, id, newTile);
      setShowAddOverlay(false);
      callbacks.onAddTile?.(type);
    },
    [callbacks, storeApi]
  );

  const handleDeleteTile = useCallback(
    (tileId: string) => {
      storeApi.getState().removeTile(TAB_ID, tileId);
      callbacks.onDeleteTile?.(tileId);
    },
    [callbacks, storeApi]
  );

  const handleHideTile = useCallback(
    (tileId: string) => {
      storeApi.getState().updateTile(tileId, { visible: false });
      callbacks.onHideTile?.(tileId);
    },
    [callbacks, storeApi]
  );

  const handleShowTile = useCallback(
    (tileId: string) => {
      storeApi.getState().updateTile(tileId, { visible: true });
      callbacks.onShowTile?.(tileId);
    },
    [callbacks, storeApi]
  );

  const handleCloneTile = useCallback(
    (tileId: string) => {
      const original = tiles.find((t) => t.id === tileId);
      if (original) {
        const newId = `tile-${Date.now()}`;
        const clone: Partial<Tile> = {
          ...original,
          id: newId,
          name: `${original.name}_copy`,
          position: {
            ...original.position,
            x: original.position.x + 1,
            y: original.position.y + 1,
          },
        };
        storeApi.getState().initTile(TAB_ID, newId, clone);
        callbacks.onCloneTile?.(tileId);
      }
    },
    [tiles, callbacks, storeApi]
  );

  const handleChangeColor = useCallback(
    (tileId: string) => {
      const colors = ['#ffebee', '#e3f2fd', '#e8f5e9', '#fff3e0', undefined];
      const tile = tiles.find((t) => t.id === tileId);
      if (tile) {
        const currentIndex = colors.indexOf(tile.color);
        const nextColor = colors[(currentIndex + 1) % colors.length];
        storeApi.getState().updateTile(tileId, { color: nextColor });
        callbacks.onChangeTileColor?.(tileId, nextColor || '');
      }
    },
    [tiles, callbacks, storeApi]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, delta } = event;
      if (delta.x === 0 && delta.y === 0) return;

      const tile = tiles.find((t) => t.id === active.id);
      if (tile) {
        const newPosition = {
          ...tile.position,
          x: Math.max(0, Math.round(tile.position.x + delta.x / (100 / columns))),
          y: Math.max(0, Math.round(tile.position.y + delta.y / rowHeight)),
        };

        storeApi.getState().updateTile(tile.id, { position: newPosition });
        callbacks.onMoveTile?.(tile.id, newPosition);
      }
    },
    [columns, rowHeight, callbacks, tiles, storeApi]
  );

  // Derived state
  const visibleTiles = tiles.filter((t) => t.visible !== false);
  const hiddenTiles = tiles.filter((t) => t.visible === false);

  // ==========================================================================
  // Expose state to test via ref (using shared hook)
  // ==========================================================================

  useStateContainer(
    stateContainerRef,
    () => ({
      getTiles: () => tiles,
      getVisibleTiles: () => visibleTiles,
      getHiddenTiles: () => hiddenTiles,
      getTile: (id: string) => tiles.find((t) => t.id === id),
      isEditMode: () => editMode,
      toggleEditMode: () => toggleEditMode(),
      addTile: (tile: Partial<Tile>) => storeApi.getState().initTile(TAB_ID, tile.id!, tile),
      removeTile: (tileId: string) => storeApi.getState().removeTile(TAB_ID, tileId),
    }),
    [tiles, visibleTiles, hiddenTiles, editMode, toggleEditMode, storeApi]
  );

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <div data-testid="tile-grid-container" className="relative min-h-[600px] w-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b bg-gray-50 p-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleEditMode()} // Use REAL toggle from useGlobalUIMode
            className={`rounded px-3 py-1.5 text-sm ${
              editMode ? 'bg-blue-500 text-white' : 'bg-gray-200'
            }`}
            data-testid="edit-mode-toggle"
          >
            {editMode ? 'Exit Edit Mode' : 'Edit Layout'}
          </button>
          {editMode && (
            <button
              onClick={() => setShowAddOverlay(true)}
              className="flex items-center gap-1 rounded bg-green-500 px-3 py-1.5 text-sm text-white"
              data-testid="add-tile-button"
            >
              <Plus className="h-4 w-4" />
              Add Tile
            </button>
          )}
        </div>
        <div className="text-sm text-gray-500">
          {visibleTiles.length} tiles visible
          {hiddenTiles.length > 0 && `, ${hiddenTiles.length} hidden`}
        </div>
      </div>

      {/* Grid */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="relative w-full" style={{ minHeight: '500px' }} data-testid="tile-grid">
          {visibleTiles.map((tile) => (
            <DraggableTile
              key={tile.id}
              tile={tile}
              editMode={editMode}
              columns={columns}
              rowHeight={rowHeight}
              onDelete={handleDeleteTile}
              onHide={handleHideTile}
              onClone={handleCloneTile}
              onChangeColor={handleChangeColor}
            />
          ))}
        </div>
      </DndContext>

      {/* Hidden Tiles Panel */}
      <HiddenTilesPanel tiles={hiddenTiles} onShow={handleShowTile} />

      {/* Add Tile Overlay */}
      {showAddOverlay && (
        <AddTileOverlay onSelect={handleAddTile} onClose={() => setShowAddOverlay(false)} />
      )}
    </div>
  );
}

// =============================================================================
// Main Export: renderTileGrid
// =============================================================================

/**
 * Helper to create initial store state with tabs, tiles, and edit mode
 */
function createInitialStoreState(
  initialTiles: Partial<Tile>[],
  initialEditMode: boolean
): Partial<IStoreState> {
  const tab = initTab(TAB_ID, { name: 'Test Tab' });

  const tilesById: Record<string, Tile> = {};
  const tileIds: string[] = [];

  initialTiles.forEach((t) => {
    if (t.id) {
      const tile = initTile(t.id, {
        ...t,
        visible: t.visible !== false, // ensure visibility
      });
      tilesById[t.id] = tile;
      tileIds.push(t.id);
    }
  });

  tab.tileIds = tileIds;

  return {
    activeTabId: TAB_ID,
    tabsById: {
      [TAB_ID]: tab,
    },
    tilesById,
    // Initialize REAL global edit mode state
    globalEditMode: initialEditMode,
  };
}

export function renderTileGrid(options: TileGridTestOptions = {}): TileGridTestResult {
  const stateContainerRef: React.MutableRefObject<StateContainer | null> = { current: null };
  const {
    initialTiles = createMockTiles(4),
    editMode: initialEditMode = false,
    ...innerOptions
  } = options;

  // Pre-calculate initial state (includes REAL global edit mode)
  const initialState = createInitialStoreState(initialTiles, initialEditMode);

  // Wrap with StoreProvider
  const renderResult = render(
    <StoreProvider initialState={initialState}>
      <TileGridInner
        {...innerOptions}
        editMode={initialEditMode}
        stateContainerRef={stateContainerRef}
      />
    </StoreProvider>
  );

  return {
    ...renderResult,
    getTiles: () => stateContainerRef.current?.getTiles() ?? [],
    getVisibleTiles: () => stateContainerRef.current?.getVisibleTiles() ?? [],
    getHiddenTiles: () => stateContainerRef.current?.getHiddenTiles() ?? [],
    getTile: (id) => stateContainerRef.current?.getTile(id),
    isEditMode: () => stateContainerRef.current?.isEditMode() ?? false,
    toggleEditMode: () => stateContainerRef.current?.toggleEditMode(),
    addTile: (tile) => stateContainerRef.current?.addTile(tile),
    removeTile: (tileId) => stateContainerRef.current?.removeTile(tileId),
  };
}
