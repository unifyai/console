"use client";

import DeleteDialog from "@/components/Common/Dialogs/Delete";
import { BaseTable } from "@/components/Common/Tables/Base";
import DataTable from "@/components/Common/Tables/Data/Base";
import FileDirectory from "@/components/Directory/FileDirectory";
import { LogProps, LogsResponseProps } from "@/types/projects/logs";
import { Row, ColumnDef, ColumnFiltersState, ColumnSort, ColumnPinningState, Updater } from "@tanstack/react-table";
import React, { useEffect, useState } from "react";
import { Loader2 } from 'lucide-react';
import { FileProps, ResponseProps } from "@/types/common";
import { buildTree, nestedColumns, onRowClick } from "@/utils/projects/table";
import IndexBadge from "./Content/IndexBadge";
import { useQueryState } from "nuqs";
import { useTableHotkeys } from "@/hooks/Logs/useTableHotkeys";
import ColumnFilter from "./Buttons/ColumnFilter";
import VersionBadge from "./Content/VersionBadge";
import AggregatedCell from "./Content/AggregatedCell";
import VisibilityFilter from "./Buttons/VisibilityFilter";
import DeleteRows from "./Buttons/DeleteRows";
import ColumnMetrics from "./Buttons/ColumnMetrics";
import SummaryCell from "./Content/SummaryCell";
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import PageController from "@/components/Common/Tables/Data/Buttons/PageController";


const LogsTable = ({ searchParams, projects, project, logs, entriesProperties, paramsProperties, metrics, logsData, projectActions, logsActions }: {
	searchParams: { project?: string, metric?: string, filters?: string },
	projects: string[] | undefined,
	project: string | undefined,
	logs: LogProps[],
	entriesProperties: string[],
	paramsProperties: string[],
	metrics: { [key: string]: number }
	logsData: LogsResponseProps,
	projectActions: {
		get: () => Promise<string[]>,
		rename: (oldName: string, newName: string) => Promise<ResponseProps>,
		delete: (name: string) => Promise<ResponseProps>
	}
	logsActions: {
		get: (project: string, filterExpression: string | null) => Promise<LogsResponseProps>,
		getMetrics: (
			project: string, filterExpression: string | null, metricName: string, keyName: string
		) => Promise<number>,
		delete: (ids: string[]) => Promise<ResponseProps>
	}
}) => {
	// pending state
	const [pending, setPending] = useState(false);
	const [summaryPending, setSummaryPending] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string>();

	// error message displayed for 5s
	useEffect(() => {
        if (error)
            setTimeout(() => setError(undefined), 3000)
    }, [error]);

	// get logs selected for comparison/details
	const [comparisonLogsParam, setComparisonLogsParam] = useQueryState("comparison");
	const comparisonLogs = comparisonLogsParam && logs ? comparisonLogsParam.split(",").map(
		(value: string) => logs.find(log => log.id == value)!
	) : [];
	const setComparisonLogs = (updater: Updater<LogProps[]>) => {
		if (typeof updater === "function") {
			const newComparisonLogs = updater(comparisonLogs);
			if (newComparisonLogs != undefined) {
				if (newComparisonLogs.length) {
					const ids = newComparisonLogs.map(
						l => logs.find(log => log.id == l.id)?.id
					).filter(id => Boolean(id));
					setComparisonLogsParam(ids.join(","));
				}
				else
					setComparisonLogsParam(null);
			}
			else
				setComparisonLogsParam(null);
		}
	}
	const [baseLogParam, setBaseLogParam] = useQueryState("base");
	const baseLog = baseLogParam && logs ? logs.find(log => log.id == baseLogParam) : undefined;
	const setBaseLog = (updater: Updater<LogProps | undefined>) => {
		if (typeof updater === "function") {
			const newBaseLog = updater(baseLog);
			const logFound = newBaseLog ? logs.find(log => log.id == newBaseLog.id)?.id : undefined;
			setBaseLogParam(logFound ? logFound : null);
		}
	}

	// getting columns from the properties
	const entriesTree = buildTree(entriesProperties);
	const paramsTree = buildTree(paramsProperties);
	const columns: ColumnDef<LogProps>[] = !logsData ? [] : [
		{
			id: "RowNumbering",
			cell: ({ row }: { row: Row<LogProps> }) => {
				return <IndexBadge
					row={row}
					baseLog={logs && baseLog ? baseLog : undefined}
					comparisonLogs={logs ? comparisonLogs : undefined}
				/>;
			},
			meta: {
				dataType: () => null,
				columnType: "util",
				enableRowSpan: false
			}
		},
		...(paramsProperties.length > 0 ? [
			{
				id: "ParametersHeader",
				header: "Parameters",
				columns: nestedColumns(paramsTree, "params", logsData, true)
			}
		] : []),
		...(paramsProperties.length > 0 ? [
			{
				id: "EntriesHeader",
				header: "Entries",
				columns: nestedColumns(entriesTree, "entries", logsData)
			},
		] : nestedColumns(entriesTree, "entries", logsData))
	];
	const columnIDs = ["RowNumbering", ...paramsProperties.concat(entriesProperties)];

	// project
	const [projectQuery, setProject] = useQueryState("project", { shallow: false });

	// log filters
	const [logsFiltersQuery, setLogsFiltersQuery] = useQueryState("filters", { shallow: false });
	const logsFilters = logsFiltersQuery ? Object.fromEntries(logsFiltersQuery.split(",").map((filter => {
		const [key, fn, value] = filter.split("@");
		return [key, { fn: fn, value: value }];
	}))) : {};
	const setLogsFilters = (logsFilters: { [key: string]: { fn: string, value: string } }) => {
		const keys = Object.keys(logsFilters).filter(key => logsFilters[key].fn);
		setBaseLogParam(null);
		setComparisonLogsParam(null);
		setLogsFiltersQuery(
			keys.length
				? Object.entries(logsFilters).map(
					([key, value]) => `${key}@${value.fn}@${value.value}`
				).join(",")
				: null
		);
	};

	// pagination
	const [pageIndex, setPageIndex] = useQueryState("page_index");
	const [pageSize, setPageSize] = useQueryState("page_size");
	const pagination = {
		pageIndex: pageIndex ? parseInt(pageIndex) - 1 : 0,
		pageSize: pageSize ? parseInt(pageSize) : 18
	};
	const setPagination = (pagination: { [key: string]: number }) => {
		setPageIndex(`${pagination.pageIndex + 1}`);
		setPageSize(`${pagination.pageSize}`);
	};
	let totalPages = logs ? Object.keys(logs).length / pagination.pageSize : 1;
	totalPages = totalPages != Math.floor(totalPages) ? Math.floor(totalPages) + 1 : totalPages;

	// column order
	const [columnOrderStr, setColumnOrderStr] = useQueryState("column_order");
	const columnOrder = columnOrderStr ? columnOrderStr.split(",") : columnIDs;
	const setColumnOrder = (columnOrder: string[]) => {
		setColumnOrderStr(columnOrder.join(","));
	};

	// column visibility
	const [hiddenColumns, setHiddenColumns] = useQueryState("hidden_columns");
	const allColumnsVisible = Object.fromEntries(columnIDs.map(id => [id, true]));
	const columnVisibility = hiddenColumns ? {
		...allColumnsVisible,
		...Object.fromEntries(
			hiddenColumns.split(",").map(id => [id, false])
		)
	} : allColumnsVisible;
	const setColumnVisibility = (columnVisibility: { [k: string]: boolean }) => {
		const hiddenColumns = Object.keys(columnVisibility).filter(key => !columnVisibility[key]);
		setHiddenColumns(hiddenColumns.length ? hiddenColumns.join(",") : null);
	};

	// column filters
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

	// sorting
	const [sortingStr, setSortingStr] = useQueryState("sorting");
	const sorting = sortingStr ? sortingStr.split(",").map(column => {
		const [id, desc] = column.split("@");
		return { id: id, desc: desc == "true" };
	}) : [];
	const setSorting = (sorting: ColumnSort[]) => {
		setSortingStr(sorting.map(col => `${col.id}@${col.desc}`).join(","));
	};

	// grouping
	const [groupingStr, setGroupingStr] = useQueryState("grouping");
	const grouping = groupingStr ? groupingStr.split(",") : [];
	const setGrouping = (grouping: string[]) => {
		setGroupingStr(grouping.length ? grouping.join(",") : null);
	};

	// pinning
	const [columnsPinLeft, setColumnsPinLeft] = useQueryState("columns_pin_left");
	const [columnsPinRight, setColumnsPinRight] = useQueryState("columns_pin_right");
	const columnPinning: ColumnPinningState = {
		left: columnsPinLeft ? ["RowNumbering"].concat(columnsPinLeft.split(",")) : ["RowNumbering"],
		right: columnsPinRight ? columnsPinRight.split(",") : []
	};
	const setColumnPinning = (columnPinning: ColumnPinningState) => {
		setColumnsPinLeft(columnPinning.left ? columnPinning.left.join(",") : null);
		setColumnsPinRight(columnPinning.right ? columnPinning.right.join(",") : null);
	};

	// Extra states
	let [metricQuery, setMetric] = useQueryState("metric", { shallow: false });
	const metric = metricQuery ? metricQuery : "mean";
	const [lastSelectedRow, setLastSelectedRow] = useState<Row<any | unknown> | undefined>();

	// state
	const state = {
		lastSelectedRow,
		metric,
		sorting,
		pagination,
		columnVisibility,
		columnOrder,
		columnFilters,
		grouping,
		columnPinning,
		comparisonLogs,
		baseLog
	};
	const setState = {
		setLastSelectedRow,
		setMetric,
		setSorting,
		setPagination,
		setColumnVisibility,
		setColumnOrder,
		setColumnFilters,
		setGrouping,
		setColumnPinning,
		setComparisonLogs,
		setBaseLog
	};

	// creating the projects list
	const data = (projects || []).map(datum => ({ path: datum, type: "file" }));

	// set pending when project changes
	useEffect(() => {
		if (project == projectQuery)
			setPending(false);
		else
			setPending(true);
		if (searchParams.metric == metricQuery)
			setSummaryPending(false);
		else
			setSummaryPending(true);
		if (searchParams.filters == logsFiltersQuery)
			setLoading(false);
		else
			setLoading(true);
	}, [project, projectQuery, searchParams, metricQuery, logsFiltersQuery]);

	return (
		<div className="flex flex-col gap-4 w-full h-full p-3 bg-background rounded-md">
			<div className="flex flex-row justify-between w-full h-fit">
				<div className="w-fit gap-3 flex flex-row">
					<FileDirectory
						data={data}
						renamingFunction={projectActions.rename}
						setterFunction={(project: FileProps | undefined) => {
							const projectPath = project ? project.path : null;
							setBaseLogParam(null);
							setComparisonLogsParam(null);
							setPageIndex(null);
							setPageSize(null);
							setColumnOrderStr(null);
							setHiddenColumns(null);
							setSortingStr(null);
							setGroupingStr(null);
							setColumnsPinLeft(null);
							setColumnsPinRight(null);
							setMetric(null);
							setProject(projectPath);
						}}
						type="Projects"
						defaultValue={projectQuery || undefined}
					/>
					{project && (
						<DeleteDialog
							type="project"
							resource={project}
							deletingFunction={projectActions.delete}
							variant="outline"
						/>
					)}
					<div className="flex flex-row gap-3 LogsTablePreferences">
						{
							project && columns.length &&
							<div className="flex flex-row gap-3">
								<VisibilityFilter columnVisibility={columnVisibility} setColumnVisibility={setColumnVisibility} />
							</div>
						}
					</div>
				</div>
				<div className="w-fit">
					<PageController totalPages={totalPages} pagination={pagination} setPagination={setPagination} />
				</div>
			</div>
			{pending
				? <SkeletonLoader />
				: <div className="w-full h-fit overflow-auto tutorial-logs-table">
					{project                    // If project selected
						? logs                  // If logs data found
							? <div className="relative flex-col gap-2">
								{loading && <div className="rounded-lg absolute z-20 w-full h-full flex justify-center">
									<Loader2 className="animate-spin my-36" />
								</div>}
								{error && <div className="text-sm text-red-500 m-1">{error}</div>}
								<DataTable
									data={logs}
									columns={columns}
									state={state}
									setState={setState}
									tableHotkeys={useTableHotkeys}
									onRowClick={(table, row, event) => onRowClick(logs, state, setState, table, row, event)}
									ColumnFilters={(column) => <>
										<ColumnFilter setError={setError} setFilters={setLogsFilters} filters={logsFilters} column={column} />
									</>}
									ExtraCellContent={(cell) => <VersionBadge cell={cell} />}
									AggregatedCell={(cell, row) => <AggregatedCell cell={cell} row={row} metric="mean" />}
									FooterCell={(column) => column.columnDef.id === "RowNumbering"
										? <ColumnMetrics metric={state.metric} setMetric={setState.setMetric} />
										: <SummaryCell column={column} state={state} metrics={metrics} pending={summaryPending} />
									}
									ExtraComponents={(table) => <>
										<DeleteRows
											selectedRows={table.getSelectedRowModel().rows}
											deleteLogs={logsActions.delete}
										/>
									</>}
								/>
							</div>
							: <DataTable state={state} setState={setState} columns={columns} data={[]} />
						: <BaseTable items={[{ "Entries": "Select a project to display your logs." }]} />
					}
				</div>}
		</div>
	);
};

export default LogsTable;
