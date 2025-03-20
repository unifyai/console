"use client";

import { useEffect, useState } from "react";
import { Column } from "@tanstack/react-table";
import { SortDesc, SortAsc, ArrowUpDown, LoaderCircle } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";
import { DropdownMenuItem } from "@radix-ui/react-dropdown-menu";

/** 
 * Column sorting button with alternating ascending,
 * descending, unsorted states
*/

type ColumnSortProps = {
    interactive?: boolean,
    column: Column<any | unknown>,
    data: any[],
    sortLoading: boolean,
    setSortLoading: (sortLoading: boolean) => void,
    setIsSorted: (isSorted: boolean) => void,
    renderMode: "button" | "menuItem"
}

const ColumnSort = (({
    interactive,
    column,
    data,
    sortLoading,
    setSortLoading,
    setIsSorted,
    renderMode
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
    const icon = sortLoading ? <LoaderCircle className={`animate-spin text-${spinnerColor}`}/> : state.icon
    const variant = isSorted ? "primary" : undefined;
    const onClick = () => {
        column.toggleSorting()
        setSortLoading(true)
        if (!column.getNextSortingOrder()) 
            setSpinnerColor("primary") 
        else 
            setSpinnerColor("white")
    }

    return (
        renderMode === "menuItem" ? (
            <DropdownMenuItem onClick={onClick} className="flex items-center gap-2 cursor-pointer">
                <ArrowUpDown className="h-4 w-4"/>
                <span>Sort descending</span>
            </DropdownMenuItem>
        ) : (
            <ActionButton tooltip={tooltip} icon={icon} variant={variant} onClick={onClick} disabled={!interactive || sortLoading}/>
        )
    );

});

export default ColumnSort;
