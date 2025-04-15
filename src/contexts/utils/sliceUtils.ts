import { current as immerCurrent, isDraft, WritableDraft } from "immer";
import isEqual from 'fast-deep-equal';
import { Tile, TILE_KEYS } from "../slices/selectors/tile";
import { PLOT_TILE_KEYS, PlotTile } from "../slices/selectors/plotTile";
import { VIEW_TILE_KEYS, ViewTile } from "../slices/selectors/viewTile";
import { TABLE_TILE_KEYS, TableTile } from "../slices/selectors/tableTile";
import { EDITOR_TILE_KEYS, EditorTile } from "../slices/selectors/editorTile";
import { useRef } from "react";
import { useEffect } from "react";
import { StoreSlice, Tab } from "../slices/slice";

// Import the domain logic from selector files
import * as interfaceLogic from "../slices/selectors/interface";
import * as tabLogic from "../slices/selectors/tab";
import * as tileLogic from "../slices/selectors/tile";
import * as tableTileLogic from "../slices/selectors/tableTile";
import * as plotTileLogic from "../slices/selectors/plotTile";
import * as viewTileLogic from "../slices/selectors/viewTile";
import * as editorTileLogic from "../slices/selectors/editorTile";
/**
 * A helper to do partial shallow checks:
 *  - For atomic types (string, number, boolean, null/undefined), compare by strict equality (===).
 *  - For arrays, do a shallow array compare: if they have same length and each item === the other.
 *  - For objects (non-array), compare references only. If you want a shallow compare of object keys,
 *    you'd do something custom here. Note this is a single update version of filterUnchangedProps.
 */
export function filterUnchangedProp<T>(
  current: T,
  update: T
): boolean {
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
 * A generic helper to filter updates for tile objects incl. TableTile, PlotTile, ViewTile, and EditorTile.
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
export function splitTileUpdates(
  updates: Record<string, any>
): {
  tileUpdates: Partial<Tile>;
  tableTileUpdates: Partial<TableTile>;
  plotTileUpdates: Partial<PlotTile>;
  viewTileUpdates: Partial<ViewTile>;
  editorTileUpdates: Partial<EditorTile>;
} {
  const tileUpdates: Partial<Tile> = {};
  let tableTileUpdates: Partial<TableTile> = {};
  let plotTileUpdates: Partial<PlotTile> = {};
  let viewTileUpdates: Partial<ViewTile> = {};
  let editorTileUpdates: Partial<EditorTile> = {};
  // Check if any of the keys in `updates` are one of ["tableTile", "plotTile", "viewTile", "editorTile"]
  // If so, then we just spread the nested updates for updates[key] directly
  // into either tableTileUpdates, plotTileUpdates, or viewTileUpdates so e.g. if the
  // updates object has a "tableTile" key, then we spread the nested updates for tableTile
  // into tableTileUpdates.
  const nestedKeys = Object.keys(updates).filter(key => ["tableTile", "plotTile", "viewTile", "editorTile"].includes(key));
  nestedKeys.forEach(key => {
    if (key === "tableTile") {
      tableTileUpdates = { ...tableTileUpdates, ...updates[key] };
      delete updates[key];
    } else if (key === "plotTile") {
      plotTileUpdates = { ...plotTileUpdates, ...updates[key] };
      delete updates[key];
    } else if (key === "viewTile") {
      viewTileUpdates = { ...viewTileUpdates, ...updates[key] };
      delete updates[key];
    } else if (key === "editorTile") {
      editorTileUpdates = { ...editorTileUpdates, ...updates[key] };
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
    
    if (!tileUpdates && !tableTileUpdates && !plotTileUpdates && !viewTileUpdates && !editorTileUpdates) {
      console.warn(`Unknown property '${key}' not in Tile or TableTile or PlotTile or ViewTile or EditorTile.`);
    }
  }

  return { tileUpdates, tableTileUpdates, plotTileUpdates, viewTileUpdates, editorTileUpdates };
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
          to: dep
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

  return parentIds.map(id => constructHierarchicalId(id, [])).join('>') + '>' + name;
}

/**
 * A generic helper to deconstruct the hierarchical id for any slice selector from its hierarchical id
 * @param hierarchicalId - The hierarchical id of the slice selector
 * @returns The name and parent ids of the slice selector
 */
export function deconstructHierarchicalId(hierarchicalId: string): { name: string, parentIds: string[] } {
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
 * Add a tile to a tab
 */
export function addTile(
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
    }
  }
  
    // Add the tile to the tab
  state.tabsById[tabId] = tabLogic.addTileId(tab, newTileId, sourceTileId);
}

/**
 * Remove a tile from a tab
 */
export function removeTile(
  state: WritableDraft<StoreSlice>,
  tabId: string,
  tileId: string
): void {
  const tab = state.tabsById[tabId];
  const tile = state.tilesById[tileId];
  
  if (!tab || !tile) return;
  
  // Remove the tile
  delete state.tilesById[tileId];
  
  // Update the tab's tileIds array
  state.tabsById[tabId] = tabLogic.removeTileId(tab, tileId);
}

/**
 * Rename a tile
 */
export function renameTile(
  state: WritableDraft<StoreSlice>,
  tabId: string,
  sourceTileId: string,
  newTileId: string,
  initialState: Partial<Tile> | undefined
): void {
  const tab = state.tabsById[tabId];
  if (!tab) return;

  addTile(state, tabId, sourceTileId, newTileId, initialState);

  // Then update any references to this tile in other tiles
  // (This is for tiles that reference other tiles by name)
  const { name: sourceTileName } = deconstructHierarchicalId(sourceTileId);
  const { name: newTileName } = deconstructHierarchicalId(newTileId);

  Object.keys(state.tilesById).forEach(id => {
    const tile = state.tilesById[id];

    let updateTile = false;

    // Update `table` references for View tiles
    if (tile.table === sourceTileName) {
      tile.table = newTileName;
      updateTile = true;
    }

    // Update x_axis, y_axis, and plot_group_by references for Plot tiles
    if (tile.type === 'Plot' && tile.plotTile) {
      if (tile.plotTile.x_axis?.includes(sourceTileName + ".")) {
        tile.plotTile.x_axis = tile.plotTile.x_axis?.replace(sourceTileName + ".", newTileName + ".");
        updateTile = true;
      }
      if (tile.plotTile?.y_axis?.includes(sourceTileName + ".")) {
        tile.plotTile.y_axis = tile.plotTile.y_axis?.replace(sourceTileName + ".", newTileName + ".");
        updateTile = true;
      }
      if (tile.plotTile?.plot_group_by?.includes(sourceTileName + ".")) {
        tile.plotTile.plot_group_by = tile.plotTile.plot_group_by?.replace(sourceTileName + ".", newTileName + ".");
        updateTile = true;
      }
    }

    if (updateTile) {
      state.tilesById[id] = tile;
    }
  });

  // Remove the source tile
  removeTile(state, tabId, sourceTileId);
}

/**
 * Add a tab to an interface
 */
export function addTab(
  state: WritableDraft<StoreSlice>,
  interfaceId: string,
  sourceTabId: string,
  newTabId: string,
  initialState: Partial<Tab> | undefined,
  renaming: boolean = false,
): void {
  const interfaceObj = state.interfacesById[interfaceId];

  // Get the source tab
  const sourceTab = state.tabsById[sourceTabId];

  if (!interfaceObj || !sourceTab) return;

  // Update the tab's tileIds array by replacing tabName substrings with newName substrings
  const newTileIds = sourceTab.tileIds?.map(id => id.replace(sourceTabId, newTabId));

  // Only initialize if it doesn't exist
  if (!state.tabsById[newTabId]) {
    const newTab = tabLogic.initTab(newTabId, {
      ...sourceTab,
      // tileIds: newTileIds,
      ...initialState,
    });
    state.tabsById[newTabId] = newTab;
  }

  const { name: newTabName } = deconstructHierarchicalId(newTabId);

  // Update the interface's tabIds array using the proper function
  state.interfacesById[interfaceId] = interfaceLogic.addTabId(interfaceObj, newTabId, sourceTabId);

  // Update the interface's tabNames array using the proper function
  const sourceTabName = sourceTab.name || "";
  state.interfacesById[interfaceId] = interfaceLogic.addTabName(interfaceObj, newTabName, sourceTabName);

  if (renaming) {
    // Now copy over the tiles from the source tab but with the new tile ids and names
    sourceTab.tileIds.forEach((sourceTileId, index) => {
      const tile = state.tilesById[sourceTileId];
      const newTileId = newTileIds[index];

      if (tile) {
        state.tilesById[newTileId] = tileLogic.initTile(newTileId, {
          ...tile,
          id: newTileId,
          tabId: newTabId,
        });

        // Initialize type-specific data if needed
        if (tile.type === 'Table' && !tile.tableTile) {
          state.tilesById[newTileId].tableTile = tableTileLogic.initTableTile();
        } else if (tile.type === 'Plot' && !tile.plotTile) {
          state.tilesById[newTileId].plotTile = plotTileLogic.initPlotTile();
        } else if (tile.type === 'View' && !tile.viewTile) {
          state.tilesById[newTileId].viewTile = viewTileLogic.initViewTile();
        } else if (tile.type === 'Editor' && !tile.editorTile) {
          state.tilesById[newTileId].editorTile = editorTileLogic.initEditorTile();
        }
      }
    });
  }
}

/**
 * Remove a tab from an interface
 */
export function removeTab(
  state: WritableDraft<StoreSlice>,
  interfaceId: string,
  tabId: string
): void {
  const interfaceObj = state.interfacesById[interfaceId];
  const tab = state.tabsById[tabId];
  
  if (!interfaceObj || !tab) return;
  
  // Clean up associated tiles
  if (tab.tileIds) {
    tab.tileIds.forEach(tileId => {
      const tile = state.tilesById[tileId];
      if (tile) {
        // Clean up tile-specific data
        if (tile.type === 'Table') state.tilesById[tileId].tableTile = null;
        else if (tile.type === 'Plot') state.tilesById[tileId].plotTile = null;
        else if (tile.type === 'View') state.tilesById[tileId].viewTile = null;
        else if (tile.type === 'Editor') state.tilesById[tileId].editorTile = null;
      }
      // Remove the tile
      delete state.tilesById[tileId];
    });
  }
  
  // Remove the tab
  delete state.tabsById[tabId];
  
  // Update the interface's tabIds and tabNames arrays
  if (interfaceObj.tabIds) {
    interfaceObj.tabIds = interfaceObj.tabIds.filter(tid => tid !== tabId);
  }
  if (interfaceObj.tabNames) {
    interfaceObj.tabNames = interfaceObj.tabNames.filter(name => name !== tab.name);
  }
  
  // Reset active tab if it matches the removed tab
  if (state.activeTabId === tabId) {
    state.activeTabId = null;
  }

}

/**
 * Rename a tab
 */
export function renameTab(
  state: WritableDraft<StoreSlice>,
  interfaceId: string,
  sourceTabId: string,
  newTabId: string,
  initialState: Partial<Tab> | undefined
): void {
  const interfaceObj = state.interfacesById[interfaceId];

  // Get the source tab
  const sourceTab = state.tabsById[sourceTabId];

  if (!interfaceObj || !sourceTab) return;

  // Add the new tab
  addTab(state, interfaceId, sourceTabId, newTabId, initialState, true);

  // Reset active tab if it matches the removed tab to the new tab
  if (state.activeTabId === sourceTabId) {
    state.activeTabId = newTabId;
  }

  // Now remove the source tab
  removeTab(state, interfaceId, sourceTabId);
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
  tab.tileIds?.forEach(tileId => {
    const tile = state.tilesById[tileId];
    if (tile) {
      if (tile.context === context && context !== undefined) {
        tile.context = undefined;
        tile.pending = true;
        tile.itemsNeedRecompute = true;
        itemsNeedRecompute = true;
      }
      if (tile.tableTile?.column_context === context && context !== undefined) {
        tile.tableTile.column_context = undefined;
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
  return Object.values(state.tilesById).some(tile => tile.loading);
}
