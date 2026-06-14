'use client';

import {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  forwardRef,
  CSSProperties,
} from 'react';
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
  EyeOff,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreVertical,
  SortAsc,
  SortDesc,
  ArrowUpDown,
  Rows3,
  Square,
  HelpCircle,
  MousePointerClick,
  Columns3,
  Grip,
  Loader2,
  PanelRightOpen,
  PanelRightClose,
  Search,
  Keyboard,
} from 'lucide-react';
import { Loader } from '@/components/Common/Loader';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/UI/dropdown-menu';
import { Switch } from '@/components/UI/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/UI/resizable';
import { cn } from '@/lib/utils';
import type {
  TableViewConfig,
  FieldMetadata,
  TableViewMetadata,
  PaginationInfo,
  TableDataResponse,
} from '@/types/tableView';
import { useCellSelection } from './useCellSelection';
import { ViewPane, type SelectedCellData } from './ViewPane';

// ============================================================================
// Constants
// ============================================================================

const COPY_FEEDBACK_DURATION_MS = 2000;
const MIN_COLUMN_WIDTH = 50;
const DEFAULT_COLUMN_WIDTH = 150;
const ROW_HEIGHT = 40; // Fixed row height for virtualization
const VIRTUALIZER_OVERSCAN = 10; // Extra rows to render above/below viewport
const ROW_NUMBER_COL = 'RowNumbering';

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
  isColumnSelected: boolean;
  onHideColumn: (columnId: string) => void;
  onSortAsc: (columnId: string) => void;
  onSortDesc: (columnId: string) => void;
  onResetSort: (columnId: string) => void;
  onCopyColumn: (columnId: string) => void;
  onMouseDown: (
    e: React.MouseEvent<HTMLElement>,
    header: Header<Record<string, unknown>, unknown>
  ) => void;
  onMouseOver: (
    e: React.MouseEvent<HTMLElement>,
    header: Header<Record<string, unknown>, unknown>
  ) => void;
  onMouseUp: () => void;
}

function DraggableHeader({
  header,
  tableHeight,
  isColumnSelected,
  onHideColumn,
  onSortAsc,
  onSortDesc,
  onResetSort,
  onCopyColumn,
  onMouseDown,
  onMouseOver,
  onMouseUp,
}: DraggableHeaderProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id: header.id,
  });
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? 'width transform 0.2s ease-in-out' : undefined,
    opacity: isDragging ? 0.8 : 1,
    width: header.getSize(),
    minWidth: MIN_COLUMN_WIDTH,
    position: 'relative',
    borderRight: '1px solid var(--muted)',
    borderBottom: '1px solid var(--muted)',
    zIndex: isDragging ? 20 : undefined,
    backgroundColor: isColumnSelected ? 'var(--primary)' : undefined,
    color: isColumnSelected ? 'var(--primary-foreground)' : undefined,
  };

  const isSorted = header.column.getIsSorted();

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <TableHead
          ref={setNodeRef}
          style={style}
          className={cn(
            'group select-none p-0',
            isDragging && 'z-20',
            !isColumnSelected && 'bg-card'
          )}
          onMouseOver={(e) => onMouseOver(e, header)}
          onMouseUp={onMouseUp}
        >
          <div className="flex h-full flex-col">
            {/* Drag handle area */}
            <div
              className="flex h-2 cursor-grab items-center justify-center active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <div className="bg-muted-foreground/30 group-hover:bg-muted-foreground/60 h-px w-6" />
            </div>
            {/* Column name + 3-dot menu */}
            <div className="flex min-w-0 flex-1 items-center gap-0.5 px-2 pb-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-1 truncate hover:text-foreground"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      onMouseDown(e, header);
                    }}
                  >
                    <span className="text-body-sm truncate">{header.id}</span>
                    {isSorted === 'asc' && (
                      <SortAsc className="h-3.5 w-3.5 shrink-0 text-primary" />
                    )}
                    {isSorted === 'desc' && (
                      <SortDesc className="h-3.5 w-3.5 shrink-0 text-primary" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-title">{header.id}</p>
                  <p className="text-caption">Click to select · Drag top edge to reorder</p>
                </TooltipContent>
              </Tooltip>
              {/* 3-dots dropdown */}
              <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-0 hover:bg-muted group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[10rem]">
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      onClick={() => {
                        onSortAsc(header.id);
                        setDropdownOpen(false);
                      }}
                      className="text-body-sm flex cursor-pointer items-center gap-2"
                    >
                      <SortAsc className="h-4 w-4" />
                      <span>Sort ascending</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        onSortDesc(header.id);
                        setDropdownOpen(false);
                      }}
                      className="text-body-sm flex cursor-pointer items-center gap-2"
                    >
                      <SortDesc className="h-4 w-4" />
                      <span>Sort descending</span>
                    </DropdownMenuItem>
                    {isSorted && (
                      <DropdownMenuItem
                        onClick={() => {
                          onResetSort(header.id);
                          setDropdownOpen(false);
                        }}
                        className="text-body-sm flex cursor-pointer items-center gap-2"
                      >
                        <ArrowUpDown className="h-4 w-4" />
                        <span>Reset sort</span>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => {
                        onHideColumn(header.id);
                        setDropdownOpen(false);
                      }}
                      className="text-body-sm flex cursor-pointer items-center gap-2"
                    >
                      <EyeOff className="h-4 w-4" />
                      <span>Hide column</span>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {/* Resize handle */}
          <ColumnResizer
            column={header.column}
            resizeHandler={header.getResizeHandler()}
            tableHeight={tableHeight}
          />
        </TableHead>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onClick={() => {
            const syntheticEvent = {
              ctrlKey: false,
              metaKey: false,
              shiftKey: false,
              stopPropagation: () => {},
              preventDefault: () => {},
            } as unknown as React.MouseEvent<HTMLElement>;
            onMouseDown(syntheticEvent, header);
          }}
        >
          <Columns3 className="mr-2 h-4 w-4" />
          Select Column
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onCopyColumn(header.id)}>
          <Copy className="mr-2 h-4 w-4" />
          Copy Column
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onSortAsc(header.id)}>
          <SortAsc className="mr-2 h-4 w-4" />
          Sort Ascending
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onSortDesc(header.id)}>
          <SortDesc className="mr-2 h-4 w-4" />
          Sort Descending
        </ContextMenuItem>
        {isSorted && (
          <ContextMenuItem onClick={() => onResetSort(header.id)}>
            <ArrowUpDown className="mr-2 h-4 w-4" />
            Reset Sort
          </ContextMenuItem>
        )}
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
// Sortable Data Cell — each cell participates in column DnD for smooth animation
// ============================================================================

interface SortableDataCellProps {
  cell: import('@tanstack/react-table').Cell<Record<string, unknown>, unknown>;
  children: React.ReactNode;
  isSelected: boolean;
  width: number;
  onMouseDown: (e: React.MouseEvent<HTMLElement>) => void;
  onMouseUp: () => void;
  onMouseOver: (e: React.MouseEvent<HTMLElement>) => void;
}

const SortableDataCell = forwardRef<HTMLTableCellElement, SortableDataCellProps>(
  function SortableDataCell(
    { cell, children, isSelected, width, onMouseDown, onMouseUp, onMouseOver },
    externalRef
  ) {
    const { setNodeRef, transform, isDragging } = useSortable({
      id: cell.column.id,
    });

    const mergedRef = useCallback(
      (node: HTMLTableCellElement | null) => {
        setNodeRef(node);
        if (typeof externalRef === 'function') externalRef(node);
        else if (externalRef)
          (externalRef as React.MutableRefObject<HTMLTableCellElement | null>).current = node;
      },
      [setNodeRef, externalRef]
    );

    const style: CSSProperties = {
      width,
      maxWidth: width,
      height: `${ROW_HEIGHT}px`,
      borderRight: '1px solid var(--muted)',
      borderBottom: '1px solid var(--muted)',
      transform: CSS.Translate.toString(transform),
      transition: isDragging ? 'width transform 0.2s ease-in-out' : undefined,
      opacity: isDragging ? 0.8 : 1,
      backgroundColor: isSelected ? 'var(--primary)' : undefined,
      color: isSelected ? 'var(--primary-foreground)' : undefined,
      zIndex: isDragging ? 1 : 0,
    };

    return (
      <TableCell
        ref={mergedRef}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseOver={onMouseOver}
        className="select-none p-1"
        style={style}
      >
        {children}
      </TableCell>
    );
  }
);

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

  // Cell selection state
  const [selectedCells, setSelectedCells] = useState<string[]>([]);

  // Row selection for ViewPane
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [focusedField, setFocusedField] = useState<string | undefined>(undefined);

  // View pane state with exit animation support
  const [isViewPaneOpen, setIsViewPaneOpen] = useState(false);
  const [isViewPaneVisible, setIsViewPaneVisible] = useState(false);
  const [isViewPaneExiting, setIsViewPaneExiting] = useState(false);

  const handleViewPaneToggle = useCallback(() => {
    if (isViewPaneOpen) {
      setIsViewPaneExiting(true);
      setTimeout(() => {
        setIsViewPaneVisible(false);
        setIsViewPaneExiting(false);
        setIsViewPaneOpen(false);
      }, 200);
    } else {
      setIsViewPaneOpen(true);
      setIsViewPaneVisible(true);
    }
  }, [isViewPaneOpen]);

  const handleViewPaneClose = useCallback(() => {
    setIsViewPaneExiting(true);
    setTimeout(() => {
      setIsViewPaneVisible(false);
      setIsViewPaneExiting(false);
      setIsViewPaneOpen(false);
    }, 200);
  }, []);

  const handleRowClick = useCallback(
    (rowIndex: number) => {
      setSelectedRowIndex(rowIndex);
      setFocusedField(undefined);
      if (!isViewPaneOpen) {
        setIsViewPaneOpen(true);
        setIsViewPaneVisible(true);
      }
    },
    [isViewPaneOpen]
  );

  const handleCellClickForViewPane = useCallback((rowIndex: number, columnId: string) => {
    setSelectedRowIndex(null);
    setFocusedField(columnId);
  }, []);

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

  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(() => {
    const baseOrder = config.columnOrder || [];
    return [ROW_NUMBER_COL, ...baseOrder.filter((id) => id !== ROW_NUMBER_COL)];
  });

  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => {
    const sizing: ColumnSizingState = {};
    const allColumns = Object.keys(initialData[0] || {});
    allColumns.forEach((col) => {
      sizing[col] = config.columns?.widths?.[col] || DEFAULT_COLUMN_WIDTH;
    });
    return sizing;
  });

  const [copied, setCopied] = useState(false);
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

    const rowNumberColumn = columnHelper.display({
      id: ROW_NUMBER_COL,
      header: '#',
      cell: (info) => {
        const rowNumber = (pagination.page - 1) * pagination.pageSize + info.row.index + 1;
        return <span className="block text-center text-muted-foreground">{rowNumber}</span>;
      },
      size: 50,
      minSize: 40,
      maxSize: 60,
      enableResizing: false,
      enableSorting: false,
      enableHiding: false,
    });

    const dataColumns = Array.from(allKeys).map((key) => {
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

    return [rowNumberColumn, ...dataColumns];
  }, [data, fields, config.columns?.widths, pagination.page, pagination.pageSize]);

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

  // Helper to escape TSV values - handles any input type (defined early for use in copy handlers)
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

  // Copy selected cells to clipboard (Ctrl+C handler)
  const handleCopySelectedCells = useCallback(async () => {
    if (selectedCells.length === 0) return;

    // Group cells by row for proper TSV formatting
    const allRows = table.getRowModel().rows;
    const visibleColumns = table.getVisibleLeafColumns().filter((col) => col.id !== ROW_NUMBER_COL);

    // Parse selected cells into row/column structure
    const selectedByRow = new Map<string, Set<string>>();
    selectedCells.forEach((cellId) => {
      const underscoreIdx = cellId.indexOf('_');
      const rowId = cellId.substring(0, underscoreIdx);
      const columnId = cellId.substring(underscoreIdx + 1);
      if (!selectedByRow.has(rowId)) {
        selectedByRow.set(rowId, new Set());
      }
      selectedByRow.get(rowId)!.add(columnId);
    });

    // Build TSV - only include rows/columns that have selected cells
    const lines: string[] = [];
    allRows.forEach((row) => {
      const selectedColumnsInRow = selectedByRow.get(row.id);
      if (!selectedColumnsInRow) return;

      const values: string[] = [];
      visibleColumns.forEach((col) => {
        if (selectedColumnsInRow.has(col.id)) {
          const fieldType = fields[col.id]?.type;
          values.push(escapeTsv(formatCellValue(row.getValue(col.id), fieldType)));
        }
      });
      if (values.length > 0) {
        lines.push(values.join('\t'));
      }
    });

    const tsv = lines.join('\n');

    try {
      await navigator.clipboard.writeText(tsv);
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_FEEDBACK_DURATION_MS);
    } catch (err) {
      console.error('Failed to copy selected cells:', err);
    }
  }, [selectedCells, table, fields, escapeTsv]);

  // Cell selection (unified handlers for cells + headers, matching interfaces pattern)
  const {
    handleCellMouseDown,
    handleCellMouseUp,
    handleCellMouseOver,
    handleKeyDown,
    isCellSelected,
    isAllRowSelected,
    clearSelection,
    selectAll,
    wasDraggingRef,
  } = useCellSelection({
    table,
    selectedCells,
    setSelectedCells,
    scrollContainerRef: tableContainerRef,
    excludeColumnId: ROW_NUMBER_COL,
    onCopy: handleCopySelectedCells,
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
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setColumnOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over?.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }, []);

  const handleCopyTable = useCallback(async () => {
    const visibleRows = table.getRowModel().rows;
    const visibleColumns = table.getVisibleLeafColumns().filter((col) => col.id !== ROW_NUMBER_COL);

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
      const visibleColumns = table
        .getVisibleLeafColumns()
        .filter((col) => col.id !== ROW_NUMBER_COL);
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

  // Select an entire row (all visible data columns) — used by context menu
  const handleSelectRow = useCallback(
    (rowId: string) => {
      const visibleColumns = table
        .getVisibleLeafColumns()
        .filter((col) => col.id !== ROW_NUMBER_COL);
      const cellIds = visibleColumns.map((col) => `${rowId}_${col.id}`);
      setSelectedCells(cellIds);
    },
    [table]
  );

  const visibleColumnIds = table
    .getVisibleLeafColumns()
    .filter((col) => col.id !== ROW_NUMBER_COL)
    .map((col) => col.id);

  // Selected row data for ViewPane row-based viewing
  const selectedRowData = useMemo(() => {
    if (selectedRowIndex === null) return undefined;
    const allRows = table.getRowModel().rows;
    const row = allRows[selectedRowIndex];
    if (!row) return undefined;
    return row.original as Record<string, unknown>;
  }, [selectedRowIndex, table]);

  const selectedCellsData: SelectedCellData[] = useMemo(() => {
    return selectedCells
      .filter((cellId) => !cellId.endsWith(`_${ROW_NUMBER_COL}`))
      .map((cellId) => {
        // Cell ID format: "rowId_columnId"
        const underscoreIdx = cellId.indexOf('_');
        const rowId = cellId.substring(0, underscoreIdx);
        const columnId = cellId.substring(underscoreIdx + 1);

        // Find the row and get the value
        const allRows = table.getRowModel().rows;
        const rowIdx = allRows.findIndex((r) => r.id === rowId);
        const row = rowIdx >= 0 ? allRows[rowIdx] : undefined;
        const value = row ? row.getValue(columnId) : undefined;

        // Get the actual _id from the row data if available
        const rawRowDataId = row?.original?._id;
        // Ensure it's string or number, not null or object
        const rowDataId =
          typeof rawRowDataId === 'string' || typeof rawRowDataId === 'number'
            ? rawRowDataId
            : undefined;

        // Calculate visual row number (1-based, accounting for pagination)
        const rowIndex =
          rowIdx >= 0 ? (pagination.page - 1) * pagination.pageSize + rowIdx + 1 : undefined;

        return {
          cellId,
          rowId,
          columnId,
          value,
          fieldType: fields[columnId]?.type,
          rowDataId,
          rowIndex,
        };
      });
  }, [selectedCells, table, fields, pagination.page, pagination.pageSize]);

  return (
    <TooltipProvider delayDuration={500}>
      <div className="flex h-screen flex-col bg-background text-foreground">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <div>
              <h1 className="text-h1 text-semibold text-foreground">
                {metadata.title || 'Table View'}
              </h1>
              <p className="text-body-muted">
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
              <PopoverContent align="start" className="w-96 p-4">
                <div className="space-y-4">
                  <div>
                    <h3 className="mb-2 font-semibold text-foreground">Table Viewer</h3>
                    <p className="text-body-muted">
                      Read-only table view. Explore, select, and copy data.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Square className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div className="text-body">
                        <p className="font-medium text-foreground">Select cells</p>
                        <p className="text-muted-foreground">
                          <span className="font-medium">Click</span> to select a cell.{' '}
                          <span className="font-medium">Ctrl/Cmd+Click</span> for multi-select.{' '}
                          <span className="font-medium">Shift+Click</span> for range select.{' '}
                          <span className="font-medium">Drag</span> to select multiple cells.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <PanelRightOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div className="text-body">
                        <p className="font-medium text-foreground">View pane</p>
                        <p className="text-muted-foreground">
                          Click <span className="font-medium">View</span> to open the view pane.
                          Shows selected row or cell contents with nested data expanded. Right-click
                          a cell and choose <span className="font-medium">Inspect</span> to open.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <MousePointerClick className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div className="text-body">
                        <p className="font-medium text-foreground">Context menus</p>
                        <p className="text-muted-foreground">
                          <span className="font-medium">Right-click headers</span> to sort, hide, or
                          copy columns. <span className="font-medium">Right-click cells</span> to
                          copy, select rows/columns, or inspect.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Grip className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div className="text-body">
                        <p className="font-medium text-foreground">Reorder &amp; resize</p>
                        <p className="text-muted-foreground">
                          <span className="font-medium">Drag headers</span> to reorder columns.{' '}
                          <span className="font-medium">Drag borders</span> to resize.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Columns3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div className="text-body">
                        <p className="font-medium text-foreground">Column visibility</p>
                        <p className="text-muted-foreground">
                          Click <span className="font-medium">Columns</span> to show/hide columns.
                          The popover stays open for multiple toggles.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Copy className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div className="text-body">
                        <p className="font-medium text-foreground">Copy data</p>
                        <p className="text-muted-foreground">
                          Click <span className="font-medium">Copy</span> to copy visible data as
                          TSV (paste into spreadsheets). Use context menus for specific cells, rows,
                          or columns.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Keyboard className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div className="text-body">
                        <p className="font-medium text-foreground">Keyboard shortcuts</p>
                        <p className="text-muted-foreground">
                          <span className="font-medium">Ctrl+A</span> select all.{' '}
                          <span className="font-medium">Ctrl+C</span> copy selected.{' '}
                          <span className="font-medium">Arrows</span> navigate.{' '}
                          <span className="font-medium">Esc</span> deselect.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center gap-2">
            {/* Column Visibility Popover */}
            <Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Columns3 className="mr-2 h-4 w-4" />
                      Columns
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-body">Show / hide columns</p>
                </TooltipContent>
              </Tooltip>
              <PopoverContent align="end" className="w-64 p-3" onWheel={(e) => e.stopPropagation()}>
                <p className="text-title pb-1 font-bold">Select visible columns</p>
                <div className="styled-scrollbar max-h-[60vh] overflow-y-auto pr-2">
                  {/* Show all toggle */}
                  <div className="mb-3 mt-2 flex items-center justify-between">
                    <span className="text-label text-strong">
                      {table
                        .getAllLeafColumns()
                        .filter((c) => c.id !== ROW_NUMBER_COL)
                        .some((col) => !col.getIsVisible())
                        ? 'Show all'
                        : 'Hide all'}
                    </span>
                    <Switch
                      checked={
                        !table
                          .getAllLeafColumns()
                          .filter((c) => c.id !== ROW_NUMBER_COL)
                          .some((col) => !col.getIsVisible())
                      }
                      onCheckedChange={(checked) => {
                        table
                          .getAllLeafColumns()
                          .filter((c) => c.id !== ROW_NUMBER_COL)
                          .forEach((col) => col.toggleVisibility(checked));
                      }}
                    />
                  </div>
                  {/* Individual column toggles */}
                  {table
                    .getAllLeafColumns()
                    .filter((c) => c.id !== ROW_NUMBER_COL)
                    .map((column) => (
                      <div key={column.id} className="flex items-center justify-between py-1">
                        <span className="text-body-sm max-w-[160px] truncate" title={column.id}>
                          {column.id}
                        </span>
                        <Switch
                          checked={column.getIsVisible()}
                          onCheckedChange={(checked) => column.toggleVisibility(!!checked)}
                        />
                      </div>
                    ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Copy Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleCopyTable}>
                  {copied ? (
                    <>
                      <Check className="mr-2 h-4 w-4 text-[color:var(--status-success)]" />
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
                <p className="text-body">Copy current page as TSV</p>
              </TooltipContent>
            </Tooltip>

            {/* Details Pane Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isViewPaneOpen ? 'default' : 'outline'}
                  size="sm"
                  onClick={handleViewPaneToggle}
                >
                  {isViewPaneOpen ? (
                    <>
                      <PanelRightClose className="mr-2 h-4 w-4" />
                      View
                    </>
                  ) : (
                    <>
                      <PanelRightOpen className="mr-2 h-4 w-4" />
                      View
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-body">{isViewPaneOpen ? 'Hide' : 'Show'} view pane</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </header>

        {/* Main Content - Resizable Table + Detail Pane */}
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* Table Panel */}
          <ResizablePanel defaultSize={isViewPaneVisible ? 70 : 100} minSize={40}>
            <div className="flex h-full flex-col">
              {/* Table Container */}
              <div
                ref={tableContainerRef}
                className="styled-scrollbar relative flex-1 overflow-auto outline-none"
                tabIndex={0}
                onKeyDown={(e) => {
                  handleKeyDown(e);
                  if (e.key === 'Escape') {
                    setSelectedRowIndex(null);
                    setFocusedField(undefined);
                  }
                }}
                onMouseUp={handleCellMouseUp}
                onClick={(e) => {
                  if (wasDraggingRef.current) {
                    wasDraggingRef.current = false;
                    return;
                  }
                  const target = e.target as HTMLElement;
                  if (!target.closest('td') && !target.closest('th')) {
                    clearSelection();
                    setSelectedRowIndex(null);
                    setFocusedField(undefined);
                  }
                }}
              >
                {/* Loading overlay */}
                {isLoading && (
                  <div className="bg-background/60 absolute inset-0 z-20 flex items-center justify-center backdrop-blur-sm">
                    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-6 py-4 shadow-lg">
                      <Loader size={20} />
                      <div className="flex flex-col">
                        <span className="text-title">Loading page {pagination.page}...</span>
                        <span className="text-caption">Fetching data from server</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Copy toast notification */}
                {copied && (
                  <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 -translate-x-1/2 duration-200 animate-in fade-in slide-in-from-bottom-2">
                    <div className="border-[color:var(--status-success)]/30 flex items-center gap-2 rounded-full border bg-[color:var(--status-success-bg)] px-4 py-2 shadow-lg backdrop-blur-sm">
                      <Check className="h-4 w-4 text-[color:var(--status-success)]" />
                      <span className="text-title text-success">
                        {selectedCells.length > 0
                          ? `Copied ${selectedCells.length} cell${selectedCells.length > 1 ? 's' : ''}`
                          : 'Copied to clipboard'}
                      </span>
                    </div>
                  </div>
                )}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  modifiers={[restrictToHorizontalAxis]}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={visibleColumnIds}
                    strategy={horizontalListSortingStrategy}
                  >
                    <Table
                      ref={tableRef}
                      style={{ width: table.getTotalSize(), tableLayout: 'fixed' }}
                    >
                      <colgroup>
                        {table.getVisibleLeafColumns().map((column) => (
                          <col key={column.id} style={{ width: column.getSize() }} />
                        ))}
                      </colgroup>
                      <TableHeader className="sticky top-0 z-10">
                        {table.getHeaderGroups().map((headerGroup) => (
                          <TableRow key={headerGroup.id} className="hover:bg-transparent">
                            {/* RowNumbering header - pinned, click to select all */}
                            {headerGroup.headers
                              .filter((h) => h.id === ROW_NUMBER_COL)
                              .map((header) => (
                                <TableHead
                                  key={header.id}
                                  className="hover:bg-primary/10 sticky left-0 z-20 cursor-pointer border-b border-r-2 border-border bg-background text-center text-muted-foreground"
                                  style={{
                                    width: header.getSize(),
                                    minWidth: header.getSize(),
                                  }}
                                  onMouseDown={(e) => handleCellMouseDown(e, header)}
                                  onMouseOver={(e) => handleCellMouseOver(e, header)}
                                  onMouseUp={handleCellMouseUp}
                                >
                                  #
                                </TableHead>
                              ))}
                            {/* Data columns - draggable */}
                            {headerGroup.headers
                              .filter((h) => h.id !== ROW_NUMBER_COL)
                              .map((header) => (
                                <DraggableHeader
                                  key={header.id}
                                  header={header}
                                  tableHeight={tableHeight}
                                  isColumnSelected={
                                    table.getRowModel().rows.length > 0 &&
                                    table
                                      .getRowModel()
                                      .rows.every((r) =>
                                        selectedCells.includes(`${r.id}_${header.id}`)
                                      )
                                  }
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
                                  onResetSort={() => {
                                    setSorting([]);
                                  }}
                                  onCopyColumn={handleCopyColumn}
                                  onMouseDown={handleCellMouseDown}
                                  onMouseOver={handleCellMouseOver}
                                  onMouseUp={handleCellMouseUp}
                                />
                              ))}
                          </TableRow>
                        ))}
                      </TableHeader>
                      <TableBody
                        style={{
                          // Only use absolute positioning when virtualization is active
                          height:
                            virtualItems.length > 0 ? `${rowVirtualizer.getTotalSize()}px` : 'auto',
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
                                isVirtualized
                                  ? (node) => rowVirtualizer.measureElement(node)
                                  : undefined
                              }
                              className={cn(
                                rowIndex % 2 === 0 ? 'bg-background' : 'bg-muted/30',
                                selectedRowIndex === rowIndex && 'bg-primary/5'
                              )}
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
                                const isRowNumberCell = cell.column.id === ROW_NUMBER_COL;

                                if (isRowNumberCell) {
                                  const visualRowNumber =
                                    (pagination.page - 1) * pagination.pageSize + rowIndex + 1;
                                  const rowFullySelected = isAllRowSelected(row.id);
                                  return (
                                    <ContextMenu key={cell.id}>
                                      <ContextMenuTrigger asChild>
                                        <TableCell
                                          onMouseDown={(e) => {
                                            handleCellMouseDown(e, cell);
                                            handleRowClick(rowIndex);
                                          }}
                                          onMouseOver={(e) => handleCellMouseOver(e, cell)}
                                          onMouseUp={handleCellMouseUp}
                                          className={cn(
                                            'sticky left-0 z-20 cursor-pointer select-none border-b border-r-2 border-border text-center',
                                            rowFullySelected
                                              ? 'bg-primary text-primary-foreground'
                                              : 'hover:bg-primary/10 bg-background text-muted-foreground'
                                          )}
                                          style={{
                                            width: cell.column.getSize(),
                                            minWidth: cell.column.getSize(),
                                            height: `${ROW_HEIGHT}px`,
                                          }}
                                        >
                                          {visualRowNumber}
                                        </TableCell>
                                      </ContextMenuTrigger>
                                      <ContextMenuContent>
                                        <ContextMenuItem onClick={() => handleSelectRow(row.id)}>
                                          <Rows3 className="mr-2 h-4 w-4" />
                                          Select Row
                                        </ContextMenuItem>
                                        <ContextMenuItem
                                          onClick={() => handleCopyRow(row.original)}
                                        >
                                          <Copy className="mr-2 h-4 w-4" />
                                          Copy Row
                                        </ContextMenuItem>
                                      </ContextMenuContent>
                                    </ContextMenu>
                                  );
                                }

                                const cellValue = cell.getValue();
                                const fieldType = fields[cell.column.id]?.type;
                                const formattedValue = formatCellValue(cellValue, fieldType);
                                const isSelected = isCellSelected(cell);
                                return (
                                  <ContextMenu key={cell.id}>
                                    <ContextMenuTrigger asChild>
                                      <SortableDataCell
                                        cell={cell}
                                        isSelected={isSelected}
                                        width={cell.column.getSize()}
                                        onMouseDown={(e) => {
                                          handleCellMouseDown(e, cell);
                                          handleCellClickForViewPane(rowIndex, cell.column.id);
                                        }}
                                        onMouseUp={handleCellMouseUp}
                                        onMouseOver={(e) => handleCellMouseOver(e, cell)}
                                      >
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <span className="text-body-sm block truncate">
                                              {formattedValue}
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="max-w-sm">
                                            <p className="text-body whitespace-pre-wrap break-all">
                                              {formattedValue}
                                            </p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </SortableDataCell>
                                    </ContextMenuTrigger>
                                    <ContextMenuContent>
                                      <ContextMenuItem
                                        onClick={() => {
                                          setSelectedCells([cell.id]);
                                          const rowIdx = table
                                            .getRowModel()
                                            .rows.findIndex((r) => r.id === row.id);
                                          if (rowIdx >= 0) {
                                            handleCellClickForViewPane(rowIdx, cell.column.id);
                                          }
                                          if (!isViewPaneOpen) {
                                            setIsViewPaneOpen(true);
                                            setIsViewPaneVisible(true);
                                          }
                                        }}
                                      >
                                        <Search className="mr-2 h-4 w-4" />
                                        Inspect
                                      </ContextMenuItem>
                                      <ContextMenuItem
                                        onClick={() => handleCopyCell(cellValue, fieldType)}
                                      >
                                        <Square className="mr-2 h-4 w-4" />
                                        Copy Cell
                                      </ContextMenuItem>
                                      <ContextMenuItem onClick={() => handleCopyRow(row.original)}>
                                        <Rows3 className="mr-2 h-4 w-4" />
                                        Copy Row
                                      </ContextMenuItem>
                                      <ContextMenuItem
                                        onClick={() => handleCopyColumn(cell.column.id)}
                                      >
                                        <Columns3 className="mr-2 h-4 w-4" />
                                        Copy Column
                                      </ContextMenuItem>
                                      <ContextMenuSeparator />
                                      <ContextMenuItem onClick={() => handleSelectRow(row.id)}>
                                        <Rows3 className="mr-2 h-4 w-4" />
                                        Select Row
                                      </ContextMenuItem>
                                      <ContextMenuItem
                                        onClick={() => {
                                          const allRows = table.getRowModel().rows;
                                          const ids = allRows.map(
                                            (r) => `${r.id}_${cell.column.id}`
                                          );
                                          setSelectedCells(ids);
                                        }}
                                      >
                                        <Columns3 className="mr-2 h-4 w-4" />
                                        Select Column
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
                  </SortableContext>
                </DndContext>
              </div>

              {/* Pagination Footer */}
              <footer className="flex items-center justify-between border-t border-border px-6 py-3">
                <div className="text-body-muted">
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

                  <span className="text-body px-2">
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
          </ResizablePanel>

          {/* View Pane - with slide animation */}
          {isViewPaneVisible && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={30} minSize={15}>
                <div
                  className={cn(
                    'h-full duration-200',
                    isViewPaneExiting
                      ? 'animate-out slide-out-to-right'
                      : 'animate-in slide-in-from-right'
                  )}
                >
                  <ViewPane
                    selectedCells={selectedCellsData}
                    selectedRow={selectedRowData}
                    focusedField={focusedField}
                    onClose={handleViewPaneClose}
                  />
                </div>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </TooltipProvider>
  );
}
