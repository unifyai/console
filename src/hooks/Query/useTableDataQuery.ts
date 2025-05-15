import { useMutation, useQuery, useQueries, UseQueryOptions, UseQueryResult } from "@tanstack/react-query";
import { TableDataItem } from "@/types/evals/grid";
import { getQueryClient } from '@/lib/react-query/getQueryClient'
import { useTileMeta } from "@/contexts/hooks/tile";
import { TableArguments } from "@/types/evals/logs";
import { useTabMeta } from "@/contexts/hooks/tab";
import { useMemo, useRef, useEffect, useCallback } from "react";
import { setDeep } from "@/utils/objectPath";

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
  tileIdOrName: string | null,
  tabIdOrName: string | null,
) {
  // Get tile meta information using the useTileMeta hook
  const { tileId } = useTileMeta(tileIdOrName, tabIdOrName || null);

  return useQuery<TableDataItem>({
    queryKey: ["tableDataItem", tileId],
    placeholderData: EMPTY_TABLEDATAITEM,
    // The data is prefetched by the server component
    // so we don't need to provide a queryFn
    // Disable all auto-refreshing:
    staleTime: Infinity,        // Never mark as stale automatically
    gcTime: Infinity,           // Never garbage collect
    refetchOnMount: false,      // Don't refetch when component mounts
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnReconnect: false,  // Don't refetch when network reconnects
    refetchInterval: false,     // No periodic refetching
    enabled: !!(tileId),
  });
}

/**
 * Enhanced hook that provides table data with state tracking for sequential updates
 * @param tileIdOrName Name of the tile to get data for
 * @param tabIdOrName Name of the tab containing the tile
 * @returns Object containing the table data, update functions, and loading states
 */
export function useTableDataQueryWithTracking(
  tileIdOrName: string | null,
  tabIdOrName: string | null,
) {
  // Get tile meta information using the useTileMeta hook
  const { tileId } = useTileMeta(tileIdOrName, tabIdOrName || null);

  // Base React Query hook
  const { 
    data: tableDataItem = EMPTY_TABLEDATAITEM,
    isLoading,
    isError,
    error
  } = useQuery<TableDataItem>({
    queryKey: ["tableDataItem", tileId],
    placeholderData: EMPTY_TABLEDATAITEM,
    // Disable all auto-refreshing:
    staleTime: Infinity,        // Never mark as stale automatically
    gcTime: Infinity,           // Never garbage collect
    refetchOnMount: false,      // Don't refetch when component mounts
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnReconnect: false,  // Don't refetch when network reconnects
    refetchInterval: false,     // No periodic refetching
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
    console.log("[updateWithTracking] Updating with tracking...");
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

    console.log("[mergeUpdatesIntoTableDataItem] partialUpdates:", partialUpdates);
    
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

  // Function for deep updating specific logs by row IDs
  const updateLogsDeep = useCallback((
    rowIds: string[], 
    desc: { 
      source: "entries" | "params"; 
      path: (string | number)[]; 
      newValue: any 
    }
  ) => {
    if (!tileId || rowIds.length === 0) {
      console.log("[DEBUG] Aborting updateLogsDeep – missing tileId or empty rowIds");
      return;
    }

    // Work with our locally tracked current logs
    const currentLogs = tableDataItemRef.current?.logs;

    if (!currentLogs) {
      console.log("[DEBUG] No currentLogs found – aborting");
      return; // safety guard
    }

    const idSet = new Set(rowIds.map(String));

    let changed = false;
    const nextLogs = currentLogs.map((l: any) => {
      if (!idSet.has(String(l.id))) return l;

      const container = desc.source === "params" ? l.params ?? {} : l.entries ?? {};
      const updated = setDeep(container, desc.path, desc.newValue);

      if (updated === container) return l; // no real change

      changed = true;

      return {
        ...l,
        ...(desc.source === "params" ? { params: updated } : { entries: updated }),
      };
    });

    if (!changed) {
      console.log("[DEBUG] updateLogsDeep detected no changes – skipping state merge");
      return; // nothing mutated
    }

    // Guard: avoid clobbering entire container if path is empty
    if (desc.path.length === 0) {
      console.warn("[DEBUG] updateLogsDeep – empty path, skipping to avoid overwriting container", { desc });
      return;
    }

    // Update the entire logs array using our existing updateTableDataItem function
    updateTableDataItem({
      ...tableDataItemRef.current,
      logs: nextLogs,
    });
  }, [tileId, updateTableDataItem]);

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
    updateTableDataItemWithUpdater,
    updateLogsDeep
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
 * @param tabIdOrName The name of the tab containing the tables
 * @param interfaceIdOrName Optional interface name
 */
export function useTableArgumentsQuery(
  tabIdOrName: string | null,
  interfaceIdOrName?: string | null,
) {
  // Get tab meta information using the useTabMeta hook
  const { tabId } = useTabMeta(tabIdOrName, interfaceIdOrName || null);

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
      console.log(`[updateTableDataItem] Updating table data for tile ${tileId}:`, newData);
      
      // Simulating API response
      return {
        ...(queryClient.getQueryData<TableDataItem>(["tableDataItem", tileId]) || {}),
        ...newData
      } as TableDataItem;
    },
    
    // When mutate is called:
    onMutate: async (newData) => {
      console.log(`[updateTableDataItem] onMutate:`, newData);
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ["tableDataItem", tileId] });
      
      // Snapshot the previous value
      const previousData = queryClient.getQueryData<TableDataItem>(["tableDataItem", tileId]);
      console.log(`[updateTableDataItem] previousData:`, previousData);
      // Optimistically update to the new value
      queryClient.setQueryData<TableDataItem>(["tableDataItem", tileId], (old) => ({
        ...(old || {}),
        ...newData
      } as TableDataItem));
      console.log(`[updateTableDataItem] newData:`, newData);
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
      console.log(`[updateTableDataItem] onSettled:`, tileId);
      queryClient.invalidateQueries({ queryKey: ["tableDataItem", tileId], refetchType: 'none' });
    },
  });
}
