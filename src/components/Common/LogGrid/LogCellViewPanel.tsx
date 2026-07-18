'use client';

import * as React from 'react';
import { ChevronDown, ChevronRight, Lock, X } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { ScrollArea } from '@/components/UI/scroll-area';
import { Textarea } from '@/components/UI/textarea';
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
  /** Whether a column may be edited inline (e.g. `ui_editable`). */
  isColumnEditable?: (columnId: string) => boolean;
  /**
   * Persist an inline edit to one or more rows (broadcast when a value group
   * covers multiple selected cells). Return true when saved.
   */
  onCommitEdit?: (logIds: number[], columnId: string, draft: string) => Promise<boolean>;
  /** Initial draft text for the editor (typed / JSON string form of the value). */
  draftForValue?: (columnId: string, value: unknown) => string;
  /**
   * Incremented when the grid opens this pane via cell double-click so an
   * editable value box starts in edit mode. `0` means no auto-edit.
   */
  editNonce?: number;
  className?: string;
}

const PANEL_WIDTH_KEY = 'console:log-cell-view-panel-width';
const PANEL_DEFAULT_WIDTH = 384;
const PANEL_MIN_WIDTH = 280;
const PANEL_MIN_MAIN_WIDTH = 280;
const PANEL_MAX_WIDTH = 720;

function clampPanelWidth(width: number, maxWidth = PANEL_MAX_WIDTH): number {
  return Math.min(maxWidth, Math.max(PANEL_MIN_WIDTH, Math.round(width)));
}

function readPanelWidth(): number {
  if (typeof window === 'undefined') return PANEL_DEFAULT_WIDTH;
  try {
    const raw = window.localStorage.getItem(PANEL_WIDTH_KEY);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? clampPanelWidth(parsed) : PANEL_DEFAULT_WIDTH;
  } catch {
    return PANEL_DEFAULT_WIDTH;
  }
}

function writePanelWidth(width: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PANEL_WIDTH_KEY, String(clampPanelWidth(width)));
  } catch {
    /* width persistence is optional */
  }
}

/** Plain text display: strings/primitives as-is; objects as pretty JSON. */
function formatDisplayValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** JSON form for copy / edit drafts. */
function formatRawValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
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

function ValueCopyButton({ value }: { value: unknown }) {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center px-0.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
      <CopyButton
        content={formatRawValue(value)}
        showSuccessNotification={false}
        className="pointer-events-auto h-4 w-4 p-0 [&_svg]:size-2.5"
      />
    </div>
  );
}

/** Clipped `#` / range gutter; full label via native title on hover. */
function RowGutter({ label, widthCh }: { label: string; widthCh: number }) {
  return (
    <span
      className="min-w-[2rem] max-w-[6rem] shrink-0 self-stretch truncate border-r border-border px-1 py-0.5 text-right font-mono text-[11px] tabular-nums leading-snug text-muted-foreground"
      style={{ width: `calc(${widthCh}ch + 1rem)` }}
      title={label}
      data-testid="log-cell-view-row-label"
    >
      {label}
    </span>
  );
}

/** Widest compressed row label in the pane — keeps gutter dividers aligned. */
function maxRowLabelWidthCh(columns: ColumnGroup[]): number {
  let max = 1;
  for (const column of columns) {
    for (const valueGroup of column.values) {
      const len = compressRowLabels(valueGroup.rowLabels).length;
      if (len > max) max = len;
    }
  }
  return max;
}

/** Matches preview `max-h-80` — edit grows with content up to this, then scrolls. */
const CELL_EDIT_MAX_HEIGHT_PX = 320;

function CellBody({
  value,
  fieldName,
  rowLabel,
  gutterCh,
  editable,
  draftText,
  onCommit,
  onLockedClick,
  editNonce = 0,
}: {
  value: unknown;
  fieldName: string;
  rowLabel: string;
  gutterCh: number;
  editable: boolean;
  draftText: string;
  onCommit?: (draft: string) => Promise<boolean>;
  /** Locked-column feedback (jiggle the column lock icon). */
  onLockedClick?: () => void;
  /** Bumped on grid cell double-click to open this box in edit mode. */
  editNonce?: number;
}) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(draftText);
  const [isSaving, setIsSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const skipCommitRef = React.useRef(false);
  const commitInFlightRef = React.useRef(false);
  /** Place caret at end + scroll to tail once when edit mode opens. */
  const placeCaretAtEndRef = React.useRef(false);

  React.useEffect(() => {
    if (!isEditing) setDraft(draftText);
  }, [draftText, isEditing]);

  // Grow with wrapped content up to CELL_EDIT_MAX_HEIGHT_PX; overflow scrolls.
  React.useLayoutEffect(() => {
    if (!isEditing) return;
    const el = inputRef.current;
    if (!el) return;

    el.style.height = 'auto';
    el.style.overflowY = 'hidden';
    const next = el.scrollHeight;
    if (next > CELL_EDIT_MAX_HEIGHT_PX) {
      el.style.height = `${CELL_EDIT_MAX_HEIGHT_PX}px`;
      el.style.overflowY = 'auto';
    } else {
      el.style.height = `${next}px`;
    }

    if (placeCaretAtEndRef.current) {
      placeCaretAtEndRef.current = false;
      const end = el.value.length;
      el.focus();
      try {
        el.setSelectionRange(end, end);
      } catch {
        /* some browsers reject selection on disabled inputs */
      }
      // Preview shows the head; edit shows the tail when content is clipped.
      if (el.scrollHeight > el.clientHeight) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [isEditing, draft]);

  const startEdit = () => {
    if (!editable || !onCommit || isSaving) return;
    skipCommitRef.current = false;
    placeCaretAtEndRef.current = true;
    setDraft(draftText);
    setIsEditing(true);
  };

  // Cell double-click opens the pane already in edit mode (Excel-style).
  React.useEffect(() => {
    if (editNonce <= 0 || !editable || !onCommit || isSaving) return;
    skipCommitRef.current = false;
    placeCaretAtEndRef.current = true;
    setDraft(draftText);
    setIsEditing(true);
    // Intentionally keyed only on editNonce so Enter/unfold remounts do not re-enter edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editNonce]);

  const cancelEdit = () => {
    skipCommitRef.current = true;
    setIsEditing(false);
    setDraft(draftText);
  };

  const commitEdit = async () => {
    if (!onCommit || isSaving || commitInFlightRef.current) return;
    if (skipCommitRef.current) {
      skipCommitRef.current = false;
      return;
    }
    if (draft === draftText) {
      setIsEditing(false);
      return;
    }
    commitInFlightRef.current = true;
    setIsSaving(true);
    const ok = await onCommit(draft);
    setIsSaving(false);
    commitInFlightRef.current = false;
    if (ok) setIsEditing(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      cancelEdit();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      void commitEdit();
    }
  };

  const boxShell = (content: React.ReactNode, extraClassName?: string) => (
    <div
      className={cn(
        'bg-muted/30 group relative flex min-w-0 overflow-hidden rounded border border-border font-mono text-[11px]',
        editable && 'cursor-text',
        extraClassName
      )}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (editable) {
          startEdit();
          return;
        }
        onLockedClick?.();
      }}
      data-testid="log-cell-view-value"
      data-editable={editable ? 'true' : 'false'}
    >
      <RowGutter label={rowLabel} widthCh={gutterCh} />
      <div className="relative min-w-0 flex-1">{content}</div>
    </div>
  );

  if (isEditing) {
    return (
      <div className="relative flex min-w-0 overflow-hidden rounded border border-primary bg-background font-mono text-[11px]">
        <RowGutter label={rowLabel} widthCh={gutterCh} />
        <div className="relative min-w-0 flex-1">
          <Textarea
            ref={inputRef}
            value={draft}
            rows={1}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => void commitEdit()}
            disabled={isSaving}
            className="min-h-0 resize-none border-0 bg-transparent px-1.5 py-0.5 font-mono text-[11px] leading-snug shadow-none focus-visible:ring-0"
            style={{ scrollbarWidth: 'thin' }}
            data-testid="log-cell-view-editor"
            aria-label={`Edit ${fieldName}`}
          />
        </div>
      </div>
    );
  }

  const type = getValueType(value);

  if (type === 'dict' || type === 'list' || type === 'matrix') {
    return (
      <LogPanelExpandProvider>
        {boxShell(
          <>
            <ValueCopyButton value={value} />
            <div className="px-1.5 py-0.5">
              <ComplexBody fieldName={fieldName} value={value} />
            </div>
          </>
        )}
      </LogPanelExpandProvider>
    );
  }
  if (type === 'image' && typeof value === 'string') {
    return boxShell(
      <>
        <ValueCopyButton value={value} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value} alt="" className="max-h-64 max-w-full p-1" />
      </>
    );
  }
  const text = formatDisplayValue(value);
  return boxShell(
    <>
      <ValueCopyButton value={value} />
      <div className="overflow-auto" style={{ maxHeight: CELL_EDIT_MAX_HEIGHT_PX }}>
        <pre className="whitespace-pre-wrap break-words px-1.5 py-0.5 leading-snug text-foreground">
          {text}
        </pre>
      </div>
    </>
  );
}

function ColumnGroupDisplay({
  group,
  gutterCh,
  isColumnEditable,
  onCommitEdit,
  draftForValue,
  editNonce = 0,
}: {
  group: ColumnGroup;
  gutterCh: number;
  isColumnEditable?: (columnId: string) => boolean;
  onCommitEdit?: (logIds: number[], columnId: string, draft: string) => Promise<boolean>;
  draftForValue?: (columnId: string, value: unknown) => string;
  editNonce?: number;
}) {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const lockRef = React.useRef<HTMLSpanElement>(null);
  const label = sanitizeId(group.columnId);
  const sampleType = getValueType(group.values[0]?.value);
  const columnEditable = isColumnEditable?.(group.columnId) ?? false;
  const showLock = isColumnEditable != null && !columnEditable;

  const nudgeLock = React.useCallback(() => {
    const el = lockRef.current;
    if (!el) return;
    // Same restart trick as LiveActions `animate-nudge` for non-expandable rows.
    el.classList.remove('animate-nudge');
    void el.offsetWidth;
    el.classList.add('animate-nudge');
  }, []);

  return (
    <div data-testid="log-cell-view-column" data-column={label}>
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="hover:bg-muted/50 flex w-full items-center gap-1 px-0.5 py-1 text-left"
        aria-expanded={isExpanded}
        data-testid="log-cell-view-column-toggle"
      >
        <span className="shrink-0 text-muted-foreground">
          {isExpanded ? (
            <ChevronDown className="h-2.5 w-2.5" />
          ) : (
            <ChevronRight className="h-2.5 w-2.5" />
          )}
        </span>
        <span className="shrink-0 [&_svg]:size-3">{getTypeIcon(sampleType)}</span>
        <span className="truncate font-mono text-[10px] font-semibold uppercase tracking-wide text-foreground">
          {label}
        </span>
        {showLock && (
          <span ref={lockRef} className="inline-flex shrink-0">
            <Lock
              className="h-2.5 w-2.5 text-muted-foreground"
              aria-label="Read-only column"
              data-testid={`log-cell-view-column-lock-${label}`}
            />
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="relative ml-2.5 space-y-0.5 border-l border-l-muted pb-1 pl-2">
          {group.values.map((valueGroup) => {
            const rowLabel = compressRowLabels(valueGroup.rowLabels);
            const groupKey = `${valueGroupKey(valueGroup.value)}:${valueGroup.logIds.join(',')}`;
            const editable = columnEditable && valueGroup.logIds.length > 0 && !!onCommitEdit;
            const draftText =
              draftForValue?.(group.columnId, valueGroup.value) ?? formatRawValue(valueGroup.value);
            return (
              <div key={groupKey} data-testid="log-cell-view-group" data-column={label}>
                <CellBody
                  value={valueGroup.value}
                  fieldName={label}
                  rowLabel={rowLabel}
                  gutterCh={gutterCh}
                  editable={editable}
                  draftText={draftText === '—' ? '' : draftText}
                  editNonce={editNonce}
                  onLockedClick={showLock ? nudgeLock : undefined}
                  onCommit={
                    editable
                      ? (draft) => onCommitEdit(valueGroup.logIds, group.columnId, draft)
                      : undefined
                  }
                />
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
 * collapses identical values within a column to a single entry with compressed
 * `#` display row labels. Click an editable value box to edit inline (broadcasts
 * to every row in a multi-cell value group), or open via cell double-click to
 * land directly in edit mode.
 */
export function LogCellViewPanel({
  cells,
  onClose,
  isColumnEditable,
  onCommitEdit,
  draftForValue,
  editNonce = 0,
  className,
}: LogCellViewPanelProps) {
  const columns = React.useMemo(() => groupCellsByColumn(cells), [cells]);
  const gutterCh = React.useMemo(() => maxRowLabelWidthCh(columns), [columns]);
  const autoEditNonce = cells.length === 1 ? editNonce : 0;
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(PANEL_DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = React.useState(false);

  React.useEffect(() => {
    setWidth(readPanelWidth());
  }, []);

  const getMaxWidth = React.useCallback(() => {
    const parent = panelRef.current?.parentElement;
    if (!parent) return PANEL_MAX_WIDTH;
    return Math.min(
      PANEL_MAX_WIDTH,
      Math.max(PANEL_MIN_WIDTH, parent.getBoundingClientRect().width - PANEL_MIN_MAIN_WIDTH)
    );
  }, []);

  const setWidthWithinBounds = React.useCallback(
    (next: number) => {
      const clamped = clampPanelWidth(next, getMaxWidth());
      setWidth(clamped);
      writePanelWidth(clamped);
    },
    [getMaxWidth]
  );

  const handleResizeKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setWidthWithinBounds(width + 24);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setWidthWithinBounds(width - 24);
      } else if (e.key === 'Home') {
        e.preventDefault();
        setWidthWithinBounds(PANEL_MIN_WIDTH);
      } else if (e.key === 'End') {
        e.preventDefault();
        setWidthWithinBounds(getMaxWidth());
      }
    },
    [getMaxWidth, setWidthWithinBounds, width]
  );

  const handleResizeStart = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const parent = panelRef.current?.parentElement;
      if (!parent) return;

      e.preventDefault();
      const rect = parent.getBoundingClientRect();
      const maxWidth = Math.min(
        PANEL_MAX_WIDTH,
        Math.max(PANEL_MIN_WIDTH, rect.width - PANEL_MIN_MAIN_WIDTH)
      );
      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      let nextWidth = clampPanelWidth(width, maxWidth);

      setIsResizing(true);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onMove = (ev: PointerEvent) => {
        nextWidth = clampPanelWidth(rect.right - ev.clientX, maxWidth);
        setWidth(nextWidth);
      };

      const onUp = () => {
        setIsResizing(false);
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        writePanelWidth(nextWidth);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [width]
  );

  const isEmpty = cells.length === 0;
  const title = isEmpty
    ? 'Selection'
    : cells.length === 1
      ? 'Selected cell'
      : `${cells.length} cells`;

  return (
    <div
      ref={panelRef}
      className={cn(
        'relative flex shrink-0 flex-col border-l border-border bg-card',
        isResizing && 'select-none',
        className
      )}
      style={{ width, minWidth: PANEL_MIN_WIDTH }}
      data-testid={isEmpty ? 'log-cell-view-panel-empty' : 'log-cell-view-panel'}
    >
      <div
        role="separator"
        aria-label="Resize cell view pane"
        aria-orientation="vertical"
        aria-valuemin={PANEL_MIN_WIDTH}
        aria-valuenow={width}
        tabIndex={0}
        onKeyDown={handleResizeKeyDown}
        onPointerDown={handleResizeStart}
        className={cn(
          'absolute inset-y-0 -left-1 z-20 w-2 cursor-col-resize touch-none bg-transparent transition-colors duration-200',
          'hover:bg-primary-tint-20 focus-visible:bg-primary-tint-20 focus-visible:outline-none active:bg-primary-tint-40',
          isResizing && 'bg-primary-tint-40'
        )}
        data-testid="log-cell-view-panel-resize-handle"
      />
      <div className="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-border px-2.5">
        <span className="font-mono text-[11px] font-semibold text-foreground">{title}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      {isEmpty ? (
        <p className="text-caption p-3 text-muted-foreground">
          Select cells, then open the view pane to inspect them.
        </p>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-1 p-2">
            {columns.map((column) => (
              <ColumnGroupDisplay
                key={column.columnId}
                group={column}
                gutterCh={gutterCh}
                isColumnEditable={isColumnEditable}
                onCommitEdit={onCommitEdit}
                draftForValue={draftForValue}
                editNonce={autoEditNonce}
              />
            ))}
          </div>
        </ScrollArea>
      )}
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
