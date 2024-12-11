import { Column } from "@tanstack/react-table";
import { SortDesc, SortAsc, AlignJustify } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";
const ColumnSort = ({column}: {column: Column<any | unknown>}) => {
    const states = [
        { key: false, tooltip: "Sort ascending", icon: <AlignJustify/> },
        { key: "asc", tooltip: "Sort descending", icon: <SortAsc/> },
        { key: "desc", tooltip: "Unsort", icon: <SortDesc/> },
    ];
    const state = states.find(state => state.key === column.getIsSorted())!;
    const tooltip = state.tooltip;
    const icon = state.icon;
    const variant = column.getIsSorted() ? "primary" : undefined;
    const onClick = () => column.toggleSorting()
    return(
        <ActionButton tooltip={tooltip} icon={icon} variant={variant} onClick={onClick}/>
    );
}

export default ColumnSort;
