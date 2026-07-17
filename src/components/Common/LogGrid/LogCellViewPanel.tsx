'use client';

import * as React from 'react';
import { X } from 'lucide-react';
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
import {
  getValueType,
  getTypeIcon,
} from '@/components/Pages/Interfaces/Blocks/Selection/Views/ViewTypes';
import DictionaryView from '@/components/Pages/Interfaces/Blocks/Selection/Views/DictionaryView';
import ListView from '@/components/Pages/Interfaces/Blocks/Selection/Views/ListView';
import { PanelExpandProvider } from '@/components/Common/Views/PanelExpandContext';
import { sanitizeId } from '@/lib/logs/columns';
import { parseCellId, type LogGridRow } from '@/lib/logs/types';
import { cn } from '@/lib/utils';

export type LogCellSelection = {
  cellId: string;
  logId: number;
  columnId: string;
  value: unknown;
  row?: LogGridRow;
};

type ValueGroup = {
  columnId: string;
  value: unknown;
  logIds: number[];
};

interface LogCellViewPanelProps {
  cells: LogCellSelection[];
  onClose: () => void;
  onClear: () => void;
  onEditRow?: (logId: number) => void;
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

/**
 * Group selected cells by column, then by equal value — Interfaces view-tile style.
 * Each group shows the value once with the list of row log ids that share it.
 */
export function groupCellsByColumnValue(cells: LogCellSelection[]): ValueGroup[] {
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
      if (!existing.logIds.includes(cell.logId)) existing.logIds.push(cell.logId);
    } else {
      colMap.set(key, {
        columnId: cell.columnId,
        value: cell.value,
        logIds: [cell.logId],
      });
    }
  }

  const groups: ValueGroup[] = [];
  for (const columnId of columnOrder) {
    const colMap = byColumn.get(columnId)!;
    for (const group of colMap.values()) {
      group.logIds.sort((a, b) => a - b);
      groups.push(group);
    }
  }
  return groups;
}

/** Compress sorted numeric ids like [10,11,12,15] → "10-12, 15" (no +1; ids are log ids). */
function compressLogIds(ids: number[]): string {
  if (!ids.length) return '';
  const sorted = [...new Set(ids)].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let end = start;
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    if (current === end + 1) {
      end = current;
    } else {
      ranges.push(start === end ? String(start) : `${start}-${end}`);
      start = current;
      end = current;
    }
  }
  ranges.push(start === end ? String(start) : `${start}-${end}`);
  return ranges.join(', ');
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

/**
 * Interfaces-style viewing panel for selected LogGrid cells.
 * Groups identical values per column so a multi-row empty selection shows
 * one card per column with a compressed row-id range, not N duplicate cards.
 */
export function LogCellViewPanel({
  cells,
  onClose,
  onClear,
  onEditRow,
  className,
}: LogCellViewPanelProps) {
  const [mode, setMode] = React.useState<DisplayMode>('text');
  const groups = React.useMemo(() => groupCellsByColumnValue(cells), [cells]);

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
            className="h-7 w-7 p-0"
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
            <SelectTrigger className="h-7 w-[100px]" data-testid="log-cell-view-mode">
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
            className="h-7"
            onClick={onClear}
            data-testid="log-cell-view-clear"
          >
            Clear
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-3">
          {groups.map((group) => {
            const type = getValueType(group.value);
            const label = sanitizeId(group.columnId);
            const rowLabel = compressLogIds(group.logIds);
            const groupKey = `${group.columnId}:${valueGroupKey(group.value)}:${group.logIds.join(',')}`;
            return (
              <div
                key={groupKey}
                className="space-y-2 rounded-md border border-border p-3"
                data-testid="log-cell-view-group"
                data-column={label}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {getTypeIcon(type)}
                    <div className="min-w-0">
                      <div className="truncate font-mono text-[11px] font-semibold uppercase tracking-wide text-foreground">
                        {label}
                      </div>
                      <div className="text-caption text-muted-foreground">
                        {group.logIds.length === 1 ? `row ${rowLabel}` : `rows [${rowLabel}]`}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <CopyButton content={formatValue(group.value, 'raw')} className="h-7 w-7" />
                    {onEditRow && group.logIds.length === 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7"
                        onClick={() => onEditRow(group.logIds[0])}
                        data-testid="log-cell-view-edit-row"
                      >
                        Edit row
                      </Button>
                    )}
                  </div>
                </div>
                <CellBody value={group.value} fieldName={label} mode={mode} />
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

export function cellsFromSelection(
  selectedCells: string[],
  rows: LogGridRow[]
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
        columnId,
        value,
        row,
      } satisfies LogCellSelection;
    })
    .filter((c) => c.columnId);
}
