import type { Assistant } from '@/types/assistants/assistant';
import { roots, type ContextRoot } from '@/lib/assistants/scope';

export type { ContextRoot };
export { roots };

export async function readAcrossRoots<T>(
  assistant: Assistant,
  fetchFor: (root: ContextRoot) => Promise<T[]>
): Promise<T[]> {
  const results = await Promise.all(roots(assistant).map((root) => fetchFor(root)));
  return results.flat();
}

export interface MergeRootRowsOptions<T> {
  limit?: number;
  offset?: number;
  direction?: 'ascending' | 'descending';
  sortValue?: (row: T) => string | number | Date | null | undefined;
  dedupeKey?: (row: T) => string | number | null | undefined;
}

function comparableValue(value: string | number | Date | null | undefined): string | number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.getTime();
  return value;
}

export function mergeRootRows<T>(
  rows: T[],
  {
    limit,
    offset = 0,
    direction = 'descending',
    sortValue,
    dedupeKey,
  }: MergeRootRowsOptions<T> = {}
): T[] {
  const deduped: T[] = [];
  const seen = new Set<string | number>();

  for (const row of rows) {
    const key = dedupeKey?.(row);
    if (key !== null && key !== undefined) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    deduped.push(row);
  }

  if (sortValue) {
    deduped.sort((left, right) => {
      const leftValue = comparableValue(sortValue(left));
      const rightValue = comparableValue(sortValue(right));
      if (leftValue === rightValue) return 0;
      if (leftValue === null) return 1;
      if (rightValue === null) return -1;
      const comparison = leftValue < rightValue ? -1 : 1;
      return direction === 'ascending' ? comparison : -comparison;
    });
  }

  const end = limit === undefined ? undefined : offset + limit;
  return deduped.slice(offset, end);
}
