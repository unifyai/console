import { Row, Cell, ColumnMeta, RowData } from "@tanstack/react-table";

export interface ArtifactsProps {
    [key: string]: any
} 

export interface LogItemProps {
    [key: string]: any | any[] | LogItemProps | LogItemProps[] | null | undefined;
}

export interface LogProps {
    [key: string]: string | LogItemProps
    type: string,  // "ungrouped" or "grouped"
    id: string,
    ts: string,
    params: LogItemProps,
    entries: LogItemProps,
    derived_entries: LogItemProps,
    clipped_fields: LogItemProps,
}

/*
 Represents a single "level" of the raw grouping `logs` object from the backend.
 The keys can be:
  - A **grouping column** (e.g. "entries/i") whose value is another GroupedLogPropsRaw object
  - A **group value** (e.g. "0", "1") whose value is either an array of LogProps or another nested object
  - Metadata like "group_count", "count" which are numbers
*/
export interface GroupedLogPropsRaw {
    [key: string]:
      | GroupedLogPropsRaw       // Further nested grouping
      | LogProps[]             // An array of final logs at this grouping level
      | number                 // Possibly group_count, count, etc.
      | undefined;             // Not all keys must exist
}

/*
  Final, parsed grouped `logs` object.
  - `groupingColumnId` indicates which column was used to group 
    (e.g. "entries/i", "params/sys_msg", etc.).
  - The actual grouping value is stored at the same property name as `groupingColumnId`.
  For example, if `groupingColumnId = "entries/i"` and this group is for i=1, 
  you'd have `groupNode["entries/i"] = "1"`.
  - `subRows` are either further GroupedLogProps or final LogProps.
*/
export interface GroupedLogProps {
    type: string,  // "ungrouped" or "grouped"
    id: string,
    groupingColumnId: string,
    groupingIndex?: number,  // Index for entries/params groups, ascending within each nesting level
    [groupingValue: string]: unknown,  // Dynamic key for groupingValue
    subRows: GroupedLogProps[] | LogProps[]
}

export interface LogGroupsProps {
    version: string,
    value: string
}

export interface LogsResponseProps {
    params: LogItemProps,
    logs: LogProps[] | GroupedLogPropsRaw,
    count: number,
    groups: LogItemProps,
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
    interface Row<TData extends RowData> {
        groupingIndex: number,
        groupingColumnId: string,
        groupingValue: any
    }
}
