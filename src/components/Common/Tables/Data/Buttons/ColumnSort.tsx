import { Column } from "@tanstack/react-table";
import { SortDesc, SortAsc } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";
const ColumnSort = ({column}: {column: Column<any | unknown>}) => {

    return(
        <ActionButton
            tooltip={`Sort (${column.getIsSorted() === "asc" ? "descending" : "ascending"})`}
            icon={column.getIsSorted() === "asc" ? <SortDesc/> : <SortAsc/>}
            onClick={() => column.getIsSorted() === "asc" ? column.toggleSorting(true) : column.toggleSorting(false)}
        />
    );
}

export default ColumnSort;
