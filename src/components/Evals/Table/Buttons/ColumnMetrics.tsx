"use client";

import { TableCell } from "@/components/UI/table";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import ActionButton from "@/components/Common/Buttons/Action";
import { CSSProperties } from "react";
import { DropdownMenuCheckboxItem, DropdownMenuItem } from "@/components/UI/dropdown-menu";
import { metrics } from "@/constants/logs";
import { ChevronDown } from "lucide-react";

const style: CSSProperties = {
    cursor: "default",
    position: "sticky",
    transition: "width transform 0.2s ease-in-out",
    whiteSpace: "nowrap",
    zIndex: 1,
};

const ColumnMetrics = ({metric, setMetric, colSpan = 1}: {metric: string, setMetric: (x: string) => void, colSpan?: number}) => {
    return (
        <TableCell style={style} colSpan={colSpan} className="text-left">
            <BaseDropdown button={<ActionButton tooltip="Select metric" text={metric} icon={<ChevronDown />} />}>
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
