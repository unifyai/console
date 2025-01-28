import { Column, Table } from "@tanstack/react-table";
import { CircleMinus, Minus } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";
import { updateColumnVisibility } from "@/utils/evals/columnOperations";

const ColumnHide = ({column, columnVisibility, setColumnVisibility}: {
    column: Column<any, unknown>,
    columnVisibility: { [key: string]: boolean },
    setColumnVisibility: (columnVisibility: { [key: string]: boolean }) => void,
}) => {
    // Check if column has child columns
    const isParentColumn = column.columnDef.meta?.isParent;

    const hideColumns = () => {
        // Use the utility function to hide the column and all its children
        const newVisibility = updateColumnVisibility(columnVisibility, column.id as string, false);

        // Apply the updated visibility state
        setColumnVisibility(newVisibility);
    };

    return <ActionButton 
        tooltip={isParentColumn ? "Hide All" : "Hide"} 
        icon={<CircleMinus />} 
        onClick={hideColumns}
    />;
}

export default ColumnHide;
