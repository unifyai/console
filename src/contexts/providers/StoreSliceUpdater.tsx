'use client';

import { memo, useEffect, useRef } from 'react';
import { useStoreContext } from './StoreProvider';
import { IStoreState } from '@/contexts/store';
import { useShallow } from 'zustand/react/shallow';

// This component takes a slice of state and merges it into the store
// It's memoized to avoid unnecessary re-renders
export const StoreSliceUpdater = memo(function StoreSliceUpdater({
  slice,
}: {
  slice: Partial<IStoreState>;
}) {
  // Get the updateState function from the store
  const updateState = useStoreContext(useShallow((state) => state.updateState));

  const hasHydrated = useRef(false);
  const lastInterfaceIdRef = useRef<string | null>(null);

  // Effect to update the slice on mount or when slice changes
  useEffect(() => {
    if (!slice) return;

    if (!hasHydrated.current) {
      // First hydration: apply everything
      updateState(slice);
      hasHydrated.current = true;
      lastInterfaceIdRef.current = (slice as any).activeInterfaceId ?? null;
      return;
    }

    const incomingInterfaceId = (slice as any).activeInterfaceId ?? lastInterfaceIdRef.current;

    if (incomingInterfaceId !== lastInterfaceIdRef.current) {
      // Interface changed: accept full slice, including server-picked activeTabId
      updateState(slice);
      lastInterfaceIdRef.current = incomingInterfaceId;
    } else {
      // Same interface: do not overwrite the client's chosen active tab
      const { activeTabId, ...rest } = slice as any;
      updateState(rest as Partial<IStoreState>);
    }
  }, [slice, updateState]);

  // This component doesn't render anything
  return null;
});
