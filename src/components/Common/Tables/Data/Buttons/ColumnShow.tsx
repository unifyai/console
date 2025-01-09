import ActionButton from "@/components/Common/Buttons/Action";
import BaseButton from "@/components/Common/Buttons/Base";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup } from "@/components/UI/dropdown-menu";
import { Table, Header } from "@tanstack/react-table";
import { CirclePlus, Plus } from "lucide-react";
import { getAllChildColumns } from "@/utils/evals/column-operations";
import ColumnCreate from "./ColumnCreate";

const ColumnShow = ({ table, header, columnVisibility, setColumnVisibility }: {
    table: Table<any | unknown>,
    header: Header<any, unknown>,
    columnVisibility: { [key: string]: boolean },
    setColumnVisibility: (columnVisibility: { [key: string]: boolean }) => void,
}) => {
    const isParentColumn = header.column.columnDef.meta?.isParentColumn;

    // Handle hidden columns
    const hiddenColumns = isParentColumn
        ? getAllChildColumns(header.column)
            .map(col => col.id)
            .filter(id => !columnVisibility[id])
        : header.column.parent
            ? header.column.parent.getLeafColumns()
                .map(col => col.id)
                .filter(id => !columnVisibility[id])
            : Object.keys(columnVisibility).filter(key => !columnVisibility[key]);


    const displayColumn = (column: string) => {
        // Debug logs only when plus button is clicked
        console.log("\n=== ColumnShow Debug ===");
        console.log("Column being shown:", header.column.id, "isParentColumn:", isParentColumn);
        if (header.column.parent) {
            console.log("Parent column:", header.column.parent.id);
            console.log("Parent's leaf columns:", header.column.parent.getLeafColumns().map(col => col.id));
        }
        console.log("Hidden columns found:", hiddenColumns);
        console.log("Current visibility state:", columnVisibility);
        
        const newVisibility = { ...columnVisibility };
        newVisibility[column] = true;
        console.log("New visibility state:", newVisibility);
        console.log("=== End Debug ===\n");
        
        setColumnVisibility(newVisibility);
    }

    // Sub components
    const columnButton = <ActionButton tooltip={isParentColumn ? "Show All" : "New column"} icon={<CirclePlus />} />
    const hidden =  <DropdownMenuGroup>
                        {hiddenColumns.map((column, index) =>
                            <DropdownMenuItem key={index} onClick={() => {
                                displayColumn(column);
                            }}>
                                {column}
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuGroup>
    const derivedButton = <BaseButton variant="ghost" icon={<Plus/>} text={"Create column"} className={"h-4 pt-2"}/>
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
