import React from "react";
import { DoublePanels } from "../Common/Body/DoublePanels";
import LogsTable from "./Table/Table";
import { LogsResponseProps } from "@/types/projects/logs";
import { extractLogsData } from "@/utils/projects/common";
import Details from "./Details/Details";
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import { Suspense } from "react";
import { ResponseProps } from "@/types/common";
import { DatasetProps } from "@/types/projects/datasets";

const Main = async ({ searchParams, projectsActions, logsActions, datasetsActions }: {
	searchParams: { project?: string, metric?: string, filters?: string },
	projectsActions: {
		get: () => Promise<string[]>,
		rename: (name: string, newName: string) => Promise<ResponseProps>,
		delete: (name: string) => Promise<ResponseProps>},
	logsActions: {
		get: (project: string, filterExpression: string | null) => Promise<LogsResponseProps>,
		getMetrics: (
			project: string, filterExpression: string | null, metricName: string, keyName: string
		) => Promise<number>,
		delete: (ids: string[]) => Promise<ResponseProps>
	},
	datasetsActions: {
		getEntries: (project: string) => Promise<DatasetProps[]>
		get: () => Promise<{ name: string }[]>,
		rename: (name: string, newName: string) => Promise<ResponseProps>,
		delete: (name: string) => Promise<ResponseProps>,
	}
}) => {
	// get projects
	const projects: string[] = await projectsActions.get();
	const project: string | undefined = projects.find(project => project == searchParams.project);

	// get logs
	const logsFilters = searchParams.filters ? Object.fromEntries(searchParams.filters.split(",").map((filter => {
		const [key, fn, value] = filter.split("@");
		return [key, { fn: fn, value: value }];
	}))) : undefined;
	const filterExpression = logsFilters ?Object.entries(logsFilters).map(
		([key, value]) => `${key} ${value.fn} ${value.value}`
	).join(" and ") : null;
	let logsData: LogsResponseProps = { params: {}, logs: [] };
	if (project)
		logsData = await logsActions.get(project, filterExpression);

	// process log data for display
	const { entriesProperties, paramsProperties, logs, params } = extractLogsData(logsData);

	const allProps = [...entriesProperties, ...paramsProperties];
	const metricValues = await Promise.all(allProps.map(async (key) =>
		logsActions.getMetrics(
			project!, filterExpression, searchParams.metric ? searchParams.metric : "mean", key
		)
	));
	const metrics: { [key: string]: number } = allProps.length ? allProps.map(
		(key, index) => ({ [key]: metricValues[index] })
	).reduce(
		(acc, curr) => ({...acc, ...curr})
	) : {};

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
				projectActions={projectsActions}
				logsActions={logsActions}
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
							datasetsActions={datasetsActions}
						/>
					</Suspense>
				}
				second={
					<Suspense fallback={<SkeletonLoader />}>
						<Details
							project={project}
							params={params}
							logs={logs}
							datasetsActions={datasetsActions}
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
