"use client";

import { FiltersByColumn } from "@/types/evals/columns";
import StringColumnFilter from "./Strings";
import NumericColumnFilter from "./Numbers";
import TimeColumnFilter from "./Time";
import ImageColumnFilter from "./Images";
import { sanitizeId } from "@/utils/evals/columnOperations";
import { GroupedLogProps, LogProps } from "@/types/evals/logs";
import { Dispatch, SetStateAction, ForwardedRef, forwardRef } from "react";

/* 
    Supported operands: "==", "!=", "is", "<", ">", "<=", "=>", "in", "not in", "exists" (images only)
    Inferred types: "list", "dict", "tuple", "str", "bool", "float", "int", "image"
    Reference: https://github.com/unifyai/orchestra/blob/68f543bb9094a8dffc111e6b1960385fd64459b8/orchestra/web/api/log/helpers.py#L284
*/

type ColumnFilterProps = {
    interactive: boolean,
    column: string,
    columnFilters: FiltersByColumn
    setColumnFilterQuery: (columnFilters: FiltersByColumn) => void,
    dataTypes: {[key: string]: string},
    boundaries: {minimums: {[key: string]: any}, maximums: {[key: string]: any}},
    logs: LogProps[] | GroupedLogProps[],
    open: boolean,
    setOpen: Dispatch<SetStateAction<boolean>>,
    filterLoading: boolean,
    setFilterLoading: (filterLoading: boolean) => void,
    setIsFiltered: (isFiltered: boolean) => void
}

const ColumnFilter = forwardRef<HTMLButtonElement, ColumnFilterProps>(({
    interactive,
    column,
    columnFilters,
    setColumnFilterQuery,
    dataTypes,
    boundaries,
    logs,
    open,
    setOpen,
    filterLoading,
    setIsFiltered,
    setFilterLoading
}, ref) => {
    
    let filter;
    column = sanitizeId(column);

    if (["float", "int"].includes(dataTypes[column])) {
        filter = <NumericColumnFilter interactive={interactive} column={column} columnFilters={columnFilters} setColumnFilterQuery={setColumnFilterQuery} boundaries={boundaries} logs={logs} open={open} setOpen={setOpen} filterLoading={filterLoading} setFilterLoading={setFilterLoading} setIsFiltered={setIsFiltered}/>
    }
    else if (dataTypes[column] === "timestamp") {
        filter = <TimeColumnFilter interactive={interactive} column={column} columnFilters={columnFilters} setColumnFilterQuery={setColumnFilterQuery} logs={logs} open={open} setOpen={setOpen} filterLoading={filterLoading} setFilterLoading={setFilterLoading} setIsFiltered={setIsFiltered}/>
    }
    else if (dataTypes[column] === "image") {
        filter = <ImageColumnFilter ref={ref} interactive={interactive} column={column} columnFilters={columnFilters} setColumnFilterQuery={setColumnFilterQuery} logs={logs} filterLoading={filterLoading} setFilterLoading={setFilterLoading} setIsFiltered={setIsFiltered}/>
    }
    else {
        filter = <StringColumnFilter interactive={interactive} column={column} columnFilters={columnFilters} setColumnFilterQuery={setColumnFilterQuery} logs={logs} open={open} setOpen={setOpen} filterLoading={filterLoading} setFilterLoading={setFilterLoading} setIsFiltered={setIsFiltered}/>
    }

    return filter;
});

ColumnFilter.displayName = "ColumnFilter";

export default ColumnFilter;