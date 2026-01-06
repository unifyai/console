import React, { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@/tests/interfaces/utils/render-with-providers';
import { useQueryClient } from '@tanstack/react-query';
import type { IStoreState } from '@/contexts/store';
import { useTabDataOptimistic, type CompleteTabData } from '@/hooks/Interfaces/Query/useTabDataOptimistic';
import type {
  GranularTabActions,
  GranularTileActions,
  FieldsActions,
  LogsActions,
  ProjectsActions,
  ContextActions,
  TileData,
  TableTileData,
} from '@/types/interfaces/grid';
import { LogFieldsResponseProps, LogItemProps } from '@/types/interfaces/logs';
import {
  mockProjectId,
  mockProject,
} from '@/tests/interfaces/mocks/fixtures/projects';
import {
  mockInterfaceId,
  mockInterface,
} from '@/tests/interfaces/mocks/fixtures/interfaces';
import {
  mockTabId,
  mockTab,
} from '@/tests/interfaces/mocks/fixtures/tabs';
import {
  mockTileId,
  mockTile,
} from '@/tests/interfaces/mocks/fixtures/tiles';
import * as optimisticModule from '@/utils/data/buildServerDataOptimistic';

// Mock fetch for tests - implementation uses direct fetch to /api/tile
const mockFetch = vi.fn();

type TabDataActions = {
  tabActions: GranularTabActions;
  tileActions: GranularTileActions;
  fieldsActions: FieldsActions;
  logsActions: LogsActions;
  projectsActions: ProjectsActions;
  contextActions: ContextActions;
};

const baseFieldsArray: LogFieldsResponseProps[] = [
  {
    'entries/message': {
      data_type: 'string',
      field_type: 'entry',
      artifacts: '',
      mutable: 'false',
      created_at: '2025-01-01T00:00:00Z',
    },
  },
];

const makeInitialState = (): Partial<IStoreState> => ({
  projects: [mockProjectId],
  activeProjectId: mockProjectId,
  activeInterfaceId: mockInterfaceId,
  activeTabId: mockTabId,
  projectsById: { [mockProjectId]: mockProject },
  interfacesById: { [mockInterfaceId]: mockInterface },
  tabsById: { [mockTabId]: mockTab },
  tilesById: { [mockTileId]: mockTile },
});

const makeTableTileData = (): TileData => ({
  id: mockTileId,
  name: mockTile.name,
  position: mockTile.position,
  type: 'Table',
  tab_id: mockTabId,
  visible: true,
  locked: false,
  table: mockTile.table,
  context: mockTile.context,
  column_context: mockTile.column_context,
  grouping: mockTile.grouping,
  table_tile: {
    limit: 20,
    offset: 0,
    group_limit: 20,
    group_offset: 0,
  } as TableTileData,
} as TileData);

function TestComponent({
  onResult,
  actions,
  options,
}: {
  onResult: (data: CompleteTabData) => void;
  actions: TabDataActions;
  options?: Parameters<ReturnType<typeof useTabDataOptimistic>['buildCompleteTabData']>[5];
}) {
  const { buildCompleteTabData } = useTabDataOptimistic();

  useEffect(() => {
    (async () => {
      const result = await buildCompleteTabData(
        mockInterfaceId,
        mockTabId,
        mockTab.name!,
        mockProjectId,
        actions,
        options ?? {},
      );
      onResult(result);
    })();
  }, [buildCompleteTabData, onResult, actions, options]);

  return null;
}

describe('useTabDataOptimistic', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('buildCompleteTabData returns lightweight structure and skips heavy work when skipTileData is true', async () => {
    const tileData = makeTableTileData();

    // Mock fetch for /api/tile endpoint (implementation uses direct fetch)
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/tile')) {
        return {
          ok: true,
          status: 200,
          json: async () => [tileData],
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });

    const tileActions = {
      list: vi.fn(async () => [tileData]),
    } as unknown as GranularTileActions;

    const tabActions = {} as GranularTabActions;
    const fieldsActions = {} as FieldsActions;
    const logsActions = {} as LogsActions;
    const projectsActions = {} as ProjectsActions;
    const contextActions = {} as ContextActions;

    const actions: TabDataActions = {
      tabActions,
      tileActions,
      fieldsActions,
      logsActions,
      projectsActions,
      contextActions,
    };

    // Spy on heavy helpers to ensure they are not called in lightweight mode
    const fetchProjectsContextsFieldsSpy = vi.spyOn(
      optimisticModule,
      'fetchProjectsContextsFields',
    );
    const updateTabArgumentsSpy = vi.spyOn(
      optimisticModule,
      'updateTabArguments',
    );
    const buildOptimisticTableDataItemSpy = vi.spyOn(
      optimisticModule,
      'buildOptimisticTableDataItem',
    );
    const buildOptimisticPlotDataItemSpy = vi.spyOn(
      optimisticModule,
      'buildOptimisticPlotDataItem',
    );

    const onResult = vi.fn();

    render(
      <TestComponent
        onResult={onResult}
        actions={actions}
        options={{ skipTileData: true }}
      />,
      { initialState: makeInitialState() },
    );

    await waitFor(() => {
      expect(onResult).toHaveBeenCalledTimes(1);
    }, { timeout: 5000 });

    const result = onResult.mock.calls[0][0] as CompleteTabData;

    // Tab data comes from the store
    expect(result.tabData.id).toBe(mockTabId);
    expect(result.tabData.name).toBe(mockTab.name);

    // Tiles are loaded via fetch and partitioned correctly
    expect(mockFetch).toHaveBeenCalled();
    expect(result.tiles).toHaveLength(1);
    expect(result.tiles[0].id).toBe(mockTileId);
    expect(result.tableTiles).toHaveLength(1);
    expect(result.plotTiles).toHaveLength(0);

    // Lightweight mode does not fetch fields/metrics or build per-tile data
    expect(result.fields).toEqual([]);
    expect(result.tableArguments).toEqual({});
    expect(result.plotArguments).toEqual({});
    expect(result.tileDataItems).toEqual({});

    // Heavy helpers are never invoked when skipTileData is true
    expect(fetchProjectsContextsFieldsSpy).not.toHaveBeenCalled();
    expect(updateTabArgumentsSpy).not.toHaveBeenCalled();
    expect(buildOptimisticTableDataItemSpy).not.toHaveBeenCalled();
    expect(buildOptimisticPlotDataItemSpy).not.toHaveBeenCalled();
  });

  it('buildCompleteTabData calls shared optimistic helpers and builds tileDataItems when skipTileData is false', async () => {
    const tileData = makeTableTileData();

    // Mock fetch for /api/tile endpoint
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/tile')) {
        return {
          ok: true,
          status: 200,
          json: async () => [tileData],
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });

    const tileActions = {
      list: vi.fn(async () => [tileData]),
    } as unknown as GranularTileActions;

    const tabActions = {} as GranularTabActions;
    const fieldsActions = {} as FieldsActions;
    const logsActions = {} as LogsActions;
    const projectsActions = {} as ProjectsActions;
    const contextActions = {} as ContextActions;

    const actions: TabDataActions = {
      tabActions,
      tileActions,
      fieldsActions,
      logsActions,
      projectsActions,
      contextActions,
    };

    // Stub shared helpers to avoid hitting real data-fetching logic
    const fetchProjectsContextsFieldsSpy = vi
      .spyOn(optimisticModule, 'fetchProjectsContextsFields')
      .mockResolvedValue({
        projects: [mockProjectId],
        contexts: [],
        fieldsArray: baseFieldsArray,
      });

    const updateTabArgumentsSpy = vi
      .spyOn(optimisticModule, 'updateTabArguments')
      .mockResolvedValue({
        tableArguments: {},
        plotArguments: {},
      });

    const buildOptimisticTableDataItemSpy = vi
      .spyOn(optimisticModule, 'buildOptimisticTableDataItem')
      .mockResolvedValue({
        columnContexts: [],
        fields: baseFieldsArray[0],
        totalCount: 0,
        entriesProperties: [],
        paramsProperties: [],
        logs: [],
        params: {} as LogItemProps,
        isLoading: false,
        error: undefined,
      });

    const buildOptimisticPlotDataItemSpy = vi
      .spyOn(optimisticModule, 'buildOptimisticPlotDataItem')
      .mockResolvedValue({
        plotLogs: [],
        plotFields: baseFieldsArray[0],
      });

    const onResult = vi.fn();

    render(
      <TestComponent
        onResult={onResult}
        actions={actions}
        options={{ skipTileData: false }}
      />,
      { initialState: makeInitialState() },
    );

    await waitFor(() => {
      expect(onResult).toHaveBeenCalledTimes(1);
    }, { timeout: 5000 });

    const result = onResult.mock.calls[0][0] as CompleteTabData;

    // Tab and tiles are still correctly wired
    expect(result.tabData.id).toBe(mockTabId);
    expect(result.tiles).toHaveLength(1);

    // Shared helpers are invoked
    expect(fetchProjectsContextsFieldsSpy).toHaveBeenCalledTimes(1);
    expect(updateTabArgumentsSpy).toHaveBeenCalledTimes(1);
    expect(buildOptimisticTableDataItemSpy).toHaveBeenCalledTimes(1);
    // No plot tiles in this fixture, so plot builder is not called
    expect(buildOptimisticPlotDataItemSpy).not.toHaveBeenCalled();

    // tileDataItems includes an entry for our single table tile
    expect(Object.keys(result.tileDataItems)).toEqual([mockTileId]);
  });

  it('buildCompleteTabData reuses cached tiles and does not fetch when tiles are already in the cache', async () => {
    const tileData = makeTableTileData();

    // This test uses cached tiles, so fetch should not be called for tiles
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/tile')) {
        // Should not be called when cache is populated
        throw new Error('Unexpected fetch to /api/tile - should use cache');
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });

    const tileActions = {
      list: vi.fn(async () => [tileData]),
    } as unknown as GranularTileActions;

    const tabActions = {} as GranularTabActions;
    const fieldsActions = {} as FieldsActions;
    const logsActions = {} as LogsActions;
    const projectsActions = {} as ProjectsActions;
    const contextActions = {} as ContextActions;

    const actions: TabDataActions = {
      tabActions,
      tileActions,
      fieldsActions,
      logsActions,
      projectsActions,
      contextActions,
    };

    function CachedTilesTest({ onResult }: { onResult: (data: CompleteTabData) => void }) {
      const queryClient = useQueryClient();
      const { buildCompleteTabData } = useTabDataOptimistic();

      useEffect(() => {
        (async () => {
          // Seed tiles cache as if they were previously fetched
          queryClient.setQueryData(['tiles', mockTabId], [tileData]);

          const result = await buildCompleteTabData(
            mockInterfaceId,
            mockTabId,
            mockTab.name!,
            mockProjectId,
            actions,
            { skipTileData: true },
          );
          onResult(result);
        })();
      }, [buildCompleteTabData, onResult, queryClient]);

      return null;
    }

    const onResult = vi.fn();

    render(<CachedTilesTest onResult={onResult} />, {
      initialState: makeInitialState(),
    });

    await waitFor(() => {
      expect(onResult).toHaveBeenCalledTimes(1);
    }, { timeout: 5000 });

    const result = onResult.mock.calls[0][0] as CompleteTabData;

    // Tiles come from cache, no fetch calls for tiles
    // Note: mockFetch would throw if called with /api/tile
    expect(result.tiles).toHaveLength(1);
    expect(result.tiles[0].id).toBe(mockTileId);
  });
});
