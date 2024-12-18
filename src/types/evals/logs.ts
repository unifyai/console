import { Row, Cell, ColumnMeta, RowData } from "@tanstack/react-table";

export interface ArtifactsProps {
    [key: string]: any
} 

export interface LogItemProps {
    [key: string]: any | any[] | LogItemProps | LogItemProps[] | null | undefined;
}

export interface LogProps {
    id: string,
    ts: string,
    entries: LogItemProps,
    params: LogItemProps
} 

export interface LogGroupsProps {
    version: string,
    value: string
}

export interface LogsResponseProps {
    params: LogItemProps,
    logs: LogProps[]
}

export interface LogColumnsProps {
    [name: string]: { [name: string]: string }
}

export interface HeaderNode {
    name: string;
    path: string;
    nodes?: HeaderNode[]; // Will be assigned after building child nodes
    childMap?: { [key: string]: HeaderNode }; // Used internally during tree construction
    isLeaf?: boolean; // Indicates if the node corresponds to a path in the input array
  }

declare module "@tanstack/react-table" {
    // eslint-disable-next-line no-unused-vars
    interface ColumnMeta<TData extends RowData, TValue> {
      dataType: () => string | null,
      columnType: string,
      enableRowSpan: boolean
    }
    interface Cell<TData extends RowData, TValue> {
        rowSpan: number,
        isRowSpanned: boolean
    }
}
