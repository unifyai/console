import ActionButton from "@/components/Common/Buttons/Action";
import BaseButton from "@/components/Common/Buttons/Base";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup } from "@/components/UI/dropdown-menu";
import { Table, Header } from "@tanstack/react-table";
import { CirclePlus, Plus } from "lucide-react";
import { getAllChildColumns, updateColumnVisibility } from "@/utils/evals/columnOperations";
import ColumnCreate from "./ColumnCreate";

const ColumnShow = ({ table, header, columnVisibility, setColumnVisibility }: {
    table: Table<any | unknown>,
    header: Header<any, unknown>,
    columnVisibility: { [key: string]: boolean },
    setColumnVisibility: (columnVisibility: { [key: string]: boolean }) => void,
}) => {
    const isParentColumn = header.column.columnDef.meta?.isParent;
    const columnType = header.column.columnDef.meta?.columnType;
    const currentDepth = header.column.columnDef.meta?.renderedDepth;

    const rawHiddenColumns = (() => {
        // Get all columns at the same depth
        const siblingColumns = table
            .getAllFlatColumns()
            .filter((col) => 
                col.columnDef.meta?.renderedDepth === currentDepth &&
                col.columnDef.id !== header.column.columnDef.id
            );
    
        if (isParentColumn) {
            // Get all child columns of the current column
            const childColumns = getAllChildColumns(header.column);
    
            // Combine child and sibling columns, and filter for hidden columns
            const hidden = [...childColumns, ...siblingColumns]
                .filter((col) => !columnVisibility[col.columnDef.id as string]) // Check visibility
                .map((col) => col.columnDef.id as string);

            return hidden;
        } else {
            // Only check siblings at the same depth for non-parent columns
            const hidden = siblingColumns
                .filter((col) => !columnVisibility[col.columnDef.id as string]) // Check visibility
                .map((col) => col.columnDef.id as string);

            return hidden;
        }
    })();

    // Remove any duplicates
    const seen = new Set<string>();
    const hiddenColumns = rawHiddenColumns.filter((col) => {
        if (seen.has(col as string)) {
            return false; // Exclude duplicate
        }
        seen.add(col as string); // Mark as seen
        return true; // Include unique column
    });

    const displayColumn = (column: string) => {
        const columnToShow = table.getAllFlatColumns().find((col) => col.columnDef.id === column);

        if (!columnToShow) {
            console.warn("Column not found. No updates made.");
            return;
        }

        let newVisibility = { ...columnVisibility };
        newVisibility = updateColumnVisibility(newVisibility, column, true);
        setColumnVisibility(newVisibility);
    };

    // Conditions for showing the Plus button
    const shouldShowButton = (() => {
        // Case 1: Leaf headers with columnType "params"
        if (!isParentColumn && columnType === "params") {
            return hiddenColumns.length > 0; // Show only if there are hidden columns
        }

        // Case 2: Leaf headers with columnType "entries"
        if (!isParentColumn && columnType === "entries") {
            return true; // Always show for entries leaf headers
        }

        // Case 3: Parent headers with columnType "params", "entries", "paramsHeader", or "entriesHeader"
        if (
            isParentColumn &&
            (columnType === "params" ||
                columnType === "entries" ||
                columnType === "paramsHeader" ||
                columnType === "entriesHeader")
        ) {
            return hiddenColumns.length > 0; // Show only if there are hidden columns
        }

        return false; // Default: Do not show the button
    })();

    if (!shouldShowButton) return null;

    // Sub components
    const columnButtonLabel = hiddenColumns.length > 0 ? "Show Column" : "New Column";
    const columnButton = <ActionButton tooltip={columnButtonLabel} icon={<CirclePlus />} />
    const hidden =  <DropdownMenuGroup>
                        {hiddenColumns.map((column, index) =>
                            <DropdownMenuItem key={index} onClick={() => {
                                displayColumn(column);
                            }}>
                                {column}
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuGroup>
    const derivedButton = <BaseButton variant="ghost" icon={<Plus/>} text={"Create Column"} className={"h-4 pt-2"}/>
    const derived = <DropdownMenuGroup>
                        <DropdownMenuItem className="flex flex-row justify-between">
                            <BaseDropdown button={derivedButton}>
                                <ColumnCreate table={table} header={header}/>
                            </BaseDropdown>
                        </DropdownMenuItem>
                    </DropdownMenuGroup>

    return (
        <div className="absolute top-5 -right-4 z-10 hover:opacity-100 opacity-0 transition-all">
            <BaseDropdown button={columnButton}>
                {hiddenColumns.length > 0 && hidden}
                {header.column.columnDef.meta?.columnType === "entries" && derived}
            </BaseDropdown>
        </div>
    );
};

export default ColumnShow;
