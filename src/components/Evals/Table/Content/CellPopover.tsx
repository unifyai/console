"use client";

import { BasePopover } from "@/components/Common/Popovers/Base";
import { Cell, flexRender } from "@tanstack/react-table";
import { Dispatch, SetStateAction, useState, useEffect } from "react";

const CellPopover = ({cell, isCellExpanded, setExpandedCells}: {
    cell: Cell<any, unknown>, 
    isCellExpanded: (cell: Cell<any, unknown>) => boolean,
    setExpandedCells: Dispatch<SetStateAction<{[k: string]: boolean}>>
}) => {
    
    const isExpanded = isCellExpanded(cell);
    const [open, setOpen] = useState(isExpanded)

    // Transform closing event into state update for expanded cells
    useEffect(() => {
        if (!open)
        setExpandedCells(expandedCells => ({
            ...expandedCells, 
            [cell.id]: false
        }))
    },[open, cell.id, setExpandedCells])

    // Transform expand cell event to popover open state
    useEffect(() => {
        if (isExpanded) 
            setOpen(true) 
        else setOpen(false)
    }, [isExpanded, cell])

    return (
    <div style={{position: "absolute"}}>
        <BasePopover button={null} open={open} setOpen={setOpen} className="max-w-[500px] max-h-[200px] overflow-auto p-5">
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </BasePopover>
    </div>
    )
}

export default CellPopover;
