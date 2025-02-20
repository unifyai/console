"use client";

import { Column, Table } from "@tanstack/react-table";
import { CircleMinus } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";
import { updateColumnVisibility } from "@/utils/evals/columnOperations";
import { forwardRef } from "react";

type ColumnHideProps = {
    column: Column<any, unknown>,
    columnVisibility: { [key: string]: boolean },
    setColumnVisibility: (columnVisibility: { [key: string]: boolean }) => void
}

const ColumnHide = forwardRef<HTMLButtonElement, ColumnHideProps>(({
    column,
    columnVisibility,
    setColumnVisibility
}, ref) => {

    // Check if column has child columns
    const isParentColumn = column.columnDef.meta?.isParent;

    const hideColumns = () => {

        // Use the utility function to hide the column and all its children
        const newVisibility = updateColumnVisibility(columnVisibility, column.id as string, false);

        // Apply the updated visibility state
        setColumnVisibility(newVisibility);
    };

    return <ActionButton 
        ref={ref}
        tooltip={isParentColumn ? "Hide All" : "Hide"} 
        icon={<CircleMinus/>} 
        onClick={hideColumns}
    />;
});

ColumnHide.displayName = "ColumnHide";

export default ColumnHide;
