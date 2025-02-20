"use client";

import { useState, useEffect } from "react";
import { FiltersByColumn } from "@/types/evals/columns";
import ActionButton from "@/components/Common/Buttons/Action";
import { Filter, LoaderCircle, Circle, CircleSlash2 } from "lucide-react";
import { LogProps, GroupedLogProps } from "@/types/evals/logs";

type ImageColumnFilterProps = {
    interactive: boolean,
    column: string,
    columnFilters: FiltersByColumn
    setColumnFilterQuery: (columnFilters: FiltersByColumn) => void,
    logs: LogProps[] | GroupedLogProps[],
    filterLoading: boolean,
    setFilterLoading: (filterLoading: boolean) => void,
    setIsFiltered: (isFiltered: boolean) => void,
    renderMode?: "button" | "menuItem"
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
    renderMode = "button"
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
    
    if (renderMode === "menuItem") {
        return (
            <div onClick={onClick} className="relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0">
                {state.icon}
                <span>{state.tooltip}</span>
            </div>
        );
    }

    return (
        <ActionButton icon={icon} tooltip={tooltip} variant={variant} disabled={disabled} onClick={onClick}/>
    );
};

export default ImageColumnFilter;