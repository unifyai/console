"use client";

import React, { createContext, useContext, useRef } from 'react';
import { createStore, IStoreState } from '../store';
import { StoreApi, useStore } from 'zustand';

// Create context for the store
type StoreContextType = StoreApi<IStoreState> | null;
const StoreContext = createContext<StoreContextType>(null);

/**
 * Provider component for the store
 * This creates a new store instance per server request and 
 * ensures it's properly provided to all child components
 */
export function StoreProvider({ 
  children,
  initialState,
}: { 
  children: React.ReactNode; 
  initialState?: Partial<IStoreState>;
}) {
  // Use useRef to ensure the store is only created once per component lifecycle
  const storeRef = useRef<StoreContextType>(null);
  
  // Initialize store on first render
  if (!storeRef.current) {
    storeRef.current = createStore(initialState);
    
  }
  
  return (
    <StoreContext.Provider value={storeRef.current}>
      {children}
    </StoreContext.Provider>
  );
}

/**
 * Hook to access the store from the context
 * This is useful when you need to use the raw store in a component
 */
export function useStoreContext<T>(selector: (state: IStoreState) => T): T {
  const store = useContext(StoreContext);
  
  if (!store) {
    throw new Error(
      'useStoreContext must be used within StoreProvider. Are you using it in a server component?'
    );
  }
  
  return useStore(store, selector);
}
