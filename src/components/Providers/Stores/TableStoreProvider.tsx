"use client";

import React, {
  createContext,
  useContext,
  useRef,
  type ReactNode,
} from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";

import { createTableStore, TableStoreState } from "@/stores/tableStore";

/** The vanilla store's type. */
export type TableStoreApi = StoreApi<TableStoreState>;

/** The context to hold a single store instance. */
const TableStoreContext = createContext<TableStoreApi | null>(null);

/** Props for your provider. */
export interface TableStoreProviderProps {
  children: ReactNode;
  /** If you have SSR data or defaults to override, pass it here. */
  initialState?: Partial<TableStoreState>;
}

/**
 * Provider that creates a *unique* store instance via useRef.
 *
 * It’s used once per user session (in the App Router’s layout or the Pages Router’s _app),
 * ensuring the store isn’t re-created on every render but *is* new for each SSR request.
 */
export function TableStoreProvider({
  children,
  initialState = {},
}: TableStoreProviderProps) {
  const storeRef = useRef<TableStoreApi | null>(null);

  // Create the store once, for either this SSR request or the entire client session
  if (!storeRef.current) {
    storeRef.current = createTableStore(initialState);
  }

  return (
    <TableStoreContext.Provider value={storeRef.current}>
      {children}
    </TableStoreContext.Provider>
  );
}

/**
 * A convenience hook to read/write from the store using a selector.
 * e.g.:
 *   const metric = useTableContext((state) => state.metric);
 *   const setMetric = useTableContext((state) => state.setMetric);
 */
export function useTableContext<T>(selector: (state: TableStoreState) => T) {
  const store = useContext(TableStoreContext);
  if (!store) {
    throw new Error("useTableContext must be used within TableStoreProvider");
  }
  return useStore(store, selector);
}
