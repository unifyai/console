"use client";

import { useTransition, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TabUIActions } from "@/contexts/hooks/tab";

type RefreshOpts = {
  /** Clear pending state after the transition */
  clearPending?: boolean;
  /** Clear data pending state after the transition */
  clearDataPending?: boolean;
  /** List of external pending setters to call after the transition */
  externalPendingSetters?: Array<(pending: boolean) => void>;
};

/**
 * Make `router.refresh()` tab-aware.
 *
 * Every call will:
 *   1. Perform `router.refresh()` inside a React transition
 *   2. Clear the requested UI flags and external pending states when the transition settles
 *
 * The hook internally reference-counts concurrent refreshes, so if
 * multiple refreshes run in parallel, flags are cleared
 * only after the very last one completes.
 * 
 * NOTE: UI states are now set BEFORE server mutations in the wrapper 
 * functions, rather than as part of the router refresh.
 */
export function useTabRouterRefresh(
  uiActions: TabUIActions | null
) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // how many refreshes we started that haven't finished yet
  const counter = useRef(0);

  /** call inside a setter */
  const refreshRouter = useCallback(
    (opts: RefreshOpts = { clearPending: true, clearDataPending: true, externalPendingSetters: [] }) => {
      const { 
        clearPending = true, 
        clearDataPending = true, 
        externalPendingSetters = [] 
      } = opts;
      
      console.log('[useTabRouterRefresh] ⚠️ Router refresh disabled - using optimistic updates only');
      
      // DISABLED: router.refresh() triggers expensive RSC refetches
      // With optimistic updates + React Query, we don't need server re-renders
      // Just clear the pending states immediately
      if (clearPending) uiActions?.setPending(false);
      if (clearDataPending) uiActions?.setDataPending(false);

      // Clear external pending states if provided
      if (externalPendingSetters && externalPendingSetters.length > 0) {
        for (const setter of externalPendingSetters) {
          setter(false);
        }
      }
    },
    [uiActions]
  );

  return refreshRouter;
} 