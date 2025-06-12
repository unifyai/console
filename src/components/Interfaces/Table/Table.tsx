"use client";

import { BaseTable } from "@/components/Common/Tables/Base";
import DataTable from "@/components/Common/Tables/Data/Base";
import { TableArguments, LogProps, GroupedLogProps, LogItemProps } from "@/types/evals/logs";
import {
  ColumnFiltersState,
  ColumnSort,
  ColumnPinningState,
  ColumnSizingState,
  GroupingState,
} from "@tanstack/react-table";
import { DerivedEntryActions, LogsActions, FieldsActions, ContextActions } from "@/types/evals/grid";
import React, { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { ResponseProps } from "@/types/common";
import { buildTree, nestedColumns, encodeRenderedDepth, formatCellValue } from "@/utils/evals/table";
import { Badge } from "@/components/UI/badge";
import ColumnFilter from "./Buttons/Filters/Main";
import AggregatedCell from "./Content/AggregatedCell";
import VisibilityFilter from "./Buttons/VisibilityFilter";
import DeleteCells from "./Buttons/DeleteCells";
import ColumnDelete from "./Buttons/DeleteColumn";
import ColumnMetrics from "./Buttons/ColumnMetrics";
import SummaryCell from "./Content/SummaryCell";
import FooterCell from "./Content/FooterCell";
import GlobalFilter from "./Buttons/GlobalFilter";
import PageController from "@/components/Common/Tables/Data/Buttons/PageController";
import { extractBaseAndComparisonLogs } from "@/utils/evals/selection";
import FreezeLogs from "./Buttons/FreezeLogs";
import RefreshLogs from "./Buttons/RefreshLogs";
import { searchParamToFilters } from "@/utils/evals/filters";
import { FiltersByColumn } from "@/types/evals/columns";
import CellPopover from "./Content/CellPopover";
import { TableDataItem, TileProps, GranularTileActions, ProjectsActions } from "@/types/evals/grid";
import { flattenColumnIDs, sanitizeId } from "@/utils/evals/columnOperations";
import { DraggingColumnsState, DraggingColumnPinnerState } from "@/types/evals/columns";
import ColumnCreate from "@/components/Interfaces/Table/Buttons/ColumnCreate";
import ColumnUpdate from "@/components/Interfaces/Table/Buttons/ColumnUpdate";
import ColumnGroupBy from "@/components/Interfaces/Table/Buttons/ColumnGroupBy";
import ColumnGroupSort from "@/components/Interfaces/Table/Buttons/ColumnGroupSort";
import RowExpanding, { RowExpandingProps } from "@/components/Common/Tables/Data/Buttons/RowExpanding";
import { onGroupExpand, maybeFlattenGroupedLogs } from "@/utils/evals/grouping";
import ContextSelector from "./Content/ContextSelector";
import ResetServerAction from "./Buttons/ResetServerAction";
import CreateEmptyLogRow from "./Buttons/CreateEmptyLogRow"; // Import the new button
import { getGroupedMetrics } from "@/utils/evals/common";
import { deselectFromClickOutside } from "@/hooks/Logs/useCellSelection";

// Import new hooks
import { useTab } from "@/contexts/hooks/tab";
import { useTile, useTileItem } from '@/contexts/hooks/tile';
import { useProject } from "@/contexts/hooks/project";
import { shallow } from "zustand/vanilla/shallow";
import { useTableArgumentsQuery, useTableDataQueryWithTracking, useUpdateAvailableFieldsForTableArgumentsQuery } from "@/hooks/Query/useTableDataQuery";
import { useTileSync } from "@/contexts/hooks/tile/sync/useTileSync";
import { useRouter } from "next/navigation"; // Import useRouter

const LogsTable = ({
  tileId,
  tabId,
  interfaceId,
  projectId,
  tileActions,
  projectsActions,
  logsActions,
  fieldsActions,
  derivedEntryActions,
  contextActions,
}: {
  tileId: string;
  tabId: string;
  interfaceId: string;
  projectId: string | undefined;
  tileActions: GranularTileActions;
  projectsActions: ProjectsActions;
  logsActions: LogsActions;
  fieldsActions: FieldsActions;
  derivedEntryActions: DerivedEntryActions,
  contextActions: ContextActions,
}) => {
  const router = useRouter(); // Initialize useRouter

  // Get access to the tab data and actions with granular access
  const { ui: tabUIState, data: tabDataState } = useTab(tabId, interfaceId);
  const context_ = tabDataState?.globalContext;

  // Use granular hooks for better performance
  const {
    meta: tileMetaState,
    ui: tileUIState,
    tableTile: tableTileState,
    uiActions: tileUIActions,
  } = useTile(tileId, tabId);

  // Use the enhanced hook that includes state tracking
  const { 
    tableData: tableDataItem, 
    isLoading: isTableDataLoading,
    isError: isTableDataError,
    error: tableDataError,
    updateTableDataItemWithUpdater
  } = useTableDataQueryWithTracking(tileId || null, tabId || null);

  const {
    fields,
    logs,
    params,
    entriesProperties,
    paramsProperties,
    metrics,
    logsData,
    totalPages,
    boundaries
  } = tableDataItem;

  const tileName = tileMetaState?.name || "";
  
  // Update the available fields for the table arguments
  useUpdateAvailableFieldsForTableArgumentsQuery(tileId, tabId, entriesProperties, paramsProperties, fields);
  
  const {data: tableArguments = {} as TableArguments} = useTableArgumentsQuery(tabId || null);
  const filterExpression = tableArguments?.[tileName]?.getLogs_parameters?.filter_expr || null;
  const sortingExpression = tableArguments?.[tileName]?.getLogs_parameters?.sorting || null;
  const groupingExpression = tableArguments?.[tileName]?.getLogs_parameters?.grouping || null;
  const groupSortingExpression = tableArguments?.[tileName]?.getLogs_parameters?.group_sorting || null;

  // SYNCHRONISED TABLE-SPECIFIC ACTIONS (optimistic + router refresh)
  const { actions: syncedTileActions, tableTile } = useTileSync(
    tileId,
    tabId,
    tileActions,
    projectsActions,
    contextActions,
    logsActions,
    fieldsActions
  );
  const syncedTileDataActions = syncedTileActions?.data ?? null;
  const { tableTileActions } = tableTile ?? { tableTileActions: null };
  
  // Get access to the table tile specific data and actions with granular access
  const limit = tableTileState?.limit as number;
  const offset = tableTileState?.offset as number;
  
  // Get the item representation for the current tile
  const { itemActions } = useTileItem(tileId, tabId);
  const item = useMemo(() => itemActions?.asTileItem(), [itemActions]);

  const setPending = (pending: boolean) => tileUIActions?.setPending(pending);

  // Display loaders for group metrics and shared values
  const [loadingGroups, setLoadingGroups] = useState<Set<string>>(new Set());
  const [loadingSubGroup, setLoadingSubGroup] = useState<boolean>(false);

  // Extract params values from logs
  const paramsValues: LogItemProps = {};
  const flatLogs = maybeFlattenGroupedLogs(logs)
  if (Object.entries(params).length && Object.entries(logs).length)
    flatLogs.map(log => Object.entries(log.params).map(([key, value]) => paramsValues[key] = params[key][value]))

  // UI state from the tab
  const interactive = tabUIState?.interactive || false;
  const pending = tabUIState?.pending || tabUIState?.dataPending || tileUIState?.pending;

  // Basic states for quick feedback
  const [summaryPending, setSummaryPending] = useState(false);
  const [showSpinner, setShowSpinner] = useState(pending || !logs);

  useEffect(() => {
    setShowSpinner(pending || !logs);
  }, [pending, logs]);

  // Get base and comparison logs
  const selectedCells = item?.selected ? item?.selected.split(",") : [];
  const { baseLog, comparisonLogs } = extractBaseAndComparisonLogs(
    selectedCells,
    maybeFlattenGroupedLogs(logs)
  );

    // Various table states from the item
    const metric = item?.metric || "mean";
    const logsFilters = item?.filters;
    const commonFilter = item?.common_filter;
  
    const pageNumber = item?.page_number;
    const sortingStr = item?.sorting;
    const columnOrderStr = item?.column_order;
    const hiddenColumns = item?.hidden_columns;
    const groupingStr = item?.grouping;
    const groupSortingStr = item?.group_sorting;
    const columnsPinLeft = item?.columns_pin_left;
    const columnsPinRight = item?.columns_pin_right;
    const context = item?.context;
    const columnContext = item?.column_context;

  // Column definitions
  const entriesTree = useMemo(() => buildTree(entriesProperties), [entriesProperties]);
  const paramsTree = useMemo(() => buildTree(paramsProperties), [paramsProperties]);
  const dataTypes = useMemo(() => fields ? Object.fromEntries(Object.entries(fields).map(entry => [entry[0], entry[1].data_type])) : {}, [fields]);
  const fieldTypes = useMemo(() => fields ? Object.fromEntries(Object.entries(fields).map(entry => [entry[0], entry[1].field_type])) : {}, [fields]);

  const indicesTitle = "RowNumbering";
  const entriesTitle = "Entries";
  const paramsTitle = "Parameters";

  const columns = useMemo(() => {
    // Construct the columns array
    return [
      {
        id: indicesTitle,
        cell: ({ row }) => <Badge>{row.index + 1}</Badge>,
        meta: {
          dataType: null,
          columnType: "util",
          enableRowSpan: false,
          isParent: false,
          renderedDepth: -1,
        },
      },
      ...(paramsProperties.length
        ? [
            {
              id: paramsTitle,
              header: paramsTitle,
              columns: nestedColumns(
                paramsTree,
                "params",
                paramsTitle,
                logsData,
                true,
                dataTypes,
                fieldTypes,
                columnContext
              ),
              meta: {
                columnType: "paramsHeader",
                isParent: true,
                renderedDepth: -1,
              },
            },
          ]
        : []),
      ...(paramsProperties.length
        ? [
            {
              id: entriesTitle,
              header: entriesTitle,
              columns: nestedColumns(
                entriesTree,
                "entries",
                entriesTitle,
                logsData,
                false,
                dataTypes,
                fieldTypes,
                columnContext
              ),
              meta: {
                columnType: "entriesHeader",
                isParent: true,
                renderedDepth: -1,
              },
            },
          ]
        : nestedColumns(
            entriesTree,
            "entries",
            entriesTitle,
            logsData,
            false,
            dataTypes,
            fieldTypes,
            columnContext
          )),
    ];
  }, [entriesTree, paramsTree, dataTypes, fieldTypes, logsData.params]);

  // Apply rendered depth encoding to account for depth mismatch for all headers
  // This is needed for accurate column hiding/showing/grouping to work on all nest levels
  // Always assign depth = 0 for the meta column types as passed here
  encodeRenderedDepth(columns, ["util", "paramsHeader", "entriesHeader"]);

  // Convert those strings → arrays/objects
  const columnIDs = useMemo(() => flattenColumnIDs(columns), [columns]);

  // Flag to track if the column order was manually changed
  // by calling the setColumnOrder function
  // e.g. post drag and drop or create/delete columns on the UI etc.
  const [manualColumnOrderOverride, setManualColumnOrderOverride] = useState(false);
  const columnOrder = columnOrderStr ? columnOrderStr.split(",") : columnIDs;
  const setColumnOrder = (order: string[], manual = true) => {
    // Whenever the user does a "manual" column reorder or adds a column
    // we set the manualColumnOrderOverride flag to true. In all other cases,
    // we call `setColumnOrder` with the default `manual = false`
    if (manual) {
      setManualColumnOrderOverride(true);
    }
    tableTileActions?.setColumnOrder(order.join(","));
  };

  const allColumnsVisible = Object.fromEntries(columnIDs.map((x) => [x, true]));
  const columnVisibility = hiddenColumns
    ? {
      ...allColumnsVisible,
      ...Object.fromEntries(hiddenColumns.split(",").map((x) => [x, false])),
    }
    : allColumnsVisible;

  const setColumnVisibility = (v: { [key: string]: boolean }) => {
    const hidden = Object.keys(v).filter((k) => !v[k]);
    tableTileActions?.setHiddenColumns(hidden.length ? hidden.join(",") : undefined);
  };

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const setLogsFilters = (filtersObj: FiltersByColumn) => {
    const keys = Object.keys(filtersObj);
    syncedTileDataActions?.setFilters(
      keys.length
        ? Object.entries(filtersObj)
          .map(([cKey, val]) =>
            Object.entries(val).map(([fn, val2]) => `${cKey}~${fn}~${val2}`)
          )
          .flat()
          .join("§")
        : undefined
    );
  }

  const sorting: ColumnSort[] = sortingStr
    ? sortingStr.split(",").map((c) => {
      const [key, order] = c.split("@");
      const id = entriesProperties.includes(key) ? `Entries/${key}` : `Parameters/${key}`;
      const desc = order === "true";
      return { id, desc };
    })
    : [];
  const setSorting = (s: ColumnSort[]) =>
    tableTileActions?.setSorting(s.map((item) => `${sanitizeId(item?.id)}@${item?.desc}`).join(","));

  const grouping: GroupingState = groupingStr ? groupingStr.split(",") : [];
  const setGrouping = (g: GroupingState) =>
    syncedTileDataActions?.setGrouping(g.length ? g.join(",") : undefined);

  const groupSorting: ColumnSort[] = groupSortingStr
    ? groupSortingStr.split(",").map((c) => {
      const [key, order] = c.split("@");
      const id = entriesProperties.includes(key) ? `Entries/${key}` : `Parameters/${key}`;
      const desc = order === "true";
      return { id, desc };
    })
    : [];
  const setGroupSorting = (s: ColumnSort[]) =>
    tableTileActions?.setGroupSorting(s.map((item) => `${sanitizeId(item.id)}@${item.desc}`).join(","));

  const columnPinning: ColumnPinningState = {
    left: columnsPinLeft ? columnsPinLeft.split(",") : [indicesTitle],
    right: columnsPinRight ? columnsPinRight.split(",") : [],
  };
  const setColumnPinning = (pin: ColumnPinningState) => {
    tableTileActions?.setColumnsPinLeft(pin.left ? pin.left.join(",") : undefined);
    tableTileActions?.setColumnsPinRight(pin.right ? pin.right.join(",") : undefined);
  };

  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(
    columnIDs
      .map((id) => ({ [id]: id === indicesTitle ? 50 : 150 }))
      .reduce((acc, curr) => ({ ...acc, ...curr }), {})
  );

  const [draggingColumns, setDraggingColumns] = useState<DraggingColumnsState>({
    active: {
      ids: [],
      transform: null,
    },
    over: {
      ids: [],
      transform: null,
    },
  });

  const [draggingColumnPinner, setDraggingColumnPinner] = useState<DraggingColumnPinnerState>({
    columnId: null,
    isPinning: false,
    direction: null,
    transform: null
  });

  // Table state management
  const state = {
    tableDataItem,
    selectedCells,
    metric,
    sorting,
    groupSorting,
    columnVisibility,
    columnOrder,
    columnFilters,
    grouping,
    columnPinning,
    columnSizing,
    context,
    draggingColumns,
    draggingColumnPinner,
  };
  const setState = {
    setSelectedCells: (cells: string[]) => tableTileActions?.setSelected(cells.join(",")),
    setMetric: (newMetric: string) => syncedTileDataActions?.setMetric(newMetric),
    setSorting,
    setGroupSorting,
    setColumnVisibility,
    setColumnOrder,
    setColumnFilters,
    setGrouping,
    setColumnPinning,
    setColumnSizing,
    setContext: (newContext: string) => syncedTileDataActions?.setColumnContext(newContext),
    setDraggingColumns,
    setDraggingColumnPinner,
  };

  // Use refs to detect a *real* page/filter change
  const prevPageRef = useRef(pageNumber);
  const prevFiltersRef = useRef(logsFilters);
  const prevCommonFilterRef = useRef(commonFilter);
  const prevSortingRef = useRef(sortingStr);
  const prevGroupingRef = useRef(groupingStr);
  const prevGroupSortingRef = useRef(groupSortingStr);
  const prevContextRef = useRef(context);

  // Prune base/comparison IDs if user REALLY changes page or filters
  useEffect(() => {
    const pageChanged = prevPageRef.current !== pageNumber;
    const filtersChanged = prevFiltersRef.current !== logsFilters;
    const commonChanged = prevCommonFilterRef.current !== commonFilter;
    const sortingChanged = prevSortingRef.current !== sortingStr;
    const groupingChanged = prevGroupingRef.current !== groupingStr;
    const groupSortingChanged = prevGroupSortingRef.current !== groupSortingStr;

    if (pageChanged || filtersChanged || commonChanged || sortingChanged || groupingChanged || groupSortingChanged) {
      // If base no longer valid, remove it
      const flattenedLogs = maybeFlattenGroupedLogs(logs);
      if (baseLog && !(flattenedLogs).some((l) => l.id === baseLog.id)) {
        tableTileActions?.setSelected(selectedCells.slice(1).join(","));
      }
      // If compare logs not valid, prune them
      if (comparisonLogs) {
        const ids = comparisonLogs.map(cl => cl.id);
        const validIds = ids.filter((id) => flattenedLogs.some((l) => l.id === id));
        if (!validIds.length) {
          tableTileActions?.setSelected(
            (selectedCells.at(0) ? [selectedCells.at(0) as string] : []).join(",")
          );
        } else if (validIds.length < ids.length) {
          tableTileActions?.setSelected(
            selectedCells.filter(cell => validIds.includes(cell.split("_").at(0)!)).join(",")
          );
        }
      }
    }
    // Update the refs
    prevPageRef.current = pageNumber;
    prevFiltersRef.current = logsFilters;
    prevCommonFilterRef.current = commonFilter;
    prevSortingRef.current = sortingStr;
    prevGroupingRef.current = groupingStr;
    prevGroupSortingRef.current = groupSortingStr;
  }, [
    logs,
    pageNumber,
    logsFilters,
    commonFilter,
    sortingStr,
    groupingStr,
    groupSortingStr,
    selectedCells
  ]);

  // On initial mount or when the context changes, we need to set the column_order
  // on item correctly so that the view pane can take this state and render
  // the accordions in the correct order
  useEffect(() => {
    if (!shallow(columnOrder, item?.column_order?.split(","))) {
      setColumnOrder(columnOrder, false);
    }
  }, []);

  // Then when the context changes, we reset the manual override
  // so that the column order is not locked in and can be automatically
  // updated when updated data comes in
  useEffect(() => {
    if (context !== prevContextRef.current) {
      setManualColumnOrderOverride(false);
    }
    prevContextRef.current = context;
  }, [context]);

  // Finally, when either of entriesProperties or paramsProperties changes
  // and if the user hasn't manually updated the column order for this context,
  // re-apply the default
  useEffect(() => {
    if (!manualColumnOrderOverride && !shallow(columnIDs, item?.column_order?.split(","))) {
      // Because user hasn't manually adjusted anything for this "fresh" context
      // we revert to the updated columnIDs if we see new columns added or removed
      setColumnOrder(columnIDs, false);
    }
  }, [columnIDs, manualColumnOrderOverride]);

  // Helper function to safely access the property
  function safeUpdatedFilterExpression(item: TableDataItem): boolean {
    return (item as any).updatedFilterExpression;
  }

  // Effect to handle table data updates and grouped metrics
  useEffect(() => {
    if (!logs.length) return;

    // Handle loading states and fetch grouped metrics
    if (!loadingSubGroup && !safeUpdatedFilterExpression(tableDataItem)) {
      setLoadingGroups((prev) => {
        // If `prev` is already the single-element set we want, just reuse it:
        if (prev.size === 1 && prev.has("_all_groups_")) {
          return prev; // same reference => no state update => no re-render
        }
        // Otherwise create a new set
        return new Set(["_all_groups_"]);
      });
    }

    // Fetch grouped metrics
    getGroupedMetrics(
      projectId || null,
      item?.context || null,
      item?.column_context || null,
      logs.length ? [...entriesProperties, ...paramsProperties] : [],
      filterExpression,
      groupingExpression,
      metric,
      fields,
      logsActions
    ).then((groupedMetrics) => {
      // Update grouped metrics
      updateTableDataItemWithUpdater(
        undefined,
        { groupedMetrics },
        true
      );

      // Update loading states
      if (loadingSubGroup) {
        setLoadingSubGroup(false);
      } else {
        setLoadingGroups(prev => {
          const next = new Set(prev);
          next.delete("_all_groups_");
          return next;
        });
      }
    });
  }, [
    projectId,
    item?.context,
    item?.column_context,
    logs.length,
    safeUpdatedFilterExpression(tableDataItem),
    filterExpression,
    groupingExpression,
    metric,
    fields,
    logsActions,
    item?.name,
  ]);

  // Top area: filters, page, etc.
  const tableTop = (
    <div className="mb-2 mx-1 flex flex-wrap justify-between gap-3">
      {projectId && columns.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center LogsTablePreferences">
          <ContextSelector
            tileId={tileId}
            tabId={tabId}
            interfaceId={interfaceId}
            projectId={projectId}
            context={item?.context || context_}
            logsActions={logsActions}
            contextActions={contextActions}
            setPending={setPending}
            tileActions={tileActions}
            projectsActions={projectsActions}
            fieldsActions={fieldsActions}
          />
          <GlobalFilter
            interactive={interactive}
            logsFilters={logsFilters}
            commonFilter={commonFilter}
            setCommonFilter={syncedTileDataActions?.setCommonFilter!}
            logs={logs}
            currentTable={item?.name || ""}
            tableArguments={tableArguments}
          />
          <VisibilityFilter
            fields={fields}
            columnVisibility={columnVisibility}
            setColumnVisibility={setColumnVisibility}
            context={item?.context ?? null}
          />
           {projectId && (
            <CreateEmptyLogRow
              projectId={projectId}
              globalContext={item?.context || context_}
              fields={tableDataItem.fields}
              interactive={interactive}
              createLogsAction={logsActions.create}
              onSuccess={() => {
                // No need to call updateTab anymore since whenever we mutate
                // tracked properties, we mutate the server state using the sync hooks
                router.refresh();
                setPending(true);
              }}
              onError={(errorMessage) => {
                // Handle error, e.g., show a toast notification
                console.error("Failed to create log:", errorMessage);
                // You might want to use a more sophisticated error display mechanism
                alert(`Error: ${errorMessage}`);
              }}
            />
          )}
          <ResetServerAction condition={grouping.length > 0} type={"grouping"} interactive={interactive} logs={logs} setterFunction={() => {setGrouping([]); setGroupSorting([])}}/>
          <ResetServerAction condition={(sorting.length > 0 || groupSorting.length > 0)} type={"sorting"} interactive={interactive} logs={logs} setterFunction={() => {setSorting([]); setGroupSorting([])}}/>
          <ResetServerAction condition={(logsFilters != undefined || commonFilter != undefined)} type={"filters"} interactive={interactive} logs={logs} setterFunction={() => {setLogsFilters({}); syncedTileDataActions?.setCommonFilter(undefined)}}/>
        </div>
      )}
      {projectId && (
        <div className="w-fit flex gap-2 LogsTablePreferences">
          <div className="scale-90">
            <PageController
              interactive={interactive}
              totalPages={totalPages}
              pageNumber={pageNumber}
              setPageNumber={tableTileActions?.setPageNumber!}
              pageLogs={logs.length}
              totalLogs={logsData.count}
              limit={limit}
              logs={logs}
            />
          </div>
          <FreezeLogs 
            tileId={tileId}
            tabId={tabId}
            interfaceId={interfaceId}
            projectId={projectId}
          />
          <RefreshLogs
            tileId={tileId}
            tabId={tabId}
            projectId={projectId}
            pending={showSpinner}
            filterExpression={filterExpression}
            sortingExpression={sortingExpression}
            groupingExpression={groupingExpression}
            groupSortingExpression={groupSortingExpression}
            tileActions={tileActions}
            logsActions={logsActions}
            projectsActions={projectsActions}
            contextActions={contextActions}
            fieldsActions={fieldsActions}
          />
        </div>
      )}
    </div>
  );

  // Handle cell deselection from clicks
  const containerRef = useRef<HTMLDivElement>(null); 
  const onContainerClick = (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
    if (tableTileActions) deselectFromClickOutside(event, containerRef, selectedCells, tableTileActions.setSelected, ["LogsTable", "LogsTablePreferences"])
  }

  //Ref for auto scroll
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef} 
      className="flex-1 flex flex-col gap-4 w-full h-[80%] p-2 bg-background rounded-md"
      onClick={onContainerClick}
    >
      {/* If truly pending or logs not present, show a spinner */}
      {showSpinner ? (
        <div className="flex justify-center items-center h-full w-full">
          <Loader2 className="animate-spin my-36" />
        </div>
      ) : (
        <div className="w-full h-full flex flex-col">
          {tableTop && tableTop}
          <div ref={scrollContainerRef} className="w-full h-fit overflow-y-auto tutorial-logs-table">
            {projectId ? (
              <div className="relative flex-col gap-2">
                {/* "summaryPending" can optionally show a small loader over the table if you like */}
                <DataTable<LogProps | GroupedLogProps>
                  className="LogsTable"
                  interactive={interactive}
                  auto_update={item?.auto_update === "true"}
                  data={logs}
                  columns={columns}
                  state={state}
                  setState={setState}
                  scrollContainerRef={scrollContainerRef}
                  ColumnGroupBy={(column, groupLoading, setGroupLoading, setGroupSortLoading, setIsGrouped, renderMode = "button") => (
                    <ColumnGroupBy
                      interactive={interactive}
                      auto_update={item?.auto_update === "true"}
                      column={column}
                      grouping={state.grouping}
                      setGrouping={setState.setGrouping}
                      setGroupSorting={setState.setGroupSorting}
                      data={logs}
                      groupLoading={groupLoading}
                      setGroupLoading={setGroupLoading}
                      setGroupSortLoading={setGroupSortLoading}
                      setIsGrouped={setIsGrouped}
                      renderMode={renderMode}
                    />
                  )}
                  ColumnGroupSort={(column, groupSortLoading, setGroupSortLoading, setGroupSortingDirection, renderMode = "button", direction) => (
                    <ColumnGroupSort
                      interactive={interactive}
                      column={column}
                      groupSorting={groupSorting}
                      setGroupSorting={setGroupSorting}
                      logs={logs}
                      groupSortLoading={groupSortLoading}
                      setGroupSortLoading={setGroupSortLoading}
                      setGroupSortingDirection={setGroupSortingDirection}
                      renderMode={renderMode}
                      direction={direction}
                    />
                  )}
                  ColumnFilters={(column, filterLoading, setIsFiltered, setFilterLoading, open, setOpen, renderMode = "button") => (
                    <ColumnFilter
                      interactive={interactive}
                      setColumnFilterQuery={setLogsFilters}
                      boundaries={boundaries}
                      columnFilters={searchParamToFilters(logsFilters, item?.column_context)}
                      column={column.id}
                      dataTypes={dataTypes}
                      open={open}
                      setOpen={setOpen}
                      filterLoading={filterLoading}
                      setIsFiltered={setIsFiltered}
                      setFilterLoading={setFilterLoading}
                      renderMode={renderMode as "button" | "menuItem"}
                    />
                  )}
                  ColumnDelete={(column) => (
                    <ColumnDelete
                      tileId={tileId}
                      tabId={tabId}
                      project={projectId}
                      context={context}
                      columnContext={item?.column_context}
                      column={column.id}
                      interactive={interactive}
                      setPending={setPending}
                      getLogFieldsIds={logsActions.get}
                      deleteLogFields={logsActions.delete}
                      logsActions={logsActions}
                      projectsActions={projectsActions}
                      contextActions={contextActions}
                      fieldsActions={fieldsActions}
                    />
                  )}
                  ColumnCreate={(previousColumn: string, setOpen: (open: boolean) => void) => (
                    <ColumnCreate
                      tileId={tileId}
                      tabId={tabId}
                      project={projectId}
                      context={item?.context}
                      columnContext={item?.column_context}
                      currentTable={item?.name || ""}
                      tableArguments={tableArguments}
                      logs={logs}
                      columnOrder={columnOrder}
                      previousColumn={previousColumn}
                      create={derivedEntryActions.create}
                      setPending={setPending}
                      setColumnOrder={setColumnOrder}
                      setOpen={setOpen}
                      logsActions={logsActions}
                      projectsActions={projectsActions}
                      contextActions={contextActions}
                      fieldsActions={fieldsActions}
                    />
                  )}
                  ColumnUpdate={(colId: string, updateLoading: boolean, setUpdateLoading: (updateLoading: boolean) => void, open: boolean, setOpen: Dispatch<SetStateAction<boolean>>, renderMode = "button") => (
                    <ColumnUpdate
                      tileId={tileId}
                      tabId={tabId}
                      project={projectId}
                      context={item?.context}
                      colId={colId}
                      previousEquation={fields[sanitizeId(colId)].artifacts}
                      currentTable={item?.name || ""}
                      tableArguments={tableArguments}
                      logs={logs}
                      open={open}
                      updateLoading={updateLoading}
                      renderMode={renderMode as "button" | "menuItem"}
                      update={derivedEntryActions.update}
                      setPending={setPending}
                      setOpen={setOpen}
                      setUpdateLoading={setUpdateLoading}
                      logsActions={logsActions}
                      projectsActions={projectsActions}
                      contextActions={contextActions}
                      fieldsActions={fieldsActions}
                    />
                  )}
                  RowExpanding={(props: RowExpandingProps) => (
                    <RowExpanding
                      row={props.row}
                      groupingColumnId={props.groupingColumnId}
                      isLoading={props.isLoading}
                      isAnimating={props.isAnimating}
                      setExpandingRowId={props.setExpandingRowId}
                      onExpand={async (groupingColumnId: string, groupingValue: string, parentId: string, setExpandingRowId: (id: string | null) => void) => {
                        setLoadingSubGroup(true)
                        setLoadingGroups(prev => {
                          const next = new Set(prev);
                          if (next.has("_all_groups_")) {
                            next.delete("_all_groups_");
                          }
                          next.add(props.row.id);
                          return next;
                        });
                        
                        await onGroupExpand(
                          props.row.id,
                          groupingColumnId,
                          groupingValue,
                          parentId,
                          projectId!,
                          item?.context || context || context_ || null,
                          item?.column_context ?? null,
                          filterExpression,
                          sortingExpression,
                          groupingExpression,
                          groupSortingExpression,
                          limit,
                          offset,
                          logsActions,
                          setExpandingRowId,
                          updateTableDataItemWithUpdater,
                          item as TileProps,
                          dataTypes,
                          fields,
                          logs,
                          logs.length ? [...entriesProperties, ...paramsProperties] : []
                        );

                        setLoadingGroups(prev => {
                          const next = new Set(prev);
                          next.delete(props.row.id);
                          return next;
                        });
                      }}
                    />
                  )}
                  AggregatedCell={(cell, row) => (
                    <AggregatedCell
                      isGroupLoading={loadingGroups.has(row.id) || loadingGroups.has("_all_groups_")}
                      cell={cell}
                      metric={tableDataItem.metric}
                      getMetric={(key: string) => {
                        const groupingColumnId = row.groupingColumnId;
                        const slicedRowId = row.id.split(">").slice(0, -1).join(">");
                        const groupedMetrics = (
                          tableDataItem.groupedMetrics && groupingColumnId in tableDataItem.groupedMetrics
                            ? tableDataItem.groupedMetrics[groupingColumnId]
                            : tableDataItem.groupedMetrics && slicedRowId in tableDataItem.groupedMetrics
                              ? tableDataItem.groupedMetrics[slicedRowId] : { [metric]: {} }
                        )[metric] || {};
                        const newKey = key.replace("Entries/", "").replace("Parameters/", "");
                        const groupingValue = row.getValue(key) as string;
                        const value = groupedMetrics[newKey] ? groupedMetrics[newKey][groupingValue] : undefined;
                        const exclude_nulls = true;
                        const exclude_undefined = true;
                        const formattedValue = formatCellValue(
                          value, 
                          cell.column.columnDef.meta?.dataType ?? "",
                          cell.column.getSize(),
                          exclude_nulls,
                          exclude_undefined
                        );
                        return formattedValue;
                      }}
                      getSharedValue={(key: string) => {
                        const slicedRowId = row.id.split(">").slice(0, -1).join(">");
                        const groupingColumnId = row.groupingColumnId;
                        const groupedSharedValues = (
                          tableDataItem.groupedMetrics && groupingColumnId in tableDataItem.groupedMetrics
                            ? tableDataItem.groupedMetrics[groupingColumnId]
                            : tableDataItem.groupedMetrics && slicedRowId in tableDataItem.groupedMetrics
                              ? tableDataItem.groupedMetrics[slicedRowId] : { ["shared_value"]: {} }
                        )["shared_value"] || {};
                        const newKey = key.replace("Entries/", "").replace("Parameters/", "");
                        const groupingValue = row.getValue(key) as string;
                        const value = groupedSharedValues[newKey] ? groupedSharedValues[newKey][groupingValue] : undefined;
                        const exclude_nulls = true;
                        const exclude_undefined = true;
                        const formattedValue = formatCellValue(
                          value, 
                          cell.column.columnDef.meta?.dataType ?? "", 
                          cell.column.getSize(),
                          exclude_nulls,
                          exclude_undefined
                        );
                        return formattedValue;
                      }}
                    />
                  )}
                  FooterCell={(column, resizeMap, table) =>
                    <FooterCell
                      column={column}
                      resizeMap={resizeMap}
                      draggingColumns={state.draggingColumns}
                    >
                      {
                        column.columnDef.id === indicesTitle
                          ? logs?.length ? <ColumnMetrics interactive={interactive} metric={state.metric} setMetric={setState.setMetric} logs={logs} /> : null
                          : !column.getIsGrouped()
                            ? <SummaryCell column={column} state={state} metrics={metrics} pending={summaryPending} draggingColumns={state.draggingColumns} />
                            : null
                      }
                    </FooterCell>
                  }
                  ExtraComponents={(table) => {
                    return <DeleteCells project={projectId} selectedCells={selectedCells} logs={logs} deleteLogFields={logsActions.delete} columnContext={item?.column_context} context={item?.context} setPending={setPending}/>
                  }}
                  ExtraCellContent={(cell, isCellExpanded, setExpandedCells) =>
                    <CellPopover flatLogs={flatLogs} paramsValues={paramsValues} cell={cell} isCellExpanded={isCellExpanded} setExpandedCells={setExpandedCells} />
                  }
                  error={"detail" in logsData ? logsData["detail"] : undefined}
                />
              </div>
            ) : (
              <BaseTable items={[{ Entries: "Select a project to display your logs." }]} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LogsTable;

