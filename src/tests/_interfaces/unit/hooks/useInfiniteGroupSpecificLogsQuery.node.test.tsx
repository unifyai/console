import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@/tests/_interfaces/utils/render-with-providers';
import { useInfiniteGroupSpecificLogsQuery } from '@/hooks/Interfaces/Query/useInfiniteLogsQuery';
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

type HookParams = Parameters<typeof useInfiniteGroupSpecificLogsQuery>[0];
type HookResult = ReturnType<typeof useInfiniteGroupSpecificLogsQuery>;

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
  const result = useInfiniteGroupSpecificLogsQuery(params);
  onResult(result);
  return null;
}

describe('useInfiniteGroupSpecificLogsQuery', () => {
  beforeEach(() => {
    addInfiniteQueryKey.mockClear();
  });

  it('fetches group-specific page via fetchLogsCore and calls updateLogs with group context', async () => {
    const logs: LogProps[] = [
      makeLog('log-1', 'Grouped First'),
      makeLog('log-2', 'Grouped Second'),
    ];

    const fetchLogsCoreSpy = vi.spyOn(logsCore, 'fetchLogsCore').mockResolvedValue({
      response: {
        logs,
        count: logs.length,
        groups: {},
      },
      convertedLogs: logs,
      totalCount: logs.length,
      currentCount: logs.length,
      hasMore: false,
      useGroupPagination: true,
      updatedFilterExpression: 'group-filter',
      updatedGroupingExpression: 'grouping',
      targetGroupFilters: [['entries/group', 'group-value']],
      effectiveLimit: 20,
      effectiveOffset: 0,
    });

    const updateLogs = vi.fn(() => ({ globalOffset: 0, groupOffset: 0 }));
    const onGroupOffsetChange = vi.fn();

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
      filteression: null,
      sortingExpression: null,
      groupingExpression: 'entries/group',
      groupSortingExpression: null,
      limit: 20,
      groupLimit: 20,
      logsActions,
      updateLogs,
      onGroupOffsetChange,
      groupId: 'entries/group:group-value',
      dataTypes: { 'entries/group': 'string' },
      fields: {
        'entries/group': {
          dataType: 'string',
          fieldType: 'entry',
          artifacts: '',
          mutable: 'false',
          createdAt: '2025-01-01T00:00:00Z',
        },
      },
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
      // The first page of group-specific data should reflect the converted logs from fetchLogsCore
      expect(latest.data?.pages[0].data).toEqual(logs);
    });

    // Core fetch was invoked with group-specific parameters
    expect(fetchLogsCoreSpy).toHaveBeenCalledTimes(1);
    const coreParams = fetchLogsCoreSpy.mock.calls[0][0];
    expect(coreParams.projectId).toBe('project-1');
    expect(coreParams.groupId).toBe('entries/group:group-value');
    expect(coreParams.groupLimit).toBe(20);

    // updateLogs was called with the group id and targetGroupFilters from the core result
    expect(updateLogs).toHaveBeenCalled();
    const updateCall = updateLogs.mock.calls[0] as any;
    expect(updateCall[2]).toBe('entries/group:group-value'); // targetGroupId
    expect(updateCall[3]).toEqual([['entries/group', 'group-value']]); // targetGroupFilters

    // addInfiniteQueryKey should be called to register the group-specific query key
    expect(addInfiniteQueryKey).toHaveBeenCalled();
  });
});
