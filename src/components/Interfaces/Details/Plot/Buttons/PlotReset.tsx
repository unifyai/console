"use client";

import ActionButton from "@/components/Common/Buttons/Action";
import { clearCanvas, clearFixedTooltip } from "@/utils/evals/plot";
import { GrClearOption } from "react-icons/gr";

const PlotReset = ({svgRef, containerRef, setXAxis, setYAxis, setGroupBy, setIsAggregated}: {
    svgRef: any,
    containerRef: any,
    setXAxis: ((x: string | undefined) => void) | undefined,
    setYAxis: ((x: string | undefined) => void) | undefined,
    setGroupBy: ((x: string | undefined) => void) | undefined,
    setIsAggregated: ((x: string | undefined) => void) | undefined
}) => {
    const onClick = () => {
        if (setXAxis) setXAxis(undefined);
        if (setYAxis) setYAxis(undefined);
        if (setGroupBy) setGroupBy(undefined);
        if (setIsAggregated) setIsAggregated(undefined);
        clearCanvas(svgRef, containerRef);
        clearFixedTooltip();
    };
    return (
        <ActionButton
            icon={<GrClearOption/>}
            tooltip="Clear plot"
            onClick={onClick}
        />
    )
}

export default PlotReset;
