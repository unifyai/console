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
    is_aggregated?: string;
    x_axis?: string;
    y_axis?: string;
    plot_group_by?: string;
    bin_count?: string;
    regression_line?: string;
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
    groupedMetrics: { [key: string]: { [key: string]: string |number } },
    boundaries: { minimums: { [key: string]: number }, maximums: { [key: string]: number } }
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

export type ItemType =
    | "tab"
    | "bin_count"
    | "regression_line"
    | "plot_type"
    | "plot_scale_x"
    | "plot_scale_y"
    | "is_aggregated"
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
    | "table_type";

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
}

export interface TabsDataProps {
    [key: string]: {
        name: string,
        items: TileProps[],
        context: string | undefined,
        tableTiles: TileProps[],
        plotTiles: TileProps[],
        viewTiles: TileProps[],
        tabCreated: boolean,
        tempTabCreated: boolean,
        savedTab: TabProps | null,
    }
}

export interface ProjectsActions {
    get: () => Promise<string[]>,
    create: (name: string) => Promise<ResponseProps>,
    rename: (name: string, newName: string) => Promise<ResponseProps>,
    delete: (name: string) => Promise<ResponseProps>,
}

export interface LogsActions {
    create: (project: string, params: { system_message: string }[], entries: { question: string, response: string, score: number }[]) => Promise<ResponseProps>,
    get: (project: string, context: string | null, columnContext: string | null, filterExpression: string | null, sortingExpression: string | null, groupingExpression: string | null, groupSortingExpression: string | null, from_fields: string | null, exclude_fields: string | null, limit: number | null, offset: number | null, group_depth: number | null, _timestamp: string | null) => Promise<LogsResponseProps>,
    getLatest: (project: string, context: string | null, columnContext: string | null, filterExpression: string | null, sortingExpression: string | null, groupingExpression: string | null, groupSortingExpression: string | null, from_fields: string | null, exclude_fields: string | null, limit: number | null, offset: number | null, group_depth: number | null) => Promise<string>,
    getMetrics: (project: string, filterExpression: string | null, metricName: string, keyName: string) => Promise<number>,
    delete: (project: string, context: string | null, column_context: string | null, ids_and_fields: LogFieldsProps, source_type: string | null) => Promise<ResponseProps>,
}

export interface DerivedEntryActions {
    create: (project: string, key: string, equation: string, referenced_logs: { [table_name: string]: getLogsParameters }) => Promise<ResponseProps>,
    update: (project: string, key: string | null, equation: string | null, target_derived_logs: { [table_name: string]: getLogsParameters }, referenced_logs: { [table_name: string]: getLogsParameters } | null) => Promise<ResponseProps>
}

export interface FieldsActions {
    get: (project: string, context: string | null) => Promise<LogFieldsResponseProps>,
}

export interface ContextActions {
    get: (project: string) => Promise<Context[]>,
    create: (name: string, project: string) => Promise<ResponseProps>,
}

export interface TabActions {
    get: (project: string, temporary: boolean) => Promise<TabProps[]>,
    create: (name: string, project: string, context: string | undefined, items: TileProps[], new_counter: number, temporary: boolean) => Promise<ResponseProps>,
    update: (name: string, project: string, context: string | undefined, items: TileProps[], new_counter: number, new_name: string | undefined, temporary: boolean) => Promise<ResponseProps>,
    delete: (name: string, project: string, temporary: boolean) => Promise<ResponseProps>
}
