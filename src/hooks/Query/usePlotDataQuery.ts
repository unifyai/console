import { useQuery } from "@tanstack/react-query";
import { PlotDataItem } from "@/types/evals/grid";

/**
 * Hook for accessing plot data cached by the server component
 * @param tileId ID of the tile to get data for
 */
export function usePlotDataQuery(tileId: string) {
  return useQuery<PlotDataItem>({
    queryKey: ["plotData", tileId],
    // The data is prefetched by the server component
    // so we don't need to provide a queryFn
    staleTime: 30000, // 30 seconds before considering data stale
  });
} 