import { ResponseProps } from "@/types/common";
import CardGrid from "@/components/Evals/CardGrid";
import { LogFieldsProps, LogFieldsResponseProps, LogsResponseProps } from "@/types/evals/logs";
import { extractLogsData } from "@/utils/evals/common";
import { TileProps } from "@/types/evals/grid";
import { searchParamToFilters, filtersToExpression } from "@/utils/evals/filters";

const Main = async ({ searchParams, projectsActions, logsActions, fieldsActions, interfaceActions }: {
    searchParams: { project?: string, page_number?: string, metric?: string, filters?: string, common_filter?: string, sorting?: string },
    projectsActions: {
        get: () => Promise<string[]>,
        create: (name: string) => Promise<ResponseProps>,
        rename: (name: string, newName: string) => Promise<ResponseProps>,
        delete: (name: string) => Promise<ResponseProps>
    },
    logsActions: {
        get: (project: string, filterExpression: string | null, sortingExpression: string | null, limit: number, offset: number) => Promise<LogsResponseProps>,
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
    let fields: LogFieldsResponseProps = {}
    if (project) {
        fields = await fieldsActions.get(project)
    }

    /* Handle filters */
    // 1- Convert filters search param value to a nested dictionary representation of column, function and values
    // 2- Join column filters with the corresponding filter functions and values using "and"
    // 3- Join common filters with the "in" filter function and common filter value using "or"
    // 4- Join common and column filters into a single filter expression
    const logsFilters: { [column: string]: { [fn: string]: string } } = searchParamToFilters(searchParams.filters)
    const columnFiltersExpression = filtersToExpression(logsFilters)
    const commonFiltersExpression = searchParams.common_filter && fields
        ? Object.keys(fields)
            .map(column => `${searchParams.common_filter} in ${column}`)
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
                        value.split("@")[0], 
                        value.split("@")[1].replace("true", "descending").replace("false", "ascending")
                    ])
        ) 
    : ""
    const sortingExpression = sortingObject ? JSON.stringify(sortingObject) : null

    /* Get logs, handle pagination and unpack log data */
    let logsData: LogsResponseProps = { params: {}, logs: [], count: 0 };
    const limit = 16;
    const offset = (searchParams.page_number ? parseInt(searchParams.page_number) : 0) * limit;
    let totalPages = 1;
    if (project) {
        logsData = await logsActions.get(project, filterExpression, sortingExpression, limit, offset)
        totalPages = Math.ceil(logsData.count / limit);
    }
    const { entriesProperties, paramsProperties, logs, params } = extractLogsData(logsData, fields);

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
                .reduce((acc, curr) => ({ ...acc, ...curr }))
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
        columnTypes={fields}
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
