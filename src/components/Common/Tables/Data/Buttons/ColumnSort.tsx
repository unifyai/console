"use client";

import { useEffect, useState, forwardRef } from "react";
import { Column } from "@tanstack/react-table";
import { SortDesc, SortAsc, ArrowUpDown, LoaderCircle } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";

type ColumnSortProps = {
    interactive?: boolean,
    column: Column<any | unknown>,
    data: any[],
    sortLoading: boolean,
    setSortLoading: (sortLoading: boolean) => void,
    setIsSorted: (isSorted: boolean) => void
}

const ColumnSort = forwardRef<HTMLButtonElement, ColumnSortProps>(({
    interactive,
    column,
    data,
    sortLoading,
    setSortLoading,
    setIsSorted
}, ref) => {

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
    const icon = sortLoading ? <LoaderCircle className={`animate-spin text-${spinnerColor}`}/> : state.icon
    const variant = isSorted ? "primary" : undefined;
    const onClick = () => {
        column.toggleSorting()
        if (!column.getNextSortingOrder()) 
            setSpinnerColor("primary") 
        else 
            setSpinnerColor("white")
        setSortLoading(true)
    }
    
    return(
        <ActionButton 
            ref={ref}
            tooltip={tooltip} 
            icon={icon} 
            variant={variant} 
            onClick={onClick} 
            disabled={!interactive || sortLoading}
        />
    );
});

ColumnSort.displayName = "ColumnSort";

export default ColumnSort;
