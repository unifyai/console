"use client";

import { useState, useEffect } from "react";
import { FiltersByColumn } from "@/types/evals/columns";
import ActionButton from "@/components/Common/Buttons/Action";
import { Filter, LoaderCircle, Circle, CircleSlash2 } from "lucide-react";
import { LogProps, GroupedLogProps } from "@/types/evals/logs";
import { DropdownMenuItem } from "@radix-ui/react-dropdown-menu";

type ImageColumnFilterProps = {
    interactive: boolean,
    column: string,
    columnFilters: FiltersByColumn
    setColumnFilterQuery: (columnFilters: FiltersByColumn) => void,
    logs: LogProps[] | GroupedLogProps[],
    filterLoading: boolean,
    setFilterLoading: (filterLoading: boolean) => void,
    setIsFiltered: (isFiltered: boolean) => void,
    renderMode: "button" | "menuItem"
}

const ImageColumnFilter = ({
    interactive,
    column,
    columnFilters,
    setColumnFilterQuery,
    logs,
    filterLoading,
    setFilterLoading,
    setIsFiltered,
    renderMode
}: ImageColumnFilterProps) => {

    /* Display loader when data updates */
    const [spinnerColor, setSpinnerColor] = useState("white");
    useEffect(() => {
        setFilterLoading(false);
    },[logs])

    /* Init filter */
    const initialValue = columnFilters[column] && columnFilters[column]["isNone"] ? columnFilters[column]["isNone"] : "None"
    const [filter, setFilter] = useState<string>(initialValue);
    
    /* Event handlers */
    const onClick = (e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }
        let newColumnFilters = { ...columnFilters }
        const newFilter = state.next
        if (newFilter === "None") {
            newColumnFilters = Object.fromEntries(
                Object.entries(columnFilters).filter(([key, _]) => key != column)
            )
            setSpinnerColor("primary")
        }
        else {
            newColumnFilters = {...columnFilters, [column]: {"isNone": newFilter}}
            setSpinnerColor("white")
        }
        setFilter(newFilter)
        setColumnFilterQuery(newColumnFilters);
        setFilterLoading(true)
    }

    /* Filter button */
    const states = [
        { key: "None", tooltip: `Filter for logs with ${column}`, icon: <Filter/>, variant: undefined, next: "true" },
        { key: "true", tooltip: `Filter for logs without ${column}`, icon: <Circle/>, variant: "primary", next: "false" },
        { key: "false", tooltip: "Reset filter", icon: <CircleSlash2/>, variant: "primary", next: "None" }
    ]
    const state = states.find(state => state.key === filter)!
    const tooltip = state.tooltip
    const variant = state.variant as "primary" | "link" | "secondary" | "destructive" | "warning" | "outline" | "ghost" | undefined
    const icon = filterLoading ? <LoaderCircle className={`animate-spin text-${spinnerColor}`}/> : state.icon
    const disabled = !interactive || filterLoading
    const isFiltered = state.key === "true"

    useEffect(() => {
        setIsFiltered(isFiltered);
    }, [isFiltered])

    return (
        renderMode === "menuItem" ? (
            <DropdownMenuItem onClick={onClick} className="flex items-center gap-2">
                <Filter className="h-4 w-4"/>
                <span>Filter by this column</span>
            </DropdownMenuItem>
        ) : (
            <ActionButton icon={icon} tooltip={tooltip} variant={variant} disabled={disabled} onClick={onClick}/>
        )
    );
}

export default ImageColumnFilter;