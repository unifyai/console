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

  return useQuery<Span[] | undefined>({
    // Update query key to include logId and context
    queryKey: ['tracePolling', project, context, fieldName, logId], // Added 'tracePolling' prefix for clarity
    // Enable only if logId, projectId, and logsActions are available AND log is defined
    enabled: !!logId && !!project && !!logsActions && !!log,
      refetchInterval: intervalMs,
      staleTime: 0, // Ensure data is always considered fresh for polling
      gcTime: intervalMs * 2, // Keep data slightly longer than interval
      refetchIntervalInBackground: false, // Don't poll when tab is inactive
      refetchOnWindowFocus: false, // Don't refetch just because window gained focus
      queryFn: async () => {
        // Guard against missing dependencies - recheck inside queryFn
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
            String(logId),         // from_ids - ensure it's a string
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
          // Access the specific fieldName within entries
          const trace = first?.entries?.[fieldName];

          if (trace === undefined) { // Check specifically for undefined
            // If trace is not found, return undefined but don't throw
            console.warn(`Trace field '${fieldName}' not found for logId: ${logId}`);
            return undefined;
          }

          // Ensure the result is always an array of spans
          if (Array.isArray(trace)) {
             return trace as Span[];
          } else if (trace !== null && typeof trace === 'object') {
             // If it's a single span object, wrap it in an array
             return [trace as Span];
          } else {
             // If it's neither an array nor a valid object, consider it invalid
             console.warn(`Invalid trace data structure for logId: ${logId}, field: ${fieldName}`);
             return undefined;
          }

        } catch (error) {
          console.error("Error in useTracePolling queryFn:", error);
          // Return undefined on error to prevent breaking the UI
          return undefined;
        }
    },
  });
}