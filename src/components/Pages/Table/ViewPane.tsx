'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from 'react';
import {
  X,
  ChevronRight,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/UI/button';
import { cn } from '@/lib/utils';
import { PanelExpandProvider } from '@/components/Common/Views/PanelExpandContext';
import {
  getValueType,
  getTypeIcon,
} from '@/components/Pages/Interfaces/Blocks/Selection/Views/ViewTypes';
import RowBadge from '@/components/Pages/Interfaces/Blocks/Selection/Views/RowBadge';
import { CopyButton } from '@/components/Common/Buttons/Copy';

import DictionaryView from '@/components/Pages/Interfaces/Blocks/Selection/Views/DictionaryView';
import ListView from '@/components/Pages/Interfaces/Blocks/Selection/Views/ListView';

// =============================================================================
// Types
// =============================================================================

export interface SelectedCellData {
  cellId: string;
  rowId: string;
  columnId: string;
  value: unknown;
  fieldType?: string;
  rowDataId?: string | number;
  rowIndex?: number;
}

export interface ViewPaneProps {
  selectedCells: SelectedCellData[];
  selectedRow?: Record<string, unknown>;
  focusedField?: string;
  onClose: () => void;
}

// =============================================================================
// Value rendering (renders inline text, no extra border wrapper)
// =============================================================================

function formatDisplayValue(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'string') return value || '—';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toLocaleString();
  return JSON.stringify(value, null, 2);
}

function isComplexValue(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return true;
  if (typeof value === 'object' && !(value instanceof Date)) return true;
  return false;
}

function renderComplexView(fieldName: string, value: unknown) {
  const commonProps = {
    value,
    comparables: [],
    baseLogIndex: 0,
    comparisonLogsIndex: [],
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

  if (Array.isArray(value)) {
    return <ListView {...commonProps} />;
  }
  return <DictionaryView {...commonProps} />;
}

// =============================================================================
// Helpers
// =============================================================================

function toStringForCopy(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value, null, 2);
}

// =============================================================================
// Row Field Accordion Entry
// =============================================================================

interface FieldEntryProps {
  fieldName: string;
  value: unknown;
  isFocused: boolean;
  fieldRef?: React.Ref<HTMLDivElement>;
}

function FieldEntry({ fieldName, value, isFocused, fieldRef }: FieldEntryProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const valueType = getValueType(value);

  return (
    <div
      ref={fieldRef}
      className={cn('border-border/50 border-b transition-colors', isFocused && 'bg-accent/30')}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-title hover:bg-muted/50 flex w-full items-center gap-2 px-4 py-2 text-left"
      >
        <span className="shrink-0 text-muted-foreground">
          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </span>
        <span className="shrink-0">{getTypeIcon(valueType)}</span>
        <span>{fieldName}</span>
      </button>
      {isExpanded && (
        <div className="relative ml-4 border-l border-l-muted pb-2 pl-3">
          {isComplexValue(value) ? (
            renderComplexView(fieldName, value)
          ) : (
            <div className="group relative rounded border bg-background p-2">
              <CopyButton
                className="absolute right-1 top-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                content={toStringForCopy(value)}
                copyMessage="Copied!"
              />
              <p className="text-body whitespace-pre-wrap break-all">{formatDisplayValue(value)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Grouped column display: cells from same column grouped under one accordion
// =============================================================================

interface ColumnGroupEntry {
  columnId: string;
  cells: SelectedCellData[];
}

function groupCellsByColumn(cells: SelectedCellData[]): ColumnGroupEntry[] {
  const map = new Map<string, SelectedCellData[]>();
  const order: string[] = [];
  for (const cell of cells) {
    if (!map.has(cell.columnId)) {
      map.set(cell.columnId, []);
      order.push(cell.columnId);
    }
    map.get(cell.columnId)!.push(cell);
  }
  return order.map((columnId) => ({ columnId, cells: map.get(columnId)! }));
}

/** Return the 0-based row index for a cell (RowBadge converts to 1-based internally) */
function getRowIndex0(cell: SelectedCellData): number {
  return cell.rowIndex ?? parseInt(cell.rowId, 10);
}

interface DeduplicatedValue {
  value: unknown;
  /** 0-based row indices (RowBadge adds +1 for display) */
  rows: number[];
}

function deduplicateByValue(cells: SelectedCellData[]): DeduplicatedValue[] {
  const groups: DeduplicatedValue[] = [];
  const keyMap = new Map<string, number>();
  for (const cell of cells) {
    const key = JSON.stringify(cell.value ?? null);
    if (keyMap.has(key)) {
      groups[keyMap.get(key)!].rows.push(getRowIndex0(cell));
    } else {
      keyMap.set(key, groups.length);
      groups.push({ value: cell.value, rows: [getRowIndex0(cell)] });
    }
  }
  return groups;
}

function ColumnGroupDisplay({
  group,
  isFocused,
  fieldRef,
}: {
  group: ColumnGroupEntry;
  isFocused: boolean;
  fieldRef?: React.Ref<HTMLDivElement>;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const sampleValue = group.cells[0]?.value;
  const valueType = getValueType(sampleValue);
  const deduplicated = useMemo(() => deduplicateByValue(group.cells), [group.cells]);

  return (
    <div
      ref={fieldRef}
      className={cn('border-border/50 border-b transition-colors', isFocused && 'bg-accent/30')}
    >
      {/* Trigger — matches SelectionEntry AccordionTrigger (text-title = text-sm font-medium) */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-title hover:bg-muted/50 flex w-full items-center gap-2 px-4 py-2 text-left"
      >
        <span className="shrink-0 text-muted-foreground">
          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </span>
        <span className="shrink-0">{getTypeIcon(valueType)}</span>
        <span>{group.columnId}</span>
      </button>

      {/* Content — matches SelectionEntry AccordionContent nesting line */}
      {isExpanded && (
        <div className="relative ml-4 border-l border-l-muted pb-2 pl-3">
          {deduplicated.map((entry, idx) => (
            <div key={idx} className="py-2">
              {isComplexValue(entry.value) ? (
                <div>
                  <RowBadge rowNumbers={entry.rows} mode="none" />
                  <div className="mt-1">{renderComplexView(group.columnId, entry.value)}</div>
                </div>
              ) : (
                <div className="group relative rounded border bg-background p-2">
                  <RowBadge rowNumbers={entry.rows} mode="none" />
                  <CopyButton
                    className="absolute right-1 top-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                    content={toStringForCopy(entry.value)}
                    copyMessage="Copied!"
                  />
                  <p className="text-body mt-1 whitespace-pre-wrap break-all">
                    {formatDisplayValue(entry.value)}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// PanelExpandProvider wrapper with local state
// =============================================================================

function ViewPaneExpandProvider({ children }: { children: React.ReactNode }) {
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  const [forceExpandAll, setForceExpandAll] = useState(false);
  const [forceCollapseAll, setForceCollapseAll] = useState(false);

  const toggleKey = useCallback((path: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
    setForceExpandAll(false);
    setForceCollapseAll(false);
  }, []);

  const expandAll = useCallback(() => {
    setForceExpandAll(true);
    setForceCollapseAll(false);
  }, []);

  const collapseAll = useCallback(() => {
    setForceCollapseAll(true);
    setForceExpandAll(false);
  }, []);

  const expandRecursively = useCallback((paths: string[]) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      paths.forEach((p) => next.add(p));
      return next;
    });
  }, []);

  const collapseRecursively = useCallback((paths: string[]) => {
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

// =============================================================================
// Selection Hints (empty state) — matches interfaces SelectionHints
// =============================================================================

function Hint({ command, instruction }: { command: string | ReactNode; instruction: string }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="text-caption text-semibold inline-flex shrink-0 items-center rounded-md border px-2 py-0.5">
        {command}
      </span>
      <p className="text-body-sm min-w-0 text-muted-foreground">{instruction}</p>
    </div>
  );
}

function SelectionHints() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-sm flex-col gap-1 rounded-md border border-border p-4">
        <p className="text-title mb-1">Table Actions</p>
        <Hint command="Click" instruction="Click on a cell to select it." />
        <Hint
          command="[Ctrl + Click]"
          instruction="Ctrl and click on another cell to multi-select cells."
        />
        <Hint
          command="[Shift + Click] / Mouse Drag"
          instruction="Shift and click on a cell or drag the mouse to batch-select cells."
        />
        <Hint
          command={
            <span className="flex flex-row gap-1">
              <ArrowUp size={14} />
              <ArrowDown size={14} />
              <ArrowLeft size={14} />
              <ArrowRight size={14} />
            </span>
          }
          instruction="Press arrow keys on a selected cell to select an adjacent cell."
        />
        <Hint
          command="Escape / Click outside"
          instruction="Press escape key on a selected cell or click outside of the table to reset cell selections."
        />
      </div>
    </div>
  );
}

// =============================================================================
// Main ViewPane Component
// =============================================================================

export function ViewPane({ selectedCells, selectedRow, focusedField, onClose }: ViewPaneProps) {
  const hasSelection = selectedCells.length > 0 || selectedRow !== undefined;
  const focusedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusedField && focusedRef.current && focusedRef.current.scrollIntoView) {
      focusedRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [focusedField]);

  const rowFields = useMemo(() => {
    if (!selectedRow) return [];
    return Object.entries(selectedRow).filter(([key]) => !key.startsWith('_'));
  }, [selectedRow]);

  const columnGroups = useMemo(() => groupCellsByColumn(selectedCells), [selectedCells]);

  const columnCount = columnGroups.length;
  const cellCount = selectedCells.length;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-title text-semibold text-foreground">View</h2>
          <p className="text-caption">
            {selectedRow
              ? `${rowFields.length} field${rowFields.length !== 1 ? 's' : ''}`
              : cellCount > 0
                ? `${cellCount} cell${cellCount > 1 ? 's' : ''} · ${columnCount} field${columnCount > 1 ? 's' : ''}`
                : 'Select a row or cell to view'}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="styled-scrollbar flex-1 overflow-auto">
        <ViewPaneExpandProvider>
          {!hasSelection ? (
            <SelectionHints />
          ) : selectedRow ? (
            // Row-based viewing: accordion of all fields
            <div>
              {rowFields.map(([fieldName, value]) => (
                <FieldEntry
                  key={fieldName}
                  fieldName={fieldName}
                  value={value}
                  isFocused={focusedField === fieldName}
                  fieldRef={focusedField === fieldName ? focusedRef : undefined}
                />
              ))}
            </div>
          ) : (
            // Cell-based viewing: grouped by column
            <div>
              {columnGroups.map((group) => (
                <ColumnGroupDisplay
                  key={group.columnId}
                  group={group}
                  isFocused={focusedField === group.columnId}
                  fieldRef={focusedField === group.columnId ? focusedRef : undefined}
                />
              ))}
            </div>
          )}
        </ViewPaneExpandProvider>
      </div>
    </div>
  );
}
