"use client";

import DeleteDialog from "@/components/Common/Dialogs/Delete";
import { BaseTable } from "@/components/Common/Tables/Base";
import DataTable from "@/components/Common/Tables/Data/Base";
import FileDirectory from "@/components/Tree/Directory/FileDirectory";
import { getLogsParameters, TableArguments, LogFieldsProps, LogFieldsResponseProps, LogProps, LogsResponseProps, GroupedLogProps } from "@/types/evals/logs";
import {
  ColumnDef,
  ColumnFiltersState,
  ColumnSort,
  ColumnPinningState,
  Updater,
  ColumnSizingState,
  GroupingState,
} from "@tanstack/react-table";
import React, { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { FileProps, ResponseProps } from "@/types/common";
import { buildTree, encodeRenderedDepth, nestedColumns } from "@/utils/evals/table";
import { Badge } from "@/components/UI/badge";
import { useQueryState } from "nuqs";
import ColumnFilter from "./Buttons/Filters/Main";
import AggregatedCell from "./Content/AggregatedCell";
import VisibilityFilter from "./Buttons/VisibilityFilter";
import DeleteCells from "./Buttons/DeleteCells";
import ColumnMetrics from "./Buttons/ColumnMetrics";
import SummaryCell from "./Content/SummaryCell";
import FooterCell from "./Content/FooterCell";
import CreateProject from "./Buttons/CreateProject";
import GlobalFilter from "./Buttons/GlobalFilter";
import PageController from "@/components/Common/Tables/Data/Buttons/PageController";
import CloseProject from "./Buttons/CloseProject";
import { extractBaseAndComparisonLogs, getPartAfterFirstUnderscore } from "@/utils/evals/selection";
import { parseAsArrayOf, parseAsString } from "nuqs";
import RefreshLogs from "./Buttons/RefreshLogs";
import { searchParamToFilters } from "@/utils/evals/filters";
import CellPopover from "./Content/CellPopover";
import SelectionMenu from "@/components/Tree/SelectionMenu/SelectionMenu";
import { flattenColumnIDs, sanitizeId } from "@/utils/evals/columnOperations";
import { DraggingColumnsState, PinningColumnState } from "@/types/evals/columns";
import ColumnCreate from "@/components/Evals/Table/Buttons/ColumnCreate";
import { DerivedEntryActions, LogsActions } from "@/types/evals/grid";
import { maybeFlattenGroupedLogs } from "@/utils/evals/grouping";

const LogsTable = ({
  searchParams,
  projects,
  project,
  logs,
  fields,
  tableArguments,
  entriesProperties,
  paramsProperties,
  metrics,
  logsData,
  totalPages,
  projectActions,
  logsActions,
  derivedEntryActions,
  fieldsActions,
  boundaries,
  filterExpression,
  sortingExpression,
  groupingExpression
}: {
  searchParams: {
    project?: string;
    page_number?: string;
    metric?: string;
    context?: string;
    filters?: string;
    common_filter?: string;
    grouping?: string | null;
  };
  projects: string[] | undefined;
  project: string | undefined;
  logs: LogProps[] | GroupedLogProps[];
  tableArguments: TableArguments;
  fields: LogFieldsResponseProps;
  entriesProperties: string[];
  paramsProperties: string[];
  metrics: { [key: string]: any };
  logsData: LogsResponseProps;
  totalPages: number;
  projectActions: {
    get: () => Promise<string[]>;
    create: (name: string) => Promise<ResponseProps>;
    rename: (oldName: string, newName: string) => Promise<ResponseProps>;
    delete: (name: string) => Promise<ResponseProps>;
  };
  logsActions: LogsActions;
  derivedEntryActions: DerivedEntryActions;
  fieldsActions: {
    get: (project: string, _timestamp: string | null) => Promise<LogFieldsResponseProps>,
  },
  boundaries: {minimums: {[key: string]: number}, maximums: {[key: string]: number}}
  filterExpression: string | null,
  sortingExpression: string | null,
  groupingExpression: string | null
}) => {
  // Basic states for quick feedback
  const [pending, setPending] = useState(false);        // if the project is invalid
  const [summaryPending, setSummaryPending] = useState(false); // if metric changed

  // We skip complicated "loading" checks to avoid the stuck spinner:
  // just show a spinner if logs are truly undefined or project is pending
  // (for example, remove "loading" if you want). 
  const showSpinner = pending || !logs;

  // Get base and comparison logs
  const [selectedCells, setSelectedCells]  = useQueryState(
    "selected", 
    parseAsArrayOf(parseAsString).withDefault([])                    // [logId1_colId1,logId1_colId2,logId2_colId3,...]
  )
  const { baseLogIndex, baseLog, comparisonLogsIndex, comparisonLogs } = extractBaseAndComparisonLogs(selectedCells, maybeFlattenGroupedLogs(logs))

  // Column definitions
  const entriesTree = buildTree(entriesProperties);
  const paramsTree = buildTree(paramsProperties);
  const dataTypes = Object.fromEntries(Object.entries(fields).map(entry => [entry[0], entry[1].data_type]))
  const fieldTypes = Object.fromEntries(Object.entries(fields).map(entry => [entry[0], entry[1].field_type]))
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
  const [metricQuery, setMetric] = useQueryState("metric", {shallow: false});
  const metric = metricQuery ?? "mean";

  const [projectQuery, setProject] = useQueryState("project", { shallow: false });
  const projectQueryVal = (projects || []).find((p) => p === projectQuery);

  const [logsFiltersQuery, setLogsFiltersQuery] = useQueryState("filters", {
    shallow: false,
  });
  const [commonFilter, setCommonFilter] = useQueryState("common_filter", {
    shallow: false,
  });
  const [pageNumber, setPageNumber_] = useQueryState("page_number", {
    shallow: false,
  });
  const setPageNumber = (pageNumber: string | undefined) => setPageNumber_(pageNumber || null);
  const [sortingStr, setSortingStr] = useQueryState("sorting", {
    shallow: false,
  });
  const [groupingStr, setGroupingStr] = useQueryState("grouping", {
    shallow: false,
  });

  const [columnOrderStr, setColumnOrderStr] = useQueryState("column_order");
  const [hiddenColumns, setHiddenColumns] = useQueryState("hidden_columns");
  const [columnsPinLeft, setColumnsPinLeft] = useQueryState("columns_pin_left");
  const [columnsPinRight, setColumnsPinRight] = useQueryState("columns_pin_right");
  const [context, setContext] = useQueryState("context", {shallow: false})

  /// Convert those strings → arrays/objects
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
    setHiddenColumns(hidden.length ? hidden.join(",") : null);
  };

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const sorting: ColumnSort[] = sortingStr
    ? sortingStr.split(",").map((c) => {
        const [key, order] = c.split("@");
        const id = entriesProperties.includes(key) ? `Entries/${key}` : `Parameters/${key}`;
        const desc = order === "true";
        return { id, desc };
      })
    : [];
  const setSorting = (s: ColumnSort[]) => 
    setSortingStr(s.map((item) => `${sanitizeId(item.id)}@${item.desc}`).join(","));
  const grouping: GroupingState = groupingStr ? groupingStr.split(",") : [];
  const setGrouping = (g: GroupingState) =>
    setGroupingStr(g.length ? g.join(",") : null);

  const columnPinning: ColumnPinningState = {
    left: columnsPinLeft ? columnsPinLeft.split(",") : [indicesTitle],
    right: columnsPinRight ? columnsPinRight.split(",") : [],
  };
  const setColumnPinning = (pin: ColumnPinningState) => {
    setColumnsPinLeft(pin.left ? pin.left.join(",") : null);
    setColumnsPinRight(pin.right ? pin.right.join(",") : null);
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

  const [_timestamp, _setTimestamp] = useQueryState("_timestamp", { shallow: false })

  const state = {
    selectedCells,
    metric,
    sorting,
    columnVisibility,
    columnOrder,
    columnFilters,
    grouping,
    columnPinning,
    columnSizing,
    context,
    draggingColumns,
    pinningState,
    _timestamp
  };
  const setState = {
    setSelectedCells,
    setMetric,
    setSorting,
    setColumnVisibility,
    setColumnOrder: (order: string[]) => setColumnOrderStr(order.join(",")),
    setColumnFilters,
    setGrouping,
    setColumnPinning,
    setColumnSizing,
    setContext,
    setDraggingColumns,
    setPinningState,
    _setTimestamp
  };

  // If the project changes, we treat it as pending until data arrives
  useEffect(() => {
    setPending(project !== projectQueryVal);
    // Summaries pending if the metric changed
    setSummaryPending(searchParams.metric !== metricQuery);
  }, [project, projectQueryVal, searchParams.metric, metricQuery]);

  // Use refs to detect a *real* page/filter change
  const prevPageRef = useRef(pageNumber);
  const prevFiltersRef = useRef(logsFiltersQuery);
  const prevCommonFilterRef = useRef(commonFilter);
  const prevSortingRef = useRef(sortingStr);
  const prevGroupingRef = useRef(groupingStr);

  // Prune base/comparison IDs if user REALLY changes page or filters
  useEffect(() => {
    const pageChanged = prevPageRef.current !== pageNumber;
    const filtersChanged = prevFiltersRef.current !== logsFiltersQuery;
    const commonChanged = prevCommonFilterRef.current !== commonFilter;
    const sortingChanged = prevSortingRef.current !== sortingStr;
    const groupingChanged = prevGroupingRef.current !== groupingStr;

    if (pageChanged || filtersChanged || commonChanged || sortingChanged || groupingChanged) {
      // If base no longer valid, remove it
      const flattenedLogs = maybeFlattenGroupedLogs(logs);
      if (baseLog && !(flattenedLogs).some((l) => l.id === baseLog.id)) {
        setSelectedCells(cells => cells.slice(1));
      }
      // If compare logs not valid, prune them
      if (comparisonLogs) {
        const ids = comparisonLogs.map(cl => cl.id);
        const validIds = ids.filter((id) => flattenedLogs.some((l) => l.id === id));
        if (!validIds.length) {
          setSelectedCells(cells => cells.at(0) ? [cells.at(0) as string] : []);
        } else if (validIds.length < ids.length) {
          setSelectedCells(cells => cells.filter(cell => validIds.includes(cell.split("_").at(0)!)));
        }
      }
    }
    // Update the refs
    prevPageRef.current = pageNumber;
    prevFiltersRef.current = logsFiltersQuery;
    prevCommonFilterRef.current = commonFilter;
    prevSortingRef.current = sortingStr
    prevGroupingRef.current = groupingStr
  }, [
    logs,
    pageNumber,
    logsFiltersQuery,
    commonFilter,
    sortingStr,
    groupingStr,
    selectedCells
  ]);

  const resetParamsStates = () => {
    setContext(null);
    setSelectedCells([])
    setColumnOrderStr(null);
    setHiddenColumns(null);
    setSortingStr(null);
    setGroupingStr(null);
    setColumnsPinLeft(null);
    setColumnsPinRight(null);
    setMetric(null);
    setPageNumber_(null);
    _setTimestamp(null)
  };

  // Build directory data
  const data = (projects || []).map((p) => ({ path: p, type: "file" }));

  // Top area: filters, page, etc.
  const tableTop = (
    <div className="flex flex-row justify-between gap-3 LogsTablePreferences">
      {project && columns.length > 0 && (
        <div className="flex flex-row gap-2 items-center">
          <SelectionMenu
            type="Contexts"
            data={Object.keys(dataTypes).map(property => ({path: property, type:"file"}))}
            onClick={setContext}
            logs={logs}
          />
          <GlobalFilter
            searchParams={searchParams}
            columnNames={columnIDs.slice(1)}
            commonFilterQuery={commonFilter || undefined}
            setCommonFilterQuery={setCommonFilter}
            setLogsFilters={(obj) => {
              const keys = Object.keys(obj);
              setLogsFiltersQuery(
                keys.length
                  ? Object.entries(obj)
                      .map(([colKey, val]) =>
                        Object.entries(val).map(([fn, val2]) => `${colKey}@${fn}@${val2}`)
                      )
                      .flat()
                      .join(",")
                  : null
              );
            }}
            logs={logs}
          />
          <VisibilityFilter
            columnVisibility={columnVisibility}
            setColumnVisibility={setColumnVisibility}
            context={context}
          />
        </div>
      )}
      {project && (
        <div className="w-fit scale-90">
          <PageController
            totalPages={totalPages}
            pageNumber={pageNumber || undefined}
            setPageNumber={setPageNumber}
            logs={logs}
            totalLogs={logs.length}
            pageLogs={logs.length}
            limit={20}
          />
        </div>
      )}
    </div>
  );

  const tableRef = useRef<HTMLDivElement>(null);

  // Handle clicking outside of the table
  const onContainerClick = (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
    if (tableRef.current && !tableRef.current.contains(event.target as Node)) {
      setSelectedCells([]);
    }
  }

  return (
    <div className="flex flex-col gap-4 w-full h-full p-3 bg-background rounded-md" onClick={onContainerClick}>
      {/* Project selection row */}
      <div className="flex flex-row justify-between gap-8 w-full h-fit">
        <div className="w-fit gap-2 flex flex-row items-center">
          <FileDirectory
            data={data}
            renamingFunction={projectActions.rename}
            setterFunction={(proj: FileProps | undefined) => {
              const newProj = proj ? proj.path : null;
              resetParamsStates();
              setProject(newProj);
            }}
            type="Projects"
            defaultValue={projectQueryVal}
            onOpen={() => _setTimestamp(Date.now().toString())}
          />
          {project && (
            <div className="flex flex-row gap-2">
              <CloseProject
                onClick={() => {
                  resetParamsStates();
                  setProject(null);
                }}
              />
              <DeleteDialog
                type="project"
                args={[project]}
                deletingFunction={projectActions.delete}
                variant="outline"
                onDelete={() => {
                  resetParamsStates()
                  setProject(null)
                }}
              />
            </div>
          )}
          {projects && <CreateProject creationFunction={projectActions.create} paths={projects} />}
        </div>
        {/* {project && 
          <RefreshLogs 
            context={context}
            project={project}
            filterExpression={filterExpression}
            sortingExpression={sortingExpression}
            getLatest={logsActions.getLatest}
            logs={logs}
          />
        } */}
      </div>

      {/* If truly pending or logs not present, show a spinner */}
      {showSpinner ? (
        <div className="flex justify-center items-center h-full w-full">
          <Loader2 className="animate-spin my-36" />
        </div>
      ) : (
        <div ref={tableRef} className="w-full h-fit overflow-y-auto tutorial-logs-table">
          {project ? (
            <div className="relative flex-col gap-2">
              {/* “summaryPending” can optionally show a small loader over the table if you like */}
              <DataTable
                className="LogsTable"
                data={logs}
                columns={columns}
                state={state}
                setState={setState}
                ColumnFilters={(column, filterLoading, setIsFiltered, setFilterLoading, open, setOpen) => (
                  <ColumnFilter
                    setColumnFilterQuery={(filtersObj) => {
                      const keys = Object.keys(filtersObj);
                      setLogsFiltersQuery(
                        keys.length
                          ? Object.entries(filtersObj)
                              .map(([cKey, val]) =>
                                Object.entries(val).map(([fn, val2]) => `${cKey}@${fn}@${val2}`)
                              )
                              .flat()
                              .join(",")
                          : null
                      );
                    }}
                    boundaries={boundaries}
                    columnFilters={searchParamToFilters(logsFiltersQuery ?? undefined, context ?? undefined)}
                    column={column.id}
                    dataTypes={dataTypes}
                    logs={logs}
                  />
                )}
                ColumnCreate={(previousColumn: string, setOpen: (open:boolean) => void) => (
                  <ColumnCreate project={project} currentTable="table" tableArguments={tableArguments} logs={logs} derive={derivedEntryActions.create} _setTimestamp={_setTimestamp}/>
                )}
                AggregatedCell={(cell, row) => (
                  <AggregatedCell cell={cell} row={row} params={logsData.params} metric={metric} />
                )}
                FooterCell={(column, resizeMap, table) => 
                  <FooterCell 
                    column={column} 
                    resizeMap={resizeMap} 
                    draggingColumns={state.draggingColumns}
                  >
                    {
                      column.columnDef.id === indicesTitle
                      ? <ColumnMetrics metric={state.metric} setMetric={setState.setMetric} logs={logs}/>
                      : !column.getIsGrouped()
                        ?	<SummaryCell column={column} state={state} metrics={metrics} pending={summaryPending} draggingColumns={state.draggingColumns} />
                        : 	null
                    }
                  </FooterCell>
                }
                // ExtraComponents={(table) => {
                //   return <DeleteCells selectedCells={selectedCells} logs={logs} deleteLogFields={logsActions.delete} context={context ?? undefined}/>
                // }}
                ExtraCellContent={(cell, isCellExpanded, setExpandedCells) => 
                  <CellPopover cell={cell} isCellExpanded={isCellExpanded} setExpandedCells={setExpandedCells}/>
                }
              />
            </div>
          ) : (
            <BaseTable items={[{ Entries: "Select a project to display your logs." }]} />
          )}
        </div>
      )}
    </div>
  );
};

export default LogsTable;