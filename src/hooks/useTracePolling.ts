import { useQuery } from "@tanstack/react-query";
import { Span } from "@/types/evals/traces";
import { useStoreContext } from "@/contexts/providers/StoreProvider";

interface TracePollingResult {
  trace: Span[];
  trace_complete?: boolean;
}

/**
 * Poll the backend for an updated trace for a single log row.
 *
 * It calls the existing /api/logs route with:
 *     from_fields = "trace_id"
 *     filter_expr  = `id==${rowId}`
 *     limit        = 1
 *
 * The query automatically re-fires every `intervalMs` while enabled.
 */
export function useTracePolling(rowId: string | undefined | null, intervalMs = 5000) {
  // Resolve the active project (required by the logs endpoint)
  const activeProjectId = useStoreContext((s) => s.activeProjectId);

  return useQuery<TracePollingResult | undefined>({
    queryKey: ["trace-row", rowId, activeProjectId],
    enabled: !!rowId && !!activeProjectId,
    refetchInterval: intervalMs,
    staleTime: 0,
    queryFn: async () => {
      if (!rowId || !activeProjectId) return undefined;

      const params = new URLSearchParams();
      params.append("project", activeProjectId);
      params.append("from_fields", "trace_id");
      params.append("filter_expr", `id==${rowId}`);
      params.append("limit", "1");
      params.append("offset", "0");
      params.append("_timestamp", Date.now().toString());

      const res = await fetch(`/api/logs?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch trace row");
      const json = await res.json();
      const first = json?.logs?.[0];
      const trace: Span[] | undefined = first?.entries?.trace_id;
      if (!trace || !Array.isArray(trace)) return undefined;
      return { trace, trace_complete: first?.trace_complete } as TracePollingResult;
    },
  });
} 