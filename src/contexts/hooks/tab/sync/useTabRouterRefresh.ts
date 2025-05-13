import { useTransition, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TabUIActions } from "@/contexts/hooks/tab";

type RefreshOpts = {
  /** setDataPending(true/false) around the transition */
  withDataPending?: boolean;
  /** setPending(true/false) around the transition */
  withPending?: boolean;
  /** List of external pending setters to call before and after the transition */
  externalPendingSetters?: Array<(pending: boolean) => void>;
};

/**
 * Make `router.refresh()` tab-aware.
 *
 * Every call will:
 *   1. turn the requested UI flags and external pending states **on**
 *   2. perform `router.refresh()` inside a React transition
 *   3. turn the flags and external pending states **off** when the transition settles
 *
 * The hook internally reference-counts concurrent refreshes, so if
 * multiple refreshes run in parallel, flags are cleared
 * only after the very last one completes.
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
    (opts: RefreshOpts = { withPending: false, withDataPending: false, externalPendingSetters: [] }) => {
      const { 
        withPending = false, 
        withDataPending = false, 
        externalPendingSetters = [] 
      } = opts;

      // Set UI pending states if UI actions are available
      if (withPending) {
        if (uiActions) {
          uiActions.setPending(true);
        }
      }

      if (withDataPending) {
        if (uiActions) {
          uiActions.setDataPending(true);
        }
      }

      // Always set external pending states if provided
      if (externalPendingSetters && externalPendingSetters.length > 0) {
        for (const setter of externalPendingSetters) {
          setter(true);
        }
      }
      
      counter.current += 1;

      startTransition(() => {
        router.refresh();
      });

      // react-18: a micro-task after *every* transition flush
      Promise.resolve().then(() => {
        if (!isPending) {
          counter.current -= 1;

          if (counter.current === 0) {
            // last one finished – clear the requested flags
            if (withPending) {
                if (uiActions) {
                    uiActions.setPending(false);
                }
            }

            if (withDataPending) {
                if (uiActions) {
                    uiActions.setDataPending(false);
                }
            }

            // Always clear external pending states if provided
            if (externalPendingSetters && externalPendingSetters.length > 0) {
              for (const setter of externalPendingSetters) {
                setter(false);
              }
            }
          }
        }
      });
    },
    [router, isPending, uiActions]
  );

  return refreshRouter;
} 