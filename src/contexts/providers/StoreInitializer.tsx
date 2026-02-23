'use client';

import { StoreProvider } from '@/contexts/providers/StoreProvider';
import { StoreSliceUpdater } from '@/contexts/providers/StoreSliceUpdater';
import { IStoreState } from '@/contexts/store';
import { ReactNode } from 'react';

// Component that initializes the store with server data
export function StoreInitializer({
  initialState,
  children,
}: {
  initialState: Partial<IStoreState>;
  children: ReactNode;
}) {
  return (
    <StoreProvider initialState={initialState}>
      {/* Apply the initial state */}
      <StoreSliceUpdater slice={initialState} />
      {children}
    </StoreProvider>
  );
}
