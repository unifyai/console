import { useQuery } from "@tanstack/react-query";
import { TableDataItem } from "@/types/evals/grid";

/**
 * Hook for accessing table data cached by the server component
 * @param tileId ID of the tile to get data for
 */
export function useTableDataQuery(tileId: string) {
  return useQuery<TableDataItem>({
    queryKey: ["tableData", tileId],
    // The data is prefetched by the server component
    // so we don't need to provide a queryFn
    staleTime: 30000, // 30 seconds before considering data stale
  });
} 