"use client";

import { useEffect, useState } from "react";
import { Column, ColumnSort } from "@tanstack/react-table";
import { LoaderCircle } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";
import { DropdownMenuItem } from "@radix-ui/react-dropdown-menu";
import { GroupedLogProps, LogProps } from "@/types/evals/logs";
import { cn } from "@/lib/utils";

type ColumnGroupSortProps = {
    interactive?: boolean,
    column: Column<any | unknown>,
    groupSorting: ColumnSort[],
    setGroupSorting: (groupSorting: ColumnSort[]) => void,
    logs: LogProps[] | GroupedLogProps[],
    groupSortLoading: boolean,
    setGroupSortLoading: (groupSortLoading: boolean) => void,
    setGroupSortingDirection: (groupSorting: "asc" | "desc" | false) => void,
    direction?: string,
    renderMode: "button" | "menuItem"
}

const GArrowUp = ({className}:{className?: string}) => {
    return (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="24" 
        height="24" 
        viewBox="0 0 30 30" 
        fill="none" 
        stroke="currentColor" 
        stroke-width="2" 
        stroke-linecap="round" 
        stroke-linejoin="round" 
        className={cn("lucide lucide-group-arrow-up", className)}
      >

        <g transform="translate(-3,-3) scale(1.5)">
            <path d="M3 7V5c0-1.1.9-2 2-2h2"/>
            <path d="M17 3h2c1.1 0 2 .9 2 2v2"/>
            <path d="M21 17v2c0 1.1-.9 2-2 2h-2"/>
            <path d="M7 21H5c-1.1 0-2-.9-2-2v-2"/>
        </g>

        <g transform="translate(0,3) scale(0.9)">
            <path d="m21 8-4-4-4 4"/>
            <path d="M17 4v16"/>
        </g>

    </svg>
    );
};

const GArrowDown = ({className}:{className?: string}) => {
    return (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="24" 
        height="24" 
        viewBox="0 0 30 30" 
        fill="none" 
        stroke="currentColor" 
        stroke-width="2" 
        stroke-linecap="round" 
        stroke-linejoin="round" 
        className={cn("lucide lucide-group-arrow-down", className)}
      >

        <g transform="translate(-3,-3) scale(1.5)">
            <path d="M3 7V5c0-1.1.9-2 2-2h2"/>
            <path d="M17 3h2c1.1 0 2 .9 2 2v2"/>
            <path d="M21 17v2c0 1.1-.9 2-2 2h-2"/>
            <path d="M7 21H5c-1.1 0-2-.9-2-2v-2"/>
        </g>

        <g transform="translate(9,3) scale(0.9)">
            <path d="m3 16 4 4 4-4"/>
            <path d="M7 20V4"/>
        </g>
    </svg>
    );
};

const ColumnGroupSort = (({
    interactive,
    column,
    groupSorting,
    setGroupSorting,
    logs,
    groupSortLoading,
    setGroupSortLoading,
    setGroupSortingDirection,
    direction,
    renderMode
}: ColumnGroupSortProps) => {

    /* Display loader when logs updates */
    const isGroupSorted = groupSorting.findIndex(s => s.id === column.id) !== -1;
    const sortingOrder = isGroupSorted ? groupSorting.find(s => s.id === column.id)!.desc ? "desc" : "asc" : false;
    const spinnerColor = sortingOrder ? "white" : "primary";
    useEffect(() => {
        setGroupSortingDirection(sortingOrder);
    }, [sortingOrder, setGroupSortingDirection])

    /* Group sorting menu item */
    const onMenuItemClick = () => {
        setGroupSortLoading(true)
        const newGroupSorting = [{id: column.id, desc: direction === "desc"}]
        setGroupSorting(newGroupSorting)
    }
    const menuItem = 
    <DropdownMenuItem onClick={onMenuItemClick} className="flex items-center cursor-pointer">
        <div className="scale-[0.6] -translate-x-1">
            {direction === "asc" ? <GArrowUp className="translate(-2,0)"/> : <GArrowDown className="translate(-2,0)"/>}
        </div>
        {direction === "asc" ? <span>Sort groups ascending</span> : <span>Sort groups descending</span>}
    </DropdownMenuItem>

    /* Undo group sorting */
    const tooltip = "Undo group sorting";
    const icon = groupSortLoading 
        ? <LoaderCircle className={`animate-spin text-${spinnerColor}`}/> 
        : sortingOrder === "asc" ? <GArrowUp/> : <GArrowDown/>
    const variant = isGroupSorted ? "primary" : undefined;
    const onButtonClick = () => {
        setGroupSortLoading(true)
        setGroupSorting([])
    }
    const undoButton = <ActionButton tooltip={tooltip} icon={icon} variant={variant} onClick={onButtonClick} disabled={!interactive || groupSortLoading}/> 

    return (renderMode === "menuItem" ? menuItem : undoButton);

});

export default ColumnGroupSort;
