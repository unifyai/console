import { useMutation, useQuery, useQueries, UseQueryOptions, UseQueryResult } from "@tanstack/react-query";
import { TableDataItem } from "@/types/evals/grid";
import { getQueryClient } from '@/lib/react-query/getQueryClient'
import { useTileMeta } from "@/contexts/hooks/tile";
import { TablesArguments } from "@/types/evals/logs";
import { useTabMeta } from "@/contexts/hooks/tab";
import { useMemo, useRef, useEffect, useCallback } from "react";

export const EMPTY_TABLEDATAITEM: TableDataItem = {
  columnContexts: [],
  baseIndex: undefined,
  hiddenColumns: undefined,
  columnOrdering: undefined,
  selection: undefined,
  fields: {},
  logsData: { params: {}, logs: [], count: 0, groups: {} },
  totalPages: 0,
  entriesProperties: [],
  paramsProperties: [],
  logs: [],
  params: [],
  metrics: {},
  groupedMetrics: {},
  boundaries: { minimums: {}, maximums: {} },
  metric: "",
};

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
    placeholderData: EMPTY_TABLEDATAITEM,
    // The data is prefetched by the server component
    // so we don't need to provide a queryFn
    staleTime: 30000, // 30 seconds before considering data stale
    enabled: !!(tileId),
  });
}

/**
 * Enhanced hook that provides table data with state tracking for sequential updates
 * @param tileName Name of the tile to get data for
 * @param tabName Name of the tab containing the tile
 * @returns Object containing the table data, update functions, and loading states
 */
export function useTableDataQueryWithTracking(
  tileName: string | null,
  tabName: string | null,
) {
  // Get tile meta information using the useTileMeta hook
  const { tileId } = useTileMeta(tileName, tabName || null);

  // Base React Query hook
  const { 
    data: tableDataItem = EMPTY_TABLEDATAITEM,
    isLoading,
    isError,
    error
  } = useQuery<TableDataItem>({
    queryKey: ["tableDataItem", tileId],
    placeholderData: EMPTY_TABLEDATAITEM,
    staleTime: 30000,
    enabled: !!(tileId),
  });

  // Create a ref to track the latest data including pending mutations
  const tableDataItemRef = useRef<TableDataItem>(tableDataItem);
  
  // Keep the ref updated with the latest data from the query
  useEffect(() => {
    tableDataItemRef.current = tableDataItem;
  }, [tableDataItem]);

  // Use the update mutation hook
  const { mutate: updateTableData } = useUpdateTableDataItem(tileId || "");
  
  // Enhanced wrapper around updateTableData that also updates our local ref
  const updateWithTracking = useCallback((newData: Partial<TableDataItem>) => {
    // Update our local reference first
    tableDataItemRef.current = { ...tableDataItemRef.current, ...newData };
    // Then call the actual mutation
    updateTableData(newData);
  }, [updateTableData]);

  // Function for full table data item replacement
  const updateTableDataItem = useCallback((newTableDataItem: TableDataItem) => {
    updateWithTracking(newTableDataItem);
  }, [updateWithTracking]);

  // Function for field-by-field merging (more efficient)
  const mergeUpdatesIntoTableDataItem = useCallback((
    partialUpdates: Partial<TableDataItem>
  ) => {
    const result: any = { ...tableDataItemRef.current };
    
    // Use the field-by-field merge approach from the original code
    Object.keys(partialUpdates).forEach(key => {
      const updateKey = key as keyof TableDataItem;
      const updateValue = (partialUpdates as any)[updateKey];
      const currentValue = (tableDataItemRef.current as any)[updateKey];
      
      // If both values exist and are objects, merge them
      if (
        updateValue && 
        currentValue && 
        typeof updateValue === 'object' && 
        typeof currentValue === 'object' &&
        !Array.isArray(updateValue)
      ) {
        result[updateKey] = { ...currentValue, ...updateValue };
      } else {
        result[updateKey] = updateValue;
      }
    });
    
    updateWithTracking(result as TableDataItem);
  }, [updateWithTracking]);

  // Adapter that accepts an updater function as well as partial updates
  const updateTableDataItemWithUpdater = useCallback((
    updater?: (prev: TableDataItem) => TableDataItem,
    partialUpdates?: Partial<TableDataItem>,
    merge?: boolean
  ) => {
    const deferringFn = merge ? mergeUpdatesIntoTableDataItem : updateTableDataItem;

    if (updater) {
      if (partialUpdates) {
        deferringFn(partialUpdates as TableDataItem);
      } else {
        deferringFn(updater(tableDataItemRef.current));
      }
    } else if (partialUpdates) {
      deferringFn(partialUpdates as TableDataItem);
    }
  }, [mergeUpdatesIntoTableDataItem, updateTableDataItem]);

  return {
    tableData: tableDataItemRef.current,
    isLoading,
    isError,
    error,
    updateTableDataItem,
    mergeUpdatesIntoTableDataItem,
    updateTableDataItemWithUpdater
  };
}

/**
 * Fetch *multiple* table-data items at once.
 *
 * @param tileIds Stable list of tile UUIDs. The order must stay the same
 *                between renders to keep React-Query happy.
 *
 * @returns Map "tileId → TableDataItem"
 */
export function useTableDataQueries(
  tileIds: string[],
): Record<string, TableDataItem> {
  /* build the query-options **without** creating extra hooks in a loop */
  const results = useQueries({
    queries: tileIds.map<UseQueryOptions<TableDataItem>>((id) => ({
      queryKey: ["tableDataItem", id],
      placeholderData: EMPTY_TABLEDATAITEM,
      staleTime: 30_000,
      enabled: !!id,
    })),
  }) as UseQueryResult<TableDataItem, unknown>[]; // type-narrowing

  console.log("[useTableDataQueries] results", results);

  /* fold the React-Query results into a flat dictionary */
  return useMemo(() => {
    const out: Record<string, TableDataItem> = {};
    tileIds.forEach((id, idx) => {
      out[id] = results[idx]?.data ?? EMPTY_TABLEDATAITEM;
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileIds, results.map((r) => r.data)]); // shallow dependency for memo
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

  return useQuery<TablesArguments>({
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
