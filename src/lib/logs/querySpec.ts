import type { LogFieldsResponseProps } from '@/types/interfaces/logs';
import { buildFilterExpression } from '@/lib/logs/filters';
import { parseGrouping, toOrchestraGroupBy } from '@/lib/logs/grouping';
import { toOrchestraFieldName } from '@/lib/logs/columns';
import type { LogQuerySpec, LogViewState } from './types';
import type { SortingState } from '@tanstack/react-table';

/** Map TanStack sorting to Orchestra `sorting` JSON string. */
export function sortingStateToOrchestra(sorting: SortingState): string | null {
  if (!sorting.length) return null;
  const obj = Object.fromEntries(
    sorting.map((s) => [toOrchestraFieldName(s.id), s.desc ? 'descending' : 'ascending'])
  );
  return JSON.stringify(obj);
}

/** Encode Interfaces-style `field@true,field2@false` sorting string. */
export function sortingStateToTileString(sorting: SortingState): string {
  return sorting.map((s) => `${s.id}@${s.desc ? 'true' : 'false'}`).join(',');
}

/** Parse Interfaces tile sorting string into TanStack SortingState. */
export function tileSortingToState(sorting: string | undefined): SortingState {
  if (!sorting) return [];
  return sorting
    .split(',')
    .filter(Boolean)
    .map((part) => {
      const [id, dir] = part.split('@');
      return { id, desc: dir === 'true' };
    });
}

/**
 * Build a LogQuerySpec from view state + context identity.
 * Uses the same filter expression builder as Interfaces table tiles.
 */
export function buildLogQuerySpec(args: {
  projectName: string;
  context: string;
  view: LogViewState;
  fields: LogFieldsResponseProps;
  columnContext?: string | null;
}): LogQuerySpec {
  const filter = buildFilterExpression(
    args.view.filters || undefined,
    args.view.commonFilter || undefined,
    args.columnContext ?? undefined,
    args.view.freeze || undefined,
    args.fields
  );
  const grouping = parseGrouping(args.view.grouping);
  return {
    projectName: args.projectName,
    context: args.context,
    filter: filter || null,
    sorting: sortingStateToOrchestra(args.view.sorting),
    limit: args.view.limit,
    offset: args.view.offset,
    columnContext: args.columnContext ?? null,
    groupBy: grouping.length ? toOrchestraGroupBy(grouping) : null,
  };
}

/** Encode a single column filter into the Interfaces `col~fn~value` bag. */
export function encodeColumnFilter(
  existing: string,
  column: string,
  fn: string,
  value: string
): string {
  const parts = existing
    ? existing.split('§').filter((p) => {
        const [col] = p.split('~');
        return col !== column;
      })
    : [];
  if (value) {
    parts.push(`${column}~${fn}~${value}`);
  }
  return parts.join('§');
}

/** Encode common text search (`in§value`). */
export function encodeCommonTextFilter(value: string): string {
  const trimmed = value.trim();
  return trimmed ? `in§${trimmed}` : '';
}

/** Encode common expression filter (`expression§…`). */
export function encodeCommonExpressionFilter(expression: string): string {
  const trimmed = expression.trim();
  return trimmed ? `expression§${trimmed}` : '';
}
