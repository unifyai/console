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
    setIsGroupSorted: (isGroupSorted: boolean) => void,
    renderMode: "button" | "menuItem"
}

const GArrowUp = () => {
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
        className="lucide lucide-group-arrow-up"
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

const GArrowDown = () => {
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
        className="lucide lucide-group-arrow-down"
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

const GArrowUpDown = ({className}:{className?: string}) => {
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

        <g transform="translate(3,3) scale(0.9)">
            <path d="m3 16 4 4 4-4"/>
            <path d="M7 20V4"/>
            <path d="m21 8-4-4-4 4"/>
            <path d="M17 4v16"/>
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
    setIsGroupSorted,
    renderMode
}: ColumnGroupSortProps) => {

    /* Display loader when logs updates */
    const [spinnerColor, setSpinnerColor] = useState("white");
    useEffect(() => {
        setGroupSortLoading(false);
    },[logs])

    const isGroupSorted = groupSorting.findIndex(s => s.id === column.id) !== -1;
    const sortingOrder = isGroupSorted ? groupSorting.find(s => s.id === column.id)!.desc ? "desc" : "asc" : false;
    useEffect(() => {
        setIsGroupSorted(isGroupSorted);
    }, [isGroupSorted])

    const states = [
        { key: false, nextKey: "desc", tooltip: "Sort groups descending", icon: <GArrowUpDown/> },
        { key: "asc", nextKey: false, tooltip: "Unsort groups", icon: <GArrowUp/> },
        { key: "desc", nextKey: "asc", tooltip: "Sort groups ascending", icon: <GArrowDown/> },
    ];
    const state = states.find(state => state.key === sortingOrder)!;
    const tooltip = state.tooltip;
    const icon = groupSortLoading ? <LoaderCircle className={`animate-spin text-${spinnerColor}`}/> : state.icon
    const variant = isGroupSorted ? "primary" : undefined;
    const onClick = () => {
        setGroupSortLoading(true)
        let newGroupSorting = [...groupSorting]
        if (newGroupSorting.length && isGroupSorted) {
            if (state.nextKey) {
                newGroupSorting = [{id: column.id, desc: state.nextKey === "desc"}]
            } 
            else {
                newGroupSorting = []
            }
        }
        else {
            newGroupSorting = [{id: column.id, desc: true}] 
        }
        if (!state.nextKey) {
            setSpinnerColor("primary") 
        } 
        else {
            setSpinnerColor("white")
        }
        setGroupSorting(newGroupSorting)
    }

    return (
        renderMode === "menuItem" ? (
            <DropdownMenuItem onClick={() => {onClick(); setSpinnerColor("white")}} className="flex items-center cursor-pointer">
                <div className="scale-[0.6] -translate-x-1"><GArrowUpDown className="translate(-2,0)"/></div>
                <span>Sort groups descending</span>
            </DropdownMenuItem>
        ) : (
            <ActionButton tooltip={tooltip} icon={icon} variant={variant} onClick={onClick} disabled={!interactive || groupSortLoading}/>
        )
    );

});

export default ColumnGroupSort;
