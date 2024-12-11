"use client";

import { TableCell } from "@/components/UI/table";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import ActionButton from "@/components/Common/Buttons/Action";
import { CSSProperties } from "react";
import { DropdownMenuCheckboxItem, DropdownMenuItem } from "@/components/UI/dropdown-menu";
import { metrics } from "@/constants/logs";
import { ChevronDown } from "lucide-react";

const style: CSSProperties = {
    cursor: "pointer",
    position: "sticky",
    transition: "width transform 0.2s ease-in-out",
    whiteSpace: "nowrap",
    zIndex: 1,
};

const ColumnMetrics = ({metric, setMetric}: {metric: string, setMetric: (x: string) => void}) => {
    return (
        <TableCell style={style}>
            <BaseDropdown button={<ActionButton tooltip="Select metric" text={metric} icon={<ChevronDown />} />} label="Select column reduction metric">
                {metrics.map((metric_, index) =>
                    <DropdownMenuCheckboxItem checked={metric === metric_} key={index} onClick={() => setMetric(metric_)}>
                        {metric_}
                    </DropdownMenuCheckboxItem>
                )}
            </BaseDropdown>
        </TableCell>
    )
}

export default ColumnMetrics;
