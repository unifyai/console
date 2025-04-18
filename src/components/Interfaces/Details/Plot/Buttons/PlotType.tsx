"use client";

import { Dispatch, SetStateAction } from "react";
import { ChartScatter, ChartLine, ChartColumn, ChartColumnBig } from "lucide-react";
import { LogFieldsResponseProps } from "@/types/evals/logs";
import { clearCanvas } from "@/utils/evals/plots/canvas";
import { clearFixedTooltip } from "@/utils/evals/plots/tooltip";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/UI/accordion";
import Tooltip from "@/components/Common/Misc/Tooltip";
import { Button } from "@/components/UI/button";
import * as d3 from "d3";

const PlotType = ({ interactive = true, settingsRef, svgRef, containerRef, plotType, setPlotType, fields, selectedXAxisProperty, setXAxis, selectedYAxisProperty, setYAxis, setIsTooltipMinimized}: {
    interactive: boolean,
    settingsRef: any,
    svgRef: any,
    containerRef: any,
    plotType: string, 
    fields: LogFieldsResponseProps,
    selectedXAxisProperty: string | undefined,
    selectedYAxisProperty: string | undefined,
    setPlotType: ((x: string | undefined) => void) | undefined,
    setXAxis: ((x: string | undefined) => void) | undefined,    
    setYAxis: ((x: string | undefined) => void) | undefined,
    setIsTooltipMinimized: Dispatch<SetStateAction<boolean>>
}) => {
    const settings = d3.select(settingsRef.current)
    const plotTypes = ["Scatter Plot", "Line Chart", "Bar Chart", "Histogram"]

    const properties = Object
        .entries(fields)
        .filter(([name, { data_type, field_type }]) => (data_type === "float" || data_type === "int"))
        .map(([name]) => name);
    
    // Update plot type and
    // - Set y axis to "count" if moving to a bar chart, or to the current y axis, or to the first numeric property if the current y axis isn't numeric
    // - Set x axis to the current x axis, or the first numeric property if the current x axis isn't numeric
    const onClick = (type: string) => {
        if (!interactive || !setPlotType || !setXAxis || !setYAxis) return;
        setPlotType(type)
        const yAxis = selectedYAxisProperty && properties.includes(selectedYAxisProperty) ? selectedYAxisProperty : undefined;
        const xAxis = selectedXAxisProperty && properties.includes(selectedXAxisProperty) ? selectedXAxisProperty : undefined;
        if (type === "Histogram" && !xAxis) {
            clearCanvas(svgRef, containerRef)
            clearFixedTooltip(settings, setIsTooltipMinimized)
        }
        if (type != "Histogram" && [xAxis, yAxis].some(v => !v)) {
            clearCanvas(svgRef, containerRef)
            clearFixedTooltip(settings, setIsTooltipMinimized)
        } 
        setXAxis(xAxis)
        setYAxis(yAxis)
    } 

    const plotIcons = {
        "Line Chart":   {name: "Line", icon: <ChartLine/>}, 
        "Bar Chart":    {name: "Bar", icon: <ChartColumn/>}, 
        "Histogram":    {name: "Histogram", icon: <ChartColumnBig/>}, 
        "Scatter Plot": {name: "Scatter", icon: <ChartScatter/>}
    }

    return (
        <AccordionItem value="plot-type">
            <AccordionTrigger disabled={!interactive}>
                <Tooltip content="Determines the type of data that can be plotted and how it is displayed" side="left">
                    <div className="flex flex-row gap-1 items-center">
                        <div className="scale-[0.8]">
                            {plotType && plotIcons[plotType as keyof typeof plotIcons].icon}
                        </div>
                        {`Type: ${plotType}`}
                    </div>
                </Tooltip>
            </AccordionTrigger>
            <AccordionContent>
            <div className="space-y-1 pr-2">
                {plotTypes.map((pt) => (
                    <Button
                        key={pt}
                        variant={plotType === pt ? "primary" : "list_item"}
                        size="lg"
                        className="w-full justify-start h-auto py-1 text-md flex items-center gap-2"
                        onClick={() => onClick(pt)}
                        disabled={!interactive}
                    >
                        {plotIcons[pt as keyof typeof plotIcons]?.icon || (<span className="w-4 h-4"></span>)}
                        {plotIcons[pt as keyof typeof plotIcons]?.name || pt}
                    </Button>
                ))}
                </div>
            </AccordionContent>
        </AccordionItem>
    );
}

export default PlotType;
