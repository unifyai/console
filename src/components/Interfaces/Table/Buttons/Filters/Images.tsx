"use client";

import { useState, useEffect } from "react";
import { FiltersByColumn } from "@/types/evals/columns";
import ActionButton from "@/components/Common/Buttons/Action";
import { Filter, LoaderCircle, Circle, CircleSlash2, X } from "lucide-react";
import { LogProps, GroupedLogProps } from "@/types/evals/logs";
import { DropdownMenuItem } from "@radix-ui/react-dropdown-menu";

type ImageColumnFilterProps = {
    interactive: boolean,
    column: string,
    columnFilters: FiltersByColumn
    setColumnFilterQuery: (columnFilters: FiltersByColumn) => void,
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
    filterLoading,
    setFilterLoading,
    setIsFiltered,
    renderMode
}: ImageColumnFilterProps) => {

    /* Display loader when data updates */
    const [spinnerColor, setSpinnerColor] = useState("white");

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
        setFilterLoading(true)
        setFilter(newFilter)
        setColumnFilterQuery(newColumnFilters);
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
    }, [isFiltered, setIsFiltered])

    const baseBtn = <ActionButton icon={icon} tooltip={tooltip} variant={variant} disabled={disabled} onClick={onClick}/>;

    return (
        renderMode === "menuItem" ? (
            <DropdownMenuItem
                onClick={onClick} 
                className="
                relative
                flex
                cursor-pointer
                select-none
                items-center
                gap-2
                rounded-sm
                px-2
                py-1.5
                text-sm
                outline-none
                transition-colors
                focus:bg-accent
                focus:text-accent-foreground
                data-[highlighted]:bg-accent
                data-[highlighted]:text-accent-foreground
                data-[disabled]:pointer-events-none
                data-[disabled]:opacity-50
                [&>svg]:size-4
                [&>svg]:shrink-0
                "
            >
                <Filter className="h-4 w-4"/>
                <span>Filter column</span>
            </DropdownMenuItem>
        ) : (
            <div className="relative inline-flex group">
                {baseBtn}
                {isFiltered && (
                    <button type="button" onPointerDown={(e)=>e.stopPropagation()} onPointerUp={(e)=>e.stopPropagation()} onClick={(e)=>{e.stopPropagation(); onClick();}} className="absolute -top-1 -right-1 h-3 w-3 flex items-center justify-center rounded-full bg-gray-400 text-white opacity-0 group-hover:opacity-100 hover:bg-gray-500 transition-opacity">
                        <X className="h-2 w-2" />
                    </button>
                )}
            </div>
        )
    );
}

export default ImageColumnFilter;