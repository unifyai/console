"use client";

import { useEffect, useState } from "react";
import { Column, ColumnSort } from "@tanstack/react-table";
import { LoaderCircle } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";
import { DropdownMenuItem } from "@radix-ui/react-dropdown-menu";
import { GroupedLogProps, LogProps } from "@/types/evals/logs";
import { TbLetterG } from "react-icons/tb"

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
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor"  
        stroke-width="3"
        stroke-linecap="round" 
        stroke-linejoin="round" 
        className="lucide lucide-g-arrow-up"
        transform="scale(1.1)"
      >

      {/* G Letter */}
      <g fill="#000000" transform="translate(1,7) scale(0.3) translate(-3,-12)">
          <path stroke-width="5" d="M17.94 31.23L17.94 27.03L33.11 27.00L33.11 40.28Q29.61 43.07 25.90 44.47Q22.19 45.87 18.29 45.87Q13.01 45.87 8.70 43.62Q4.39 41.36 2.20 37.08Q0 32.81 0 27.54Q0 22.31 2.19 17.79Q4.37 13.26 8.47 11.06Q12.57 8.86 17.92 8.86Q21.80 8.86 24.94 10.12Q28.08 11.38 29.86 13.62Q31.64 15.87 32.57 19.48L28.30 20.65Q27.49 17.92 26.29 16.36Q25.10 14.79 22.88 13.85Q20.65 12.92 17.94 12.92Q14.70 12.92 12.33 13.90Q9.96 14.89 8.51 16.50Q7.06 18.12 6.25 20.04Q4.88 23.36 4.88 27.25Q4.88 32.03 6.53 35.25Q8.18 38.48 11.33 40.04Q14.48 41.60 18.02 41.60Q21.09 41.60 24.02 40.42Q26.95 39.23 28.47 37.89L28.47 31.23L17.94 31.23Z"/>
      </g>

      {/* Arrow Up */}
      <g fill="#000000" transform="translate(1,0)">
        <path d="M18 16V7"/>
        <path d="m14 11 4-4 4 4"/>
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
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor"  
        stroke-width="3"
        stroke-linecap="round" 
        stroke-linejoin="round" 
        className="lucide lucide-g-arrow-down"
        transform="scale(1.1)"
      >
      
      {/* G Letter */}
      <g fill="#000000" transform="translate(1,7) scale(0.3) translate(-3,-12)">
          <path stroke-width="5" d="M17.94 31.23L17.94 27.03L33.11 27.00L33.11 40.28Q29.61 43.07 25.90 44.47Q22.19 45.87 18.29 45.87Q13.01 45.87 8.70 43.62Q4.39 41.36 2.20 37.08Q0 32.81 0 27.54Q0 22.31 2.19 17.79Q4.37 13.26 8.47 11.06Q12.57 8.86 17.92 8.86Q21.80 8.86 24.94 10.12Q28.08 11.38 29.86 13.62Q31.64 15.87 32.57 19.48L28.30 20.65Q27.49 17.92 26.29 16.36Q25.10 14.79 22.88 13.85Q20.65 12.92 17.94 12.92Q14.70 12.92 12.33 13.90Q9.96 14.89 8.51 16.50Q7.06 18.12 6.25 20.04Q4.88 23.36 4.88 27.25Q4.88 32.03 6.53 35.25Q8.18 38.48 11.33 40.04Q14.48 41.60 18.02 41.60Q21.09 41.60 24.02 40.42Q26.95 39.23 28.47 37.89L28.47 31.23L17.94 31.23Z"/>
      </g>
      
      {/* Arrow Down */}
      <g fill="#000000" transform="translate(1,0)">
        <path d="M18 7v9"/>
        <path d="m14 12 4 4 4-4"/>
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
        { key: false, nextKey: "desc", tooltip: "Sort group descending", icon: <TbLetterG/> },
        { key: "asc", nextKey: false, tooltip: "Unsort group", icon: <GArrowUp/> },
        { key: "desc", nextKey: "asc", tooltip: "Sort group ascending", icon: <GArrowDown/> },
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
            <DropdownMenuItem onClick={onClick} className="flex items-center gap-1 cursor-pointer">
                <TbLetterG className="h-5 w-5 pr-1.5"/>
                <span>Sort group descending</span>
            </DropdownMenuItem>
        ) : (
            <ActionButton tooltip={tooltip} icon={icon} variant={variant} onClick={onClick} disabled={!interactive || groupSortLoading}/>
        )
    );

});

export default ColumnGroupSort;
