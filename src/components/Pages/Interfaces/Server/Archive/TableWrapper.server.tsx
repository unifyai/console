import { Suspense } from "react";
import getQueryClient from '@/app/getQueryClient';
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import LogsTable from "../../Blocks/Table/Table";
import { getGroupSortingObject, getSortingObject } from "@/utils/data/buildTableDataItem";

import type {
  LogsActions,
  FieldsActions,
  DerivedEntryActions,
  ContextActions,
  TileData,
  GranularTileActions,
  ProjectsActions,
} from "@/types/interfaces/grid";
import { LogFieldsResponseProps, LogsResponseProps } from "@/types/interfaces/logs";
import { buildFilterExpression } from "@/utils/interfaces/table/filters";

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
    tile.commonFilter,
    tile.columnContext,
    tile.freeze,
    fields
  );

  // Handle sorting
  const sortingObject = tile.tableTile?.sorting ? getSortingObject(tile) : "";
  const sortingExpression = sortingObject ? JSON.stringify(sortingObject) : null;

  // Handle grouping
  const groupingExpression = tile.grouping || null;

  // Handle group sorting
  const groupSortingObject = tile.tableTile?.groupSorting && tile.grouping ? 
    getGroupSortingObject(tile) : "";
  const groupSortingExpression = groupSortingObject ? JSON.stringify(groupSortingObject) : null;

  // Prefetch logs data
  const limit = 20;
  const offset = tile.tableTile?.pageNumber ? parseInt(tile.tableTile.pageNumber) * limit : 0;
  
  await qc.prefetchQuery({
    queryKey: ["logs", projectId, tile.context, tile.columnContext, filterExpression, sortingExpression, groupingExpression, groupSortingExpression, limit, offset],
    queryFn: () => actions.logsActions.get(
      projectId,
      tile.context ?? null,
      tile.columnContext ?? null,
      filterExpression,
      sortingExpression,
      groupingExpression,
      groupSortingExpression,
      null,
      null,
      null,
      limit,
      offset,
      null,
      null,
      groupingExpression ? 0 : null,
      null,
      null,
      Date.now().toString()
    )
  });
  
  // Get logs data from cache
  const logsData = qc.getQueryData<LogsResponseProps>(["logs", projectId, tile.context, tile.columnContext, filterExpression, sortingExpression, groupingExpression, groupSortingExpression, limit, offset]) || { params: {}, logs: [], count: 0, groups: [] };

  // Build table data item
  const tableDataItem = {}; // await buildTableDataItem(tile, fields, logsData);

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