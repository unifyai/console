"use client";

import { Column, Table } from "@tanstack/react-table";
import { CircleMinus, EyeOff } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";
import { updateColumnVisibility } from "@/utils/evals/columnOperations";
import { DropdownMenuItem } from "@radix-ui/react-dropdown-menu";
type ColumnHideProps = {
    column: Column<any, unknown>,
    columnVisibility: { [key: string]: boolean },
    setColumnVisibility: (columnVisibility: { [key: string]: boolean }) => void,
    renderMode: "button" | "menuItem"
}

const ColumnHide = (({
    column,
    columnVisibility,
    setColumnVisibility,
    renderMode
}: ColumnHideProps) => {

    // Check if column has child columns
    const isParentColumn = column.columnDef.meta?.isParent;

    const hideColumns = () => {

        // Use the utility function to hide the column and all its children
        const newVisibility = updateColumnVisibility(columnVisibility, column.id as string, false);

        // Apply the updated visibility state
        setColumnVisibility(newVisibility);
    };

    return (
        renderMode === "menuItem" ? (
            <DropdownMenuItem onClick={hideColumns} className="flex items-center gap-2 cursor-pointer">
                <EyeOff className="h-4 w-4"/>
                <span>{isParentColumn ? "Hide children columns" : "Hide column"}</span>
            </DropdownMenuItem>
        ) : (
            <ActionButton tooltip={isParentColumn ? "Hide All" : "Hide"} icon={<CircleMinus/>} onClick={hideColumns}/>
        )
    );
});

export default ColumnHide;
