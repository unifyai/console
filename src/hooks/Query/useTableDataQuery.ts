import { useMutation, useQuery } from "@tanstack/react-query";
import { TableDataItem } from "@/types/evals/grid";
import { getQueryClient } from '@/lib/react-query/getQueryClient'
import { useTileMeta } from "@/contexts/hooks/tile";
import { TableArguments } from "@/types/evals/logs";
import { useTabMeta } from "@/contexts/hooks/tab";

/**
 * Hook for accessing table data cached by the server component
 * @param tileId ID of the tile to get data for
 */
export function useTableDataQuery(
  tileName: string | null,
  tabName: string | null,
) {
  // Get tile meta information using the useTileMeta hook
  const { tileId } = useTileMeta(tileName, tabName || null);

  return useQuery<TableDataItem>({
    queryKey: ["tableDataItem", tileId],
    // The data is prefetched by the server component
    // so we don't need to provide a queryFn
    staleTime: 30000, // 30 seconds before considering data stale
  });
}

/**
 * Hook for accessing table arguments (API call parameters) cached by the server component
 * @param tabName The name of the tab containing the tables
 * @param interfaceName Optional interface name
 */
export function useTableArgumentsQuery(
  tabName: string | null,
  interfaceName?: string | null,
) {
  // Get tab meta information using the useTabMeta hook
  const { tabId } = useTabMeta(tabName, interfaceName || null);

  return useQuery<TableArguments>({
    queryKey: ["tableArguments", tabId],
    // The data is prefetched by the server component
    staleTime: 30000, // 30 seconds before considering data stale
    enabled: !!tabId, // Only run the query if we have a valid tabId
  });
}

/**
 * Hook for updating table data with optimistic updates
 * This encapsulates the mutation logic for updating table data
 * 
 * @param tileId ID of the tile to update data for
 * @returns A mutation object that can be used to update table data
 */
export function useUpdateTableDataItem(tileId: string) {
  const queryClient = getQueryClient();
  
  return useMutation<TableDataItem, Error, Partial<TableDataItem>, { previousData?: TableDataItem }>({
    mutationFn: async (newData) => {
      // In a real application, you would make an API call here
      // For now, we're just simulating a successful update
      console.log(`Updating table data for tile ${tileId}:`, newData);
      
      // Simulating API response
      return {
        ...(queryClient.getQueryData<TableDataItem>(["tableDataItem", tileId]) || {}),
        ...newData
      } as TableDataItem;
    },
    
    // When mutate is called:
    onMutate: async (newData) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ["tableDataItem", tileId] });
      
      // Snapshot the previous value
      const previousData = queryClient.getQueryData<TableDataItem>(["tableDataItem", tileId]);
      
      // Optimistically update to the new value
      queryClient.setQueryData<TableDataItem>(["tableDataItem", tileId], (old) => ({
        ...(old || {}),
        ...newData
      } as TableDataItem));
      
      // Return a context object with the snapshotted value
      return { previousData };
    },
    
    // If mutation fails, use the context returned from onMutate to roll back
    onError: (err, newData, context) => {
      console.error("Error updating table data:", err);
      queryClient.setQueryData(["tableDataItem", tileId], context?.previousData);
    },
    
    // Always refetch after error or success to ensure cache is correct
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tableDataItem", tileId] });
    },
  });
}
