"use client";

import { FiltersByColumn } from "@/types/interfaces/columns";
import StringColumnFilter from "./Strings";
import NumericColumnFilter from "./Numbers";
import TimeColumnFilter from "./Time";
import ImageColumnFilter from "./Images";
import BooleanColumnFilter from "./Bools";
import ListColumnFilter from "./Lists";
import { sanitizeId } from "@/utils/interfaces/table/columnOperations";
import { GroupedLogProps, LogProps } from "@/types/interfaces/logs";
import { Dispatch, SetStateAction } from "react";
import { LogsActions } from "@/types/interfaces/grid";

/* 
    Supported operands: "==", "!=", "is", "<", ">", "<=", "=>", "in", "not in", "exists" (images only)
    Inferred types: "list", "dict", "tuple", "str", "bool", "float", "int", "image"
    Reference: https://github.com/unifyai/orchestra/blob/68f543bb9094a8dffc111e6b1960385fd64459b8/orchestra/web/api/log/helpers.py#L284
*/

type ColumnFilterProps = {
    tileId?: string,
    tabId?: string,
    projectId?: string,
    interactive: boolean,
    column: string,
    columnFilters: FiltersByColumn
    setColumnFilterQuery: (columnFilters: FiltersByColumn) => void,
    dataTypes: {[key: string]: string},
    open: boolean,
    setOpen: Dispatch<SetStateAction<boolean>>,
    filterLoading: boolean,
    setFilterLoading: (filterLoading: boolean) => void,
    setIsFiltered: (isFiltered: boolean) => void,
    renderMode: "button" | "menuItem",
    entriesProperties: string[],
    paramsProperties: string[],
    logsActions: LogsActions
}

const ColumnFilter = ({
    tileId,
    tabId,
    projectId,
    interactive,
    column,
    columnFilters,
    setColumnFilterQuery,
    dataTypes,
    open,
    setOpen,
    filterLoading,
    setIsFiltered,
    setFilterLoading,
    renderMode,
    entriesProperties,
    paramsProperties,
    logsActions
}: ColumnFilterProps) => {
    
    let filter;
    column = sanitizeId(column);

    if (["float", "int"].includes(dataTypes[column])) {
        filter = <NumericColumnFilter
        tileId={tileId}
        tabId={tabId}
        projectId={projectId}
        interactive={interactive}
        column={column}
        columnFilters={columnFilters}
        setColumnFilterQuery={setColumnFilterQuery}
        dataTypes={dataTypes}
        open={open}
        setOpen={setOpen}
        filterLoading={filterLoading}
        setFilterLoading={setFilterLoading}
        setIsFiltered={setIsFiltered}
        renderMode={renderMode}
        entriesProperties={entriesProperties}
        paramsProperties={paramsProperties}
        logsActions={logsActions}/>
    }
    else if (dataTypes[column] === "timestamp" || dataTypes[column] === "time" || dataTypes[column] === "date" || dataTypes[column] === "timedelta") {
        filter = <TimeColumnFilter
        interactive={interactive}
        column={column}
        columnFilters={columnFilters}
        setColumnFilterQuery={setColumnFilterQuery}
        open={open}
        setOpen={setOpen}
        filterLoading={filterLoading}
        setFilterLoading={setFilterLoading}
        setIsFiltered={setIsFiltered}
        dataType={dataTypes[column] as "timedelta" | "timestamp" | "date" | "time"}
        renderMode={renderMode}
        entriesProperties={entriesProperties}
        paramsProperties={paramsProperties}
        />
    }
    else if (dataTypes[column] === "image") {
        filter = <ImageColumnFilter
        interactive={interactive}
        column={column}
        columnFilters={columnFilters}
        setColumnFilterQuery={setColumnFilterQuery}
        filterLoading={filterLoading}
        setFilterLoading={setFilterLoading}
        setIsFiltered={setIsFiltered}
        renderMode={renderMode}
        />
    }
    else if (dataTypes[column] === "bool") {
        filter = <BooleanColumnFilter
        interactive={interactive}
        column={column}
        columnFilters={columnFilters}
        setColumnFilterQuery={setColumnFilterQuery}
        open={open}
        setOpen={setOpen}
        filterLoading={filterLoading}
        setFilterLoading={setFilterLoading}
        setIsFiltered={setIsFiltered}
        renderMode={renderMode}
        entriesProperties={entriesProperties}
        paramsProperties={paramsProperties}
        />
    }
    else if (dataTypes[column] === "list"){
        filter = <ListColumnFilter
        interactive={interactive}
        column={column}
        columnFilters={columnFilters}
        setColumnFilterQuery={setColumnFilterQuery}
        open={open}
        setOpen={setOpen}
        filterLoading={filterLoading}
        setFilterLoading={setFilterLoading}
        setIsFiltered={setIsFiltered}
        renderMode={renderMode}
        entriesProperties={entriesProperties}
        paramsProperties={paramsProperties}
        />
    }
    else {
        filter = <StringColumnFilter
        interactive={interactive}
        column={column}
        columnFilters={columnFilters}
        setColumnFilterQuery={setColumnFilterQuery}
        open={open}
        setOpen={setOpen}
        filterLoading={filterLoading}
        setFilterLoading={setFilterLoading}
        setIsFiltered={setIsFiltered}
        renderMode={renderMode}
        entriesProperties={entriesProperties}
        paramsProperties={paramsProperties}
        />
    }

    return filter;
}

export default ColumnFilter;