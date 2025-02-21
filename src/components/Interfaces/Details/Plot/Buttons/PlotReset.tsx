"use client";

import SettingButton from "@/components/Common/Buttons/Setting";
import { X } from "lucide-react";
import * as d3 from "d3";
import { clearCanvas } from "@/utils/evals/plot";

const PlotReset = ({svgRef, containerRef, setSelectedXAxisProperty, setSelectedYAxisProperty, setGroupByProperty}: {
    svgRef: any,
    containerRef: any,
    setSelectedXAxisProperty: (x: string | undefined) => void,
    setSelectedYAxisProperty: (x: string | undefined) => void,
    setGroupByProperty: (x: string | undefined) => void
}) => {
    const onClick = () => {
        setSelectedXAxisProperty(undefined);
        setSelectedYAxisProperty(undefined);
        setGroupByProperty(undefined);
        clearCanvas(svgRef, containerRef)
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
