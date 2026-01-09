import { useMemo } from 'react';
import { useStoreContext } from '../../providers/StoreProvider';
import { Tile } from '../../slices/selectors/tile';
import { useTileMeta, TileMetaActions } from './useTileMeta';
import { useTileData, TileDataActions } from './useTileData';
import { useTileUI, TileUIActions } from './useTileUI';
import { useTileItem } from './useTileItem';
import { useTableTile, TableActions } from './useTableTile';
import { usePlotTile, PlotActions } from './usePlotTile';
import { useViewTile, ViewActions } from './useViewTile';
import { useEditorTile, EditorActions } from './useEditorTile';
import { useTerminalTile, TerminalActions } from './useTerminalTile';
import { useShallow } from 'zustand/react/shallow';

/**
 * Default return value when no tile is specified
 */
export const DEFAULT_USE_TILE_RETURN = {
  tile: null,
  meta: null,
  data: null,
  ui: null,
  metaActions: null,
  dataActions: null,
  uiActions: null,
  itemActions: null,
  actions: null,
  exists: false,
  tileId: null,

  tableTile: null,
  plotTile: null,
  viewTile: null,
  editorTile: null,
  terminalTile: null,

  // Type specific properties and actions
  tableTileActions: null,
  plotTileActions: null,
  viewTileActions: null,
  editorTileActions: null,
  terminalTileActions: null,
};

/**
 * Interface for all tile-related actions
 */
export interface TileActions {
  // Basic tile management
  initTile: (initialState?: Partial<Tile>) => void;
  updateTile: (updates: Partial<Tile>) => void;
  removeTile: () => void;

  // Categorized actions
  meta: TileMetaActions;
  data: TileDataActions;
  ui: TileUIActions;

  // Type-specific actions
  tableTileActions?: TableActions;
  plotTileActions?: PlotActions;
  viewTileActions?: ViewActions;
  editorTileActions?: EditorActions;
  terminalTileActions?: TerminalActions;
}

/**
 * Custom hook to access all tile state and actions
 * @param tileIdOrName The ID or name of the tile to access
 * @param tabIdOrName The ID or name of the tab containing the tile
 * @returns Object containing all tile state, actions, and existence flag
 */
export function useTile(tileIdOrName: string | null, tabIdOrName?: string | null) {
  // Use specialized hooks for base tile data
  const { meta, metaActions, tileId, tileExists } = useTileMeta(tileIdOrName, tabIdOrName || null);

  const { data, dataActions } = useTileData(tileIdOrName, tabIdOrName || null);

  const { ui, uiActions } = useTileUI(tileIdOrName, tabIdOrName || null);

  // Get the item actions
  const { itemActions } = useTileItem(tileIdOrName, tabIdOrName || null);

  // Use type-specific hooks based on the tile type
  const {
    tableTile,
    tableTileActions,
    exists: tableExists,
  } = useTableTile(tileIdOrName, tabIdOrName || null);

  const {
    plotTile,
    plotTileActions,
    exists: plotExists,
  } = usePlotTile(tileIdOrName, tabIdOrName || null);

  const {
    viewTile,
    viewTileActions,
    exists: viewExists,
  } = useViewTile(tileIdOrName, tabIdOrName || null);

  const {
    editorTile,
    editorTileActions,
    exists: editorExists,
  } = useEditorTile(tileIdOrName, tabIdOrName || null);

  const {
    terminalTile,
    terminalTileActions,
    exists: terminalExists,
  } = useTerminalTile(tileIdOrName, tabIdOrName || null);

  // Get active IDs from the store context
  const activeProjectId = useStoreContext((state) => state.activeProjectId);
  const activeInterfaceId = useStoreContext((state) => state.activeInterfaceId);
  const activeTabId = useStoreContext((state) => state.activeTabId);

  // Get store actions for core tile management
  const storeInitTile = useStoreContext((state) => state.initTile);
  const storeUpdateTile = useStoreContext((state) => state.updateTile);
  const storeRemoveTile = useStoreContext((state) => state.removeTile);

  // Get the tile type from the store
  const tileType = useStoreContext(
    useShallow((state) => {
      if (!tileId) return null;
      return state.tilesById[tileId]?.type;
    })
  );

  // Memoize all actions to prevent unnecessary re-renders
  const actions = useMemo<TileActions>(() => {
    const baseActions: TileActions = {
      // Basic tile management
      initTile: (initialState?: Partial<Tile>) => {
        if (activeTabId && tileId) {
          storeInitTile(activeTabId, tileId, {
            id: tileId,
            tabId: activeTabId,
            ...initialState,
          });
        }
      },

      updateTile: (updates: Partial<Tile>) => {
        if (tileId) {
          storeUpdateTile(tileId, updates);
        }
      },

      removeTile: () => {
        if (activeTabId && tileId) {
          storeRemoveTile(activeTabId, tileId);
        }
      },

      // Categorized actions
      meta: metaActions,
      data: dataActions,
      ui: uiActions,
      tableTileActions: tableTileActions as TableActions | undefined,
      plotTileActions: plotTileActions as PlotActions | undefined,
      viewTileActions: viewTileActions as ViewActions | undefined,
      editorTileActions: editorTileActions as EditorActions | undefined,
      terminalTileActions: terminalTileActions as TerminalActions | undefined,
    };

    return baseActions;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tileId,
    activeTabId,
    metaActions,
    dataActions,
    uiActions,
    storeInitTile,
    storeUpdateTile,
    storeRemoveTile,
    tileType,
    tableExists,
    tableTileActions,
    plotExists,
    plotTileActions,
    viewExists,
    viewTileActions,
    editorExists,
    editorTileActions,
    terminalExists,
    terminalTileActions,
  ]);

  // Build a final 'tile' object from the separate meta, data, and UI objects
  const combinedTile = useMemo(() => {
    if (!meta || !data || !ui) return null;

    // Create a base tile
    const baseTile = {
      ...meta,
      ...data,
      ...ui,
      tableTile,
      plotTile,
      viewTile,
      editorTile,
      terminalTile,
    } as Tile;

    return baseTile;
  }, [meta, data, ui, tableTile, plotTile, viewTile, editorTile, terminalTile]);

  // Use tileId to conditionally return values, but only after all hooks are called
  if (!tileIdOrName) {
    return DEFAULT_USE_TILE_RETURN;
  }

  return {
    tile: combinedTile,
    meta,
    data,
    ui,
    metaActions,
    dataActions,
    uiActions,
    itemActions,
    actions,
    exists: tileExists,
    tileId,

    // Include type-specific properties and actions for direct access
    tableTile: tableExists ? tableTile : null,
    plotTile: plotExists ? plotTile : null,
    viewTile: viewExists ? viewTile : null,
    editorTile: editorExists ? editorTile : null,
    terminalTile: terminalExists ? terminalTile : null,

    tableTileActions: tableExists ? tableTileActions : null,
    plotTileActions: plotExists ? plotTileActions : null,
    viewTileActions: viewExists ? viewTileActions : null,
    editorTileActions: editorExists ? editorTileActions : null,
    terminalTileActions: terminalExists ? terminalTileActions : null,
  };
}
