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
    default_hidden_columns?: boolean;
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

export interface TableMetrics {
    [key: string]: number | string;
}

export interface TableGroupedMetrics {
    [key: string]: { [key: string]: { [key: string]: { [key: string]: number | string } } }
}

export interface TableBoundaries {
    minimums: { [key: string]: number },
    maximums: { [key: string]: number }
}

export interface TableDataItem {
    columnContexts: string[],
    fields: LogFieldsResponseProps,
    totalCount: number,
    entriesProperties: string[],
    paramsProperties: string[],
    logs: LogProps[] | GroupedLogProps[],
    params: LogItemProps,
    error: string | undefined,
    isLoading: boolean,  // Flag to indicate the table data is loading/being built. Might remove this later.
    newCells?: string[],
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
    | "default_hidden_columns"
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

// ===== TEMPLATE SCHEMAS =====

// Base Schema interface
export interface BaseSchema {
    id: string;
    created_at?: string;
    updated_at?: string;
    is_checkpoint?: boolean;
}

// Template Position for tiles in templates
export interface TilePosition {
    x: number;
    y: number;
    width: number;
    height: number;
}

// Specialized tile schemas (shared between template and non-template)
export interface TableTileData {
    id?: string;
    tile_id?: string;
    table_type?: string;
    limit?: number;
    offset?: number;
    group_limit?: number;
    group_offset?: number;
    page_number?: string;
    column_order?: string;
    hidden_columns?: string;
    default_hidden_columns?: boolean;
    sorting?: string;
    group_sorting?: string;
    columns_pin_left?: string;
    columns_pin_right?: string;
    selected?: string;
}

export interface PlotTileData {
    id?: string;
    tile_id?: string;
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
    id?: string;
    tile_id?: string;
    base_index?: string;
}

export interface EditorTileData {
    id?: string;
    tile_id?: string;
    file_name?: string;
    file_type?: string;
    content?: string;
}

export interface TerminalTileData {
    id?: string;
    tile_id?: string;
    shell_type?: string;
}

// Base template schema for tiles with common fields
export interface BaseTileTemplateSchema {
    name: string;
    position: TilePosition;
    type?: string;
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
    // Type-specific template data
    table_tile?: TableTileData;
    plot_tile?: PlotTileData;
    view_tile?: ViewTileData;
    editor_tile?: EditorTileData;
    terminal_tile?: TerminalTileData;
}

// Template schema for a detached tile - inherits all fields from base
export interface TileTemplateSchema extends BaseTileTemplateSchema {
    // Template-specific metadata
    template_version?: string;
    description?: string;
    created_by?: string;
    tags?: string[];
}

// Base tile schema with common fields - extends template base with IDs and timestamps
export interface BaseTileSchema extends BaseTileTemplateSchema {
    id?: string;
    tab_id?: string;
    created_at?: string;
    updated_at?: string;
    is_checkpoint?: boolean;
}

// Complete Tile schema with type-specific properties - now inherits from base
export interface TileData extends BaseTileSchema {
}

// Base template schema for tabs with common fields
export interface BaseTabTemplateSchema {
    name: string;
    visible?: boolean;
    active?: boolean;
    order?: number;
    context?: string;
    color?: string;
}

// Template schema for a detached tab
export interface TabTemplateSchema extends BaseTabTemplateSchema {
    tiles?: TileTemplateSchema[];
    // Template-specific metadata
    template_version?: string;
    description?: string;
    created_by?: string;
    tags?: string[];
}

// Base tab schema with common fields - extends template base with IDs and timestamps
export interface BaseTabSchema extends BaseTabTemplateSchema {
    id?: string;
    interface_id?: string;
    created_at?: string;
    updated_at?: string;
    is_checkpoint?: boolean;
}

// Complete Tab schema - now inherits from base
export interface TabData extends BaseTabSchema {
    tiles?: TileData[];
}

// Base template schema for interfaces with common fields
export interface BaseInterfaceTemplateSchema {
    name: string;
    color?: string;
    context?: string;
}

// Template schema for a detached interface
export interface InterfaceTemplateSchema extends BaseInterfaceTemplateSchema {
    tabs?: TabTemplateSchema[];
    active_tab_name?: string; // Use name instead of ID for templates
    // Template-specific metadata
    template_version?: string;
    description?: string;
    created_by?: string;
    tags?: string[];
}

// Base interface schema with common fields - extends template base with IDs and timestamps
export interface BaseInterfaceSchema extends BaseInterfaceTemplateSchema {
    id?: string;
    project_id?: string;
    created_at?: string;
    updated_at?: string;
    is_checkpoint?: boolean;
}

// Complete Interface schema - now inherits from base
export interface InterfaceData extends BaseInterfaceSchema {
    tabs?: TabData[];
    active_tab_id?: string;
    context?: string;
}

// Template schema for multiple interfaces from a project
export interface ProjectTemplateSchema {
    interfaces?: InterfaceTemplateSchema[];
    // Template-specific metadata
    template_version?: string;
    description?: string;
    created_by?: string;
    tags?: string[];
}

// Request/response schemas for creating/updating
export interface CreateTileRequest extends BaseTileTemplateSchema {
    tile_id?: string;
    tab_id: string;
}

export interface UpdateTileRequest {
    name?: string;
    position?: TilePosition;
    type?: string;
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
    // Type-specific fields
    table_tile?: TableTileData;
    plot_tile?: PlotTileData;
    view_tile?: ViewTileData;
    editor_tile?: EditorTileData;
    terminal_tile?: TerminalTileData;
}

export interface CreateTabRequest extends BaseTabTemplateSchema {
    tab_id?: string;
    interface_id: string;
}

export interface UpdateTabRequest {
    name?: string;
    visible?: boolean;
    active?: boolean;
    order?: number;
    context?: string;
    color?: string;
    icon?: string;
}

export interface CreateInterfaceRequest extends BaseInterfaceTemplateSchema {
    interface_id?: string;
    project: string;
}

export interface UpdateInterfaceRequest {
    name?: string;
    active_tab_id?: string;
    color?: string;
    icon?: string;
    context?: string;
}

// Validation schemas
export interface ValidationIssue {
    level: string; // "error", "warning", "info"
    component: string; // "interface", "tab", "tile", "table_tile", etc.
    component_name: string;
    issue_type: string; // "missing_context", "missing_table", "missing_column", etc.
    message: string;
    suggested_fix?: string;
}

export interface ValidationResultSchema {
    is_valid: boolean;
    issues?: ValidationIssue[];
    can_sanitize?: boolean;
    sanitized_template?: ProjectTemplateSchema | InterfaceTemplateSchema | TabTemplateSchema | TileTemplateSchema;
}


// Template export/import request schemas
export interface ExportTemplateRequest {
    include_metadata?: boolean;
    description?: string;
    tags?: string[];
    template_name?: string;
}

export interface ImportTemplateRequest {
    project: string;
    validate_first?: boolean;
    auto_sanitize?: boolean;
    overwrite_existing?: boolean;
}

// Specialized export request types
export interface ExportProjectTemplateRequest extends ExportTemplateRequest {
    project: string;
    interface_names?: string[];
    checkpoint?: boolean;
}

export interface ExportInterfaceTemplateRequest extends ExportTemplateRequest {
    interface_id?: string;
    project?: string;
    interface_name?: string;
    checkpoint?: boolean;
}

export interface ExportTabTemplateRequest extends ExportTemplateRequest {
    tab_id?: string;
    interface_id?: string;
    tab_name?: string;
    checkpoint?: boolean;
}

export interface ExportTileTemplateRequest extends ExportTemplateRequest {
    tile_id?: string;
    tab_id?: string;
    tile_name?: string;
    checkpoint?: boolean;
}

// Specialized import request types
export interface ImportProjectTemplateRequest extends ImportTemplateRequest {
    template: ProjectTemplateSchema;
    interface_name_prefix?: string;
}

export interface ImportInterfaceTemplateRequest extends ImportTemplateRequest {
    template: InterfaceTemplateSchema;
    new_interface_name?: string;
}

export interface ImportTabTemplateRequest extends ImportTemplateRequest {
    template: TabTemplateSchema;
    interface_id?: string;
    interface_name?: string;
    new_tab_name?: string;
}

export interface ImportTileTemplateRequest extends ImportTemplateRequest {
    template: TileTemplateSchema;
    tab_id?: string;
    interface_id?: string;
    tab_name?: string;
    new_tile_name?: string;
}

// Template response schemas
export interface TemplateExportResponse<T> {
    template: T;
    metadata?: {
        exported_at?: string;
        exported_by?: string;
        source_project?: string;
        version?: string;
    };
    export_stats?: {
        interfaces?: number;
        tabs?: number;
        tiles?: number;
    }
}

export interface TemplateImportResponse {
    success: boolean;
    validation_result?: ValidationResultSchema;
    import_stats?: Record<string, any>;
    created_ids?: Record<string, any>;
    warnings?: string[];
    error?: string;
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

export interface ProjectsActions {
    get: () => Promise<string[]>,
    create: (name: string) => Promise<ResponseProps>,
    rename: (name: string, newName: string) => Promise<ResponseProps>,
    update: (name: string, data: { icon?: string }) => Promise<ResponseProps>,
    delete: (name: string) => Promise<ResponseProps>,
    exportTemplate: (params: Omit<ExportProjectTemplateRequest, 'checkpoint' | 'include_metadata' | 'description' | 'tags' | 'template_name'>, options?: Pick<ExportProjectTemplateRequest, 'checkpoint' | 'include_metadata' | 'description' | 'tags' | 'template_name'>) => Promise<TemplateExportResponse<ProjectTemplateSchema> | { error: string }>,
    importTemplate: (template: ProjectTemplateSchema, options: Omit<ImportProjectTemplateRequest, 'template'>) => Promise<TemplateImportResponse | { error: string }>
}

export interface LogsActions {
    create: (
        project: string,
        context: string | null,
        params: { [param: string]: string }[],
        entries: { [entry: string]: string }[]
    ) => Promise<ResponseProps>;
    get: (
        project: string,
        context: string | null,
        columnContext: string | null,
        filterExpression: string | null,
        sortingExpression: string | null,
        groupingExpression: string | null,
        groupSortingExpression: string | null,
        from_ids: string | null,
        from_fields: string | null,
        exclude_fields: string | null,
        limit: number | null,
        offset: number | null,
        group_limit: number | null,
        group_offset: number | null,
        group_depth: number | null,
        return_ids_only: string | null,
        randomize: string | null,
        _timestamp: string | null,
        signal?: AbortSignal
    ) => Promise<LogsResponseProps>;
    getLatest: (
        project: string,
        context: string | null,
        columnContext: string | null,
        filterExpression: string | null,
        sortingExpression: string | null,
        groupingExpression: string | null,
        groupSortingExpression: string | null,
        from_ids: string | null,
        from_fields: string | null,
        exclude_fields: string | null,
        limit: number | null,
        offset: number | null,
        group_depth: number | null,
        return_ids_only: string | null,
        randomize: string | null,
        _timestamp: string | null,
        signal?: AbortSignal
    ) => Promise<string>;
    getMetrics: (
        project: string,
        context: string | null,
        filterExpression: string | null,
        groupingExpression: string | null,
        metricName: string,
        keyNames: string[]
    ) => Promise<{ [key: string]: number } | { [key:string]: { [key: string]: { [key: string]: number } } }>;
    delete: (project: string, context: string | null, ids_and_fields: LogFieldsProps) => Promise<ResponseProps>;
    update: (project: string, context: string | null, logs: number[], entries: LogItemProps, params: LogItemProps, overwrite?: boolean) => Promise<ResponseProps>
}

export interface DerivedEntryActions {
    create: (project: string, context: string | undefined, key: string, equation: string, referenced_logs: { [table_name: string]: getLogsParameters }) => Promise<ResponseProps>,
    update: (project: string, context: string | undefined, key: string, equation: string | null, target_derived_logs: { [table_name: string]: getLogsParameters }) => Promise<ResponseProps>
}

export interface FieldsActions {
    get: (project: string, context: string | null) => Promise<LogFieldsResponseProps>,
    rename: (project: string, context: string | null, oldFieldName: string, newFieldName: string) => Promise<ResponseProps>
}

export interface ContextActions {
    get: (project: string) => Promise<Context[]>,
    create: (name: string, project: string) => Promise<ResponseProps>,
    delete: (project: string, context: string) => Promise<ResponseProps>,
    rename: (project: string, current_name: string, new_name: string) => Promise<ResponseProps>
}

export interface TabActions {
    get: (project: string, temporary: boolean) => Promise<TabProps[]>,
    create: (name: string, project: string, context: string | undefined, items: TileProps[], new_counter: number, temporary: boolean, color: string | undefined) => Promise<ResponseProps>,
    update: (name: string, project: string, context: string | undefined, items: TileProps[], new_counter: number, new_name: string | undefined, temporary: boolean, color: string | undefined) => Promise<ResponseProps>,
    delete: (name: string, project: string, temporary: boolean) => Promise<ResponseProps>
}

export interface CodeActions {
    run: (project: string, filePath: string, env?: { [key: string]: string } | { key: string; value: string }[]) => Promise<ResponseProps>
    get: (filePath: string) => Promise<{ output: string, done: boolean }>;
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
    
    // Create interface (no change, always needs projectId) - reuses CreateInterfaceRequest
    create: (projectId: string, name: string, color?: string) => Promise<InterfaceData>;
    
    // Update methods - reuse UpdateInterfaceRequest
    updateByName: (projectId: string, name: string, data: UpdateInterfaceRequest, checkpoint?: boolean) => Promise<InterfaceData>;
    updateById: (interface_id: string, data: UpdateInterfaceRequest, checkpoint?: boolean) => Promise<InterfaceData>;
    update: (params: {
        interface_id?: string;
        projectId?: string;
        name?: string;
        data: UpdateInterfaceRequest;
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

    // Template methods - reuse template request/response schemas
    exportTemplate: (params: Omit<ExportInterfaceTemplateRequest, 'checkpoint' | 'include_metadata' | 'description' | 'tags' | 'template_name'>, options?: Pick<ExportInterfaceTemplateRequest, 'checkpoint' | 'include_metadata' | 'description' | 'tags' | 'template_name'>) => Promise<TemplateExportResponse<InterfaceTemplateSchema> | { error: string }>;
    importTemplate: (template: InterfaceTemplateSchema, options?: Omit<ImportInterfaceTemplateRequest, 'template'>) => Promise<TemplateImportResponse | { error: string }>;
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
    
    // Create tab (parent id + name pattern) - reuses CreateTabRequest fields
    create: (interface_id: string, name: string, data: Omit<CreateTabRequest, 'tab_id' | 'interface_id' | 'name'>, tab_id?: string) => Promise<TabData>;
    
    // Update methods - reuse UpdateTabRequest
    updateByName: (interface_id: string, name: string, data: UpdateTabRequest, checkpoint?: boolean) => Promise<TabData>;
    updateById: (id: string, data: UpdateTabRequest, checkpoint?: boolean) => Promise<TabData>;
    update: (params: {
        id?: string;
        interface_id?: string;
        name?: string;
        data: UpdateTabRequest;
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

    // Template methods - reuse template request/response schemas
    exportTemplate: (params: Omit<ExportTabTemplateRequest, 'checkpoint' | 'include_metadata' | 'description' | 'tags' | 'template_name'>, options?: Pick<ExportTabTemplateRequest, 'checkpoint' | 'include_metadata' | 'description' | 'tags' | 'template_name'>) => Promise<TemplateExportResponse<TabTemplateSchema> | { error: string }>;
    importTemplate: (template: TabTemplateSchema, params: Pick<ImportTabTemplateRequest, 'interface_id' | 'interface_name'>, options?: Omit<ImportTabTemplateRequest, 'template' | 'interface_id' | 'interface_name'>) => Promise<TemplateImportResponse | { error: string }>;
}

export interface GranularTileActions {
    // Get tile by name (hierarchical path)
    getByName: (tabId: string, tileName: string, checkpoint?: boolean) => Promise<TileData | null>;
    // Get tile by direct ID
    getById: (id: string, checkpoint?: boolean) => Promise<TileData | null>;
    // Unified get method that accepts either ID or tab_id+name
    get: (params: { id?: string; tab_id?: string; name?: string; checkpoint?: boolean }) => Promise<TileData | null>;
    
    // Create tile (single parent id + name pattern) - reuses CreateTileRequest fields
    create: (tab_id: string, name: string, position: TilePosition, data: Omit<CreateTileRequest, 'tile_id' | 'tab_id' | 'name' | 'position'>, tile_id?: string, type?: string) => Promise<TileData>;
    
    // Update methods - reuse UpdateTileRequest
    updateByName: (tab_id: string, name: string, data: UpdateTileRequest, checkpoint?: boolean) => Promise<TileData>;
    updateById: (id: string, data: UpdateTileRequest, checkpoint?: boolean) => Promise<TileData>;
    update: (params: { 
        id?: string; 
        tab_id?: string; 
        name?: string; 
        data: UpdateTileRequest; 
        checkpoint?: boolean 
    }) => Promise<TileData>;
    
    // Patch methods - reuse UpdateTileRequest
    patchByName: (tab_id: string, name: string, updateData: Partial<UpdateTileRequest>, checkpoint?: boolean) => Promise<TileData>;
    patchById: (id: string, updateData: Partial<UpdateTileRequest>, checkpoint?: boolean) => Promise<TileData>;
    patch: (params: {
        id?: string; 
        tab_id?: string; 
        name?: string;
        updateData: Partial<UpdateTileRequest>;
        checkpoint?: boolean;
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

    // Template methods - reuse template request/response schemas
    exportTemplate: (params: Omit<ExportTileTemplateRequest, 'checkpoint' | 'include_metadata' | 'description' | 'tags' | 'template_name'>, options?: Pick<ExportTileTemplateRequest, 'checkpoint' | 'include_metadata' | 'description' | 'tags' | 'template_name'>) => Promise<TemplateExportResponse<TileTemplateSchema> | { error: string }>;
    importTemplate: (template: TileTemplateSchema, params: Pick<ImportTileTemplateRequest, 'tab_id' | 'interface_id' | 'tab_name'>, options?: Omit<ImportTileTemplateRequest, 'template' | 'tab_id' | 'interface_id' | 'tab_name'>) => Promise<TemplateImportResponse | { error: string }>;
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

export interface Favourite {
  id: number;
  project: string;
  icon: string;
  position: number;
}

export interface FavouritesActions {
    create: (project: string, icon: string, position: number) => Promise<Favourite>;
    delete: (id: number) => Promise<boolean>;
}