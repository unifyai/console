"use client";

import DeleteDialog from "@/components/Common/Dialogs/Delete";
import { BaseTable } from "@/components/Common/Tables/Base";
import DataTable from "@/components/Common/Tables/Data/Base";
import FileDirectory from "@/components/Directory/FileDirectory";
import { LogFieldsProps, LogFieldsResponseProps, LogProps, LogsResponseProps } from "@/types/evals/logs";
import {
  ColumnDef,
  ColumnFiltersState,
  ColumnSort,
  ColumnPinningState,
  Updater,
  ColumnSizingState,
} from "@tanstack/react-table";
import React, { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { FileProps, ResponseProps } from "@/types/common";
import { buildTree, nestedColumns } from "@/utils/evals/table";
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

const LogsTable = ({
  searchParams,
  projects,
  project,
  logs,
  entriesProperties,
  paramsProperties,
  metrics,
  logsData,
  totalPages,
  columnTypes,
  projectActions,
  logsActions,
  fieldsActions,
  boundaries
}: {
  searchParams: {
    project?: string;
    page_number?: string;
    metric?: string;
    filters?: string;
    common_filter?: string;
  };
  projects: string[] | undefined;
  project: string | undefined;
  logs: LogProps[];
  entriesProperties: string[];
  paramsProperties: string[];
  metrics: { [key: string]: number };
  logsData: LogsResponseProps;
  totalPages: number;
  columnTypes: { [key: string]: string };
  projectActions: {
    get: () => Promise<string[]>;
    create: (name: string) => Promise<ResponseProps>;
    rename: (oldName: string, newName: string) => Promise<ResponseProps>;
    delete: (name: string) => Promise<ResponseProps>;
  };
  logsActions: {
    get: (
      project: string,
      filterExpression: string | null,
      sortingExpression: string | null,
      limit: number | null,
      offset: number
    ) => Promise<LogsResponseProps>;
    getMetrics: (
      project: string,
      filterExpression: string | null,
      metricName: string,
      keyName: string
    ) => Promise<number>;
    delete: (ids: string[]) => Promise<ResponseProps>;
  };
  fieldsActions: {
    get: (project: string) => Promise<LogFieldsResponseProps>,
    delete: (fields: LogFieldsProps) => Promise<ResponseProps>
  },
  boundaries: {minimums: {[key: string]: number}, maximums: {[key: string]: number}}
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
  const { baseLogIndex, baseLog, comparisonLogsIndex, comparisonLogs } = extractBaseAndComparisonLogs(selectedCells, logs)

  // Column definitions
  const entriesTree = buildTree(entriesProperties);
  const paramsTree = buildTree(paramsProperties);
  const columns: ColumnDef<LogProps>[] = [
    {
      id: "RowNumbering",
      cell: ({ row }) => <Badge>{row.index + 1}</Badge>,
      meta: {
        dataType: () => null,
        columnType: "util",
        enableRowSpan: false,
      },
    },
    ...(paramsProperties.length
      ? [
          {
            id: "ParametersHeader",
            header: "Parameters",
            columns: nestedColumns(paramsTree, "params", logsData, true),
          },
        ]
      : []),
    ...(paramsProperties.length
      ? [
          {
            id: "EntriesHeader",
            header: "Entries",
            columns: nestedColumns(entriesTree, "entries", logsData),
          },
        ]
      : nestedColumns(entriesTree, "entries", logsData)),
  ];

  // Various table states from the URL
  const [metricQuery, setMetric] = useQueryState("metric");
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

  const [columnOrderStr, setColumnOrderStr] = useQueryState("column_order");
  const [hiddenColumns, setHiddenColumns] = useQueryState("hidden_columns");
  const [groupingStr, setGroupingStr] = useQueryState("grouping");
  const [columnsPinLeft, setColumnsPinLeft] = useQueryState("columns_pin_left");
  const [columnsPinRight, setColumnsPinRight] = useQueryState("columns_pin_right");

  // Convert those strings → arrays/objects
  const columnIDs = ["RowNumbering", ...paramsProperties, ...entriesProperties];
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
        const [id, desc] = c.split("@");
        return { id, desc: desc === "true" };
      })
    : [];
  const setSorting = (s: ColumnSort[]) => 
    setSortingStr(s.map((item) => `${item.id}@${item.desc}`).join(","));
  const grouping = groupingStr ? groupingStr.split(",") : [];
  const setGrouping = (g: string[]) =>
    setGroupingStr(g.length ? g.join(",") : null);

  const columnPinning: ColumnPinningState = {
    left: columnsPinLeft ? ["RowNumbering"].concat(columnsPinLeft.split(",")) : ["RowNumbering"],
    right: columnsPinRight ? columnsPinRight.split(",") : [],
  };
  const setColumnPinning = (pin: ColumnPinningState) => {
    setColumnsPinLeft(pin.left ? pin.left.join(",") : null);
    setColumnsPinRight(pin.right ? pin.right.join(",") : null);
  };

  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(
    columnIDs
      .map((id) => ({ [id]: id === "RowNumbering" ? 50 : 150 }))
      .reduce((acc, curr) => ({ ...acc, ...curr }), {})
  );

  const state = {
    selectedCells,
    metric,
    sorting,
    columnVisibility,
    columnOrder,
    columnFilters,
    grouping,
    columnPinning,
    columnSizing
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
    setColumnSizing
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

  // Prune base/comparison IDs if user REALLY changes page or filters
  useEffect(() => {
    const pageChanged = prevPageRef.current !== pageNumber;
    const filtersChanged = prevFiltersRef.current !== logsFiltersQuery;
    const commonChanged = prevCommonFilterRef.current !== commonFilter;
    const sortingChanged = prevSortingRef.current !== sortingStr;

    if (pageChanged || filtersChanged || commonChanged || sortingChanged) {
      // If base no longer valid, remove it
      if (baseLog && !logs.some((l) => l.id === baseLog.id)) {
        setSelectedCells(cells => cells.slice(1));
      }
      // If compare logs not valid, prune them
      if (comparisonLogs) {
        const ids = comparisonLogs.map(cl => cl.id);
        const validIds = ids.filter((id) => logs.some((l) => l.id === id));
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
  }, [
    logs,
    pageNumber,
    logsFiltersQuery,
    commonFilter,
    sortingStr,
    selectedCells
  ]);

  const resetParamsStates = () => {
    setSelectedCells([])
    setColumnOrderStr(null);
    setHiddenColumns(null);
    setSortingStr(null);
    setGroupingStr(null);
    setColumnsPinLeft(null);
    setColumnsPinRight(null);
    setMetric(null);
    setPageNumber_(null);
  };

  // Build directory data
  const data = (projects || []).map((p) => ({ path: p, type: "file" }));

  // Top area: filters, page, etc.
  const tableTop = (
    <div className="flex flex-row justify-between gap-3 LogsTablePreferences">
      {project && columns.length > 0 && (
        <div className="flex flex-row gap-2 items-center">
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
          />
          <VisibilityFilter
            columnVisibility={columnVisibility}
            setColumnVisibility={setColumnVisibility}
          />
        </div>
      )}
      {project && (
        <div className="w-fit scale-90">
          <PageController
            totalPages={totalPages}
            pageNumber={pageNumber || undefined}
            setPageNumber={setPageNumber}
          />
        </div>
      )}
    </div>
  );

  // Handle clicking outside of the table
  const onContainerClick = (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
    const target = event.target as HTMLElement
    const className = target.className
    if (className.includes("flex")) {
      setSelectedCells([])
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
                resource={project}
                deletingFunction={projectActions.delete}
                variant="outline"
              />
            </div>
          )}
          {projects && <CreateProject creationFunction={projectActions.create} paths={projects} />}
        </div>
        {project && <RefreshLogs/>}
      </div>

      {/* If truly pending or logs not present, show a spinner */}
      {showSpinner ? (
        <div className="flex justify-center items-center h-full w-full">
          <Loader2 className="animate-spin my-36" />
        </div>
      ) : (
        <div className="w-full h-fit overflow-y-auto tutorial-logs-table">
          {project ? (
            <div className="relative flex-col gap-2">
              {/* “summaryPending” can optionally show a small loader over the table if you like */}
              <DataTable
                data={logs}
                columns={columns}
                state={state}
                setState={setState}
                TableTop={tableTop}
                ColumnFilters={(column) => (
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
                    columnFilters={searchParamToFilters(logsFiltersQuery ?? undefined)}
                    column={column.id}
                    columnTypes={columnTypes}
                  />
                )}
                AggregatedCell={(cell, row) => (
                  <AggregatedCell cell={cell} row={row} params={logsData.params} metric={metric} />
                )}
                FooterCell={(column, resizeMap) => 
                  <FooterCell column={column} resizeMap={resizeMap} >
                    {
                      column.columnDef.id === "RowNumbering"
                      ? <ColumnMetrics metric={state.metric} setMetric={setState.setMetric}/>
                      : !column.getIsGrouped()
                        ?	<SummaryCell column={column} state={state} metrics={metrics} pending={summaryPending} />
                        : 	null
                    }
                  </FooterCell>
                }
                ExtraComponents={(table) => {
                  return <DeleteCells selectedCells={selectedCells} logs={logs} deleteLogFields={fieldsActions.delete}/>
                }}
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