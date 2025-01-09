import { ResponseProps } from "@/types/common";
import CardGrid from "@/components/Evals1/CardGrid";
import { LogFieldsProps, LogFieldsResponseProps, LogsResponseProps } from "@/types/evals/logs";
import { extractLogsData } from "@/utils/evals/common";
import { TableDataProps, TileProps } from "@/types/evals/grid";
import { searchParamToFilters, filtersToExpression } from "@/utils/evals/filters";

const Main = async ({ temporary, projectsActions, logsActions, fieldsActions, interfaceActions }: {
    temporary: boolean,
    projectsActions: {
        get: () => Promise<string[]>,
        create: (name: string) => Promise<ResponseProps>,
        rename: (name: string, newName: string) => Promise<ResponseProps>,
        delete: (name: string) => Promise<ResponseProps>
    },
    logsActions: {
        get: (project: string, context: string | null, filterExpression: string | null, sortingExpression: string | null, limit: number | null, offset: number) => Promise<LogsResponseProps>,
        getLatest: (project: string, context: string | null, filterExpression: string | null, sortingExpression: string | null, limit: number | null, offset: number) => Promise<string>,
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
    let interfaceCreated = temporary ? Boolean(interfaceTemp_) : Boolean(interface_);
    let currentInterface = temporary ? interfaceTemp_ : interface_;
    if (!currentInterface) {
        currentInterface = {
            items: [{ i: "Tile_0", x: 0, y: 0, w: 3, h: 3, tab: undefined, moved: false, static: false }],
            new_counter: 1,
            project: null
        };
    }

    // Get projects
    const projects: string[] = await projectsActions.get();
    const project = currentInterface.project || undefined;

    // Get fields
    let fields: LogFieldsResponseProps = {};
    if (project)
        fields = await fieldsActions.get(project);

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
        [key: string]: { logsData: LogsResponseProps, fullData: LogsResponseProps, totalPages: number }
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
                const logsData = await logsActions.get(project, context, filterExpression, sortingExpression, limit, offset);
                const fullData = await logsActions.get(project, context, filterExpression, null, null, 0);
                const totalPages = Math.ceil(logsData.count / limit);
                return { [item.i]: { logsData, fullData, totalPages } };
            })
        )).reduce((acc, curr) => ({ ...acc, ...curr }), {});
    }

    const tableData: TableDataProps = (await Promise.all(
        tableItems.map(async (item, idx) => {
            const logsData = allLogsData[item.i].logsData;
            const fullData = allLogsData[item.i].fullData;
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
                const metrics: { [key: string]: number } = columns.length
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
            const boundaries = { minimums, maximums };

            // Get other attributes shared across tables and corresponding views
            const hiddenColumns = item.hidden_columns;
            const columnOrdering = item.column_order;
            const selection = item.selected;
            const baseIndex = item.base_index;
            const fullLogs = fullData?.logs || [];

            return {
                [item.i]: {
                    hiddenColumns,
                    columnOrdering,
                    selection,
                    baseIndex, 
                    logsData,
                    fullLogs,
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
        columnTypes={fields}
        savedInterface={interface_}
        items_={currentInterface.items}
        newCounter_={currentInterface.new_counter}
        interfaceCreated={interfaceCreated}
        tempInterfaceCreated={Boolean(interfaceTemp_)}
        temporary={temporary}
        projectActions={projectsActions}
        logsActions={logsActions}
        fieldsActions={fieldsActions}
        interfaceActions={interfaceActions}
        filterExpressions={filterExpressions}
        sortingExpressions={sortingExpressions}
    />;
};

export default Main;
