import { LogProps, GroupedLogProps, LogFieldsResponseProps, GroupedLogPropsRaw, LogItemProps, LogsResponseProps } from "@/types/evals/logs";
import { TileProps, LogsActions, TableDataItem } from "@/types/evals/grid";
import { sanitizeId } from "@/utils/evals/columnOperations";
import { FiltersByColumn } from "@/types/evals/columns";
import { combineFilters, filtersToExpression } from "./filters";
import { getColumnMetrics } from "./common";
import { showErrorToast } from "@/components/notifications";
import { QueryClient } from "@tanstack/react-query";

/*
  Utility functions to check grouping types
*/
function isEntriesGroup(groupingColumnId: string): boolean {
  return groupingColumnId.startsWith("Entries");
}

function isParamsGroup(groupingColumnId: string): boolean {
  return groupingColumnId.startsWith("Parameters");
}

/*
  Convert a GroupedLogPropsRaw object into an array of GroupedLogProps. This is needed for the 
  table to render manually grouped logs.

  Each top-level key in `raw` is treated as a "grouping column."
  The value under that key is an object whose keys are grouping values
  (like "0", "1", "hello"), each mapping either to:
    - an array of final logs (LogProps[]), or
    - a deeper grouping object (another GroupedLogPropsRaw).

  If there's only one grouping column, you'll get a single GroupedLogProps
  in the returned array. If there are multiple grouping columns at the 
  top level, you'll get multiple siblings in the array.
*/
export function maybeConvertRawToGroupedLogs(
    params: LogItemProps,
    rawGroupedLogs: GroupedLogPropsRaw | LogProps[],
    parentId: string | null = null
): GroupedLogProps[] | LogProps[] {

    // If raw is an array of LogProps (no more grouping needed), return it with type "ungrouped"
    if (Array.isArray(rawGroupedLogs)) {
        return rawGroupedLogs.map(log => ({
            ...log,
            type: "ungrouped",
            entries: {...log.entries, ...log.derived_entries},  // Bundle derived entries with entries
        }));
    }

    // Find the first grouping column in the raw data
    const groupingColumnId = Object.keys(rawGroupedLogs).find(key => 
        key !== 'group_count' && key !== 'count'
    );

    if (!groupingColumnId) {
        return [];
    }

    const rawGroupedLogsForGroupingColumn = rawGroupedLogs[groupingColumnId] as Exclude<GroupedLogPropsRaw[keyof GroupedLogPropsRaw], number | undefined>;
    const groups = rawGroupedLogsForGroupingColumn!.group;

    let groupingIndex = 0;

    return groups.map((group) => {
            const [groupValue, count] = [group.key, group.value]
            let id = `${groupingColumnId}:${groupValue}`;
            if (parentId)
              id = `${parentId}>${id}`;

            const isEntries = isEntriesGroup(groupingColumnId);
            const isParams = isParamsGroup(groupingColumnId);

            // Assign groupingIndex for entries/params groups
            // 1. For Entries Group, increment the arbitrarily increasing index
            // 2. For Params Group, assign the version number as the index

            // Helper to find paramVersion recursively
            const findParamVersion = (paramsObj: any, keys: string[], value: string): string | undefined => {
              let current = paramsObj;
              for (const key of keys) {
                  if (current && typeof current === "object") {
                      current = current[key];
                  } else {
                      return undefined; // Key not found
                  }
              }
              if (current && typeof current === "object") {
                  const version = Object.entries(current).find(([k, v]) => v === value);
                  return version ? version[0] : undefined;
              }
              return undefined;
            };

            // Calculate groupingIndex
            let currentGroupingIndex: number | undefined = undefined;
            if (isEntries) {
                currentGroupingIndex = groupingIndex++;
            } else if (isParams) {
                const sanitizedColumn = sanitizeId(groupingColumnId); // e.g., "store_type" or "season/warm"
                const pathKeys = sanitizedColumn.split("/");          // Handle nested params
                const paramVersion = findParamVersion(params, pathKeys, groupValue);
                currentGroupingIndex = paramVersion ? parseInt(paramVersion, 10) : undefined;
            }

            const groupNode = {
                type: "grouped",
                id,
                groupingColumnId,
                groupingIndex: currentGroupingIndex,
                [groupingColumnId]: groupValue,
                subRows: [],  // Initially empty, will be populated when expanded
                isPopulated: false,
                groupCount: count,
            } as GroupedLogProps;

            return groupNode;
        });
}

/*
  Efficiently updates the subRows of a specific group in a nested grouping structure with new data.

  existingLogs - The current nested group structure (GroupedLogProps[])
  newLogs - The newly fetched group data to insert as subRows
  targetGroupFilters - Array of [column, value] pairs identifying the target group
                (e.g., [["gender", "female"]] to identify the "female" gender group)
  returns Updated group structure with the new subRows inserted at the correct location
*/
/*
  Consolidated utility that efficiently updates both subRows and totalChildren field of a specific group 
  in a nested grouping structure in a single pass.

  existingLogs - The current nested group structure (GroupedLogProps[])
  newLogsData - The newly fetched logs response data containing count information
  targetGroupFilters - Array of [column, value] pairs identifying the target group
  returns Updated group structure with both subRows and totalChildren updated
*/
export function updateGroupedSubRows(
  existingLogs: GroupedLogProps[],
  newLogsData: LogsResponseProps,
  targetGroupFilters: [string, string][],
  parentId?: string,
  preConvertedLogs?: GroupedLogProps[] | LogProps[] // Optional pre-converted logs to avoid double conversion
): GroupedLogProps[] {
  // Use pre-converted logs if provided, otherwise convert now
  const convertedNewLogs = preConvertedLogs || maybeConvertRawToGroupedLogs(
    newLogsData.params,
    newLogsData.logs,
    parentId // parentId will be set by the conversion function based on filters
  );

  // Calculate totalChildren once at the beginning
  const calculateTotalChildren = (): number => {
    if (Array.isArray(newLogsData.logs)) {
      // Ungrouped children - use count from response
      return newLogsData.count;
    } else {
      // Grouped children - extract group_count from GroupedLogPropsRaw
      const groupedRawLogs = newLogsData.logs as GroupedLogPropsRaw;
      const firstGroupKey = Object.keys(groupedRawLogs).find(key => 
        typeof groupedRawLogs[key] === 'object' && groupedRawLogs[key]?.group_count
      );
      return firstGroupKey ? (groupedRawLogs[firstGroupKey] as any).group_count : 0;
    }
  };

  const totalChildren = calculateTotalChildren();
  const isNewLogsGrouped = isGroupedLogs(convertedNewLogs);

  /*
    Consolidated recursive function that finds and updates both subRows and totalChildren 
    in a single pass without deep cloning the entire structure.
    It immutably updates only the affected nodes.
   
    logs - Current level of grouped logs
    filters - Remaining filters to identify the nested group
    returns Updated logs with both subRows and totalChildren updated
  */
  function findAndUpdateGroup(
    logs: GroupedLogProps[],
    targetFilters: [string, string][]
  ): GroupedLogProps[] {
    if (targetFilters.length === 0) return logs;

    let [currentColumn, currentValue] = targetFilters[0];

    return logs.map((log) => {
      // Check if this log matches the current filter condition
      if (sanitizeId(log.groupingColumnId) === currentColumn && log[log.groupingColumnId] === currentValue) {
        if (targetFilters.length === 1) {
          // Target group found - update both totalChildren and subRows in one go
          const updates: Partial<GroupedLogProps> = {
            totalChildren: totalChildren
          };

          // Only update subRows if not already populated
          if (!log.isPopulated) {
            updates.subRows = isNewLogsGrouped ? (convertedNewLogs as GroupedLogProps[]) : (convertedNewLogs as LogProps[]);
            updates.isPopulated = true;
          }

          return {
            ...log,
            ...updates
          };
        } else if (Array.isArray(log.subRows)) {
          // Recursively update subRows for deeper levels
          return {
            ...log,
            subRows: findAndUpdateGroup(log.subRows as GroupedLogProps[], targetFilters.slice(1))
          };
        }
      }
      return log; // Return unchanged if not matched
    });
  }

  return findAndUpdateGroup(existingLogs, targetGroupFilters);
}

/*
  Type guards to distinguish between LogProps and GroupedLogProps using the type field.
*/
export function isLogProps(logProp: LogProps | GroupedLogProps): logProp is LogProps {
  return logProp.type === "ungrouped";
}

export function isGroupedLogProps(logProp: LogProps | GroupedLogProps): logProp is GroupedLogProps {
  return logProp.type === "grouped";
}

/**
 * Type guards for distinguishing between grouped and ungrouped logs
 */

/**
 * Type guard for GroupedLogPropsRaw format (object with group data)
 */
export function isGroupedLogPropsRaw(logs: GroupedLogPropsRaw | LogProps[] | GroupedLogProps[]): logs is GroupedLogPropsRaw {
  return typeof logs === 'object' && !Array.isArray(logs) && logs !== null;
}

/**
 * Type guard for any grouped logs format (either GroupedLogProps[] or GroupedLogPropsRaw)
 */
export function isGroupedLogs(logs: GroupedLogPropsRaw | LogProps[] | GroupedLogProps[]): logs is GroupedLogProps[] | GroupedLogPropsRaw {
  return isGroupedLogPropsRaw(logs) || (Array.isArray(logs) && logs.length > 0 && isGroupedLogProps(logs[0]));
}

/**
 * Type guard for ungrouped logs (only LogProps[])
 */
export function isUngroupedLogs(logs: GroupedLogPropsRaw | LogProps[] | GroupedLogProps[]): logs is LogProps[] {
  return Array.isArray(logs) && logs.length > 0 && isLogProps(logs[0]);
};

/**
 * Recursively traverses items and pushes all LogProps into 'output'.
 */
function recurseFlatten(
  logProps: LogProps[] | GroupedLogProps[],
  output: LogProps[]
): void {
  for (const logProp of logProps) {
    if (isLogProps(logProp)) {
      // It's a LogProps, add it to output
      output.push(logProp);
    } else if (isGroupedLogProps(logProp)) {
      // It's a GroupedLogProps
      // Only flatten subRows if isPopulated = true
      if (logProp.isPopulated) {
        recurseFlatten(logProp.subRows, output);
      }
      // If not populated, we skip because there's nothing to flatten yet
    } else {
      console.warn("Encountered an item that is neither LogProps nor GroupedLogProps:", logProp);
    }
  }
}

/*
  Takes an array that could be either LogProps[] or GroupedLogProps[] and returns LogProps[].
  If the input is already LogProps[], returns it as is.
  If it's GroupedLogProps[], flattens it recursively into LogProps[].
*/
export function maybeFlattenGroupedLogs(
  logProps?: LogProps[] | GroupedLogProps[]
): LogProps[] {
  if (!logProps || !Array.isArray(logProps) || logProps.length === 0) {
    return [];
  }
  const flattened: LogProps[] = [];
  recurseFlatten(logProps, flattened);
  return flattened;
}

export function getGroupingFilters(
  filterExpression: string | null,
  groupingColumnId: string,
  groupingValue: string,
  parentId: string | null,
  dataTypes: { [key: string]: string },
  fields: LogFieldsResponseProps,
) {
  // Helper: Cast values based on data type
  const castValue = (value: string, dataType: string) => {
    switch (dataType) {
      case "int":
        return parseInt(value, 10).toString();
      case "float":
        const num = parseFloat(value);
        return num.toString().includes('.') ? num.toString() : num.toFixed(1);
      case "timestamp":
        return value.startsWith('"') && value.endsWith('"') ? value : `"${value}"`;
      case "bool":
        return value === "true" ? "True" : value === "false" ? "False" : value
      default:
        return value.startsWith('"') && value.endsWith('"') ? value : `"${value}"`;
    }
  };

  // Generate the current ID for the expanding row
  let currentId = `${groupingColumnId}:${groupingValue}`;
  if (parentId) {
    currentId = `${parentId}>${currentId}`;
  }

  // Step 1: Build FiltersByColumn Structure
  const columnFilters: FiltersByColumn = {};
  let filterKeyCounter = 0;

  const handleFilter = (col: string, val: string) => {
    const sanitizedCol = sanitizeId(col);
    const dataType = dataTypes[sanitizedCol] || "str";

    if (val == "null") {
      return {
        key: filterKeyCounter++,
        mode: "exists",
        join: "&&" as "&&" | "||",
        value: "false",
        column: sanitizedCol,
      };
    } else {
      const castedValue = castValue(val, dataType);
      return {
        key: filterKeyCounter++,
        mode: "==",
        join: "&&" as "&&" | "||",
        value: castedValue,
        column: sanitizedCol,
      };
    }
  };

  // Handle Parent Filters (if any)
  if (parentId) {
    // Parse parent ID path to build filter parts
    // Format: "column1:value1>column2:value2>..."
    const parentFilters = parentId.split('>').map((part) => {
      const [col, val] = part.split(":");
      return handleFilter(col, val);
    });

    parentFilters.forEach((filter) => {
      const combinedFilter = combineFilters(
        [{ key: filter.key, mode: filter.mode, join: filter.join, value: filter.value }],
        [filter.mode]
      );

      columnFilters[filter.column] = {
        ...(columnFilters[filter.column] || {}),
        ...combinedFilter,
      };
    });
  }

  // Add current group filter
  const currentGroupFilter = handleFilter(groupingColumnId, groupingValue);

  const combinedCurrentFilter = combineFilters(
    [{ key: currentGroupFilter.key, mode: currentGroupFilter.mode, join: currentGroupFilter.join, value: currentGroupFilter.value }],
    [currentGroupFilter.mode]
  );

  const sanitizedGroupingColumnId = sanitizeId(groupingColumnId);
  columnFilters[sanitizedGroupingColumnId] = {
    ...(columnFilters[sanitizedGroupingColumnId] || {}),
    ...combinedCurrentFilter,
  };

  // Step 2: Generate Filter Expression
  const groupFilterExpression = filtersToExpression(columnFilters, fields);

  // Step 3: Combine with Existing Filters
  const updatedFilterExpression = filterExpression
    ? `${filterExpression} and ${groupFilterExpression}`
    : groupFilterExpression;

  return { currentId, updatedFilterExpression, columnFilters };
}

/*
  Get the filters for a specific target group.
*/
export function getTargetGroupFilters(columnFilters: FiltersByColumn) {
  const targetGroupFilters: [string, string][] = [];
  Object.entries(columnFilters).forEach(([cKey, filter]) => {
    const [fn, value] = Object.entries(filter)[0];
    let effectiveValue = value;

    // Remove "&&" or "||" with surrounding spaces
    effectiveValue = effectiveValue?.replace(/\s*(&&|\|\|)\s*/g, '').trim();

    // Trim the outer quotes if they exist
    if (effectiveValue.startsWith('"') && effectiveValue.endsWith('"')) {
      effectiveValue = effectiveValue.slice(1, -1);
    }
    // Convert null values to "null"
    if (fn === "exists") {
      effectiveValue = "null";
    }
    targetGroupFilters.push([cKey, effectiveValue] as [string, string]);
  });
  return targetGroupFilters;
}

export function getUpdatedGroupingExpression(
  groupingExpression: string | null,
  groupingColumnId: string,
) {
  // Get the current grouping expression
  const currentGrouping = groupingExpression?.split(",") || [];
    
  // Find the index of the current grouping column
  const currentIndex = currentGrouping.indexOf(groupingColumnId);
  
  // Get the remaining grouping columns after the current one
  const remainingGrouping = currentGrouping.slice(currentIndex + 1);
  const updatedGroupingExpression = remainingGrouping.length > 0 ? remainingGrouping.join(",") : null;
  return updatedGroupingExpression;
}

export async function onGroupExpand(
  rowId: string,
  groupingColumnId: string,
  groupingValue: string,
  parentId: string | null,
  tileId: string,
  tabId: string,
  project: string,
  context: string | null,
  columnContext: string | null,
  filterExpression: string | null,
  sortingExpression: string | null,
  groupingExpression: string | null,
  groupSortingExpression: string | null,
  limit: number,
  offset: number,
  group_limit: number,
  group_offset: number,
  logsActions: LogsActions,
  setExpandingRowId: (id: string | null) => void,
  updateTableDataItem: (updater?: (prev: TableDataItem) => TableDataItem, partialUpdates?: Partial<TableDataItem>, merge?: boolean) => void,
  dataTypes: { [key: string]: string },
  fields: LogFieldsResponseProps,
  logs: LogProps[] | GroupedLogProps[],
  queryClient: QueryClient,
  columns: string[],
  metric: string
): Promise<void> {
  try {
    const { currentId, columnFilters } = getGroupingFilters(
      filterExpression, groupingColumnId, groupingValue, parentId, dataTypes, fields
    );

    setExpandingRowId(currentId);

    // Use the consolidated core function for fetching
    const { fetchLogsCore } = await import("./logsCore");
    
    const coreParams = {
      projectId: project,
      context,
      columnContext,
      filterExpression,
      sortingExpression,
      groupingExpression,
      groupSortingExpression,
      limit,
      offset,
      group_limit,
      group_offset,
      logsActions,
      groupId: currentId,
      groupingColumnId,
      groupingValue,
      parentId,
      dataTypes,
      fields
    };

    const coreResult = await fetchLogsCore(coreParams);
    const freshLogsData = coreResult.response;

    // Fetch sub-group metrics if there's remaining grouping
    if (coreResult.updatedGroupingExpression && queryClient && tileId && tabId && columns?.length) {
      try {
        const numericColumns = columns.filter(col => ["int", "float", "timestamp", "time", "date", "timedelta", "bool"].includes(fields?.[col]?.data_type));
        const effectiveMetric = metric || "mean";
        const subGroupingColumnId = coreResult.updatedGroupingExpression!.split(",")[0];
        
        // Fetch sub-group metrics
        const metricsData = await getColumnMetrics(
          project,
          context,
          columnContext,
          numericColumns,
          coreResult.updatedFilterExpression || null,
          subGroupingColumnId,
          effectiveMetric,
          logsActions
        ) as { [key: string]: { [key: string]: { [key: string]: number | string } } };
        
        const metrics = Object.fromEntries(
          Object.entries(metricsData).filter(([col, _]) => numericColumns.includes(col)).map(
            ([col, groups]) => [col, Object.fromEntries(Object.entries(groups).map(
              ([groupingVal, results]) => [groupingVal, results[effectiveMetric]]
            ))]
        ));
        const sharedValues = Object.fromEntries(
          Object.entries(metricsData).map(
            ([col, groups]) => [col, Object.fromEntries(Object.entries(groups).map(
              ([groupingVal, results]) => [groupingVal, results["shared_value"]]
            ))]
        ));

        // Get the existing table grouped metrics from cache
        const tableGroupedMetricsQueryKey = [
          "tableGroupedMetrics", 
          tileId, 
          tabId, 
          project, 
          context, 
          columnContext, 
          columns, 
          filterExpression, 
          groupingExpression,
          metric
        ];
        
        const existingMetrics = queryClient.getQueryData(tableGroupedMetricsQueryKey) as any || {};
        
        // Create the sub-group metrics indexed by rowId
        const subGroupMetrics = {
          [rowId]: {
            [effectiveMetric]: metrics,
            shared_value: sharedValues,
          }
        };
        
        // Merge existing metrics with new sub-group metrics
        const mergedMetrics = {
          ...existingMetrics,
          ...subGroupMetrics
        };
        
        // Set the merged metrics back to the cache
        queryClient.setQueryData(tableGroupedMetricsQueryKey, mergedMetrics);
        
      } catch (error) {
        console.warn("Failed to fetch sub-group metrics:", error);
        // Continue with log expansion even if metrics fetch fails
      }
    }

    // Update the logs based on whether we have LogProps[] or GroupedLogProps[]
    let updatedLogs: GroupedLogProps[];

    // If we have GroupedLogProps[], use updateGroupedSubRows
    // This will handle both subRows update and totalChildren update
    updatedLogs = updateGroupedSubRows(
      logs as GroupedLogProps[],
      freshLogsData, // Pass the full response data instead of converted logs
      coreResult.targetGroupFilters || [],
      currentId
    );

    // Update the table data with the processed logs.
    await new Promise<void>(resolve => {
      updateTableDataItem((prev: TableDataItem) => {
        const newState = {
          ...prev,
          logs: updatedLogs,
        }
        resolve();
        return newState;
      });
    });
  } catch (error) {
    showErrorToast(error, "Error fetching grouped logs");
    throw error;
  } finally {
    setExpandingRowId(null);
  }
}

/*
  Appends new logs to existing grouped logs structure, used for infinite scroll.
  This function is used when loading more data at the same level.
*/
export function appendToGroupedLogs(
  existingLogs: GroupedLogProps[],
  newLogs: GroupedLogProps[] | LogProps[]
): GroupedLogProps[] {
  if (!Array.isArray(newLogs) || newLogs.length === 0) {
    return existingLogs;
  }

  // If new logs are ungrouped LogProps, we need to convert them or handle differently
  if (newLogs.length > 0 && newLogs[0].type === "ungrouped") {
    // This case should not happen at the top level for grouped logs
    // Return existing logs unchanged
    return existingLogs;
  }

  // For grouped logs, merge by grouping keys to avoid duplicates
  const newGroupedLogs = newLogs as GroupedLogProps[];
  const existingGroupMap = new Map<string, GroupedLogProps>();
  
  // Index existing groups by their grouping key
  existingLogs.forEach(log => {
    if (log.type === "grouped") {
      const key = `${log.groupingColumnId}:${log[log.groupingColumnId]}`;
      existingGroupMap.set(key, log);
    }
  });

  // Process new groups
  const resultLogs = [...existingLogs];
  
  newGroupedLogs.forEach(newLog => {
    if (newLog.type === "grouped") {
      const key = `${newLog.groupingColumnId}:${newLog[newLog.groupingColumnId]}`;
      const existingGroup = existingGroupMap.get(key);
      
      if (existingGroup) {
        // Update group count if it's larger
        if (newLog.groupCount && (!existingGroup.groupCount || newLog.groupCount > existingGroup.groupCount)) {
          existingGroup.groupCount = newLog.groupCount;
        }
      } else {
        // Add new group
        resultLogs.push(newLog);
      }
    }
  });

  return resultLogs;
}

/*
  Appends new subRows to a specific group in the nested structure.
  Used for infinite scroll within expanded groups.
*/
export function appendToGroupedSubRows(
  existingLogs: GroupedLogProps[],
  newSubRows: GroupedLogProps[] | LogProps[],
  targetGroupFilters: [string, string][]
): GroupedLogProps[] {
  function findAndAppendSubRows(
    logs: GroupedLogProps[],
    filters: [string, string][]
  ): GroupedLogProps[] {
    if (filters.length === 0) return logs;

    const [currentColumn, currentValue] = filters[0];

    return logs.map((log) => {
      if (sanitizeId(log.groupingColumnId) === currentColumn && log[log.groupingColumnId] === currentValue) {
        if (filters.length === 1) {
          // Target group found - append to existing subRows
          const existingSubRows = Array.isArray(log.subRows) ? log.subRows : [];
          
          // Determine if we're appending LogProps or GroupedLogProps
          if (newSubRows.length > 0 && newSubRows[0].type === "ungrouped") {
            // Appending LogProps to existing subRows
            const newLogProps = newSubRows as LogProps[];
            return {
              ...log,
              subRows: [...existingSubRows, ...newLogProps] as LogProps[],
              isPopulated: true
            };
          } else {
            // Appending GroupedLogProps to existing subRows
            const newGroupedLogProps = newSubRows as GroupedLogProps[];
            return {
              ...log,
              subRows: [...existingSubRows, ...newGroupedLogProps] as GroupedLogProps[],
              isPopulated: true
            };
          }
        } else if (Array.isArray(log.subRows)) {
          // Recursively append to deeper levels
          return {
            ...log,
            subRows: findAndAppendSubRows(log.subRows as GroupedLogProps[], filters.slice(1))
          };
        }
      }
      return log;
    });
  }

  return findAndAppendSubRows(existingLogs, targetGroupFilters);
}

/*
  Gets the current count of items at a specific group level.
  Useful for infinite scroll position tracking.
*/
export function getGroupItemCount(
  logs: GroupedLogProps[],
  groupFilters: [string, string][]
): number {
  function findGroupAndCount(
    currentLogs: GroupedLogProps[],
    filters: [string, string][]
  ): number {
    if (filters.length === 0) {
      return Array.isArray(currentLogs) ? currentLogs.length : 0;
    }

    const [currentColumn, currentValue] = filters[0];
    
    for (const log of currentLogs) {
      if (log.type === "grouped" && 
          sanitizeId(log.groupingColumnId) === currentColumn && 
          log[log.groupingColumnId] === currentValue) {
        
        if (filters.length === 1) {
          // Target group found
          return Array.isArray(log.subRows) ? log.subRows.length : 0;
        } else if (Array.isArray(log.subRows)) {
          // Recursively search deeper
          return findGroupAndCount(log.subRows as GroupedLogProps[], filters.slice(1));
        }
      }
    }
    
    return 0;
  }

  return findGroupAndCount(logs, groupFilters);
}

/*
  Helper to get flattened count for display purposes
*/
export function getFlattenedCount(logs: LogProps[] | GroupedLogProps[]): number {
  return maybeFlattenGroupedLogs(logs).length;
}
