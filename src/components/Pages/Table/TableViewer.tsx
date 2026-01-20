'use client';

import { useState, useMemo, useCallback, useRef, useEffect, CSSProperties } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  createColumnHelper,
  SortingState,
  VisibilityState,
  ColumnOrderState,
  ColumnSizingState,
  Header,
  Column,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Eye,
  EyeOff,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  GripVertical,
  Rows3,
  Square,
  HelpCircle,
  MousePointerClick,
  Columns3,
  Grip,
  Loader2,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  UniqueIdentifier,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';

import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/UI/table';
import { Button } from '@/components/UI/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '@/components/UI/context-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/popover';
import { Checkbox } from '@/components/UI/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { cn } from '@/lib/utils';
import type {
  TableViewConfig,
  FieldMetadata,
  TableViewMetadata,
  PaginationInfo,
  TableDataResponse,
} from '@/types/tableView';

// ============================================================================
// Constants
// ============================================================================

const COPY_FEEDBACK_DURATION_MS = 2000;
const MIN_COLUMN_WIDTH = 50;
const DEFAULT_COLUMN_WIDTH = 150;
const ROW_HEIGHT = 40; // Fixed row height for virtualization
const VIRTUALIZER_OVERSCAN = 10; // Extra rows to render above/below viewport

// ============================================================================
// Types
// ============================================================================

interface TableViewerProps {
  /** Token for fetching paginated data */
  token: string;
  /** Initial config from server */
  config: TableViewConfig;
  /** Initial page data from server */
  initialData: Record<string, unknown>[];
  /** Field metadata */
  fields: Record<string, FieldMetadata>;
  /** Table view metadata */
  metadata: TableViewMetadata;
  /** Initial pagination info from server */
  initialPagination: PaginationInfo;
}

// ============================================================================
// Column Resizer Component
// ============================================================================

function ColumnResizer({
  column,
  resizeHandler,
  tableHeight,
}: {
  column: Column<Record<string, unknown>, unknown>;
  resizeHandler: (event: unknown) => void;
  tableHeight: number;
}) {
  const isResizing = column.getIsResizing();

  return (
    <div
      onDoubleClick={() => column.resetSize()}
      onMouseDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        resizeHandler(e);
      }}
      onTouchStart={resizeHandler}
      className={cn(
        'absolute right-0 top-0 z-10 w-[5px] cursor-col-resize touch-none select-none transition-colors',
        isResizing ? 'bg-primary' : 'hover:bg-primary/50'
      )}
      style={{
        height: tableHeight > 0 ? tableHeight : '100%',
      }}
    />
  );
}

// ============================================================================
// Draggable Header Component
// ============================================================================

interface DraggableHeaderProps {
  header: Header<Record<string, unknown>, unknown>;
  tableHeight: number;
  onHideColumn: (columnId: string) => void;
  onSortAsc: (columnId: string) => void;
  onSortDesc: (columnId: string) => void;
  onCopyColumn: (columnId: string) => void;
}

function DraggableHeader({
  header,
  tableHeight,
  onHideColumn,
  onSortAsc,
  onSortDesc,
  onCopyColumn,
}: DraggableHeaderProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: header.id,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    width: header.getSize(),
    minWidth: MIN_COLUMN_WIDTH,
    position: 'relative',
    borderRight: '1px solid var(--muted)',
    borderBottom: '1px solid var(--muted)',
  };

  const isSorted = header.column.getIsSorted();

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <TableHead
          ref={setNodeRef}
          style={style}
          className={cn('group select-none bg-card', isDragging && 'z-20')}
        >
          {/* Draggable area - entire header */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="flex cursor-grab items-center gap-1 pr-2 active:cursor-grabbing"
                {...attributes}
                {...listeners}
              >
                <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground opacity-50 group-hover:opacity-100" />
                <button
                  className="flex items-center gap-1 truncate hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    header.column.toggleSorting();
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <span className="truncate">{header.id}</span>
                  {isSorted === 'asc' && <ChevronUp className="h-4 w-4 shrink-0" />}
                  {isSorted === 'desc' && <ChevronDown className="h-4 w-4 shrink-0" />}
                  {!isSorted && <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-30" />}
                </button>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-sm font-medium">{header.id}</p>
              <p className="text-xs text-muted-foreground">
                Click to sort · Drag to reorder · Right-click for options
              </p>
            </TooltipContent>
          </Tooltip>

          {/* Resize handle - extends full table height */}
          <ColumnResizer
            column={header.column}
            resizeHandler={header.getResizeHandler()}
            tableHeight={tableHeight}
          />
        </TableHead>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onCopyColumn(header.id)}>
          <Copy className="mr-2 h-4 w-4" />
          Copy Column
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onSortAsc(header.id)}>
          <ChevronUp className="mr-2 h-4 w-4" />
          Sort Ascending
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onSortDesc(header.id)}>
          <ChevronDown className="mr-2 h-4 w-4" />
          Sort Descending
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onHideColumn(header.id)}>
          <EyeOff className="mr-2 h-4 w-4" />
          Hide Column
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// ============================================================================
// Drag Overlay Column Component
// ============================================================================

interface DragOverlayColumnProps {
  columnId: string;
  width: number;
  rows: Array<{ id: string; value: unknown }>;
  fieldType?: string;
}

function DragOverlayColumn({ columnId, width, rows, fieldType }: DragOverlayColumnProps) {
  return (
    <div
      className="bg-card/95 overflow-hidden rounded border border-primary shadow-lg"
      style={{ width, maxHeight: '400px' }}
    >
      {/* Header */}
      <div className="flex items-center gap-1 border-b border-muted bg-card px-3 py-2 text-sm font-medium">
        <GripVertical className="h-3 w-3 text-muted-foreground" />
        <span className="truncate">{columnId}</span>
      </div>
      {/* Sample cells */}
      <div className="overflow-hidden">
        {rows.slice(0, 8).map((row, idx) => (
          <div
            key={row.id}
            className={cn(
              'truncate border-b border-muted px-3 py-2 text-sm last:border-b-0',
              idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'
            )}
          >
            {formatCellValue(row.value, fieldType)}
          </div>
        ))}
        {rows.length > 8 && (
          <div className="px-3 py-1 text-center text-xs text-muted-foreground">
            +{rows.length - 8} more rows
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Cell Value Formatter
// ============================================================================

function formatCellValue(value: unknown, fieldType?: string): string {
  if (value === null || value === undefined) {
    return '—';
  }

  if (fieldType) {
    switch (fieldType) {
      case 'datetime':
        if (typeof value === 'string') {
          try {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              return date.toLocaleString();
            }
          } catch {
            // Fall through
          }
        }
        break;
      case 'float':
        if (typeof value === 'number') {
          return value.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 4,
          });
        }
        break;
      case 'int':
        if (typeof value === 'number') {
          return value.toLocaleString();
        }
        break;
      case 'bool':
        return value ? 'true' : 'false';
    }
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return String(value);
}

// ============================================================================
// Main Component
// ============================================================================

// Page cache type
type PageCache = Map<number, { data: Record<string, unknown>[]; pagination: PaginationInfo }>;

export function TableViewer({
  token,
  config,
  initialData,
  fields,
  metadata,
  initialPagination,
}: TableViewerProps) {
  // Refs
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const pageCacheRef = useRef<PageCache>(
    new Map([[initialPagination.page, { data: initialData, pagination: initialPagination }]])
  );

  // Server-side pagination state
  const [data, setData] = useState<Record<string, unknown>[]>(initialData);
  const [pagination, setPagination] = useState<PaginationInfo>(initialPagination);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch a page (with caching)
  const fetchPageData = useCallback(
    async (
      page: number,
      signal?: AbortSignal
    ): Promise<{ data: Record<string, unknown>[]; pagination: PaginationInfo } | null> => {
      // Check cache first
      const cached = pageCacheRef.current.get(page);
      if (cached) return cached;

      try {
        const res = await fetch(
          `/api/table/data/${token}?page=${page}&pageSize=${initialPagination.pageSize}`,
          { signal }
        );
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }
        const result: TableDataResponse = await res.json();
        const pageData = { data: result.data, pagination: result.pagination };

        // Cache the result
        pageCacheRef.current.set(page, pageData);
        return pageData;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return null;
        throw err;
      }
    },
    [token, initialPagination.pageSize]
  );

  // Navigate to a page
  const goToPage = useCallback(
    async (page: number) => {
      // Check cache first for instant navigation
      const cached = pageCacheRef.current.get(page);
      if (cached) {
        setData(cached.data);
        setPagination(cached.pagination);
        return;
      }

      // Fetch from server
      setIsLoading(true);
      setError(null);
      try {
        const pageData = await fetchPageData(page);
        if (pageData) {
          setData(pageData.data);
          setPagination(pageData.pagination);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    },
    [fetchPageData]
  );

  // Prefetch adjacent pages
  useEffect(() => {
    const controller = new AbortController();

    // Prefetch next page if available
    if (pagination.hasNextPage) {
      fetchPageData(pagination.page + 1, controller.signal).catch(() => {});
    }
    // Prefetch previous page if available (for back navigation)
    if (pagination.hasPreviousPage) {
      fetchPageData(pagination.page - 1, controller.signal).catch(() => {});
    }

    return () => controller.abort();
  }, [pagination.page, pagination.hasNextPage, pagination.hasPreviousPage, fetchPageData]);

  // State
  const [sorting, setSorting] = useState<SortingState>(() => {
    if (config.sortBy) {
      return [{ id: config.sortBy, desc: config.sortOrder === 'desc' }];
    }
    return [];
  });

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    const visibility: VisibilityState = {};
    const allColumns = Object.keys(initialData[0] || {});
    allColumns.forEach((col) => {
      visibility[col] = config.visibleColumns.includes(col);
    });
    return visibility;
  });

  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(config.columnOrder);

  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => {
    const sizing: ColumnSizingState = {};
    const allColumns = Object.keys(initialData[0] || {});
    allColumns.forEach((col) => {
      sizing[col] = config.columns?.widths?.[col] || DEFAULT_COLUMN_WIDTH;
    });
    return sizing;
  });

  const [copied, setCopied] = useState(false);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [tableHeight, setTableHeight] = useState(0);

  // Calculate table height for resize handles
  const updateTableHeight = useCallback(() => {
    if (tableRef.current) {
      setTableHeight(tableRef.current.offsetHeight);
    }
  }, []);

  // Update height on mount and when data/visibility changes
  useEffect(() => {
    // Defer to next frame so DOM is updated
    const rafId = requestAnimationFrame(updateTableHeight);
    return () => cancelAnimationFrame(rafId);
  }, [data, columnVisibility, updateTableHeight]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Build columns dynamically from data
  const columns = useMemo(() => {
    const columnHelper = createColumnHelper<Record<string, unknown>>();
    const allKeys = new Set<string>();
    data.forEach((row) => {
      Object.keys(row).forEach((key) => allKeys.add(key));
    });

    return Array.from(allKeys).map((key) => {
      const fieldType = fields[key]?.type;
      return columnHelper.accessor((row) => row[key], {
        id: key,
        header: key,
        cell: (info) => {
          const formatted = formatCellValue(info.getValue(), fieldType);
          return (
            <span className="block truncate" title={formatted}>
              {formatted}
            </span>
          );
        },
        size: config.columns?.widths?.[key] || DEFAULT_COLUMN_WIDTH,
        minSize: MIN_COLUMN_WIDTH,
        enableResizing: true,
      });
    });
  }, [data, fields, config.columns?.widths]);

  // Table instance - no client-side pagination (server-side only)
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      columnOrder,
      columnSizing,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    // No getPaginationRowModel - we use server-side pagination
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
  });

  // Get all rows for virtualization
  const { rows } = table.getRowModel();

  // Row virtualizer - only renders visible rows for performance
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: VIRTUALIZER_OVERSCAN,
  });

  // Get virtual items - may be empty in test environment (no container height)
  const virtualItems = rowVirtualizer.getVirtualItems();

  // Fallback to rendering all rows when virtualization doesn't work (e.g., in tests)
  // This happens when the scroll container has no height
  const rowsToRender = useMemo(() => {
    if (virtualItems.length > 0) {
      // Use virtualized rows
      return virtualItems.map((virtualRow) => ({
        row: rows[virtualRow.index],
        index: virtualRow.index,
        start: virtualRow.start,
        isVirtualized: true,
      }));
    }
    // Fallback: render all rows without virtualization
    return rows.map((row, index) => ({
      row,
      index,
      start: 0,
      isVirtualized: false,
    }));
  }, [virtualItems, rows]);

  // Server-side pagination handlers
  const goToFirstPage = useCallback(() => goToPage(1), [goToPage]);
  const goToPreviousPage = useCallback(() => {
    if (pagination.hasPreviousPage) goToPage(pagination.page - 1);
  }, [goToPage, pagination]);
  const goToNextPage = useCallback(() => {
    if (pagination.hasNextPage) goToPage(pagination.page + 1);
  }, [goToPage, pagination]);
  const goToLastPage = useCallback(() => {
    goToPage(pagination.totalPages);
  }, [goToPage, pagination.totalPages]);

  // Handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setColumnOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over?.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
    setActiveId(null);
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  // Helper to escape TSV values - handles any input type
  const escapeTsv = useCallback((value: unknown): string => {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    if (
      stringValue.includes('\t') ||
      stringValue.includes('\n') ||
      stringValue.includes('\r') ||
      stringValue.includes('"')
    ) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  }, []);

  const handleCopyTable = useCallback(async () => {
    const visibleRows = table.getRowModel().rows;
    const visibleColumns = table.getVisibleLeafColumns();

    const headers = visibleColumns.map((col) => escapeTsv(col.id)).join('\t');
    const rows = visibleRows.map((row) =>
      visibleColumns
        .map((col) => {
          const fieldType = fields[col.id]?.type;
          return escapeTsv(formatCellValue(row.getValue(col.id), fieldType));
        })
        .join('\t')
    );

    const tsv = [headers, ...rows].join('\n');

    try {
      await navigator.clipboard.writeText(tsv);
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_FEEDBACK_DURATION_MS);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [table, fields, escapeTsv]);

  const handleCopyCell = useCallback(async (value: unknown, fieldType?: string) => {
    const formatted = formatCellValue(value, fieldType);
    try {
      await navigator.clipboard.writeText(formatted);
    } catch (err) {
      console.error('Failed to copy cell:', err);
    }
  }, []);

  const handleCopyRow = useCallback(
    async (row: Record<string, unknown>) => {
      const visibleColumns = table.getVisibleLeafColumns();
      const values = visibleColumns.map((col) => {
        const fieldType = fields[col.id]?.type;
        return escapeTsv(formatCellValue(row[col.id], fieldType));
      });
      const tsv = values.join('\t');
      try {
        await navigator.clipboard.writeText(tsv);
      } catch (err) {
        console.error('Failed to copy row:', err);
      }
    },
    [table, fields, escapeTsv]
  );

  const handleCopyColumn = useCallback(
    async (columnId: string) => {
      const visibleRows = table.getRowModel().rows;
      const fieldType = fields[columnId]?.type;
      const values = visibleRows.map((row) =>
        escapeTsv(formatCellValue(row.getValue(columnId), fieldType))
      );
      // Include header
      const tsv = [escapeTsv(columnId), ...values].join('\n');
      try {
        await navigator.clipboard.writeText(tsv);
      } catch (err) {
        console.error('Failed to copy column:', err);
      }
    },
    [table, fields, escapeTsv]
  );

  const visibleColumnIds = table.getVisibleLeafColumns().map((col) => col.id);

  // Get data for drag overlay
  const activeColumn = activeId ? table.getColumn(activeId as string) : null;
  const activeColumnRows = useMemo(() => {
    if (!activeId) return [];
    return table.getRowModel().rows.map((row) => ({
      id: row.id,
      value: row.getValue(activeId as string),
    }));
  }, [activeId, table]);

  return (
    <TooltipProvider delayDuration={500}>
      <div className="flex h-screen flex-col bg-background text-foreground">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                {metadata.title || 'Table View'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {metadata.projectName} · {pagination.totalCount.toLocaleString()} total rows
              </p>
            </div>

            {/* Help Button */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-80 p-4">
                <div className="space-y-4">
                  <div>
                    <h3 className="mb-2 font-semibold text-foreground">How to Use</h3>
                    <p className="text-sm text-muted-foreground">
                      This is a read-only table view. You can explore and copy data, but not edit
                      it.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <MousePointerClick className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div className="text-sm">
                        <p className="font-medium text-foreground">Right-click for options</p>
                        <p className="text-muted-foreground">
                          Copy cells, rows, or columns. Sort and hide columns.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Grip className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div className="text-sm">
                        <p className="font-medium text-foreground">Drag to reorder</p>
                        <p className="text-muted-foreground">
                          Drag column headers to rearrange columns.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Columns3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div className="text-sm">
                        <p className="font-medium text-foreground">Resize columns</p>
                        <p className="text-muted-foreground">
                          Drag column borders to adjust width.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Copy className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div className="text-sm">
                        <p className="font-medium text-foreground">Copy all data</p>
                        <p className="text-muted-foreground">
                          Click Copy to copy visible data as TSV for spreadsheets.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center gap-2">
            {/* Column Visibility Popover - stays open for multiple toggles */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Eye className="mr-2 h-4 w-4" />
                        Columns
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      className="styled-scrollbar max-h-72 w-56 overflow-y-auto p-2"
                    >
                      <div className="space-y-1">
                        {table.getAllLeafColumns().map((column) => (
                          <label
                            key={column.id}
                            className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted"
                          >
                            <Checkbox
                              checked={column.getIsVisible()}
                              onCheckedChange={(checked) => column.toggleVisibility(!!checked)}
                            />
                            <span className="truncate">{column.id}</span>
                          </label>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-sm">Show or hide columns</p>
              </TooltipContent>
            </Tooltip>

            {/* Copy Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleCopyTable}>
                  {copied ? (
                    <>
                      <Check className="mr-2 h-4 w-4 text-green-500" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-sm">Copy current page as TSV</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </header>

        {/* Table Container */}
        <div ref={tableContainerRef} className="styled-scrollbar relative flex-1 overflow-auto">
          {/* Loading overlay */}
          {isLoading && (
            <div className="bg-background/60 absolute inset-0 z-20 flex items-center justify-center backdrop-blur-sm">
              <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-6 py-4 shadow-lg">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">
                    Loading page {pagination.page}...
                  </span>
                  <span className="text-xs text-muted-foreground">Fetching data from server</span>
                </div>
              </div>
            </div>
          )}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToHorizontalAxis]}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <Table ref={tableRef} style={{ width: table.getTotalSize(), tableLayout: 'fixed' }}>
              <colgroup>
                {table.getVisibleLeafColumns().map((column) => (
                  <col key={column.id} style={{ width: column.getSize() }} />
                ))}
              </colgroup>
              <TableHeader className="sticky top-0 z-10">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="hover:bg-transparent">
                    <SortableContext
                      items={visibleColumnIds}
                      strategy={horizontalListSortingStrategy}
                    >
                      {headerGroup.headers.map((header) => (
                        <DraggableHeader
                          key={header.id}
                          header={header}
                          tableHeight={tableHeight}
                          onHideColumn={(columnId) => {
                            const column = table.getColumn(columnId);
                            if (column) column.toggleVisibility(false);
                          }}
                          onSortAsc={(columnId) => {
                            setSorting([{ id: columnId, desc: false }]);
                          }}
                          onSortDesc={(columnId) => {
                            setSorting([{ id: columnId, desc: true }]);
                          }}
                          onCopyColumn={handleCopyColumn}
                        />
                      ))}
                    </SortableContext>
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody
                style={{
                  // Only use absolute positioning when virtualization is active
                  height: virtualItems.length > 0 ? `${rowVirtualizer.getTotalSize()}px` : 'auto',
                  position: virtualItems.length > 0 ? 'relative' : 'static',
                }}
              >
                {rowsToRender.map((renderItem) => {
                  const row = renderItem.row;
                  const rowIndex = renderItem.index;
                  const isVirtualized = renderItem.isVirtualized;

                  return (
                    <TableRow
                      key={row.id}
                      data-index={rowIndex}
                      ref={
                        isVirtualized ? (node) => rowVirtualizer.measureElement(node) : undefined
                      }
                      className={cn(rowIndex % 2 === 0 ? 'bg-background' : 'bg-muted/30')}
                      style={
                        isVirtualized
                          ? {
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: `${ROW_HEIGHT}px`,
                              transform: `translateY(${renderItem.start}px)`,
                            }
                          : undefined
                      }
                    >
                      {row.getVisibleCells().map((cell) => {
                        const cellValue = cell.getValue();
                        const fieldType = fields[cell.column.id]?.type;
                        const formattedValue = formatCellValue(cellValue, fieldType);

                        return (
                          <ContextMenu key={cell.id}>
                            <ContextMenuTrigger asChild>
                              <TableCell
                                style={{
                                  width: cell.column.getSize(),
                                  maxWidth: cell.column.getSize(),
                                  height: `${ROW_HEIGHT}px`,
                                  borderRight: '1px solid var(--muted)',
                                  borderBottom: '1px solid var(--muted)',
                                  opacity: activeId === cell.column.id ? 0.3 : 1,
                                }}
                              >
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="block cursor-default truncate">
                                      {formattedValue}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-sm">
                                    <p className="whitespace-pre-wrap break-all text-sm">
                                      {formattedValue}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TableCell>
                            </ContextMenuTrigger>
                            <ContextMenuContent>
                              <ContextMenuItem onClick={() => handleCopyCell(cellValue, fieldType)}>
                                <Square className="mr-2 h-4 w-4" />
                                Copy Cell
                              </ContextMenuItem>
                              <ContextMenuItem onClick={() => handleCopyRow(row.original)}>
                                <Rows3 className="mr-2 h-4 w-4" />
                                Copy Row
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Drag Overlay - renders full column preview */}
            <DragOverlay dropAnimation={null}>
              {activeId && activeColumn ? (
                <DragOverlayColumn
                  columnId={activeId as string}
                  width={activeColumn.getSize()}
                  rows={activeColumnRows}
                  fieldType={fields[activeId as string]?.type}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>

        {/* Pagination Footer */}
        <footer className="flex items-center justify-between border-t border-border px-6 py-3">
          <div className="text-sm text-muted-foreground">
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </span>
            ) : error ? (
              <span className="text-destructive">{error}</span>
            ) : (
              <>
                Showing {((pagination.page - 1) * pagination.pageSize + 1).toLocaleString()}–
                {Math.min(
                  pagination.page * pagination.pageSize,
                  pagination.totalCount
                ).toLocaleString()}{' '}
                of {pagination.totalCount.toLocaleString()} rows
              </>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={goToFirstPage}
              disabled={!pagination.hasPreviousPage || isLoading}
              aria-label="Go to first page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={goToPreviousPage}
              disabled={!pagination.hasPreviousPage || isLoading}
              aria-label="Go to previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <span className="px-2 text-sm text-foreground">
              Page {pagination.page} of {pagination.totalPages}
            </span>

            <Button
              variant="ghost"
              size="icon"
              onClick={goToNextPage}
              disabled={!pagination.hasNextPage || isLoading}
              aria-label="Go to next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={goToLastPage}
              disabled={!pagination.hasNextPage || isLoading}
              aria-label="Go to last page"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
}
