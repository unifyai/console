'use client';

import { memo, useEffect } from 'react';
import { useStoreContext } from './StoreProvider';
import { IStoreState } from '@/contexts/store';
import { useShallow } from 'zustand/react/shallow';

// This component takes a slice of state and merges it into the store
// It's memoized to avoid unnecessary re-renders
export const StoreSliceUpdater = memo(function StoreSliceUpdater({ 
  slice 
}: { 
  slice: Partial<IStoreState> 
}) {
  // Get the updateState function from the store
  const updateState = useStoreContext(
    useShallow(state => state.updateState)
  );
  
  // Effect to update the slice on mount or when slice changes
  useEffect(() => {
    if (slice) {
      updateState(slice);
    }
  }, [slice, updateState]);
  
  // This component doesn't render anything
  return null;
}); 