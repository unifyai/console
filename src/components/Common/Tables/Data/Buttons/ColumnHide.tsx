"use client";

import { useEffect, useState } from "react";
import { Column, Table } from "@tanstack/react-table";
import { CircleMinus, LoaderCircle } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";
import { updateColumnVisibility } from "@/utils/evals/columnOperations";

const ColumnHide = ({column, columnVisibility, setColumnVisibility, data}: {
    column: Column<any, unknown>,
    columnVisibility: { [key: string]: boolean },
    setColumnVisibility: (columnVisibility: { [key: string]: boolean }) => void,
    data: any[]
}) => {

    /* Display loader when data updates */
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        setLoading(false);
    },[data])

    // Check if column has child columns
    const isParentColumn = column.columnDef.meta?.isParent;

    const hideColumns = () => {
        // Trigger icon loading
        setLoading(true);

        // Use the utility function to hide the column and all its children
        const newVisibility = updateColumnVisibility(columnVisibility, column.id as string, false);

        // Apply the updated visibility state
        setColumnVisibility(newVisibility);
    };

    const icon = loading ? <LoaderCircle className="animate-spin text-primary"/> : <CircleMinus/>;

    return <ActionButton 
        tooltip={isParentColumn ? "Hide All" : "Hide"} 
        icon={icon} 
        onClick={hideColumns}
        disabled={loading}
    />;
}

export default ColumnHide;
