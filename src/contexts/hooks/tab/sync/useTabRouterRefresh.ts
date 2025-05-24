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
      
      counter.current += 1;

      startTransition(() => {
        router.refresh();
      });

      // react-18: a micro-task after *every* transition flush
      Promise.resolve().then(() => {
        if (!isPending) {
          counter.current -= 1;

          if (counter.current === 0) {
            // Add a short delay before clearing UI states for smoother transitions
            setTimeout(() => {
              // last one finished – clear the requested flags
              if (clearPending) uiActions?.setPending(false);
              if (clearDataPending) uiActions?.setDataPending(false);

              // Clear external pending states if provided
              if (externalPendingSetters && externalPendingSetters.length > 0) {
                for (const setter of externalPendingSetters) {
                  setter(false);
                }
              }
            }, 300);
          }
        }
      });
    },
    [router, isPending, uiActions]
  );

  return refreshRouter;
} 