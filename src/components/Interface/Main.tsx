import { ResponseProps } from "@/types/common";
import CardGrid from "@/components/Interface/CardGrid";
import { LogFieldsProps, LogFieldsResponseProps, LogsResponseProps } from "@/types/evals/logs";
import { extractLogsData } from "@/utils/evals/common";
import { TableDataProps, TileProps } from "@/types/evals/grid";
import { searchParamToFilters, filtersToExpression } from "@/utils/evals/filters";

const Main = async ({ projectsActions, logsActions, fieldsActions, interfaceActions }: {
    projectsActions: {
        get: () => Promise<string[]>,
        create: (name: string) => Promise<ResponseProps>,
        rename: (name: string, newName: string) => Promise<ResponseProps>,
        delete: (name: string) => Promise<ResponseProps>
    },
    logsActions: {
        get: (project: string, context: string | null, filterExpression: string | null, sortingExpression: string | null, from_fields: string | null, limit: number | null, offset: number) => Promise<LogsResponseProps>,
        getLatest: (project: string, context: string | null, filterExpression: string | null, sortingExpression: string | null, from_fields: string | null, limit: number | null, offset: number) => Promise<string>,
        getMetrics: (
            project: string, filterExpression: string | null, metricName: string, keyName: string
        ) => Promise<number>,
        delete: (ids_and_fields: LogFieldsProps) => Promise<ResponseProps>
    },
    fieldsActions: {
        get: (project: string) => Promise<LogFieldsResponseProps>,
    },
    interfaceActions: {
        get: (temporary: boolean) => Promise<{ items: TileProps[], new_counter: number, project: string | null } | null>,
        create: (items: TileProps[], new_counter: number, project: string | null, temporary: boolean) => Promise<ResponseProps>,
        update: (items: TileProps[], new_counter: number, project: string | null, temporary: boolean) => Promise<ResponseProps>,
    }
}) => {
    // Get interface
    let interface_: { items: TileProps[], new_counter: number, project: string | null } | null = await interfaceActions.get(false);
    let interfaceTemp_: { items: TileProps[], new_counter: number, project: string | null } | null = await interfaceActions.get(true);
    let interfaceCreated = Boolean(interfaceTemp_);
    let currentInterface = interfaceTemp_;
    if (!currentInterface) {
        currentInterface = {
            items: [{ i: "Tile_0", x: 0, y: 0, w: 3, h: 3, tab: undefined, moved: false, static: false }],
            new_counter: 1,
            project: null
        };
    }

    // Get projects
    const projects: string[] = await projectsActions.get();
    const project = projects.find(project => project == currentInterface.project) || null;

    // Get fields
    let fields: LogFieldsResponseProps = {};
    let types: {[key: string] : string} = {}
    if (project) {
        fields = await fieldsActions.get(project);
        types = Object.fromEntries(Object.entries(fields).map(entry => [entry[0], entry[1].data_type]));
    }

    /* Handle filters */
    // 1- Convert filters search param value to a nested dictionary representation of column, function and values
    // 2- Join column filters with the corresponding filter functions and values using "and"
    // 3- Join common filters with the "in" filter function and common filter value using "or"
    // 4- Join common and column filters into a single filter expression
    let tableItems = currentInterface.items.filter(item => item.tab?.includes("Table"));
    const tableNames = tableItems.map(item => item.i);
    const logsFilters: { [column: string]: { [fn: string]: string } }[] = tableItems.map(
        item => searchParamToFilters(item.filters, item.context)
    );
    const columnFiltersExpressions = logsFilters.map(filter => filtersToExpression(filter));
    const commonFiltersExpressions = tableItems.map(
        item => item.common_filter && fields
            ? Object.keys(fields)
                .map(column => `${item.common_filter} in ${item.context ? item.context + column : column}`)
                .join(" or ")
            : ""
    );
    let filterExpressions: string[] | null = null;
    if (columnFiltersExpressions) filterExpressions = columnFiltersExpressions;
    if (commonFiltersExpressions) {
        filterExpressions = commonFiltersExpressions.map(
            (commonFiltersExpression, idx) => (
                filterExpressions && filterExpressions[idx]
                    ? `${commonFiltersExpression} and ${filterExpressions[idx]}`
                    : commonFiltersExpression
            )
        );
    }

    /* Handle sorting */
	const sortingObjects = tableItems.map(item => item.sorting ? Object.fromEntries(
        item.sorting.split(",").map(value => [
            item.context ? item.context + value.split("@")[0] : value.split("@")[0],
            value.split("@")[1].replace("true", "descending").replace("false", "ascending")
        ])) 
    : "");
    const sortingExpressions = sortingObjects.map(
        sortingObject => sortingObject ? JSON.stringify(sortingObject) : null
    );

    // Get logs for all tables
    let allLogsData: {
        [key: string]: { logsData: LogsResponseProps, plotData: LogsResponseProps, plotFields: LogFieldsResponseProps, totalPages: number }
    } = tableItems.reduce(
        (acc, item) => ({ ...acc, [item.i]: {
            logsData: { params: {}, logs: [], count: 0 },
            totalPages: 0,
        } }), {}
    );
    const limit = 16;
    if (project) {
        allLogsData = (await Promise.all(
            tableItems.map(async (item, idx) => {
                const offset = (item.page_number ? parseInt(item.page_number) : 0) * limit;
                const filterExpression = filterExpressions ? filterExpressions[idx] : null;
                const sortingExpression = sortingExpressions[idx];
                const context = item.context ?? null
                const logsData = await logsActions.get(project, context ?? null, filterExpression, sortingExpression, null, limit, offset);
                
                const plotFields = Object.fromEntries(
                    Object
                        .entries(fields)
                        .filter(([name, { data_type, field_type }]) => context ? name.startsWith(context) : name)
                        .map(([name, { data_type, field_type }]) => {
                            const newName = context ? name.replace(context, "") : name;
                            return [newName, { data_type, field_type }];
                        })
                );
                let plotData: LogsResponseProps = { params: {}, logs: [], count: 0 };
                const xAxis = context ? context + item.x_axis : item.x_axis
                const yAxis = context ? context + item.y_axis : item.y_axis
                if (xAxis) {
                    if (item.plot_type === "Bar Chart") 
                        plotData = await logsActions.get(project, context ?? null, filterExpression, null, xAxis, null, 0)
                    else {
                        if (yAxis)
                            plotData = await logsActions.get(project, context ?? null, filterExpression, null, `${xAxis}%26${yAxis}`, null, 0)
                    }
                }
                
                const totalPages = Math.ceil(logsData.count / limit);
                return { [item.i]: { logsData, plotData, plotFields, totalPages } };
            })
        )).reduce((acc, curr) => ({ ...acc, ...curr }), {});
    }

    const tableData: TableDataProps = (await Promise.all(
        tableItems.map(async (item, idx) => {
            
            const logsData = allLogsData[item.i].logsData;
            const plotData = allLogsData[item.i].plotData;
            const plotFields = allLogsData[item.i].plotFields;
            const totalPages = allLogsData[item.i].totalPages;
            const context = item.context ?? null
            const sorting = item.sorting ?? null

            // Unpack log data
            const { entriesProperties, paramsProperties, logs, params } = extractLogsData(
                logsData, fields, context, sorting
            );

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
                const metrics: { [key: string]: any } = columns.length
                    ? columns
                        .map((key, index) => ({ [key]: metricValues[index] }))
                        .reduce((acc, curr) => ({ ...acc, ...curr }))
                    : {};
                return metrics
            }
            const metrics = await getColumnMetrics(
                filterExpressions ? filterExpressions[idx] : null,
                item.metric
            );
            const [minimums, maximums] = await Promise.all([
                getColumnMetrics(null, "min"),
                getColumnMetrics(null, "max")
            ]);

            // Min-max boundaries for numeric and time-like column filters
            const timeSortedLogs = logs.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
            let boundaries = { minimums, maximums }
            boundaries.minimums["ts"] = timeSortedLogs.length ? timeSortedLogs.at(0)!.ts : undefined
            boundaries.maximums["ts"] = timeSortedLogs.length ? timeSortedLogs.at(-1)!.ts : undefined


            // Get other attributes shared across tables and corresponding views
            const hiddenColumns = item.hidden_columns;
            const columnOrdering = item.column_order;
            const selection = item.selected;
            const baseIndex = item.base_index;
            const plotLogs = plotData?.logs || [];

            return {
                [item.i]: {
                    hiddenColumns,
                    columnOrdering,
                    selection,
                    baseIndex, 
                    logsData,
                    plotLogs,
                    plotFields,
                    totalPages,
                    entriesProperties,
                    paramsProperties,
                    logs,
                    params,
                    metrics,
                    boundaries,
                }
            }
    }))).reduce((acc, curr) => ({ ...acc, ...curr }), {});

    return <CardGrid
        projects={projects}
        project_={project}
        tableNames={tableNames}
        tableData={tableData}
        columnTypes={types}
        savedInterface={interface_}
        items_={currentInterface.items}
        newCounter_={currentInterface.new_counter}
        interfaceCreated={interfaceCreated}
        tempInterfaceCreated={Boolean(interfaceTemp_)}
        projectActions={projectsActions}
        logsActions={logsActions}
        fieldsActions={fieldsActions}
        interfaceActions={interfaceActions}
        filterExpressions={filterExpressions}
        sortingExpressions={sortingExpressions}
    />;
};

export default Main;
