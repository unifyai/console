import { LogItemProps, LogProps, LogsResponseProps } from "./logs";

export interface TileProps {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
    moved?: boolean;
    static?: boolean;
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
}

export interface TableDataProps {
    [key: string]: {
        baseIndex: string | undefined,
        hiddenColumns: string | undefined,
        columnOrdering: string | undefined,
        selection: string | undefined,
        logsData: LogsResponseProps,
        fullLogs: LogProps[],
        totalPages: number,
        entriesProperties: string[],
        paramsProperties: string[],
        logs: LogProps[],
        params: LogItemProps,
        metrics: { [key: string]: number },
        boundaries: { minimums: { [key: string]: number }, maximums: { [key: string]: number } }
    }
}

export type ItemType = 
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
    | "auto_update";
