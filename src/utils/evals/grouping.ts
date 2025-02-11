import { LogsResponseProps, LogProps, GroupedLogProps, LogFieldsResponseProps, LogFieldsProps, getLogsParameters } from "@/types/evals/logs";
import { TileProps, TableDataProps, LogsActions } from "@/types/evals/grid";
import { maybeConvertRawToGroupedLogs, updateGroupedSubRows } from "@/utils/evals/common";
import { ResponseProps } from "@/types/common";
import { sanitizeId } from "@/utils/evals/columnOperations";
import { FiltersByColumn } from "@/types/evals/columns";
import { combineFilters, filtersToExpression } from "./filters";

export async function onGroupExpand(
  groupingColumnId: string,
  groupingValue: string,
  parentId: string | null,
  project: string,
  context: string | null,
  filterExpression: string | null,
  sortingExpression: string | null,
  groupingExpression: string | null,
  limit: number,
  offset: number,
  logsActions: LogsActions,
  setExpandingRowId: (id: string | null) => void,
  setTableData: (updater: (prev: TableDataProps) => TableDataProps) => void,
  item: TileProps,
  dataTypes: { [key: string]: string },
  fields: LogFieldsResponseProps,
  logs: LogProps[] | GroupedLogProps[],
): Promise<void> {
  try {
    // Generate the current ID for the expanding row
    let currentId = `${groupingColumnId}:${groupingValue}`;
    if (parentId) {
      currentId = `${parentId}>${currentId}`;
    }

    // Helper: Cast values based on data type
    const castValue = (value: string, dataType: string) => {
      switch (dataType) {
        case "int":
          return parseInt(value, 10).toString();
        case "float":
          return parseFloat(value).toString();
        case "timestamp":
          return value.startsWith('"') && value.endsWith('"') ? value : `"${value}"`;
        default:
          return value.startsWith('"') && value.endsWith('"') ? value : `"${value}"`;
      }
    };

    // Step 1: Build FiltersByColumn Structure
    const columnFilters: FiltersByColumn = {};
    let filterKeyCounter = 0;

    const handleFilter = (col: string, val: string) => {
      const sanitizedCol = sanitizeId(col);
      const dataType = dataTypes[sanitizedCol] || "str";

      if (val === '"null"') {
        return {
          key: filterKeyCounter++,
          mode: "is",
          join: "&&" as "&&" | "||",
          value: "None",
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
      updatedFilterExpression,
      sortingExpression,
      remainingGrouping.length > 0 ? remainingGrouping.join(",") : null,
      null,
      null,
      limit,
      offset,
      0,
      Date.now().toString()
    );

    // Convert and update logs
    const convertedFreshLogs = maybeConvertRawToGroupedLogs(
      freshLogsData.logs,
      remainingGrouping,
      currentId
    );

    // Update the logs based on whether we have LogProps[] or GroupedLogProps[]
    let updatedLogs: GroupedLogProps[];

    // If we have GroupedLogProps[], use updateGroupedSubRows
    updatedLogs = updateGroupedSubRows(
      logs as GroupedLogProps[],
      convertedFreshLogs,
      Object.entries(columnFilters).map(([column, value]) => {
        const rawValue = value["=="] || value["is"];
        const cleanedValue = rawValue
          ?.replace(/\s*(&&|\|\|)\s*/g, '')  // Remove "&&" or "||" with surrounding spaces
          .trim();                           // Trim leading/trailing whitespace
        return [column, cleanedValue === "None" ? "null" : cleanedValue] as [string, string];
      })
    );

    // Update the table data with the processed logs
    await new Promise<void>(resolve => {
      setTableData(prev => {
        const newState = {
          ...prev,
          [item.i]: {
            ...prev[item.i],
            logs: updatedLogs
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
