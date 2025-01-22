import { Column } from "@tanstack/react-table";
import { SortDesc, SortAsc, ArrowUpDown } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";
const ColumnSort = ({interactive, column}: {interactive?: boolean, column: Column<any | unknown>}) => {
    const states = [
        { key: false, tooltip: "Sort ascending", icon: <ArrowUpDown/> },
        { key: "asc", tooltip: "Sort descending", icon: <SortAsc/> },
        { key: "desc", tooltip: "Unsort", icon: <SortDesc/> },
    ];
    const state = states.find(state => state.key === column.getIsSorted())!;
    const tooltip = state.tooltip;
    const icon = state.icon;
    const variant = column.getIsSorted() ? "primary" : undefined;
    const onClick = () => column.toggleSorting()
    return(
        <ActionButton tooltip={tooltip} icon={icon} variant={variant} onClick={onClick} disabled={interactive == false}/>
    );
}

export default ColumnSort;
