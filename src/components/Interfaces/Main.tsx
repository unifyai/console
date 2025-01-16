import { ResponseProps } from "@/types/common";
import CardGrid from "@/components/Interfaces/CardGrid";
import { LogFieldsProps, LogFieldsResponseProps, LogsResponseProps } from "@/types/evals/logs";
import { getLogsDetails } from "@/utils/evals/common";
import { PlotDataProps, TableDataProps, TileProps } from "@/types/evals/grid";
import { searchParamToFilters, filtersToExpression } from "@/utils/evals/filters";
import { processContext } from "@/utils/evals/columnOperations";

const Main = async ({ projectsActions, logsActions, fieldsActions, interfaceActions }: {
    projectsActions: {
        get: () => Promise<string[]>,
        create: (name: string) => Promise<ResponseProps>,
        rename: (name: string, newName: string) => Promise<ResponseProps>,
        delete: (name: string) => Promise<ResponseProps>
    },
    logsActions: {
        get: (project: string, context: string | null, filterExpression: string | null, sortingExpression: string | null, from_fields: string | null, limit: number | null, offset: number, _timestamp: string | null) => Promise<LogsResponseProps>,
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
    let types: { [key: string]: string } = {}
    if (project) {
        fields = await fieldsActions.get(project);
        types = Object.fromEntries(Object.entries(fields).map(entry => [entry[0], entry[1].data_type]));
    }

    /* Handle filters */
    // 1- Convert filters search param value to a nested dictionary representation of column, function and values
    // 2- Join column filters with the corresponding filter functions and values using "and"
    // 3- Join common filters with the "in" filter function and common filter value using "or"
    // 4- Join common and column filters into a single filter expression
    let tableItems = (currentInterface.items || []).filter(item => item.tab == "Table");
    let plotItems = (currentInterface.items || []).filter(item => item.tab == "Plot");
    const tableNames = tableItems.map(item => item.i);
    const logsFilters: { [column: string]: { [fn: string]: string } }[] = tableItems.map(
        item => searchParamToFilters(item.filters, item.context)
    );
    const columnFiltersExpressions = logsFilters.map(filter => filtersToExpression(filter));
    const commonFiltersExpressions = tableItems.map(
        item => item.common_filter && fields
            ? Object.keys(fields)
                .map(column => `${item.common_filter} in ${item.context ? processContext("merge", item.context, column) : column}`)
                .join(" or ")
            : ""
    );
    let filterExpressions: (string | null)[] = tableItems.map((_, idx) => {
        const columnFiltersExpression = columnFiltersExpressions[idx];
        const commonFiltersExpression = commonFiltersExpressions[idx];
        let filterExpression = null;
        if (columnFiltersExpression)
            filterExpression = columnFiltersExpression;
        if (commonFiltersExpression)
            filterExpression = filterExpression = filterExpression ? `${commonFiltersExpression} and ${filterExpression}` : commonFiltersExpression;
        return filterExpression;
    });

    /* Handle sorting */
    const sortingObjects = tableItems.map(item => item.sorting ? Object.fromEntries(
        item.sorting.split(",").map(value => [
            item.context ? processContext("merge", item.context, value.split("@")[0]) : value.split("@")[0],
            value.split("@")[1].replace("true", "descending").replace("false", "ascending")
        ]))
        : "");
    const sortingExpressions = sortingObjects.map(
        sortingObject => sortingObject ? JSON.stringify(sortingObject) : null
    );

    // Get logs with pagination, and plot logs subset for all tables
    let allLogsData: LogsResponseProps[] = Array(tableItems.length).fill({ params: {}, logs: [], count: 0 });
    const limit = 16;
    const offsets: number[] = tableItems.map(item => (item.page_number ? parseInt(item.page_number) : 0) * limit);
    let allTotalPages: number[] = Array(tableItems.length).fill(1);
    let allPlotData: LogsResponseProps[] = Array(plotItems.length).fill(({ params: {}, logs: [], count: 0 }));
    const allPlotFields: LogFieldsResponseProps[] = plotItems.map(
        item => {
            const context = tableItems.find(it => it.i == item.table)?.context;
            return Object.fromEntries(
                Object
                    .entries(fields)
                    .filter(([name, { data_type, field_type }]) => context ? name.startsWith(context) : name)
                    .map(([name, { data_type, field_type }]) => {
                        const newName = context ? name.replace(context, "") : name;
                        return [newName, { data_type, field_type }];
                    })
            )
        }
    );
    if (project) {
        await Promise.all(tableItems.map(async (item, idx) => {
            const logsData = await logsActions.get(
                project,
                item.context ?? null,
                filterExpressions[idx],
                sortingExpressions[idx],
                null,
                limit,
                offsets[idx],
                null
            );
            const totalPages = Math.ceil(logsData.count / limit);

            allLogsData[idx] = logsData;
            allTotalPages[idx] = totalPages;
        })
        );
        await Promise.all(plotItems.map(async (item, idx) => {
            const xAxis = item.context ? processContext("merge", item.context, item.x_axis) : item.x_axis;
            const yAxis = item.context ? processContext("merge", item.context, item.y_axis) : item.y_axis;
            const group = item.context ? processContext("merge", item.context, item.plot_group_by) : item.plot_group_by;
            let plotData: LogsResponseProps = { params: {}, logs: [], count: 0 };
            const filterExpressionIdx = tableItems.findIndex(it => it.i == item.table);
            const filterExpression = filterExpressionIdx == -1 ? null : filterExpressions[filterExpressionIdx];
            if (xAxis) {
                let subset = xAxis
                if (item.plot_type === "Bar Chart")
                    plotData = await logsActions.get(project, item.context ?? null, filterExpression, null, subset, null, 0, null);
                else {
                    if (yAxis)
                        subset += `%26${yAxis}`
                    if (group) subset += `%26${group}`
                    plotData = await logsActions.get(project, item.context ?? null, filterExpression, null, subset, null, 0, null);
                }
            }
            allPlotData[idx] = plotData;
        }));
    }

    const tableData: TableDataProps = (await Promise.all(
        tableItems.map(async (item, idx) => {
            const logsData = allLogsData[idx];
            const totalPages = allTotalPages[idx];
            const context = item.context ?? null
            const sorting = item.sorting ?? null

            const { entriesProperties, paramsProperties, logs, params, metrics, boundaries } = await getLogsDetails(
                item, logsData, fields, context, project, filterExpressions[idx], sorting, logsActions
            )

            // Get other attributes shared across tables and corresponding views
            const hiddenColumns = item.hidden_columns;
            const columnOrdering = item.column_order;
            const selection = item.selected;
            const baseIndex = item.base_index;

            return {
                [item.i]: {
                    hiddenColumns,
                    columnOrdering,
                    selection,
                    baseIndex,
                    logsData,
                    totalPages,
                    entriesProperties,
                    paramsProperties,
                    logs,
                    params,
                    metrics,
                    boundaries,
                }
            }
        })
    )).reduce((acc, curr) => ({ ...acc, ...curr }), {});

    const plotData: PlotDataProps = (await Promise.all(
        plotItems.map(async (item, idx) => {
            const plotData = allPlotData[idx];
            const plotFields = allPlotFields[idx];
            const plotLogs = plotData?.logs || [];
            return {
                [item.i]: {
                    plotLogs,
                    plotFields,
                }
            }
        })
    )).reduce((acc, curr) => ({ ...acc, ...curr }), {});

    return <CardGrid
        projects={projects}
        project_={project}
        tableNames={tableNames}
        tableData={tableData}
        fields={fields}
        plotData={plotData}
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
