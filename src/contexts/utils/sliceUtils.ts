import { current as immerCurrent, isDraft } from "immer";
import { shallow } from 'zustand/vanilla/shallow';
import { Tile } from "../slices/selectors/tile";
import { PlotTileData } from "../slices/selectors/plotTile";
import { ViewTileData } from "../slices/selectors/viewTile";
import { TableTileData } from "../slices/selectors/tableTile";
import { TILE_KEYS, TABLE_TILE_KEYS, PLOT_TILE_KEYS, VIEW_TILE_KEYS } from "../slices/slice";

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
    const oldVal = unwrapIfDraft(current[key]);
    const newVal = unwrapIfDraft(updates[key]);

    if (!shallow(oldVal, newVal)) {
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
 * Split tile updates into separate objects for each tile type
 * @param updates - The updates to split
 * @returns An object containing the updates for each tile type
 */
export function splitTileUpdates(
  updates: Record<string, any>
): {
  tileUpdates: Partial<Tile>;
  tableTileUpdates: Partial<TableTileData>;
  plotTileUpdates: Partial<PlotTileData>;
  viewTileUpdates: Partial<ViewTileData>;
} {
  const tileUpdates: Partial<Tile> = {};
  const tableTileUpdates: Partial<TableTileData> = {};
  const plotTileUpdates: Partial<PlotTileData> = {};
  const viewTileUpdates: Partial<ViewTileData> = {};
  
  for (const key in updates) {
    if (TILE_KEYS.includes(key as keyof Tile)) {
      tileUpdates[key as keyof Tile] = updates[key];
    } else if (TABLE_TILE_KEYS.includes(key as keyof TableTileData)) {
      tableTileUpdates[key as keyof TableTileData] = updates[key];
    } else if (PLOT_TILE_KEYS.includes(key as keyof PlotTileData)) {
      plotTileUpdates[key as keyof PlotTileData] = updates[key];
    } else if (VIEW_TILE_KEYS.includes(key as keyof ViewTileData)) {
      viewTileUpdates[key as keyof ViewTileData] = updates[key];
    } else {
      console.warn(`Unknown property '${key}' not in Tile or TableTileData.`);
    }
  }

  return { tileUpdates, tableTileUpdates, plotTileUpdates, viewTileUpdates };
}