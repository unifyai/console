import { ResponseProps } from "@/types/common";
import CardGrid from "@/components/Evals/CardGrid";
import { LogFieldsProps, LogFieldsResponseProps, LogsResponseProps } from "@/types/evals/logs";
import { extractLogsData } from "@/utils/evals/common";
import { TileProps } from "@/types/evals/grid";

const Main = async ({ searchParams, projectsActions, logsActions, fieldsActions, interfaceActions }: {
    searchParams: { project?: string, page_number?: string, metric?: string, filters?: string, common_filter?: string },
    projectsActions: {
        get: () => Promise<string[]>,
        create: (name: string) => Promise<ResponseProps>,
        rename: (name: string, newName: string) => Promise<ResponseProps>,
        delete: (name: string) => Promise<ResponseProps>
    },
    logsActions: {
        get: (project: string, filterExpression: string | null, limit: number, offset: number) => Promise<LogsResponseProps>,
        getMetrics: (
            project: string, filterExpression: string | null, metricName: string, keyName: string
        ) => Promise<number>,
        delete: (ids: string[]) => Promise<ResponseProps>
    },
    fieldsActions: {
        get: (project: string) => Promise<LogFieldsResponseProps>,
        delete: (fields: LogFieldsProps) => Promise<ResponseProps>
    },
    interfaceActions: {
        get: () => Promise<{ items: TileProps[], new_counter: number } | null>,
        create: (items: TileProps[], new_counter: number) => Promise<ResponseProps>,
        update: (items: TileProps[], new_counter: number) => Promise<ResponseProps>,
    }
}) => {
    // get projects
    const projects: string[] = await projectsActions.get();
    const project: string | undefined = projects.find(project => project == searchParams.project);

    // get interface
    let interface_: { items: TileProps[], new_counter: number } | null = await interfaceActions.get();
    let interfaceCreated = true;
    if (!interface_) {
        interfaceCreated = false;
        interface_ = {
            items: [{ i: "n0", x: 0, y: 0, w: 3, h: 3, tab: undefined, moved: false, static: false }],
            new_counter: 1
        };
    }

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
    const limit = 14;
    const offset = (searchParams.page_number ? parseInt(searchParams.page_number) : 0) * limit;
    let totalPages = 1;
    let logsData: LogsResponseProps = { params: {}, logs: [], count: 0 };
    let logColumns: LogFieldsResponseProps = {};
    if (project) {
        [logsData, logColumns] = await Promise.all([
            logsActions.get(project, filterExpression, limit, offset),
            fieldsActions.get(project)
        ]);
        totalPages = Math.ceil(logsData.count / limit);
    }

    // process log data for display
    const { entriesProperties, paramsProperties, logs, params } = extractLogsData(logsData, logColumns);
    const columnTypes = { ...logColumns.entries, ...logColumns.params };

	/* Handle column metrics */
	// Getting metrics for filtered logs, and min / max values for full logs. 
	// Min / max bounds are used to set the filtering range for numeric columns 
	const columns = logs.length ? [...entriesProperties, ...paramsProperties] : [];
	const getColumnMetrics = async (expression: string | null, metric: string | undefined) => {
		const metricValues = await Promise.all(
			columns.map(async (key) => logsActions.getMetrics(
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
        items_={interface_.items}
        newCounter_={interface_.new_counter}
        interfaceCreated={interfaceCreated}
        projectActions={projectsActions}
        logsActions={logsActions}
        fieldsActions={fieldsActions}
        interfaceActions={interfaceActions}
        params={params}
        boundaries={boundaries}
    />;
};

export default Main;
