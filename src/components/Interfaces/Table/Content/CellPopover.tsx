"use client";

import { BasePopover } from "@/components/Common/Popovers/Base";
import { CopyButton } from "@/components/Common/Buttons/Copy";
import { Cell, flexRender } from "@tanstack/react-table";
import { Dispatch, SetStateAction, useState, useEffect } from "react";
import { LogProps, LogItemProps } from "@/types/evals/logs";
import { getPartAfterFirstUnderscore } from "@/utils/evals/selection";
import { sanitizeId } from "@/utils/evals/columnOperations";
import Markdown from "react-markdown";
import { getValueType } from "../../Details/Selection/Views/ViewTypes";

const CellPopover = ({cell, flatLogs, paramsValues, isCellExpanded, setExpandedCells}: {
    cell: Cell<any, unknown>, 
    flatLogs: LogProps[],
    paramsValues: LogItemProps,
    isCellExpanded: (cell: Cell<any, unknown>) => boolean,
    setExpandedCells: Dispatch<SetStateAction<{[k: string]: boolean}>>
}) => {
    
    const [open, setOpen] = useState(isCellExpanded(cell))
    
    // Transform closing event into state update for expanded cells
    useEffect(() => {
        if (!open)
        setExpandedCells(expandedCells => ({
            ...expandedCells, 
            [cell.id]: false
        }))
    },[open])

    // Transform expand cell event to popover open state
    useEffect(() => {
        if (isCellExpanded(cell)) 
            setOpen(true) 
        else setOpen(false)
    }, [isCellExpanded(cell)])

    /* Copy button */
    const field = sanitizeId(getPartAfterFirstUnderscore(cell.id))
    const content = cell.column.columnDef.meta?.fieldType === "param" ? paramsValues[field] : flatLogs.find(l => String(l.id) === cell.id.split("_")[0])?.entries[field] ?? ""
    const copy = <div className="absolute top-1 right-1"><CopyButton content={content}/></div>
    
    return (
    <div style={{position: "absolute"}} onClick={(e) => e.stopPropagation()}>
        <BasePopover button={null} open={open} setOpen={setOpen} className="relative max-w-[500px] max-h-[200px] overflow-auto p-5">
            {copy}
            {cell.column.columnDef.meta?.dataType === "image" ? flexRender(cell.column.columnDef.cell, cell.getContext()) : <Markdown>{JSON.stringify(content)}</Markdown>}
        </BasePopover>
    </div>
    )
}

export default CellPopover;
