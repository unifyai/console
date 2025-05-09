import { useQuery, useMutation } from "@tanstack/react-query";
import { PlotDataItem } from "@/types/evals/grid";
import { getQueryClient } from '@/lib/react-query/getQueryClient'
import { PlotArguments } from "@/types/evals/logs";

/**
 * Hook for accessing plot data cached by the server component
 * @param tileId ID of the tile to get data for
 */
export function usePlotDataQuery(tileId: string) {
  return useQuery<PlotDataItem>({
    queryKey: ["plotDataItem", tileId],
    // The data is prefetched by the server component
    // so we don't need to provide a queryFn
    staleTime: 30000, // 30 seconds before considering data stale
    enabled: !!tileId, // Only run the query if we have a valid tileId
  });
}

/**
 * Hook for accessing plot arguments (API call parameters) cached by the server component
 * @param tabId The id of the tab containing the plots
 */
export function usePlotArgumentsQuery(tabId: string | null) {
  return useQuery<PlotArguments>({
    queryKey: ["plotArguments", tabId],
    // The data is prefetched by the server component
    staleTime: 30000, // 30 seconds before considering data stale
    enabled: !!tabId, // Only run the query if we have a valid tabId
  });
}

/**
 * Hook for updating plot data with optimistic updates
 * This encapsulates the mutation logic for updating plot data
 * 
 * @param tileId ID of the tile to update data for
 * @returns A mutation object that can be used to update plot data
 */
export function useUpdatePlotDataItem(tileId: string) {
  const queryClient = getQueryClient();
  
  return useMutation<PlotDataItem, Error, Partial<PlotDataItem>, { previousData?: PlotDataItem }>({
    mutationFn: async (newData) => {
      // In a real application, you would make an API call here
      // For now, we're just simulating a successful update
      console.log(`Updating plot data for tile ${tileId}:`, newData);
      
      // Simulating API response
      return {
        ...(queryClient.getQueryData<PlotDataItem>(["plotDataItem", tileId]) || {}),
        ...newData
      } as PlotDataItem;
    },
    
    // When mutate is called:
    onMutate: async (newData) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ["plotDataItem", tileId] });
      
      // Snapshot the previous value
      const previousData = queryClient.getQueryData<PlotDataItem>(["plotDataItem", tileId]);
      
      // Optimistically update to the new value
      queryClient.setQueryData<PlotDataItem>(["plotDataItem", tileId], (old) => ({
        ...(old || {}),
        ...newData
      } as PlotDataItem));
      
      // Return a context object with the snapshotted value
      return { previousData };
    },
    
    // If mutation fails, use the context returned from onMutate to roll back
    onError: (err, newData, context) => {
      console.error("Error updating plot data:", err);
      queryClient.setQueryData(["plotDataItem", tileId], context?.previousData);
    },
    
    // Always refetch after error or success to ensure cache is correct
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["plotDataItem", tileId] });
    },
  });
}
