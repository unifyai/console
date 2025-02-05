"use client";

import SettingButton from "@/components/Common/Buttons/Setting";
import { RefreshCcw } from "lucide-react";
import * as d3 from "d3";

const PlotReset = ({svgRef, setSelectedXAxisProperty, setSelectedYAxisProperty, setGroupByProperty}: {
    svgRef: any,
    setSelectedXAxisProperty: (x: string | undefined) => void,
    setSelectedYAxisProperty: (x: string | undefined) => void,
    setGroupByProperty: (x: string | undefined) => void
}) => {
    const svg = d3.select(svgRef.current)
    const g = svg.select(".plotData")
    const onClick = () => {
        setSelectedXAxisProperty(undefined);
        setSelectedYAxisProperty(undefined);
        setGroupByProperty(undefined);
        g.selectAll("circle.data-point").remove();
        g.selectAll("circle.hover-area").remove();
        g.selectAll("path.line-item").remove();
        g.selectAll("rect.bar-item").remove();
        g.selectAll("rect.hist-item").remove();
        g.selectAll("text.correlation").remove();
        g.selectAll("path.best-fit").remove();
    };
    return (
        <SettingButton
            icon={<RefreshCcw/>}
            tooltip="Reset settings"
            onClick={onClick}
        />
    )
}

export default PlotReset;
