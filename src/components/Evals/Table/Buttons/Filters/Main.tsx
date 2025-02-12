"use client";

import { FiltersByColumn } from "@/types/evals/columns";
import StringColumnFilter from "./Strings";
import NumericColumnFilter from "./Numbers";
import TimeColumnFilter from "./Time";
import { sanitizeId } from "@/utils/evals/columnOperations";
import { LogProps, GroupedLogProps } from "@/types/evals/logs";

/* 
    Supported operands: "==", "!=", "is", "<", ">", "<=", "=>", "in", "not in"
    Inferred types: "list", "dict", "tuple", "str", "bool", "float", "int"
    Reference: https://github.com/unifyai/orchestra/blob/68f543bb9094a8dffc111e6b1960385fd64459b8/orchestra/web/api/log/helpers.py#L284
*/

const ColumnFilter = ({ column, columnFilters, setColumnFilterQuery, dataTypes, boundaries, logs }: {
    column: string,
    columnFilters: FiltersByColumn,
    setColumnFilterQuery: (columnFilters: FiltersByColumn) => void,
    dataTypes: {[key: string]: string},
    boundaries: {minimums: {[key: string]: any}, maximums: {[key: string]: any}},
    logs: LogProps[] | GroupedLogProps[]
}) => {
    
    let filter;
    column = sanitizeId(column);

    if (["float", "int"].includes(dataTypes[column])) {
        filter = <NumericColumnFilter column={column} columnFilters={columnFilters} setColumnFilterQuery={setColumnFilterQuery} boundaries={boundaries} logs={logs}/>
    }
    else if (dataTypes[column] === "timestamp") {
        filter = <TimeColumnFilter column={column} columnFilters={columnFilters} setColumnFilterQuery={setColumnFilterQuery} logs={logs}/>
    }
    else {
        filter = <StringColumnFilter column={column} columnFilters={columnFilters} setColumnFilterQuery={setColumnFilterQuery} logs={logs}/>
    }

    return filter;
}

export default ColumnFilter;