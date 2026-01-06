import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@/tests/interfaces/utils/render-with-providers';
import { useInfiniteLogsQuery } from '@/hooks/Interfaces/Query/useInfiniteLogsQuery';
import type { LogsActions } from '@/types/interfaces/grid';
import * as logsCore from '@/utils/interfaces/logsCore';

type HookParams = Parameters<typeof useInfiniteLogsQuery>[0];
type HookResult = ReturnType<typeof useInfiniteLogsQuery>;

// Reuse the lightweight table-tile mock so we don't depend on real tile state.
const addInfiniteQueryKey = vi.fn();

vi.mock('@/contexts/hooks/tile/useTableTile', () => ({
  useTableTile: () => ({
    tableTileActions: {
      addInfiniteQueryKey,
    },
  }),
}));

function FlakyTestComponent({
  params,
  onResult,
}: {
  params: HookParams;
  onResult: (result: HookResult) => void;
}) {
  const result = useInfiniteLogsQuery(params);
  React.useEffect(() => {
    onResult(result);
  }, [result, onResult]);
  return null;
}

describe('useInfiniteLogsQuery (flaky backend scenarios via fetchLogsCore)', () => {
  it('surfaces an error when fetchLogsCore rejects (e.g. 500 from /api/logs)', async () => {
    const error = new Error('Internal Server Error');
    const fetchSpy = vi.spyOn(logsCore, 'fetchLogsCore').mockRejectedValue(error);

    const logsActions = {
      create: vi.fn(),
      get: vi.fn(), // never called because fetchLogsCore is mocked
      getLatest: vi.fn(),
      getMetrics: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    } as unknown as LogsActions;

    const params: HookParams = {
      tileId: 'tile-error',
      tabId: 'tab-error',
      projectId: 'project-error',
      context: null,
      columnContext: null,
      filterExpression: null,
      sortingExpression: null,
      groupingExpression: null,
      groupSortingExpression: null,
      limit: 20,
      group_limit: 20,
      logsActions,
      updateLogs: vi.fn(),
      enabled: true,
      bidirectional: {
        enabled: false,
        maxPagesInMemory: 3,
        enableBackwardLoading: true,
        enableForwardLoading: true,
      },
    };

    let latest: HookResult | undefined;
    const onResult = (res: HookResult) => {
      latest = res;
    };

    render(<FlakyTestComponent params={params} onResult={onResult} />);

    await waitFor(() => {
      expect(latest).toBeDefined();
      expect(latest!.isError).toBe(true);
      expect(String(latest!.error)).toContain('Internal Server Error');
    });

    expect(fetchSpy).toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});




