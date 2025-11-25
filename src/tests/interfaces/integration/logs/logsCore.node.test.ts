import { describe, it, expect, vi } from 'vitest';
import { fetchLogsCore, type CoreLogFetchParams } from '@/utils/interfaces/logsCore';
import type { LogsActions } from '@/types/interfaces/grid';
import type { LogProps } from '@/types/interfaces/logs';
import { getLogs } from '@/lib/interfaces/logs';

describe('logsCore + getLogs (MSW integration)', () => {
  it('fetchLogsCore uses logsActions.get and returns correct metadata for ungrouped logs', async () => {
    const apiKey = 'test-api-key';
    const getLogsFn = await getLogs(apiKey);

    const logsActions = {
      create: async () => ({ detail: 'not-used' }),
      get: getLogsFn,
      getLatest: async () => '',
      getMetrics: async () => ({}),
      delete: async () => ({ detail: 'not-used' }),
      update: async () => ({ detail: 'not-used' }),
    } as unknown as LogsActions;

    const params: CoreLogFetchParams = {
      projectId: 'project-1',
      context: null,
      columnContext: null,
      filterExpression: null,
      sortingExpression: null,
      groupingExpression: null,
      groupSortingExpression: null,
      limit: 20,
      offset: 0,
      group_limit: 20,
      group_offset: 0,
      logsActions,
    };

    const result = await fetchLogsCore(params);

    // MSW interfaceHandlers return 20 ungrouped logs by default
    expect(result.response.count).toBe(20);
    expect(result.totalCount).toBe(20);
    expect(result.currentCount).toBe(20);
    expect(result.hasMore).toBe(false);
    expect(result.useGroupPagination).toBe(false);
    expect(result.effectiveLimit).toBe(20);
    expect(result.effectiveOffset).toBe(0);

    // Converted logs should mirror the raw logs, with type set to "ungrouped"
    expect(result.convertedLogs.length).toBe(20);
    const first = result.convertedLogs[0] as LogProps;
    expect(first.type).toBe('ungrouped');
  });

  it('fetchLogsCore passes limit/offset vs group_limit/group_offset correctly based on groupingExpression', async () => {
    const getSpy = vi.fn(async () => ({
      params: {},
      logs: [],
      count: 0,
      groups: {},
    }));

    const logsActions = {
      create: vi.fn(),
      get: getSpy,
      getLatest: vi.fn(),
      getMetrics: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    } as unknown as LogsActions;

    // Ungrouped call
    const ungroupedParams: CoreLogFetchParams = {
      projectId: 'project-1',
      context: null,
      columnContext: null,
      filterExpression: null,
      sortingExpression: null,
      groupingExpression: null,
      groupSortingExpression: null,
      limit: 20,
      offset: 40,
      group_limit: 20,
      group_offset: 2,
      logsActions,
    };

    await fetchLogsCore(ungroupedParams);

    expect(getSpy).toHaveBeenCalledTimes(1);
    const ungroupedArgs = getSpy.mock.calls[0];
    // limit/offset should be used, group_* should be null
    // Args: project, context, columnContext, filter, sorting, grouping, groupSorting,
    //       from_ids, from_fields, exclude_fields, limit, offset, group_limit, group_offset, group_depth
    expect(ungroupedArgs[10]).toBe(20); // limit
    expect(ungroupedArgs[11]).toBe(40); // offset
    expect(ungroupedArgs[12]).toBeNull(); // group_limit
    expect(ungroupedArgs[13]).toBeNull(); // group_offset
    expect(ungroupedArgs[14]).toBeNull(); // group_depth

    getSpy.mockClear();

    // Grouped call
    const groupedParams: CoreLogFetchParams = {
      projectId: 'project-1',
      context: null,
      columnContext: null,
      filterExpression: null,
      sortingExpression: null,
      groupingExpression: 'entries/group',
      groupSortingExpression: null,
      limit: 20,
      offset: 0,
      group_limit: 50,
      group_offset: 10,
      logsActions,
    };

    await fetchLogsCore(groupedParams);

    expect(getSpy).toHaveBeenCalledTimes(1);
    const groupedArgs = getSpy.mock.calls[0];
    // group_* should be used, limit/offset should be null
    expect(groupedArgs[10]).toBeNull(); // limit
    expect(groupedArgs[11]).toBeNull(); // offset
    expect(groupedArgs[12]).toBe(50); // group_limit
    expect(groupedArgs[13]).toBe(10); // group_offset
    expect(groupedArgs[14]).toBe(0); // group_depth
  });
});


