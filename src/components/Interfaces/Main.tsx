import CardGrid from "@/components/Interfaces/CardGrid";
import { TableArguments, LogFieldsResponseProps, LogsResponseProps } from "@/types/evals/logs";
import { getLogsDetails } from "@/utils/evals/common";
import { FieldsActions, Interface, InterfaceActions, LogsActions, PlotDataProps, ProjectsActions, TableDataProps } from "@/types/evals/grid";
import { searchParamToFilters, filtersToExpression } from "@/utils/evals/filters";
import { processContext } from "@/utils/evals/columnOperations";

const Main = async ({ interface_, project_, projectsActions, logsActions, fieldsActions, interfaceActions }: {
    interface_: string | undefined,
    project_: string | undefined,
    projectsActions: ProjectsActions,
    logsActions: LogsActions,
    fieldsActions: FieldsActions,
    interfaceActions: InterfaceActions
}) => {
    // Get projects
    const projects: string[] = await projectsActions.get();
    const project = projects.find(proj => proj == project_) || null;

    // Get interface
    let interfaces_: { [key: string]: Interface } = (
        (project ? await interfaceActions.get(project, false) : []) || []
    ).reduce((acc, curr) => ({...acc, [curr.name]: curr}), {});
    let interfacesTemp_: { [key: string]: Interface } = (
        (project ? await interfaceActions.get(project, true) : []) || []
    ).reduce((acc, curr) => ({...acc, [curr.name]: curr}), {});
    let interfaceCreated = interface_ != undefined && interface_ in interfaces_;
    const interface_1 = Object.keys(interfacesTemp_).find(i => i == interface_) || (
        Object.keys(interfacesTemp_).length ? Object.keys(interfacesTemp_).sort()[0] : null
    );
    let currentInterface = (interface_ && interface_ in interfacesTemp_) ? interfacesTemp_[interface_] : null;
    let savedInterface = interfaceCreated ? interfaces_[interface_ as string] : null;

    // Get fields
    let fields: LogFieldsResponseProps = {};
    if (project) {
        fields = await fieldsActions.get(project);
    }

    /* Handle filters */
    // 1- Convert filters search param value to a nested dictionary representation of column, function and values
    // 2- Join column filters with the corresponding filter functions and values using "and"
    // 3- Join common filters with the "in" filter function and common filter value using "or"
    // 4- Join common and column filters into a single filter expression
    let tableItems = (currentInterface?.items || []).filter(item => item.tab == "Table");
    let plotItems = (currentInterface?.items || []).filter(item => item.tab == "Plot");
    const tableNames = tableItems.map(item => item.i);
    const logsFilters: { [column: string]: { [fn: string]: string } }[] = tableItems.map(
        item => searchParamToFilters(item.filters, item.context)
    );
    const columnFiltersExpressions = logsFilters.map(filter => filtersToExpression(filter));
    const commonFiltersExpressions = tableItems.map(
        item => item.common_filter && fields
            ? Object.keys(
                Object.fromEntries(Object.entries(fields).filter(([key, value]) => value.field_type != "derived_entry")) // Exclude derived entries from filters
            )
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

    /* Aggregate table arguments */
    let tableArguments : TableArguments = {}

    const tableData: TableDataProps = (await Promise.all(
        tableItems.map(async (item, idx) => {
            const logsData = allLogsData[idx];
            const totalPages = allTotalPages[idx];
            const context = item.context ?? null
            const sorting = item.sorting ?? null
            
            const table = item.table
            if (table) {
                const [filterExpression, sortingExpression] = [filterExpressions[idx], sortingExpressions[idx]]
                if (filterExpression) tableArguments[table]["filter_expr"] = filterExpression
                if (sortingExpression) tableArguments[table]["sorting"] = sortingExpression
                if (context) tableArguments[table]["context"] = context
            }

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
        interfaces_={Object.keys(interfacesTemp_).sort()}
        tableNames={tableNames}
        tableData={tableData}
        tableArguments={tableArguments}
        fields={fields}
        plotData={plotData}
        savedInterface={savedInterface}
        interface_1={interface_1}
        items_={currentInterface?.items || []}
        newCounter_={currentInterface?.new_counter || 0}
        interfaceCreated={interfaceCreated}
        tempInterfaceCreated={Boolean(currentInterface)}
        filterExpressions={filterExpressions}
        sortingExpressions={sortingExpressions}
        projectActions={projectsActions}
        logsActions={logsActions}
        interfaceActions={interfaceActions}
    />;
};

export default Main;
