// useTileRouterRefresh.ts

"use client";
import { useTransition, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TileUIActions } from "@/contexts/hooks/tile";   // whatever the type is

type RefreshOpts = {
  /** Clear loading state after the transition */
  clearLoading?: boolean;
  /** Clear pending state after the transition */
  clearPending?: boolean;
};

/**
 * Make `router.refresh()` tile-aware.
 *
 * Every call will:
 *   1. Perform `router.refresh()` inside a React transition
 *   2. Clear the requested UI flags when the transition settles
 *
 * The hook internally reference-counts concurrent refreshes, so if the
 * same tile fires multiple refreshes in parallel the flags are cleared
 * only after the very last one completes.
 * 
 * NOTE: UI states are now set BEFORE server mutations in the wrapper 
 * functions, rather than as part of the router refresh.
 */
export function useTileRouterRefresh(uiActions: TileUIActions | null) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // how many refreshes we started that haven't finished yet
  const counter = useRef(0);

  /** call inside a setter */
  const refreshRouter = useCallback(
    (opts: RefreshOpts = { clearLoading: true, clearPending: true }) => {
      const { clearLoading = true, clearPending = true } = opts;

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
              if (clearLoading) uiActions?.setLoading(false);
              if (clearPending) uiActions?.setPending(false);
            }, 300);
          }
        }
      });
    },
    [router, isPending, uiActions]
  );

  return refreshRouter;
}
