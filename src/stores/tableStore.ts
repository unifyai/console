"use client";

import { createStore } from "zustand/vanilla";
import {
  ColumnFiltersState,
  ColumnPinningState,
  ColumnSizingState,
  ColumnSort,
  GroupingState,
} from "@tanstack/react-table";
import { TableDataItem } from "@/types/evals/grid";

/** The shape of all the states you want to manage, plus your actions. */
export interface TableStoreState {
  // Table-related data
  tableDataItem: TableDataItem;

  // UI or loading states
  summaryPending: boolean;
  showSpinner: boolean;

  // E.g., user-chosen metric
  metric: string;

  // React Table states
  sorting: ColumnSort[];
  columnFilters: ColumnFiltersState;
  grouping: GroupingState;
  columnPinning: ColumnPinningState;
  columnSizing: ColumnSizingState;

  // Actions
  setTableDataItem: (item: TableDataItem) => void;
  setSummaryPending: (pending: boolean) => void;
  setShowSpinner: (spinner: boolean) => void;
  setMetric: (metric: string) => void;
  setSorting: (sorting: ColumnSort[]) => void;
  setColumnFilters: (filters: ColumnFiltersState) => void;
  setGrouping: (group: GroupingState) => void;
  setColumnPinning: (pinning: ColumnPinningState) => void;
  setColumnSizing: (sizing: ColumnSizingState) => void;
}

/**
 * A factory function that returns a *new* vanilla Zustand store,
 * ensuring no global, cross-request sharing in SSR.
 *
 * @param initialState Optionally pass partial initial values
 */
export function createTableStore(
  initialState: Partial<TableStoreState> = {}
) {
  return createStore<TableStoreState>()((set) => ({
    /** Default state values. Override or expand these as needed. */
    tableDataItem: {} as TableDataItem,
    summaryPending: false,
    showSpinner: false,
    metric: "mean",
    sorting: [],
    columnFilters: [],
    grouping: [],
    columnPinning: { left: [], right: [] },
    columnSizing: {},

    /** Actions (mutations): update each piece of state. */
    setTableDataItem: (item: TableDataItem) => set({ tableDataItem: item }),
    setSummaryPending: (pending) => set({ summaryPending: pending }),
    setShowSpinner: (spinner) => set({ showSpinner: spinner }),
    setMetric: (metric) => set({ metric }),
    setSorting: (sorting) => set({ sorting }),
    setColumnFilters: (filters) => set({ columnFilters: filters }),
    setGrouping: (group) => set({ grouping: group }),
    setColumnPinning: (pinning) => set({ columnPinning: pinning }),
    setColumnSizing: (sizing) => set({ columnSizing: sizing }),

    ...initialState, // Merge any provided initialState last
  }));
}
