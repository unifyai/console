import { LogProps, GroupedLogProps, LogFieldsResponseProps, GroupedLogPropsRaw, LogItemProps } from "@/types/evals/logs";
import { TileProps, TableDataProps, LogsActions } from "@/types/evals/grid";
import { sanitizeId } from "@/utils/evals/columnOperations";
import { FiltersByColumn } from "@/types/evals/columns";
import { combineFilters, filtersToExpression } from "./filters";
import { getColumnMetrics } from "./common";

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
        }));
    }

    // Find the first grouping column in the raw data
    const groupingColumnId = Object.keys(rawGroupedLogs).find(key => 
        key !== 'group_count' && key !== 'count'
    );

    if (!groupingColumnId) {
        return [];
    }

    const groupValues = rawGroupedLogs[groupingColumnId] as { [groupValue: string]: number };

    let groupingIndex = 0;

    return Object.entries(groupValues)
        .filter(([value]) => value !== 'group_count' && value !== 'count')
        .map(([groupValue, count]) => {
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
  groupFilters - Array of [column, value] pairs identifying the target group
                (e.g., [["gender", "female"]] to identify the "female" gender group)
  returns Updated group structure with the new subRows inserted at the correct location
*/
export function updateGroupedSubRows(
  existingLogs: GroupedLogProps[],
  newLogs: GroupedLogProps[] | LogProps[],
  groupFilters: [string, string][]
): GroupedLogProps[] {
  /*
    Recursive function to find and update the target group without deep cloning the entire structure.
    It immutably updates only the affected nodes.
   
    logs - Current level of grouped logs
    filters - Remaining filters to identify the nested group
    returns Updated logs with modifications applied
  */
  function findAndReplaceSubRows(
    logs: GroupedLogProps[],
    filters: [string, string][]
  ): GroupedLogProps[] {
    if (filters.length === 0) return logs;

    let [currentColumn, currentValue] = filters[0];

    return logs.map((log) => {
      // Check if this log matches the current filter condition
      if (sanitizeId(log.groupingColumnId) === currentColumn && log[log.groupingColumnId] === currentValue) {
        if (filters.length === 1) {
          // Target group found - immutably update subRows if not already populated
          if (!log.isPopulated) {
            return {
              ...log,
              subRows: Array.isArray(newLogs) && newLogs.length > 0 && newLogs[0].type === "ungrouped" 
                ? (newLogs as LogProps[]) // Handle case when newLogs are LogProps[]
                : (newLogs as GroupedLogProps[]), // Existing behavior for GroupedLogProps[]
              isPopulated: true
            };
          }
        } else if (Array.isArray(log.subRows)) {
          // Recursively update subRows for deeper levels
          return {
            ...log,
            subRows: findAndReplaceSubRows(log.subRows as GroupedLogProps[], filters.slice(1))
          };
        }
      }
      return log; // Return unchanged if not matched
    });
  }

  return findAndReplaceSubRows(existingLogs, groupFilters);
}

/*
  Type guards to distinguish between LogProps and GroupedLogProps using the type field.
*/
function isLogProps(item: LogProps | GroupedLogProps): item is LogProps {
  return item.type === "ungrouped";
}

function isGroupedLogProps(item: LogProps | GroupedLogProps): item is GroupedLogProps {
  return item.type === "grouped";
}

/*
  Takes an array that could be either LogProps[] or GroupedLogProps[] and returns LogProps[].
  If the input is already LogProps[], returns it as is.
  If it's GroupedLogProps[], flattens it recursively into LogProps[].
*/
export function maybeFlattenGroupedLogs(
  items: LogProps[] | GroupedLogProps[]
): LogProps[] {
  const flattened: LogProps[] = [];

  for (const item of items) {
    if (isLogProps(item)) {
      // Item is a LogProps; add it directly.
      flattened.push(item);
    } else if (isGroupedLogProps(item)) {
      // Item is a GroupedLogProps; recursively flatten its subRows if they have been populated.
      if (item.isPopulated) {
        flattened.push(...maybeFlattenGroupedLogs(item.subRows));
      }
    } else {
      // The item did not match any expected type.
      console.warn('Encountered an item that is neither LogProps nor GroupedLogProps:', item);
    }
  }
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
        return value === "true" ? 'True' : 'False';
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

export async function onGroupExpand(
  rowId: string,
  groupingColumnId: string,
  groupingValue: string,
  parentId: string | null,
  project: string,
  context: string | null,
  columnContext: string | null,
  filterExpression: string | null,
  sortingExpression: string | null,
  groupingExpression: string | null,
  groupSortingExpression: string | null,
  limit: number,
  offset: number,
  logsActions: LogsActions,
  setExpandingRowId: (id: string | null) => void,
  setTableData: (updater: (prev: TableDataProps) => TableDataProps) => void,
  item: TileProps,
  dataTypes: { [key: string]: string },
  fields: LogFieldsResponseProps,
  logs: LogProps[] | GroupedLogProps[],
  columns: string[]
): Promise<void> {
  try {
    const { currentId, updatedFilterExpression, columnFilters } = getGroupingFilters(
      filterExpression, groupingColumnId, groupingValue, parentId, dataTypes, fields
    );
    
    // Get the current grouping expression
    const currentGrouping = groupingExpression?.split(",") || [];
    
    // Find the index of the current grouping column
    const currentIndex = currentGrouping.indexOf(groupingColumnId);
    
    // Get the remaining grouping columns after the current one
    const remainingGrouping = currentGrouping.slice(currentIndex + 1);

    setExpandingRowId(currentId);

    // Fetch fresh logs with the updated filter and remaining grouping
    const freshLogsData = await logsActions.get(
      project,
      context,
      columnContext,
      updatedFilterExpression,
      sortingExpression,
      remainingGrouping.length > 0 ? remainingGrouping.join(",") : null,
      groupSortingExpression,
      null,
      null,
      limit,
      offset,
      0,
      null,
      Date.now().toString()
    );

    let groupedMetrics: { [key: string]: { [key: string]: { [key: string]: { [key: string]: number | string } } } } = {};
    const remainingGroupingExpression = remainingGrouping.length > 0 ? remainingGrouping.join(",") : null;
    if (remainingGroupingExpression) {
      const numericColumns = columns.filter(col => ["int", "float", "timestamp", "time", "date", "timedelta", "bool"].includes(fields?.[col]?.data_type));
      const groupingColumnId = remainingGroupingExpression.split(",")[0];
      const metricsData = await getColumnMetrics(
        project,
        context,
        columnContext,
        numericColumns,
        updatedFilterExpression,
        groupingColumnId,
        item.metric ?? "mean",
        logsActions
      ) as { [key: string]: { [key: string]: { [key: string]: number | string } } };
      const metrics = Object.fromEntries(
        Object.entries(metricsData).filter(([col, _]) => numericColumns.includes(col)).map(
          ([col, groups]) => [col, Object.fromEntries(Object.entries(groups).map(
            ([groupingVal, results]) => [groupingVal, results[item.metric ?? "mean"]]
          ))]
      ));
      const sharedValues = Object.fromEntries(
        Object.entries(metricsData).map(
          ([col, groups]) => [col, Object.fromEntries(Object.entries(groups).map(
            ([groupingVal, results]) => [groupingVal, results["shared_value"]]
          ))]
      ));
      groupedMetrics[rowId] = {
        [item.metric ?? "mean"]: metrics,
        shared_value: sharedValues
      };
    }

    // Convert and update logs
    const convertedFreshLogs = maybeConvertRawToGroupedLogs(
      freshLogsData.params,
      freshLogsData.logs,
      currentId
    );

    // Update the logs based on whether we have LogProps[] or GroupedLogProps[]
    let updatedLogs: GroupedLogProps[];

    // If we have GroupedLogProps[], use updateGroupedSubRows
    updatedLogs = updateGroupedSubRows(
      logs as GroupedLogProps[],
      convertedFreshLogs,
      Object.entries(columnFilters).map(([cKey, filter]) => {
        const [fn, value] = Object.entries(filter)[0];
        let effectiveValue = value;

        // Remove "&&" or "||" with surrounding spaces
        effectiveValue = effectiveValue?.replace(/\s*(&&|\|\|)\s*/g, '').trim();

        // Trim the outer quotes if they exist
        if (effectiveValue.startsWith('"') && effectiveValue.endsWith('"')) {
          effectiveValue = effectiveValue.slice(1, -1);
        }

        // Convert boolean values properly
        if (dataTypes[cKey] === "bool") {
          effectiveValue = effectiveValue == "True" ? "true" : "false";
        }
        // Convert null values to "null"
        if (fn === "exists") {
          effectiveValue = "null";
        }
        return [cKey, effectiveValue] as [string, string];
      })
    );

    // Update the table data with the processed logs
    await new Promise<void>(resolve => {
      setTableData(prev => {
        const newState = {
          ...prev,
          [item.i]: {
            ...prev[item.i],
            logs: updatedLogs,
            groupedMetrics: {
              ...prev[item.i].groupedMetrics,
              ...groupedMetrics,
            }
          }
        };
        resolve();
        return newState;
      });
    });

  } catch (error) {
    console.error("Error fetching grouped logs:", error);
  } finally {
    setExpandingRowId(null);
  }
}
