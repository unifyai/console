import { useMutation, useQuery } from "@tanstack/react-query";
import { TableBoundaries, TableDataItem, TableMetrics, TableGroupedMetrics } from "@/types/interfaces/grid";
import { useQueryClient } from "@tanstack/react-query";
import { useTileData, useTileMeta } from "@/contexts/hooks/tile";
import { LogFieldsResponseProps, TableArguments, LogsResponseProps } from "@/types/interfaces/logs";
import { useTabMeta } from "@/contexts/hooks/tab";
import { useMemo, useRef, useEffect, useCallback } from "react";
import { setDeep } from "@/utils/objectPath";
import { buildAvailableFieldsForTile } from "@/utils/arguments/buildTableArguments";
import { getColumnMetrics, getGroupedMetrics } from "@/utils/interfaces/common";
import { getNewCells } from "@/utils/data/buildTableDataItem";
import { appendToGroupedLogs, maybeConvertRawToGroupedLogs, updateGroupedSubRows, appendToGroupedSubRows, isGroupedLogs, isUngroupedLogs } from "@/utils/interfaces/table/grouping";
import { LogsActions } from "@/types/interfaces/grid";
import { LogProps, GroupedLogProps } from "@/types/interfaces/logs";

/**
 * Debug flag for performance logging
 * Set NEXT_PUBLIC_DEBUG_PERFORMANCE=true to enable detailed performance timing logs
 */
const DEBUG_PERFORMANCE = process.env.NEXT_PUBLIC_DEBUG_PERFORMANCE === 'true';

/**
 * Conditional debug logger for performance metrics
 */
const perfLog = (...args: any[]) => {
  if (DEBUG_PERFORMANCE) {
    console.log(...args);
  }
};

export const EMPTY_TABLEDATAITEM: TableDataItem = {
  columnContexts: [],
  fields: {},
  totalCount: 0,
  error: undefined,
  entriesProperties: [],
  paramsProperties: [],
  logs: [],
  params: [],
  isLoading: true
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
    
    updateTableDataItem(result as TableDataItem);
  }, [updateTableDataItem]);

  // Function for deep updating specific logs by row IDs
  const updateLogsByRowIds = useCallback((
    rowIds: string[], 
    desc: { 
      source: "entries" | "params"; 
      path: (string | number)[]; 
      newValue: any 
    }
  ) => {
    if (!tileId || rowIds.length === 0) {
      console.log("[DEBUG] Aborting updateLogsByRowIds – missing tileId or empty rowIds");
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
      console.log("[DEBUG] updateLogsByRowIds detected no changes – skipping state merge");
      return; // nothing mutated
    }

    // Guard: avoid clobbering entire container if path is empty
    if (desc.path.length === 0) {
      console.warn("[DEBUG] updateLogsByRowIds – empty path, skipping to avoid overwriting container", { desc });
      return;
    }

    // Update the entire logs array using our existing updateTableDataItem function
    updateTableDataItem({
      ...tableDataItemRef.current,
      logs: nextLogs,
    });
  }, [tileId, updateTableDataItem]);

  // Function for updating logs from logsActions.get response
  // Supports both top-level and targeted group updates with replace/append modes:
  // - When targetGroupId and groupFilters are provided, updates/appends at specific group location
  // - When no targeting provided, handles simple top-level replace/append scenarios
  // - Uses updateGroupedSubRows for targeted replace, appendToGroupSubRows for targeted append
  const updateLogs = useCallback((
    logsData: LogsResponseProps,
    mode: "replace" | "append" = "replace",
    targetGroupId?: string | null, // For grouped Load More scenarios
    targetGroupFilters?: [string, string][], // For targeting specific subrows
    preConvertedLogs?: GroupedLogProps[] | LogProps[] // Optional pre-converted logs to avoid double conversion
  ) => {
    if (!tileId) {
      console.log("[DEBUG] Aborting updateLogs – missing tileId");
      return;
    }

    const currentTableDataItem = tableDataItemRef.current;

    // Convert raw logs using the same logic as onGroupExpand
    const newLogs = preConvertedLogs || maybeConvertRawToGroupedLogs(logsData.params, logsData.logs, targetGroupId);

    // Calculate new cells by comparing with existing logs
    const previousLogs = currentTableDataItem.logs;
    const newCells = getNewCells(previousLogs, newLogs);

    // Extract error from logsData
    const error = "detail" in logsData ? logsData["detail"] : undefined;

    // Check log types once at the beginning to avoid redundancy
    const currentLogs = currentTableDataItem.logs;
    const isCurrentGrouped = isGroupedLogs(currentLogs);
    const isCurrentUngrouped = isUngroupedLogs(currentLogs);
    const isNewGrouped = isGroupedLogs(newLogs);
    const isNewUngrouped = isUngroupedLogs(newLogs);

    // Determine final logs based on mode and scenario
    let finalLogs: LogProps[] | GroupedLogProps[];
    
    // Branch 1: If we have targeting information (targetGroupId and groupFilters)
    if (targetGroupId && targetGroupFilters && targetGroupFilters.length > 0) {
      // Targeting only makes sense with grouped logs
      if (isCurrentGrouped) {
        if (mode === "replace") {
          // Replace mode with targeting - replace at specific location using updateGroupedSubRows
          // Pass pre-converted logs to avoid double conversion
          finalLogs = updateGroupedSubRows(
            currentLogs as GroupedLogProps[],
            logsData, // Pass the original LogsResponseProps for totalChildren calculation
            targetGroupFilters,
            targetGroupId,
            newLogs // Pass pre-converted logs to avoid double conversion
          );
        } else {
          // Append mode with targeting - append at specific location using appendToGroupedSubRows
          finalLogs = appendToGroupedSubRows(
            currentLogs,
            newLogs as GroupedLogProps[] | LogProps[],
            targetGroupFilters
          );
        }
      } else {
        // Targeting requested but logs are ungrouped - warn and fallback
        console.warn("[DEBUG] updateLogs: targeting requested but existing logs are ungrouped, falling back to simple operation");
        if (mode === "replace") {
          finalLogs = newLogs;
        } else {
          // For ungrouped logs, just append if both are ungrouped
          finalLogs = isCurrentUngrouped && isNewUngrouped 
            ? [...currentLogs, ...newLogs]
            : newLogs;
        }
      }
    } 
    // Branch 2: No targeting - handle simple scenarios
    else {
      // Handle ungrouped current logs
      if (isCurrentUngrouped) {
        if (mode === "replace") {
          // Replace mode: simply use new logs
          finalLogs = newLogs;
        } else {
          // Append mode: append if new logs are also ungrouped
          finalLogs = isNewUngrouped 
            ? [...currentLogs, ...newLogs]
            : newLogs; // If new logs are grouped, replace instead
        }
      }
      // Handle grouped current logs
      else if (isCurrentGrouped) {
        if (mode === "replace") {
          // Replace mode: simply use new logs
          finalLogs = newLogs;
        } else {
          // Append mode: merge at top level if new logs are also grouped
          if (isNewGrouped) {
            finalLogs = appendToGroupedLogs(currentLogs as any, newLogs as any);
          } else {
            // If new logs are ungrouped but current are grouped, can't meaningfully append
            console.warn("[DEBUG] updateLogs: append mode but cannot merge ungrouped newLogs with grouped currentLogs, keeping currentLogs");
            finalLogs = currentLogs;
          }
        }
      } 
      // Fallback for edge cases (neither grouped nor ungrouped)
      else {
        console.error("[DEBUG] updateLogs: currentLogs are neither grouped nor ungrouped, using newLogs as fallback");
        finalLogs = newLogs;
      }
    }

    // Update the table data item
    updateTableDataItem({
      ...currentTableDataItem,
      logs: finalLogs,
      params: logsData.params,
      newCells,
      error
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

  tableDataItemRef.current = tableDataItem;
  return {
    tableData: tableDataItemRef.current,
    isLoading,
    isError,
    error,
    updateTableDataItem,
    mergeUpdatesIntoTableDataItem,
    updateTableDataItemWithUpdater,
    updateLogsByRowIds,
    updateLogs,
  };
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
 * Hook for updating table argments to calculcate the available fields for a tile
 * @param tileIdOrName The name of the tile to update data for
 * @param tabIdOrName The name of the tab containing the tile
 */
export function useUpdateAvailableFieldsForTableArgumentsQuery(
  tileIdOrName: string | null,
  tabIdOrName: string | null,
  entriesProperties: string[],
  paramsProperties: string[],
  fields: LogFieldsResponseProps,
  interfaceIdOrName?: string | null,
) {
  const queryClient = useQueryClient();

  // Get tab meta information using the useTabMeta hook
  const { tabId }   = useTabMeta(tabIdOrName, interfaceIdOrName || null);
  const { meta: tileMetaState } = useTileMeta(tileIdOrName, tabIdOrName || null);
  const { data: tileDataState } = useTileData(tileIdOrName, tabIdOrName || null);

  const availableFields = useMemo(() => buildAvailableFieldsForTile(
    tileDataState?.column_context ?? "",
    fields,
    entriesProperties,
    paramsProperties
  ), [tileDataState?.column_context, fields, entriesProperties, paramsProperties]);

  const tileName = tileMetaState?.name;
  
  useEffect(() => {
    if (!tabId || !tileName) return;

    queryClient.setQueryData<TableArguments>(
      ["tableArguments", tabId],
      (prev = {} as TableArguments) => ({
        ...prev,
        [tileName]: {
          ...prev[tileName],
          available_fields: availableFields,
        },
      }),
    );
  }, [availableFields, tabId, tileName]);
}

/**
 * Hook for updating table data with optimistic updates
 * This encapsulates the mutation logic for updating table data
 * 
 * @param tileId ID of the tile to update data for
 * @returns A mutation object that can be used to update table data
 */
export function useUpdateTableDataItem(tileId: string) {
  const queryClient = useQueryClient();
  
  return useMutation<TableDataItem, Error, Partial<TableDataItem>, { previousData?: TableDataItem }>({
    mutationFn: async (newData) => {
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
      queryClient.invalidateQueries({ queryKey: ["tableDataItem", tileId], refetchType: 'none' });
    },
  });
}

/**
 * Hook for fetching table metrics in the background
 * @param tileId ID of the tile to get metrics for
 * @param tabId ID of the tab containing the tile
 * @param enabled Whether the query should be enabled
 * @param logsActions Actions for fetching logs data
 * @param projectId Project ID for the query
 * @param context Context for the query
 * @param columnContext Column context for the query
 * @param columns Array of column names
 * @param filterExpression Filter expression
 * @param metric Metric to calculate
 * @param caller Debug string to identify which component called this
 */
export function useTableMetricsQuery(
  tileId: string | null,
  tabId: string | null,
  enabled: boolean = true,
  logsActions?: LogsActions,
  projectId?: string | null,
  context?: string | null,
  columnContext?: string | null,
  columns?: string[],
  filterExpression?: string | null,
  metric?: string,
  caller?: string
) {
  const callerInfo = caller || "unknown";
  const isEnabled = !!(tileId && tabId && enabled && logsActions && projectId && columns?.length);

  return useQuery<TableMetrics>({
    queryKey: [
      "tableMetrics", 
      tileId, 
      tabId, 
      projectId, 
      context, 
      columnContext, 
      columns, 
      filterExpression, 
      metric
    ],
    queryFn: async () => {
      if (!logsActions || !projectId || !columns || columns.length === 0) {
        throw new Error("Missing required parameters for metrics query");
      }

      const tStart = performance.now();
      const result = await getColumnMetrics(
        projectId,
        context || null,
        columnContext || null,
        columns,
        filterExpression || null,
        null,
        metric || "mean",
        logsActions
      ) as TableMetrics;
      const tEnd = performance.now();
      perfLog(`[pref] getColumnMetrics(metric: ${metric}) ${callerInfo}: ${(tEnd - tStart).toFixed(2)}ms`);
      return result;
    },
    enabled: isEnabled,
    staleTime: 0,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  });
}

/**
 * Hook for fetching table boundaries (min/max values) in the background
 * @param tileId ID of the tile to get boundaries for
 * @param tabId ID of the tab containing the tile
 * @param enabled Whether the query should be enabled
 * @param logsActions Actions for fetching logs data
 * @param projectId Project ID for the query
 * @param context Context for the query
 * @param columnContext Column context for the query
 * @param columns Array of column names
 * @param caller Debug string to identify which component called this
 */
export function useTableBoundariesQuery(
  tileId: string | null,
  tabId: string | null,
  enabled: boolean = true,
  logsActions?: LogsActions,
  projectId?: string | null,
  context?: string | null,
  columnContext?: string | null,
  columns?: string[],
  caller?: string
) {
  const callerInfo = caller || "unknown";
  const isEnabled = !!(tileId && tabId && enabled && logsActions && projectId && columns?.length);

  return useQuery<TableBoundaries>({
    queryKey: [
      "tableBoundaries", 
      tileId, 
      tabId, 
      projectId, 
      context, 
      columnContext, 
      columns
    ],
    queryFn: async () => {
      if (!logsActions || !projectId || !columns || columns.length === 0) {
        throw new Error("Missing required parameters for boundaries query");
      }

      const tStart = performance.now();
      const [minimums, maximums] = await Promise.all([
        getColumnMetrics(
          projectId,
          context || null,
          columnContext || null,
          columns,
          null,
          null,
          "min",
          logsActions
        ) as Promise<TableMetrics>,
        getColumnMetrics(
          projectId,
          context || null,
          columnContext || null,
          columns,
          null,
          null,
          "max",
          logsActions
        ) as Promise<TableMetrics>
      ]);
      const tEnd = performance.now();
      perfLog(`[perf] getColumnMetrics(boundaries) ${callerInfo}: ${(tEnd - tStart).toFixed(2)}ms`);
      
      return { minimums, maximums } as TableBoundaries;
    },
    enabled: isEnabled,
    staleTime: 0,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  });
}

/**
 * Hook for fetching table grouped metrics in the background
 * @param tileId ID of the tile to get grouped metrics for
 * @param tabId ID of the tab containing the tile
 * @param enabled Whether the query should be enabled
 * @param logsActions Actions for fetching logs data
 * @param projectId Project ID for the query
 * @param context Context for the query
 * @param columnContext Column context for the query
 * @param columns Array of column names
 * @param filterExpression Filter expression
 * @param groupingExpression Grouping expression
 * @param metric Metric to calculate
 * @param fields Field definitions for data type checking
 * @param caller Debug string to identify which component called this
 */
export function useTableGroupedMetricsQuery(
  tileId: string | null,
  tabId: string | null,
  enabled: boolean = true,
  logsActions?: LogsActions,
  projectId?: string | null,
  context?: string | null,
  columnContext?: string | null,
  columns?: string[],
  filterExpression?: string | null,
  groupingExpression?: string | null,
  metric?: string,
  fields?: LogFieldsResponseProps,
  caller?: string
) {
  const callerInfo = caller || "unknown";
  const isEnabled = !!(tileId && tabId && enabled && logsActions && projectId && columns?.length && groupingExpression && fields);

  return useQuery<TableGroupedMetrics>({
    queryKey: [
      "tableGroupedMetrics", 
      tileId, 
      tabId, 
      projectId, 
      context, 
      columnContext, 
      columns, 
      filterExpression, 
      groupingExpression,
      metric
    ],
    queryFn: async () => {
      if (!logsActions || !projectId || !columns || columns.length === 0 || !groupingExpression || !fields) {
        throw new Error("Missing required parameters for grouped metrics query");
      }

      const tStart = performance.now();
      const result = await getGroupedMetrics(
        projectId,
        context || null,
        columnContext || null,
        columns,
        filterExpression || null,
        groupingExpression,
        metric || "mean",
        fields,
        logsActions
      ) as TableGroupedMetrics;
      const tEnd = performance.now();
      perfLog(`[perf] getGroupedMetrics(metric: ${metric}) ${callerInfo}: ${(tEnd - tStart).toFixed(2)}ms`);
      return result;
    },
    enabled: isEnabled,
    staleTime: 0,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  });
}

/**
 * Hook for invalidating metrics query and tracking loading state
 * @param tileId ID of the tile
 * @param tabId ID of the tab containing the tile
 * @param projectId Project ID for the query
 * @param context Context for the query
 * @param columnContext Column context for the query
 * @param columns Array of column names
 * @param filterExpression Filter expression
 * @param metric Metric to calculate
 */
export function useInvalidateTableMetrics(
  tileId: string | null,
  tabId: string | null,
  projectId?: string | null,
  context?: string | null,
  columnContext?: string | null,
  columns?: string[],
  filterExpression?: string | null,
  metric?: string
) {
  const queryClient = useQueryClient();

  const resetMetrics = useCallback(() => {
    if (tileId && tabId) {
      // Invalidate the exact query using the same queryKey structure
      queryClient.invalidateQueries({
        queryKey: [
          "tableMetrics", 
          tileId, 
          tabId, 
          projectId, 
          context, 
          columnContext, 
          columns, 
          filterExpression, 
          metric
        ],
        refetchType: 'active'
      });
    }
  }, [queryClient, tileId, tabId, projectId, context, columnContext, columns, filterExpression, metric]);

  return { resetMetrics };
}

/**
 * Hook for invalidating boundaries query and tracking loading state
 * @param tileId ID of the tile
 * @param tabId ID of the tab containing the tile
 * @param projectId Project ID for the query
 * @param context Context for the query
 * @param columnContext Column context for the query
 * @param columns Array of column names
 */
export function useInvalidateTableBoundaries(
  tileId: string | null,
  tabId: string | null,
  projectId?: string | null,
  context?: string | null,
  columnContext?: string | null,
  columns?: string[]
) {
  const queryClient = useQueryClient();

  const resetBoundaries = useCallback(() => {
    if (tileId && tabId) {
      // Invalidate the exact query using the same queryKey structure
      queryClient.invalidateQueries({
        queryKey: [
          "tableBoundaries", 
          tileId, 
          tabId, 
          projectId, 
          context, 
          columnContext, 
          columns
        ],
        refetchType: 'active'
      });
    }
  }, [queryClient, tileId, tabId, projectId, context, columnContext, columns]);

  return { resetBoundaries };
}

/**
 * Hook for invalidating grouped metrics query and tracking loading state
 * @param tileId ID of the tile
 * @param tabId ID of the tab containing the tile
 * @param projectId Project ID for the query
 * @param context Context for the query
 * @param columnContext Column context for the query
 * @param columns Array of column names
 * @param filterExpression Filter expression
 * @param groupingExpression Grouping expression
 * @param metric Metric to calculate
 */
export function useInvalidateTableGroupedMetrics(
  tileId: string | null,
  tabId: string | null,
  projectId?: string | null,
  context?: string | null,
  columnContext?: string | null,
  columns?: string[],
  filterExpression?: string | null,
  groupingExpression?: string | null,
  metric?: string
) {
  const queryClient = useQueryClient();

  const resetGroupedMetrics = useCallback(() => {
    if (tileId && tabId) {
      // Invalidate both top-level and sub-group metrics
      queryClient.invalidateQueries({
        queryKey: [
          "tableGroupedMetrics", 
          tileId, 
          tabId, 
          projectId, 
          context, 
          columnContext, 
          columns, 
          filterExpression, 
          groupingExpression,
          metric
        ],
        refetchType: 'active'
      });
      
      queryClient.invalidateQueries({
        queryKey: ["tableSubGroupMetrics", tileId, tabId],
        refetchType: 'active'
      });
    }
  }, [queryClient, tileId, tabId, projectId, context, columnContext, columns, filterExpression, groupingExpression, metric]);

  return { resetGroupedMetrics };
}
