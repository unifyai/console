import React from "react";
import { DoublePanels } from "../Common/Body/DoublePanels";
import LogsTable from "./Table/Table";
import { getLogsParameters, TableArguments, LogFieldsProps, LogFieldsResponseProps, LogsResponseProps, LogProps, GroupedLogProps } from "@/types/evals/logs";
import { extractLogsData, maybeFlattenGroupedLogs } from "@/utils/evals/common";
import Details from "./Details/Details";
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import { Suspense } from "react";
import { ResponseProps } from "@/types/common";
import { searchParamToFilters, filtersToExpression } from "@/utils/evals/filters";
import { processContext } from "@/utils/evals/columnOperations";

const Main = async ({ searchParams, projectsActions, logsActions, fieldsActions, derivedEntryActions }: {
	searchParams: { project?: string, page_number?: string, metric?: string, context?: string, filters?: string, common_filter?: string, sorting?: string, plot_type?: string, x_axis?: string, y_axis?: string, plot_group_by?: string, _timestamp?: string, grouping?: string | null },
	projectsActions: {
		get: () => Promise<string[]>,
		create: (name: string) => Promise<ResponseProps>,
		rename: (name: string, newName: string) => Promise<ResponseProps>,
		delete: (name: string) => Promise<ResponseProps>},
	logsActions: {
		get: (project: string, context: string | null, filterExpression: string | null, sortingExpression: string | null, groupingExpression: string | null, from_fields: string | null, exclude_fields: string | null, limit: number | null, offset: number, _timestamp: string | null) => Promise<LogsResponseProps>,
		getLatest: (project: string, context: string | null, filterExpression: string | null, sortingExpression: string | null, groupingExpression: string | null, from_fields: string | null, exclude_fields: string | null, limit: number | null, offset: number) => Promise<string>,
		getMetrics: (
			project: string, filterExpression: string | null, metricName: string, keyName: string
		) => Promise<number>,
		delete: (ids_and_fields: LogFieldsProps) => Promise<ResponseProps>,
	},
	derivedEntryActions: {
		create: (project: string, key: string, equation: string, referenced_logs: {[table_name: string]: getLogsParameters}) => Promise<ResponseProps>,
		update: (project: string, key: string | null, equation: string | null, target_derived_logs: {[table_name: string]: getLogsParameters}) => Promise<ResponseProps>
	}
	fieldsActions: {
		get: (project: string) => Promise<LogFieldsResponseProps>,
	}
}) => {

	// Timestamp parameter is used to stamp endpoint calls and periodically revalidate cache for streaming / updating purposes
	const _timestamp = searchParams._timestamp ?? null

	/* Get projects list, selected project and its column types */
	const projects: string[] = await projectsActions.get();
	const project: string | undefined = projects.find(project => project == searchParams.project);
	const context = searchParams.context;
	let fields: LogFieldsResponseProps = {}
	let types: {[key: string] : string} = {}
	if (project) {
		fields = await fieldsActions.get(project)
	}

	/* Handle filters */
	// 1- Convert filters search param value to a nested dictionary representation of column, function and values
	// 2- Join column filters with the corresponding filter functions and values using "and"
	// 3- Join common filters with the "in" filter function and common filter value using "or"
	// 4- Join common and column filters into a single filter expression
	const logsFilters : {[column: string]: {[fn: string]: string}} = searchParamToFilters(searchParams.filters, context) 
	const columnFiltersExpression = filtersToExpression(logsFilters, fields) 
	const commonFiltersExpression = searchParams.common_filter && fields
		? Object.keys(
			Object.fromEntries(Object.entries(fields).filter(([key, value]) => value.field_type != "derived_entry"))	// Exclude derived entries from filters
		)
			.map(column => `${searchParams.common_filter} in ${context ? processContext("merge", context, column) : column}`)
			.join(" or ")
		: ""
	let filterExpression = null
	if (columnFiltersExpression) filterExpression = columnFiltersExpression
	if (commonFiltersExpression) filterExpression = filterExpression ? `${commonFiltersExpression} and ${filterExpression}` : commonFiltersExpression;

	/* Handle sorting */
	const sortingObject = searchParams.sorting 
		? Object.fromEntries(
			searchParams.sorting
						.split(",")
						.map(value => [
							context ? processContext("merge", context, value.split("@")[0]) : value.split("@")[0], 
							value.split("@")[1].replace("true", "descending").replace("false", "ascending")
						])
			) 
		: ""
	const sortingExpression = sortingObject ? JSON.stringify(sortingObject) : null

	/* Handle grouping */
	const groupingExpression = searchParams.grouping ? searchParams.grouping : null;

	/* Get logs with pagination, and plot logs subset */
	
	let logsData: LogsResponseProps = { params: {}, logs: [], count: 0, grouped_entries: {} };
	const limit = 100;
	const offset = (searchParams.page_number ? parseInt(searchParams.page_number) : 0) * limit;
	let totalPages = 1;
	let plotData: LogsResponseProps = { params: {}, logs: [], count: 0, grouped_entries: {} };
	const plotFields = Object.fromEntries(
		Object
			.entries(fields)
			.filter(([name, { data_type, field_type }]) => context ? name.startsWith(context) : name)
			.map(([name, { data_type, field_type, artifacts }]) => {
				const newName = context ? processContext("split", context, name) : name;
				return [newName, { data_type, field_type, artifacts }];
			})
	);
	if (project) {

		logsData = await logsActions.get(project, context ?? null, filterExpression, sortingExpression, groupingExpression, null, null, limit, offset, _timestamp)
		totalPages = Math.ceil(logsData.count / limit);

		const xAxis = context ? processContext("merge", context, searchParams.x_axis)  : searchParams.x_axis
		const yAxis = context ? processContext("merge", context, searchParams.y_axis)  : searchParams.y_axis
		const group = context ?  processContext("merge", context, searchParams.plot_group_by) : searchParams.plot_group_by
		if (xAxis) {
			let subset = xAxis
			if (searchParams.plot_type === "Bar Chart") 
				plotData = await logsActions.get(project, context ?? null, filterExpression, null, null, subset, null, null, 0, _timestamp)
			else {
				if (yAxis)
					subset += `%26${yAxis}`
					if (group) subset += `%26${group}`
					plotData = await logsActions.get(project, context ?? null, filterExpression, null, null, subset, null, null, 0, _timestamp)
			}
		}
	}

	const { entriesProperties, paramsProperties, logs, params } = extractLogsData(logsData, fields, searchParams.context ?? null, searchParams.sorting ?? null, undefined);
	
	
	/* Aggregate table arguments */
	let tableArguments : TableArguments = { 
		"table": {
			getLogs_parameters: {filter_expr: ""}, 
			available_fields: Object.fromEntries(
				Object.entries(fields)
					  .filter((([field, attributes]) => entriesProperties.concat(paramsProperties).includes(field))))
		}
	}
	if (filterExpression) tableArguments["table"].getLogs_parameters["filter_expr"] = filterExpression
	if (sortingExpression) tableArguments["table"].getLogs_parameters["sorting"] = sortingExpression 
	if (context) tableArguments["table"].getLogs_parameters["context"] = context
	
	/* Handle column metrics */
	// Getting metrics for filtered logs, and min / max values for full logs. 
	// Min / max bounds are used to set the filtering range for numeric columns 
	const columns = logs.length ? [...entriesProperties, ...paramsProperties] : [];
	const getColumnMetrics = async (expression: string | null, metric: string | undefined) => {
		let fullColumns = columns
		if (context)
			fullColumns = fullColumns.map(column => processContext("merge", context, column))
		const metricValues = await Promise.all(
			fullColumns.map(async (key) => {
			  try {
				const result = await logsActions.getMetrics(
				  project!,
				  expression,
				  metric ? metric : "mean",
				  key
				);
				return result;
			  } catch (error) {
				console.error(`Error fetching metric for key ${key}`);
				return "";
			  }
			})
		  );
		const metrics: { [key: string]: any } = columns.length 
			? columns
				.map((key, index) => ({ [key]: metricValues[index] }))
				.reduce((acc, curr) => ({...acc, ...curr})) 
			: {};
		return metrics
	}
	const metrics = await getColumnMetrics(filterExpression, searchParams.metric)

	// Min-max boundaries for numeric and time-like column filters
	const [minimums, maximums] = await Promise.all([
		getColumnMetrics(null, "min"),
		getColumnMetrics(null, "max")
	])
	const boundaries = { minimums, maximums }

	const flattenedLogs = maybeFlattenGroupedLogs(logs);

	return <DoublePanels
		isLoading={false}
		first={
			<LogsTable
				searchParams={searchParams}
				projects={projects}
				project={project}
				logs={logs}
				entriesProperties={entriesProperties}
				paramsProperties={paramsProperties}
				metrics={metrics}
				logsData={logsData}
				totalPages={totalPages}
				projectActions={projectsActions}
				logsActions={logsActions}
				derivedEntryActions={derivedEntryActions}
				fields={fields}
				tableArguments={tableArguments}
				fieldsActions={fieldsActions}
				boundaries={boundaries}
				filterExpression={filterExpression}
				sortingExpression={sortingExpression}
				groupingExpression={groupingExpression}
			/>
		}
		second={
			<Suspense fallback={<SkeletonLoader />}>
				<Details
					project={project}
					params={params}
					logs={flattenedLogs}
					plotLogs={plotData.logs as LogProps[]}
					fields={plotFields}
				/>
			</Suspense>
		}
	/>
}

export default Main;
