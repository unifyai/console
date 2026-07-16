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
 * Reuses ViewTypes + nested Dict/List views; no tile store / multi-panel / diff.
 */
export function LogCellViewPanel({
  cells,
  onClose,
  onClear,
  onEditRow,
  className,
}: LogCellViewPanelProps) {
  const [mode, setMode] = React.useState<DisplayMode>('text');

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
          Click a cell to inspect it here (Interfaces view-tile style).
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
          {cells.map((cell) => {
            const type = getValueType(cell.value);
            const label = sanitizeId(cell.columnId);
            return (
              <div
                key={cell.cellId}
                className="space-y-2 rounded-md border border-border p-3"
                data-testid={`log-cell-view-${cell.cellId}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {getTypeIcon(type)}
                    <div className="min-w-0">
                      <div className="truncate font-mono text-[11px] font-semibold uppercase tracking-wide text-foreground">
                        {label}
                      </div>
                      <div className="text-caption text-muted-foreground">row {cell.logId}</div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <CopyButton content={formatValue(cell.value, 'raw')} className="h-7 w-7" />
                    {onEditRow && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7"
                        onClick={() => onEditRow(cell.logId)}
                        data-testid="log-cell-view-edit-row"
                      >
                        Edit row
                      </Button>
                    )}
                  </div>
                </div>
                <CellBody value={cell.value} fieldName={label} mode={mode} />
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
