"use client";

import { useEffect, useState } from "react";
import { Column } from "@tanstack/react-table";
import { SortDesc, SortAsc, ArrowUpDown, LoaderCircle } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";
const ColumnSort = ({interactive, column, data}: {interactive?: boolean, column: Column<any | unknown>, data: any[]}) => {

    /* Display loader when data updates */
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        setLoading(false);
    },[data])

    const states = [
        { key: false, tooltip: "Sort ascending", icon: <ArrowUpDown/> },
        { key: "asc", tooltip: "Sort descending", icon: <SortAsc/> },
        { key: "desc", tooltip: "Unsort", icon: <SortDesc/> },
    ];
    const state = states.find(state => state.key === column.getIsSorted())!;
    const tooltip = state.tooltip;
    const icon = loading ? <LoaderCircle className="animate-spin text-white"/> : state.icon
    const variant = column.getIsSorted() ? "primary" : undefined;
    const onClick = () => {
        column.toggleSorting()
        setLoading(true)
    }

    return(
        <ActionButton tooltip={tooltip} icon={icon} variant={variant} onClick={onClick} disabled={interactive == false || loading}/>
    );
}

export default ColumnSort;
