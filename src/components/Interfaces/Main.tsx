import { PlotArguments, TableArguments, LogFieldsResponseProps, LogsResponseProps, LogProps, LogItemProps } from "@/types/evals/logs";
import { getLogsDetails } from "@/utils/evals/common";
import { Context, ContextActions, DerivedEntryActions, FieldsActions, TabProps, TabActions, LogsActions, PlotDataProps, ProjectsActions, TableDataProps, TabsDataProps } from "@/types/evals/grid";
import { buildFilterExpression } from "@/utils/evals/filters";
import { processContext } from "@/utils/evals/columnOperations";
import { redirect } from "next/navigation";
// import { cookies } from "next/headers";
import { defaultNewCounter } from "@/constants/logs";
import { defaultItems } from "@/constants/logs";
import { IStoreState } from "@/contexts/store";
import { Suspense } from "react";
import SkeletonLoader from "../Common/Loaders/SkeletonLoader";
import { buildInitialState } from "@/contexts/utils/stateBuilderUtils";
import { StoreInitializer } from "../../contexts/providers/StoreInitializer";

const Main = async ({ tab, project, projectsActions, logsActions, derivedEntryActions, fieldsActions, contextActions, tabActions }: {
    tab: string | undefined,
    project: string | undefined,
    projectsActions: ProjectsActions,
    logsActions: LogsActions,
    derivedEntryActions: DerivedEntryActions,
    fieldsActions: FieldsActions,
    contextActions: ContextActions,
    tabActions: TabActions
}) => {

    // const cookies_ = cookies();
    const cookiesProject = undefined; //cookies_.get("project")?.value;
    const cookiesTab = undefined; //cookies_.get("tab")?.value;

    // Get projects
    const projects: string[] = await projectsActions.get();
    const currentProject = projects.find(proj => proj == (project || cookiesProject)) || null;

    // Get contexts
    let contexts: Context[] = [];
    if (currentProject)
        contexts = await contextActions.get(currentProject);

    // Get tabs
    const getTabsFromInterface = async (temporary: boolean) => {
        if (!currentProject) return {};
        
        // Fetch tabs
        const tabs = await tabActions.get(currentProject, temporary) || [];

        // Convert array to object with name as key
        return tabs.reduce((acc, curr) => ({...acc, [curr.name]: curr}), {});
    };

    // Fetch both regular and temporary tabs
    let tabs: Record<string, TabProps> = await getTabsFromInterface(false);
    let tabsTemp: Record<string, TabProps> = await getTabsFromInterface(true);

    // Check if the tab exists in either collection
    const tabCreated = tab != undefined && tab in tabs;
    const tempTabCreated = tab != undefined && tab in tabsTemp;

    // Find the current tab (using fallbacks)
    const tab_1 = Object.keys(tabsTemp).find(t => t == (tab || (
        currentProject == cookiesProject ? cookiesTab : undefined
    ))) || (
        Object.keys(tabsTemp).length ? Object.keys(tabsTemp).sort()[0] : null
    );

    // Get the current tab data
    let currentTab = (tab_1 && tab_1 in tabsTemp) ? tabsTemp[tab_1] : null;
    if (currentTab) {
        currentTab = {
            ...currentTab,
            items: currentTab?.items.map(item => ({
                ...item,
                minW: undefined,
                minH: undefined,
                context: contexts.find(ctx => ctx.name == currentTab?.context)?.name ?? item.context,
                column_context: item.column_context
            }))
        }
    }

    // Set up the saved tab (using the tab if it exists, or creating default)
    let savedTab = tabCreated ? tabs[tab_1 as string] : {
        name: tab_1 as string,
        project: currentProject,
        context: undefined,
        items: defaultItems,
        new_counter: defaultNewCounter
    } as TabProps;
    
    // Redirect if we have a project and tab but no tab in the URL
    if (!tab && currentProject && tab_1)
        redirect(`/interfaces?project=${currentProject}&tab=${tab_1}`);

    // get table and plot tiles
    let tableTiles = (currentTab?.items || []).filter(item => item.tab == "Table");
    let plotTiles = (currentTab?.items || []).filter(item => item.tab == "Plot");
    let viewTiles = (currentTab?.items || []).filter(item => item.tab == "View");

    // Get fields
    const fields: LogFieldsResponseProps[] = await Promise.all(
        tableTiles.map(tile => fieldsActions.get(currentProject as string, tile.context ?? null)
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
    const filterExpressions = tableTiles.map((tile, idx) => buildFilterExpression(tile.filters, tile.common_filter, tile.column_context, tile.freeze, fields[idx]))

    // Handle sorting
    const sortingObjects = tableTiles.map(tile => tile.sorting ? Object.fromEntries(
        tile.sorting.split(",").map(value => [
            tile.column_context ? processContext("merge", tile.column_context, value.split("@")[0]) : value.split("@")[0],
            value.split("@")[1].replace("true", "descending").replace("false", "ascending")
        ]))
        : "");
    const sortingExpressions = sortingObjects.map(
        sortingObject => sortingObject ? JSON.stringify(sortingObject) : null
    );

    /* Handle grouping */
	const groupingExpressions = tableTiles.map(tile => tile.grouping ? tile.grouping : null);

    // Handle group sorting
    const groupSortingObjects = tableTiles.map(tile => tile.group_sorting && tile.grouping ? Object.fromEntries(
        tile.group_sorting.split(",").map(value => {
            const group = tile.column_context ? processContext("merge", tile.column_context, tile.grouping!.split(",")[0]) : tile.grouping!.split(",")[0] 
            const field = tile.column_context ? processContext("merge", tile.column_context, value.split("@")[0]) : value.split("@")[0]
            const direction = value.split("@")[1].replace("true", "descending").replace("false", "ascending")
            const metric = tile.metric ?? "mean"
            return [group, {field, direction, metric}]
        }))
    : "");

    const groupSortingExpressions = groupSortingObjects.map(
        sortingObject => sortingObject ? JSON.stringify(sortingObject) : null
    )

    // Aggregate table arguments and init plot arguments
    let tableArguments: TableArguments = tableTiles.map((tile, idx) => {
        let tableArguments_: TableArguments = { [tile.i]: {getLogs_parameters: { filter_expr: "" }, available_fields: {}} };
        const sortingExpression = sortingExpressions[idx];
        const groupingExpression = groupingExpressions[idx];
        const groupSortingExpression = groupSortingExpressions[idx];
        if (tile.filters) tableArguments_[tile.i].getLogs_parameters["column_filters"] = tile.filters;
        if (tile.common_filter) tableArguments_[tile.i].getLogs_parameters["common_filter"] = tile.common_filter;
        if (tile.freeze) tableArguments_[tile.i].getLogs_parameters["freeze"] = tile.freeze;
        if (sortingExpression) tableArguments_[tile.i].getLogs_parameters["sorting"] = sortingExpression;
        if (groupingExpression) tableArguments_[tile.i].getLogs_parameters["grouping"] = groupingExpression;
        if (groupSortingExpression) tableArguments_[tile.i].getLogs_parameters["group_sorting"] = groupSortingExpression;
        if (tile.context) tableArguments_[tile.i].getLogs_parameters["context"] = tile.context;
        if (tile.column_context) tableArguments_[tile.i].getLogs_parameters["column_context"] = tile.column_context;
        return tableArguments_;
    }).reduce((acc, curr) => ({ ...acc, ...curr }), {});
    const plotArguments: PlotArguments = Object.fromEntries(Object.entries(tableArguments).map(([table, args]) => [table, args.getLogs_parameters]));

    // Get logs with pagination, and plot logs subset for all tables
    let allLogsData: LogsResponseProps[] = Array(tableTiles.length).fill({ params: {}, logs: [], count: 0, groups: [] });
    const limit = 20;
    const offsets: number[] = tableTiles.map(tile => (tile.page_number ? parseInt(tile.page_number) : 0) * limit);
    let allTotalPages: number[] = Array(tableTiles.length).fill(1);
    let plotData: PlotDataProps = {};
    const plotFields: LogFieldsResponseProps = tableTiles.map((tile, idx) => {
        const columnContext = tile.column_context;
        return Object.fromEntries(
            Object
                .entries(fields[idx])
                .filter(([name, { data_type, field_type, artifacts }]) => columnContext ? name.startsWith(columnContext) : name)
                .map(([name, { data_type, field_type, artifacts }]) => {
                    const newName = columnContext ? processContext("split", columnContext, name) : name
                    return [`${tile.i}.${newName}`, { data_type, field_type, artifacts }];
                })
        )
    }).reduce((acc, curr) => ({ ...acc, ...curr }), {});
    if (currentProject) {
        // fetch table data
        await Promise.all(tableTiles.map(async (tile, idx) => {
            const logsData = await logsActions.get(
                currentProject,
                tile.context ?? null,
                tile.column_context ?? null,
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
        await Promise.all(plotTiles.map(async (tile) => {

            // get all tables that are used in the plot
            let tableIdx1 = -1;
            if (tile.x_axis && tile.x_axis.includes("."))
                tableIdx1 = tableTiles.findIndex(it => it.i == tile.x_axis?.split(".")[0]);
            let tableIdx2 = -1;
            if (tile.y_axis && tile.y_axis.includes("."))
                tableIdx2 = tableTiles.findIndex(it => it.i == tile.y_axis?.split(".")[0]);
            const tables = [tableIdx1, tableIdx2 != tableIdx1 ? tableIdx2 : -1].filter(it => it != -1);

            // fetch plot data for each table
            const plotData_ = (await Promise.all(tables.map(async (tableIdx) => {
                const table = tableTiles[tableIdx];
                
                // aggregate plot arguments
                const context = table?.context;
                const columnContext = table?.column_context;
                const freeze = table?.freeze
                const commonFilter = table?.common_filter
                const filters = table?.filters
                if (filters) plotArguments[table.i]["column_filters"] = filters
                if (commonFilter) plotArguments[table.i]["common_filter"] = commonFilter
                if (freeze) plotArguments[table.i]["freeze"] = freeze
                if (context) plotArguments[table.i]["context"] = context
                if (columnContext) plotArguments[table.i]["column_context"] = columnContext;

                const filterExpression = filterExpressions[tableIdx];
                
                // get plot data
                let data: LogsResponseProps = { params: {}, logs: [], count: 0, groups: [] };
                let [xAxis, yAxis, group] = [tile.x_axis, tile.y_axis, tile.plot_group_by];
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

                    data = await logsActions.get(currentProject, context ?? null, columnContext ?? null, filterExpression, null, null, null, subset, null, null, null, null, null, Date.now().toString());

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
                plotData[tile.i] = mergedPlotData;
            }
            else {
                // if no tables are used in the plot, return empty plot data
                plotData[tile.i] = {
                    plotLogs: [],
                    plotArguments: {},
                    plotFields: plotFields
                }
            }
    
        }));
    }

    const tableData: TableDataProps = (await Promise.all(
        tableTiles.map(async (tile, idx) => {
            const logsData = allLogsData[idx];
            const totalPages = allTotalPages[idx];
            const context = tile.context ?? null;
            const columnContext = tile.column_context ?? null
            const sorting = tile.sorting ?? null
            const hiddenColumns = tile.hidden_columns;

            const { entriesProperties, paramsProperties, logs, params, metrics, groupedMetrics, boundaries } = await getLogsDetails(
                tile,
                logsData,
                fields[idx],
                context,
                columnContext,
                currentProject,
                filterExpressions[idx],
                groupingExpressions[idx],
                tile.metric,
                sorting,
                undefined,
                logsActions
            );

            // Append available fields to the table attributes
            tableArguments[tile.i].available_fields = 
            Object.fromEntries(
                Object.entries(fields[idx])
                    .filter((([field, attributes]) => entriesProperties.concat(paramsProperties).includes(field)))
            )

            // Get other attributes shared across tables and corresponding views

            const columnOrdering = tile.column_order;
            const selection = tile.selected;
            const baseIndex = tile.base_index;

            return {
                [tile.i]: {
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
                    metric: tile.metric ?? "mean"
                }
            }
        })
    )).reduce((acc, curr) => ({ ...acc, ...curr }), {});

    // Initialize the store state with the initial data

    // TODO: In future versions, we'll support multiple interfaces per project
    // For now, hardcode a default interface ID
    const currentProjectName = currentProject || null;
    const currentInterfaceName = "interface";
    const currentTabName = tab_1 || null;

    // Construct the initial state
    const tabsData: TabsDataProps = {}

    // Add current tab
    if (currentTabName) {
        const currentTabId = `${currentProjectName}>${currentInterfaceName}>${currentTabName}`;
        tabsData[currentTabId] = {
            name: currentTabName,
            project: currentProject,
            globalContext: currentTab?.context,
            items: currentTab?.items || [],
            new_counter: currentTab?.new_counter || 0,
            tableTiles: tableTiles,
            plotTiles: plotTiles,
            viewTiles: viewTiles,
            tabCreated: tabCreated,
            tempTabCreated: tempTabCreated,
            savedTab: savedTab,
        } as TabsDataProps[keyof TabsDataProps]

        // Add other tabs
        Object.entries(tabsTemp).forEach(([name, data]) => {
            if (name !== currentTabName) {
                const tabId = `${currentProjectName}>${currentInterfaceName}>${name}`;
                tabsData[tabId] = {
                    name: name,
                    project: data.project,
                    globalContext: data.context,
                    items: data.items,
                    new_counter: data.new_counter,
                    tableTiles: [],
                    plotTiles: [],
                    viewTiles: [],
                    tabCreated: true,
                    tempTabCreated: true,
                    savedTab: tabs[name],
                } as TabsDataProps[keyof TabsDataProps];
            }
        })
    }

    // Now build the initial state
    const initialState: Partial<IStoreState> = buildInitialState(
        currentTabName,
        currentInterfaceName,
        currentProjectName,
        projects,
        contexts,
        tabs,
        tabsData,
        tableData,
        plotData,
        tableArguments,
        limit,
        offsets,
    );

    // Initialize operations as an empty object in the initial state
    initialState.operations = {};

    return (
        <Suspense fallback={
            <div className="w-full h-full flex items-center justify-center">
                <SkeletonLoader />
            </div>
        }>
            <StoreInitializer 
                initialState={initialState}
                projectsActions={projectsActions}
                logsActions={logsActions}
                derivedEntryActions={derivedEntryActions}
                fieldsActions={fieldsActions}
                contextActions={contextActions}
                tabActions={tabActions}
            />
        </Suspense>
    );
};

export default Main;

// NOTE: State Management with Server Refetches
// -------------------------------------------
// When sorting, grouping, or filtering changes, Main.tsx re-executes on the server
// with new URL parameters. We fetch fresh data and create a new initialState object.
//
// The state update flow works as follows:
// 1. StoreProvider and StoreUpdater receive the new initialState from Main.tsx
// 2. StoreUpdater component detects that initialState has changed
// 3. StoreUpdater calls the resetState action to update the Zustand store
// 4. The resetState action performs a deep merge of the new state with the existing state
// 5. UI components connected to the store automatically re-render with the new data
//
// This approach allows us to:
// - Preserve client-side modifications to the state
// - Update the state with fresh server data when parameters change
// - Avoid full page re-renders that would reset scroll position and UI state
