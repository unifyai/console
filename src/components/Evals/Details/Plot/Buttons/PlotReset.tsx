"use client";

import SettingButton from "@/components/Common/Buttons/Setting";
import { X } from "lucide-react";
import * as d3 from "d3";

const PlotReset = ({svgRef, setSelectedXAxisProperty, setSelectedYAxisProperty, setGroupByProperty}: {
    svgRef: any,
    setSelectedXAxisProperty: (x: string | null) => void,
    setSelectedYAxisProperty: (x: string | null) => void,
    setGroupByProperty: (x: string | null) => void
}) => {
    const svg = d3.select(svgRef.current)
    const g = svg.select(".plotData")
    const xAxis = svg.select(".xAxis")
    const yAxis = svg.select(".yAxis")
    const onClick = () => {
        setSelectedXAxisProperty(null);
        setSelectedYAxisProperty(null);
        setGroupByProperty(null);
        g.selectAll("*").remove();
        xAxis.selectAll("*").remove();
        yAxis.selectAll("*").remove();
    };
    return (
        <SettingButton
            icon={<X/>}
            tooltip="Reset settings"
            onClick={onClick}
        />
    )
}

export default PlotReset;
