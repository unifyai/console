import CardGrid from "@/components/Interfaces/CardGrid";
import { PlotArguments, TableArguments, LogFieldsResponseProps, LogsResponseProps, LogProps, LogItemProps } from "@/types/evals/logs";
import { getLogsDetails } from "@/utils/evals/common";
import { Context, ContextActions, DerivedEntryActions, FieldsActions, Interface, InterfaceActions, LogsActions, PlotDataProps, ProjectsActions, TableDataProps } from "@/types/evals/grid";
import { searchParamToFilters, filtersToExpression, maybeWrapFilterInQuotes } from "@/utils/evals/filters";
import { processContext } from "@/utils/evals/columnOperations";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { defaultNewCounter } from "@/constants/logs";
import { defaultItems } from "@/constants/logs";

const Main = async ({ interface_, project_, projectsActions, logsActions, derivedEntryActions, fieldsActions, contextActions, interfaceActions }: {
    interface_: string | undefined,
    project_: string | undefined,
    projectsActions: ProjectsActions,
    logsActions: LogsActions,
    derivedEntryActions: DerivedEntryActions,
    fieldsActions: FieldsActions,
    contextActions: ContextActions,
    interfaceActions: InterfaceActions
}) => {
    const cookies_ = cookies();
    const cookiesProject = cookies_.get("project")?.value;
    const cookiesInterface = cookies_.get("tab")?.value;

    // Get projects
    const projects: string[] = await projectsActions.get();
    const project = projects.find(proj => proj == (project_ || cookiesProject)) || null;

    // Get contexts
    let contexts: Context[] = [];
    if (project)
        contexts = await contextActions.get(project);

    // Get interface
    let interfaces_: { [key: string]: Interface } = (
        (project ? await interfaceActions.get(project, false) : []) || []
    ).reduce((acc, curr) => ({...acc, [curr.name]: curr}), {});
    let interfacesTemp_: { [key: string]: Interface } = (
        (project ? await interfaceActions.get(project, true) : []) || []
    ).reduce((acc, curr) => ({...acc, [curr.name]: curr}), {});
    const interfaceCreated = interface_ != undefined && interface_ in interfaces_;
    const tempInterfaceCreated = interface_ != undefined && interface_ in interfacesTemp_;
    const interface_1 = Object.keys(interfacesTemp_).find(i => i == (interface_ || (
        project == cookiesProject ? cookiesInterface : undefined
    ))) || (
        Object.keys(interfacesTemp_).length ? Object.keys(interfacesTemp_).sort()[0] : null
    );
    let currentInterface = (interface_1 && interface_1 in interfacesTemp_) ? interfacesTemp_[interface_1] : null;
    if (currentInterface) {
        currentInterface = {
            ...currentInterface,
            items: currentInterface?.items.map(item => ({
                ...item,
                minW: undefined,
                minH: undefined,
                context: contexts.find(ctx => ctx.name == currentInterface?.context)?.name ?? item.context,
                column_context: item.column_context
            }))
        }
    }
    let savedInterface = interfaceCreated ? interfaces_[interface_1 as string] : {
        name: interface_1 as string,
        project: project,
        context: undefined,
        items: defaultItems,
        new_counter: defaultNewCounter
    } as Interface;
    if (!interface_ && project && interface_1)
        redirect(`/interfaces?project=${project}&tab=${interface_1}`);

    // get table and plot items
    let tableItems = (currentInterface?.items || []).filter(item => item.tab == "Table");
    let plotItems = (currentInterface?.items || []).filter(item => item.tab == "Plot");
    const tableNames = tableItems.map(item => item.i);

    // Get fields
    const fields: LogFieldsResponseProps[] = await Promise.all(
        tableItems.map(item => fieldsActions.get(project as string, item.context ?? null)
    ));
    const allPrefixes = fields.map(field => Object.keys(field).map(
        key => key.includes("/") ? key.split("/").slice(0, -1).join("/") : null
    ).filter(key => key != null));
    const columnContexts = allPrefixes.map(prefixes => Array.from(
        new Set(prefixes.map(prefix => {
            const parts = prefix.split("/");
            let context = "";
            return parts.map(part => {
                context += part + "/";
                return context;
            });    
        }).flat().sort())
    ));

    /* Handle filters */
    // 1- Convert filters search param value to a nested dictionary representation of column, function and values
    // 2- Join column filters with the corresponding filter functions and values using "and"
    // 3- Join common filters with the "in" filter function and common filter value using "or", or pass the expression if filtering by expression
    // 4- Join common and column filters into a single filter expression
    const logsFilters: { [column: string]: { [fn: string]: string } }[] = tableItems.map(
        item => searchParamToFilters(item.filters, item.column_context)
    );
    const columnFiltersExpressions = logsFilters.map((filter, idx) => filtersToExpression(filter, fields[idx]));
    const commonFiltersExpressions = tableItems.map((item, idx) => {
        if (item.common_filter && fields[idx]) {
            const commonFilterMode = item.common_filter.split("§")[0]
            const commonFilterValue = item.common_filter.split("§")[1]
            if (!commonFilterValue) return ""
            if (commonFilterMode === "expression") {
                let filter = commonFilterValue;
                const processFilter = (value: string, column: string, column_context: string | undefined) => value.replace(new RegExp(column, "g"), column_context ? processContext("merge", column_context, column) : column) 
                Object.keys(fields).forEach(column => processFilter(filter, column, item.column_context)) 
                return filter
            }
            else {
                const validFields = Object.fromEntries(Object.entries(fields[idx]).filter(([_, attributes]) => attributes.data_type != "image")) // Exclude images
                const filterValue = maybeWrapFilterInQuotes(commonFilterValue)
                const processFilter = (value: string, column: string, column_context: string | undefined) => `${value} in to_str(${column_context ? processContext("merge", column_context, column) : column})`
                const filter = Object.keys(validFields).map(column => processFilter(filterValue, column, item.column_context)).join(" or ")
                return filter
            }
        }
        return ""
    });
    let filterExpressions: (string | null)[] = tableItems.map((item, idx) => {
        const columnFiltersExpression = columnFiltersExpressions[idx];
        const commonFiltersExpression = commonFiltersExpressions[idx];
        let filterExpression = null;
        if (columnFiltersExpression) filterExpression = columnFiltersExpression;
        if (commonFiltersExpression) filterExpression = filterExpression ? `${commonFiltersExpression} and ${filterExpression}` : commonFiltersExpression;
        if (item.freeze) filterExpression = filterExpression ? filterExpression + `created_at < "${item.freeze}"` : `created_at < "${item.freeze}"`;
        return filterExpression;
    });

    // Handle sorting
    const sortingObjects = tableItems.map(item => item.sorting ? Object.fromEntries(
        item.sorting.split(",").map(value => [
            item.column_context ? processContext("merge", item.column_context, value.split("@")[0]) : value.split("@")[0],
            value.split("@")[1].replace("true", "descending").replace("false", "ascending")
        ]))
        : "");
    const sortingExpressions = sortingObjects.map(
        sortingObject => sortingObject ? JSON.stringify(sortingObject) : null
    );

    /* Handle grouping */
	const groupingExpressions = tableItems.map(item => item.grouping ? item.grouping : null);

    // Handle group sorting
    const groupSortingObjects = tableItems.map(item => item.group_sorting && item.grouping ? Object.fromEntries(
        item.group_sorting.split(",").map(value => {
            const group = item.column_context ? processContext("merge", item.column_context, item.grouping!.split(",")[0]) : item.grouping!.split(",")[0] 
            const field = item.column_context ? processContext("merge", item.column_context, value.split("@")[0]) : value.split("@")[0]
            const direction = value.split("@")[1].replace("true", "descending").replace("false", "ascending")
            const metric = item.metric ?? "mean"
            return [group, {field, direction, metric}]
        }))
    : "");

    const groupSortingExpressions = groupSortingObjects.map(
        sortingObject => sortingObject ? JSON.stringify(sortingObject) : null
    )

    // Aggregate table arguments and init plot arguments
    let tableArguments: TableArguments = tableItems.map((item, idx) => {
        let tableArguments_: TableArguments = { [item.i]: {getLogs_parameters: { filter_expr: "" }, available_fields: {}} };
        const filterExpression = filterExpressions[idx];
        const sortingExpression = sortingExpressions[idx];
        const groupingExpression = groupingExpressions[idx];
        const groupSortingExpression = groupSortingExpressions[idx];
        if (filterExpression) tableArguments_[item.i].getLogs_parameters["filter_expr"] = filterExpression;
        if (sortingExpression) tableArguments_[item.i].getLogs_parameters["sorting"] = sortingExpression;
        if (groupingExpression) tableArguments_[item.i].getLogs_parameters["grouping"] = groupingExpression;
        if (groupSortingExpression) tableArguments_[item.i].getLogs_parameters["group_sorting"] = groupSortingExpression;
        if (item.context) tableArguments_[item.i].getLogs_parameters["context"] = item.context;
        if (item.column_context) tableArguments_[item.i].getLogs_parameters["column_context"] = item.column_context;
        return tableArguments_;
    }).reduce((acc, curr) => ({ ...acc, ...curr }), {});
    const plotArguments: PlotArguments = Object.fromEntries(Object.entries(tableArguments).map(([table, args]) => [table, args.getLogs_parameters]));

    // Get logs with pagination, and plot logs subset for all tables
    let allLogsData: LogsResponseProps[] = Array(tableItems.length).fill({ params: {}, logs: [], count: 0, groups: [] });
    const limit = 20;
    const offsets: number[] = tableItems.map(item => (item.page_number ? parseInt(item.page_number) : 0) * limit);
    let allTotalPages: number[] = Array(tableItems.length).fill(1);
    let plotData: PlotDataProps = {};
    const plotFields: LogFieldsResponseProps = tableItems.map((item, idx) => {
        const columnContext = item.column_context;
        return Object.fromEntries(
            Object
                .entries(fields[idx])
                .filter(([name, { data_type, field_type, artifacts }]) => columnContext ? name.startsWith(columnContext) : name)
                .map(([name, { data_type, field_type, artifacts }]) => {
                    const newName = columnContext ? processContext("split", columnContext, name) : name
                    return [`${item.i}.${newName}`, { data_type, field_type, artifacts }];
                })
        )
    }).reduce((acc, curr) => ({ ...acc, ...curr }), {});
    if (project) {
        // fetch table data
        await Promise.all(tableItems.map(async (item, idx) => {
            const logsData = await logsActions.get(
                project,
                item.context ?? null,
                item.column_context ?? null,
                filterExpressions[idx],
                sortingExpressions[idx],
                groupingExpressions[idx],
                groupSortingExpressions[idx],
                null,
                null,
                limit,
                offsets[idx],
                groupingExpressions[idx] ? 0 : null,
                null,
                Date.now().toString(),
            );

            const totalPages = Math.ceil(logsData.count / limit);
            allLogsData[idx] = logsData;
            allTotalPages[idx] = totalPages;
        }));

        // fetch plot data
        await Promise.all(plotItems.map(async (item) => {

            // get all tables that are used in the plot
            let tableIdx1 = -1;
            if (item.x_axis && item.x_axis.includes("."))
                tableIdx1 = tableItems.findIndex(it => it.i == item.x_axis?.split(".")[0]);
            let tableIdx2 = -1;
            if (item.y_axis && item.y_axis.includes("."))
                tableIdx2 = tableItems.findIndex(it => it.i == item.y_axis?.split(".")[0]);
            const tables = [tableIdx1, tableIdx2 != tableIdx1 ? tableIdx2 : -1].filter(it => it != -1);

            // fetch plot data for each table
            const plotData_ = (await Promise.all(tables.map(async (tableIdx) => {
                const table = tableItems[tableIdx];
                
                // aggregate plot arguments
                const context = table?.context;
                const columnContext = table?.column_context;
                const filterExpression = filterExpressions[tableIdx];
                if (filterExpression) plotArguments[table.i]["filter_expr"] = filterExpression
                if (context) plotArguments[table.i]["context"] = context
                if (columnContext) plotArguments[table.i]["column_context"] = columnContext;
                
                // get plot data
                let data: LogsResponseProps = { params: {}, logs: [], count: 0, groups: [] };
                let [xAxis, yAxis, group] = [item.x_axis, item.y_axis, item.plot_group_by];
                let subset = null;
                if (xAxis && xAxis.split(".").length > 1) {
                    xAxis = xAxis.split(".")[1]
                    xAxis = columnContext ? processContext("merge", columnContext, xAxis) : xAxis;
                    subset = xAxis
                    if (yAxis && yAxis.split(".").length > 1) {
                        yAxis = yAxis.split(".")[1]
                        yAxis = columnContext ? processContext("merge", columnContext, yAxis) : yAxis;
                        subset += `&${yAxis}`
                    }
                    if (group && group.split(".").length > 1) {
                        group = group.split(".")[1]
                        group = columnContext ? processContext("merge", columnContext, group) : group;
                        subset += `&${group}`
                    }
                    if (subset) plotArguments[table.i]["subset"] = subset

                    data = await logsActions.get(project, context ?? null, columnContext ?? null, filterExpression, null, null, null, subset, null, null, null, null, null, Date.now().toString());

                    /* Replace param indices with actual param values */
                    if (Object.entries(data.logs).length && Object.entries(data.params).length) {
                        const params = data.params
                        const logs = data.logs as LogProps[]
                        data.logs = logs.map(log => {
                            const logParams: LogItemProps = {};
                            Object.entries(log.params).map(([key, value]) => logParams[key] = params[key][value]);
                            return {...log, params: logParams}
                        })

                    }
                    
                }
                return { [table.i]: {
                    plotLogs: data.logs as LogProps[] || [],
                    plotArguments: plotArguments,
                    plotFields: plotFields
                } };
            }))).reduce((acc, curr) => ({ ...acc, ...curr }), {});

            // process plot data
            if (Object.keys(plotData_).length > 0) {
                // if non-zero tables are used in the plot, merge the plot data
                const minLogLength = Math.min(...Object.values(plotData_).map(data => data.plotLogs.length));
                const mergedPlotData = {
                    plotLogs: minLogLength > 0 ? Object.values(plotData_)[0].plotLogs.slice(0, minLogLength).map((_, i) => {
                        return Object.entries(plotData_).reduce((acc, [tableId, data]) => {
                            const prefixedLog = Object.fromEntries(
                                Object.entries(data.plotLogs[i] || {}).map(([key, value]) => [
                                    `${tableId}.${key}`,
                                    (["params", "entries", "derived_entries"].includes(key) && value) 
                                        ? Object.fromEntries(Object.entries(value).map(([k,v]) => [`${tableId}.${k}`, v])) 
                                        : value
                                ])
                            );
                            return { ...acc, ...prefixedLog };
                        }, {}) as LogProps;
                    }) : [],
                    plotArguments: plotArguments,
                    plotFields: plotFields
                };
                plotData[item.i] = mergedPlotData;
            }
            else {
                // if no tables are used in the plot, return empty plot data
                plotData[item.i] = {
                    plotLogs: [],
                    plotArguments: {},
                    plotFields: plotFields
                }
            }
    
        }));
    }

    const tableData: TableDataProps = (await Promise.all(
        tableItems.map(async (item, idx) => {
            const logsData = allLogsData[idx];
            const totalPages = allTotalPages[idx];
            const context = item.context ?? null;
            const columnContext = item.column_context ?? null
            const sorting = item.sorting ?? null
            const hiddenColumns = item.hidden_columns;

            const { entriesProperties, paramsProperties, logs, params, metrics, groupedMetrics, boundaries } = await getLogsDetails(
                item,
                logsData,
                fields[idx],
                context,
                columnContext,
                project,
                filterExpressions[idx],
                groupingExpressions[idx],
                item.metric,
                sorting,
                undefined,
                logsActions
            );

            // Append available fields to the table attributes
            tableArguments[item.i].available_fields = 
            Object.fromEntries(
                Object.entries(fields[idx])
                    .filter((([field, attributes]) => entriesProperties.concat(paramsProperties).includes(field)))
            )

            // Get other attributes shared across tables and corresponding views

            const columnOrdering = item.column_order;
            const selection = item.selected;
            const baseIndex = item.base_index;

            return {
                [item.i]: {
                    fields: fields[idx],
                    columnContexts: columnContexts[idx],
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
                    groupedMetrics,
                    boundaries,
                }
            }
        })
    )).reduce((acc, curr) => ({ ...acc, ...curr }), {});

    return <CardGrid
        project_={project}
        projects_={projects}
        contexts={contexts}
        interfaces_={Object.keys(interfacesTemp_).sort()}
        tableNames={tableNames}
        tableData={tableData}
        tableArguments={tableArguments}
        plotData={plotData}
        savedInterface={savedInterface}
        interfaceCreated={interfaceCreated}
        tempInterfaceCreated_={tempInterfaceCreated}
        interface_1={interface_1}
        filterExpressions={filterExpressions}
        sortingExpressions={sortingExpressions}
        groupingExpressions={groupingExpressions}
        groupSortingExpressions={groupSortingExpressions}
        limit={limit}
        offsets={offsets}
        projectActions={projectsActions}
        logsActions={logsActions}
        fieldsActions={fieldsActions}
        derivedEntryActions={derivedEntryActions}
        contextActions={contextActions}
        interfaceActions={interfaceActions}
    />;
};

export default Main;
