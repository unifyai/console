import { describe, expect, it } from 'vitest';

import {
  collectTaskTags,
  filterTasksByTags,
  readTaskTags,
  type TagFilterState,
} from '@/utils/assistants/tasks';
import type { TaskRow } from '@/types/assistants/brain';

function task(taskId: number, tags?: unknown): TaskRow {
  return { taskId, name: `t${taskId}`, tags } as unknown as TaskRow;
}

function filters(entries: [string, TagFilterState][]): Map<string, TagFilterState> {
  return new Map(entries);
}

describe('readTaskTags', () => {
  it('normalizes to trimmed, deduped strings and tolerates junk', () => {
    expect(readTaskTags(task(1, [' gtm ', 'gtm', 'community', 7, null, '']))).toEqual([
      'gtm',
      'community',
    ]);
    expect(readTaskTags(task(2))).toEqual([]);
    expect(readTaskTags(task(3, 'gtm'))).toEqual([]);
  });
});

describe('collectTaskTags', () => {
  it('returns sorted tags with task counts', () => {
    const rows = [task(1, ['gtm', 'smartlead']), task(2, ['gtm']), task(3, ['community'])];
    expect(collectTaskTags(rows)).toEqual([
      { tag: 'community', count: 1 },
      { tag: 'gtm', count: 2 },
      { tag: 'smartlead', count: 1 },
    ]);
  });
});

describe('filterTasksByTags', () => {
  const rows = [
    task(1, ['gtm', 'smartlead']),
    task(2, ['gtm', 'stargazer']),
    task(3, ['community', 'discord']),
    task(4),
  ];

  it('passes everything through with no active filters', () => {
    expect(filterTasksByTags(rows, filters([]))).toEqual(rows);
  });

  it('requires every included tag (AND, like GitHub labels)', () => {
    const byGtm = filterTasksByTags(rows, filters([['gtm', 'include']]));
    expect(byGtm.map((r) => r.taskId)).toEqual([1, 2]);

    const both = filterTasksByTags(
      rows,
      filters([
        ['gtm', 'include'],
        ['smartlead', 'include'],
      ])
    );
    expect(both.map((r) => r.taskId)).toEqual([1]);
  });

  it('drops any task carrying an excluded tag', () => {
    const noGtm = filterTasksByTags(rows, filters([['gtm', 'exclude']]));
    expect(noGtm.map((r) => r.taskId)).toEqual([3, 4]);
  });

  it('combines include and exclude', () => {
    const result = filterTasksByTags(
      rows,
      filters([
        ['gtm', 'include'],
        ['smartlead', 'exclude'],
      ])
    );
    expect(result.map((r) => r.taskId)).toEqual([2]);
  });

  it('hides untagged tasks only when an include is active', () => {
    expect(filterTasksByTags(rows, filters([['gtm', 'include']])).some((r) => r.taskId === 4)).toBe(
      false
    );
    expect(
      filterTasksByTags(rows, filters([['discord', 'exclude']])).some((r) => r.taskId === 4)
    ).toBe(true);
  });
});
