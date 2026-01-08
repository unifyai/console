import { current as immerCurrent, isDraft, WritableDraft } from 'immer';
import isEqual from 'fast-deep-equal';
import { Tile, TILE_KEYS } from '../slices/selectors/tile';
import { PLOT_TILE_KEYS, PlotTile } from '../slices/selectors/plotTile';
import { VIEW_TILE_KEYS, ViewTile } from '../slices/selectors/viewTile';
import { TABLE_TILE_KEYS, TableTile } from '../slices/selectors/tableTile';
import { EDITOR_TILE_KEYS, EditorTile } from '../slices/selectors/editorTile';
import { TERMINAL_TILE_KEYS, TerminalTile } from '../slices/selectors/terminalTile';
import { useRef } from 'react';
import { useEffect } from 'react';
import { StoreSlice, Tab } from '../slices/slice';
import {
  TileData,
  TableTileData,
  PlotTileData,
  ViewTileData,
  EditorTileData,
  TerminalTileData,
  TabData,
} from '@/types/interfaces/grid';

// Import the domain logic from selector files
import * as interfaceLogic from '../slices/selectors/interface';
import * as tabLogic from '../slices/selectors/tab';
import * as tileLogic from '../slices/selectors/tile';
import * as tableTileLogic from '../slices/selectors/tableTile';
import * as plotTileLogic from '../slices/selectors/plotTile';
import * as viewTileLogic from '../slices/selectors/viewTile';
import * as editorTileLogic from '../slices/selectors/editorTile';
import * as terminalTileLogic from '../slices/selectors/terminalTile';

/**
 * Utility to convert Tile state from zustand to TileData format for API operations
 * @param tile - The Tile object from the zustand store
 * @returns A partial TileData object suitable for API operations
 */
export function convertTileToTileData(tile: Tile): TileData {
  if (!tile) return {} as TileData;

  const tileData: TileData = {
    id: tile.id,
    tabId: tile.tabId || '',
    name: tile.name,
    type: tile.type || 'Table',
    position: tile.position || { x: 0, y: 0, width: 4, height: 4 },
    visible: tile.visible,
    locked: tile.locked,
    color: tile.color,
  };

  // Handle nullable fields with proper undefined conversion
  if (tile.minW !== null && tile.minW !== undefined) tileData.minW = tile.minW;
  if (tile.minH !== null && tile.minH !== undefined) tileData.minH = tile.minH;
  if (tile.context !== null && tile.context !== undefined) tileData.context = tile.context;
  if (tile.table !== null && tile.table !== undefined) tileData.table = tile.table;
  if (tile.autoUpdate !== null && tile.autoUpdate !== undefined)
    tileData.autoUpdate = tile.autoUpdate;
  if (tile.freeze !== null && tile.freeze !== undefined) tileData.freeze = tile.freeze;
  if (tile.filters !== null && tile.filters !== undefined) tileData.filters = tile.filters;
  if (tile.commonFilter !== null && tile.commonFilter !== undefined)
    tileData.commonFilter = tile.commonFilter;
  if (tile.metric !== null && tile.metric !== undefined) tileData.metric = tile.metric;
  if (tile.columnContext !== null && tile.columnContext !== undefined)
    tileData.columnContext = tile.columnContext;
  if (tile.grouping !== null && tile.grouping !== undefined) tileData.grouping = tile.grouping;
  if (tile.color !== null && tile.color !== undefined) tileData.color = tile.color;

  // Add table tile data if present
  if (tile.tableTile) {
    const tableTile: TableTileData = {};

    // Only add properties that aren't null
    if (tile.tableTile.tableType !== null && tile.tableTile.tableType !== undefined)
      tableTile.tableType = tile.tableTile.tableType;
    if (tile.tableTile.pageNumber !== null && tile.tableTile.pageNumber !== undefined)
      tableTile.pageNumber = tile.tableTile.pageNumber;
    if (tile.tableTile.columnOrder !== null && tile.tableTile.columnOrder !== undefined)
      tableTile.columnOrder = tile.tableTile.columnOrder;
    if (tile.tableTile.hiddenColumns !== null && tile.tableTile.hiddenColumns !== undefined)
      tableTile.hiddenColumns = tile.tableTile.hiddenColumns;
    if (
      tile.tableTile.defaultHiddenColumns !== null &&
      tile.tableTile.defaultHiddenColumns !== undefined
    )
      tableTile.defaultHiddenColumns = tile.tableTile.defaultHiddenColumns;
    if (tile.tableTile.sorting !== null && tile.tableTile.sorting !== undefined)
      tableTile.sorting = tile.tableTile.sorting;
    if (tile.tableTile.groupSorting !== null && tile.tableTile.groupSorting !== undefined)
      tableTile.groupSorting = tile.tableTile.groupSorting;
    if (tile.tableTile.columnsPinLeft !== null && tile.tableTile.columnsPinLeft !== undefined)
      tableTile.columnsPinLeft = tile.tableTile.columnsPinLeft;
    if (tile.tableTile.columnsPinRight !== null && tile.tableTile.columnsPinRight !== undefined)
      tableTile.columnsPinRight = tile.tableTile.columnsPinRight;
    if (tile.tableTile.selected !== null && tile.tableTile.selected !== undefined)
      tableTile.selected = tile.tableTile.selected;

    tileData.tableTile = tableTile;
  }

  // Add plot tile data if present
  if (tile.plotTile) {
    const plotTile: PlotTileData = {};

    // Only add properties that aren't null
    if (tile.plotTile.plotType !== null && tile.plotTile.plotType !== undefined)
      plotTile.plotType = tile.plotTile.plotType;
    if (tile.plotTile.plotScaleX !== null && tile.plotTile.plotScaleX !== undefined)
      plotTile.plotScaleX = tile.plotTile.plotScaleX;
    if (tile.plotTile.plotScaleY !== null && tile.plotTile.plotScaleY !== undefined)
      plotTile.plotScaleY = tile.plotTile.plotScaleY;
    if (tile.plotTile.plotAggregate !== null && tile.plotTile.plotAggregate !== undefined)
      plotTile.plotAggregate = tile.plotTile.plotAggregate;
    if (tile.plotTile.xAxis !== null && tile.plotTile.xAxis !== undefined)
      plotTile.xAxis = tile.plotTile.xAxis;
    if (tile.plotTile.yAxis !== null && tile.plotTile.yAxis !== undefined)
      plotTile.yAxis = tile.plotTile.yAxis;
    if (tile.plotTile.plotGroupBy !== null && tile.plotTile.plotGroupBy !== undefined)
      plotTile.plotGroupBy = tile.plotTile.plotGroupBy;
    if (tile.plotTile.binCount !== null && tile.plotTile.binCount !== undefined)
      plotTile.binCount = tile.plotTile.binCount;
    if (tile.plotTile.regressionLine !== null && tile.plotTile.regressionLine !== undefined)
      plotTile.regressionLine = tile.plotTile.regressionLine;

    tileData.plotTile = plotTile;
  }

  // Add view tile data if present
  if (tile.viewTile) {
    const viewTile: ViewTileData = {};

    // Only add properties that aren't null
    if (tile.viewTile.baseIndex !== null && tile.viewTile.baseIndex !== undefined)
      viewTile.baseIndex = tile.viewTile.baseIndex;

    tileData.viewTile = viewTile;
  }

  // Add editor tile data if present
  if (tile.editorTile) {
    const editorTile: EditorTileData = {};

    // Only add properties that aren't null
    if (tile.editorTile.fileName !== null && tile.editorTile.fileName !== undefined)
      editorTile.fileName = tile.editorTile.fileName;
    if (tile.editorTile.fileType !== null && tile.editorTile.fileType !== undefined)
      editorTile.fileType = tile.editorTile.fileType;
    if (tile.editorTile.content !== null && tile.editorTile.content !== undefined)
      editorTile.content = tile.editorTile.content;

    tileData.editorTile = editorTile;
  }

  // Add terminal tile data if present
  if (tile.terminalTile) {
    const terminalTile: TerminalTileData = {};

    // Only add properties that aren't null
    if (tile.terminalTile.shellType !== null && tile.terminalTile.shellType !== undefined)
      terminalTile.shellType = tile.terminalTile.shellType;

    tileData.terminalTile = terminalTile;
  }

  return tileData;
}

/**
 * Utility to convert Tab state from zustand to TabData format for API operations
 * @param tab - The Tab object from the zustand store
 * @returns A TabData object suitable for API operations, or null if tab is falsy
 */
export function convertTabToTabData(tab: Tab | null): TabData | null {
  if (!tab) return null;

  const tabData: TabData = {
    // Handle id conversion from string | null to string | undefined
    id: tab.id || undefined,

    // Handle interfaceId conversion from interfaceId
    interfaceId: tab.interfaceId || undefined,

    // Handle name conversion - TabData.name is required string, Tab.name is string | null
    name: tab.name || '',

    // Handle boolean conversions
    visible: tab.visible,
    active: tab.active,
    order: tab.order,

    // Handle globalContext -> context conversion
    context: tab.globalContext || undefined,

    // Handle color conversion
    color: tab.color || undefined,

    // createdAt and updatedAt are not available in Tab interface
    // These would typically be set by the server
    createdAt: undefined,
    updatedAt: undefined,
  };

  return tabData;
}

/**
 * A helper to do partial shallow checks:
 *  - For atomic types (string, number, boolean, null/undefined), compare by strict equality (===).
 *  - For arrays, do a shallow array compare: if they have same length and each item === the other.
 *  - For objects (non-array), compare references only. If you want a shallow compare of object keys,
 *    you'd do something custom here. Note this is a single update version of filterUnchangedProps.
 */
export function filterUnchangedProp<T>(current: T, update: T): boolean {
  let changed = false;

  current = unwrapIfDraft(current);
  update = unwrapIfDraft(update);

  if (!isEqual(current, update)) {
    changed = true;
  }

  return changed;
}

/**
 * A helper to do partial shallow checks:
 *  - For atomic types (string, number, boolean, null/undefined), compare by strict equality (===).
 *  - For arrays, do a shallow array compare: if they have same length and each item === the other.
 *  - For objects (non-array), compare references only. If you want a shallow compare of object keys,
 *    you'd do something custom here.
 */
export function filterUnchangedProps<T extends object>(
  current: T,
  updates: Partial<T>
): Partial<T> {
  const filtered: Partial<T> = {};
  let changed = false;

  current = unwrapIfDraft(current);
  updates = unwrapIfDraft(updates);

  for (const key in updates) {
    // Use filterUnchangedProp to check if the property has changed
    const oldVal = current[key];
    const newVal = updates[key];

    if (filterUnchangedProp(oldVal, newVal)) {
      filtered[key] = newVal;
      changed = true;
    }
  }

  return changed ? filtered : {};
}

/** If a value is an Immer Draft (Proxy), return the plain object/value. Otherwise return as-is. */
function unwrapIfDraft(value: any) {
  if (isDraft(value)) {
    return immerCurrent(value);
  }
  return value;
}

/**
 * A generic helper to filter updates for tile objects incl. TableTile, PlotTile, ViewTile, EditorTile, and TerminalTile.
 * Either pass in a single update or a record of updates. Either pass in a tile object and tile updates for comparison
 * or pass in a table tile object and table tile updates for comparison, or a plot tile object and plot tile updates for comparison,
 * and so on etc.
 *   - If `updates` has exactly 1 key, we do single-field logic with filterUnchangedProp
 *   - Otherwise, we do the normal filterUnchangedProps.
 *
 * Usage example:
 *   const filteredTileUpdates = filterUnchangedUpdate(tile, tileUpdates);
 *   const filteredTableTileUpdates = filterUnchangedUpdate(tableTile, tableTileUpdates);
 */
export function filterUnchangedUpdates<T extends object>(
  source: T,
  updates: Partial<T>
): Partial<T> {
  const keys = Object.keys(updates) as (keyof T)[];

  if (keys.length === 0) {
    // No keys => nothing changed
    return {} as Partial<T>;
  }

  if (keys.length === 1) {
    // Exactly one field in `updates`
    const [key] = keys;
    const newVal = updates[key];
    const oldVal = source[key];

    // If they differ, return an object with that single field updated
    if (filterUnchangedProp(oldVal, newVal)) {
      return { [key]: newVal } as Partial<T>;
    } else {
      // They are unchanged => return empty
      return {} as Partial<T>;
    }
  } else {
    // More than one field => do the multi-field approach
    return filterUnchangedProps(source, updates);
  }
}

/**
 * Split tile updates into separate objects for each tile type
 * @param updates - The updates to split
 * @returns An object containing the updates for each tile type
 */
export function splitTileUpdates(updates: Record<string, any>): {
  tileUpdates: Partial<Tile>;
  tableTileUpdates: Partial<TableTile>;
  plotTileUpdates: Partial<PlotTile>;
  viewTileUpdates: Partial<ViewTile>;
  editorTileUpdates: Partial<EditorTile>;
  terminalTileUpdates: Partial<TerminalTile>;
} {
  const tileUpdates: Partial<Tile> = {};
  let tableTileUpdates: Partial<TableTile> = {};
  let plotTileUpdates: Partial<PlotTile> = {};
  let viewTileUpdates: Partial<ViewTile> = {};
  let editorTileUpdates: Partial<EditorTile> = {};
  let terminalTileUpdates: Partial<TerminalTile> = {};
  // Check if any of the keys in `updates` are one of ["tableTile", "plotTile", "viewTile", "editorTile", "terminalTile"]
  // If so, then we just spread the nested updates for updates[key] directly
  // into either tableTileUpdates, plotTileUpdates, or viewTileUpdates so e.g. if the
  // updates object has a "tableTile" key, then we spread the nested updates for tableTile
  // into tableTileUpdates.
  const nestedKeys = Object.keys(updates).filter((key) =>
    ['tableTile', 'plotTile', 'viewTile', 'editorTile', 'terminalTile'].includes(key)
  );
  nestedKeys.forEach((key) => {
    if (key === 'tableTile') {
      tableTileUpdates = { ...tableTileUpdates, ...updates[key] };
      delete updates[key];
    } else if (key === 'plotTile') {
      plotTileUpdates = { ...plotTileUpdates, ...updates[key] };
      delete updates[key];
    } else if (key === 'viewTile') {
      viewTileUpdates = { ...viewTileUpdates, ...updates[key] };
      delete updates[key];
    } else if (key === 'editorTile') {
      editorTileUpdates = { ...editorTileUpdates, ...updates[key] };
      delete updates[key];
    } else if (key === 'terminalTile') {
      terminalTileUpdates = { ...terminalTileUpdates, ...updates[key] };
      delete updates[key];
    }
  });

  for (const key in updates) {
    if (TILE_KEYS.includes(key as keyof Tile)) {
      tileUpdates[key as keyof Tile] = updates[key];
    }

    if (TABLE_TILE_KEYS.includes(key as keyof TableTile)) {
      tableTileUpdates[key as keyof TableTile] = updates[key];
    }

    if (PLOT_TILE_KEYS.includes(key as keyof PlotTile)) {
      plotTileUpdates[key as keyof PlotTile] = updates[key];
    }

    if (VIEW_TILE_KEYS.includes(key as keyof ViewTile)) {
      viewTileUpdates[key as keyof ViewTile] = updates[key] as never;
    }

    if (EDITOR_TILE_KEYS.includes(key as keyof EditorTile)) {
      editorTileUpdates[key as keyof EditorTile] = updates[key] as never;
    }

    if (TERMINAL_TILE_KEYS.includes(key as keyof TerminalTile)) {
      terminalTileUpdates[key as keyof TerminalTile] = updates[key] as never;
    }

    if (
      !tileUpdates &&
      !tableTileUpdates &&
      !plotTileUpdates &&
      !viewTileUpdates &&
      !editorTileUpdates &&
      !terminalTileUpdates
    ) {
      console.warn(
        `Unknown property '${key}' not in Tile or TableTile or PlotTile or ViewTile or EditorTile or TerminalTile.`
      );
    }
  }

  return {
    tileUpdates,
    tableTileUpdates,
    plotTileUpdates,
    viewTileUpdates,
    editorTileUpdates,
    terminalTileUpdates,
  };
}

/**
 * A helper to log the changes to the dependencies of a component.
 * @param name - The name of the component
 * @param deps - The dependencies of the component
 */
export function useWhyDidYouUpdate(name: string, deps: any[]) {
  const previousDeps = useRef<any[]>(deps);
  useEffect(() => {
    const changedDeps: Record<number, { from: any; to: any }> = {};
    deps.forEach((dep, index) => {
      if (previousDeps.current[index] !== dep) {
        changedDeps[index] = {
          from: previousDeps.current[index],
          to: dep,
        };
      }
    });
    if (Object.keys(changedDeps).length) {
      console.log(`[why-did-you-update] ${name}`, changedDeps);
    }
    previousDeps.current = deps;
  }, deps);
}

/**
 * A generic helper to recursively construct the hierarchical id for any slice selector from its name and parent ids.
 * The parent ids could be names or hierarchical ids themselves or a mix of both.
 * @param name - The name of the slice selector
 * @param parentIds - The parent ids of the slice selector in order i.e. project, interface, tab, tile
 * @returns The hierarchical id of the slice selector
 */
export function constructHierarchicalId(name: string, parentIds: string[]): string {
  if (parentIds.length === 0) {
    return name;
  }

  // If the name is already hierarchical, return it
  if (name.includes('>')) {
    return name;
  }

  return parentIds.map((id) => constructHierarchicalId(id, [])).join('>') + '>' + name;
}

/**
 * A generic helper to deconstruct the hierarchical id for any slice selector from its hierarchical id
 * @param hierarchicalId - The hierarchical id of the slice selector
 * @returns The name and parent ids of the slice selector
 */
export function deconstructHierarchicalId(hierarchicalId: string): {
  name: string;
  parentIds: string[];
} {
  const parts = hierarchicalId.split('>');
  return { name: parts[parts.length - 1], parentIds: parts.slice(0, -1) };
}

/**
 * A helper to get the parent id from a hierarchical id
 * @param hierarchicalId - The hierarchical id of the slice selector
 * @returns The parent id of the slice selector (i.e. the nearest parent id)
 */
export function getParentId(hierarchicalId: string): string {
  return deconstructHierarchicalId(hierarchicalId).parentIds.join('>');
}

/**
 * Paste a copied tile to a tab
 */
export function pasteCopiedTile(
  state: WritableDraft<StoreSlice>,
  tabId: string,
  sourceTileId: string,
  newTileId: string,
  initialState: Partial<Tile> | undefined
): void {
  const tab = state.tabsById[tabId];
  const sourceTile = state.tilesById[sourceTileId];

  if (!tab || !sourceTile) return;

  // Only initialize if it doesn't exist
  if (!state.tilesById[newTileId]) {
    const newTile = tileLogic.initTile(newTileId, {
      ...sourceTile,
      ...initialState,
    });
    state.tilesById[newTileId] = newTile;

    // Initialize type-specific data if needed
    if (newTile.type === 'Table' && !newTile.tableTile) {
      state.tilesById[newTileId].tableTile = tableTileLogic.initTableTile();
    } else if (newTile.type === 'Plot' && !newTile.plotTile) {
      state.tilesById[newTileId].plotTile = plotTileLogic.initPlotTile();
    } else if (newTile.type === 'View' && !newTile.viewTile) {
      state.tilesById[newTileId].viewTile = viewTileLogic.initViewTile();
    } else if (newTile.type === 'Editor' && !newTile.editorTile) {
      state.tilesById[newTileId].editorTile = editorTileLogic.initEditorTile();
    } else if (newTile.type === 'Terminal' && !newTile.terminalTile) {
      state.tilesById[newTileId].terminalTile = terminalTileLogic.initTerminalTile();
    }

    // Add the tile to the tab
    const newTileName = initialState?.name || newTile.name;
    state.tabsById[tabId] = tabLogic.addTile(tab, newTileId, newTileName, sourceTileId);
  }
}

/**
 * Remove a tile from a tab
 */
export function removeTile(state: WritableDraft<StoreSlice>, tabId: string, tileId: string): void {
  const tab = state.tabsById[tabId];
  const tile = state.tilesById[tileId];

  if (!tab || !tile) return;

  // Remove the tile
  const tileName = tile.name;
  delete state.tilesById[tileId];

  // Then update any references to this tile in other tiles
  // (This is for tiles that reference other tiles by name)
  Object.keys(state.tilesById).forEach((id) => {
    const tile = state.tilesById[id];

    let updateTile = false;

    // Update `table` references for View tiles
    if (tile.table === tileName) {
      tile.table = null;
      updateTile = true;
    }

    // Update xAxis, yAxis, and plotGroupBy references for Plot tiles
    if (tile.type === 'Plot' && tile.plotTile) {
      if (tile.plotTile.xAxis?.includes(tileName + '.')) {
        tile.plotTile.xAxis = null;
        updateTile = true;
      }
      if (tile.plotTile?.yAxis?.includes(tileName + '.')) {
        tile.plotTile.yAxis = null;
        updateTile = true;
      }
      if (tile.plotTile?.plotGroupBy?.includes(tileName + '.')) {
        tile.plotTile.plotGroupBy = null;
        updateTile = true;
      }
    }

    if (updateTile) {
      state.tilesById[id] = tile;
    }
  });

  // Update the tab's tileIds and tileNames arrays
  state.tabsById[tabId] = tabLogic.removeTile(tab, tileId, tile.name);
}

/**
 * Rename a tile
 */
export function renameTile(
  state: WritableDraft<StoreSlice>,
  tabId: string,
  sourceTileId: string,
  newTileName: string
): void {
  const tab = state.tabsById[tabId];
  if (!tab) return;

  // Get the source tile
  const sourceTile = state.tilesById[sourceTileId];
  if (!sourceTile) return;

  // Rename the tile
  const sourceTileName = sourceTile.name;
  state.tilesById[sourceTileId].name = newTileName;

  // Then update any references to this tile in other tiles
  // (This is for tiles that reference other tiles by name)
  Object.keys(state.tilesById).forEach((id) => {
    const tile = state.tilesById[id];

    let updateTile = false;

    // Update `table` references for View tiles
    if (tile.table === sourceTileName) {
      tile.table = newTileName;
      updateTile = true;
    }

    // Update xAxis, yAxis, and plotGroupBy references for Plot tiles
    if (tile.type === 'Plot' && tile.plotTile) {
      if (tile.plotTile.xAxis?.includes(sourceTileName + '.')) {
        tile.plotTile.xAxis = tile.plotTile.xAxis?.replace(sourceTileName + '.', newTileName + '.');
        updateTile = true;
      }
      if (tile.plotTile?.yAxis?.includes(sourceTileName + '.')) {
        tile.plotTile.yAxis = tile.plotTile.yAxis?.replace(sourceTileName + '.', newTileName + '.');
        updateTile = true;
      }
      if (tile.plotTile?.plotGroupBy?.includes(sourceTileName + '.')) {
        tile.plotTile.plotGroupBy = tile.plotTile.plotGroupBy?.replace(
          sourceTileName + '.',
          newTileName + '.'
        );
        updateTile = true;
      }
    }

    if (updateTile) {
      state.tilesById[id] = tile;
    }
  });

  // Update the tab's tileNames array to replace the sourceTileName with the newTileName
  if (tab.tileNames) {
    tab.tileNames = tab.tileNames.map((name) => (name === sourceTileName ? newTileName : name));
  }
}

/**
 * Add a tab to an interface
 */
export function addTab(
  state: WritableDraft<StoreSlice>,
  interfaceId: string,
  newTabName: string,
  initialState: Partial<Tab> | undefined
): void {
  const interfaceObj = state.interfacesById[interfaceId];

  if (!interfaceObj) return;

  const newTabId = initialState?.id || null;

  if (!newTabId) return;

  // Only initialize if it doesn't exist
  if (!state.tabsById[newTabId]) {
    // First, set any existing active tabs to inactive
    if (interfaceObj.activeTabId && state.tabsById[interfaceObj.activeTabId]) {
      state.tabsById[interfaceObj.activeTabId].active = false;
    }

    // Create the new tab and mark it as active
    const newTab = tabLogic.initTab(newTabId, {
      ...initialState,
      active: true,
    });
    state.tabsById[newTabId] = newTab;

    // Mark other tabs as inactive
    Object.keys(state.tabsById).forEach((id) => {
      if (id !== newTabId) {
        state.tabsById[id].active = false;
      }
    });

    // Update the interface's tabIds and tabNames arrays
    state.interfacesById[interfaceId] = interfaceLogic.addTab(interfaceObj, newTabId, newTabName);

    // Set this tab as the active tab in the interface
    state.interfacesById[interfaceId].activeTabId = newTabId;

    // Set this tab as the global active tab
    state.activeTabId = newTabId;
  }
}

/**
 * Remove a tab from an interface
 */
export function removeTab(
  state: WritableDraft<StoreSlice>,
  interfaceId: string,
  tabName: string
): void {
  const interfaceObj = state.interfacesById[interfaceId];
  const tabId = Object.keys(state.tabsById).find((id) => state.tabsById[id].name === tabName);

  if (!interfaceObj || !tabId) return;

  const tab = state.tabsById[tabId];

  // Clean up associated tiles
  if (tab.tileIds) {
    tab.tileIds.forEach((tileId) => {
      removeTile(state, tabId, tileId);
    });
  }

  // Remove the tab
  delete state.tabsById[tabId];

  // Update the interface's tabIds and tabNames arrays
  if (interfaceObj.tabIds) {
    state.interfacesById[interfaceId].tabIds = interfaceObj.tabIds.filter((tid) => tid !== tabId);
  }
  if (interfaceObj.tabNames) {
    state.interfacesById[interfaceId].tabNames = interfaceObj.tabNames.filter(
      (name) => name !== tab.name
    );
  }

  // Reset active tab if it matches the removed tab
  if (state.activeTabId === tabId) {
    state.activeTabId = null;
  }

  // Reset active tab in the interface if it matches the removed tab
  if (interfaceObj.activeTabId === tabId) {
    state.interfacesById[interfaceId].activeTabId = null;
  }
}

/**
 * Rename a tab
 */
export function renameTab(
  state: WritableDraft<StoreSlice>,
  interfaceId: string,
  sourceTabName: string,
  newTabName: string
): void {
  const interfaceObj = state.interfacesById[interfaceId];

  // Get the source tab
  const sourceTabId = Object.keys(state.tabsById).find(
    (id) => state.tabsById[id].name === sourceTabName
  );

  if (!interfaceObj || !sourceTabId) return;

  const sourceTab = state.tabsById[sourceTabId];

  // Store the old name before changing it
  const oldTabName = sourceTab.name;

  // Change the name of the tab
  sourceTab.name = newTabName;

  // Update the interface's tabNames array if the old name exists
  if (interfaceObj.tabNames && oldTabName) {
    const nameIndex = interfaceObj.tabNames.indexOf(oldTabName);
    if (nameIndex >= 0) {
      state.interfacesById[interfaceId].tabNames[nameIndex] = newTabName;
    }
  }
}

/**
 * Remove a context from a tab
 */
export function removeContextFromTab(
  state: WritableDraft<StoreSlice>,
  tabId: string,
  context: string
): void {
  const tab = state.tabsById[tabId];
  if (!tab) return;

  if (tab.globalContext && tab.globalContext === context) {
    tab.globalContext = undefined;
  }

  // Also update all the tiles that have the context or column context set as this context
  let itemsNeedRecompute = false;
  tab.tileIds?.forEach((tileId) => {
    const tile = state.tilesById[tileId];
    if (tile) {
      if (tile.context === context && context !== undefined) {
        tile.context = undefined;
        tile.pending = true;
        tile.itemsNeedRecompute = true;
        itemsNeedRecompute = true;
      }
      if (tile?.columnContext === context && context !== undefined) {
        tile.columnContext = undefined;
        tile.pending = true;
        tile.itemsNeedRecompute = true;
        itemsNeedRecompute = true;
      }
      if (tile.itemsNeedRecompute) {
        state.tilesById[tileId] = tile;
      }
    }
  });

  // Update the tab in the store
  if (itemsNeedRecompute && !tab.itemsNeedRecompute) {
    tab.itemsNeedRecompute = true;
  }

  state.tabsById[tabId] = tab;
}

export function getAnyTileLoading(state: StoreSlice): boolean {
  return Object.values(state.tilesById).some((tile) => tile.loading);
}
