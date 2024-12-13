import ActionButton from "@/components/Common/Buttons/Action";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import { DropdownMenuItem } from "@/components/UI/dropdown-menu";
import { Header } from "@tanstack/react-table";
import { CirclePlus } from "lucide-react";
import { CSSProperties } from "react";

const ColumnShow = ({ header, columnVisibility, setColumnVisibility }: {
    header: Header<any, unknown>,
    columnVisibility: { [key: string]: boolean },
    setColumnVisibility: (columnVisibility: { [key: string]: boolean }) => void,
}) => {
    const hiddenColumns = header.column.parent
        ? header.column.parent.getLeafColumns().map((header) => header.id).filter((id) => !columnVisibility[id])
        : Object.keys(columnVisibility).filter(key => !columnVisibility[key]);
    const displayColumn = (column: string) => {
        const newVisibility = { ...columnVisibility };
        newVisibility[column] = true;
        setColumnVisibility(newVisibility);
    }
    console.dir(hiddenColumns);
    return (
        <div className="absolute top-5 -right-4 z-10 hover:opacity-100 opacity-0 transition-all">
            {!hiddenColumns || hiddenColumns?.length == 0 ? (
                <ActionButton tooltip="No columns are hidden" icon={<CirclePlus />} disabled={true} />
            ) : <BaseDropdown
                button={
                    <ActionButton tooltip="Show Columns" icon={<CirclePlus />} />
                }
                label="Select the column to add"
            >
                {hiddenColumns.map((column, index) =>
                    <DropdownMenuItem key={index} onClick={() => {
                        displayColumn(column);
                    }}>
                        {column}
                    </DropdownMenuItem>
                )}
            </BaseDropdown>}
        </div>
    );
};

export default ColumnShow;
