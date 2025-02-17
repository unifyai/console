import CardGrid from "@/components/Interfaces/CardGrid";
import { PlotArguments, TableArguments, LogFieldsResponseProps, LogsResponseProps, LogProps, LogItemProps } from "@/types/evals/logs";
import { getLogsDetails } from "@/utils/evals/common";
import { Context, ContextActions, DerivedEntryActions, FieldsActions, Interface, InterfaceActions, LogsActions, PlotDataProps, ProjectsActions, TableDataProps } from "@/types/evals/grid";
import { searchParamToFilters, filtersToExpression } from "@/utils/evals/filters";
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
    const cookiesInterface = cookies_.get("interface")?.value;

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
            items: currentInterface?.items.map(item => ({...item, context: currentInterface?.context || item.context }))
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
        redirect(`/interfaces?project=${project}&interface=${interface_1}`);

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
    const columnFiltersExpressions = logsFilters.map(filter => filtersToExpression(filter, fields));
    const commonFiltersExpressions = tableItems.map(
        item => item.common_filter && fields
            ? Object
                .keys(
                    Object.fromEntries(Object.entries(fields).filter(([_, attributes]) => attributes.data_type != "image")) // Exclude images
                )
                .map(column => `${item.common_filter} in to_str(${item.context ? processContext("merge", item.context, column) : column})`)
                .join(" or ")
            : ""
    );
    let filterExpressions: (string | null)[] = tableItems.map((item, idx) => {
        const columnFiltersExpression = columnFiltersExpressions[idx];
        const commonFiltersExpression = commonFiltersExpressions[idx];
        let filterExpression = null;
        if (columnFiltersExpression) filterExpression = columnFiltersExpression;
        if (commonFiltersExpression) filterExpression = filterExpression ? `${commonFiltersExpression} and ${filterExpression}` : commonFiltersExpression;
        if (item.freeze) filterExpression = filterExpression ? filterExpression + `created_at < ${item.freeze}` : `created_at < "${item.freeze}"`;
        return filterExpression;
    });

    // Handle sorting
    const sortingObjects = tableItems.map(item => item.sorting ? Object.fromEntries(
        item.sorting.split(",").map(value => [
            item.context ? processContext("merge", item.context, value.split("@")[0]) : value.split("@")[0],
            value.split("@")[1].replace("true", "descending").replace("false", "ascending")
        ]))
        : "");
    const sortingExpressions = sortingObjects.map(
        sortingObject => sortingObject ? JSON.stringify(sortingObject) : null
    );

    /* Handle grouping */
	const groupingExpressions = tableItems.map(item => item.grouping ? item.grouping : null);

    // Aggregate table arguments and init plot arguments
    let tableArguments: TableArguments = tableItems.map((item, idx) => {
        let tableArguments_: TableArguments = { [item.i]: {getLogs_parameters: { filter_expr: "" }, available_fields: {}} };
        const filterExpression = filterExpressions[idx];
        const sortingExpression = sortingExpressions[idx];
        if (filterExpression) tableArguments_[item.i].getLogs_parameters["filter_expr"] = filterExpression;
        if (sortingExpression) tableArguments_[item.i].getLogs_parameters["sorting"] = sortingExpression;
        if (item.context) tableArguments_[item.i].getLogs_parameters["context"] = item.context;
        return tableArguments_;
    }).reduce((acc, curr) => ({ ...acc, ...curr }), {});
    const plotArguments: PlotArguments = Object.fromEntries(Object.entries(tableArguments).map(([table, args]) => [table, args.getLogs_parameters]));

    // Get logs with pagination, and plot logs subset for all tables
    let allLogsData: LogsResponseProps[] = Array(tableItems.length).fill({ params: {}, logs: [], count: 0, groups: [] });
    const limit = 100;
    const offsets: number[] = tableItems.map(item => (item.page_number ? parseInt(item.page_number) : 0) * limit);
    let allTotalPages: number[] = Array(tableItems.length).fill(1);
    let plotData: PlotDataProps = {};
    const plotFields: LogFieldsResponseProps = tableItems.map(item => {
        const context = item.context;
        return Object.fromEntries(
            Object
                .entries(fields)
                .filter(([name, { data_type, field_type, artifacts }]) => context ? name.startsWith(context) : name)
                .map(([name, { data_type, field_type, artifacts }]) => {
                    const newName = context ? name.replace(context, "") : name;
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
                filterExpressions[idx],
                sortingExpressions[idx],
                groupingExpressions[idx],
                null,
                null,
                limit,
                offsets[idx],
                groupingExpressions[idx] ? 0 : null,
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
                const xAxis = context ? processContext("merge", context, item.x_axis) : item.x_axis;
                const yAxis = context ? processContext("merge", context, item.y_axis) : item.y_axis;
                const group = context ? processContext("merge", context, item.plot_group_by) : item.plot_group_by;
                const filterExpression = filterExpressions[tableIdx];
                if (filterExpression) plotArguments[table.i]["filter_expr"] = filterExpression
                if (context) plotArguments[table.i]["context"] = context

                // get plot data
                let data: LogsResponseProps = { params: {}, logs: [], count: 0, groups: [] };
                if (xAxis) {
                    let subset = xAxis.split(".").length > 1 ? xAxis.split(".")[1] : null;
                    if (yAxis && yAxis.split(".").length > 1)
                        subset += `&${yAxis.split(".")[1]}`
                    if (group && group.split(".").length > 1)
                        subset += `&${group.split(".")[1]}`
                    if (subset) plotArguments[table.i]["subset"] = subset
    
                    data = await logsActions.get(project, context ?? null, filterExpression, null, null, subset, null, null, 0, null, Date.now().toString());

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
            const context = item.context ?? null
            const sorting = item.sorting ?? null
            const hiddenColumns = item.hidden_columns;

            const { entriesProperties, paramsProperties, logs, params, metrics, boundaries } = await getLogsDetails(
                item, logsData, fields, context, project, filterExpressions[idx], sorting, undefined, logsActions
            )

            // Append available fields to the table attributes
            tableArguments[item.i].available_fields = 
            Object.fromEntries(
                Object.entries(fields)
                    .filter((([field, attributes]) => entriesProperties.concat(paramsProperties).includes(field)))
            )
            
            // Get other attributes shared across tables and corresponding views

            const columnOrdering = item.column_order;
            const selection = item.selected;
            const baseIndex = item.base_index;

            return {
                [item.i]: {
                    fields,
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

    return <CardGrid
        project_={project}
        projects_={projects}
        contexts={contexts}
        interfaces_={Object.keys(interfacesTemp_).sort()}
        tableNames={tableNames}
        tableData={tableData}
        tableArguments={tableArguments}
        fields={fields}
        plotData={plotData}
        savedInterface={savedInterface}
        interfaceCreated={interfaceCreated}
        tempInterfaceCreated_={tempInterfaceCreated}
        interface_1={interface_1}
        filterExpressions={filterExpressions}
        sortingExpressions={sortingExpressions}
        groupingExpressions={groupingExpressions}
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
