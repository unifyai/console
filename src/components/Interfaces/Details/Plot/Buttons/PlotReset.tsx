"use client";

import SettingButton from "@/components/Common/Buttons/Setting";
import { X } from "lucide-react";
import * as d3 from "d3";

const PlotReset = ({svgRef, setSelectedXAxisProperty, setSelectedYAxisProperty, setGroupByProperty}: {
    svgRef: any,
    setSelectedXAxisProperty: (x: string | undefined) => void,
    setSelectedYAxisProperty: (x: string | undefined) => void,
    setGroupByProperty: (x: string | undefined) => void
}) => {
    const svg = d3.select(svgRef.current)
    const g = svg.select(".plotData")
    const xAxis = svg.select(".xAxis")
    const yAxis = svg.select(".yAxis")
    const onClick = () => {
        setSelectedXAxisProperty(undefined);
        setSelectedYAxisProperty(undefined);
        setGroupByProperty(undefined);
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
