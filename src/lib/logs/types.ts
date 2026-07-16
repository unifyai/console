import type { ColumnSizingState, SortingState } from '@tanstack/react-table';
import type { FiltersByColumn } from '@/types/interfaces/columns';
import type { LogFieldsResponseProps, LogProps } from '@/types/interfaces/logs';

/** Orchestra query identity — no tile/tab ids. */
export type LogQuerySpec = {
  projectName: string;
  context: string;
  filterExpr?: string | null;
  sorting?: string | null;
  limit: number;
  offset: number;
  columnContext?: string | null;
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
  /** ISO timestamp watermark — appends `createdAt < freeze` to filterExpr. */
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

export type { FiltersByColumn, LogFieldsResponseProps, SortingState };
