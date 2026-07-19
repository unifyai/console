import type { TileData } from '@/types/interfaces/grid';
import type { LogFieldsResponseProps } from '@/types/interfaces/logs';
import { buildFilterExpression } from '@/lib/logs/filters';
import { emptyLogViewState, type LogQuerySpec, type LogViewState } from '../types';
import { sortingStateToOrchestra, tileSortingToState } from '../querySpec';

/**
 * Map an Interfaces base tile + nested tableTile config onto LogViewState.
 * Encoding of comma / § / @ strings stays at this adapter boundary.
 */
export function tileDataToLogViewState(tile: TileData): LogViewState {
  const tt = tile.tableTile;
  const sorting = tileSortingToState(tt?.sorting ?? undefined);
  return emptyLogViewState({
    hiddenColumns: tt?.hiddenColumns ? tt.hiddenColumns.split(',').filter(Boolean) : [],
    columnOrder: tt?.columnOrder ? tt.columnOrder.split(',').filter(Boolean) : [],
    columnSizing: {},
    filters: tile.filters ?? '',
    commonFilter: tile.commonFilter ?? '',
    sorting,
    offset: typeof tt?.offset === 'number' ? tt.offset : 0,
    limit: typeof tt?.limit === 'number' ? tt.limit : 20,
    freeze: tile.freeze || undefined,
    metric: tile.metric || 'mean',
    autoUpdate: tile.autoUpdate === 'true',
  });
}

/**
 * Build a LogQuerySpec from Interfaces tile data using shared filter/sort builders.
 */
export function tileDataToLogQuerySpec(
  tile: TileData,
  projectName: string,
  fields: LogFieldsResponseProps
): LogQuerySpec {
  const view = tileDataToLogViewState(tile);
  const filter = buildFilterExpression(
    tile.filters,
    tile.commonFilter,
    tile.columnContext,
    tile.freeze,
    fields
  );
  return {
    projectName,
    context: tile.context ?? '',
    filter: filter || null,
    sorting: sortingStateToOrchestra(view.sorting),
    limit: view.limit,
    offset: view.offset,
    columnContext: tile.columnContext ?? null,
  };
}

/** Patch Interfaces tile fields from a LogViewState (adapter reverse direction). */
export function logViewStateToTilePatch(view: LogViewState): Partial<TileData> {
  return {
    filters: view.filters || undefined,
    commonFilter: view.commonFilter || undefined,
    freeze: view.freeze || undefined,
    metric: view.metric || undefined,
    autoUpdate: view.autoUpdate ? 'true' : 'false',
    tableTile: {
      hiddenColumns: view.hiddenColumns.join(','),
      columnOrder: view.columnOrder.join(','),
      sorting: view.sorting.map((s) => `${s.id}@${s.desc ? 'true' : 'false'}`).join(','),
      offset: view.offset,
      limit: view.limit,
    },
  };
}
