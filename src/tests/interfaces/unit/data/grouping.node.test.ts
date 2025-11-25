import { describe, it, expect } from 'vitest';
import {
  maybeConvertRawToGroupedLogs,
  updateGroupedSubRows,
  isGroupedLogs,
  appendLogsWithWindowing,
  prependLogsWithWindowing,
  appendGroupedLogsWithWindowing,
  prependGroupedLogsWithWindowing,
  findGroupSubRows,
  appendGroupSubRowsWithWindowing,
  prependGroupSubRowsWithWindowing,
} from '@/utils/interfaces/table/grouping';
import type {
  GroupedLogPropsRaw,
  LogItemProps,
  LogProps,
  GroupedLogProps,
  LogsResponseProps,
} from '@/types/interfaces/logs';

const makeUngroupedLog = (id: string, message: string): LogProps => ({
  type: 'ungrouped',
  id,
  ts: '2025-01-01T00:00:00Z',
  params: {},
  entries: { message },
  derived_entries: {},
  clipped_fields: {},
});

const makeGroupedLog = (id: string, col: string, val: string, count = 1): GroupedLogProps => ({
  type: 'grouped',
  id,
  groupingColumnId: col,
  [col]: val,
  subRows: [],
  isPopulated: false,
  groupCount: count,
  totalChildren: count,
} as any);

describe('table grouping utilities', () => {
  describe('maybeConvertRawToGroupedLogs', () => {
    it('converts GroupedLogPropsRaw into GroupedLogProps with correct ids and groupingIndex', () => {
      const params: LogItemProps = {};
      const raw: GroupedLogPropsRaw = {
        'Entries/level': {
          group: [
            { key: 'info', value: 10 },
            { key: 'error', value: 5 },
          ],
          group_count: 2,
          count: 15,
        },
        count: 15,
      };

      const result = maybeConvertRawToGroupedLogs(params, raw, null) as GroupedLogProps[];

      expect(isGroupedLogs(result)).toBe(true);
      expect(result).toHaveLength(2);

      const [infoGroup, errorGroup] = result;
      expect(infoGroup.id).toBe('Entries/level:info');
      expect(errorGroup.id).toBe('Entries/level:error');
    });

    it('prefixes ids with parentId when provided', () => {
      const params: LogItemProps = {};
      const raw: GroupedLogPropsRaw = {
        'Entries/level': {
          group: [{ key: 'info', value: 1 }],
          group_count: 1,
          count: 1,
        },
        count: 1,
      };

      const result = maybeConvertRawToGroupedLogs(params, raw, 'root') as GroupedLogProps[];
      expect(result[0].id).toBe('root>Entries/level:info');
    });
  });

  describe('updateGroupedSubRows', () => {
    it('populates subRows and totalChildren for a target group', () => {
      const existing: GroupedLogProps[] = [
        makeGroupedLog('Entries/level:info', 'Entries/level', 'info', 0),
      ];

      const newLogs: LogProps[] = [makeUngroupedLog('log-1', 'First')];
      const response: LogsResponseProps = {
        params: {},
        logs: newLogs,
        count: 1,
        groups: {},
      };

      const updated = updateGroupedSubRows(existing, response, [['level', 'info']]);
      expect(updated[0].isPopulated).toBe(true);
      expect(updated[0].subRows).toHaveLength(1);
      expect(updated[0].totalChildren).toBe(1);
    });
  });

  describe('Windowing - Ungrouped Logs', () => {
    const log1 = makeUngroupedLog('1', 'msg1');
    const log2 = makeUngroupedLog('2', 'msg2');
    const log3 = makeUngroupedLog('3', 'msg3');
    const log4 = makeUngroupedLog('4', 'msg4');

    it('appendLogsWithWindowing appends unique logs', () => {
      const existing = [log1];
      const incoming = [log1, log2]; // log1 is duplicate
      
      const result = appendLogsWithWindowing(existing, incoming);
      expect(result.logs).toHaveLength(2);
      expect(result.logs[0].id).toBe('1');
      expect(result.logs[1].id).toBe('2');
      expect(result.actualAppendedCount).toBe(1);
    });

    it('appendLogsWithWindowing applies window slicing (maxPagesInMemory)', () => {
        // maxPages=1, pageSize=2 -> max items = 2
        const windowConfig = { maxPagesInMemory: 1, pageSize: 2, currentPageCount: 2 };
        const existing = [log1, log2];
        const incoming = [log3, log4];
        
        const result = appendLogsWithWindowing(existing, incoming, windowConfig, 0, 100);
        // Should append then slice from start to keep last 2
        // [1, 2, 3, 4] -> keep [3, 4]
        expect(result.logs).toHaveLength(2);
        expect(result.logs[0].id).toBe('3');
        expect(result.logs[1].id).toBe('4');
        // Offset should increase by number of dropped items (2)
        expect(result.offset).toBe(2);
    });

    it('prependLogsWithWindowing prepends unique logs', () => {
        const existing = [log2];
        const incoming = [log1, log2]; // log2 is duplicate
        
        const result = prependLogsWithWindowing(existing, incoming);
        expect(result.logs).toHaveLength(2);
        expect(result.logs[0].id).toBe('1');
        expect(result.logs[1].id).toBe('2');
        expect(result.actualPrependedCount).toBe(1);
    });

    it('prependLogsWithWindowing applies window slicing', () => {
        // maxPages=1, pageSize=2 -> max items = 2
        const windowConfig = { maxPagesInMemory: 1, pageSize: 2, currentPageCount: 2 };
        const existing = [log3, log4];
        const incoming = [log1, log2];
        
        // [1, 2, 3, 4] -> keep [1, 2] (slice(0, 2))
        const result = prependLogsWithWindowing(existing, incoming, windowConfig, 10, 100);
        expect(result.logs).toHaveLength(2);
        expect(result.logs[0].id).toBe('1');
        expect(result.logs[1].id).toBe('2');
        // Offset calculation: currentOffset (10) - actualPrepended (2) = 8
        // Since we kept the start, the offset relative to dataset start is updated simply
        expect(result.offset).toBe(8);
    });
  });

  describe('Windowing - Grouped Logs', () => {
    const g1 = makeGroupedLog('g:1', 'g', '1');
    const g2 = makeGroupedLog('g:2', 'g', '2');
    const g3 = makeGroupedLog('g:3', 'g', '3');

    it('appendGroupedLogsWithWindowing appends and windows', () => {
        const windowConfig = { maxPagesInMemory: 1, pageSize: 2, currentPageCount: 2 }; // limit 2 groups
        const existing = [g1];
        const incoming = [g2, g3];
        
        const result = appendGroupedLogsWithWindowing(existing, incoming, windowConfig, 0);
        // [g1, g2, g3] -> keep [g2, g3]
        expect(result.logs).toHaveLength(2);
        expect(result.logs[0].id).toBe('g:2');
        expect(result.logs[1].id).toBe('g:3');
        expect(result.offset).toBe(1); // Dropped 1
    });

    it('prependGroupedLogsWithWindowing prepends and windows', () => {
        const windowConfig = { maxPagesInMemory: 1, pageSize: 2, currentPageCount: 2 }; // limit 2
        const existing = [g3];
        const incoming = [g1, g2];
        
        const result = prependGroupedLogsWithWindowing(existing, incoming, windowConfig, 10);
        // [g1, g2, g3] -> keep [g1, g2]
        expect(result.logs).toHaveLength(2);
        expect(result.logs[0].id).toBe('g:1');
        expect(result.logs[1].id).toBe('g:2');
        expect(result.offset).toBe(8); // 10 - 2 prepended
    });
  });

  describe('Windowing - Group SubRows', () => {
    const log1 = makeUngroupedLog('1', 'm1');
    const log2 = makeUngroupedLog('2', 'm2');
    const log3 = makeUngroupedLog('3', 'm3');

    const parentGroup = makeGroupedLog('g:a', 'g', 'a');
    parentGroup.subRows = [log1];
    parentGroup.isPopulated = true;

    it('appendGroupSubRowsWithWindowing updates target group subrows', () => {
        const windowConfig = { maxPagesInMemory: 1, pageSize: 2, currentPageCount: 2 }; // limit 2
        const existing = [parentGroup];
        const incoming = [log2, log3];
        
        // Target group 'g', value 'a'
        const result = appendGroupSubRowsWithWindowing(
            existing, 
            incoming, 
            [['g', 'a']], 
            windowConfig,
            0 // current group offset
        );

        const group = result.logs[0] as GroupedLogProps;
        // [1, 2, 3] -> keep [2, 3]
        expect(group.subRows).toHaveLength(2);
        expect((group.subRows as LogProps[])[0].id).toBe('2');
        expect(result.groupOffset).toBe(1); // Dropped 1
    });

    it('prependGroupSubRowsWithWindowing updates target group subrows', () => {
        // Reset subRows
        parentGroup.subRows = [log3]; 
        const windowConfig = { maxPagesInMemory: 1, pageSize: 2, currentPageCount: 2 };
        const existing = [parentGroup];
        const incoming = [log1, log2];

        const result = prependGroupSubRowsWithWindowing(
            existing,
            incoming,
            [['g', 'a']],
            windowConfig,
            10
        );

        const group = result.logs[0] as GroupedLogProps;
        // [1, 2, 3] -> keep [1, 2]
        expect(group.subRows).toHaveLength(2);
        expect((group.subRows as LogProps[])[0].id).toBe('1');
        expect(result.groupOffset).toBe(8);
    });
  });

  describe('findGroupSubRows', () => {
    it('finds subrows for a nested group', () => {
        const l1 = makeUngroupedLog('1', 'm1');
        const l2 = makeUngroupedLog('2', 'm2');
        
        const childGroup = makeGroupedLog('g:a>sub:b', 'sub', 'b', 2);
        childGroup.subRows = [l1, l2];
        childGroup.isPopulated = true;

        const parentGroup = makeGroupedLog('g:a', 'g', 'a', 1);
        parentGroup.subRows = [childGroup];
        parentGroup.isPopulated = true;

        const result = findGroupSubRows([parentGroup], [['g', 'a'], ['sub', 'b']]);
        expect(result).not.toBeNull();
        expect(result?.subRows).toHaveLength(2);
        expect(result?.totalCount).toBe(2);
    });

    it('returns null if group not found', () => {
        const parentGroup = makeGroupedLog('g:a', 'g', 'a');
        const result = findGroupSubRows([parentGroup], [['g', 'z']]);
        expect(result).toBeNull();
    });
  });
});
