"use client";

import DeleteDialog from "@/components/Common/Dialogs/Delete";
import { BaseTable } from "@/components/Common/Tables/Base";
import DataTable from "@/components/Common/Tables/Data/Base";
import FileDirectory from "@/components/Tree/Directory/FileDirectory";
import { LogFieldsProps, LogFieldsResponseProps, LogProps, LogsResponseProps } from "@/types/evals/logs";
import {
  ColumnDef,
  ColumnFiltersState,
  ColumnSort,
  ColumnPinningState,
  ColumnSizingState,
} from "@tanstack/react-table";
import React, { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { FileProps, ResponseProps } from "@/types/common";
import { buildTree, nestedColumns, encodeRenderedDepth } from "@/utils/evals/table";
import { Badge } from "@/components/UI/badge";
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
import { extractBaseAndComparisonLogs } from "@/utils/evals/selection";
import RefreshLogs from "./Buttons/RefreshLogs";
import { searchParamToFilters } from "@/utils/evals/filters";
import CellPopover from "./Content/CellPopover";
import { ItemType, TileProps } from "@/types/evals/grid";
import SelectionMenu from "@/components/Tree/SelectionMenu/SelectionMenu";
import { inplaceRefreshUsingContext } from "@/utils/evals/common";
import { flattenColumnIDs, sanitizeId } from "@/utils/evals/columnOperations";

const LogsTable = ({
  projects,
  project,
  pending,
  item,
  logs,
  entriesProperties,
  paramsProperties,
  metrics,
  logsData,
  totalPages,
  columnTypes,
  boundaries,
  setProject,
  updateItem,
  projectActions,
  logsActions,
  fieldsActions,
  filterExpression,
  sortingExpression,
}: {
  projects: string[] | undefined;
  project: string | undefined;
  pending: boolean;
  tab: string;
  item: TileProps;
  logs: LogProps[];
  entriesProperties: string[];
  paramsProperties: string[];
  metrics: { [key: string]: any };
  logsData: LogsResponseProps;
  totalPages: number;
  columnTypes: { [key: string]: string };
  boundaries: {minimums: {[key: string]: number}, maximums: {[key: string]: number}};
  setProject: Dispatch<SetStateAction<string | undefined>>;
  updateItem: (item: TileProps, attrName: ItemType) => (newValue: string | undefined) => void;
  projectActions: {
    get: () => Promise<string[]>;
    create: (name: string) => Promise<ResponseProps>;
    rename: (oldName: string, newName: string) => Promise<ResponseProps>;
    delete: (name: string) => Promise<ResponseProps>;
  };
  logsActions: {
    get: (
      project: string,
      context: string | null,
      filterExpression: string | null,
      sortingExpression: string | null,
      from_fields: string | null,
      limit: number | null,
      offset: number
    ) => Promise<LogsResponseProps>,
    getLatest: (
      project: string, 
      context: string | null, 
      filterExpression: string | null, 
      sortingExpression: string | null,
      from_fields: string | null,
      limit: number | null, 
      offset: number
    ) => Promise<string>,
    getMetrics: (
      project: string,
      filterExpression: string | null,
      metricName: string,
      keyName: string
    ) => Promise<number>;
    delete: (ids_and_fields: LogFieldsProps) => Promise<ResponseProps>
  };
  fieldsActions: {
    get: (project: string) => Promise<LogFieldsResponseProps>,
  },
  filterExpression: string | null,
  sortingExpression: string | null,
}) => {
  // Basic states for quick feedback
  const [summaryPending, setSummaryPending] = useState(false); // if metric changed

  // We skip complicated "loading" checks to avoid the stuck spinner:
  // just show a spinner if logs are truly undefined or project is pending
  // (for example, remove "loading" if you want). 
  const showSpinner = pending || !logs;

  // Get base and comparison logs
  const selectedCells = item.selected ? item.selected.split(",") : [];
  const { baseLog, comparisonLogs } = extractBaseAndComparisonLogs(selectedCells, logs)

  // Column definitions
  const entriesTree = buildTree(entriesProperties);
  const paramsTree = buildTree(paramsProperties);

  const indicesTitle = "RowNumbering";
  const entriesTitle = "Entries";
  const paramsTitle = "Parameters";

  const columns: ColumnDef<LogProps>[] = [
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
            columns: nestedColumns(paramsTree, "params", paramsTitle, logsData, true, columnTypes),
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
            columns: nestedColumns(entriesTree, "entries", entriesTitle, logsData, false, columnTypes),
            meta: {
              columnType: "entriesHeader",
              isParent: true,
              renderedDepth: -1,  // Needed for grouping, showing, hiding multiple column nests
            },
          },
        ]
      : nestedColumns(entriesTree, "entries", entriesTitle, logsData, false, columnTypes)),
  ];

  // Apply rendered depth encoding to account for depth mismatch for all headers
  // This is needed for accurate column hiding/showing/grouping to work on all nest levels
  // Always assign depth = 0 for the meta column types as passed here
  encodeRenderedDepth(columns, ["util", "paramsHeader", "entriesHeader"]);

  // Various table states from the URL
  const metric = item.metric || "mean";
  const logsFilters = item.filters;
  const commonFilter = item.common_filter;
  const pageNumber = item.page_number;
  const columnOrderStr = item.column_order;
  const hiddenColumns = item.hidden_columns;
  const sortingStr = item.sorting;
  const groupingStr = item.grouping;
  const columnsPinLeft = item.columns_pin_left;
  const columnsPinRight = item.columns_pin_right;

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
    updateItem(item, "hidden_columns")(hidden.length ? hidden.join(",") : undefined);
  };

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const sorting: ColumnSort[] = sortingStr
    ? sortingStr.split(",").map((c) => {
        const [id, desc] = c.split("@");
        return { id, desc: desc === "true" };
      })
    : [];
  const setSorting = (s: ColumnSort[]) =>
    updateItem(item, "sorting")(s.map((item) => `${sanitizeId(item.id)}@${item.desc}`).join(","));

  const grouping = groupingStr ? groupingStr.split(",") : [];
  const setGrouping = (g: string[]) =>
    updateItem(item, "grouping")(g.length ? g.join(",") : undefined);

  const columnPinning: ColumnPinningState = {
    left: columnsPinLeft ? [indicesTitle].concat(columnsPinLeft.split(",")) : [indicesTitle],
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
    setSelectedCells: (cells: string[]) => updateItem(item, "selected")(cells.join(",")),
    setMetric: updateItem(item, "metric"),
    setSorting,
    setColumnVisibility,
    setColumnOrder: (order: string[]) => updateItem(item, "column_order")(order.join(",")),
    setColumnFilters,
    setGrouping,
    setColumnPinning,
    setColumnSizing
  };

  // Use refs to detect a *real* page/filter change
  const prevPageRef = useRef(pageNumber);
  const prevFiltersRef = useRef(logsFilters);
  const prevCommonFilterRef = useRef(commonFilter);
  const prevSortingRef = useRef(sortingStr);

  // Prune base/comparison IDs if user REALLY changes page or filters
  useEffect(() => {
    const pageChanged = prevPageRef.current !== pageNumber;
    const filtersChanged = prevFiltersRef.current !== logsFilters;
    const commonChanged = prevCommonFilterRef.current !== commonFilter;
    const sortingChanged = prevSortingRef.current !== sortingStr;

    if (pageChanged || filtersChanged || commonChanged || sortingChanged) {
      // If base no longer valid, remove it
      if (baseLog && !logs.some((l) => l.id === baseLog.id)) {
        updateItem(item, "selected")(selectedCells.slice(1).join(","));
      }
      // If compare logs not valid, prune them
      if (comparisonLogs) {
        const ids = comparisonLogs.map(cl => cl.id);
        const validIds = ids.filter((id) => logs.some((l) => l.id === id));
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
  }, [
    logs,
    pageNumber,
    logsFilters,
    commonFilter,
    sortingStr,
    selectedCells
  ]);

  const resetParamsStates = () => {
    updateItem(item, "selected")("");
    updateItem(item, "column_order")(undefined);
    updateItem(item, "hidden_columns")(undefined);
    updateItem(item, "sorting")(undefined);
    updateItem(item, "grouping")(undefined);
    updateItem(item, "columns_pin_left")(undefined);
    updateItem(item, "columns_pin_right")(undefined);
    updateItem(item, "metric")("mean");
    updateItem(item, "page_number")(undefined);
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
            data={Object.keys(columnTypes).map(property => ({path: property, type:"file"}))}
            onClick={updateItem(item, "context")}
          />
          <GlobalFilter
            logsFilters={logsFilters}
            commonFilter_={commonFilter}
            setCommonFilter_={updateItem(item, "common_filter")}
            setLogsFilters={(obj) => {
              const keys = Object.keys(obj);
              updateItem(item, "filters")(
                keys.length
                  ? Object.entries(obj)
                      .map(([colKey, val]) =>
                        Object.entries(val).map(([fn, val2]) => `${colKey}@${fn}@${val2}`)
                      )
                      .flat()
                      .join(",")
                  : undefined
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
            pageNumber={pageNumber}
            setPageNumber={updateItem(item, "page_number")}
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
      updateItem(item, "selected")("");
    }
  }
  return (
    <div className="flex-1 flex flex-col gap-4 w-full p-3 bg-background rounded-md" onClick={onContainerClick}>
      {/* Project selection row */}
      <div className="flex flex-row justify-between gap-8 w-full h-fit">
        <div className="w-fit gap-2 flex flex-row items-center">
          <FileDirectory
            data={data}
            renamingFunction={projectActions.rename}
            setterFunction={(proj: FileProps | undefined) => {
              const newProj = proj ? proj.path : undefined;
              resetParamsStates();
              setProject(newProj);
            }}
            type="Projects"
            defaultValue={project}
            onOpen={() => inplaceRefreshUsingContext(item.context, updateItem(item, "context"))}
          />
          {project && (
            <div className="flex flex-row gap-2">
              <CloseProject
                onClick={() => {
                  resetParamsStates();
                  setProject(undefined);
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
        {project && 
          <RefreshLogs
            auto={item.auto_update}
            setAuto={updateItem(item, "auto_update")}
            context={item.context}
            setContext={updateItem(item, "context")}
            project={project}
            filterExpression={filterExpression}
            sortingExpression={sortingExpression}
            getLatest={logsActions.getLatest}
          />
        }
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
                      updateItem(item, "filters")(
                        keys.length
                          ? Object.entries(filtersObj)
                              .map(([cKey, val]) =>
                                Object.entries(val).map(([fn, val2]) => `${cKey}@${fn}@${val2}`)
                              )
                              .flat()
                              .join(",")
                          : undefined
                      );
                    }}
                    boundaries={boundaries}
                    columnFilters={searchParamToFilters(logsFilters, item.context)}
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
                      column.columnDef.id === indicesTitle
                      ? <ColumnMetrics metric={state.metric} setMetric={setState.setMetric}/>
                      : !column.getIsGrouped()
                        ?	<SummaryCell column={column} state={state} metrics={metrics} pending={summaryPending} />
                        : 	null
                    }
                  </FooterCell>
                }
                ExtraComponents={(table) => {
                  return <DeleteCells selectedCells={selectedCells} logs={logs} deleteLogFields={logsActions.delete} context={item.context}/>
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
