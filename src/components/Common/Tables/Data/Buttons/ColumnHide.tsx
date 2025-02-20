"use client";

import { Column, Table } from "@tanstack/react-table";
import { CircleMinus } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";
import { updateColumnVisibility } from "@/utils/evals/columnOperations";

type ColumnHideProps = {
    column: Column<any, unknown>,
    columnVisibility: { [key: string]: boolean },
    setColumnVisibility: (columnVisibility: { [key: string]: boolean }) => void,
    renderMode?: "button" | "menuItem"
}

const ColumnHide = ({
    column,
    columnVisibility,
    setColumnVisibility,
   
    renderMode = "button"
}: ColumnHideProps) => {

    // Check if column has child columns
    const isParentColumn = column.columnDef.meta?.isParent;

    const hideColumns = (e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }

        // Use the utility function to hide the column and all its children
        const newVisibility = updateColumnVisibility(columnVisibility, column.id as string, false);

        // Apply the updated visibility state
        setColumnVisibility(newVisibility);
    };

    if (renderMode === "menuItem") {
        return (
            <div onClick={hideColumns} className="relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0">
                <CircleMinus className="h-4 w-4" />
                <span>{isParentColumn ? "Hide all child columns" : "Hide this column"}</span>
            </div>
        );
    }

    return (
        <ActionButton 
            tooltip={isParentColumn ? "Hide All" : "Hide"} 
            icon={<CircleMinus/>} 
            onClick={hideColumns}
        />
    );
};

export default ColumnHide;
