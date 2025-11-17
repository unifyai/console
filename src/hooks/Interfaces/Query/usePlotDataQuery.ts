import { useQuery, useMutation } from "@tanstack/react-query";
import { PlotDataItem } from "@/types/interfaces/grid";
import { useQueryClient } from "@tanstack/react-query";
import { PlotArguments } from "@/types/interfaces/logs";
import { useMemo, useCallback } from "react";

// Default empty plot data item
export const EMPTY_PLOTDATAITEM: PlotDataItem = {
  plotLogs: [],
  plotFields: {}
};

/**
 * Hook for accessing plot data cached by the server component
 * @param tileId ID of the tile to get data for
 */
export function usePlotDataQuery(tileId: string) {
  const emptyPlotDataItem = useMemo<PlotDataItem>(() => EMPTY_PLOTDATAITEM, []);

  return useQuery<PlotDataItem>({
    queryKey: ["plotDataItem", tileId],
    placeholderData: emptyPlotDataItem,
    // The data is prefetched manually on the client
    // so we don't need to provide a queryFn
    // Configure staleness to allow re-renders while preventing unnecessary refetches:
    staleTime: 0,
    gcTime: 0,
    enabled: !!tileId, // Only run the query if we have a valid tileId
  });
}

/**
 * Enhanced hook that provides plot data with state tracking for sequential updates
 * @param tileId ID of the tile to get data for
 * @returns Object containing the plot data, update functions, and loading states
 */
export function usePlotDataQueryWithTracking(tileId: string) {
  // Base React Query hook
  const { 
    data: plotDataItem = EMPTY_PLOTDATAITEM,
    isLoading,
    isError,
    error
  } = usePlotDataQuery(tileId);

  // Use the update mutation hook
  const { mutate: updatePlotDataItem } = useUpdatePlotDataItem(tileId || "");

  // Function for partial updates with updater function
  const updatePlotDataItemWithUpdater = useCallback((
    updaterOrData: PlotDataItem | ((prev: PlotDataItem) => PlotDataItem)
  ) => {
    if (typeof updaterOrData === 'function') {
      // If it's a function updater, use the reactive data which should be fresh with staleTime: 0
      const updater = updaterOrData as (prev: PlotDataItem) => PlotDataItem;
      const updatedData = updater(plotDataItem);
      updatePlotDataItem(updatedData);
    } else {
      // If it's direct data, just update with it
      updatePlotDataItem(updaterOrData);
    }
  }, [updatePlotDataItem, plotDataItem]);

  // Return the actual query data for reactivity
  return {
    plotDataItem: plotDataItem,
    isLoading,
    isError,
    error,
    updatePlotDataItem,
    updatePlotDataItemWithUpdater
  };
}

/**
 * Hook for accessing plot arguments (API call parameters) cached by the server component
 * @param tabId The id of the tab containing the plots
 */
export function usePlotArgumentsQuery(tabId: string | null) {
  return useQuery<PlotArguments>({
    queryKey: ["plotArguments", tabId],
    // The data is prefetched by the server component
    // No stale time or gc time for plot arguments
    staleTime: 0,
    gcTime: 0,
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
  const queryClient = useQueryClient();
  
  return useMutation<PlotDataItem, Error, Partial<PlotDataItem>, { previousData?: PlotDataItem }>({
    mutationFn: async (newData) => {
      // Simulating API response - in real app this would make an API call
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
    
    // Always invalidate to ensure cache consistency and trigger re-renders
    onSettled: () => {
      // Invalidate the main query to ensure it's marked as stale
      queryClient.invalidateQueries({ 
        queryKey: ["plotDataItem", tileId], 
        refetchType: 'none' // Don't refetch, just mark as stale
      });
      
      // Also invalidate the auto-update query if it exists
      queryClient.invalidateQueries({ 
        queryKey: ["plotDataItem", "autoUpdate", tileId], 
        refetchType: 'none' 
      });
    },
  });
}
