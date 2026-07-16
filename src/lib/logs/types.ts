import type { SortingState } from '@tanstack/react-table';
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

/** UI view config for a log grid; persistence is orthogonal. */
export type LogViewState = {
  hiddenColumns: string[];
  columnOrder: string[];
  columnsPinLeft: string[];
  columnsPinRight: string[];
  /** Encoded as `col~fn~value§…` (Interfaces tile filters string). */
  filters: string;
  /** Encoded as `mode§value` (`expression` or text search). */
  commonFilter: string;
  sorting: SortingState;
  offset: number;
  limit: number;
};

export const DEFAULT_LOG_PAGE_SIZE = 50;

export function emptyLogViewState(overrides?: Partial<LogViewState>): LogViewState {
  return {
    hiddenColumns: [],
    columnOrder: [],
    columnsPinLeft: [],
    columnsPinRight: [],
    filters: '',
    commonFilter: '',
    sorting: [],
    offset: 0,
    limit: DEFAULT_LOG_PAGE_SIZE,
    ...overrides,
  };
}

export type LogViewStateStore = {
  get(key: string): LogViewState;
  set(key: string, patch: Partial<LogViewState>): void;
  replace(key: string, next: LogViewState): void;
};

/**
 * Selection model for LogGrid. Data wires `row` mode to the detail sheet.
 * `cell` is typed for the future Interfaces-style viewing panel.
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

export type { FiltersByColumn, LogFieldsResponseProps, SortingState };
