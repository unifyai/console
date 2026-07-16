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
  const sorting = tileSortingToState(tt?.sorting);
  return emptyLogViewState({
    hiddenColumns: tt?.hiddenColumns ? tt.hiddenColumns.split(',').filter(Boolean) : [],
    columnOrder: tt?.columnOrder ? tt.columnOrder.split(',').filter(Boolean) : [],
    columnsPinLeft: tt?.columnsPinLeft ? tt.columnsPinLeft.split(',').filter(Boolean) : [],
    columnsPinRight: tt?.columnsPinRight ? tt.columnsPinRight.split(',').filter(Boolean) : [],
    filters: tile.filters ?? '',
    commonFilter: tile.commonFilter ?? '',
    sorting,
    offset: typeof tt?.offset === 'number' ? tt.offset : 0,
    limit: typeof tt?.limit === 'number' ? tt.limit : 20,
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
  const filterExpr = buildFilterExpression(
    tile.filters,
    tile.commonFilter,
    tile.columnContext,
    tile.freeze,
    fields
  );
  return {
    projectName,
    context: tile.context ?? '',
    filterExpr: filterExpr || null,
    sorting: sortingStateToOrchestra(view.sorting),
    limit: view.limit,
    offset: view.offset,
    columnContext: tile.columnContext ?? null,
  };
}
