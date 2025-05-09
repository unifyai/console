import { useTransition, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TabUIActions } from "@/contexts/hooks/tab";

type RefreshOpts = {
  /** setDataPending(true/false) around the transition */
  withDataPending?: boolean;
  /** setPending(true/false) around the transition */
  withPending?: boolean;
};

/**
 * Make `router.refresh()` tab-aware.
 *
 * Every call will:
 *   1. turn the requested UI flags and external pending state **on**
 *   2. perform `router.refresh()` inside a React transition
 *   3. turn the flags and external pending state **off** when the transition settles
 *
 * The hook internally reference-counts concurrent refreshes, so if
 * multiple refreshes run in parallel, flags are cleared
 * only after the very last one completes.
 */
export function useTabRouterRefresh(
  uiActions: TabUIActions | null,
  setExternalPending?: (pending: boolean) => void
) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // how many refreshes we started that haven't finished yet
  const counter = useRef(0);

  /** call inside a setter */
  const refreshRouter = useCallback(
    (opts: RefreshOpts = { withPending: false , withDataPending: false}) => {
      const { withPending = false, withDataPending = false } = opts;

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

      // Also set external pending state if provided
      if (setExternalPending) {
        setExternalPending(true);
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

            // Also clear external pending state if provided
            if (setExternalPending) {
                setExternalPending(false);
            }
          }
        }
      });
    },
    [router, isPending, uiActions, setExternalPending]
  );

  return refreshRouter;
} 