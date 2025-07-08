import { useQuery, useMutation } from "@tanstack/react-query";
import { PlotDataItem } from "@/types/interfaces/grid";
import { useQueryClient } from "@tanstack/react-query";
import { PlotArguments } from "@/types/interfaces/logs";
import { useMemo, useRef, useEffect, useCallback } from "react";

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
    // The data is prefetched by the server component
    // so we don't need to provide a queryFn
    // Disable all auto-refreshing:
    staleTime: Infinity,        // Never mark as stale automatically
    gcTime: Infinity,           // Never garbage collect
    refetchOnMount: false,      // Don't refetch when component mounts
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnReconnect: false,  // Don't refetch when network reconnects
    refetchInterval: false,     // No periodic refetching
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
  } = useQuery<PlotDataItem>({
    queryKey: ["plotDataItem", tileId],
    placeholderData: EMPTY_PLOTDATAITEM,
    // Disable all auto-refreshing:
    staleTime: Infinity,        // Never mark as stale automatically
    gcTime: Infinity,           // Never garbage collect
    refetchOnMount: false,      // Don't refetch when component mounts
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnReconnect: false,  // Don't refetch when network reconnects
    refetchInterval: false,     // No periodic refetching
    enabled: !!tileId,
  });

  // Create a ref to track the latest data including pending mutations
  const plotDataItemRef = useRef<PlotDataItem>(plotDataItem);
  
  // Keep the ref updated with the latest data from the query
  useEffect(() => {
    plotDataItemRef.current = plotDataItem;
  }, [plotDataItem]);

  // Use the update mutation hook
  const { mutate: updatePlotData } = useUpdatePlotDataItem(tileId || "");
  
  // Enhanced wrapper around updatePlotData that also updates our local ref
  const updateWithTracking = useCallback((newData: Partial<PlotDataItem>) => {
    // Update our local reference first
    plotDataItemRef.current = { ...plotDataItemRef.current, ...newData };
    // Then call the actual mutation
    updatePlotData(newData);
  }, [updatePlotData]);

  // Function for full plot data item replacement
  const updatePlotDataItem = useCallback((newPlotDataItem: PlotDataItem) => {
    updateWithTracking(newPlotDataItem);
  }, [updateWithTracking]);

  // Function for partial updates with updater function
  const updatePlotDataItemWithUpdater = useCallback((
    updaterOrData: PlotDataItem | ((prev: PlotDataItem) => PlotDataItem)
  ) => {
    if (typeof updaterOrData === 'function') {
      // If it's a function updater, pass it the latest data
      const updater = updaterOrData as (prev: PlotDataItem) => PlotDataItem;
      const updatedData = updater(plotDataItemRef.current);
      updateWithTracking(updatedData);
    } else {
      // If it's direct data, just update with it
      updateWithTracking(updaterOrData);
    }
  }, [updateWithTracking]);

  return {
    plotDataItem: plotDataItemRef.current,
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
    // Disable all auto-refreshing:
    staleTime: 0,
    refetchOnMount: false,      // Don't refetch when component mounts
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnReconnect: false,  // Don't refetch when network reconnects
    refetchInterval: false,     // No periodic refetching
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
      queryClient.invalidateQueries({ queryKey: ["plotDataItem", tileId], refetchType: 'none' });
    },
  });
}
