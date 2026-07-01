import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';
import {
  fetchAndBuildTableDataItem,
  getTotalCountFromLogsResponse,
  getNewCells,
  filterNewLogsById,
  filterNewSubRowsById,
  getSortingObject,
  getGroupSortingObject,
} from '@/utils/data/buildTableDataItem';
import { TileData, TilePosition, TableTileData, LogsActions } from '@/types/interfaces/grid';
import {
  LogsResponseProps,
  LogProps,
  LogFieldsResponseProps,
  LogItemProps,
  GroupedLogPropsRaw,
} from '@/types/interfaces/logs';

// Simple helpers to build synthetic fixtures
const makePosition = (): TilePosition => ({ x: 0, y: 0, width: 4, height: 4 });

const baseFields: LogFieldsResponseProps = {
  'entries/message': {
    dataType: 'string',
    fieldType: 'entry',
    artifacts: '',
    mutable: 'false',
    createdAt: '2025-01-01T00:00:00Z',
  },
  // params/level field removed - params support no longer available
};

const makeUngroupedLog = (id: string, level: string, message: string): LogProps => ({
  type: 'ungrouped',
  id,
  ts: '2025-01-01T00:00:00Z',
  entries: { message, level },
  derivedEntries: {},
  clippedFields: {},
});

// Dummy logsActions (not used by fetchAndBuildTableDataItem but required by type)
const dummyLogsActions: LogsActions = {
  create: vi.fn(),
  get: vi.fn(),
  getLatest: vi.fn(),
  getMetrics: vi.fn(),
  delete: vi.fn(),
  update: vi.fn(),
} as unknown as LogsActions;

describe('buildTableDataItem helpers', () => {
  it('fetchAndBuildTableDataItem builds a coherent TableDataItem for ungrouped logs', async () => {
    const tile: TileData = {
      id: 'tile-1',
      name: 'Table Tile',
      position: makePosition(),
      type: 'Table',
      tabId: 'tab-1',
      table: 'logs',
      visible: true,
      locked: false,
      tableTile: {
        limit: 20,
        offset: 0,
        groupLimit: 20,
        groupOffset: 0,
      } as TableTileData,
    };

    const logsArray: LogProps[] = [
      makeUngroupedLog('log-1', 'info', 'First'),
      makeUngroupedLog('log-2', 'error', 'Second'),
    ];

    const logsResponse: LogsResponseProps = {
      logs: logsArray,
      count: logsArray.length,
      groups: {},
    };

    // Override the default /api/logs handler for this test
    server.use(
      http.get('/api/logs', () => {
        return HttpResponse.json(logsResponse);
      })
    );

    const tableDataItem = await fetchAndBuildTableDataItem(
      tile,
      baseFields,
      'project-1',
      dummyLogsActions
    );

    // Total count should come from the response
    expect(tableDataItem.totalCount).toBe(logsArray.length);
    // Fields and column contexts should be wired through
    expect(tableDataItem.fields).toBe(baseFields);
    // entriesProperties should contain all fields (params support removed)
    expect(tableDataItem.entriesProperties).toEqual(['entries/message']);
    // Logs are derived from the response
    expect(tableDataItem.logs).toHaveLength(2);
    // No previous logs provided → no newCells
    expect(tableDataItem.newCells).toEqual([]);
    // No error detail on the response
    expect(tableDataItem.error).toBeUndefined();
    // fetchAndBuildTableDataItem always returns a non-loading item
    expect(tableDataItem.isLoading).toBe(false);
  });

  it('getTotalCountFromLogsResponse returns count for ungrouped logs', () => {
    const response: LogsResponseProps = {
      logs: [makeUngroupedLog('log-1', 'info', 'Msg')],
      count: 42,
      groups: {},
    };

    expect(getTotalCountFromLogsResponse(response)).toBe(42);
  });

  it('getTotalCountFromLogsResponse prefers groupCount for grouped logs', () => {
    const groupedRaw: GroupedLogPropsRaw = {
      'Entries/i': {
        group: [
          { key: '0', value: 3 },
          { key: '1', value: 2 },
        ],
        groupCount: 5,
        count: 5,
      },
      count: 5,
    };

    const response: LogsResponseProps = {
      logs: groupedRaw,
      count: 123, // should be ignored in favour of groupCount
      groups: {},
    };

    expect(getTotalCountFromLogsResponse(response)).toBe(5);
  });

  it('fetchAndBuildTableDataItem builds a coherent TableDataItem for grouped logs via GroupedLogPropsRaw', async () => {
    const tile: TileData = {
      id: 'tile-grouped',
      name: 'Grouped Table Tile',
      position: makePosition(),
      type: 'Table',
      tabId: 'tab-1',
      table: 'logs',
      visible: true,
      locked: false,
      grouping: 'entries/group',
      tableTile: {
        limit: 20,
        offset: 0,
        groupLimit: 20,
        groupOffset: 0,
      } as TableTileData,
    };

    const groupedRaw: GroupedLogPropsRaw = {
      'entries/group': {
        group: [
          { key: 'A', value: 3 },
          { key: 'B', value: 2 },
        ],
        groupCount: 2,
        count: 5,
      },
      count: 5,
    };

    const logsResponse: LogsResponseProps = {
      logs: groupedRaw,
      count: 5,
      groups: {},
    };

    // Override the default /api/logs handler for this test
    server.use(
      http.get('/api/logs', () => {
        return HttpResponse.json(logsResponse);
      })
    );

    const tableDataItem = await fetchAndBuildTableDataItem(
      tile,
      baseFields,
      'project-1',
      dummyLogsActions
    );

    // Total count should come from groupCount via getTotalCountFromLogsResponse
    expect(tableDataItem.totalCount).toBe(2);
    // Fields carried through
    expect(tableDataItem.fields).toBe(baseFields);
    // We should have logs representing grouped rows (converted by maybeConvertRawToGroupedLogs)
    expect(tableDataItem.logs.length).toBeGreaterThan(0);
  });

  it('getNewCells returns cells for new rows and changed values', () => {
    const previousLogs: LogProps[] = [makeUngroupedLog('log-1', 'info', 'First')];

    const newLogs: LogProps[] = [
      makeUngroupedLog('log-1', 'info', 'First-updated'),
      makeUngroupedLog('log-2', 'error', 'Second'),
    ];

    const newCells = getNewCells(previousLogs, newLogs);

    // log-1 message changed, so that cell should be flagged
    expect(newCells).toContain('log-1_message');
    // log-2 is entirely new, so both its cells should be flagged
    expect(newCells).toContain('log-2_message');
    expect(newCells).toContain('log-2_level');
  });

  it('filterNewLogsById returns only logs whose ids are not yet present', () => {
    const existing: LogProps[] = [makeUngroupedLog('log-1', 'info', 'First')];
    const incoming: LogProps[] = [
      makeUngroupedLog('log-1', 'info', 'First-duplicate'),
      makeUngroupedLog('log-2', 'error', 'Second'),
    ];

    const result = filterNewLogsById(existing, incoming);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('log-2');
  });

  it('filterNewSubRowsById delegates to filterNewLogsById', () => {
    const existing: LogProps[] = [makeUngroupedLog('log-1', 'info', 'First')];
    const incoming: LogProps[] = [
      makeUngroupedLog('log-1', 'info', 'First-duplicate'),
      makeUngroupedLog('log-2', 'error', 'Second'),
    ];

    const result = filterNewSubRowsById(existing, incoming);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('log-2');
  });

  it('getSortingObject builds a sorting map from tile.tableTile.sorting', () => {
    const tile: TileData = {
      id: 'tile-sort',
      name: 'Tile with sorting',
      position: makePosition(),
      type: 'Table',
      tableTile: {
        sorting: 'entries/message@true,entries/level@false',
      } as TableTileData,
    };

    const sorting = getSortingObject(tile);
    expect(sorting).toEqual({
      'entries/message': 'descending',
      'entries/level': 'ascending',
    });
  });

  it('getGroupSortingObject builds group sorting config from tile.tableTile.groupSorting and grouping', () => {
    const tile: TileData = {
      id: 'tile-group-sort',
      name: 'Tile with group sorting',
      position: makePosition(),
      type: 'Table',
      grouping: 'entries/i',
      metric: 'sum',
      tableTile: {
        groupSorting: 'entries/value@true',
      } as TableTileData,
    };

    const groupSorting = getGroupSortingObject(tile);
    expect(groupSorting).toEqual({
      'entries/i': {
        field: 'entries/value',
        direction: 'descending',
        metric: 'sum',
      },
    });
  });
});
