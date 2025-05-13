import { Suspense } from "react";
import { getQueryClient } from '@/lib/react-query/getQueryClient'
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import LogsTable from "../Table/Table";
import { buildFilterExpression } from "@/utils/evals/filters";
import { processContext } from "@/utils/evals/columnOperations";
import { getLogsDetails } from "@/utils/evals/common";
import { TableDataItem } from "@/types/evals/grid";
import { buildTableArgumentsForTile } from "@/utils/arguments/buildTableArguments";

import type {
  LogsActions,
  FieldsActions,
  DerivedEntryActions,
  ContextActions,
  TileData,
  GranularTileActions,
} from "@/types/evals/grid";
import { LogFieldsResponseProps, LogsResponseProps, TablesArguments } from "@/types/evals/logs";


type TableWrapperActions = {
  tileActions: GranularTileActions;
  logsActions: LogsActions;
  fieldsActions: FieldsActions;
  derivedEntryActions: DerivedEntryActions;
  contextActions: ContextActions;
};

export default async function TableWrapper({
  tile,
  tabId,
  interfaceId,
  projectId,
  actions
}: {
  tile: TileData;
  tabId: string;
  interfaceId: string;
  projectId: string;
  actions: TableWrapperActions;
}) {
  const qc = getQueryClient();
  const tileId = tile.id || "";
  const tileName = tile.name; // We'll use this as the key in tableArguments

  // Prefetch fields
  await qc.prefetchQuery({
    queryKey: ["fields", projectId, tile.context],
    queryFn: () => actions.fieldsActions.get(projectId, tile.context ?? null)
  });

  // Get fields from cache
  const fields = qc.getQueryData<LogFieldsResponseProps>(["fields", projectId, tile.context]) || {};
  const prefixes = Object.keys(fields).map(
    key => key.includes("/") ? key.split("/").slice(0, -1).join("/") : null
  ).filter(key => key != null);
  const columnContexts = Array.from(
    new Set(prefixes.map(prefix => {
        const parts = prefix.split("/");
        let context = "";
        return parts.map(part => {
              context += part + "/";
              return context;
          });    
      }).flat().sort())
  );

  // Build filter expression
  const filterExpression = buildFilterExpression(
    tile.filters,
    tile.common_filter,
    tile.column_context,
    tile.freeze,
    fields
  );

  // Handle sorting
  const sortingObject = tile.table_tile?.sorting ? Object.fromEntries(
    tile.table_tile.sorting.split(",").map(value => [
      tile.column_context ? processContext("merge", tile.column_context, value.split("@")[0]) : value.split("@")[0],
      value.split("@")[1].replace("true", "descending").replace("false", "ascending")
    ]))
    : "";
  const sortingExpression = sortingObject ? JSON.stringify(sortingObject) : null;

  // Handle grouping
  const groupingExpression = tile.grouping || null;

  // Handle group sorting
  const groupSortingObject = tile.table_tile?.group_sorting && tile.grouping ? Object.fromEntries(
    tile.table_tile.group_sorting.split(",").map(value => {
      const group = tile.column_context ? processContext("merge", tile.column_context, tile.grouping!.split(",")[0]) : tile.grouping!.split(",")[0] 
      const field = tile.column_context ? processContext("merge", tile.column_context, value.split("@")[0]) : value.split("@")[0]
      const direction = value.split("@")[1].replace("true", "descending").replace("false", "ascending")
      const metric = tile.metric ?? "mean"
      return [group, {field, direction, metric}]
    }))
  : "";
  const groupSortingExpression = groupSortingObject ? JSON.stringify(groupSortingObject) : null;

  // Get existing tableArguments from cache
  let tableArguments = qc.getQueryData<TablesArguments>(["tableArguments", tabId]) || {};
  
  // Use the utility to build/update tableArguments
  tableArguments = await buildTableArgumentsForTile(tile, fields, tableArguments);
  
  // Update the cache
  qc.setQueryData(["tableArguments", tabId], tableArguments);

  // Prefetch logs data
  const limit = 20;
  const offset = tile.table_tile?.page_number ? parseInt(tile.table_tile.page_number) * limit : 0;
  
  await qc.prefetchQuery({
    queryKey: ["logs", projectId, tile.context, tile.column_context, filterExpression, sortingExpression, groupingExpression, groupSortingExpression, limit, offset],
    queryFn: () => actions.logsActions.get(
      projectId,
      tile.context ?? null,
      tile.column_context ?? null,
      filterExpression,
      sortingExpression,
      groupingExpression,
      groupSortingExpression,
      null,
      null,
      limit,
      offset,
      groupingExpression ? 0 : null,
      null,
      Date.now().toString()
    )
  });

  // Get logs data from cache
  const logsData = qc.getQueryData<LogsResponseProps>(["logs", projectId, tile.context, tile.column_context, filterExpression, sortingExpression, groupingExpression, groupSortingExpression, limit, offset]) || { params: {}, logs: [], count: 0, groups: [] };

  // Get logs details
  const { entriesProperties, paramsProperties, logs, params, metrics, boundaries } = await getLogsDetails(
    logsData,
    fields,
    tile.context ?? null,
    tile.column_context ?? null,
    projectId,
    filterExpression,
    groupingExpression,
    tile.metric,
    tile.table_tile?.sorting ?? null,
    undefined,
    actions.logsActions
  );

  // Update available fields in the tableArguments
  tableArguments[tileName].available_fields = Object.fromEntries(
    Object.entries(fields)
      .filter((([field, attributes]) => 
        entriesProperties.map(property => tile.column_context ? processContext("merge", tile.column_context, property) : property)
        .concat(paramsProperties.map(property => tile.column_context ? processContext("merge", tile.column_context, property) : property))
        .includes(field))
      )
  );
  
  // Update the cache again with available fields
  qc.setQueryData(["tableArguments", tabId], tableArguments);

  console.log(`[TableWrapper] tableArguments`, tableArguments);

  // Construct table data item
  const tableDataItem: TableDataItem = {
    columnContexts: columnContexts,
    baseIndex: tile.table_tile?.selected,
    hiddenColumns: tile.table_tile?.hidden_columns,
    columnOrdering: tile.table_tile?.column_order,
    selection: tile.table_tile?.selected,
    fields,
    logsData,
    totalPages: Math.ceil(logsData.count / limit),
    entriesProperties,
    paramsProperties,
    logs,
    params,
    metrics,
    boundaries,
    metric: tile.metric ?? "mean"
  };

  // Prefetch the table data item
  await qc.prefetchQuery({
    queryKey: ["tableDataItem", tileId],
    queryFn: () => Promise.resolve(tableDataItem)
  });

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <Suspense fallback={
        <div className="w-full h-full flex items-center justify-center">
            <SkeletonLoader />
        </div>
      }>
        <LogsTable
          tileId={tileId}
          tabId={tabId}
          interfaceId={interfaceId}
          projectId={projectId}
          tileActions={actions.tileActions}
          logsActions={actions.logsActions}
          fieldsActions={actions.fieldsActions}
          derivedEntryActions={actions.derivedEntryActions}
          contextActions={actions.contextActions}
        />
      </Suspense>
    </HydrationBoundary>
  );
} 