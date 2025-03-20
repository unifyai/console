"use client";

import { BaseTable } from "@/components/Common/Tables/Base";
import DataTable from "@/components/Common/Tables/Data/Base";
import { TableArguments, LogProps, GroupedLogProps, LogItemProps } from "@/types/evals/logs";
import {
  ColumnDef,
  ColumnFiltersState,
  ColumnSort,
  ColumnPinningState,
  ColumnSizingState,
  GroupingState,
} from "@tanstack/react-table";
import { DerivedEntryActions, LogsActions, FieldsActions, Context, ContextActions } from "@/types/evals/grid";
import React, { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Ungroup, ListX, FilterX } from "lucide-react";
import { ResponseProps } from "@/types/common";
import { buildTree, nestedColumns, encodeRenderedDepth } from "@/utils/evals/table";
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
import { ItemType, TableDataItem, TableDataProps, TileProps } from "@/types/evals/grid";
import { flattenColumnIDs, sanitizeId } from "@/utils/evals/columnOperations";
import { DraggingColumnsState, PinningColumnState } from "@/types/evals/columns";
import ColumnCreate from "@/components/Interfaces/Table/Buttons/ColumnCreate";
import ColumnUpdate from "@/components/Interfaces/Table/Buttons/ColumnUpdate";
import ColumnGroupBy from "@/components/Interfaces/Table/Buttons/ColumnGroupBy";
import ColumnGroupSort from "@/components/Interfaces/Table/Buttons/ColumnGroupSort";
import RowExpanding, { RowExpandingProps } from "@/components/Common/Tables/Data/Buttons/RowExpanding";
import { onGroupExpand, maybeFlattenGroupedLogs } from "@/utils/evals/grouping";
import ContextSelector from "./Content/ContextSelector";
import ResetServerAction from "./Buttons/ResetServerAction";
import { durationToTimeDelta, timeDeltaValueToDuration } from "@/utils/evals/format";
import { getGroupedMetrics } from "@/utils/evals/common";

const LogsTable = ({
  interactive,
  project,
  contexts,
  context_,
  pending,
  item,
  tableArguments,
  tableDataItem_,
  setTableData,
  updateItem,
  logsActions,
  fieldsActions,
  contextActions,
  derivedEntryActions,
  filterExpression,
  sortingExpression,
  groupingExpression,
  groupSortingExpression,
  limit,
  offset,
  updateInterface,
  setPending,
}: {
  interactive: boolean;
  project: string | undefined;
  contexts: Context[];
  context_: string | undefined;
  pending: boolean;
  tab: string;
  item: TileProps;
  tableArguments: TableArguments;
  tableDataItem_: TableDataItem;
  setTableData: (updater: (prev: TableDataProps) => TableDataProps) => void;
  updateItem: (item: TileProps, attrName: ItemType) => (newValue: string | undefined) => void;
  logsActions: LogsActions;
  fieldsActions: FieldsActions;
  derivedEntryActions: DerivedEntryActions,
  contextActions: ContextActions,
  filterExpression: string | null,
  sortingExpression: string | null,
  groupingExpression: string | null,
  groupSortingExpression: string | null,
  limit: number,
  offset: number,
  updateInterface: () => Promise<ResponseProps>,
  setPending: (pending: boolean) => void,
}) => {

  // extract necessary fields
  const [tableDataItem, setTableDataItem] = useState(tableDataItem_);
  const { fields, logs, params, entriesProperties, paramsProperties, metrics, logsData, totalPages, boundaries } = tableDataItem;
  useEffect(() => {
    setTableDataItem(prev => ({ ...prev, ...tableDataItem_, groupedMetrics: { ...prev.groupedMetrics, ...tableDataItem_.groupedMetrics } }));
    getGroupedMetrics(
      project || null,
      item.context || null,
      item.column_context || null,
      logs.length ? [...entriesProperties, ...paramsProperties] : [],
      filterExpression,
      groupingExpression,
      metric,
      fields,
      logsActions
    ).then((groupedMetrics) => {
      setTableDataItem(prev => ({ ...prev, groupedMetrics: { ...prev.groupedMetrics, ...groupedMetrics } }));
    });
  }, [tableDataItem_]);

  // Extract params values from logs
  const paramsValues: LogItemProps = {};
  const flatLogs = maybeFlattenGroupedLogs(logs)
  if (Object.entries(params).length && Object.entries(logs).length)
    flatLogs.map(log => Object.entries(log.params).map(([key, value]) => paramsValues[key] = params[key][value]))
  
  // Basic states for quick feedback
  const [summaryPending, setSummaryPending] = useState(false); // if metric changed

  // We skip complicated "loading" checks to avoid the stuck spinner:
  // just show a spinner if logs are truly undefined or project is pending
  // (for example, remove "loading" if you want). 
  const showSpinner = pending || !logs;

  // Get base and comparison logs
  const selectedCells = item.selected ? item.selected.split(",") : [];
  const { baseLog, comparisonLogs } = extractBaseAndComparisonLogs(
    selectedCells,
    maybeFlattenGroupedLogs(logs)
  );

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
                fieldTypes
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
                fieldTypes
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
            fieldTypes
          )),
    ];
  }, [entriesTree, paramsTree, dataTypes, fieldTypes, logsData.params]);

  // Apply rendered depth encoding to account for depth mismatch for all headers
  // This is needed for accurate column hiding/showing/grouping to work on all nest levels
  // Always assign depth = 0 for the meta column types as passed here
  encodeRenderedDepth(columns, ["util", "paramsHeader", "entriesHeader"]);

  // Various table states from the URL
  const metric = item.metric || "mean";
  const logsFilters = item.filters;
  const commonFilter = item.common_filter;

  const pageNumber = item.page_number;
  const sortingStr = item.sorting;
  const columnOrderStr = item.column_order;
  const hiddenColumns = item.hidden_columns;
  const groupingStr = item.grouping;
  const groupSortingStr = item.group_sorting;
  const columnsPinLeft = item.columns_pin_left;
  const columnsPinRight = item.columns_pin_right;
  const context = item.context;

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
    updateItem(item, "column_order")(order.join(","))
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
    updateItem(item, "hidden_columns")(hidden.length ? hidden.join(",") : undefined);
  };

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const setLogsFilters = (filtersObj: FiltersByColumn) => {
    const keys = Object.keys(filtersObj);
    updateItem(item, "filters")(
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
    updateItem(item, "sorting")(s.map((item) => `${sanitizeId(item.id)}@${item.desc}`).join(","));

  const grouping: GroupingState = groupingStr ? groupingStr.split(",") : [];
  const setGrouping = (g: GroupingState) =>
    updateItem(item, "grouping")(g.length ? g.join(",") : undefined);

  const groupSorting: ColumnSort[] = groupSortingStr
    ? groupSortingStr.split(",").map((c) => {
      const [key, order] = c.split("@");
      const id = entriesProperties.includes(key) ? `Entries/${key}` : `Parameters/${key}`;
      const desc = order === "true";
      return { id, desc };
    })
    : [];
  const setGroupSorting = (s: ColumnSort[]) =>
    updateItem(item, "group_sorting")(s.map((item) => `${sanitizeId(item.id)}@${item.desc}`).join(","));

  const columnPinning: ColumnPinningState = {
    left: columnsPinLeft ? columnsPinLeft.split(",") : [indicesTitle],
    right: columnsPinRight ? columnsPinRight.split(",") : [],
  };
  const setColumnPinning = (pin: ColumnPinningState) => {
    updateItem(item, "columns_pin_left")(pin.left ? pin.left.join(",") : undefined);
    updateItem(item, "columns_pin_right")(pin.right ? pin.right.join(",") : undefined);
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

  const [pinningState, setPinningState] = useState<PinningColumnState>({
    columnId: null,
    isPinning: false,
    direction: null,
    transform: null
  });

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
    pinningState,
  };
  const setState = {
    setTableDataItem,
    setSelectedCells: (cells: string[]) => updateItem(item, "selected")(cells.join(",")),
    setMetric: updateItem(item, "metric"),
    setSorting,
    setGroupSorting,
    setColumnVisibility,
    setColumnOrder,
    setColumnFilters,
    setGrouping,
    setColumnPinning,
    setColumnSizing,
    setContext: updateItem(item, "column_context"),
    setDraggingColumns,
    setPinningState,
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
        updateItem(item, "selected")(selectedCells.slice(1).join(","));
      }
      // If compare logs not valid, prune them
      if (comparisonLogs) {
        const ids = comparisonLogs.map(cl => cl.id);
        const validIds = ids.filter((id) => flattenedLogs.some((l) => l.id === id));
        if (!validIds.length) {
          updateItem(item, "selected")(
            (selectedCells.at(0) ? [selectedCells.at(0) as string] : []).join(",")
          );
        } else if (validIds.length < ids.length) {
          updateItem(item, "selected")(
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
    setColumnOrder(columnOrder, false);
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
    if (!manualColumnOrderOverride) {
      // Because user hasn't manually adjusted anything for this "fresh" context
      // we revert to the updated columnIDs if we see new columns added or removed
      setColumnOrder(columnIDs, false);
    }
  }, [columnIDs, manualColumnOrderOverride]);

  // Top area: filters, page, etc.
  const tableTop = (
    <div className="mb-2 mx-1 flex flex-wrap justify-between gap-3 LogsTablePreferences">
      {project && columns.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <ContextSelector
            project={project}
            emptyLogs={logs.length == 0}
            contexts_={contexts}
            context={context_}
            tableDataItem={tableDataItem}
            item={item}
            updateItem={updateItem}
            contextActions={contextActions}
            logsActions={logsActions}
            fields={[...paramsProperties, ...entriesProperties]}
            refresh={() => updateInterface()}
            setPending={setPending}
          />
          <GlobalFilter
            interactive={interactive}
            logsFilters={logsFilters}
            commonFilter={commonFilter}
            setCommonFilter={updateItem(item, "common_filter")}
            logs={logs}
            currentTable={item.i}
            tableArguments={tableArguments}
          />
          <VisibilityFilter
            fields={fields}
            columnVisibility={columnVisibility}
            setColumnVisibility={setColumnVisibility}
            context={item.context ?? null}
          />
          <ResetServerAction condition={grouping.length > 0} type={"grouping"} interactive={interactive} logs={logs} setterFunction={() => {setGrouping([]); setGroupSorting([])}}/>
          <ResetServerAction condition={(sorting.length > 0 || groupSorting.length > 0)} type={"sorting"} interactive={interactive} logs={logs} setterFunction={() => {setSorting([]); setGroupSorting([])}}/>
          <ResetServerAction condition={(logsFilters != undefined || commonFilter != undefined)} type={"filters"} interactive={interactive} logs={logs} setterFunction={() => {setLogsFilters({}); updateItem(item, "common_filter")(undefined)}}/>
        </div>
      )}
      {project && (
        <div className="w-fit flex gap-2">
          <div className="scale-90">
            <PageController
              interactive={interactive}
              totalPages={totalPages}
              pageNumber={pageNumber}
              setPageNumber={updateItem(item, "page_number")}
              pageLogs={logs.length}
              totalLogs={logsData.count}
              limit={limit}
              logs={logs}
            />
          </div>
          <FreezeLogs 
            item={item}
            data={logs}
            updateItem={updateItem}
          />
          <RefreshLogs
            item={item}
            project={project}
            pending={showSpinner}
            fields={fields}
            filterExpression={filterExpression}
            sortingExpression={sortingExpression}
            hiddenColumns={item.hidden_columns}
            groupingExpression={groupingExpression}
            groupSortingExpression={groupSortingExpression}
            updateItem={updateItem}
            setTableData={setTableData}
            logsActions={logsActions}
            fieldsActions={fieldsActions}
            logs={logs}
          />
        </div>
      )}
    </div>
  );

  const tableRef = useRef<HTMLDivElement>(null);

  // Handle clicking outside of the table
  const onContainerClick = (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
    if (tableRef.current && !tableRef.current.contains(event.target as Node)) {
      updateItem(item, "selected")("");
    }
  }

  return (
    <div className="flex-1 flex flex-col gap-4 w-full h-[80%] p-2 bg-background rounded-md" onClick={onContainerClick}>
      {/* If truly pending or logs not present, show a spinner */}
      {showSpinner ? (
        <div className="flex justify-center items-center h-full w-full">
          <Loader2 className="animate-spin my-36" />
        </div>
      ) : (
        <div className="w-full h-full flex flex-col">
          {tableTop && tableTop}
          <div ref={tableRef} className="w-full h-fit overflow-y-auto tutorial-logs-table">
            {project ? (
              <div className="relative flex-col gap-2">
                {/* "summaryPending" can optionally show a small loader over the table if you like */}
                <DataTable<LogProps | GroupedLogProps>
                  className="LogsTable"
                  interactive={interactive}
                  auto_update={item.auto_update === "true"}
                  data={logs}
                  columns={columns}
                  state={state}
                  setState={setState}
                  ColumnGroupBy={(column, groupLoading, setGroupLoading, setGroupSortLoading, setIsGrouped, renderMode = "button") => (
                    <ColumnGroupBy
                      interactive={interactive}
                      auto_update={item.auto_update === "true"}
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
                      direction={direction}
                      renderMode={renderMode as "button" | "menuItem"}
                    />
                  )}
                  ColumnFilters={(column, filterLoading, setIsFiltered, setFilterLoading, open, setOpen, renderMode = "button") => (
                    <ColumnFilter
                      interactive={interactive}
                      setColumnFilterQuery={setLogsFilters}
                      boundaries={boundaries}
                      columnFilters={searchParamToFilters(logsFilters, item.column_context)}
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
                      interactive={interactive}
                      project={project}
                      column={column.id}
                      context={context}
                      columnContext={item.column_context}
                      getLogFieldsIds={logsActions.get}
                      deleteLogFields={logsActions.delete}
                      refresh={() => updateInterface()}
                      setPending={setPending}
                    />
                  )}
                  ColumnCreate={(previousColumn: string, setOpen: (open: boolean) => void) => (
                    <ColumnCreate
                      project={project}
                      context={item.context}
                      currentTable={item.i}
                      tableArguments={tableArguments}
                      logs={logs}
                      create={derivedEntryActions.create}
                      setPending={setPending}
                      refresh={() => updateInterface()}
                      columnOrder={columnOrder}
                      setColumnOrder={setColumnOrder}
                      previousColumn={previousColumn}
                      setOpen={setOpen}
                    />
                  )}
                  ColumnUpdate={(colId: string, updateLoading: boolean, setUpdateLoading: (updateLoading: boolean) => void, open: boolean, setOpen: Dispatch<SetStateAction<boolean>>, renderMode = "button") => (
                    <ColumnUpdate
                      project={project}
                      colId={colId}
                      open={open}
                      setOpen={setOpen}
                      previousEquation={fields[sanitizeId(colId)].artifacts}
                      currentTable={item.i}
                      tableArguments={tableArguments}
                      logs={logs}
                      update={derivedEntryActions.update}
                      setPending={setPending}
                      refresh={() => updateInterface()}
                      updateLoading={updateLoading}
                      setUpdateLoading={setUpdateLoading}
                      renderMode={renderMode as "button" | "menuItem"}
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
                        await onGroupExpand(
                          props.row.id,
                          groupingColumnId,
                          groupingValue,
                          parentId,
                          project!,
                          (item.context || context || context_) ?? null,
                          item.column_context ?? null,
                          filterExpression,
                          sortingExpression,
                          groupingExpression,
                          groupSortingExpression,
                          limit,
                          offset,
                          logsActions,
                          setExpandingRowId,
                          setTableData,
                          item,
                          dataTypes,
                          fields,
                          logs,
                          logs.length ? [...entriesProperties, ...paramsProperties] : []
                        );
                      }}
                    />
                  )}
                  AggregatedCell={(cell, row) => (
                    <AggregatedCell
                      cell={cell}
                      metric={tableDataItem_.metric}
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
                        if (value && typeof value === "number")
                          if (state.metric === "count")
                            return Math.floor(value)
                          else
                            return value.toFixed(2)
                        else if (value && cell.column.columnDef.meta?.dataType === "timedelta" && state.metric != "count") 
                          try {
                            return durationToTimeDelta(timeDeltaValueToDuration(value.toString()));
                          } catch (error) {
                            console.error("Error formatting timedelta:", error);
                            return value?.toString() ?? "";
                          }
                        else
                          return value?.toString() ?? ""
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
                        if (value && typeof value === "number") 
                          return value.toFixed(2)
                        else if (value && cell.column.columnDef.meta?.dataType === "timedelta") 
                          try {
                            return durationToTimeDelta(timeDeltaValueToDuration(value.toString()));
                          } catch (error) {
                            console.error("Error formatting timedelta:", error);
                            return value?.toString() ?? "";
                          }
                        else
                          return value?.toString() ?? ""
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
                    return <DeleteCells project={project} selectedCells={selectedCells} logs={logs} deleteLogFields={logsActions.delete} columnContext={item.column_context} context={item.context} refresh={() => updateInterface()} setPending={setPending}/>
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
