import React from "react";
import { DoublePanels } from "../Common/Body/DoublePanels";
import LogsTable from "./Table/Table";
import { LogFieldsProps, LogFieldsResponseProps, LogsResponseProps } from "@/types/evals/logs";
import { extractLogsData } from "@/utils/evals/common";
import Details from "./Details/Details";
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import { Suspense } from "react";
import { ResponseProps } from "@/types/common";
import { searchParamToFilters, filtersToExpression } from "@/utils/evals/filters";

const Main = async ({ searchParams, projectsActions, logsActions, fieldsActions }: {
	searchParams: { project?: string, page_number?: string, metric?: string, context?: string, filters?: string, common_filter?: string, sorting?: string },
	projectsActions: {
		get: () => Promise<string[]>,
		create: (name: string) => Promise<ResponseProps>,
		rename: (name: string, newName: string) => Promise<ResponseProps>,
		delete: (name: string) => Promise<ResponseProps>},
	logsActions: {
		get: (project: string, context: string | null, filterExpression: string | null, sortingExpression: string | null, limit: number | null, offset: number) => Promise<LogsResponseProps>,
		getLatest: (project: string, context: string | null, filterExpression: string | null, sortingExpression: string | null, limit: number | null, offset: number) => Promise<string>,
		getMetrics: (
			project: string, filterExpression: string | null, metricName: string, keyName: string
		) => Promise<number>,
		delete: (ids: string[]) => Promise<ResponseProps>
	},
	fieldsActions: {
		get: (project: string) => Promise<LogFieldsResponseProps>,
		delete: (fields: LogFieldsProps) => Promise<ResponseProps>
	}
}) => {

	/* Get projects list, selected project and its column types */
	const projects: string[] = await projectsActions.get();
	const project: string | undefined = projects.find(project => project == searchParams.project);
	const context = searchParams.context;
	let fields: LogFieldsResponseProps = {}
	if (project) {
		fields = await fieldsActions.get(project)
	}

	/* Handle filters */
	// 1- Convert filters search param value to a nested dictionary representation of column, function and values
	// 2- Join column filters with the corresponding filter functions and values using "and"
	// 3- Join common filters with the "in" filter function and common filter value using "or"
	// 4- Join common and column filters into a single filter expression
	const logsFilters : {[column: string]: {[fn: string]: string}} = searchParamToFilters(searchParams.filters, context) 
	const columnFiltersExpression = filtersToExpression(logsFilters) 
	const commonFiltersExpression = searchParams.common_filter && fields
		? Object.keys(fields)
			.map(column => `${searchParams.common_filter} in ${context ? context + column : column}`)
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
							context ? context + value.split("@")[0] : value.split("@")[0], 
							value.split("@")[1].replace("true", "descending").replace("false", "ascending")
						])
			) 
		: ""
	const sortingExpression = sortingObject ? JSON.stringify(sortingObject) : null

	/* Get logs, handle pagination and unpack log data */
	let logsData: LogsResponseProps = { params: {}, logs: [], count: 0 };
	let fullData: LogsResponseProps = { params: {}, logs: [], count: 0 };
	const limit = 16;
	const offset = (searchParams.page_number ? parseInt(searchParams.page_number) : 0) * limit;
	let totalPages = 1;
	if (project) {
		logsData = await logsActions.get(project, context ?? null, filterExpression, sortingExpression, limit, offset)
		fullData = await logsActions.get(project, context ?? null, filterExpression, null, null, 0)
		totalPages = Math.ceil(logsData.count / limit);
	}
	const { entriesProperties, paramsProperties, logs, params } = extractLogsData(logsData, fields, searchParams.context ?? null, searchParams.sorting ?? null);
	/* Handle column metrics */
	// Getting metrics for filtered logs, and min / max values for full logs. 
	// Min / max bounds are used to set the filtering range for numeric columns 
	const columns = logs.length ? [...entriesProperties, ...paramsProperties] : [];
	const getColumnMetrics = async (expression: string | null, metric: string | undefined) => {
		let fullColumns = columns
		if (context)
			fullColumns = fullColumns.map(column => context + column)
		const metricValues = await Promise.all(
			fullColumns.map(async (key) => logsActions.getMetrics(
				project!, expression, metric ? metric : "mean", key
			)
		));
		const metrics: { [key: string]: number } = columns.length 
			? columns
				.map((key, index) => ({ [key]: metricValues[index] }))
				.reduce((acc, curr) => ({...acc, ...curr})) 
			: {};
		return metrics
	}
	const metrics = await getColumnMetrics(filterExpression, searchParams.metric)
	const [minimums, maximums] = await Promise.all([
		getColumnMetrics(null, "min"),
		getColumnMetrics(null, "max")
	])
	const boundaries = { minimums, maximums }

	return <DoublePanels
		isLoading={false}
		first={
			<LogsTable
				searchParams={searchParams}
				projects={projects}
				project={project}
				logs={logs}
				columnTypes={fields}
				entriesProperties={entriesProperties}
				paramsProperties={paramsProperties}
				metrics={metrics}
				logsData={logsData}
				totalPages={totalPages}
				projectActions={projectsActions}
				logsActions={logsActions}
				fieldsActions={fieldsActions}
				boundaries={boundaries}
				filterExpression={filterExpression}
				sortingExpression={sortingExpression}
			/>
		}
		second={
			<DoublePanels
              	isLoading={false}
				first={
					<Suspense fallback={<SkeletonLoader />}>
						<Details
							project={project}
							params={params}
							logs={logs}
							fullLogs={fullData.logs}
						/>
					</Suspense>
				}
				second={
					<Suspense fallback={<SkeletonLoader />}>
						<Details
							project={project}
							params={params}
							logs={logs}
							fullLogs={fullData.logs}
						/>
					</Suspense>
				}
				direction="vertical"
				defaultFirstSize={100}
				defaultSecondSize={0}
			/>
		}
	/>
}

export default Main;
