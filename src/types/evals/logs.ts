import { Row, Cell, ColumnMeta, RowData } from "@tanstack/react-table";

export interface ArtifactsProps {
    [key: string]: any
} 

export interface LogItemProps {
    [key: string]: any | any[] | LogItemProps | LogItemProps[] | null | undefined;
}

export interface LogProps {
    [key: string]: string | LogItemProps
    id: string,
    ts: string,
    entries: LogItemProps,
    derived_entries: LogItemProps,
    params: LogItemProps
} 

export interface LogGroupsProps {
    version: string,
    value: string
}

export interface LogsResponseProps {
    params: LogItemProps,
    logs: LogProps[]
    count: number
}

export type LogFieldsProps = [number, string][]

export interface LogFieldsResponseProps {
    [name: string]: {data_type: string, field_type: "entry" | "param" | "derived_entry", artifacts: string}
}

export interface HeaderNode {
    name: string;
    path: string;
    nodes?: HeaderNode[]; // Will be assigned after building child nodes
    childMap?: { [key: string]: HeaderNode }; // Used internally during tree construction
    isLeaf?: boolean; // Indicates if the node corresponds to a path in the input array
  }

export interface getLogsParameters {
    [parameter: string]: string
}

export interface TableArguments {
    [table_name: string]: {
        available_fields: LogFieldsResponseProps 
        getLogs_parameters: getLogsParameters
    }
}

declare module "@tanstack/react-table" {
    // eslint-disable-next-line no-unused-vars
    interface ColumnMeta<TData extends RowData, TValue> {
      dataType?: string | null,
      fieldType?: string | null,
      columnType: string,
      enableRowSpan?: boolean,
      isParent: boolean,
      renderedDepth: number,
    }
    interface Cell<TData extends RowData, TValue> {
        rowSpan: number,
        isRowSpanned: boolean
    }
}
