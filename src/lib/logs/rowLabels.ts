/**
 * Nested `x.y.z` row labels for Data LogGrid when grouping is applied.
 * Ungrouped grids keep flat 1-based integers (as strings).
 */

import type { LogGridRow } from './types';

/** Join ancestor segments into a dotted label (`[1, 2, 3]` → `"1.2.3"`). */
export function formatNestedRowLabelFromAncestors(segments: number[]): string {
  return segments.join('.');
}

/**
 * Walk the display tree and assign labels.
 * - Leaves keyed by `String(logId)`
 * - Group headers keyed by `group.id`
 * - Top level applies `offset`; nested levels do not
 * - When `grouped` is false, flat `offset+i+1` for each leaf (no group keys)
 */
export function buildNestedRowLabelMap(
  rows: LogGridRow[],
  opts: { offset: number; grouped: boolean }
): Map<string, string> {
  const map = new Map<string, string>();

  function walk(levelRows: LogGridRow[], prefix: number[], applyOffset: boolean) {
    levelRows.forEach((row, i) => {
      const segment = (applyOffset ? opts.offset : 0) + i + 1;
      const path = [...prefix, segment];
      const label = formatNestedRowLabelFromAncestors(path);

      if (row.group) {
        map.set(row.group.id, label);
        if (row.subRows?.length) {
          walk(row.subRows, path, false);
        }
      } else {
        map.set(String(row.logId), label);
      }
    });
  }

  if (!opts.grouped) {
    const leaves = flattenForUngrouped(rows);
    leaves.forEach((row, i) => {
      map.set(String(row.logId), String(opts.offset + i + 1));
    });
    return map;
  }

  walk(rows, [], true);
  return map;
}

function flattenForUngrouped(rows: LogGridRow[]): LogGridRow[] {
  const out: LogGridRow[] = [];
  for (const row of rows) {
    if (row.group) {
      if (row.subRows?.length) out.push(...flattenForUngrouped(row.subRows));
    } else {
      out.push(row);
    }
  }
  return out.length ? out : rows.filter((r) => !r.group);
}

/** Segment-wise numeric compare for dotted labels (`1.2` < `1.10` < `2.1`). */
export function compareRowLabels(a: string, b: string): number {
  const as = a.split('.').map((s) => parseInt(s, 10) || 0);
  const bs = b.split('.').map((s) => parseInt(s, 10) || 0);
  const n = Math.max(as.length, bs.length);
  for (let i = 0; i < n; i++) {
    const av = as[i] ?? 0;
    const bv = bs[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return as.length - bs.length;
}

/**
 * Compress labels that share a common prefix when the final segment is contiguous:
 * `1.1, 1.2, 1.3` → `1.1-1.3`; never merges across groups (`1.2` + `2.1`).
 * Flat integers: `3,4,5,8` → `3-5, 8`.
 */
export function compressRowLabels(labels: string[]): string {
  if (!labels.length) return '';
  const sorted = [...new Set(labels)].sort(compareRowLabels);

  const ranges: string[] = [];
  let start = sorted[0]!;
  let end = start;

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]!;
    if (canExtendRange(end, current)) {
      end = current;
    } else {
      ranges.push(formatRange(start, end));
      start = current;
      end = current;
    }
  }
  ranges.push(formatRange(start, end));
  return ranges.join(', ');
}

function parseLabel(label: string): { prefix: string; last: number } {
  const parts = label.split('.');
  const last = parseInt(parts[parts.length - 1]!, 10);
  const prefix = parts.slice(0, -1).join('.');
  return { prefix, last: Number.isFinite(last) ? last : NaN };
}

function canExtendRange(prev: string, next: string): boolean {
  const a = parseLabel(prev);
  const b = parseLabel(next);
  if (Number.isNaN(a.last) || Number.isNaN(b.last)) return false;
  return a.prefix === b.prefix && b.last === a.last + 1;
}

function formatRange(start: string, end: string): string {
  return start === end ? start : `${start}-${end}`;
}
