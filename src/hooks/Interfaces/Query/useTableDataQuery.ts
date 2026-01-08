import { useMutation, useQuery } from '@tanstack/react-query';
import {
  TableBoundaries,
  TableDataItem,
  TableMetrics,
  TableGroupedMetrics,
} from '@/types/interfaces/grid';
import { useQueryClient } from '@tanstack/react-query';
import { useTileData, useTileMeta } from '@/contexts/hooks/tile';
import { LogFieldsResponseProps, TableArguments, LogsResponseProps } from '@/types/interfaces/logs';
import { useTabMeta } from '@/contexts/hooks/tab';
import { useMemo, useEffect, useCallback } from 'react';
import { setDeep } from '@/utils/objectPath';
import { buildAvailableFieldsForTile } from '@/utils/arguments/buildTableArguments';
import { getColumnMetrics, getGroupedMetrics } from '@/utils/interfaces/common';
import { getNewCells, getTotalCountFromLogsResponse } from '@/utils/data/buildTableDataItem';
import {
  maybeConvertRawToGroupedLogs,
  updateGroupedSubRows,
  appendLogsWithWindowing,
  appendGroupedLogsWithWindowing,
  appendGroupSubRowsWithWindowing,
  prependLogsWithWindowing,
  prependGroupedLogsWithWindowing,
  prependGroupSubRowsWithWindowing,
  isGroupedLogs,
  isUngroupedLogs,
} from '@/utils/interfaces/table/grouping';
import { LogsActions } from '@/types/interfaces/grid';
import { LogProps, GroupedLogProps } from '@/types/interfaces/logs';

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
  isLoading: true,
};

/**
 * Hook for accessing table data cached by the server component
 * @param tileId ID of the tile to get data for
 */
export function useTableDataQuery(tileIdOrName: string | null, tabIdOrName: string | null) {
  // Get tile meta information using the useTileMeta hook
  const { tileId } = useTileMeta(tileIdOrName, tabIdOrName || null);

  const queryClient = useQueryClient();

  return useQuery<TableDataItem>({
    queryKey: ['tableDataItem', tileId],
    queryFn: () => {
      // Return cached data if available, otherwise placeholder
      // This queryFn is needed to prevent "No queryFn" errors when React Query
      // attempts to refetch but data was prefetched without a queryFn
      const cached = queryClient.getQueryData<TableDataItem>(['tableDataItem', tileId]);
      return cached ?? EMPTY_TABLEDATAITEM;
    },
    placeholderData: EMPTY_TABLEDATAITEM,
    // The data is prefetched manually on the client
    // Configure staleness to allow re-renders while preventing unnecessary refetches:
    staleTime: 0, // Always consider stale (allows updates)
    gcTime: 15 * 60 * 1000, // Keep in cache for 15 minutes (was 0 - caused data loss!)
    enabled: !!tileId,
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
  tabIdOrName: string | null
) {
  // Get tile meta information using the useTileMeta hook
  const { tileId } = useTileMeta(tileIdOrName, tabIdOrName || null);

  // Base React Query hook
  const {
    data: tableDataItem = EMPTY_TABLEDATAITEM,
    isLoading,
    isError,
    error,
  } = useTableDataQuery(tileIdOrName, tabIdOrName);

  // Use the update mutation hook
  const { mutate: updateTableDataItem } = useUpdateTableDataItem(tileId || '');

  // Function for field-by-field merging (more efficient)
  const mergeUpdatesIntoTableDataItem = useCallback(
    (partialUpdates: Partial<TableDataItem>) => {
      // Use the reactive data which should be fresh with staleTime: 0
      const result: any = { ...tableDataItem };

      // Use the field-by-field merge approach from the original code
      Object.keys(partialUpdates).forEach((key) => {
        const updateKey = key as keyof TableDataItem;
        const updateValue = (partialUpdates as any)[updateKey];
        const currentValue = (tableDataItem as any)[updateKey];

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
    },
    [updateTableDataItem, tableDataItem]
  );

  // Function for deep updating specific logs by row IDs
  const updateLogsByRowIds = useCallback(
    (
      rowIds: string[],
      desc: {
        source: 'entries' | 'params';
        path: (string | number)[];
        newValue: any;
      }
    ) => {
      if (!tileId || rowIds.length === 0) {
        return;
      }

      // Use the reactive data which should be fresh with staleTime: 0
      const currentLogs = tableDataItem.logs;

      if (!currentLogs) {
        return; // safety guard
      }

      const idSet = new Set(rowIds.map(String));

      let changed = false;
      const nextLogs = currentLogs.map((l: any) => {
        if (!idSet.has(String(l.id))) return l;

        const container = desc.source === 'params' ? (l.params ?? {}) : (l.entries ?? {});
        const updated = setDeep(container, desc.path, desc.newValue);

        if (updated === container) return l; // no real change

        changed = true;

        return {
          ...l,
          ...(desc.source === 'params' ? { params: updated } : { entries: updated }),
        };
      });

      if (!changed) {
        return; // nothing mutated
      }

      // Guard: avoid clobbering entire container if path is empty
      if (desc.path.length === 0) {
        console.warn(
          '[DEBUG] updateLogsByRowIds – empty path, skipping to avoid overwriting container',
          { desc }
        );
        return;
      }

      // Update the entire logs array using our existing updateTableDataItem function
      updateTableDataItem({
        ...tableDataItem,
        logs: nextLogs,
      });
    },
    [tileId, updateTableDataItem, tableDataItem]
  );

  // Function for updating logs from logsActions.get response
  // Supports both top-level and targeted group updates with replace/append/prepend modes:
  // - When targetGroupId and groupFilters are provided, updates/appends at specific group location
  // - When no targeting provided, handles simple top-level replace/append/prepend scenarios
  // - Uses updateGroupedSubRows for targeted replace, appendToGroupSubRows for targeted append/prepend
  // - Supports sliding window management for bidirectional infinite loading
  const updateLogs = useCallback(
    (
      logsData: LogsResponseProps,
      mode: 'replace' | 'append' | 'prepend' = 'replace',
      targetGroupId?: string | null, // For grouped Load More scenarios
      targetGroupFilters?: [string, string][], // For targeting specific subrows
      preConvertedLogs?: GroupedLogProps[] | LogProps[], // Optional pre-converted logs to avoid double conversion
      windowConfig?: {
        maxPagesInMemory: number;
        pageSize: number;
        currentPageCount: number; // Current number of pages in memory
      },
      currentOffsets?: { globalOffset: number; groupOffset: number } // Previous offsets to build upon
    ): { globalOffset: number; groupOffset: number } => {
      if (!tileId) {
        return { globalOffset: 0, groupOffset: 0 };
      }

      // Initialize offsets - use previous offsets if provided, otherwise start at 0
      let globalOffset = currentOffsets?.globalOffset || 0;
      let groupOffset = currentOffsets?.groupOffset || 0;

      // Use the reactive data which should be fresh with staleTime: 0
      const currentTableDataItem = tableDataItem;

      // Convert raw logs using the same logic as onGroupExpand
      const newLogs =
        preConvertedLogs ||
        maybeConvertRawToGroupedLogs(logsData.params, logsData.logs, targetGroupId);

      // Calculate new cells by comparing with existing logs
      const previousLogs = currentTableDataItem.logs;
      const newCells = getNewCells(previousLogs, newLogs);

      // Extract error from logsData
      const error = 'detail' in logsData ? logsData['detail'] : undefined;

      // Check log types once at the beginning to avoid redundancy
      const currentLogs = currentTableDataItem.logs;
      const isCurrentGrouped = isGroupedLogs(currentLogs);
      const isCurrentUngrouped = isUngroupedLogs(currentLogs);
      const isNewGrouped = isGroupedLogs(newLogs);
      const isNewUngrouped = isUngroupedLogs(newLogs);

      // Determine final logs based on mode and scenario
      let finalLogs: LogProps[] | GroupedLogProps[] = newLogs; // Default to newLogs

      // Branch 1: If we have targeting information (targetGroupId and groupFilters)
      if (targetGroupId && targetGroupFilters && targetGroupFilters.length > 0) {
        // Targeting only makes sense with grouped logs
        if (isCurrentGrouped) {
          if (mode === 'replace') {
            // Replace mode with targeting - replace at specific location using updateGroupedSubRows
            // Pass pre-converted logs to avoid double conversion
            finalLogs = updateGroupedSubRows(
              currentLogs as GroupedLogProps[],
              logsData, // Pass the original LogsResponseProps for totalChildren calculation
              targetGroupFilters,
              targetGroupId,
              newLogs // Pass pre-converted logs to avoid double conversion
            );
          } else if (mode === 'append') {
            // Append mode with targeting - use consolidated append utility
            const totalCount = getTotalCountFromLogsResponse(logsData) || 0;
            const result = appendGroupSubRowsWithWindowing(
              currentLogs as GroupedLogProps[],
              newLogs as GroupedLogProps[] | LogProps[],
              targetGroupFilters,
              windowConfig,
              groupOffset,
              totalCount
            );
            finalLogs = result.logs;
            groupOffset = result.groupOffset;
          } else if (mode === 'prepend') {
            // Prepend mode with targeting - prepend at specific location using prependToGroupedSubRows
            // Use consolidated prepend utility that handles everything in one go
            const totalCount = getTotalCountFromLogsResponse(logsData) || 0;
            const result = prependGroupSubRowsWithWindowing(
              currentLogs as GroupedLogProps[],
              newLogs as GroupedLogProps[] | LogProps[],
              targetGroupFilters,
              windowConfig,
              groupOffset,
              totalCount
            );
            finalLogs = result.logs;
            groupOffset = result.groupOffset;
          } else {
            // Unknown mode fallback
            finalLogs = newLogs;
          }
        } else {
          // Targeting requested but logs are ungrouped - warn and fallback
          console.warn(
            '[DEBUG] updateLogs: targeting requested but existing logs are ungrouped, falling back to simple operation'
          );
          if (mode === 'replace') {
            finalLogs = newLogs;
          } else if (mode === 'append') {
            // For ungrouped logs, use consolidated append utility
            if (isCurrentUngrouped && isNewUngrouped) {
              const totalCount = getTotalCountFromLogsResponse(logsData) || 0;
              const result = appendLogsWithWindowing(
                currentLogs as LogProps[],
                newLogs as LogProps[],
                windowConfig,
                globalOffset,
                totalCount
              );
              finalLogs = result.logs;
              globalOffset = result.offset;
            } else {
              finalLogs = newLogs; // If new logs are grouped, replace instead
            }
          } else if (mode === 'prepend') {
            // For ungrouped logs, just prepend if both are ungrouped
            if (isNewUngrouped) {
              // Use consolidated prepend utility that handles everything in one go
              const totalCount = getTotalCountFromLogsResponse(logsData) || 0;
              const result = prependLogsWithWindowing(
                currentLogs as LogProps[],
                newLogs as LogProps[],
                windowConfig,
                globalOffset,
                totalCount
              );
              finalLogs = result.logs;
              globalOffset = result.offset;
            } else {
              finalLogs = newLogs; // If new logs are grouped, replace instead
            }
          } else {
            // Unknown mode fallback
            finalLogs = newLogs;
          }
        }
      }
      // Branch 2: No targeting - handle simple scenarios
      else {
        // Handle ungrouped current logs
        if (isCurrentUngrouped) {
          if (mode === 'replace') {
            // Replace mode: simply use new logs
            finalLogs = newLogs;
          } else if (mode === 'append') {
            // Append mode: use consolidated append utility if new logs are also ungrouped
            if (isNewUngrouped) {
              const totalCount = getTotalCountFromLogsResponse(logsData) || 0;
              const result = appendLogsWithWindowing(
                currentLogs as LogProps[],
                newLogs as LogProps[],
                windowConfig,
                globalOffset,
                totalCount
              );
              finalLogs = result.logs;
              globalOffset = result.offset;
            } else {
              finalLogs = newLogs; // If new logs are grouped, replace instead
            }
          } else if (mode === 'prepend') {
            // Prepend mode: prepend if new logs are also ungrouped
            if (isNewUngrouped) {
              // Use consolidated prepend utility that handles everything in one go
              const totalCount = getTotalCountFromLogsResponse(logsData) || 0;
              const result = prependLogsWithWindowing(
                currentLogs as LogProps[],
                newLogs as LogProps[],
                windowConfig,
                globalOffset,
                totalCount
              );
              finalLogs = result.logs;
              globalOffset = result.offset;
            } else {
              finalLogs = newLogs; // If new logs are grouped, replace instead
            }
          } else {
            // Unknown mode fallback
            finalLogs = newLogs;
          }
        }
        // Handle grouped current logs
        else if (isCurrentGrouped) {
          if (mode === 'replace') {
            // Replace mode: simply use new logs
            finalLogs = newLogs;
          } else if (mode === 'append') {
            // Append mode: merge at top level if new logs are also grouped
            if (isNewGrouped) {
              const totalCount = getTotalCountFromLogsResponse(logsData) || 0;
              const result = appendGroupedLogsWithWindowing(
                currentLogs as GroupedLogProps[],
                newLogs as GroupedLogProps[],
                windowConfig,
                globalOffset,
                totalCount
              );
              finalLogs = result.logs;
              globalOffset = result.offset;
            } else {
              // If new logs are ungrouped but current are grouped, can't meaningfully append
              console.warn(
                '[DEBUG] updateLogs: append mode but cannot merge ungrouped newLogs with grouped currentLogs, keeping currentLogs'
              );
              finalLogs = currentLogs;
            }
          } else if (mode === 'prepend') {
            // Prepend mode: for grouped logs, prepend at top level if new logs are also grouped
            if (isNewGrouped) {
              // For prepend, we reverse the order compared to append
              // Use consolidated prepend utility that handles everything in one go
              const totalCount = getTotalCountFromLogsResponse(logsData) || 0;
              const result = prependGroupedLogsWithWindowing(
                currentLogs as GroupedLogProps[],
                newLogs as GroupedLogProps[],
                windowConfig,
                globalOffset,
                totalCount
              );
              finalLogs = result.logs;
              globalOffset = result.offset;
            } else {
              // If new logs are ungrouped but current are grouped, can't meaningfully prepend
              console.warn(
                '[DEBUG] updateLogs: prepend mode but cannot merge ungrouped newLogs with grouped currentLogs, keeping currentLogs'
              );
              finalLogs = currentLogs;
            }
          } else {
            // Unknown mode fallback
            finalLogs = newLogs;
          }
        }
        // Fallback for edge cases (neither grouped nor ungrouped)
        else {
          console.error(
            '[DEBUG] updateLogs: currentLogs are neither grouped nor ungrouped, using newLogs as fallback'
          );
          finalLogs = newLogs;
        }
      }

      // Update the table data item
      updateTableDataItem({
        ...currentTableDataItem,
        logs: finalLogs,
        params: logsData.params,
        newCells,
        error,
      });

      // Return the calculated offsets (boundary guards are applied within utility functions)
      return { globalOffset, groupOffset };
    },
    [tileId, updateTableDataItem, tableDataItem]
  );

  // Adapter that accepts an updater function as well as partial updates
  const updateTableDataItemWithUpdater = useCallback(
    (
      updater?: (prev: TableDataItem) => TableDataItem,
      partialUpdates?: Partial<TableDataItem>,
      merge?: boolean
    ) => {
      const deferringFn = merge ? mergeUpdatesIntoTableDataItem : updateTableDataItem;

      if (updater) {
        if (partialUpdates) {
          deferringFn(partialUpdates as TableDataItem);
        } else {
          // Use the reactive data which should be fresh with staleTime: 0
          deferringFn(updater(tableDataItem));
        }
      } else if (partialUpdates) {
        deferringFn(partialUpdates as TableDataItem);
      }
    },
    [mergeUpdatesIntoTableDataItem, updateTableDataItem, tableDataItem]
  );

  // Return the actual query data for reactivity
  return {
    tableData: tableDataItem,
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
  interfaceIdOrName?: string | null
) {
  // Get tab meta information using the useTabMeta hook
  const { tabId } = useTabMeta(tabIdOrName, interfaceIdOrName || null);
  const queryClient = useQueryClient();

  return useQuery<TableArguments>({
    queryKey: ['tableArguments', tabId],
    queryFn: () => {
      // Return cached data if available, otherwise empty object
      // This queryFn is needed to prevent "No queryFn" errors when React Query
      // attempts to refetch but data was prefetched without a queryFn
      const cached = queryClient.getQueryData<TableArguments>(['tableArguments', tabId]);
      return cached ?? ({} as TableArguments);
    },
    // No stale time or gc time for table arguments
    staleTime: 0,
    gcTime: 0,
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
  interfaceIdOrName?: string | null
) {
  const queryClient = useQueryClient();

  // Get tab meta information using the useTabMeta hook
  const { tabId } = useTabMeta(tabIdOrName, interfaceIdOrName || null);
  const { meta: tileMetaState } = useTileMeta(tileIdOrName, tabIdOrName || null);
  const { data: tileDataState } = useTileData(tileIdOrName, tabIdOrName || null);

  const availableFields = useMemo(
    () =>
      buildAvailableFieldsForTile(
        tileDataState?.columnContext ?? '',
        fields,
        entriesProperties,
        paramsProperties
      ),
    [tileDataState?.columnContext, fields, entriesProperties, paramsProperties]
  );

  const tileName = tileMetaState?.name;

  useEffect(() => {
    if (!tabId || !tileName) return;

    queryClient.setQueryData<TableArguments>(
      ['tableArguments', tabId],
      (prev = {} as TableArguments) => ({
        ...prev,
        [tileName]: {
          ...prev[tileName],
          availableFields: availableFields,
        },
      })
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

  return useMutation<
    TableDataItem,
    Error,
    Partial<TableDataItem>,
    { previousData?: TableDataItem }
  >({
    mutationFn: async (newData) => {
      // Simulating API response - in real app this would make an API call
      return {
        ...(queryClient.getQueryData<TableDataItem>(['tableDataItem', tileId]) || {}),
        ...newData,
      } as TableDataItem;
    },

    // When mutate is called:
    onMutate: async (newData) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['tableDataItem', tileId] });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<TableDataItem>(['tableDataItem', tileId]);

      // Optimistically update to the new value
      queryClient.setQueryData<TableDataItem>(
        ['tableDataItem', tileId],
        (old) =>
          ({
            ...(old || {}),
            ...newData,
          }) as TableDataItem
      );

      // Return a context object with the snapshotted value
      return { previousData };
    },

    // If mutation fails, use the context returned from onMutate to roll back
    onError: (err, newData, context) => {
      console.error('Error updating table data:', err);
      queryClient.setQueryData(['tableDataItem', tileId], context?.previousData);
    },

    // Always invalidate to ensure cache consistency and trigger re-renders
    onSettled: () => {
      // Invalidate the main query to ensure it's marked as stale
      queryClient.invalidateQueries({
        queryKey: ['tableDataItem', tileId],
        refetchType: 'none', // Don't refetch, just mark as stale
      });

      // Also invalidate the auto-update query if it exists
      queryClient.invalidateQueries({
        queryKey: ['tableDataItem', 'autoUpdate', tileId],
        refetchType: 'none',
      });
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
  const callerInfo = caller || 'unknown';
  const isEnabled = !!(tileId && tabId && enabled && logsActions && projectId && columns?.length);

  return useQuery<TableMetrics>({
    queryKey: [
      'tableMetrics',
      tileId,
      tabId,
      projectId,
      context,
      columnContext,
      columns,
      filterExpression,
      metric,
    ],
    queryFn: async () => {
      if (!logsActions || !projectId || !columns || columns.length === 0) {
        throw new Error('Missing required parameters for metrics query');
      }

      const tStart = performance.now();
      const result = (await getColumnMetrics(
        projectId,
        context || null,
        columnContext || null,
        columns,
        filterExpression || null,
        null,
        metric || 'mean',
        logsActions
      )) as TableMetrics;
      const tEnd = performance.now();
      perfLog(
        `[pref] getColumnMetrics(metric: ${metric}) ${callerInfo}: ${(tEnd - tStart).toFixed(2)}ms`
      );
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
  const callerInfo = caller || 'unknown';
  const isEnabled = !!(tileId && tabId && enabled && logsActions && projectId && columns?.length);

  return useQuery<TableBoundaries>({
    queryKey: ['tableBoundaries', tileId, tabId, projectId, context, columnContext, columns],
    queryFn: async () => {
      if (!logsActions || !projectId || !columns || columns.length === 0) {
        throw new Error('Missing required parameters for boundaries query');
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
          'min',
          logsActions
        ) as Promise<TableMetrics>,
        getColumnMetrics(
          projectId,
          context || null,
          columnContext || null,
          columns,
          null,
          null,
          'max',
          logsActions
        ) as Promise<TableMetrics>,
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
  const callerInfo = caller || 'unknown';
  const isEnabled = !!(
    tileId &&
    tabId &&
    enabled &&
    logsActions &&
    projectId &&
    columns?.length &&
    groupingExpression &&
    fields
  );

  return useQuery<TableGroupedMetrics>({
    queryKey: [
      'tableGroupedMetrics',
      tileId,
      tabId,
      projectId,
      context,
      columnContext,
      columns,
      filterExpression,
      groupingExpression,
      metric,
    ],
    queryFn: async () => {
      if (
        !logsActions ||
        !projectId ||
        !columns ||
        columns.length === 0 ||
        !groupingExpression ||
        !fields
      ) {
        throw new Error('Missing required parameters for grouped metrics query');
      }

      const tStart = performance.now();
      const result = (await getGroupedMetrics(
        projectId,
        context || null,
        columnContext || null,
        columns,
        filterExpression || null,
        groupingExpression,
        metric || 'mean',
        fields,
        logsActions
      )) as TableGroupedMetrics;
      const tEnd = performance.now();
      perfLog(
        `[perf] getGroupedMetrics(metric: ${metric}) ${callerInfo}: ${(tEnd - tStart).toFixed(2)}ms`
      );
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
          'tableMetrics',
          tileId,
          tabId,
          projectId,
          context,
          columnContext,
          columns,
          filterExpression,
          metric,
        ],
        refetchType: 'active',
      });
    }
  }, [
    queryClient,
    tileId,
    tabId,
    projectId,
    context,
    columnContext,
    columns,
    filterExpression,
    metric,
  ]);

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
        queryKey: ['tableBoundaries', tileId, tabId, projectId, context, columnContext, columns],
        refetchType: 'active',
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
          'tableGroupedMetrics',
          tileId,
          tabId,
          projectId,
          context,
          columnContext,
          columns,
          filterExpression,
          groupingExpression,
          metric,
        ],
        refetchType: 'active',
      });

      queryClient.invalidateQueries({
        queryKey: ['tableSubGroupMetrics', tileId, tabId],
        refetchType: 'active',
      });
    }
  }, [
    queryClient,
    tileId,
    tabId,
    projectId,
    context,
    columnContext,
    columns,
    filterExpression,
    groupingExpression,
    metric,
  ]);

  return { resetGroupedMetrics };
}
