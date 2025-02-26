"use client";

import { useEffect, useState } from "react";
import { Column, ColumnSort } from "@tanstack/react-table";
import { SortDesc, SortAsc, ArrowUpDown, LoaderCircle } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";
import { DropdownMenuItem } from "@radix-ui/react-dropdown-menu";

type ColumnGroupSortProps = {
    interactive?: boolean,
    column: Column<any | unknown>,
    groupSorting: ColumnSort[],
    setGroupSorting: (groupSorting: ColumnSort[]) => void,
    logs: any[],
    groupSortLoading: boolean,
    setGroupSortLoading: (groupSortLoading: boolean) => void,
    setIsGroupSorted: (isGroupSorted: boolean) => void,
    renderMode: "button" | "menuItem"
}

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
        { key: false, nextKey: "desc", tooltip: "Sort group descending", icon: <ArrowUpDown/> },
        { key: "asc", nextKey: false, tooltip: "Unsort group", icon: <SortAsc/> },
        { key: "desc", nextKey: "asc", tooltip: "Sort group ascending", icon: <SortDesc/> },
    ];
    const state = states.find(state => state.key === sortingOrder)!;
    const tooltip = state.tooltip;
    const icon = groupSortLoading ? <LoaderCircle className={`animate-spin text-${spinnerColor}`}/> : state.icon
    const variant = isGroupSorted ? "primary" : undefined;
    const onClick = () => {
        setGroupSortLoading(true)
        let newGroupSorting = [...groupSorting]
        if (isGroupSorted) {
            if (state.nextKey) {
                newGroupSorting.find(s => s.id === column.id)!.desc = state.nextKey === "desc"
            } 
            else {
                newGroupSorting = newGroupSorting.filter(s => s.id !== column.id)
            }
        }
        else {
            newGroupSorting.push({id: column.id, desc: true})
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
            <DropdownMenuItem onClick={onClick} className="flex items-center gap-2 cursor-pointer">
                <ArrowUpDown className="h-4 w-4"/>
                <span>Sort group descending</span>
            </DropdownMenuItem>
        ) : (
            <ActionButton tooltip={tooltip} icon={icon} variant={variant} onClick={onClick} disabled={!interactive || groupSortLoading}/>
        )
    );

});

export default ColumnGroupSort;
