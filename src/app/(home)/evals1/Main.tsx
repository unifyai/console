import { ResponseProps } from "@/types/common";
import CardGrid from "./CardGrid";
import { LogColumnsProps, LogsResponseProps } from "@/types/evals/logs";
import { extractLogsData } from "@/utils/evals/common";

const Main = async ({ searchParams, projectsActions, logsActions }: {
    searchParams: { project?: string, page_number?: string, metric?: string, filters?: string, common_filter?: string },
    projectsActions: {
        get: () => Promise<string[]>,
        create: (name: string) => Promise<ResponseProps>,
        rename: (name: string, newName: string) => Promise<ResponseProps>,
        delete: (name: string) => Promise<ResponseProps>
    },
    logsActions: {
        get: (project: string, filterExpression: string | null, limit: number, offset: number) => Promise<LogsResponseProps>,
        getColumns: (project: string) => Promise<LogColumnsProps>,
        getMetrics: (
            project: string, filterExpression: string | null, metricName: string, keyName: string
        ) => Promise<number>,
        delete: (ids: string[]) => Promise<ResponseProps>
    }
}) => {
    // get projects
    const projects: string[] = await projectsActions.get();
    const project: string | undefined = projects.find(project => project == searchParams.project);

    // get logs
    const logsFilters = searchParams.filters ? searchParams.filters.split(",").map((filter => {
        const [key, fn, value] = filter.split("@");
        return { [key]: { [fn]: value } };
    })).reduce((acc, curr) => {
        for (const key in curr) {
            if (acc.hasOwnProperty(key))
                acc[key] = { ...acc[key], ...curr[key] };
            else
                acc[key] = curr[key];
        }
        return acc;
    }, {}) : null;
    let filterStr: string = "", filterParams: string[] = [];
    if (searchParams.common_filter)
        [filterStr, ...filterParams] = searchParams.common_filter.split(",");
    const filterExpression = searchParams.common_filter ? filterParams.map(
        filter => `${filterStr} in ${filter}`
    ).join(" or ") : logsFilters ? Object.entries(logsFilters).map(
        ([key, value]) => Object.entries(value).map(
            ([fn, val]) => fn === "in" ? `${val} ${fn} ${key}` : `${key} ${fn} ${val}`
        )
    ).flat().join(" and ") : null;
    const limit = 16;
    const offset = (searchParams.page_number ? parseInt(searchParams.page_number) : 0) * limit;
    let totalPages = 1;
    let logsData: LogsResponseProps = { params: {}, logs: [], count: 0 };
    let logColumns: LogColumnsProps = {}
    if (project) {
        [logsData, logColumns] = await Promise.all([
            logsActions.get(project, filterExpression, limit, offset),
            logsActions.getColumns(project)
        ]);
        totalPages = Math.ceil(logsData.count / limit);
    }

    // process log data for display
    const { entriesProperties, paramsProperties, logs, params } = extractLogsData(logsData, logColumns);
    const columnTypes = { ...logColumns.entries, ...logColumns.params };

    const allProps = logs.length ? [...entriesProperties, ...paramsProperties] : [];
    const metricValues = await Promise.all(allProps.map(async (key) =>
        logsActions.getMetrics(
            project!, filterExpression, searchParams.metric ? searchParams.metric : "mean", key
        )
    ));
    const metrics: { [key: string]: number } = allProps.length ? allProps.map(
        (key, index) => ({ [key]: metricValues[index] })
    ).reduce(
        (acc, curr) => ({ ...acc, ...curr })
    ) : {};
    return <CardGrid
        searchParams={searchParams}
		projects={projects}
		project={project}
		logs={logs}
		columnTypes={columnTypes}
		entriesProperties={entriesProperties}
		paramsProperties={paramsProperties}
		metrics={metrics}
		logsData={logsData}
		totalPages={totalPages}
		projectActions={projectsActions}
		logsActions={logsActions}
        params={params}
    />;
};

export default Main;
