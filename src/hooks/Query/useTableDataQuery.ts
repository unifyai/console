import { useMutation, useQuery } from "@tanstack/react-query";
import { TableDataItem } from "@/types/evals/grid";
import { getQueryClient } from '@/lib/react-query/getQueryClient'
import { useTileMeta } from "@/contexts/hooks/tile";

/**
 * Hook for accessing table data cached by the server component
 * @param tileId ID of the tile to get data for
 */
export function useTableDataQuery(
  tileName: string | null,
  tabName: string | null,
  interfaceName: string | null,
  projectName?: string | null
) {
  // Get tile meta information using the useTileMeta hook
  const { tileId } = useTileMeta(tileName, tabName || null, interfaceName || null, projectName || null);

  return useQuery<TableDataItem>({
    queryKey: ["tableData", tileId],
    // The data is prefetched by the server component
    // so we don't need to provide a queryFn
    staleTime: 30000, // 30 seconds before considering data stale
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
        ...(queryClient.getQueryData<TableDataItem>(["tableData", tileId]) || {}),
        ...newData
      } as TableDataItem;
    },
    
    // When mutate is called:
    onMutate: async (newData) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ["tableData", tileId] });
      
      // Snapshot the previous value
      const previousData = queryClient.getQueryData<TableDataItem>(["tableData", tileId]);
      
      // Optimistically update to the new value
      queryClient.setQueryData<TableDataItem>(["tableData", tileId], (old) => ({
        ...(old || {}),
        ...newData
      } as TableDataItem));
      
      // Return a context object with the snapshotted value
      return { previousData };
    },
    
    // If mutation fails, use the context returned from onMutate to roll back
    onError: (err, newData, context) => {
      console.error("Error updating table data:", err);
      queryClient.setQueryData(["tableData", tileId], context?.previousData);
    },
    
    // Always refetch after error or success to ensure cache is correct
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tableData", tileId] });
    },
  });
}
