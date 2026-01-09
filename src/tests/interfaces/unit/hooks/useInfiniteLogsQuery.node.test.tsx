import React, { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, screen, act } from '@/tests/interfaces/utils/render-with-providers';
import { QueryClient } from '@tanstack/react-query';
import { useInfiniteLogsQuery } from '@/hooks/Interfaces/Query/useInfiniteLogsQuery';
import type { LogsActions } from '@/types/interfaces/grid';
import type { LogProps } from '@/types/interfaces/logs';
import * as logsCore from '@/utils/interfaces/logsCore';

// Mock useTableTile so we can observe infinite query key registration without touching real store logic
const addInfiniteQueryKey = vi.fn();

vi.mock('@/contexts/hooks/tile/useTableTile', () => ({
  useTableTile: () => ({
    tableTileActions: {
      addInfiniteQueryKey,
    },
  }),
}));

type HookParams = Parameters<typeof useInfiniteLogsQuery>[0];
type HookResult = ReturnType<typeof useInfiniteLogsQuery>;

function makeLog(id: string, message: string): LogProps {
  return {
    type: 'ungrouped',
    id,
    ts: '2025-01-01T00:00:00Z',
    params: { level: 'info' },
    entries: { message },
    derivedEntries: {},
    clippedFields: {},
  };
}

function TestComponent({
  params,
  onResult,
}: {
  params: HookParams;
  onResult: (result: HookResult) => void;
}) {
  const result = useInfiniteLogsQuery(params);

  // Capture the result whenever it changes
  useEffect(() => {
    onResult(result);
  }, [result, onResult]);

  return (
    <div>
      <button onClick={() => result.fetchNextPage()} data-testid="load-more">
        Load More
      </button>
    </div>
  );
}

describe('useInfiniteLogsQuery', () => {
  beforeEach(() => {
    addInfiniteQueryKey.mockClear();
  });

  it('fetches first page via fetchLogsCore and calls updateLogs in append mode', async () => {
    const logs: LogProps[] = [makeLog('log-1', 'First'), makeLog('log-2', 'Second')];

    const fetchLogsCoreSpy = vi.spyOn(logsCore, 'fetchLogsCore').mockResolvedValue({
      response: {
        params: {},
        logs,
        count: logs.length,
        groups: {},
      },
      convertedLogs: logs,
      totalCount: logs.length,
      currentCount: logs.length,
      hasMore: false,
      useGroupPagination: false,
      updatedFilterExpression: null,
      updatedGroupingExpression: null,
      targetGroupFilters: [],
      effectiveLimit: 20,
      effectiveOffset: 0,
    });

    const updateLogs = vi.fn(() => ({ globalOffset: 0, groupOffset: 0 }));

    const logsActions = {
      create: vi.fn(),
      get: vi.fn(),
      getLatest: vi.fn(),
      getMetrics: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    } as unknown as LogsActions;

    const params: HookParams = {
      tileId: 'tile-1',
      tabId: 'tab-1',
      projectId: 'project-1',
      context: null,
      columnContext: null,
      filterExpression: null,
      sortingExpression: null,
      groupingExpression: null,
      groupSortingExpression: null,
      limit: 20,
      groupLimit: 20,
      logsActions,
      updateLogs,
      enabled: true,
      bidirectional: {
        enabled: false,
        maxPagesInMemory: 5,
        enableBackwardLoading: true,
        enableForwardLoading: true,
      },
    };

    const onResult = vi.fn();

    render(<TestComponent params={params} onResult={onResult} />);

    await waitFor(() => {
      expect(onResult).toHaveBeenCalled();
      const latest = onResult.mock.calls[onResult.mock.calls.length - 1][0] as HookResult;
      // The first page of data should reflect the converted logs from fetchLogsCore
      expect(latest.data?.pages[0].data).toEqual(logs);
    });

    // Core fetch was invoked with our parameters
    expect(fetchLogsCoreSpy).toHaveBeenCalledTimes(1);
    const coreParams = fetchLogsCoreSpy.mock.calls[0][0];
    expect(coreParams.projectId).toBe('project-1');
    expect(coreParams.limit).toBe(20);
    expect(coreParams.groupLimit).toBe(20);

    // updateLogs was called in append mode for forward pagination
    expect(updateLogs).toHaveBeenCalled();
    const [, mode] = updateLogs.mock.calls[0] as any;
    expect(mode).toBe('append');

    // addInfiniteQueryKey should be called at least once to register the query key
    expect(addInfiniteQueryKey).toHaveBeenCalled();

    fetchLogsCoreSpy.mockRestore();
  });

  it('sliding window: respects maxPagesInMemory by dropping old pages', async () => {
    // We will simulate fetching 5 pages when maxPagesInMemory is 3.
    // The pages should end up being [2, 3, 4] (indices).
    const maxPages = 3;

    const fetchLogsCoreSpy = vi.spyOn(logsCore, 'fetchLogsCore').mockImplementation(async (p) => {
      const pageIndex = (p.offset || 0) / (p.limit || 20);
      const logs = [makeLog(`log-p${pageIndex}`, `Page ${pageIndex}`)];
      return {
        response: {
          params: {},
          logs,
          count: 1,
          groups: {},
        },
        convertedLogs: logs,
        totalCount: 100, // Plenty more
        currentCount: 1,
        hasMore: true,
        useGroupPagination: false,
        updatedFilterExpression: null,
        updatedGroupingExpression: null,
        targetGroupFilters: [],
        effectiveLimit: 20,
        effectiveOffset: p.offset || 0,
      };
    });

    const params: HookParams = {
      tileId: 'tile-sliding',
      tabId: 'tab-sliding',
      projectId: 'project-sliding',
      context: null,
      columnContext: null,
      filterExpression: null,
      sortingExpression: null,
      groupingExpression: null,
      groupSortingExpression: null,
      limit: 20,
      groupLimit: 20,
      logsActions: {} as LogsActions,
      updateLogs: vi.fn(() => ({ globalOffset: 0, groupOffset: 0 })),
      enabled: true,
      bidirectional: {
        enabled: true, // Must enable bidirectional for maxPages to apply
        maxPagesInMemory: maxPages,
        enableBackwardLoading: true,
        enableForwardLoading: true,
      },
    };

    let latestResult: HookResult | undefined;
    const onResult = (res: HookResult) => {
      latestResult = res;
    };

    render(<TestComponent params={params} onResult={onResult} />);

    // Wait for initial load (Page 0)
    await waitFor(() => {
      expect(latestResult?.data?.pages).toHaveLength(1);
      expect(latestResult?.data?.pages[0].pageIndex).toBe(0);
    });

    // Fetch Page 1
    await act(async () => {
      await latestResult?.fetchNextPage();
    });
    await waitFor(() => expect(latestResult?.data?.pages).toHaveLength(2));

    // Fetch Page 2
    await act(async () => {
      await latestResult?.fetchNextPage();
    });
    await waitFor(() => expect(latestResult?.data?.pages).toHaveLength(3));

    // Fetch Page 3 (Total 4 pages fetched, max is 3. Page 0 should be dropped)
    await act(async () => {
      await latestResult?.fetchNextPage();
    });
    await waitFor(() => {
      // React Query with maxPages should keep the last 3 pages
      expect(latestResult?.data?.pages).toHaveLength(3);
      // Verify we have pages 1, 2, 3
      const indices = latestResult?.data?.pages.map((p) => p.pageIndex);
      expect(indices).toEqual([1, 2, 3]);
    });

    fetchLogsCoreSpy.mockRestore();
  });

  it('supports backward pagination with prepend mode when bidirectional is enabled', async () => {
    const limit = 10;
    const pages: Record<number, LogProps[]> = {
      0: [makeLog('log-p0', 'Page 0')],
      1: [makeLog('log-p1', 'Page 1')],
      2: [makeLog('log-p2', 'Page 2')],
      3: [makeLog('log-p3', 'Page 3')],
    };

    const fetchLogsCoreSpy = vi.spyOn(logsCore, 'fetchLogsCore').mockImplementation(async (p) => {
      const pageIndex = (p.offset || 0) / (p.limit || limit);
      const logs = pages[pageIndex] || [];
      return {
        response: {
          params: {},
          logs,
          count: logs.length,
          groups: {},
        },
        convertedLogs: logs,
        totalCount: 4 * logs.length,
        currentCount: logs.length,
        hasMore: pageIndex < 3,
        useGroupPagination: false,
        updatedFilterExpression: null,
        updatedGroupingExpression: null,
        targetGroupFilters: [],
        effectiveLimit: limit,
        effectiveOffset: p.offset || 0,
      };
    });

    const updateLogs = vi.fn(() => ({ globalOffset: 0, groupOffset: 0 }));

    const params: HookParams = {
      tileId: 'tile-bidir',
      tabId: 'tab-bidir',
      projectId: 'project-bidir',
      context: null,
      columnContext: null,
      filterExpression: null,
      sortingExpression: null,
      groupingExpression: null,
      groupSortingExpression: null,
      limit,
      groupLimit: limit,
      logsActions: {} as LogsActions,
      updateLogs,
      enabled: true,
      bidirectional: {
        enabled: true,
        maxPagesInMemory: 3,
        enableBackwardLoading: true,
        enableForwardLoading: true,
      },
    };

    let latestResult: HookResult | undefined;
    const onResult = (res: HookResult) => {
      latestResult = res;
    };

    render(<TestComponent params={params} onResult={onResult} />);

    // Load 4 pages forward so that our window contains indices [1, 2, 3]
    await waitFor(() => {
      expect(latestResult?.data?.pages).toHaveLength(1);
      expect(latestResult?.data?.pages[0].pageIndex).toBe(0);
    });

    await act(async () => {
      await latestResult?.fetchNextPage();
      await latestResult?.fetchNextPage();
      await latestResult?.fetchNextPage();
    });

    await waitFor(() => {
      const indices = latestResult?.data?.pages.map((p) => p.pageIndex);
      expect(indices).toEqual([1, 2, 3]);
    });

    // Now fetch a previous page; this should request pageIndex 0 and use prepend mode
    updateLogs.mockClear();
    await act(async () => {
      await latestResult?.fetchPreviousPage();
    });

    await waitFor(() => {
      expect(updateLogs).toHaveBeenCalled();
    });

    // At least one call during the backward fetch should use prepend mode
    const modes = updateLogs.mock.calls.map((call) => (call as any)[1]);
    expect(modes).toContain('prepend');

    // We should now have a window that includes pageIndex 0
    const indicesAfterBackward = latestResult!.data!.pages.map((p) => p.pageIndex);
    expect(indicesAfterBackward).toContain(0);

    fetchLogsCoreSpy.mockRestore();
  });

  it('stops loading more pages when hasMore is false for ungrouped logs', async () => {
    const limit = 5;
    const logs: LogProps[] = [makeLog('log-1', 'Only page')];

    const fetchLogsCoreSpy = vi.spyOn(logsCore, 'fetchLogsCore').mockResolvedValue({
      response: {
        params: {},
        logs,
        count: logs.length,
        groups: {},
      },
      convertedLogs: logs,
      totalCount: logs.length,
      currentCount: logs.length,
      hasMore: false,
      useGroupPagination: false,
      updatedFilterExpression: null,
      updatedGroupingExpression: null,
      targetGroupFilters: [],
      effectiveLimit: limit,
      effectiveOffset: 0,
    });

    const params: HookParams = {
      tileId: 'tile-no-more',
      tabId: 'tab-no-more',
      projectId: 'project-no-more',
      context: null,
      columnContext: null,
      filterExpression: null,
      sortingExpression: null,
      groupingExpression: null,
      groupSortingExpression: null,
      limit,
      groupLimit: limit,
      logsActions: {} as LogsActions,
      updateLogs: vi.fn(() => ({ globalOffset: 0, groupOffset: 0 })),
      enabled: true,
      bidirectional: {
        enabled: true,
        maxPagesInMemory: 5,
        enableBackwardLoading: true,
        enableForwardLoading: true,
      },
    };

    let latestResult: HookResult | undefined;
    const onResult = (res: HookResult) => {
      latestResult = res;
    };

    render(<TestComponent params={params} onResult={onResult} />);

    await waitFor(() => {
      expect(latestResult?.data?.pages).toHaveLength(1);
      expect(latestResult?.hasNextPage).toBe(false);
    });

    const callsBefore = fetchLogsCoreSpy.mock.calls.length;
    await act(async () => {
      await latestResult?.fetchNextPage();
    });
    const callsAfter = fetchLogsCoreSpy.mock.calls.length;
    // No additional page fetch should have been triggered
    expect(callsAfter).toBe(callsBefore);

    fetchLogsCoreSpy.mockRestore();
  });

  it('stops loading more pages when hasMore is false for grouped logs', async () => {
    const limit = 5;
    const logs: LogProps[] = [makeLog('log-1', 'Grouped page')];

    const fetchLogsCoreSpy = vi.spyOn(logsCore, 'fetchLogsCore').mockResolvedValue({
      response: {
        params: {},
        logs,
        count: logs.length,
        groups: {},
      },
      convertedLogs: logs,
      totalCount: logs.length,
      currentCount: logs.length,
      hasMore: false,
      useGroupPagination: true,
      updatedFilterExpression: null,
      updatedGroupingExpression: null,
      targetGroupFilters: [],
      effectiveLimit: limit,
      effectiveOffset: 0,
    });

    const params: HookParams = {
      tileId: 'tile-no-more-grouped',
      tabId: 'tab-no-more-grouped',
      projectId: 'project-no-more-grouped',
      context: null,
      columnContext: null,
      filterExpression: null,
      sortingExpression: null,
      groupingExpression: 'entries/level',
      groupSortingExpression: null,
      limit,
      groupLimit: limit,
      logsActions: {} as LogsActions,
      updateLogs: vi.fn(() => ({ globalOffset: 0, groupOffset: 0 })),
      enabled: true,
      bidirectional: {
        enabled: true,
        maxPagesInMemory: 5,
        enableBackwardLoading: true,
        enableForwardLoading: true,
      },
    };

    let latestResult: HookResult | undefined;
    const onResult = (res: HookResult) => {
      latestResult = res;
    };

    render(<TestComponent params={params} onResult={onResult} />);

    await waitFor(() => {
      expect(latestResult?.data?.pages).toHaveLength(1);
      expect(latestResult?.hasNextPage).toBe(false);
    });

    const callsBefore = fetchLogsCoreSpy.mock.calls.length;
    await act(async () => {
      await latestResult?.fetchNextPage();
    });
    const callsAfter = fetchLogsCoreSpy.mock.calls.length;
    expect(callsAfter).toBe(callsBefore);

    fetchLogsCoreSpy.mockRestore();
  });

  it('creates a new query when filterExpression changes and does not reuse old pages', async () => {
    const makeLogsForFilter = (filter: string | null): LogProps[] => {
      const label = filter ?? 'none';
      return [makeLog(`log-${label}`, `Filter ${label}`)];
    };

    const fetchLogsCoreSpy = vi.spyOn(logsCore, 'fetchLogsCore').mockImplementation(async (p) => {
      const logs = makeLogsForFilter(p.filterExpression ?? null);
      return {
        response: {
          params: {},
          logs,
          count: logs.length,
          groups: {},
        },
        convertedLogs: logs,
        totalCount: logs.length,
        currentCount: logs.length,
        hasMore: false,
        useGroupPagination: false,
        updatedFilterExpression: p.filterExpression,
        updatedGroupingExpression: null,
        targetGroupFilters: [],
        effectiveLimit: p.limit || 20,
        effectiveOffset: p.offset || 0,
      };
    });

    const logsActions = {
      create: vi.fn(),
      get: vi.fn(),
      getLatest: vi.fn(),
      getMetrics: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    } as unknown as LogsActions;

    const baseParams: any = {
      tileId: 'tile-params',
      tabId: 'tab-params',
      projectId: 'project-params',
      context: null,
      columnContext: null,
      filterExpression: null,
      sortingExpression: null,
      groupingExpression: null,
      groupSortingExpression: null,
      limit: 20,
      groupLimit: 20,
      logsActions,
      updateLogs: vi.fn(() => ({ globalOffset: 0, groupOffset: 0 })),
      enabled: true,
      bidirectional: {
        enabled: false,
        maxPagesInMemory: 5,
        enableBackwardLoading: true,
        enableForwardLoading: true,
      },
    };

    let latestResult: HookResult | undefined;
    const onResult = (res: HookResult) => {
      latestResult = res;
    };

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { rerender } = render(
      <TestComponent
        params={{ ...baseParams, filterExpression: 'level=info' }}
        onResult={onResult}
      />,
      { queryClient }
    );

    await waitFor(() => {
      expect(latestResult?.data?.pages?.[0].data).toBeDefined();
    });

    const firstPageData = latestResult!.data!.pages[0].data;
    // There should be at least one core call with the initial filter
    expect(
      fetchLogsCoreSpy.mock.calls.some((call) => call[0].filterExpression === 'level=info')
    ).toBe(true);

    // Change filterExpression and rerender with the same QueryClient
    rerender(
      <TestComponent
        params={{ ...baseParams, filterExpression: 'level=error' }}
        onResult={onResult}
      />
    );

    await waitFor(() => {
      expect(latestResult?.data?.pages?.[0].data).toBeDefined();
      const latestPage = latestResult!.data!.pages[0].data as LogProps[];
      expect(latestPage[0].entries.message).toContain('level=error');
    });

    expect(
      fetchLogsCoreSpy.mock.calls.some((call) => call[0].filterExpression === 'level=error')
    ).toBe(true);

    const secondPageData = latestResult!.data!.pages[0].data;
    expect(secondPageData).not.toEqual(firstPageData);

    fetchLogsCoreSpy.mockRestore();
  });
});
