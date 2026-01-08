/**
 * DataTable Test Harness
 * 
 * A reusable wrapper that provides all the mocking and state management
 * needed to test the real DataTable component in isolation.
 * 
 * Usage:
 *   import { renderDataTable, createTestData } from '../fixtures/dataTableTestHarness';
 *   
 *   it('renders table', async () => {
 *     const { getByRole } = renderDataTable();
 *     expect(getByRole('table')).toBeInTheDocument();
 *   });
 */
import React, { useRef, useState, useMemo, useCallback } from 'react';
import { render, RenderResult, act } from '@testing-library/react';
import { vi } from 'vitest';
import DataTable from '@/components/Common/Tables/Data/Base';
import type { LogProps } from '@/types/interfaces/logs';
import type { StateProps, SetStateProps } from '@/types/dataTable';
import type { DraggingColumnsState, DraggingColumnPinnerState } from '@/types/interfaces/columns';
import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  ColumnPinningState,
  ColumnSizingState,
  GroupingState,
} from '@tanstack/react-table';
import { createMockLogs, MOCK_LOGS_TOTAL_COUNT } from '../../mocks/fixtures/logs';

// =============================================================================
// Mock nuqs globally - this is required for any DataTable test
// =============================================================================
vi.mock('nuqs', () => ({
  useQueryState: () => [null, vi.fn()],
  parseAsArrayOf: () => ({}),
  parseAsString: () => ({}),
}));

// =============================================================================
// Types
// =============================================================================

export type MetricsType = 'mean' | 'sum' | 'count' | 'min' | 'max';

export interface DataTableTestCallbacks {
  onSort?: (sorting: SortingState) => void;
  onFilter?: (filters: ColumnFiltersState) => void;
  onCellSelect?: (cells: string[]) => void;
  onColumnVisibilityChange?: (visibility: Record<string, boolean>) => void;
  onColumnOrderChange?: (order: string[]) => void;
  onColumnPinningChange?: (pinning: ColumnPinningState) => void;
  onGroupingChange?: (grouping: GroupingState) => void;
  onSearch?: (searchTerm: string) => void;
  onMetricsToggle?: (visible: boolean) => void;
  onMetricsTypeChange?: (type: MetricsType) => void;
  onRefresh?: () => void;
  onCellEdit?: (cellId: string, value: string) => void;
  onCellDelete?: (cellIds: string[]) => void;
  onCellCopy?: (cellIds: string[]) => void;
  onToggleGroup?: (groupId: string, expanded: boolean) => void;
  onFreezeToggle?: (frozen: boolean) => void;
}

export interface DataTableTestOptions {
  /** Initial log data. Defaults to 20 mock logs. */
  initialData?: LogProps[];
  /** Total count for pagination. Defaults to 100. */
  totalCount?: number;
  /** Initial offset for pagination. Defaults to 0. */
  initialOffset?: number;
  /** Page size. Defaults to 20. */
  pageSize?: number;
  /** Initial sorting state */
  initialSorting?: SortingState;
  /** Initial column filters */
  initialColumnFilters?: ColumnFiltersState;
  /** Initial column visibility */
  initialColumnVisibility?: Record<string, boolean>;
  /** Initial column order */
  initialColumnOrder?: string[];
  /** Initial grouping */
  initialGrouping?: GroupingState;
  /** Initial selected cells */
  initialSelectedCells?: string[];
  /** Whether the table is interactive */
  interactive?: boolean;
  /** Custom columns (overrides auto-generated columns) */
  customColumns?: ColumnDef<LogProps, unknown>[];
  /** Callbacks for state changes */
  callbacks?: DataTableTestCallbacks;
  /** Initial search term */
  initialSearchTerm?: string;
  /** Initial metrics visibility */
  initialShowMetrics?: boolean;
  /** Initial metrics type */
  initialMetricsType?: MetricsType;
  /** Initial expanded groups */
  initialExpandedGroups?: string[];
  /** Initial frozen state */
  initialFrozen?: boolean;
  /** Initial editing cell */
  initialEditingCell?: string | null;
}

export interface DataTableTestResult extends RenderResult {
  /** Get current sorting state */
  getSorting: () => SortingState;
  /** Get current column filters */
  getFilters: () => ColumnFiltersState;
  /** Get current column visibility */
  getColumnVisibility: () => Record<string, boolean>;
  /** Get current selected cells */
  getSelectedCells: () => string[];
  /** Get current column order */
  getColumnOrder: () => string[];
  /** Get current search term */
  getSearchTerm: () => string;
  /** Check if metrics are visible */
  isMetricsVisible: () => boolean;
  /** Get current metrics type */
  getMetricsType: () => MetricsType;
  /** Get expanded groups */
  getExpandedGroups: () => string[];
  /** Check if table is frozen */
  isFrozen: () => boolean;
  /** Get currently editing cell */
  getEditingCell: () => string | null;
  /** Programmatically set sorting */
  setSorting: (sorting: SortingState) => void;
  /** Programmatically set filters */
  setFilters: (filters: ColumnFiltersState) => void;
  /** Programmatically set column visibility */
  setColumnVisibility: (visibility: Record<string, boolean>) => void;
  /** Programmatically select cells */
  setSelectedCells: (cells: string[]) => void;
  /** Programmatically set column order */
  setColumnOrder: (order: string[]) => void;
  /** Programmatically set search term */
  setSearchTerm: (term: string) => void;
  /** Toggle metrics visibility */
  toggleMetrics: () => void;
  /** Set metrics type */
  setMetricsType: (type: MetricsType) => void;
  /** Toggle group expansion */
  toggleGroup: (groupId: string) => void;
  /** Toggle frozen state */
  toggleFrozen: () => void;
  /** Set editing cell */
  setEditingCell: (cellId: string | null) => void;
  /** Trigger refresh */
  refresh: () => void;
  /** Delete cells */
  deleteCells: (cellIds: string[]) => void;
  /** Copy cells */
  copyCells: (cellIds: string[]) => void;
}

// =============================================================================
// Test Data Factories
// =============================================================================

/**
 * Creates test log data with configurable options.
 */
export function createTestData(options: {
  count?: number;
  offset?: number;
  totalCount?: number;
  includeAllColumns?: boolean;
} = {}): LogProps[] {
  const { count = 20, offset = 0, totalCount = MOCK_LOGS_TOTAL_COUNT } = options;
  const response = createMockLogs(count, { offset, totalCount });
  return response.logs as LogProps[];
}

/**
 * Creates column definitions from log data.
 */
export function createColumnsFromData(data: LogProps[]): ColumnDef<LogProps, unknown>[] {
  if (data.length === 0) return [];
  
  const firstLog = data[0];
  const entryKeys = Object.keys(firstLog.entries || {});
  
  return entryKeys.map((key) => ({
    id: `entries/${key}`,
    accessorFn: (row: LogProps) => row.entries?.[key],
    header: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
    meta: {
      columnType: 'entry',
      dataType: typeof firstLog.entries?.[key] === 'number' ? 'float' : 'string',
      fieldType: 'entry',
      isParent: false,
      renderedDepth: 0,
    },
  }));
}

// =============================================================================
// Internal State Container (for external access)
// =============================================================================

interface StateContainer {
  getSorting: () => SortingState;
  getFilters: () => ColumnFiltersState;
  getColumnVisibility: () => Record<string, boolean>;
  getSelectedCells: () => string[];
  getColumnOrder: () => string[];
  getSearchTerm: () => string;
  isMetricsVisible: () => boolean;
  getMetricsType: () => MetricsType;
  getExpandedGroups: () => string[];
  isFrozen: () => boolean;
  getEditingCell: () => string | null;
  setSorting: (s: SortingState) => void;
  setFilters: (f: ColumnFiltersState) => void;
  setColumnVisibility: (v: Record<string, boolean>) => void;
  setSelectedCells: (c: string[]) => void;
  setColumnOrder: (o: string[]) => void;
  setSearchTerm: (t: string) => void;
  toggleMetrics: () => void;
  setMetricsType: (t: MetricsType) => void;
  toggleGroup: (groupId: string) => void;
  toggleFrozen: () => void;
  setEditingCell: (cellId: string | null) => void;
  refresh: () => void;
  deleteCells: (cellIds: string[]) => void;
  copyCells: (cellIds: string[]) => void;
}

// =============================================================================
// DataTable Test Wrapper Component
// =============================================================================

interface DataTableWrapperProps extends DataTableTestOptions {
  stateContainerRef: React.MutableRefObject<StateContainer | null>;
}

function DataTableWrapper({
  initialData,
  totalCount = MOCK_LOGS_TOTAL_COUNT,
  initialOffset = 0,
  pageSize = 20,
  initialSorting = [],
  initialColumnFilters = [],
  initialColumnVisibility = {},
  initialColumnOrder,
  initialGrouping = [],
  initialSelectedCells = [],
  interactive = true,
  customColumns,
  callbacks = {},
  stateContainerRef,
  initialSearchTerm = '',
  initialShowMetrics = false,
  initialMetricsType = 'mean',
  initialExpandedGroups = [],
  initialFrozen = false,
  initialEditingCell = null,
}: DataTableWrapperProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Get data
  const data = useMemo(() => {
    if (initialData) return initialData;
    return createTestData({ count: pageSize, offset: initialOffset, totalCount });
  }, [initialData, pageSize, initialOffset, totalCount]);

  // Build columns
  const columns = useMemo(() => {
    if (customColumns) return customColumns;
    return createColumnsFromData(data);
  }, [customColumns, data]);

  // Default column order
  const defaultColumnOrder = useMemo(
    () => initialColumnOrder ?? columns.map((c) => c.id as string),
    [initialColumnOrder, columns]
  );

  // ==========================================================================
  // State Management
  // ==========================================================================
  
  const [sorting, setSortingInternal] = useState<SortingState>(initialSorting);
  const [columnFilters, setColumnFiltersInternal] = useState<ColumnFiltersState>(initialColumnFilters);
  const [columnVisibility, setColumnVisibilityInternal] = useState<Record<string, boolean>>(initialColumnVisibility);
  const [columnOrder, setColumnOrderInternal] = useState<string[]>(defaultColumnOrder);
  const [columnPinning, setColumnPinningInternal] = useState<ColumnPinningState>({});
  const [columnSizing, setColumnSizingInternal] = useState<ColumnSizingState>({});
  const [grouping, setGroupingInternal] = useState<GroupingState>(initialGrouping);
  const [selectedCells, setSelectedCellsInternal] = useState<string[]>(initialSelectedCells);
  
  // New state for extended features
  const [searchTerm, setSearchTermInternal] = useState<string>(initialSearchTerm);
  const [showMetrics, setShowMetricsInternal] = useState<boolean>(initialShowMetrics);
  const [metricsType, setMetricsTypeInternal] = useState<MetricsType>(initialMetricsType);
  const [expandedGroups, setExpandedGroupsInternal] = useState<string[]>(initialExpandedGroups);
  const [isFrozen, setIsFrozenInternal] = useState<boolean>(initialFrozen);
  const [editingCell, setEditingCellInternal] = useState<string | null>(initialEditingCell);
  
  // DnD state (required by DataTable internals)
  const [draggingColumns, setDraggingColumns] = useState<DraggingColumnsState>({
    active: { ids: [], transform: null },
    over: { ids: [], transform: null },
  });
  const [draggingColumnPinner, setDraggingColumnPinner] = useState<DraggingColumnPinnerState>({
    columnId: null,
    isPinning: false,
    direction: null,
    transform: null,
  });

  // ==========================================================================
  // Wrapped Setters (call callbacks)
  // ==========================================================================
  
  const setSorting = useCallback((newSorting: SortingState) => {
    setSortingInternal(newSorting);
    callbacks.onSort?.(newSorting);
  }, [callbacks]);

  const setColumnFilters = useCallback((newFilters: ColumnFiltersState | ((prev: ColumnFiltersState) => ColumnFiltersState)) => {
    const resolved = typeof newFilters === 'function' ? newFilters(columnFilters) : newFilters;
    setColumnFiltersInternal(resolved);
    callbacks.onFilter?.(resolved);
  }, [callbacks, columnFilters]);

  const setColumnVisibility = useCallback((newVisibility: Record<string, boolean>) => {
    setColumnVisibilityInternal(newVisibility);
    callbacks.onColumnVisibilityChange?.(newVisibility);
  }, [callbacks]);

  const setColumnOrder = useCallback((newOrder: string[]) => {
    setColumnOrderInternal(newOrder);
    callbacks.onColumnOrderChange?.(newOrder);
  }, [callbacks]);

  const setColumnPinning = useCallback((newPinning: ColumnPinningState) => {
    setColumnPinningInternal(newPinning);
    callbacks.onColumnPinningChange?.(newPinning);
  }, [callbacks]);

  const setGrouping = useCallback((newGrouping: GroupingState) => {
    setGroupingInternal(newGrouping);
    callbacks.onGroupingChange?.(newGrouping);
  }, [callbacks]);

  const setSelectedCells = useCallback((newCells: string[]) => {
    setSelectedCellsInternal(newCells);
    callbacks.onCellSelect?.(newCells);
  }, [callbacks]);

  const setSearchTerm = useCallback((term: string) => {
    setSearchTermInternal(term);
    callbacks.onSearch?.(term);
  }, [callbacks]);

  const toggleMetrics = useCallback(() => {
    setShowMetricsInternal((prev) => {
      const newValue = !prev;
      callbacks.onMetricsToggle?.(newValue);
      return newValue;
    });
  }, [callbacks]);

  const setMetricsType = useCallback((type: MetricsType) => {
    setMetricsTypeInternal(type);
    callbacks.onMetricsTypeChange?.(type);
  }, [callbacks]);

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroupsInternal((prev) => {
      const isExpanded = prev.includes(groupId);
      const newGroups = isExpanded
        ? prev.filter((g) => g !== groupId)
        : [...prev, groupId];
      callbacks.onToggleGroup?.(groupId, !isExpanded);
      return newGroups;
    });
  }, [callbacks]);

  const toggleFrozen = useCallback(() => {
    setIsFrozenInternal((prev) => {
      const newValue = !prev;
      callbacks.onFreezeToggle?.(newValue);
      return newValue;
    });
  }, [callbacks]);

  const setEditingCell = useCallback((cellId: string | null) => {
    setEditingCellInternal(cellId);
  }, []);

  const refresh = useCallback(() => {
    callbacks.onRefresh?.();
  }, [callbacks]);

  const deleteCells = useCallback((cellIds: string[]) => {
    callbacks.onCellDelete?.(cellIds);
  }, [callbacks]);

  const copyCells = useCallback((cellIds: string[]) => {
    callbacks.onCellCopy?.(cellIds);
  }, [callbacks]);

  // ==========================================================================
  // Expose state to test via ref (using getters for fresh values)
  // ==========================================================================
  
  // Build state container with all getters and setters
  const buildStateContainer = useCallback((): StateContainer => ({
    getSorting: () => sorting,
    getFilters: () => columnFilters,
    getColumnVisibility: () => columnVisibility,
    getSelectedCells: () => selectedCells,
    getColumnOrder: () => columnOrder,
    getSearchTerm: () => searchTerm,
    isMetricsVisible: () => showMetrics,
    getMetricsType: () => metricsType,
    getExpandedGroups: () => expandedGroups,
    isFrozen: () => isFrozen,
    getEditingCell: () => editingCell,
    setSorting,
    setFilters: setColumnFilters,
    setColumnVisibility,
    setSelectedCells,
    setColumnOrder,
    setSearchTerm,
    toggleMetrics,
    setMetricsType,
    toggleGroup,
    toggleFrozen,
    setEditingCell,
    refresh,
    deleteCells,
    copyCells,
  }), [
    sorting, columnFilters, columnVisibility, selectedCells, columnOrder,
    searchTerm, showMetrics, metricsType, expandedGroups, isFrozen, editingCell,
    setSorting, setColumnFilters, setColumnVisibility, setSelectedCells, setColumnOrder,
    setSearchTerm, toggleMetrics, setMetricsType, toggleGroup, toggleFrozen,
    setEditingCell, refresh, deleteCells, copyCells,
  ]);

  // Update ref on every render to capture latest state
  React.useEffect(() => {
    stateContainerRef.current = buildStateContainer();
  });
  
  // Also set immediately for first render
  if (!stateContainerRef.current) {
    stateContainerRef.current = buildStateContainer();
  }

  // ==========================================================================
  // Build state/setState objects
  // ==========================================================================
  
  const state: StateProps = {
    sorting,
    columnFilters,
    columnVisibility,
    columnOrder,
    columnPinning,
    columnSizing,
    grouping,
    selectedCells,
    draggingColumns,
    draggingColumnPinner,
  };

  const setState: SetStateProps = {
    setSorting,
    setColumnFilters,
    setColumnVisibility,
    setColumnOrder,
    setColumnPinning,
    setColumnSizing: setColumnSizingInternal,
    setGrouping,
    setSelectedCells,
    setDraggingColumns,
    setDraggingColumnPinner,
  };

  // ==========================================================================
  // Render
  // ==========================================================================
  
  return (
    <div
      ref={scrollContainerRef}
      data-testid="datatable-test-container"
      style={{ height: '600px', width: '100%', overflow: 'auto' }}
    >
      <DataTable
        data={data}
        columns={columns}
        interactive={interactive}
        autoUpdate={false}
        scrollContainerRef={scrollContainerRef}
        state={state}
        setState={setState}
        offsetInfo={{
          globalOffset: initialOffset,
          groupOffsets: new Map(),
        }}
      />
    </div>
  );
}

// =============================================================================
// Main Export: renderDataTable
// =============================================================================

/**
 * Renders the real DataTable component with all required mocking and state.
 * 
 * @example
 * ```tsx
 * const { getByRole, getSorting, setSorting } = renderDataTable({
 *   callbacks: { onSort: vi.fn() }
 * });
 * 
 * // Interact with the table
 * await userEvent.click(getByRole('columnheader', { name: /Message/i }));
 * 
 * // Check state
 * expect(getSorting()).toHaveLength(1);
 * ```
 */
export function renderDataTable(options: DataTableTestOptions = {}): DataTableTestResult {
  const stateContainerRef: React.MutableRefObject<StateContainer | null> = { current: null };
  
  const renderResult = render(
    <DataTableWrapper {...options} stateContainerRef={stateContainerRef} />
  );

  return {
    ...renderResult,
    // Getters
    getSorting: () => stateContainerRef.current?.getSorting() ?? [],
    getFilters: () => stateContainerRef.current?.getFilters() ?? [],
    getColumnVisibility: () => stateContainerRef.current?.getColumnVisibility() ?? {},
    getSelectedCells: () => stateContainerRef.current?.getSelectedCells() ?? [],
    getColumnOrder: () => stateContainerRef.current?.getColumnOrder() ?? [],
    getSearchTerm: () => stateContainerRef.current?.getSearchTerm() ?? '',
    isMetricsVisible: () => stateContainerRef.current?.isMetricsVisible() ?? false,
    getMetricsType: () => stateContainerRef.current?.getMetricsType() ?? 'mean',
    getExpandedGroups: () => stateContainerRef.current?.getExpandedGroups() ?? [],
    isFrozen: () => stateContainerRef.current?.isFrozen() ?? false,
    getEditingCell: () => stateContainerRef.current?.getEditingCell() ?? null,
    // Setters - wrapped in act() to avoid React state update warnings
    setSorting: (sorting) => {
      act(() => {
        stateContainerRef.current?.setSorting(sorting);
      });
    },
    setFilters: (filters) => {
      act(() => {
        stateContainerRef.current?.setFilters(filters);
      });
    },
    setColumnVisibility: (visibility) => {
      act(() => {
        stateContainerRef.current?.setColumnVisibility(visibility);
      });
    },
    setSelectedCells: (cells) => {
      act(() => {
        stateContainerRef.current?.setSelectedCells(cells);
      });
    },
    setColumnOrder: (order) => {
      act(() => {
        stateContainerRef.current?.setColumnOrder(order);
      });
    },
    setSearchTerm: (term) => {
      act(() => {
        stateContainerRef.current?.setSearchTerm(term);
      });
    },
    toggleMetrics: () => {
      act(() => {
        stateContainerRef.current?.toggleMetrics();
      });
    },
    setMetricsType: (type) => {
      act(() => {
        stateContainerRef.current?.setMetricsType(type);
      });
    },
    toggleGroup: (groupId) => {
      act(() => {
        stateContainerRef.current?.toggleGroup(groupId);
      });
    },
    toggleFrozen: () => {
      act(() => {
        stateContainerRef.current?.toggleFrozen();
      });
    },
    setEditingCell: (cellId) => {
      act(() => {
        stateContainerRef.current?.setEditingCell(cellId);
      });
    },
    refresh: () => {
      act(() => {
        stateContainerRef.current?.refresh();
      });
    },
    deleteCells: (cellIds) => {
      act(() => {
        stateContainerRef.current?.deleteCells(cellIds);
      });
    },
    copyCells: (cellIds) => {
      act(() => {
        stateContainerRef.current?.copyCells(cellIds);
      });
    },
  };
}

// =============================================================================
// Convenience Exports
// =============================================================================

export { createMockLogs, MOCK_LOGS_TOTAL_COUNT } from '../../mocks/fixtures/logs';

