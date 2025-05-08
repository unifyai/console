import { useQuery } from "@tanstack/react-query";
import { Span } from "@/types/evals/traces";
import { useStoreContext } from "@/contexts/providers/StoreProvider";
import { LogsActions } from "@/types/evals/grid";
import { LogProps } from "@/types/evals/logs";

/**
 * Poll the backend for an updated trace for a single log row.
 * The query automatically re-fires every `intervalMs` while enabled.
 */
export function useTracePolling(
  log: LogProps | undefined,
  logsActions: LogsActions | undefined,
  context: string | null,
  fieldName: string,
  intervalMs = 500
) {
  const project = useStoreContext((s) => s.activeProjectId);
  const logId = log?.id;
  console.log("Query ket",project, context, fieldName, logId)
  return useQuery<Span[] | undefined>({
    // Update query key to include logId and context
    queryKey: [project, context, fieldName, logId],
    // Enable only if logId, projectId, and logsActions are available
    enabled: !!logId && !!project && !!logsActions,
      refetchInterval: intervalMs,
      staleTime: 0,
      queryFn: async () => {
        if (!logId || !project) return undefined;
        // Guard against missing dependencies
        if (!logId || !project || !logsActions) return undefined;
    
        try {
          // Use the getLogs server action
          const json = await logsActions.get(
            project,               // project
            context,               // context
            null,                  // columnContext
            null,                  // filter_expr
            null,                  // sortingExpression
            null,                  // groupingExpression
            null,                  // groupSortingExpression
            logId,                 // from_ids
            fieldName,             // from_fields
            null,                  // exclude_fields
            1,                     // limit
            0,                     // offset
            null,                  // group_depth
            null,                  // return_ids_only
            Date.now().toString()  // _timestamp for cache busting
          );
    
          if (json.detail) {
            console.error("Error fetching trace row:", json.detail);
            return undefined;
          }

          // Extract trace data
          const first = (json?.logs as LogProps[])?.[0];
          const trace = first?.entries?.[fieldName];

          if (!trace) {
            // If trace is not found, return undefined but don't throw
            console.warn(`Trace not found for logId: ${logId}`);
            return undefined;
          }
          console.log("New trace", trace)
          return Array.isArray(trace) ? trace as Span[] : [trace];

        } catch (error) {
          console.error("Error in useTracePolling queryFn:", error);
          // Return undefined on error to prevent breaking the UI
          return undefined;
        }
    },
  });
}