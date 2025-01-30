import { ResponseProps } from "../common";
import { getLogsParameters, LogFieldsProps, LogFieldsResponseProps, LogItemProps, LogProps, LogsResponseProps } from "./logs";

export interface TileProps {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
    moved?: boolean;
    static?: boolean;
    visible?: boolean;
    tab?: string;
    table?: string;
    context?: string;
    auto_update?: string;
    filters?: string;
    common_filter?: string;
    page_number?: string;
    metric?: string;
    column_order?: string;
    hidden_columns?: string;
    sorting?: string;
    grouping?: string;
    columns_pin_left?: string;
    columns_pin_right?: string;
    selected?: string;
    base_index?: string;
    plot_type?: string;
    plot_scale?: string;
    is_aggregated?: string;
    x_axis?: string;
    y_axis?: string;
    plot_group_by?: string;
    bin_count?: string;
}

export interface TableDataItem {
    baseIndex: string | undefined,
    hiddenColumns: string | undefined,
    columnOrdering: string | undefined,
    selection: string | undefined,
    logsData: LogsResponseProps,
    totalPages: number,
    entriesProperties: string[],
    paramsProperties: string[],
    logs: LogProps[],
    params: LogItemProps,
    metrics: { [key: string]: number },
    boundaries: { minimums: { [key: string]: number }, maximums: { [key: string]: number } }
}

export interface TableDataProps {
    [key: string]: TableDataItem
}

export interface PlotDataProps {
    [key: string]: {
        plotLogs: LogProps[],
        plotFields: LogFieldsResponseProps,
    }
}

export type ItemType = 
    | "bin_count"
    | "plot_type"
    | "plot_scale"
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
    | "columns_pin_left"
    | "columns_pin_right"
    | "table"
    | "context"
    | "auto_update"
    | "visible";


export interface ProjectsActions {
    get: () => Promise<string[]>,
    create: (name: string) => Promise<ResponseProps>,
    rename: (name: string, newName: string) => Promise<ResponseProps>,
    delete: (name: string) => Promise<ResponseProps>,
}

export interface LogsActions {
    get: (project: string, context: string | null, filterExpression: string | null, sortingExpression: string | null, from_fields: string | null, limit: number | null, offset: number, _timestamp: string | null) => Promise<LogsResponseProps>,
    getLatest: (project: string, context: string | null, filterExpression: string | null, sortingExpression: string | null, from_fields: string | null, limit: number | null, offset: number) => Promise<string>,
    getMetrics: (
        project: string, filterExpression: string | null, metricName: string, keyName: string
    ) => Promise<number>,
    delete: (ids_and_fields: LogFieldsProps) => Promise<ResponseProps>,
    derive: (project: string, key: string, equation: string, referenced_logs: {[table_name: string]: getLogsParameters}) => Promise<ResponseProps>
}

export interface FieldsActions {
    get: (project: string) => Promise<LogFieldsResponseProps>,
}

export interface InterfaceActions {
    get: (project: string, temporary: boolean) => Promise<Interface[]>,
    create: (name: string, project: string, items: TileProps[], new_counter: number, temporary: boolean) => Promise<ResponseProps>,
    update: (name: string, project: string, items: TileProps[], new_counter: number, new_name: string | undefined, temporary: boolean) => Promise<ResponseProps>,
    delete: (name: string, project: string, temporary: boolean) => Promise<ResponseProps>
}

export interface Interface {
    name: string,
    project: string,
    items: TileProps[],
    new_counter: number,
}
