"use client";

import { BaseTable } from "@/components/Common/Tables/Base";
import DataTable from "@/components/Common/Tables/Data/Base";
import { TableArguments, LogProps, GroupedLogProps } from "@/types/evals/logs";
import {
  ColumnDef,
  ColumnFiltersState,
  ColumnSort,
  ColumnPinningState,
  ColumnSizingState,
  GroupingState,
} from "@tanstack/react-table";
import { DerivedEntryActions, LogsActions, FieldsActions, Context } from "@/types/evals/grid";
import React, { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { ResponseProps } from "@/types/common";
import { buildTree, nestedColumns, encodeRenderedDepth } from "@/utils/evals/table";
import { Badge } from "@/components/UI/badge";
import ColumnFilter from "./Buttons/Filters/Main";
import AggregatedCell from "./Content/AggregatedCell";
import VisibilityFilter from "./Buttons/VisibilityFilter";
import DeleteCells from "./Buttons/DeleteCells";
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
import ColumnGroupSort from "@/components/Interfaces/Table/Buttons/ColumnGroupSort";
import RowExpanding, { RowExpandingProps } from "@/components/Common/Tables/Data/Buttons/RowExpanding";
import { onGroupExpand, maybeFlattenGroupedLogs } from "@/utils/evals/grouping";
import ContextSelector from "./Content/ContextSelector";

import { useTableContext } from "@/components/Providers/Stores/TableStoreProvider";
import { useInterfaceContext } from "@/components/Providers/Stores/InterfaceStoreProvider";

const LogsTable = ({
  index,
  project,
  contexts,
  context_,
  tableArguments,
  logsActions,
  fieldsActions,
  derivedEntryActions,
  filterExpression,
  sortingExpression,
  groupingExpression,
  groupSortingExpression,
  limit,
  offset,
  updateInterface,
}: {
  index: string;
  project: string | undefined;
  contexts: Context[];
  context_: string | undefined;
  tableArguments: TableArguments;
  logsActions: LogsActions;
  fieldsActions: FieldsActions;
  derivedEntryActions: DerivedEntryActions,
  filterExpression: string | null,
  sortingExpression: string | null,
  groupingExpression: string | null,
  groupSortingExpression: string | null,
  limit: number,
  offset: number,
  updateInterface: () => Promise<ResponseProps>,
}) => {

  // Pull from the interface store to find the tile item as TileProps, project, etc.
  const item = useInterfaceContext((s) => s.items.find((it) => it.i === index));
  const interactive = useInterfaceContext((s) => s.interactive);
  const pending = useInterfaceContext((s) => s.pending || s.dataPending);
  const tableData = useInterfaceContext((s) => s.tableData);
  const setPending = useInterfaceContext((s) => s.setPending);
  const updateItem = useInterfaceContext((s) => s.updateItem);
  const setTableData = useInterfaceContext((s) => s.setTableData);

  // Pull needed states & actions from the table state store
  const tableDataItem = tableData[index] as TableDataItem;
  const setTableDataItem = useTableContext((s) => s.setTableDataItem);

  // Basic states for quick feedback
  const summaryPending = useTableContext((s) => s.summaryPending);
  const setSummaryPendingStore = useTableContext((s) => s.setSummaryPending);  // if metric changed

  // We skip complicated "loading" checks to avoid the stuck spinner:
  // just show a spinner if logs are truly undefined or project is pending
  // (for example, remove "loading" if you want). 
  const showSpinner = useTableContext((s) => s.showSpinner);
  const setShowSpinner = useTableContext((s) => s.setShowSpinner);

  useEffect(() => {
    if (tableDataItem) {
      setTableDataItem(tableDataItem);
    }
  }, [tableDataItem, setTableDataItem]);

  useEffect(() => {
    const logs = tableDataItem?.logs;
    setShowSpinner(pending || !logs);
  }, [pending, tableDataItem, setShowSpinner]);

  const {
    fields,
    logs,
    entriesProperties,
    paramsProperties,
    metrics,
    logsData,
    totalPages,
    boundaries
  } = tableDataItem;

  // Get base and comparison logs
  const selectedCells = item?.selected ? item?.selected.split(",") : [];
  const { baseLog, comparisonLogs } = extractBaseAndComparisonLogs(
    selectedCells,
    maybeFlattenGroupedLogs(logs)
  );

  // Column definitions
  const entriesTree = buildTree(entriesProperties);
  const paramsTree = buildTree(paramsProperties);
  const dataTypes = fields ? Object.fromEntries(Object.entries(fields).map(entry => [entry[0], entry[1].data_type])) : {}
  const fieldTypes = fields ? Object.fromEntries(Object.entries(fields).map(entry => [entry[0], entry[1].field_type])) : {}
  const indicesTitle = "RowNumbering";
  const entriesTitle = "Entries";
  const paramsTitle = "Parameters";

  const columns: ColumnDef<LogProps | GroupedLogProps>[] = [
    {
      id: indicesTitle,
      cell: ({ row }) => <Badge>{row.index + 1}</Badge>,
      meta: {
        dataType: null,
        columnType: "util",
        enableRowSpan: false,
        isParent: false,
        renderedDepth: -1,  // Needed for grouping, showing, hiding multiple column nests
      },
    },
    ...(paramsProperties.length
      ? [
        {
          id: paramsTitle,
          header: paramsTitle,
          columns: nestedColumns(paramsTree, "params", paramsTitle, logsData, true, dataTypes, fieldTypes),
          meta: {
            columnType: "paramsHeader",
            isParent: true,
            renderedDepth: -1,  // Needed for grouping, showing, hiding multiple column nests
          },
        },
      ]
      : []),
    ...(paramsProperties.length
      ? [
        {
          id: entriesTitle,
          header: entriesTitle,
          columns: nestedColumns(entriesTree, "entries", entriesTitle, logsData, false, dataTypes, fieldTypes),
          meta: {
            columnType: "entriesHeader",
            isParent: true,
            renderedDepth: -1,  // Needed for grouping, showing, hiding multiple column nests
          },
        },
      ]
      : nestedColumns(entriesTree, "entries", entriesTitle, logsData, false, dataTypes, fieldTypes)),
  ];

  // Apply rendered depth encoding to account for depth mismatch for all headers
  // This is needed for accurate column hiding/showing/grouping to work on all nest levels
  // Always assign depth = 0 for the meta column types as passed here
  encodeRenderedDepth(columns, ["util", "paramsHeader", "entriesHeader"]);

  // Various table states from the URL
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

  // Convert those strings → arrays/objects
  const columnIDs = flattenColumnIDs(columns);
  const columnOrder = columnOrderStr ? columnOrderStr.split(",") : columnIDs;
  const allColumnsVisible = Object.fromEntries(columnIDs.map((x) => [x, true]));
  const columnVisibility = hiddenColumns
    ? {
      ...allColumnsVisible,
      ...Object.fromEntries(hiddenColumns.split(",").map((x) => [x, false])),
    }
    : allColumnsVisible;

  const setColumnVisibility = (v: { [key: string]: boolean }) => {
    const hidden = Object.keys(v).filter((k) => !v[k]);
    updateItem(item as TileProps, "hidden_columns")(hidden.length ? hidden.join(",") : undefined);
  };

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const setLogsFilters = (filtersObj: FiltersByColumn) => {
    const keys = Object.keys(filtersObj);
    updateItem(item as TileProps, "filters")(
      keys.length
        ? Object.entries(filtersObj)
          .map(([cKey, val]) =>
            Object.entries(val).map(([fn, val2]) => `${cKey}@${fn}@${val2}`)
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
    updateItem(item as TileProps, "sorting")(s.map((item) => `${sanitizeId(item?.id)}@${item?.desc}`).join(","));

  const grouping: GroupingState = groupingStr ? groupingStr.split(",") : [];
  const setGrouping = (g: GroupingState) =>
    updateItem(item as TileProps, "grouping")(g.length ? g.join(",") : undefined);

  const groupSorting: ColumnSort[] = groupSortingStr
    ? groupSortingStr.split(",").map((c) => {
      const [key, order] = c.split("@");
      const id = entriesProperties.includes(key) ? `Entries/${key}` : `Parameters/${key}`;
      const desc = order === "true";
      return { id, desc };
    })
    : [];
  const setGroupSorting = (s: ColumnSort[]) =>
    updateItem(item as TileProps, "group_sorting")(s.map((item) => `${sanitizeId(item.id)}@${item.desc}`).join(","));

  const columnPinning: ColumnPinningState = {
    left: columnsPinLeft ? columnsPinLeft.split(",") : [indicesTitle],
    right: columnsPinRight ? columnsPinRight.split(",") : [],
  };
  const setColumnPinning = (pin: ColumnPinningState) => {
    updateItem(item as TileProps, "columns_pin_left")(pin.left ? pin.left.join(",") : undefined);
    updateItem(item as TileProps, "columns_pin_right")(pin.right ? pin.right.join(",") : undefined);
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
    setSelectedCells: (cells: string[]) => updateItem(item as TileProps, "selected")(cells.join(",")),
    setMetric: updateItem(item as TileProps, "metric"),
    setSorting,
    setGroupSorting,
    setColumnVisibility,
    setColumnOrder: (order: string[]) => updateItem(item as TileProps, "column_order")(order.join(",")),
    setColumnFilters,
    setGrouping,
    setColumnPinning,
    setColumnSizing,
    setContext: updateItem(item as TileProps, "column_context"),
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
        updateItem(item as TileProps, "selected")(selectedCells.slice(1).join(","));
      }
      // If compare logs not valid, prune them
      if (comparisonLogs) {
        const ids = comparisonLogs.map(cl => cl.id);
        const validIds = ids.filter((id) => flattenedLogs.some((l) => l.id === id));
        if (!validIds.length) {
          updateItem(item as TileProps, "selected")(
            (selectedCells.at(0) ? [selectedCells.at(0) as string] : []).join(",")
          );
        } else if (validIds.length < ids.length) {
          updateItem(item as TileProps, "selected")(
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

  // Top area: filters, page, etc.
  const tableTop = (
    <div className="mb-2 mx-1 flex flex-wrap justify-between gap-3 LogsTablePreferences">
      {project && columns.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <ContextSelector
            index={index}
            contexts={contexts}
            context={context_}
          />
          <GlobalFilter
            interactive={interactive}
            logsFilters={logsFilters}
            commonFilter={commonFilter}
            setCommonFilter={updateItem(item as TileProps, "common_filter")}
            setLogsFilters={setLogsFilters}
            logs={logs}
            currentTable={item?.i || ""}
            tableArguments={tableArguments}
          />
          <VisibilityFilter
            fields={fields}
            columnVisibility={columnVisibility}
            setColumnVisibility={setColumnVisibility}
            context={item?.context ?? null}
          />
        </div>
      )}
      {project && (
        <div className="w-fit scale-90 flex gap-2">
          <PageController
            interactive={interactive}
            totalPages={totalPages}
            pageNumber={pageNumber}
            setPageNumber={updateItem(item as TileProps, "page_number")}
            pageLogs={logs.length}
            totalLogs={logsData.count}
          />
          <FreezeLogs item={item as TileProps} updateItem={updateItem} />
          <RefreshLogs
            item={item as TileProps}
            project={project}
            pending={showSpinner}
            fields={fields}
            filterExpression={filterExpression}
            sortingExpression={sortingExpression}
            hiddenColumns={item?.hidden_columns}
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
      updateItem(item as TileProps, "selected")("");
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
                  auto_update={item?.auto_update === "true"}
                  data={logs}
                  columns={columns}
                  state={state}
                  setState={setState}
                  ColumnGroupSort={(column, groupSortLoading, setGroupSortLoading, setIsGroupSorted, renderMode = "button") => (
                    <ColumnGroupSort
                      interactive={interactive}
                      column={column}
                      groupSorting={groupSorting}
                      setGroupSorting={setGroupSorting}
                      logs={logs}
                      groupSortLoading={groupSortLoading}
                      setGroupSortLoading={setGroupSortLoading}
                      setIsGroupSorted={setIsGroupSorted}
                      renderMode={renderMode}
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
                  ColumnCreate={(previousColumn: string, setOpen: (open: boolean) => void) => (
                    <ColumnCreate
                      project={project}
                      currentTable={item?.i || ""}
                      tableArguments={tableArguments}
                      logs={logs}
                      create={derivedEntryActions.create}
                      setPending={setPending}
                      refresh={() => updateInterface()}
                      columnOrder={columnOrder}
                      setColumnOrder={(order: string[]) => updateItem(item as TileProps, "column_order")(order.join(","))}
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
                      currentTable={item?.i || ""}
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
                          groupingColumnId,
                          groupingValue,
                          parentId,
                          project!,
                          item?.context ?? null,
                          item?.column_context ?? null,
                          filterExpression,
                          sortingExpression,
                          groupingExpression,
                          groupSortingExpression,
                          limit,
                          offset,
                          logsActions,
                          setExpandingRowId,
                          setTableData,
                          item as TileProps,
                          dataTypes,
                          fields,
                          logs,
                        );
                      }}
                    />
                  )}
                  AggregatedCell={(cell, row) => (
                    <AggregatedCell
                      cell={cell}
                      metric={metric}
                      getMetric={(key: string) => {
                        const groupedMetrics = tableDataItem.groupedMetrics;
                        const newKey = key.replace("Entries/", "").replace("Parameters/", "");
                        const groupingValue = row.getValue(key) as string;
                        const value = groupedMetrics[groupingValue] ? groupedMetrics[groupingValue][newKey] : undefined;
                        return typeof value === "number" ? value.toFixed(2) : value?.toString() ?? "";
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
                          ? <ColumnMetrics interactive={interactive} metric={state.metric} setMetric={setState.setMetric} logs={logs} />
                          : !column.getIsGrouped()
                            ? <SummaryCell column={column} state={state} metrics={metrics} pending={summaryPending} draggingColumns={state.draggingColumns} />
                            : null
                      }
                    </FooterCell>
                  }
                  ExtraComponents={(table) => {
                    return <DeleteCells project={project} selectedCells={selectedCells} logs={logs} deleteLogFields={logsActions.delete} columnContext={item?.column_context} context={item?.context} />
                  }}
                  ExtraCellContent={(cell, isCellExpanded, setExpandedCells) =>
                    <CellPopover cell={cell} isCellExpanded={isCellExpanded} setExpandedCells={setExpandedCells} />
                  }
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
