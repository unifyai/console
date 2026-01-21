'use client';

import { useState, useEffect } from 'react';
import {
  CurlyBraces,
  Brackets,
  Hash,
  Type,
  Calendar,
  ToggleLeft,
  X,
  ChevronRight,
  ChevronDown,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Button } from '@/components/UI/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/UI/context-menu';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

export interface SelectedCellData {
  cellId: string;
  rowId: string;
  columnId: string;
  value: unknown;
  fieldType?: string;
  rowDataId?: string | number; // The actual _id from the row data
  rowIndex?: number; // The visual row number (1-based)
}

interface DetailPaneProps {
  selectedCells: SelectedCellData[];
  onClose: () => void;
}

// =============================================================================
// Type Detection
// =============================================================================

type ValueType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null' | 'date';

function getValueType(value: unknown): ValueType {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') {
    // Check if it looks like a date
    if (value instanceof Date) return 'date';
    return 'object';
  }
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'string') {
    // Check if string is an ISO date
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return 'date';
    return 'string';
  }
  return 'string';
}

function getTypeIcon(type: ValueType) {
  switch (type) {
    case 'object':
      return <CurlyBraces className="h-3.5 w-3.5 text-blue-500" />;
    case 'array':
      return <Brackets className="h-3.5 w-3.5 text-green-500" />;
    case 'number':
      return <Hash className="h-3.5 w-3.5 text-orange-500" />;
    case 'string':
      return <Type className="h-3.5 w-3.5 text-purple-500" />;
    case 'boolean':
      return <ToggleLeft className="h-3.5 w-3.5 text-cyan-500" />;
    case 'date':
      return <Calendar className="h-3.5 w-3.5 text-pink-500" />;
    case 'null':
      return <span className="text-xs text-muted-foreground">∅</span>;
    default:
      return <Type className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

// =============================================================================
// Type-based line colors (matches parent icon color)
// =============================================================================

function getTypeLineColor(type: ValueType): string {
  switch (type) {
    case 'object':
      return 'border-blue-500/50';
    case 'array':
      return 'border-green-500/50';
    default:
      return 'border-muted-foreground/30';
  }
}

// =============================================================================
// Nested Content Wrapper (draws guide lines matching parent type)
// =============================================================================

interface NestedContentProps {
  parentType: ValueType;
  children: React.ReactNode;
}

function NestedContent({ parentType, children }: NestedContentProps) {
  return (
    <div className={cn('ml-[7px] border-l-2 pl-3', getTypeLineColor(parentType))}>{children}</div>
  );
}

// =============================================================================
// Value Renderer with expand/collapse state
// =============================================================================

interface ValueViewProps {
  value: unknown;
  depth?: number;
  keyName?: string;
  expandAll?: boolean; // When true, expand this and all children
}

function ValueView({ value, depth = 0, keyName, expandAll }: ValueViewProps) {
  const type = getValueType(value);
  // Only auto-expand first level by default, or if expandAll is true
  const [isExpanded, setIsExpanded] = useState(depth === 0 || expandAll === true);
  // Key to force re-render children with new expand state
  const [childExpandAll, setChildExpandAll] = useState<boolean | undefined>(undefined);

  // Sync expanded state when expandAll prop changes
  useEffect(() => {
    if (expandAll === true) {
      setIsExpanded(true);
    } else if (expandAll === false) {
      setIsExpanded(false);
    }
  }, [expandAll]);

  // Null/undefined
  if (type === 'null') {
    return (
      <div className="flex items-center gap-2 py-0.5 text-xs">
        <span className="shrink-0">{getTypeIcon('null')}</span>
        {keyName && <span className="text-muted-foreground">{keyName}:</span>}
        <span className="italic text-muted-foreground">null</span>
      </div>
    );
  }

  // Primitives
  if (type === 'string' || type === 'number' || type === 'boolean' || type === 'date') {
    let displayValue: string;
    let valueClass = 'text-foreground';

    if (type === 'string') {
      displayValue = String(value);
      valueClass = 'text-green-600 dark:text-green-400';
    } else if (type === 'number') {
      displayValue = typeof value === 'number' ? value.toLocaleString() : String(value);
      valueClass = 'text-orange-600 dark:text-orange-400';
    } else if (type === 'boolean') {
      displayValue = value ? 'true' : 'false';
      valueClass = 'text-cyan-600 dark:text-cyan-400';
    } else if (type === 'date') {
      try {
        displayValue = new Date(value as string).toLocaleString();
      } catch {
        displayValue = String(value);
      }
      valueClass = 'text-pink-600 dark:text-pink-400';
    } else {
      displayValue = String(value);
    }

    // For long strings, show in a text block
    const isLongString = type === 'string' && displayValue.length > 100;

    return (
      <div className="flex items-center gap-2 py-0.5 text-xs">
        <span className="shrink-0">{getTypeIcon(type)}</span>
        {keyName && <span className="shrink-0 text-muted-foreground">{keyName}:</span>}
        {isLongString ? (
          <pre className={cn('whitespace-pre-wrap break-all text-xs', valueClass)}>
            {displayValue}
          </pre>
        ) : (
          <span className={cn('break-all', valueClass)}>{displayValue}</span>
        )}
      </div>
    );
  }

  // Array
  if (type === 'array') {
    const arr = value as unknown[];
    if (arr.length === 0) {
      return (
        <div className="flex items-center gap-2 py-0.5 text-xs">
          <span className="shrink-0">{getTypeIcon('array')}</span>
          {keyName && <span className="text-muted-foreground">{keyName}:</span>}
          <span className="text-muted-foreground">[ ]</span>
        </div>
      );
    }

    const handleExpandAll = () => {
      setIsExpanded(true);
      setChildExpandAll(true);
    };

    const handleCollapseAll = () => {
      setIsExpanded(false);
      setChildExpandAll(false);
    };

    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="hover:bg-muted/50 flex w-full items-center gap-1 py-0.5 text-left text-xs"
            >
              <span className="shrink-0 text-muted-foreground">
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </span>
              <span className="shrink-0">{getTypeIcon('array')}</span>
              {keyName && <span className="text-muted-foreground">{keyName}:</span>}
              <span className="text-muted-foreground">[{arr.length} items]</span>
            </button>
            {isExpanded && (
              <NestedContent parentType="array">
                {arr.map((item, idx) => (
                  <ValueView
                    key={`${idx}-${childExpandAll ?? expandAll}`}
                    value={item}
                    depth={depth + 1}
                    keyName={`[${idx}]`}
                    expandAll={childExpandAll ?? expandAll}
                  />
                ))}
              </NestedContent>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={handleExpandAll}>
            <Maximize2 className="mr-2 h-3 w-3" />
            Expand All
          </ContextMenuItem>
          <ContextMenuItem onClick={handleCollapseAll}>
            <Minimize2 className="mr-2 h-3 w-3" />
            Collapse All
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  }

  // Object
  if (type === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);

    if (keys.length === 0) {
      return (
        <div className="flex items-center gap-2 py-0.5 text-xs">
          <span className="shrink-0">{getTypeIcon('object')}</span>
          {keyName && <span className="text-muted-foreground">{keyName}:</span>}
          <span className="text-muted-foreground">{'{ }'}</span>
        </div>
      );
    }

    const handleExpandAll = () => {
      setIsExpanded(true);
      setChildExpandAll(true);
    };

    const handleCollapseAll = () => {
      setIsExpanded(false);
      setChildExpandAll(false);
    };

    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="hover:bg-muted/50 flex w-full items-center gap-1 py-0.5 text-left text-xs"
            >
              <span className="shrink-0 text-muted-foreground">
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </span>
              <span className="shrink-0">{getTypeIcon('object')}</span>
              {keyName && <span className="text-muted-foreground">{keyName}:</span>}
              <span className="text-muted-foreground">{`{${keys.length} keys}`}</span>
            </button>
            {isExpanded && (
              <NestedContent parentType="object">
                {keys.map((key) => (
                  <ValueView
                    key={`${key}-${childExpandAll ?? expandAll}`}
                    value={obj[key]}
                    depth={depth + 1}
                    keyName={key}
                    expandAll={childExpandAll ?? expandAll}
                  />
                ))}
              </NestedContent>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={handleExpandAll}>
            <Maximize2 className="mr-2 h-3 w-3" />
            Expand All
          </ContextMenuItem>
          <ContextMenuItem onClick={handleCollapseAll}>
            <Minimize2 className="mr-2 h-3 w-3" />
            Collapse All
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  }

  // Fallback
  return (
    <div className="py-0.5">
      <span className="text-muted-foreground">{String(value)}</span>
    </div>
  );
}

// =============================================================================
// Cell Entry Component
// =============================================================================

interface CellEntryProps {
  cell: SelectedCellData;
  isFirst: boolean;
}

function CellEntry({ cell, isFirst }: CellEntryProps) {
  // Display row number (1-based) and _id
  const rowNumber = cell.rowIndex ?? parseInt(cell.rowId, 10) + 1;
  const displayId = cell.rowDataId !== undefined ? cell.rowDataId : cell.rowId;

  return (
    <div className={cn('py-3', !isFirst && 'border-t border-border')}>
      {/* Cell header */}
      <div className="mb-2 flex items-center gap-2 text-sm">
        <span className="font-medium text-foreground">{cell.columnId}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-xs text-muted-foreground">
          Row {rowNumber}
          {cell.rowDataId !== undefined && (
            <span className="text-muted-foreground/70 ml-1">({displayId})</span>
          )}
        </span>
      </div>

      {/* Cell value */}
      <div className="bg-muted/30 rounded-md p-2">
        <ValueView value={cell.value} />
      </div>
    </div>
  );
}

// =============================================================================
// Main DetailPane Component
// =============================================================================

export function DetailPane({ selectedCells, onClose }: DetailPaneProps) {
  const hasSelection = selectedCells.length > 0;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Details</h2>
          <p className="text-xs text-muted-foreground">
            {hasSelection
              ? `${selectedCells.length} cell${selectedCells.length > 1 ? 's' : ''} selected`
              : 'Select cells to view'}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="styled-scrollbar flex-1 overflow-auto p-4">
        {!hasSelection ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-2 text-4xl">📊</div>
            <p className="text-sm text-muted-foreground">
              Click on cells to view their full content here
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Use Ctrl+click or Shift+click to select multiple
            </p>
          </div>
        ) : selectedCells.length === 1 ? (
          // Single cell - show just the value
          (() => {
            const cell = selectedCells[0];
            const rowNumber = cell.rowIndex ?? parseInt(cell.rowId, 10) + 1;
            return (
              <div>
                <div className="mb-2 text-sm">
                  <span className="font-medium">{cell.columnId}</span>
                  <span className="text-muted-foreground">
                    {' '}
                    · Row {rowNumber}
                    {cell.rowDataId !== undefined && (
                      <span className="text-muted-foreground/70 ml-1">({cell.rowDataId})</span>
                    )}
                  </span>
                </div>
                <div className="rounded-md border border-border bg-card p-3">
                  <ValueView value={cell.value} />
                </div>
              </div>
            );
          })()
        ) : (
          // Multiple cells - show each
          <div className="space-y-2">
            {selectedCells.map((cell, idx) => (
              <CellEntry key={cell.cellId} cell={cell} isFirst={idx === 0} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
