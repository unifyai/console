"use client";

import { useState, useEffect } from "react";
import { FiltersByColumn } from "@/types/evals/columns";
import ActionButton from "@/components/Common/Buttons/Action";
import { Filter, LoaderCircle, Circle, CircleSlash2 } from "lucide-react";
import { LogProps, GroupedLogProps } from "@/types/evals/logs";

const ImageColumnFilter = ({ interactive, column, columnFilters, setColumnFilterQuery, logs }: {
    interactive: boolean,
    column: string,
    columnFilters: FiltersByColumn
    setColumnFilterQuery: (columnFilters: FiltersByColumn) => void,
    logs: LogProps[] | GroupedLogProps[]
}) => {

    /* Display loader when data updates */
    const [loading, setLoading] = useState(false);
    const [spinnerColor, setSpinnerColor] = useState("white");
    useEffect(() => {
        setLoading(false);
    },[logs])

    /* Init filter */
    const initialValue = columnFilters[column] &&columnFilters[column]["exists"] ? columnFilters[column]["exists"] : "None"
    const [filter, setFilter] = useState<string>(initialValue);
    
    /* Event handlers */
    const onClick = () => {        
        let newColumnFilters = { ...columnFilters }
        const newFilter = state.next
        if (newFilter === "None") {
            newColumnFilters = Object.fromEntries(
                Object.entries(columnFilters).filter(([key, _]) => key != column)
            )
            setSpinnerColor("primary")
        }
        else {
            newColumnFilters = {...columnFilters, [column]: {"exists": newFilter}}
            setSpinnerColor("white")
        }
        setFilter(newFilter)
        setColumnFilterQuery(newColumnFilters);
        setLoading(true)
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
    const icon = loading ? <LoaderCircle className={`animate-spin text-${spinnerColor}`}/> : state.icon
    const disabled = !interactive || loading
    
    return (
        <ActionButton icon={icon} tooltip={tooltip} variant={variant} disabled={disabled} onClick={onClick}/>
    );
}

export default ImageColumnFilter;