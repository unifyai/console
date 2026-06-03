import { describe, expect, it } from 'vitest';

import { mergeRootRows } from '@/lib/client/read_across_roots';

describe('mergeRootRows', () => {
  it('sorts interleaved root rows and caps at the merged boundary', () => {
    const rows = [
      { id: 'personal-old', timestamp: '2026-05-01T10:00:00Z' },
      { id: 'shared-new', timestamp: '2026-05-01T12:00:00Z' },
      { id: 'personal-middle', timestamp: '2026-05-01T11:00:00Z' },
    ];

    expect(
      mergeRootRows(rows, {
        limit: 2,
        sortValue: (row) => row.timestamp,
      })
    ).toEqual([
      { id: 'shared-new', timestamp: '2026-05-01T12:00:00Z' },
      { id: 'personal-middle', timestamp: '2026-05-01T11:00:00Z' },
    ]);
  });

  it('returns duplicate stable row ids once', () => {
    const rows = [
      { id: 'same', timestamp: '2026-05-01T11:00:00Z' },
      { id: 'same', timestamp: '2026-05-01T11:00:00Z' },
      { id: 'other', timestamp: '2026-05-01T10:00:00Z' },
    ];

    expect(
      mergeRootRows(rows, {
        dedupeKey: (row) => row.id,
        sortValue: (row) => row.timestamp,
      })
    ).toEqual([
      { id: 'same', timestamp: '2026-05-01T11:00:00Z' },
      { id: 'other', timestamp: '2026-05-01T10:00:00Z' },
    ]);
  });
});
