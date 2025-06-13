import { ResponseProps } from "../common";
import { getLogsParameters, LogFieldsProps, LogFieldsResponseProps, LogItemProps, LogProps, LogsResponseProps, GroupedLogProps, PlotArguments } from "./logs";

export interface TileProps {
    id: string;
    name: string;
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
    plot_group_by_colors?: string;
    bin_count?: string;
    regression_line?: string;
    file_name?: string;
    file_type?: string;
    content?: string;
    shell_type?: string;
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
    metric: string,
    newCells?: string[]
}

export interface PlotDataItem {
    plotLogs: LogProps[];
    plotFields: LogFieldsResponseProps;
}

export interface TableDataProps {
    [key: string]: TableDataItem
}

export interface PlotDataProps {
    [key: string]: PlotDataItem
}

export interface EditorDataProps {
    [key: string]: {
        file_name: string,
        file_type: string,
        content: string,
    }
}

export interface TerminalDataProps {
    [key: string]: {
        shell_type: string,
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
    | "plot_group_by_colors"
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
    | "content"
    | "shell_type";

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
        terminalTiles: TileProps[],
        tabCreated: boolean,
        tempTabCreated: boolean,
        savedTab: TabProps | null,
    }
}

export interface InterfaceData {
    id?: string;
    project_id?: string;
    name: string;
    color?: string;
    active_tab_id?: string;
    created_at?: string;
    updated_at?: string;
}

export interface TabData {
    id?: string;
    interface_id?: string;
    name: string;
    visible?: boolean;
    active?: boolean;
    order?: number;
    global_context?: string;
    color?: string;
    created_at?: string;
    updated_at?: string;
}

export interface TileLayout {
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    minH?: number;
    moved?: boolean;
    static?: boolean;
}

export interface TilePosition {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface TileData {
    id?: string;
    tab_id?: string;
    name: string;
    type: string;
    position: TilePosition;
    minW?: number;
    minH?: number;
    visible?: boolean;
    locked?: boolean;
    color?: string;
    context?: string;
    table?: string;
    auto_update?: string;
    freeze?: string;
    filters?: string;
    common_filter?: string;
    metric?: string;
    column_context?: string;
    grouping?: string;
    table_tile?: TableTileData;
    plot_tile?: PlotTileData;
    view_tile?: ViewTileData;
    editor_tile?: EditorTileData;
    terminal_tile?: TerminalTileData;
    created_at?: string;
    updated_at?: string;
}

export interface TableTileData {
    table_type?: string;
    limit?: number;
    offset?: number;
    page_number?: string;
    column_order?: string;
    hidden_columns?: string;
    sorting?: string;
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
    file_name?: string;
    file_type?: string;
    content?: string;
}

export interface TerminalTileData {
    shell_type?: string;
}

export interface ProjectsActions {
    get: () => Promise<string[]>,
    create: (name: string) => Promise<ResponseProps>,
    rename: (name: string, newName: string) => Promise<ResponseProps>,
    delete: (name: string) => Promise<ResponseProps>,
}

export interface LogsActions {
    create: (project: string, context: string | null, params: { [param: string]: string }[], entries: { [entry: string | number]: string }[]) => Promise<ResponseProps>,
    get: (project: string, context: string | null, columnContext: string | null, filterExpression: string | null, sortingExpression: string | null, groupingExpression: string | null, groupSortingExpression: string | null, from_ids: string | null, rom_fields: string | null, exclude_fields: string | null, limit: number | null, offset: number | null, group_depth: number | null, return_ids_only: string | null, _timestamp: string | null) => Promise<LogsResponseProps>,
    getLatest: (project: string, context: string | null, columnContext: string | null, filterExpression: string | null, sortingExpression: string | null, groupingExpression: string | null, groupSortingExpression: string | null, from_ids: string | null, from_fields: string | null, exclude_fields: string | null, limit: number | null, offset: number | null, group_depth: number | null, return_ids_only: string | null) => Promise<string>,
    getMetrics: (project: string, context: string | null, filterExpression: string | null, groupingExpression: string | null, metricName: string, keyNames: string[]) => Promise<{ [key: string]: number } | { [key: string]: { [key: string]: { [key: string]: number } } }>,
    delete: (project: string, context: string | null, ids_and_fields: LogFieldsProps, source_type: string | null) => Promise<ResponseProps>,
    update: (project: string, context: string | null, logs: number[], entries: LogItemProps, params: LogItemProps, overwrite?: boolean) => Promise<ResponseProps>
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
    run: (project: string, filePath: string, env?: { [key: string]: string } | { key: string; value: string }[]) => Promise<ResponseProps>
    createTerminal: (shell?: string, cwd?: string) => Promise<{ session_id: string }>;
    runTerminal: (sessionId: string, cmd: string) => Promise<{ output: string }>;
    getTerminalOutput: (sessionId: string) => Promise<{ output: string }>;
    stopTerminal: (sessionId: string) => Promise<void>;
}

export interface DevboxActions {
    get: () => Promise<ResponseProps>,
    create: () => Promise<ResponseProps>
}

export interface GranularInterfaceActions {
    // Get interface by name (hierarchical path)
    getByName: (projectId: string, name: string, checkpoint?: boolean) => Promise<InterfaceData | null>;
    // Get interface by direct ID
    getById: (interface_id: string, checkpoint?: boolean) => Promise<InterfaceData | null>;
    // Unified get method
    get: (params: { interface_id?: string; projectId?: string; name?: string; checkpoint?: boolean }) => Promise<InterfaceData | null>;
    
    // Create interface (no change, always needs projectId)
    create: (projectId: string, name: string, color?: string) => Promise<InterfaceData>;
    
    // Update methods
    updateByName: (projectId: string, name: string, data: { name?: string, active_tab_id?: string, color?: string }, checkpoint?: boolean) => Promise<InterfaceData>;
    updateById: (interface_id: string, data: { name?: string, active_tab_id?: string, color?: string }, checkpoint?: boolean) => Promise<InterfaceData>;
    update: (params: {
        interface_id?: string;
        projectId?: string;
        name?: string;
        data: { name?: string, active_tab_id?: string, color?: string };
        checkpoint?: boolean;
    }) => Promise<InterfaceData>;
    
    // Delete methods
    deleteByName: (projectId: string, name: string) => Promise<ResponseProps>;
    deleteById: (interface_id: string) => Promise<ResponseProps>;
    delete: (params: { interface_id?: string; projectId?: string; name?: string }) => Promise<ResponseProps>;
    
    // List interfaces (no change needed)
    list: (projectId: string, checkpoint?: boolean) => Promise<InterfaceData[]>;
    
    // Checkpoint methods
    checkpointByName: (projectId: string, name: string, description: string) => Promise<ResponseProps>;
    checkpointById: (interface_id: string, description: string) => Promise<ResponseProps>;
    checkpoint: (params: { interface_id?: string; projectId?: string; name?: string; description: string }) => Promise<ResponseProps>;

    // Checkpoint retrieval methods (read)
    getCheckpointByName: (projectId: string, name: string) => Promise<InterfaceData>;
    getCheckpointById: (interface_id: string) => Promise<InterfaceData>;
    getCheckpoint: (params: { interface_id?: string; projectId?: string; name?: string }) => Promise<InterfaceData | null>;
}

export interface GranularTabActions {
    // Get tab by name (hierarchical path)
    getByName: (interface_id: string, name: string, checkpoint?: boolean) => Promise<TabData | null>;
    // Get tab by direct ID
    getById: (id: string, checkpoint?: boolean) => Promise<TabData | null>;
    // Unified get method
    get: (params: { id?: string; interface_id?: string; name?: string; checkpoint?: boolean }) => Promise<TabData | null>;
    
    // Get tab with tiles - same pattern
    getTabWithTilesByName: (interface_id: string, name: string, checkpoint?: boolean) => Promise<TabData | null>;
    getTabWithTilesById: (id: string, checkpoint?: boolean) => Promise<TabData | null>;
    getTabWithTiles: (params: { id?: string; interface_id?: string; name?: string; checkpoint?: boolean }) => Promise<TabData | null>;
    
    // Create tab (parent id + name pattern)
    create: (interface_id: string, name: string, data: {
        visible?: boolean;
        active?: boolean;
        order?: number;
        global_context?: string;
        color?: string;
    },
    tab_id?: string) => Promise<TabData>;
    
    // Update methods
    updateByName: (interface_id: string, name: string, data: {
        name?: string;
        visible?: boolean;
        active?: boolean;
        order?: number;
        global_context?: string;
        color?: string;
    }, checkpoint?: boolean) => Promise<TabData>;
    
    updateById: (id: string, data: {
        name?: string;
        visible?: boolean;
        active?: boolean;
        order?: number;
        global_context?: string;
        color?: string;
    }, checkpoint?: boolean) => Promise<TabData>;
    
    update: (params: {
        id?: string;
        interface_id?: string;
        name?: string;
        data: {
            name?: string;
            visible?: boolean;
            active?: boolean;
            order?: number;
            global_context?: string;
            color?: string;
        };
        checkpoint?: boolean;
    }) => Promise<TabData>;
    
    // Delete methods
    deleteByName: (interface_id: string, name: string) => Promise<ResponseProps>;
    deleteById: (id: string) => Promise<ResponseProps>;
    delete: (params: { id?: string; interface_id?: string; name?: string }) => Promise<ResponseProps>;
    
    // List tabs in an interface
    list: (interface_id: string, checkpoint?: boolean) => Promise<TabData[]>;
    
    // Checkpoint methods
    checkpointByName: (interface_id: string, name: string, description: string) => Promise<ResponseProps>;
    checkpointById: (id: string, description: string) => Promise<ResponseProps>;
    checkpoint: (params: { id?: string; interface_id?: string; name?: string; description: string }) => Promise<ResponseProps>;

    // Checkpoint retrieval methods (read)
    getCheckpointByName: (interface_id: string, name: string) => Promise<TabData>;
    getCheckpointById: (id: string) => Promise<TabData>;
    getCheckpoint: (params: { id?: string; interface_id?: string; name?: string }) => Promise<TabData | null>;
}

export interface GranularTileActions {
    // Get tile by name (hierarchical path)
    getByName: (tabId: string, tileName: string, checkpoint?: boolean) => Promise<TileData | null>;
    // Get tile by direct ID
    getById: (id: string, checkpoint?: boolean) => Promise<TileData | null>;
    // Unified get method that accepts either ID or tab_id+name
    get: (params: { id?: string; tab_id?: string; name?: string; checkpoint?: boolean }) => Promise<TileData | null>;
    
    // Create tile (single parent id + name pattern)
    create: (tab_id: string, name: string, position: TilePosition, data: { 
        minW?: number;
        minH?: number;
        visible?: boolean;
        locked?: boolean;
        moved?: boolean;
        static?: boolean;
        color?: string;
        context?: string;
        table?: string;
        auto_update?: string;
        freeze?: string;
        filters?: string;
        common_filter?: string;
        metric?: string;
        column_context?: string;
        grouping?: string;
        table_tile?: TableTileData;
        plot_tile?: PlotTileData;
        view_tile?: ViewTileData;
        editor_tile?: EditorTileData;
        terminal_tile?: TerminalTileData;
    },
    tile_id?: string,
    type?: string) => Promise<TileData>;
    
    // Update by name (tab_id + name)
    updateByName: (tab_id: string, name: string, data: {
        name?: string;
        position?: TilePosition;
        minW?: number;
        minH?: number;
        visible?: boolean;
        locked?: boolean;
        context?: string;
        color?: string;
        table?: string;
        auto_update?: string;
        freeze?: string;
        filters?: string;
        common_filter?: string;
        metric?: string;
        column_context?: string;
        grouping?: string;
        table_tile?: TableTileData;
        plot_tile?: PlotTileData;
        view_tile?: ViewTileData;
        editor_tile?: EditorTileData;
        terminal_tile?: TerminalTileData;
    }, checkpoint?: boolean) => Promise<TileData>
    
    // Update by direct ID
    updateById: (id: string, data: {
        name?: string;
        position?: TilePosition;
        minW?: number;
        minH?: number;
        visible?: boolean;
        locked?: boolean;
        color?: string;
        context?: string;
        table?: string;
        auto_update?: string;
        freeze?: string;
        filters?: string;
        common_filter?: string;
        metric?: string;
        column_context?: string;
        grouping?: string;
        table_tile?: TableTileData;
        plot_tile?: PlotTileData;
        view_tile?: ViewTileData;
        editor_tile?: EditorTileData;
        terminal_tile?: TerminalTileData;
    }, checkpoint?: boolean) => Promise<TileData>;
    
    // Unified update method that accepts either ID or tab_id+name
    update: (params: { 
        id?: string; 
        tab_id?: string; 
        name?: string; 
        data: {
            name?: string;
            position?: TilePosition;
            minW?: number;
            minH?: number;
            visible?: boolean;
            locked?: boolean;
            color?: string;
            context?: string;
            table?: string;
            auto_update?: string;
            freeze?: string;
            filters?: string;
            common_filter?: string;
            metric?: string;
            column_context?: string;
            grouping?: string;
            table_tile?: TableTileData;
            plot_tile?: PlotTileData;
            view_tile?: ViewTileData;
            editor_tile?: EditorTileData;
            terminal_tile?: TerminalTileData;
        }, 
        checkpoint?: boolean 
    }) => Promise<TileData>;
    
    // Patch methods follow the same pattern as update
    patchByName: (
        tab_id: string, 
        name: string, 
        updateData: {
            name?: string;
            position?: TilePosition;
            minW?: number;
            minH?: number;
            visible?: boolean;
            locked?: boolean;
            color?: string;
            moved?: boolean;
            static?: boolean;
            context?: string;
            table?: string;
            auto_update?: string;
            freeze?: string;
            filters?: string;
            common_filter?: string;
            metric?: string;
            column_context?: string;
            grouping?: string;
            table_tile?: TableTileData;
            plot_tile?: PlotTileData;
            view_tile?: ViewTileData;
            editor_tile?: EditorTileData;
            terminal_tile?: TerminalTileData;
        }, 
        checkpoint?: boolean
    ) => Promise<TileData>;
    
    patchById: (
        id: string,
        updateData: {
            name?: string;
            position?: TilePosition;
            minW?: number;
            minH?: number;
            visible?: boolean;
            locked?: boolean;
            moved?: boolean;
            static?: boolean;
            color?: string;
            context?: string;
            table?: string;
            auto_update?: string;
            freeze?: string;
            filters?: string;
            common_filter?: string;
            metric?: string;
            column_context?: string;
            grouping?: string;
            table_tile?: TableTileData;
            plot_tile?: PlotTileData;
            view_tile?: ViewTileData;
            editor_tile?: EditorTileData;
            terminal_tile?: TerminalTileData;
        }, 
        checkpoint?: boolean
    ) => Promise<TileData>;
    
    patch: (params: {
        id?: string; 
        tab_id?: string; 
        name?: string;
        updateData: {
            name?: string;
            position?: TilePosition;
            minW?: number;
            minH?: number;
            visible?: boolean;
            locked?: boolean;
            moved?: boolean;
            static?: boolean;
            color?: string;
            context?: string;
            table?: string;
            auto_update?: string;
            freeze?: string;
            filters?: string;
            common_filter?: string;
            metric?: string;
            column_context?: string;
            grouping?: string;
            table_tile?: TableTileData;
            plot_tile?: PlotTileData;
            view_tile?: ViewTileData;
            editor_tile?: EditorTileData;
            terminal_tile?: TerminalTileData;
        },
        checkpoint?: boolean
    }) => Promise<TileData>;
    
    // Specialized patch methods follow the same pattern
    patchSpecializedByName: (
        tab_id: string, 
        name: string, 
        tileType: "Table" | "Plot" | "View" | "Editor" | "Terminal", 
        updateData: Record<string, any>, 
        checkpoint?: boolean
    ) => Promise<TileData>;
    
    patchSpecializedById: (
        id: string, 
        tileType: "Table" | "Plot" | "View" | "Editor" | "Terminal", 
        updateData: Record<string, any>, 
        checkpoint?: boolean
    ) => Promise<TileData>;
    
    patchSpecialized: (params: {
        id?: string; 
        tab_id?: string; 
        name?: string;
        tileType: "Table" | "Plot" | "View" | "Editor" | "Terminal";
        updateData: Record<string, any>;
        checkpoint?: boolean
    }) => Promise<TileData>;
    
    // Delete methods
    deleteByName: (tab_id: string, name: string) => Promise<ResponseProps>;
    deleteById: (id: string) => Promise<ResponseProps>;
    delete: (params: { id?: string; tab_id?: string; name?: string }) => Promise<ResponseProps>;
    
    // List tiles in a tab
    list: (tab_id: string, type?: string, checkpoint?: boolean) => Promise<TileData[]>;
    
    // Checkpoint methods
    checkpointByName: (tab_id: string, name: string, description: string) => Promise<ResponseProps>;
    checkpointById: (id: string, description: string) => Promise<ResponseProps>;
    checkpoint: (params: { id?: string; tab_id?: string; name?: string; description: string }) => Promise<ResponseProps>;

    // Checkpoint retrieval methods (read)
    getCheckpointByName: (tab_id: string, name: string) => Promise<TileData>;
    getCheckpointById: (id: string) => Promise<TileData>;
    getCheckpoint: (params: { id?: string; tab_id?: string; name?: string }) => Promise<TileData | null>;
}

export interface FileEntry {
    name: string;
    type: string;
    isSymlink?: boolean;
}

export interface FileActions {
    // Retrieve list of file entries in the given project directory.
    // Depending on the backend, this may return the array directly or under a `files` key.
    list: (project: string) => Promise<{ files: FileEntry[] } | FileEntry[]>;
    // Write/overwrite multiple files in the project directory (path -> content)
    write: (project: string, files: Record<string, string>) => Promise<any>;
    // Read the contents of a single file
    read: (project: string, path: string) => Promise<{ content: string }>;
    // Delete a single file from the project directory
    delete: (project: string, path: string, isDirectory?: boolean) => Promise<any>;
    // Rename file or directory
    rename: (project: string, oldPath: string, newPath: string) => Promise<any>;
}
