/**
 * LogGrid grouping — Orchestra server-side `group_by` with lazy nested expand.
 * Mirrors Interfaces nesting (append column ids; expand fetches children) without
 * AggregatedCell metrics, group sorting, or tile persistence.
 */

import type { LogFieldsResponseProps, LogProps, GroupedLogProps } from '@/types/interfaces/logs';
import {
  maybeConvertRawToGroupedLogs,
  getGroupingFilters,
  getUpdatedGroupingExpression,
} from '@/utils/interfaces/table/grouping';
import { isEqual } from '@/utils/misc/isEqual';
import { sanitizeId, toOrchestraColumnPath } from './columns';
import { makeCellId, type LogGridRow } from './types';

function stripPrivateFields(entries: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entries)) {
    if (!key.startsWith('_')) out[key] = value;
  }
  return out;
}

export function parseGrouping(grouping: string | undefined | null): string[] {
  if (!grouping) return [];
  return grouping
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function encodeGrouping(columnIds: string[]): string {
  return columnIds.join(',');
}

/** Toggle a flat field id in/out of the nest order (append when adding). */
export function toggleGroupingColumn(grouping: string, columnId: string): string {
  const ids = parseGrouping(grouping);
  const next = ids.includes(columnId) ? ids.filter((id) => id !== columnId) : [...ids, columnId];
  return encodeGrouping(next);
}

/** Move grouped columns to the front for display only (do not persist as columnOrder). */
export function withGroupedColumnsFirst(columnOrder: string[], grouping: string[]): string[] {
  if (!grouping.length) return columnOrder;
  const grouped = grouping.filter((id) => columnOrder.includes(id));
  const rest = columnOrder.filter((id) => !grouped.includes(id));
  return [...grouped, ...rest];
}

export function toOrchestraGroupBy(fieldIds: string[]): string[] {
  return fieldIds.map(toOrchestraColumnPath);
}

function leafToGridRow(log: LogProps | Record<string, unknown>): LogGridRow {
  const entries = {
    ...((log as LogProps).entries ?? {}),
    ...((log as LogProps).derivedEntries ?? {}),
  } as Record<string, unknown>;
  return {
    logId: Number((log as { id?: number | string }).id) || 0,
    entries: stripPrivateFields(entries),
    raw: log as LogProps,
  };
}

function groupedToGridRow(group: GroupedLogProps): LogGridRow {
  const colId = group.groupingColumnId;
  const fieldKey = sanitizeId(colId);
  const groupingValue = group[colId];
  const childRows = Array.isArray(group.subRows)
    ? group.subRows.map((child) =>
        child &&
        typeof child === 'object' &&
        'groupingColumnId' in child &&
        child.type === 'grouped'
          ? groupedToGridRow(child as GroupedLogProps)
          : leafToGridRow(child as LogProps)
      )
    : [];
  return {
    logId: 0,
    entries: stripPrivateFields({ [fieldKey]: groupingValue }),
    group: {
      id: group.id,
      groupingColumnId: colId,
      fieldKey,
      groupingValue,
      groupCount: group.groupCount ?? 0,
      isPopulated: group.isPopulated,
      totalChildren: group.totalChildren,
    },
    subRows: childRows,
  };
}

/** Convert Orchestra `/api/logs` payload (flat or grouped) into LogGrid rows. */
export function orchestraLogsToGridRows(
  logs: unknown,
  parentId: string | null = null
): LogGridRow[] {
  const converted = maybeConvertRawToGroupedLogs(
    undefined,
    logs as Parameters<typeof maybeConvertRawToGroupedLogs>[1],
    parentId
  );
  if (!Array.isArray(converted) || converted.length === 0) return [];
  return converted.map((item) => {
    if (
      item &&
      typeof item === 'object' &&
      'type' in item &&
      (item as { type: string }).type === 'grouped' &&
      'groupingColumnId' in item
    ) {
      return groupedToGridRow(item as GroupedLogProps);
    }
    return leafToGridRow(item as LogProps);
  });
}

export function countFromLogsResponse(data: { logs?: unknown; count?: number }): number {
  const raw = data.logs;
  if (Array.isArray(raw)) return data.count ?? raw.length;
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, { groupCount?: number } | number | undefined>;
    const key = Object.keys(obj).find((k) => {
      const v = obj[k];
      return v && typeof v === 'object' && typeof v.groupCount === 'number';
    });
    if (key) {
      const v = obj[key] as { groupCount: number };
      return v.groupCount;
    }
  }
  return data.count ?? 0;
}

/** Flatten a group tree to leaf log rows only (for selection / view pane). */
export function flattenLeafRows(rows: LogGridRow[]): LogGridRow[] {
  const out: LogGridRow[] = [];
  for (const row of rows) {
    if (row.group) {
      if (row.subRows?.length) out.push(...flattenLeafRows(row.subRows));
    } else {
      out.push(row);
    }
  }
  return out;
}

/**
 * Cell ids for the fade-accent flash: changed cells on existing rows, plus cells on
 * rows inserted above previously-known rows (live/refresh). Rows only appended after
 * all previously-known rows (infinite-scroll pagination) are excluded.
 */
export function getNewGridCellIds(previous: LogGridRow[], next: LogGridRow[]): string[] {
  const prevLeaves = flattenLeafRows(previous);
  const nextLeaves = flattenLeafRows(next);
  if (!nextLeaves.length) return [];

  const prevMap = new Map(prevLeaves.map((row) => [row.logId, row]));
  const ids: string[] = [];

  for (let i = 0; i < nextLeaves.length; i++) {
    const row = nextLeaves[i]!;
    const prior = prevMap.get(row.logId);
    if (!prior) {
      const insertedAboveKnown = nextLeaves.slice(i + 1).some((later) => prevMap.has(later.logId));
      if (!insertedAboveKnown) continue;
      for (const key of Object.keys(row.entries)) {
        ids.push(makeCellId(row.logId, key));
      }
      continue;
    }
    for (const key of Object.keys(row.entries)) {
      if (!Object.prototype.hasOwnProperty.call(prior.entries, key)) {
        ids.push(makeCellId(row.logId, key));
      } else if (!isEqual(row.entries[key], prior.entries[key])) {
        ids.push(makeCellId(row.logId, key));
      }
    }
  }
  return ids;
}

/** Freeze watermark format used by Interfaces / Orchestra `createdAt < "…"`. */
export function formatFreezeTimestamp(date = new Date()): string {
  return date.toISOString().replace('T', ' ').replace('Z', '');
}

/** Immutable replace of a group's subRows by group id. */
export function updateGridGroupSubRows(
  rows: LogGridRow[],
  targetId: string,
  children: LogGridRow[],
  totalChildren?: number
): LogGridRow[] {
  return rows.map((row) => {
    if (row.group?.id === targetId) {
      return {
        ...row,
        group: {
          ...row.group,
          isPopulated: true,
          totalChildren: totalChildren ?? children.length,
        },
        subRows: children,
      };
    }
    if (row.subRows?.length) {
      return {
        ...row,
        subRows: updateGridGroupSubRows(row.subRows, targetId, children, totalChildren),
      };
    }
    return row;
  });
}

/** Append another page of children under an already-populated group. */
export function appendGridGroupSubRows(
  rows: LogGridRow[],
  targetId: string,
  children: LogGridRow[],
  options?: { totalChildren?: number; exhausted?: boolean }
): LogGridRow[] {
  return rows.map((row) => {
    if (row.group?.id === targetId) {
      const nextSub = [...(row.subRows ?? []), ...children];
      return {
        ...row,
        group: {
          ...row.group,
          isPopulated: true,
          totalChildren: options?.exhausted
            ? nextSub.length
            : (options?.totalChildren ?? row.group.totalChildren ?? nextSub.length),
        },
        subRows: nextSub,
      };
    }
    if (row.subRows?.length) {
      return {
        ...row,
        subRows: appendGridGroupSubRows(row.subRows, targetId, children, options),
      };
    }
    return row;
  });
}

/** True when a populated group still has unloaded children. */
export function groupHasMoreChildren(row: LogGridRow): boolean {
  if (!row.group?.isPopulated) return false;
  const loaded = row.subRows?.length ?? 0;
  const total = row.group.totalChildren ?? 0;
  return loaded < total;
}

export type ExpandLogGroupArgs = {
  projectName: string;
  context: string;
  /** Full nest order as flat field ids (`city,name`). */
  grouping: string;
  groupingColumnId: string;
  groupingValue: string;
  parentId: string | null;
  filter?: string | null;
  sorting?: string | null;
  fields: LogFieldsResponseProps;
  pageSize: number;
  /** Child page offset (0 on first expand). */
  offset?: number;
};

/**
 * Fetch children for an expanded group (deeper groups or leaf logs).
 * Uses the same filter/nest slicing as Interfaces `onGroupExpand`.
 */
export async function fetchGroupChildren(args: ExpandLogGroupArgs): Promise<{
  rows: LogGridRow[];
  count: number;
}> {
  const orchestraGrouping = toOrchestraGroupBy(parseGrouping(args.grouping)).join(',');
  const orchestraGroupingColumnId = toOrchestraColumnPath(args.groupingColumnId);
  const dataTypes = Object.fromEntries(
    Object.entries(args.fields).map(([k, v]) => [sanitizeId(k), v.dataType])
  );

  const groupingFilters = getGroupingFilters(
    args.filter ?? null,
    args.groupingColumnId,
    String(args.groupingValue),
    args.parentId,
    dataTypes,
    args.fields
  );

  const remaining = getUpdatedGroupingExpression(orchestraGrouping, orchestraGroupingColumnId);
  const offset = args.offset ?? 0;

  const params = new URLSearchParams({
    projectName: args.projectName,
    context: args.context,
  });
  if (groupingFilters.updatedFilterExpression) {
    params.set('filter', groupingFilters.updatedFilterExpression);
  }
  if (args.sorting) params.set('sorting', args.sorting);

  if (remaining) {
    remaining.split(',').forEach((expr) => {
      if (expr.trim()) params.append('groupBy', expr.trim());
    });
    params.set('groupLimit', String(args.pageSize));
    params.set('groupOffset', String(offset));
    params.set('groupDepth', '0');
  } else {
    params.set('limit', String(args.pageSize));
    params.set('offset', String(offset));
  }

  const res = await fetch(`/api/logs?${params.toString()}`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to expand group (${res.status})`);
  }
  const data = await res.json();
  const parentId = args.parentId
    ? `${args.parentId}>${args.groupingColumnId}:${args.groupingValue}`
    : `${args.groupingColumnId}:${args.groupingValue}`;

  return {
    rows: orchestraLogsToGridRows(data.logs ?? [], parentId),
    count: countFromLogsResponse(data),
  };
}
