import { Column, Table } from "@tanstack/react-table";
import { CircleMinus, Minus } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";
import { getAllChildColumns } from "@/utils/evals/column-operations";

const ColumnHide = ({table, column}: {
    table: Table<any | unknown>,
    column: Column<any, unknown>,
}) => {
    // Check if column has child columns
    const isParentColumn = column.columns?.length > 0;

    const hideColumns = () => {
        if (isParentColumn) {
            // Hide parent and all child columns at once
            const allColumns = [column, ...getAllChildColumns(column)];
            table.setColumnVisibility(prev => {
                const updates: { [key: string]: boolean } = {};
                allColumns.forEach(col => {
                    updates[col.id] = false;
                });
                return { ...prev, ...updates };
            });
        } else {
            column.toggleVisibility();
        }
    };

    return <ActionButton 
        tooltip={isParentColumn ? "Hide All" : "Hide"} 
        icon={<CircleMinus />} 
        onClick={hideColumns}
    />;
}

export default ColumnHide;
