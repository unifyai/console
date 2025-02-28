"use client";

import { useEffect, useState } from "react";
import { TableCell } from "@/components/UI/table";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import ActionButton from "@/components/Common/Buttons/Action";
import { CSSProperties } from "react";
import { DropdownMenuCheckboxItem, DropdownMenuItem } from "@/components/UI/dropdown-menu";
import { metrics } from "@/constants/logs";
import { ChevronDown, LoaderCircle } from "lucide-react";
import { GroupedLogProps, LogProps } from "@/types/evals/logs";

const style: CSSProperties = {
    cursor: "default",
    position: "sticky",
    transition: "width transform 0.2s ease-in-out",
    whiteSpace: "nowrap",
    zIndex: 1,
    alignItems: "center" 
};

const ColumnMetrics = ({interactive, metric, setMetric, colSpan = 1, logs}: {interactive: boolean, metric: string, setMetric: (x: string) => void, colSpan?: number, logs:LogProps[] | GroupedLogProps[]}) => {
    
    /* Display loader when data updates */
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        setLoading(false);
    },[logs])
    
    const onClick = (metric_: string) => {
        setMetric(metric_)
        setLoading(true)
    }

    return (
        <div style={style}>
            <BaseDropdown button={<ActionButton tooltip="Select metric" text={metric} icon={loading ? <LoaderCircle className="animate-spin text-primary"/> : <ChevronDown />} disabled={!interactive || loading} />} open={interactive ? undefined : false}>
                {metrics.map((metric_, index) => (
                    <DropdownMenuCheckboxItem checked={metric === metric_} key={index} onClick={() => onClick(metric_)}>
                        {metric_}
                    </DropdownMenuCheckboxItem>
                ))}
            </BaseDropdown>
        </div>
    )
}

export default ColumnMetrics;
