"use client";

import { SortDesc, SortAsc, ArrowUpDown } from "lucide-react";
import SettingButton from "@/components/Common/Buttons/Setting";

type PlotSortProps = {
    sortBars: string,
    setSortBars: (sortBars: string) => void,
}

const PlotSort = (({sortBars, setSortBars
}: PlotSortProps) => {
    const isSorted = sortBars === "asc" || sortBars === "desc"
    const states = [
        { key: "unsorted",  nextKey: "desc", tooltip: "Sort bars descending", icon: <ArrowUpDown/> },
        { key: "asc",  nextKey: "unsorted", tooltip: "Unsort bars", icon: <SortAsc/> },
        { key: "desc", nextKey: "asc",  tooltip: "Sort bars ascending", icon: <SortDesc/> },
    ];
    const state = states.find(state => state.key === sortBars)!;
    const tooltip = state.tooltip;
    const icon = state.icon
    const variant = isSorted ? "primary" : undefined;
    const onClick = () => setSortBars(state.nextKey)
    return (
        <SettingButton tooltip={tooltip} icon={icon} variant={variant} onClick={onClick}/>
    );

});

export default PlotSort;
