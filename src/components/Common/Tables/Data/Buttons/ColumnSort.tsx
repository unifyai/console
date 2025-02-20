"use client";

import { useEffect, useState } from "react";
import { Column } from "@tanstack/react-table";
import { SortDesc, SortAsc, ArrowUpDown, LoaderCircle } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";

type ColumnSortProps = {
    interactive?: boolean,
    column: Column<any | unknown>,
    data: any[],
    sortLoading: boolean,
    setSortLoading: (sortLoading: boolean) => void,
    setIsSorted: (isSorted: boolean) => void,
    renderMode?: "button" | "menuItem"
}

const ColumnSort = ({
    interactive,
    column,
    data,
    sortLoading,
    setSortLoading,
    setIsSorted,
    renderMode = "button"
}: ColumnSortProps) => {

    /* Display loader when data updates */
    const [spinnerColor, setSpinnerColor] = useState("white");
    useEffect(() => {
        setSortLoading(false);
    },[data])

    const isSorted = column.getIsSorted() === "asc" || column.getIsSorted() === "desc";
    useEffect(() => {
        setIsSorted(isSorted);
    }, [isSorted])

    const states = [
        { key: false, tooltip: "Sort descending", icon: <ArrowUpDown/> },
        { key: "asc", tooltip: "Unsort", icon: <SortAsc/> },
        { key: "desc", tooltip: "Sort ascending", icon: <SortDesc/> },
    ];
    const state = states.find(state => state.key === column.getIsSorted())!;
    const tooltip = state.tooltip;
    const icon = sortLoading ? <LoaderCircle className={`animate-spin text-${spinnerColor}`}/> : state.icon;
    const variant = isSorted ? "primary" : undefined;
    
    const onClick = (e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }
        column.toggleSorting();
        if (!column.getNextSortingOrder()) 
            setSpinnerColor("primary"); 
        else 
            setSpinnerColor("white");
        setSortLoading(true);
    };
    
    if (renderMode === "menuItem") {
        return (
            <div onClick={onClick} className="relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0">
                {state.icon}
                <span>{state.tooltip}</span>
            </div>
        );
    }

    return (
        <ActionButton 
            tooltip={tooltip} 
            icon={icon} 
            variant={variant} 
            onClick={onClick} 
            disabled={!interactive || sortLoading}
        />
    );
};

export default ColumnSort;
