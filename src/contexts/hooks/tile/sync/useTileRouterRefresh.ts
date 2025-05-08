// useTileRouterRefresh.ts
import { useTransition, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TileUIActions } from "@/contexts/hooks/tile";   // whatever the type is

type RefreshOpts = {
  /** setLoading(true/false) around the transition */
  withLoading?: boolean;
  /** setPending(true/false) around the transition */
  withPending?: boolean;
};

/**
 * Make `router.refresh()` tile-aware.
 *
 * Every call will:
 *   1. turn the requested UI flags **on**
 *   2. perform `router.refresh()` inside a React transition
 *   3. turn the flags **off** when the transition settles
 *
 * The hook internally reference-counts concurrent refreshes, so if the
 * same tile fires multiple refreshes in parallel the flags are cleared
 * only after the very last one completes.
 */
export function useTileRouterRefresh(uiActions: TileUIActions | null) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // how many refreshes we started that haven't finished yet
  const counter = useRef(0);

  /** call inside a setter */
  const refreshRouter = useCallback(
    (opts: RefreshOpts = { withLoading: false, withPending: false }) => {
      const { withLoading = false, withPending = false } = opts;

      if (withLoading) uiActions?.setLoading(true);
      if (withPending) uiActions?.setPending(true);
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
            if (withLoading) uiActions?.setLoading(false);
            if (withPending) uiActions?.setPending(false);
          }
        }
      });
    },
    [router, isPending, uiActions]
  );

  return refreshRouter;
}
