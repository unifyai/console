"use client";

import React, { createContext, useContext, useRef } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";

import { createInterfaceStore, InterfaceStoreState } from "@/stores/interfaceStore";

/**
 * The store API type we get from createInterfaceStore(...)
 */
export type InterfaceStoreApi = StoreApi<InterfaceStoreState>;

/**
 * The context that will hold one instance of our interface store.
 */
const InterfaceStoreContext = createContext<InterfaceStoreApi | null>(null);

export function InterfaceStoreProvider({
  children,
  initialState = {},
}: {
  children: React.ReactNode;
  /**
   * If you do SSR or want to override defaults, pass partial initialState.
   */
  initialState?: Partial<InterfaceStoreState>;
}) {
  /**
   * We only want to create the store once per session (or once per SSR request).
   * Using a ref ensures it won't re-initialize on client re-renders.
   */
  const storeRef = useRef<InterfaceStoreApi | null>(null);

  if (!storeRef.current) {
    // Create a brand-new store with any overrides from initialState
    storeRef.current = createInterfaceStore(initialState);
  }

  return (
    <InterfaceStoreContext.Provider value={storeRef.current}>
      {children}
    </InterfaceStoreContext.Provider>
  );
}

/**
 * A small wrapper around Zustand's useStore(...) hook,
 * so we can easily select state from the store in any component.
 */
export function useInterfaceContext<T>(
  selector: (state: InterfaceStoreState) => T
): T {
  const store = useContext(InterfaceStoreContext);
  if (!store) {
    throw new Error("useInterfaceContext must be used inside InterfaceStoreProvider");
  }
  return useStore(store, selector);
}
