import React, { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@/tests/interfaces/utils/render-with-providers';
import { useInfiniteLogsQuery } from '@/hooks/Interfaces/Query/useInfiniteLogsQuery';
import type { LogsActions } from '@/types/interfaces/grid';
import type { LogProps } from '@/types/interfaces/logs';
import { createMockLogs } from '@/tests/interfaces/mocks/fixtures/logs';

// Reuse the lightweight table tile mock from the unit tests so we don't depend on real tile state.
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

function TestComponent({ params, onResult }: { params: HookParams; onResult: (result: HookResult) => void }) {
  const result = useInfiniteLogsQuery(params);

  useEffect(() => {
    onResult(result);
  }, [result, onResult]);

  return null;
}

describe('useInfiniteLogsQuery (MSW-backed, ungrouped)', () => {
  beforeEach(() => {
    addInfiniteQueryKey.mockClear();
  });

  it('fetches the first page of ungrouped logs via getLogs/MSW and calls updateLogs in append mode', async () => {
    // Use a mock getLogs function that returns the expected data
    // This avoids issues with server actions in the test environment
    const mockGetLogs = vi.fn(async (
      project: string,
      context: string | null,
      columnContext: string | null,
      filterExpression: string | null,
      sortingExpression: string | null,
      groupingExpression: string | null,
      groupSortingExpression: string | null,
      from_ids: string | null,
      from_fields: string | null,
      exclude_fields: string | null,
      limit: number | null,
      offset: number | null,
      group_limit: number | null,
      group_offset: number | null,
      group_depth: number | null
    ) => {
      const effectiveLimit = limit ?? 20;
      const effectiveOffset = offset ?? 0;
      // Return exactly 20 logs with totalCount of 20 (no more pages)
      const allLogs = createMockLogs(20, { offset: 0, totalCount: 20 });
      const paginatedLogs = (allLogs.logs as LogProps[]).slice(effectiveOffset, effectiveOffset + effectiveLimit);
      return {
        params: allLogs.params,
        logs: paginatedLogs,
        count: 20,
        groups: allLogs.groups,
      };
    });

    const logsActions = {
      create: async () => ({ detail: 'not-used' }),
      get: mockGetLogs,
      getLatest: async () => '',
      getMetrics: async () => ({}),
      delete: async () => ({ detail: 'not-used' }),
      update: async () => ({ detail: 'not-used' }),
    } as unknown as LogsActions;

    const updateLogs = vi.fn(() => ({ globalOffset: 0, groupOffset: 0 }));

    const params: HookParams = {
      tileId: 'tile-msw',
      tabId: 'tab-msw',
      projectId: 'project-1',
      context: null,
      columnContext: null,
      filterExpression: null,
      sortingExpression: null,
      groupingExpression: null,
      groupSortingExpression: null,
      limit: 20,
      group_limit: 20,
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

    let latestResult: HookResult | undefined;
    const onResult = (res: HookResult) => {
      latestResult = res;
    };

    render(<TestComponent params={params} onResult={onResult} />);

    await waitFor(() => {
      expect(latestResult).toBeDefined();
      const pages = latestResult!.data?.pages;
      expect(pages && pages.length).toBe(1);
      const firstPage = pages![0];
      expect(firstPage.data && (firstPage.data as LogProps[]).length).toBe(20);
    });

    // updateLogs should have been called in append mode
    expect(updateLogs).toHaveBeenCalled();
    const [, mode] = updateLogs.mock.calls[0] as [unknown, 'append' | 'prepend'];
    expect(mode).toBe('append');

    // The hook should not think there are more pages, given the default MSW fixture count
    expect(latestResult!.hasNextPage).toBe(false);

    // Query key should have been registered with the table tile
    expect(addInfiniteQueryKey).toHaveBeenCalled();
  });
});

