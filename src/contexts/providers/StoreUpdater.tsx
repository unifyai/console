"use client";

import { useEffect, useRef } from 'react';
import { IStoreState } from '../store';
import { useStoreContext } from './StoreProvider';

// Component to handle store updates when initialState changes
function StoreUpdater({ initialState }: { initialState: Partial<IStoreState> }) {
  const resetState = useStoreContext(state => state.resetState);
  const initialStateRef = useRef(initialState);
  
  useEffect(() => {
    // Check if initialState has changed from the previous value
    if (initialStateRef.current !== initialState) {
      // Update the store with the new state
      resetState(initialState);
      // Update the ref to the current initialState
      initialStateRef.current = initialState;
    }
  }, [initialState, resetState]);
  
  return null; // This component doesn't render anything
}

export default StoreUpdater;