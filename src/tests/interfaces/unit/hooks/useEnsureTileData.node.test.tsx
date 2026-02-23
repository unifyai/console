import React, { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@/tests/interfaces/utils/render-with-providers';
import { useQueryClient } from '@tanstack/react-query';
import { useEnsureTableTileData } from '@/hooks/Interfaces/Query/useEnsureTableTileData';
import { useEnsurePlotTileData } from '@/hooks/Interfaces/Query/useEnsurePlotTileData';
import type {
  GranularTileActions,
  ProjectsActions,
  ContextActions,
  FieldsActions,
  LogsActions,
  TileData,
  TableDataItem,
  PlotDataItem,
} from '@/types/interfaces/grid';
import type { TableArguments, PlotArguments } from '@/types/interfaces/logs';
import * as optimisticModule from '@/utils/data/buildServerDataOptimistic';
import * as plotDataModule from '@/utils/data/buildPlotDataItem';

type EnsureActions = {
  tileActions: GranularTileActions;
  projectsActions: ProjectsActions;
  contextActions: ContextActions;
  fieldsActions: FieldsActions;
  logsActions: LogsActions;
};

const interfaceId = 'iface-1';
const tabId = 'tab-1';
const projectId = 'project-1';
const tableTileId = 'tile-table-1';
const plotTileId = 'tile-plot-1';

function EnsureTableFastPathTest({
  actions,
  onResult,
}: {
  actions: EnsureActions;
  onResult: (data: TableDataItem) => void;
}) {
  const queryClient = useQueryClient();
  const tableArguments: TableArguments = { [tabId]: {} as any };

  useEffect(() => {
    const tableDataItem: TableDataItem = {
      columnContexts: [],
      fields: {},
      totalCount: 42,
      error: undefined,
      entriesProperties: [],

      logs: [],

      isLoading: false,
    };
    queryClient.setQueryData(['tableDataItem', tableTileId], tableDataItem);
  }, [queryClient]);

  const query = useEnsureTableTileData({
    interfaceId,
    tabId,
    tileId: tableTileId,
    projectId,
    tableArguments,
    actions,
  });

  useEffect(() => {
    if (query.data) {
      onResult(query.data);
    }
  }, [query.data, onResult]);

  return null;
}

function EnsureTableColdPathTest({
  actions,
  onResult,
}: {
  actions: EnsureActions;
  onResult: (data: TableDataItem) => void;
}) {
  const tableArguments: TableArguments = { [tabId]: {} as any };
  const query = useEnsureTableTileData({
    interfaceId,
    tabId,
    tileId: tableTileId,
    projectId,
    tableArguments,
    actions,
  });

  useEffect(() => {
    if (query.data) {
      onResult(query.data);
    }
  }, [query.data, onResult]);

  return null;
}

function EnsurePlotFastPathTest({
  actions,
  onResult,
}: {
  actions: EnsureActions;
  onResult: (data: PlotDataItem) => void;
}) {
  const plotArguments: PlotArguments = { [tabId]: {} as any };

  const query = useEnsurePlotTileData({
    interfaceId,
    tabId,
    tileId: plotTileId,
    projectId,
    plotArguments,
    actions,
  });

  useEffect(() => {
    if (query.data) {
      onResult(query.data);
    }
  }, [query.data, onResult]);

  return null;
}

// Missing-dependency scenarios are guarded by dependenciesReady and will not trigger
// the query function by design, so we only implement a fast-path test here.

describe('useEnsureTableTileData', () => {
  it('returns cached TableDataItem and skips tileActions.list and builders when tableDataItem already exists', async () => {
    const tileActions = {
      list: vi.fn(),
    } as unknown as GranularTileActions;

    const actions: EnsureActions = {
      tileActions,
      projectsActions: {} as ProjectsActions,
      contextActions: {} as ContextActions,
      fieldsActions: {} as FieldsActions,
      logsActions: {} as LogsActions,
    };

    const fetchProjectsContextsFieldsSpy = vi
      .spyOn(optimisticModule, 'fetchProjectsContextsFields')
      .mockResolvedValue({ projects: [], contexts: [], fieldsArray: [] });

    const buildOptimisticTableDataItemSpy = vi
      .spyOn(optimisticModule, 'buildOptimisticTableDataItem')
      .mockResolvedValue({} as any);

    const onResult = vi.fn();

    render(<EnsureTableFastPathTest actions={actions} onResult={onResult} />);

    await waitFor(() => {
      expect(onResult).toHaveBeenCalledTimes(1);
    });

    expect(tileActions.list).not.toHaveBeenCalled();
    expect(fetchProjectsContextsFieldsSpy).not.toHaveBeenCalled();
    expect(buildOptimisticTableDataItemSpy).not.toHaveBeenCalled();
  });

  it('lists tiles, fetches fields, and builds TableDataItem when cache is empty', async () => {
    const tableTile: TileData = {
      id: tableTileId,
      name: 'BaseTable',
      type: 'Table' as any,
      tabId: tabId,
      position: { x: 0, y: 0, width: 4, height: 4 } as any,
    } as any;

    const tileActions = {
      list: vi.fn(async () => [tableTile]),
    } as unknown as GranularTileActions;

    const actions: EnsureActions = {
      tileActions,
      projectsActions: {} as ProjectsActions,
      contextActions: {} as ContextActions,
      fieldsActions: {} as FieldsActions,
      logsActions: {} as LogsActions,
    };

    const mockFieldsArray: any[] = [{}];
    const expectedTableDataItem: TableDataItem = {
      columnContexts: [],
      fields: {},
      totalCount: 10,
      error: undefined,
      entriesProperties: [],

      logs: [],

      isLoading: false,
    };

    const fetchProjectsContextsFieldsSpy = vi
      .spyOn(optimisticModule, 'fetchProjectsContextsFields')
      .mockResolvedValue({
        projects: [projectId],
        contexts: [],
        fieldsArray: mockFieldsArray,
      });

    const buildOptimisticTableDataItemSpy = vi
      .spyOn(optimisticModule, 'buildOptimisticTableDataItem')
      .mockResolvedValue(expectedTableDataItem);

    const onResult = vi.fn();

    render(<EnsureTableColdPathTest actions={actions} onResult={onResult} />);

    await waitFor(() => {
      expect(onResult).toHaveBeenCalledTimes(1);
    });

    const result = onResult.mock.calls[0][0] as TableDataItem;

    expect(tileActions.list).toHaveBeenCalledTimes(1);
    expect(fetchProjectsContextsFieldsSpy).toHaveBeenCalledTimes(1);
    expect(buildOptimisticTableDataItemSpy).toHaveBeenCalledTimes(1);
    expect(result.totalCount).toBe(10);
  });

  it('surfaces an error when the target table tile cannot be found', async () => {
    const tileActions = {
      // Return an empty list so the tileId cannot be resolved
      list: vi.fn(async () => []),
    } as unknown as GranularTileActions;

    const actions: EnsureActions = {
      tileActions,
      projectsActions: {} as ProjectsActions,
      contextActions: {} as ContextActions,
      fieldsActions: {} as FieldsActions,
      logsActions: {} as LogsActions,
    };

    const tableArguments: TableArguments = { [tabId]: {} as any };

    function TableErrorTest({ onError }: { onError: (err: unknown) => void }) {
      const query = useEnsureTableTileData({
        interfaceId,
        tabId,
        tileId: tableTileId,
        projectId,
        tableArguments,
        actions,
      });

      useEffect(() => {
        if (query.isError && query.error) {
          onError(query.error);
        }
      }, [query.isError, query.error, onError]);

      return null;
    }

    const onError = vi.fn();

    render(<TableErrorTest onError={onError} />);

    await waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1);
    });

    const error = onError.mock.calls[0][0] as Error;
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toMatch(/Tile tile-table-1 not found in tab tab-1/);
  });

  it('surfaces errors from table data builders when they fail', async () => {
    const tableTile: TileData = {
      id: tableTileId,
      name: 'BaseTable',
      type: 'Table' as any,
      tabId: tabId,
      position: { x: 0, y: 0, width: 4, height: 4 } as any,
    } as any;

    const tileActions = {
      list: vi.fn(async () => [tableTile]),
    } as unknown as GranularTileActions;

    const actions: EnsureActions = {
      tileActions,
      projectsActions: {} as ProjectsActions,
      contextActions: {} as ContextActions,
      fieldsActions: {} as FieldsActions,
      logsActions: {} as LogsActions,
    };

    const mockFieldsArray: any[] = [{}];

    const fetchProjectsContextsFieldsSpy = vi
      .spyOn(optimisticModule, 'fetchProjectsContextsFields')
      .mockResolvedValue({
        projects: [projectId],
        contexts: [],
        fieldsArray: mockFieldsArray,
      });

    const buildError = new Error('buildOptimisticTableDataItem failed');
    const buildOptimisticTableDataItemSpy = vi
      .spyOn(optimisticModule, 'buildOptimisticTableDataItem')
      .mockRejectedValue(buildError);

    const tableArguments: TableArguments = { [tabId]: {} as any };

    function TableBuilderErrorTest({ onError }: { onError: (err: unknown) => void }) {
      const query = useEnsureTableTileData({
        interfaceId,
        tabId,
        tileId: tableTileId,
        projectId,
        tableArguments,
        actions,
      });

      useEffect(() => {
        if (query.isError && query.error) {
          onError(query.error);
        }
      }, [query.isError, query.error, onError]);

      return null;
    }

    const onError = vi.fn();

    render(<TableBuilderErrorTest onError={onError} />);

    await waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1);
    });

    const error = onError.mock.calls[0][0] as Error;
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain('buildOptimisticTableDataItem failed');

    fetchProjectsContextsFieldsSpy.mockRestore();
    buildOptimisticTableDataItemSpy.mockRestore();
  });
});

describe('useEnsurePlotTileData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('builds PlotDataItem when dependencies are ready and plot data is missing', async () => {
    const tileActions = {
      list: vi.fn(),
    } as unknown as GranularTileActions;

    const actions: EnsureActions = {
      tileActions,
      projectsActions: {} as ProjectsActions,
      contextActions: {} as ContextActions,
      fieldsActions: {} as FieldsActions,
      logsActions: {} as LogsActions,
    };

    // Stub getUsedTableNames so we don't rely on real plotTile internals
    const getUsedTableNamesSpy = vi
      .spyOn(plotDataModule, 'getUsedTableNames')
      .mockReturnValue(['BaseTable']);

    const expectedPlotDataItem: PlotDataItem = {
      plotLogs: [],
      plotFields: {},
    };

    const fetchProjectsContextsFieldsSpy = vi
      .spyOn(optimisticModule, 'fetchProjectsContextsFields')
      .mockResolvedValue({
        projects: [projectId],
        contexts: [],
        fieldsArray: [{}],
      });

    const buildOptimisticPlotDataItemSpy = vi
      .spyOn(optimisticModule, 'buildOptimisticPlotDataItem')
      .mockResolvedValue(expectedPlotDataItem);

    const onResult = vi.fn();

    // Seed tiles and their table data dependencies before rendering
    const { QueryClient } = require('@tanstack/react-query');
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const tableTile: TileData = {
      id: tableTileId,
      name: 'BaseTable',
      type: 'Table' as any,
      tabId: tabId,
      position: { x: 0, y: 0, width: 4, height: 4 } as any,
    } as any;

    const plotTile: TileData = {
      id: plotTileId,
      name: 'Plot1',
      type: 'Plot' as any,
      tabId: tabId,
      position: { x: 0, y: 0, width: 4, height: 4 } as any,
    } as any;

    queryClient.setQueryData(['tiles', tabId], [tableTile, plotTile]);
    queryClient.setQueryData(['tableDataItem', tableTileId], { dummy: true });

    render(<EnsurePlotFastPathTest actions={actions} onResult={onResult} />, {
      queryClient,
    });

    await waitFor(() => {
      expect(onResult).toHaveBeenCalledTimes(1);
    });

    const result = onResult.mock.calls[0][0] as PlotDataItem;

    expect(getUsedTableNamesSpy).toHaveBeenCalled();
    expect(fetchProjectsContextsFieldsSpy).toHaveBeenCalled();
    expect(buildOptimisticPlotDataItemSpy).toHaveBeenCalled();
    expect(result).toBe(expectedPlotDataItem);
    // No need to list tiles in this path because tiles are already seeded in cache
    expect(tileActions.list).not.toHaveBeenCalled();
  });

  it('does not build PlotDataItem when table dependencies lack tableDataItem cache', async () => {
    const tileActions = {
      list: vi.fn(),
    } as unknown as GranularTileActions;

    const actions: EnsureActions = {
      tileActions,
      projectsActions: {} as ProjectsActions,
      contextActions: {} as ContextActions,
      fieldsActions: {} as FieldsActions,
      logsActions: {} as LogsActions,
    };

    const getUsedTableNamesSpy = vi
      .spyOn(plotDataModule, 'getUsedTableNames')
      .mockReturnValue(['BaseTable']);

    const fetchProjectsContextsFieldsSpy = vi
      .spyOn(optimisticModule, 'fetchProjectsContextsFields')
      .mockResolvedValue({
        projects: [projectId],
        contexts: [],
        fieldsArray: [{}],
      });

    const buildOptimisticPlotDataItemSpy = vi
      .spyOn(optimisticModule, 'buildOptimisticPlotDataItem')
      .mockResolvedValue({
        plotLogs: [],
        plotFields: {},
      } as PlotDataItem);

    // Seed tiles but intentionally omit tableDataItem for the dependency
    const queryClient = new (require('@tanstack/react-query').QueryClient)();
    const tableTile: TileData = {
      id: tableTileId,
      name: 'BaseTable',
      type: 'Table' as any,
      tabId: tabId,
      position: { x: 0, y: 0, width: 4, height: 4 } as any,
    } as any;

    const plotTile: TileData = {
      id: plotTileId,
      name: 'Plot1',
      type: 'Plot' as any,
      tabId: tabId,
      position: { x: 0, y: 0, width: 4, height: 4 } as any,
    } as any;

    queryClient.setQueryData(['tiles', tabId], [tableTile, plotTile]);
    // Note: no ['tableDataItem', tableTileId] entry

    render(<EnsurePlotFastPathTest actions={actions} onResult={vi.fn()} />, {
      queryClient,
    });

    await waitFor(() => {
      expect(getUsedTableNamesSpy).toHaveBeenCalled();
      expect(buildOptimisticPlotDataItemSpy).not.toHaveBeenCalled();
    });

    // With missing tableDataItem, dependenciesReady is false, so neither fields nor plot data builders should run
    expect(fetchProjectsContextsFieldsSpy).not.toHaveBeenCalled();
  });

  it('surfaces errors from plot data builders when they fail', async () => {
    const tileActions = {
      list: vi.fn(),
    } as unknown as GranularTileActions;

    const actions: EnsureActions = {
      tileActions,
      projectsActions: {} as ProjectsActions,
      contextActions: {} as ContextActions,
      fieldsActions: {} as FieldsActions,
      logsActions: {} as LogsActions,
    };

    const getUsedTableNamesSpy = vi
      .spyOn(plotDataModule, 'getUsedTableNames')
      .mockReturnValue(['BaseTable']);

    const fetchProjectsContextsFieldsSpy = vi
      .spyOn(optimisticModule, 'fetchProjectsContextsFields')
      .mockResolvedValue({
        projects: [projectId],
        contexts: [],
        fieldsArray: [{}],
      });

    const buildError = new Error('buildOptimisticPlotDataItem failed');
    const buildOptimisticPlotDataItemSpy = vi
      .spyOn(optimisticModule, 'buildOptimisticPlotDataItem')
      .mockRejectedValue(buildError);

    const { QueryClient } = require('@tanstack/react-query');
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const tableTile: TileData = {
      id: tableTileId,
      name: 'BaseTable',
      type: 'Table' as any,
      tabId: tabId,
      position: { x: 0, y: 0, width: 4, height: 4 } as any,
    } as any;

    const plotTile: TileData = {
      id: plotTileId,
      name: 'Plot1',
      type: 'Plot' as any,
      tabId: tabId,
      position: { x: 0, y: 0, width: 4, height: 4 } as any,
    } as any;

    queryClient.setQueryData(['tiles', tabId], [tableTile, plotTile]);
    queryClient.setQueryData(['tableDataItem', tableTileId], { dummy: true });

    function PlotBuilderErrorTest({ onError }: { onError: (err: unknown) => void }) {
      const plotArguments: PlotArguments = { [tabId]: {} as any };
      const query = useEnsurePlotTileData({
        interfaceId,
        tabId,
        tileId: plotTileId,
        projectId,
        plotArguments,
        actions,
      });

      useEffect(() => {
        if (query.isError && query.error) {
          onError(query.error);
        }
      }, [query.isError, query.error, onError]);

      return null;
    }

    const onError = vi.fn();

    render(<PlotBuilderErrorTest onError={onError} />, {
      queryClient,
    });

    await waitFor(() => {
      const state = queryClient.getQueryState(['ensurePlotTileData', plotTileId, projectId]);
      expect(state?.status).toBe('error');
      const error = state?.error as Error;
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain('buildOptimisticPlotDataItem failed');
    });

    getUsedTableNamesSpy.mockRestore();
    fetchProjectsContextsFieldsSpy.mockRestore();
    buildOptimisticPlotDataItemSpy.mockRestore();
  });
});
