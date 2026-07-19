import type { ColumnSizingState, SortingState } from '@tanstack/react-table';
import type { FiltersByColumn } from '@/types/interfaces/columns';
import type { LogFieldsResponseProps, LogProps } from '@/types/interfaces/logs';

/** Orchestra query identity — no tile/tab ids. */
export type LogQuerySpec = {
  projectName: string;
  context: string;
  filter?: string | null;
  sorting?: string | null;
  limit: number;
  offset: number;
  columnContext?: string | null;
  /** Orchestra `group_by` values (`Entries/field`, …). */
  groupBy?: string[] | null;
};

export const LOG_PAGE_SIZE_OPTIONS = [20, 50, 100, 200] as const;

/** UI view config for a log grid; persistence is orthogonal. */
export type LogViewState = {
  hiddenColumns: string[];
  columnOrder: string[];
  /** Per-column pixel widths (TanStack columnSizing). */
  columnSizing: ColumnSizingState;
  /** Encoded as `col~fn~value§…` (Interfaces tile filters string). */
  filters: string;
  /** Encoded as `mode§value` (`expression` or text search). */
  commonFilter: string;
  sorting: SortingState;
  offset: number;
  limit: number;
  /**
   * Comma-joined flat field ids for Orchestra `group_by` nest order
   * (e.g. `city,name`). Empty / omitted = ungrouped.
   */
  grouping: string;
  /** ISO timestamp watermark — appends `createdAt < freeze` to filter. */
  freeze?: string;
  /** Footer aggregate metric name (`mean`, `count`, …). */
  metric?: string;
  /** When true, poll for newer rows. */
  autoUpdate?: boolean;
};

export const DEFAULT_LOG_PAGE_SIZE = 50;
export const LOG_METRICS = [
  'mean',
  'count',
  'sum',
  'var',
  'std',
  'min',
  'max',
  'median',
  'mode',
] as const;
export type LogMetricName = (typeof LOG_METRICS)[number];

export function emptyLogViewState(overrides?: Partial<LogViewState>): LogViewState {
  return {
    hiddenColumns: [],
    columnOrder: [],
    columnSizing: {},
    filters: '',
    commonFilter: '',
    sorting: [],
    offset: 0,
    limit: DEFAULT_LOG_PAGE_SIZE,
    grouping: '',
    freeze: undefined,
    metric: 'mean',
    autoUpdate: false,
    ...overrides,
  };
}

export type LogViewStateStore = {
  get(key: string): LogViewState;
  set(key: string, patch: Partial<LogViewState>): void;
  replace(key: string, next: LogViewState): void;
};

/**
 * Selection model for LogGrid.
 * - `row`: Assistants Data detail sheet
 * - `cell`: Interfaces-style viewing panel (`{logId}_{columnId}`)
 */
export type SelectionModel =
  | {
      mode: 'row';
      selectedRowId: string | null;
      onSelectRow: (rowId: string | null) => void;
    }
  | {
      mode: 'cell';
      selectedCells: string[];
      onSelectCells: (cellIds: string[]) => void;
    };

export type LogFieldMeta = LogFieldsResponseProps[string];

export type LogGridRow = {
  logId: number;
  entries: Record<string, unknown>;
  /** Raw Orchestra log when available (Interfaces adapters). */
  raw?: LogProps;
  /** Present when this row is a server-side group header (lazy-expand tree). */
  group?: {
    id: string;
    groupingColumnId: string;
    fieldKey: string;
    groupingValue: unknown;
    groupCount: number;
    isPopulated: boolean;
    totalChildren?: number;
  };
  subRows?: LogGridRow[];
};

export type LogQueryResult = {
  rows: LogGridRow[];
  count: number;
  fields: LogFieldsResponseProps;
};

/** Parse `logId_columnId` cell ids used by Interfaces table tiles. */
export function parseCellId(cellId: string): { logId: string; columnId: string } {
  const idx = cellId.indexOf('_');
  if (idx === -1) return { logId: cellId, columnId: '' };
  return { logId: cellId.slice(0, idx), columnId: cellId.slice(idx + 1) };
}

export function makeCellId(logId: string | number, columnId: string): string {
  return `${logId}_${columnId}`;
}

/** Util column id for the Excel-style row index / whole-row selector. */
export const LOG_ROW_NUMBER_COL = 'RowNumbering';

/** All data-cell ids for one row (never includes the row-index column). */
export function cellsForRow(logId: string | number, columnIds: string[]): string[] {
  return columnIds.map((columnId) => makeCellId(logId, columnId));
}

/** All data-cell ids across an inclusive row range in the given row order. */
export function cellsForRowRange(
  rows: Array<{ logId: number }>,
  columnIds: string[],
  startLogId: string,
  endLogId: string
): string[] {
  const rowIds = rows.map((r) => String(r.logId));
  const r1 = rowIds.indexOf(startLogId);
  const r2 = rowIds.indexOf(endLogId);
  if (r1 < 0 || r2 < 0 || columnIds.length === 0) return [];
  const rMin = Math.min(r1, r2);
  const rMax = Math.max(r1, r2);
  const out: string[] = [];
  for (let r = rMin; r <= rMax; r++) {
    out.push(...cellsForRow(rows[r].logId, columnIds));
  }
  return out;
}

/** True when every visible data cell of the row is in the selection. */
export function isAllRowSelected(
  selectedCells: Iterable<string>,
  logId: string | number,
  columnIds: string[]
): boolean {
  if (columnIds.length === 0) return false;
  const selected = selectedCells instanceof Set ? selectedCells : new Set(selectedCells);
  return columnIds.every((columnId) => selected.has(makeCellId(logId, columnId)));
}

/**
 * Inset box-shadows for the top/left/bottom outer edges of a contiguous
 * selection. The right edge is drawn via `border-r` (same 1px grid slot) so it
 * overlays the existing column rule without doubling. Shared edges between
 * adjacent selected cells are omitted so the perimeter stays single-thickness.
 */
export function selectionPerimeterBoxShadow(
  selected: Set<string>,
  logId: string | number,
  columnId: string,
  columnIds: string[],
  rows: Array<{ logId: number }>
): string | undefined {
  const colIdx = columnIds.indexOf(columnId);
  const rowIdx = rows.findIndex((row) => String(row.logId) === String(logId));
  if (colIdx < 0 || rowIdx < 0) return undefined;

  const leftSelected = colIdx > 0 && selected.has(makeCellId(logId, columnIds[colIdx - 1]!));
  const topSelected = rowIdx > 0 && selected.has(makeCellId(rows[rowIdx - 1]!.logId, columnId));
  const bottomSelected =
    rowIdx < rows.length - 1 && selected.has(makeCellId(rows[rowIdx + 1]!.logId, columnId));

  const parts: string[] = [];
  if (!topSelected) parts.push('inset 0 1px 0 0 var(--primary)');
  if (!bottomSelected) parts.push('inset 0 -1px 0 0 var(--primary)');
  if (!leftSelected) parts.push('inset 1px 0 0 0 var(--primary)');
  return parts.length > 0 ? parts.join(', ') : undefined;
}

/**
 * Cell ids in the inclusive axis-aligned rectangle between two cells,
 * using the given row order and visible column order (Interfaces-style).
 */
export function cellsInBoundingRange(
  rows: Array<{ logId: number }>,
  columnIds: string[],
  startCellId: string,
  endCellId: string
): string[] {
  const start = parseCellId(startCellId);
  const end = parseCellId(endCellId);
  const rowIds = rows.map((r) => String(r.logId));
  const r1 = rowIds.indexOf(start.logId);
  const r2 = rowIds.indexOf(end.logId);
  const c1 = columnIds.indexOf(start.columnId);
  const c2 = columnIds.indexOf(end.columnId);
  if (r1 < 0 || r2 < 0 || c1 < 0 || c2 < 0) return [];

  const rMin = Math.min(r1, r2);
  const rMax = Math.max(r1, r2);
  const cMin = Math.min(c1, c2);
  const cMax = Math.max(c1, c2);

  const out: string[] = [];
  for (let r = rMin; r <= rMax; r++) {
    for (let c = cMin; c <= cMax; c++) {
      out.push(makeCellId(rows[r].logId, columnIds[c]));
    }
  }
  return out;
}

export type { FiltersByColumn, LogFieldsResponseProps, SortingState };
