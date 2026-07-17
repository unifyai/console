'use client';

import * as React from 'react';
import { ChevronDown, ChevronRight, Pencil, X } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { ScrollArea } from '@/components/UI/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UI/select';
import { CopyButton } from '@/components/Common/Buttons/Copy';
import Tooltip from '@/components/Common/Misc/Tooltip';
import {
  getValueType,
  getTypeIcon,
} from '@/components/Pages/Interfaces/Blocks/Selection/Views/ViewTypes';
import DictionaryView from '@/components/Pages/Interfaces/Blocks/Selection/Views/DictionaryView';
import ListView from '@/components/Pages/Interfaces/Blocks/Selection/Views/ListView';
import { PanelExpandProvider } from '@/components/Common/Views/PanelExpandContext';
import { sanitizeId } from '@/lib/logs/columns';
import { parseCellId, type LogGridRow } from '@/lib/logs/types';
import { compareRowLabels, compressRowLabels } from '@/lib/logs/rowLabels';
import { cn } from '@/lib/utils';

export type LogCellSelection = {
  cellId: string;
  logId: number;
  /** `#` column label in the current grid (flat `1` or nested `1.2.3`). */
  rowLabel: string;
  columnId: string;
  value: unknown;
  row?: LogGridRow;
};

type ValueGroup = {
  value: unknown;
  logIds: number[];
  rowLabels: string[];
};

type ColumnGroup = {
  columnId: string;
  values: ValueGroup[];
};

interface LogCellViewPanelProps {
  cells: LogCellSelection[];
  onClose: () => void;
  /** Open edit UI for a single cell (log + column), not the whole row. */
  onEditCell?: (logId: number, columnId: string) => void;
  className?: string;
}

type DisplayMode = 'markdown' | 'text' | 'raw';

function formatValue(value: unknown, mode: DisplayMode): string {
  if (value === null || value === undefined) return '—';
  if (mode === 'raw') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** Stable map key for grouping identical cell values within a column. */
function valueGroupKey(value: unknown): string {
  if (value === undefined) return '::undefined::';
  if (value === null) return '::null::';
  if (typeof value === 'string') return `s:${value}`;
  if (typeof value === 'number' || typeof value === 'boolean') return `p:${String(value)}`;
  try {
    return `j:${JSON.stringify(value)}`;
  } catch {
    return `r:${String(value)}`;
  }
}

function sortValueGroup(group: ValueGroup): ValueGroup {
  const order = group.rowLabels
    .map((_, i) => i)
    .sort((a, b) => compareRowLabels(group.rowLabels[a]!, group.rowLabels[b]!));
  return {
    value: group.value,
    rowLabels: order.map((i) => group.rowLabels[i]!),
    logIds: order.map((i) => group.logIds[i]!),
  };
}

/**
 * Group selected cells by column, then by equal value — Table ViewPane style.
 * Each column is one foldable heading; identical values within a column collapse
 * to a single entry with compressed `#` display row labels.
 */
export function groupCellsByColumn(cells: LogCellSelection[]): ColumnGroup[] {
  const columnOrder: string[] = [];
  const byColumn = new Map<string, Map<string, ValueGroup>>();

  for (const cell of cells) {
    if (!byColumn.has(cell.columnId)) {
      columnOrder.push(cell.columnId);
      byColumn.set(cell.columnId, new Map());
    }
    const colMap = byColumn.get(cell.columnId)!;
    const key = valueGroupKey(cell.value);
    const existing = colMap.get(key);
    if (existing) {
      if (!existing.logIds.includes(cell.logId)) {
        existing.logIds.push(cell.logId);
        existing.rowLabels.push(cell.rowLabel);
      }
    } else {
      colMap.set(key, {
        value: cell.value,
        logIds: [cell.logId],
        rowLabels: [cell.rowLabel],
      });
    }
  }

  return columnOrder.map((columnId) => ({
    columnId,
    values: [...byColumn.get(columnId)!.values()]
      .map(sortValueGroup)
      // Ascending by lowest `#` in each group (selection order is arbitrary).
      .sort((a, b) => compareRowLabels(a.rowLabels[0]!, b.rowLabels[0]!)),
  }));
}

/** Flat list of value groups (column order preserved) — useful for tests/assertions. */
export function groupCellsByColumnValue(
  cells: LogCellSelection[]
): Array<ValueGroup & { columnId: string }> {
  return groupCellsByColumn(cells).flatMap((column) =>
    column.values.map((value) => ({ ...value, columnId: column.columnId }))
  );
}

function ComplexBody({ fieldName, value }: { fieldName: string; value: unknown }) {
  const commonProps = {
    value,
    comparables: [] as unknown[],
    baseLogIndex: 0,
    comparisonLogsIndex: [] as number[],
    diffMode: 'none' as const,
    splitView: false,
    displayMode: 'text' as const,
    cellEditMode: false,
    nestingLevel: 0,
    prefix: '',
    parentPath: fieldName,
    isImmutable: true,
    fieldName,
    context: null,
    baseLog: undefined,
    comparisonLogs: undefined,
  };
  if (Array.isArray(value)) return <ListView {...commonProps} />;
  if (value && typeof value === 'object') return <DictionaryView {...commonProps} />;
  return null;
}

function LogPanelExpandProvider({ children }: { children: React.ReactNode }) {
  const [openKeys, setOpenKeys] = React.useState<Set<string>>(new Set());
  const [forceExpandAll, setForceExpandAll] = React.useState(false);
  const [forceCollapseAll, setForceCollapseAll] = React.useState(false);

  const toggleKey = React.useCallback((path: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
    setForceExpandAll(false);
    setForceCollapseAll(false);
  }, []);

  const expandAll = React.useCallback(() => {
    setForceExpandAll(true);
    setForceCollapseAll(false);
  }, []);

  const collapseAll = React.useCallback(() => {
    setForceCollapseAll(true);
    setForceExpandAll(false);
  }, []);

  const expandRecursively = React.useCallback((paths: string[]) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      paths.forEach((p) => next.add(p));
      return next;
    });
  }, []);

  const collapseRecursively = React.useCallback((paths: string[]) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      paths.forEach((p) => next.delete(p));
      return next;
    });
  }, []);

  return (
    <PanelExpandProvider
      openKeys={openKeys}
      setOpenKeys={setOpenKeys}
      forceExpandAll={forceExpandAll}
      forceCollapseAll={forceCollapseAll}
      toggleKey={toggleKey}
      expandAll={expandAll}
      collapseAll={collapseAll}
      expandRecursively={expandRecursively}
      collapseRecursively={collapseRecursively}
    >
      {children}
    </PanelExpandProvider>
  );
}

function CellBody({
  value,
  fieldName,
  mode,
}: {
  value: unknown;
  fieldName: string;
  mode: DisplayMode;
}) {
  const type = getValueType(value);
  if (mode !== 'raw' && (type === 'dict' || type === 'list' || type === 'matrix')) {
    return (
      <LogPanelExpandProvider>
        <div className="bg-muted/20 rounded-md border border-border p-2">
          <ComplexBody fieldName={fieldName} value={value} />
        </div>
      </LogPanelExpandProvider>
    );
  }
  if (type === 'image' && typeof value === 'string') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={value} alt="" className="max-h-64 max-w-full rounded-md border border-border" />
    );
  }
  const text = formatValue(value, mode);
  const mono =
    mode === 'raw' || type === 'dict' || type === 'list' || type === 'matrix' || type === 'number';
  return (
    <pre
      className={cn(
        'bg-muted/30 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border p-3 text-sm text-foreground',
        mono && 'font-mono text-[12px]',
        mode === 'markdown' && type === 'string' && 'prose prose-sm max-w-none dark:prose-invert'
      )}
    >
      {text}
    </pre>
  );
}

function ColumnGroupDisplay({
  group,
  mode,
  onEditCell,
}: {
  group: ColumnGroup;
  mode: DisplayMode;
  onEditCell?: (logId: number, columnId: string) => void;
}) {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const label = sanitizeId(group.columnId);
  const sampleType = getValueType(group.values[0]?.value);

  return (
    <div
      className="border-border/50 border-b"
      data-testid="log-cell-view-column"
      data-column={label}
    >
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="text-title hover:bg-muted/50 flex w-full items-center gap-2 px-1 py-2 text-left"
        aria-expanded={isExpanded}
        data-testid="log-cell-view-column-toggle"
      >
        <span className="shrink-0 text-muted-foreground">
          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </span>
        <span className="shrink-0">{getTypeIcon(sampleType)}</span>
        <span className="truncate font-mono text-[11px] font-semibold uppercase tracking-wide text-foreground">
          {label}
        </span>
      </button>

      {isExpanded && (
        <div className="relative ml-4 border-l border-l-muted pb-2 pl-3">
          {group.values.map((valueGroup) => {
            const rowLabel = compressRowLabels(valueGroup.rowLabels);
            const groupKey = `${valueGroupKey(valueGroup.value)}:${valueGroup.logIds.join(',')}`;
            return (
              <div
                key={groupKey}
                className="space-y-2 py-2"
                data-testid="log-cell-view-group"
                data-column={label}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-caption text-muted-foreground">
                    {valueGroup.rowLabels.length === 1 ? `row ${rowLabel}` : `rows [${rowLabel}]`}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <CopyButton
                      content={formatValue(valueGroup.value, 'raw')}
                      className="h-7 w-7"
                    />
                    {onEditCell && valueGroup.logIds.length === 1 && (
                      <Tooltip content={`Edit ${label}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => onEditCell(valueGroup.logIds[0], group.columnId)}
                          aria-label={`Edit ${label}`}
                          data-testid="log-cell-view-edit-cell"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </Tooltip>
                    )}
                  </div>
                </div>
                <CellBody value={valueGroup.value} fieldName={label} mode={mode} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Viewing panel for selected LogGrid cells.
 * Groups by column under foldable headings (expanded by default), then
 * collapses identical values within a column to one entry with a compressed
 * row-number range.
 */
export function LogCellViewPanel({ cells, onClose, onEditCell, className }: LogCellViewPanelProps) {
  const [mode, setMode] = React.useState<DisplayMode>('text');
  const columns = React.useMemo(() => groupCellsByColumn(cells), [cells]);

  if (cells.length === 0) {
    return (
      <div
        className={cn('flex w-80 shrink-0 flex-col border-l border-border bg-card', className)}
        data-testid="log-cell-view-panel-empty"
      >
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-title text-foreground">Selection</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-caption p-4 text-muted-foreground">
          Select cells, then open the view pane to inspect them.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn('flex w-96 shrink-0 flex-col border-l border-border bg-card', className)}
      data-testid="log-cell-view-panel"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="text-title text-foreground">
          {cells.length === 1 ? 'Selected cell' : `${cells.length} cells`}
        </span>
        <div className="flex items-center gap-1">
          <Select value={mode} onValueChange={(v) => setMode(v as DisplayMode)}>
            <SelectTrigger className="h-8 w-[100px]" data-testid="log-cell-view-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="markdown">Markdown</SelectItem>
              <SelectItem value="raw">Raw</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-1 p-3">
          {columns.map((column) => (
            <ColumnGroupDisplay
              key={column.columnId}
              group={column}
              mode={mode}
              onEditCell={onEditCell}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export function cellsFromSelection(
  selectedCells: string[],
  rows: LogGridRow[],
  rowLabels: Map<string, string> = new Map()
): LogCellSelection[] {
  const byId = new Map(rows.map((r) => [String(r.logId), r]));
  return selectedCells
    .map((cellId) => {
      const { logId, columnId } = parseCellId(cellId);
      const row = byId.get(logId);
      const field = sanitizeId(columnId);
      const value = row?.entries[field] ?? row?.entries[columnId];
      return {
        cellId,
        logId: Number(logId) || 0,
        rowLabel: rowLabels.get(logId) ?? '',
        columnId,
        value,
        row,
      } satisfies LogCellSelection;
    })
    .filter((c) => c.columnId);
}
