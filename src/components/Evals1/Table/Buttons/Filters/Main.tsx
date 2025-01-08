"use client";

import { FiltersByColumn } from "@/types/evals/columns";
import StringColumnFilter from "./Strings";
import NumericColumnFilter from "./Numbers";
import TimeColumnFilter from "./Time";

/* 
    Supported operands: "==", "!=", "is", "<", ">", "<=", "=>", "in", "not in"
    Inferred types: "list", "dict", "tuple", "str", "bool", "float", "int"
    Reference: https://github.com/unifyai/orchestra/blob/68f543bb9094a8dffc111e6b1960385fd64459b8/orchestra/web/api/log/helpers.py#L284
*/

const ColumnFilter = ({ column, columnFilters, setColumnFilterQuery, columnTypes, boundaries }: {
    column: string,
    columnFilters: FiltersByColumn
    setColumnFilterQuery: (columnFilters: FiltersByColumn) => void,
    columnTypes: {[key: string]: string},
    boundaries: {minimums: {[key: string]: number;}, maximums: {[key: string]: number}}
}) => {

    let filter;
    if (["float", "int"].includes(columnTypes[column]))
        filter = <NumericColumnFilter column={column} columnFilters={columnFilters} setColumnFilterQuery={setColumnFilterQuery} boundaries={boundaries} />
    else (["dict", "list", "tuple", "str", "bool"].includes(columnTypes[column]))
        filter = <StringColumnFilter column={column} columnFilters={columnFilters} setColumnFilterQuery={setColumnFilterQuery}/>
    // if (columnTypes[column] === "timestamp")
    //     filter = <TimeColumnFilter column={column} columnFilters={columnFilters} setColumnFilterQuery={setColumnFilterQuery}/> 
    return filter;
}

export default ColumnFilter;


/* 
    TODO: 
        - Add support for timestamp type (not yet expressed in the endpoint)
*/