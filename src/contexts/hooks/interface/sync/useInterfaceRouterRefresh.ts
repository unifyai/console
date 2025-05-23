"use client";

import { useTransition, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { InterfaceUIActions } from "../useInterfaceUI";

/**
 * Parameters for the router refresh function
 */
export interface RouterRefreshParams {
  /** Clear pending state after the transition */
  clearPending?: boolean;
  /** List of external pending setters to clear after the transition */
  externalPendingSetters?: Array<(pending: boolean) => void>;
}

/**
 * A custom hook to handle router refreshes with coordinated pending state.
 * This is useful when multiple components need to show loading states
 * during a server refresh operation.
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
 * 
 * @param uiActions - The UI actions for the interface
 * @returns A function to trigger router refresh with pending state coordination
 */
export function useInterfaceRouterRefresh(uiActions: InterfaceUIActions | null) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  
  // how many refreshes we started that haven't finished yet
  const counter = useRef(0);
  
  const refresh = useCallback(async (params?: RouterRefreshParams) => {
    const { 
      clearPending = true, 
      externalPendingSetters = [] 
    } = params || {};
    
    // Increment the counter before starting the transition
    counter.current += 1;

    // Perform the router refresh within a React transition
    startTransition(() => {
      router.refresh();
    });

    // react-18: a micro-task after *every* transition flush
    Promise.resolve().then(() => {
      if (!isPending) {
        counter.current -= 1;

        // Only reset states when all pending refreshes have completed
        if (counter.current === 0) {
          // Add a small delay to ensure a smoother UX
          setTimeout(() => {
            // Reset UI pending state if it was set
            if (clearPending && uiActions) {
              uiActions.setPending(false);
            }

            // Reset all external pending states
            if (externalPendingSetters && externalPendingSetters.length > 0) {
              for (const setter of externalPendingSetters) {
                setter(false);
              }
            }
          }, 300);
        }
      }
    });
  }, [router, isPending, uiActions]);
  
  return refresh;
} 