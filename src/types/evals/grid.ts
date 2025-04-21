import { ResponseProps } from "../common";
import { getLogsParameters, LogFieldsProps, LogFieldsResponseProps, LogItemProps, LogProps, LogsResponseProps, GroupedLogProps, PlotArguments } from "./logs";

export interface TileProps {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    minH?: number;
    moved?: boolean;
    static?: boolean;
    visible?: boolean;
    color?: string;
    tab?: string;
    table?: string;
    table_type?: string;
    context?: string;
    column_context?: string;
    prev_context?: string;
    auto_update?: string;
    freeze?: string;
    filters?: string;
    common_filter?: string;
    page_number?: string;
    metric?: string;
    column_order?: string;
    hidden_columns?: string;
    sorting?: string;
    grouping?: string;
    group_sorting?: string;
    columns_pin_left?: string;
    columns_pin_right?: string;
    selected?: string;
    base_index?: string;
    plot_type?: string;
    plot_scale_x?: string;
    plot_scale_y?: string;
    plot_aggregate?: string;
    x_axis?: string;
    y_axis?: string;
    plot_group_by?: string;
    bin_count?: string;
    regression_line?: string;
    file_name?: string;
    file_type?: string;
    content?: string;
}

export interface TableDataItem {
    columnContexts: string[],
    baseIndex: string | undefined,
    hiddenColumns: string | undefined,
    columnOrdering: string | undefined,
    selection: string | undefined,
    fields: LogFieldsResponseProps,
    logsData: LogsResponseProps,
    totalPages: number,
    entriesProperties: string[],
    paramsProperties: string[],
    logs: LogProps[] | GroupedLogProps[],
    params: LogItemProps,
    metrics: { [key: string]: number },
    groupedMetrics?: { [key: string]: { [key: string]: { [key: string]: { [key: string]: number | string } } } },
    boundaries: { minimums: { [key: string]: number }, maximums: { [key: string]: number } },
    metric: string
}

export interface PlotDataItem {
    plotLogs: LogProps[];
    plotArguments: PlotArguments;
    plotFields: LogFieldsResponseProps;
}

export interface TableDataProps {
    [key: string]: TableDataItem
}

export interface PlotDataProps {
    [key: string]: {
        plotLogs: LogProps[],
        plotArguments: PlotArguments,
        plotFields: LogFieldsResponseProps,
    }
}

export interface EditorDataProps {
    [key: string]: {
        file_name: string,
        file_type: string,
        content: string,
    }
}

export type ItemType =
    | "tab"
    | "bin_count"
    | "regression_line"
    | "plot_type"
    | "plot_scale_x"
    | "plot_scale_y"
    | "plot_aggregate"
    | "x_axis"
    | "y_axis"
    | "plot_group_by"
    | "selected"
    | "base_index"
    | "metric"
    | "filters"
    | "common_filter"
    | "page_number"
    | "column_order"
    | "hidden_columns"
    | "sorting"
    | "grouping"
    | "group_sorting"
    | "columns_pin_left"
    | "columns_pin_right"
    | "table"
    | "context"
    | "column_context"
    | "prev_context"
    | "auto_update"
    | "freeze"
    | "visible"
    | "color"
    | "table_type"
    | "file_name"
    | "file_type"
    | "content";

export interface Context {
    name: string,
    description: string
}

export interface TabProps {
    name: string,
    project: string,
    context: string | undefined,
    items: TileProps[],
    new_counter: number,
    color: string | undefined
}

export interface TabsDataProps {
    [key: string]: {
        name: string,
        items: TileProps[],
        globalContext: string | undefined,
        tableTiles: TileProps[],
        plotTiles: TileProps[],
        viewTiles: TileProps[],
        editorTiles: TileProps[],
        tabCreated: boolean,
        tempTabCreated: boolean,
        savedTab: TabProps | null,
    }
}

export interface InterfaceData {
    id?: string;
    project_id: string;
    name: string;
    color?: string;
    active_tab_id?: string;
    created_at?: string;
    updated_at?: string;
}

export interface TabData {
    id?: string;
    interface_id: string;
    name: string;
    visible?: boolean;
    active?: boolean;
    order?: number;
    global_context?: string;
    color?: string;
    created_at?: string;
    updated_at?: string;
}

export interface TilePosition {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface TileData {
    id?: string;
    tab_id: string;
    name: string;
    type: string;
    position: TilePosition;
    min_width?: number;
    min_height?: number;
    visible?: boolean;
    locked?: boolean;
    context?: string;
    table?: string;
    auto_update?: string;
    freeze?: string;
    filters?: string;
    common_filter?: string;
    metric?: string;
    table_tile?: TableTileData;
    plot_tile?: PlotTileData;
    view_tile?: ViewTileData;
    editor_tile?: EditorTileData;
    created_at?: string;
    updated_at?: string;
}

export interface TableTileData {
    table_type?: string;
    column_context?: string;
    page_number?: string;
    column_order?: string;
    hidden_columns?: string;
    sorting?: string;
    grouping?: string;
    group_sorting?: string;
    columns_pin_left?: string;
    columns_pin_right?: string;
    selected?: string;
}

export interface PlotTileData {
    plot_type?: string;
    plot_scale_x?: string;
    plot_scale_y?: string;
    plot_aggregate?: string;
    x_axis?: string;
    y_axis?: string;
    plot_group_by?: string;
    plot_group_by_colors?: string;
    bin_count?: string;
    regression_line?: string;
}

export interface ViewTileData {
    base_index?: string;
}

export interface EditorTileData {
    file_path?: string;
    file_type?: string;
    content?: string;
}

export interface ProjectsActions {
    get: () => Promise<string[]>,
    create: (name: string) => Promise<ResponseProps>,
    rename: (name: string, newName: string) => Promise<ResponseProps>,
    delete: (name: string) => Promise<ResponseProps>,
}

export interface LogsActions {
    create: (project: string, context: string | null, params: { [param: string]: string }[], entries: { [entry: string | number]: string }[]) => Promise<ResponseProps>,
    get: (project: string, context: string | null, columnContext: string | null, filterExpression: string | null, sortingExpression: string | null, groupingExpression: string | null, groupSortingExpression: string | null, from_fields: string | null, exclude_fields: string | null, limit: number | null, offset: number | null, group_depth: number | null, return_ids_only: string | null, _timestamp: string | null) => Promise<LogsResponseProps>,
    getLatest: (project: string, context: string | null, columnContext: string | null, filterExpression: string | null, sortingExpression: string | null, groupingExpression: string | null, groupSortingExpression: string | null, from_fields: string | null, exclude_fields: string | null, limit: number | null, offset: number | null, group_depth: number | null, return_ids_only: string | null) => Promise<string>,
    getMetrics: (project: string, context: string | null, filterExpression: string | null, groupingExpression: string | null, metricName: string, keyNames: string[]) => Promise<{ [key: string]: number } | { [key: string]: { [key: string]: { [key: string]: number } } }>,
    delete: (project: string, context: string | null, ids_and_fields: LogFieldsProps, source_type: string | null) => Promise<ResponseProps>,
}

export interface DerivedEntryActions {
    create: (project: string, context: string | undefined, key: string, equation: string, referenced_logs: { [table_name: string]: getLogsParameters }) => Promise<ResponseProps>,
    update: (project: string, context: string | undefined, key: string, equation: string | null, target_derived_logs: { [table_name: string]: getLogsParameters }) => Promise<ResponseProps>
}

export interface FieldsActions {
    get: (project: string, context: string | null) => Promise<LogFieldsResponseProps>,
}

export interface ContextActions {
    get: (project: string) => Promise<Context[]>,
    create: (name: string, project: string) => Promise<ResponseProps>,
    delete: (project: string, context: string) => Promise<ResponseProps>
}

export interface TabActions {
    get: (project: string, temporary: boolean) => Promise<TabProps[]>,
    create: (name: string, project: string, context: string | undefined, items: TileProps[], new_counter: number, temporary: boolean, color: string | undefined) => Promise<ResponseProps>,
    update: (name: string, project: string, context: string | undefined, items: TileProps[], new_counter: number, new_name: string | undefined, temporary: boolean, color: string | undefined) => Promise<ResponseProps>,
    delete: (name: string, project: string, temporary: boolean) => Promise<ResponseProps>
}

export interface CodeActions {
    run: (files: { [fileName: string]: string }, filePath: string, project: string) => Promise<ResponseProps>
}

export interface DevboxActions {
    get: () => Promise<ResponseProps>,
    create: () => Promise<ResponseProps>
}

export interface GranularProjectActions {
    listProjects: () => Promise<string[]>;
    getProjectById: (projectId: string) => Promise<any>;
    createProject: (data: { name: string; description?: string }) => Promise<ResponseProps>;
    updateProject: (projectId: string, data: { name?: string; description?: string }) => Promise<ResponseProps>;
    deleteProject: (projectId: string) => Promise<ResponseProps>;
}

export interface GranularContextActions {
    getContexts: (projectId: string) => Promise<Context[]>;
    createContext: (projectId: string, name: string) => Promise<ResponseProps>;
    deleteContext: (projectId: string, contextName: string) => Promise<ResponseProps>;
}

export interface GranularInterfaceActions {
    listInterfaces: (projectId: string, checkpoint?: boolean) => Promise<InterfaceData[]>;
    getInterfaceByName: (projectId: string, name: string, checkpoint?: boolean) => Promise<InterfaceData | null>;
    getInterfaceWithTabs: (projectId: string, name: string) => Promise<{interface: InterfaceData, tabs: TabData[]}>;
    createInterface: (projectId: string, name: string, color?: string) => Promise<InterfaceData>;
    updateInterface: (projectId: string, name: string, data: { name?: string, active_tab_id?: string, color?: string }, checkpoint?: boolean) => Promise<InterfaceData>;
    deleteInterface: (projectId: string, name: string) => Promise<ResponseProps>;
    createInterfaceCheckpoint: (projectId: string, name: string, description: string) => Promise<ResponseProps>;
}

export interface GranularTabActions {
    listTabs: (projectId: string, interfaceName: string, checkpoint?: boolean) => Promise<TabData[]>;
    getTabByName: (projectId: string, interfaceName: string, tabName: string, checkpoint?: boolean) => Promise<TabData | null>;
    getTabWithTiles: (projectId: string, interfaceName: string, tabName: string) => Promise<{tab: TabData, tiles: TileData[]}>;
    createTab: (projectId: string, interfaceName: string, tabName: string, data: {
        visible?: boolean;
        active?: boolean;
        order?: number;
        global_context?: string;
        color?: string;
    }) => Promise<TabData>;
    updateTab: (projectId: string, interfaceName: string, tabName: string, data: {
        name?: string;
        visible?: boolean;
        active?: boolean;
        order?: number;
        global_context?: string;
        color?: string;
    }, checkpoint?: boolean) => Promise<TabData>;
    updateTabsPositions: (projectId: string, interfaceName: string, tabs: Array<{id: string; position: number}>) => Promise<ResponseProps>;
    deleteTab: (projectId: string, interfaceName: string, tabName: string) => Promise<ResponseProps>;
    createTabCheckpoint: (projectId: string, interfaceName: string, tabName: string, description: string) => Promise<ResponseProps>;
}

export interface GranularTileActions {
    listTiles: (projectId: string, interfaceName: string, tabName: string, type?: string, checkpoint?: boolean) => Promise<TileData[]>;
    getTileByName: (projectId: string, interfaceName: string, tabName: string, tileName: string, checkpoint?: boolean) => Promise<TileData | null>;
    createTile: (
        projectId: string, 
        interfaceName: string, 
        tabName: string, 
        data: { 
            name: string;
            type: string;
            position: TilePosition;
            min_width?: number;
            min_height?: number;
            visible?: boolean;
            locked?: boolean;
            context?: string;
            table?: string;
            auto_update?: string;
            freeze?: string;
            filters?: string;
            common_filter?: string;
            metric?: string;
            table_tile?: TableTileData;
            plot_tile?: PlotTileData;
            view_tile?: ViewTileData;
            editor_tile?: EditorTileData;
        }
    ) => Promise<TileData>;
    updateTile: (projectId: string, interfaceName: string, tabName: string, tileName: string, data: {
        name?: string;
        position?: TilePosition;
        min_width?: number;
        min_height?: number;
        visible?: boolean;
        locked?: boolean;
        context?: string;
        table?: string;
        auto_update?: string;
        freeze?: string;
        filters?: string;
        common_filter?: string;
        metric?: string;
        table_tile?: TableTileData;
        plot_tile?: PlotTileData;
        view_tile?: ViewTileData;
        editor_tile?: EditorTileData;
    }, checkpoint?: boolean) => Promise<TileData>;
    patchTile: (
        projectId: string, 
        interfaceName: string, 
        tabName: string, 
        tileName: string, 
        updateData: {
            name?: string;
            position?: TilePosition;
            min_width?: number;
            min_height?: number;
            visible?: boolean;
            locked?: boolean;
            moved?: boolean;
            static?: boolean;
            context?: string;
            table?: string;
            auto_update?: string;
            freeze?: string;
            filters?: string;
            common_filter?: string;
            metric?: string;
            table_tile?: TableTileData;
            plot_tile?: PlotTileData;
            view_tile?: ViewTileData;
            editor_tile?: EditorTileData;
        }, 
        checkpoint?: boolean
    ) => Promise<TileData>;
    patchSpecializedTile: (
        projectId: string, 
        interfaceName: string, 
        tabName: string, 
        tileName: string, 
        tileType: "Table" | "Plot" | "View" | "Editor", 
        updateData: Record<string, any>, 
        checkpoint?: boolean
    ) => Promise<TileData>;
    updateTilesPositions: (projectId: string, interfaceName: string, tabName: string, tiles: Array<{id: string; position: TilePosition}>) => Promise<ResponseProps>;
    deleteTile: (projectId: string, interfaceName: string, tabName: string, tileName: string) => Promise<ResponseProps>;
    createTileCheckpoint: (projectId: string, interfaceName: string, tabName: string, tileName: string, description: string) => Promise<ResponseProps>;
    getTableData: (projectId: string, interfaceName: string, tabName: string, tileId: string, isCheckpoint?: boolean) => Promise<any>;
    getPlotData: (projectId: string, interfaceName: string, tabName: string, tileId: string, isCheckpoint?: boolean) => Promise<any>;
    getViewData: (projectId: string, interfaceName: string, tabName: string, tileId: string, isCheckpoint?: boolean) => Promise<any>;
    getEditorData: (projectId: string, interfaceName: string, tabName: string, tileId: string, isCheckpoint?: boolean) => Promise<any>;
}
