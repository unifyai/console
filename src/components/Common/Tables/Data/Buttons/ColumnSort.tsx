"use client";

import { useEffect, useState } from "react";
import { Column } from "@tanstack/react-table";
import { SortDesc, SortAsc, ArrowUpDown, LoaderCircle } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";
import { DropdownMenuItem } from "@radix-ui/react-dropdown-menu";

type ColumnSortProps = {
    interactive?: boolean,
    column: Column<any | unknown>,
    data: any[],
    sortLoading: boolean,
    setSortLoading: (sortLoading: boolean) => void,
    setSortingDirection: (sortingDirection: "asc" | "desc" | false) => void,
    direction?: "asc" | "desc",
    renderMode: "button" | "menuItem"
}

const ColumnSort = (({
    interactive,
    column,
    data,
    sortLoading,
    setSortLoading,
    setSortingDirection,
    direction,
    renderMode
}: ColumnSortProps) => {

    /* Display loader when data updates */
    const sorting = column.getIsSorted();
    const spinnerColor = sorting ? "white" : "primary";
    useEffect(() => {
        setSortingDirection(sorting);
    }, [sorting])

    /* Sorting menu item */
    const onMenuItemClick = () => {
        column.toggleSorting(direction === "desc")
        setSortLoading(true)
    }
    const menuItem = 
    <DropdownMenuItem onClick={onMenuItemClick} className="flex items-center gap-2 cursor-pointer">
        {direction === "asc" ? <SortAsc className="h-4 w-4"/> : <SortDesc className="h-4 w-4"/>}
        {direction === "asc" ? <span>Sort ascending</span> : <span>Sort descending</span>}
    </DropdownMenuItem>

    /* Undo sorting button */
    const tooltip = "Undo sorting";
    const icon = sortLoading 
        ? <LoaderCircle className={`animate-spin text-${spinnerColor}`}/> 
        : sorting === "desc" ? <SortDesc/> : <SortAsc/>
    const variant = sorting ? "primary" : undefined;
    const onButtonClick = () => {
        column.clearSorting()
        setSortLoading(true)
    }
    const undoButton = <ActionButton tooltip={tooltip} icon={icon} variant={variant} onClick={onButtonClick} disabled={!interactive || sortLoading}/>
    
    return (renderMode === "menuItem" ? menuItem : undoButton);

});

export default ColumnSort;
