"use client";

import { FiltersByColumn } from "@/types/evals/columns";
import StringColumnFilter from "./Strings";
import NumericColumnFilter from "./Numbers";
import TimeColumnFilter from "./Time";
import { sanitizeId } from "@/utils/evals/columnOperations";

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
    boundaries: {minimums: {[key: string]: any}, maximums: {[key: string]: any}}
}) => {
    
    let filter;
    column = sanitizeId(column);

    if (["float", "int"].includes(columnTypes[column])) {
        filter = <NumericColumnFilter column={column} columnFilters={columnFilters} setColumnFilterQuery={setColumnFilterQuery} boundaries={boundaries} />
    }
    else if (columnTypes[column] === "timestamp") {
        filter = <TimeColumnFilter column={column} columnFilters={columnFilters} setColumnFilterQuery={setColumnFilterQuery}/>         
    }
    else {
        filter = <StringColumnFilter column={column} columnFilters={columnFilters} setColumnFilterQuery={setColumnFilterQuery}/>
    }

    return filter;
}

export default ColumnFilter;