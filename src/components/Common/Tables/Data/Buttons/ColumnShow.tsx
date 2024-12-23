import ActionButton from "@/components/Common/Buttons/Action";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup } from "@/components/UI/dropdown-menu";
import { Table, Header } from "@tanstack/react-table";
import { CirclePlus, Plus } from "lucide-react";
import ColumnCreate from "./ColumnCreate";

const ColumnShow = ({ table, header, columnVisibility, setColumnVisibility }: {
    table: Table<any | unknown>,
    header: Header<any, unknown>,
    columnVisibility: { [key: string]: boolean },
    setColumnVisibility: (columnVisibility: { [key: string]: boolean }) => void,
}) => {

    // Handle hidden columns
    const hiddenColumns = header.column.parent
        ? header.column.parent.getLeafColumns().map((header) => header.id).filter((id) => !columnVisibility[id])
        : Object.keys(columnVisibility).filter(key => !columnVisibility[key]);
    const displayColumn = (column: string) => {
        const newVisibility = { ...columnVisibility };
        newVisibility[column] = true;
        setColumnVisibility(newVisibility);
    }

    // Sub components
    const columnButton = <ActionButton tooltip="New column" icon={<CirclePlus />} />
    const hidden =  <DropdownMenuGroup>
                        <DropdownMenuLabel>Hidden Columns</DropdownMenuLabel>
                        {hiddenColumns.map((column, index) =>
                            <DropdownMenuItem key={index} onClick={() => {
                                displayColumn(column);
                            }}>
                                {column}
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator/>
                    </DropdownMenuGroup>
    const derivedButton = <ActionButton className="h-4 pt-2" tooltip={"Create new column from operations"} text="Create column" icon={<Plus />} />
    const derived = <DropdownMenuGroup>
                        <DropdownMenuLabel>Derived Column</DropdownMenuLabel>
                        <DropdownMenuItem className="flex flex-row justify-between">
                            <BaseDropdown button={derivedButton} label="Create new column">
                                <ColumnCreate table={table} header={header}/>
                            </BaseDropdown>
                        </DropdownMenuItem>
                    </DropdownMenuGroup>

    return (
        <div className="absolute top-5 -right-4 z-10 hover:opacity-100 opacity-0 transition-all">
            <BaseDropdown button={columnButton} label="Add a column">
                {hiddenColumns.length > 0 && hidden}
                {header.column.columnDef.meta?.columnType === "entries" && derived}
            </BaseDropdown>
        </div>
    );
};

export default ColumnShow;
