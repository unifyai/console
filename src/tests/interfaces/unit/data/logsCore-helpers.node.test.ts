import { describe, it, expect } from 'vitest';
import {
  buildLogQueryKey,
  hasNextPage,
  hasPreviousPage,
  getCurrentCount,
  getCurrentGroupCount,
  checkHasNextPage,
} from '@/utils/interfaces/logsCore';
import type { LogProps, GroupedLogProps } from '@/types/interfaces/logs';

describe('logsCore helper utilities', () => {
  it('buildLogQueryKey produces stable keys for infinite logs', () => {
    const baseParams = {
      tileId: 'tile-1',
      tabId: 'tab-1',
      projectId: 'project-1',
      context: 'default',
      columnContext: 'entries',
      filterExpression: 'foo=1',
      sortingExpression: 'ts@desc',
      groupingExpression: null,
      groupSortingExpression: null,
      limit: 20,
      groupLimit: 10,
    };

    const key1 = buildLogQueryKey('infinite', baseParams);
    const key2 = buildLogQueryKey('infinite', { ...baseParams });

    expect(key1).toEqual(key2);
  });

  it('buildLogQueryKey includes group-specific parameters with stable ordering', () => {
    const baseParams = {
      tileId: 'tile-1',
      tabId: 'tab-1',
      projectId: 'project-1',
      context: 'default',
      columnContext: 'entries',
      filterExpression: 'foo=1',
      sortingExpression: 'ts@desc',
      groupingExpression: 'Entries/level',
      groupSortingExpression: 'Entries/count@desc',
      limit: 20,
      groupLimit: 10,
    };

    const groupParams1 = {
      groupId: 'Entries/level:info',
      dataTypes: { 'Entries/level': 'string', 'Entries/message': 'string' },
      fields: {
        'Entries/level': { dataType: 'string' } as any,
        'Entries/message': { dataType: 'string' } as any,
      },
    };

    // Same keys but different object identity & insertion order
    const groupParams2 = {
      groupId: 'Entries/level:info',
      dataTypes: { 'Entries/message': 'string', 'Entries/level': 'string' },
      fields: {
        'Entries/message': { dataType: 'string' } as any,
        'Entries/level': { dataType: 'string' } as any,
      },
    };

    const key1 = buildLogQueryKey('group-specific', baseParams, groupParams1);
    const key2 = buildLogQueryKey('group-specific', baseParams, groupParams2);

    expect(key1).toEqual(key2);
  });

  it('pagination helpers compute counts and boundaries correctly', () => {
    expect(getCurrentCount(0, 20, 20)).toBe(20);
    expect(getCurrentCount(20, 20, 20)).toBe(40);
    expect(getCurrentGroupCount(0, 10, 5)).toBe(5);
    expect(getCurrentGroupCount(10, 10, 5)).toBe(15);

    expect(hasNextPage(20, 100)).toBe(true);
    expect(hasNextPage(100, 100)).toBe(false);

    expect(hasPreviousPage(0)).toBe(false);
    expect(hasPreviousPage(20)).toBe(true);
  });

  it('checkHasNextPage works for ungrouped and grouped logs', () => {
    const makeLog = (id: string): LogProps => ({
      type: 'ungrouped',
      id,
      ts: '2025-01-01T00:00:00Z',
      params: {},
      entries: { message: 'x' },
      derivedEntries: {},
      clippedFields: {},
    });

    const ungroupedLogs: LogProps[] = [makeLog('1'), makeLog('2'), makeLog('3')];

    // Ungrouped: currentCount = offset + fetchedCount
    expect(
      checkHasNextPage({
        currentLogs: ungroupedLogs,
        totalCount: 10,
        effectiveOffset: 0,
        effectiveLimit: 3,
      }),
    ).toBe(true);

    expect(
      checkHasNextPage({
        currentLogs: ungroupedLogs,
        totalCount: 3,
        effectiveOffset: 0,
        effectiveLimit: 3,
      }),
    ).toBe(false);

    const groupedLogs: GroupedLogProps[] = [
      {
        type: 'grouped',
        id: 'Entries/level:info',
        groupingColumnId: 'Entries/level',
        'Entries/level': 'info',
        subRows: [],
        isPopulated: false,
        groupCount: 5,
      } as any,
    ];

    // Grouped: currentCount = groupOffset + fetchedGroupCount
    expect(
      checkHasNextPage({
        currentLogs: groupedLogs,
        totalCount: 10,
        effectiveOffset: 0,
        effectiveLimit: 1,
      }),
    ).toBe(true);

    expect(
      checkHasNextPage({
        currentLogs: groupedLogs,
        totalCount: 1,
        effectiveOffset: 0,
        effectiveLimit: 1,
      }),
    ).toBe(false);
  });
});


