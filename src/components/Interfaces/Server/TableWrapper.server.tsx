import { Suspense } from "react";
import getQueryClient from '@/app/getQueryClient';
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import LogsTable from "../Table/Table";
import { buildTableDataItem, getGroupSortingObject, getSortingObject } from "@/utils/data/buildTableDataItem";
import { processContext } from "@/utils/evals/columnOperations";

import type {
  LogsActions,
  FieldsActions,
  DerivedEntryActions,
  ContextActions,
  TileData,
  GranularTileActions,
  ProjectsActions,
} from "@/types/evals/grid";
import { LogFieldsResponseProps, LogsResponseProps, TableArguments } from "@/types/evals/logs";
import { buildFilterExpression } from "@/utils/evals/filters";

type TableWrapperActions = {
  tileActions: GranularTileActions;
  logsActions: LogsActions;
  fieldsActions: FieldsActions;
  derivedEntryActions: DerivedEntryActions;
  contextActions: ContextActions;
  projectsActions: ProjectsActions;
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
  console.log("[TableWrapper] Rendering...");
  const qc = getQueryClient();
  const tileId = tile.id || "";
  const tileName = tile.name; // We'll use this as the key in tableArguments

  // Get pre-built tableArguments from cache instead of building them here
  const tableArguments = qc.getQueryData<TableArguments>(["tableArguments", tabId]) || {} as TableArguments;

  // Prefetch fields
  await qc.prefetchQuery({
    queryKey: ["fields", projectId, tile.context],
    queryFn: () => actions.fieldsActions.get(projectId, tile.context ?? null)
  });

  // Get fields from cache
  const fields = qc.getQueryData<LogFieldsResponseProps>(["fields", projectId, tile.context]) || {} as LogFieldsResponseProps;

  // Build filter expression
  const filterExpression = buildFilterExpression(
    tile.filters,
    tile.common_filter,
    tile.column_context,
    tile.freeze,
    fields
  );

  // Handle sorting
  const sortingObject = tile.table_tile?.sorting ? getSortingObject(tile) : "";
  const sortingExpression = sortingObject ? JSON.stringify(sortingObject) : null;

  // Handle grouping
  const groupingExpression = tile.grouping || null;

  // Handle group sorting
  const groupSortingObject = tile.table_tile?.group_sorting && tile.grouping ? 
    getGroupSortingObject(tile) : "";
  const groupSortingExpression = groupSortingObject ? JSON.stringify(groupSortingObject) : null;

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

  // Build table data item
  const tableDataItem = await buildTableDataItem(tile, fields, logsData, projectId, actions.logsActions);

  // Update available fields in the tableArguments (if we have tableArguments for this tile)
  if (tableArguments[tileName]) {
    tableArguments[tileName].available_fields = Object.fromEntries(
      Object.entries(fields)
        .filter((([field, attributes]) => 
          tableDataItem.entriesProperties.map(property => tile.column_context ? processContext("merge", tile.column_context, property) : property)
          .concat(tableDataItem.paramsProperties.map(property => tile.column_context ? processContext("merge", tile.column_context, property) : property))
          .includes(field))
        )
    );
    
    // Update the cache with available fields
    qc.setQueryData(["tableArguments", tabId], tableArguments);
  }

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
          projectsActions={actions.projectsActions}
        />
      </Suspense>
    </HydrationBoundary>
  );
} 