'use client';

import * as React from 'react';
import {
  dataViewStateKey,
  emptyLogViewState,
  sessionLogViewStateStore,
  type LogViewState,
  type LogViewStateStore,
} from '@/lib/logs';

/**
 * Subscribe to a LogViewStateStore for a given key (e.g. `data:${context}`).
 * Forces a re-render on set; store itself is the persistence seam.
 */
export function useLogViewState(
  key: string | null,
  store: LogViewStateStore = sessionLogViewStateStore
): [LogViewState, (patch: Partial<LogViewState>) => void, (next: LogViewState) => void] {
  const storageKey = key ? dataViewStateKey(key) : null;
  const [version, setVersion] = React.useState(0);

  const state = React.useMemo(() => {
    void version;
    if (!storageKey) return emptyLogViewState();
    return store.get(storageKey);
  }, [storageKey, store, version]);

  const setState = React.useCallback(
    (patch: Partial<LogViewState>) => {
      if (!storageKey) return;
      store.set(storageKey, patch);
      setVersion((v) => v + 1);
    },
    [storageKey, store]
  );

  const replaceState = React.useCallback(
    (next: LogViewState) => {
      if (!storageKey) return;
      store.replace(storageKey, next);
      setVersion((v) => v + 1);
    },
    [storageKey, store]
  );

  return [state, setState, replaceState];
}
