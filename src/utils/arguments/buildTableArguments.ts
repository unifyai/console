import { TileData } from '@/types/interfaces/grid';
import { TableArguments, LogFieldsResponseProps } from '@/types/interfaces/logs';
import { buildFilterExpression } from '@/lib/logs/filters';
import { processContext } from '@/lib/logs/columns';
import { sortingStateToOrchestra, tileSortingToState } from '@/lib/logs/querySpec';

/*
 * Builds the availableFields for tableArgument for a tile
 */
export function buildAvailableFieldsForTile(
  columnContext: string,
  fields: LogFieldsResponseProps,
  entriesProperties: string[]
): LogFieldsResponseProps {
  const availableFields = Object.fromEntries(
    Object.entries(fields).filter(([field, _]) =>
      entriesProperties
        .map((property) =>
          columnContext ? processContext('merge', columnContext, property) : property
        )
        .includes(field)
    )
  );
  return availableFields;
}

/**
 * Builds table arguments for a tile
 * Can be used by both TableWrapper and PlotWrapper
 */
export function buildTableArgumentsForTile(
  tile: TileData,
  fields: LogFieldsResponseProps,
  existingArguments: TableArguments = {}
): TableArguments {
  const tileName = tile.name;
  const tableArguments = { ...existingArguments };

  // Build filter expression
  const filteression = buildFilterExpression(
    tile.filters,
    tile.commonFilter,
    tile.columnContext,
    tile.freeze,
    fields
  );

  // Handle sorting via shared LogGrid helpers (tile string ↔ Orchestra JSON)
  const sortingState = tileSortingToState(tile.tableTile?.sorting ?? undefined).map((entry) => ({
    ...entry,
    id: tile.columnContext ? processContext('merge', tile.columnContext, entry.id) : entry.id,
  }));
  const sortingExpression = sortingStateToOrchestra(sortingState);

  // Handle grouping
  const groupingExpression = tile.grouping || null;

  // Handle group sorting
  const groupSortingObject =
    tile.tableTile?.groupSorting && tile.grouping
      ? Object.fromEntries(
          tile.tableTile.groupSorting.split(',').map((value) => {
            const group = tile.columnContext
              ? processContext('merge', tile.columnContext, tile.grouping!.split(',')[0])
              : tile.grouping!.split(',')[0];
            const field = tile.columnContext
              ? processContext('merge', tile.columnContext, value.split('@')[0])
              : value.split('@')[0];
            const direction = value
              .split('@')[1]
              .replace('true', 'descending')
              .replace('false', 'ascending');
            const metric = tile.metric ?? 'mean';
            return [group, { field, direction, metric }];
          })
        )
      : '';
  const groupSortingExpression = groupSortingObject ? JSON.stringify(groupSortingObject) : null;

  // Create or update this tile's arguments
  tableArguments[tileName] = tableArguments[tileName] || {
    getLogsParameters: { filter: '' },
  };

  // Set filter expression
  tableArguments[tileName].getLogsParameters.filter = filteression || '';

  // Add optional parameters
  if (tile.filters) tableArguments[tileName].getLogsParameters['column_filters'] = tile.filters;
  if (tile.commonFilter)
    tableArguments[tileName].getLogsParameters['commonFilter'] = tile.commonFilter;
  if (tile.freeze) tableArguments[tileName].getLogsParameters['freeze'] = tile.freeze;
  if (sortingExpression) tableArguments[tileName].getLogsParameters['sorting'] = sortingExpression;
  if (groupingExpression)
    tableArguments[tileName].getLogsParameters['grouping'] = groupingExpression;
  if (groupSortingExpression)
    tableArguments[tileName].getLogsParameters['groupSorting'] = groupSortingExpression;
  if (tile.context) tableArguments[tileName].getLogsParameters['context'] = tile.context;
  if (tile.columnContext)
    tableArguments[tileName].getLogsParameters['columnContext'] = tile.columnContext;

  return tableArguments;
}

/**
 * Builds table arguments for multiple tiles
 */
export function buildTableArguments(
  tiles: TileData[],
  fields: LogFieldsResponseProps[],
  existingArguments: TableArguments = {}
): TableArguments {
  let tableArguments = { ...existingArguments };

  // Process each table tile SEQUENTIALLY with a for loop
  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    if (tile.tableTile) {
      tableArguments = buildTableArgumentsForTile(tile, fields[i], tableArguments);
    }
  }

  return tableArguments;
}
