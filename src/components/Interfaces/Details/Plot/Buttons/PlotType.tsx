"use client";

import BaseDropdown from "@/components/Common/Dropdowns/Base";
import { DropdownMenuItem } from "@/components/UI/dropdown-menu";
import ActionButton from "@/components/Common/Buttons/Action";
import { ChevronDown, ChartScatter, ChartLine, ChartColumn, ChartColumnBig } from "lucide-react";
import { LogFieldsResponseProps } from "@/types/evals/logs";

const PlotType = ({ interactive, plotType, setPlotType, fields, selectedXAxisProperty, setSelectedXAxisProperty, selectedYAxisProperty, setSelectedYAxisProperty}: {
    interactive: boolean,
    plotType: string, 
    setPlotType: (x: string | undefined) => void,
    fields: LogFieldsResponseProps,
    selectedXAxisProperty: string | undefined,
    setSelectedXAxisProperty: (x: string | undefined) => void    
    selectedYAxisProperty: string | undefined,
    setSelectedYAxisProperty: (x: string | undefined) => void
}) => {

    const properties = Object
        .entries(fields)
        .filter(([name, { data_type, field_type }]) => (data_type === "float" || data_type === "int"))
        .map(([name]) => name);
    
    // Update plot type and
    // - Set y axis to "count" if moving to a bar chart, or to the current y axis, or to the first numeric property if the current y axis isn't numeric
    // - Set x axis to the current x axis, or the first numeric property if the current x axis isn't numeric
    const onClick = (type: string) => {
        setPlotType(type)
        const yAxis = selectedYAxisProperty && properties.includes(selectedYAxisProperty) ? selectedYAxisProperty : properties[0];
        const xAxis = selectedXAxisProperty && properties.includes(selectedXAxisProperty) ? selectedXAxisProperty : properties[0];
        setSelectedXAxisProperty(xAxis)
        setSelectedYAxisProperty(yAxis)
    } 

    const plotIcons = {"Line Chart": <ChartLine/>, "Bar Chart": <ChartColumn/>, "Histogram": <ChartColumnBig/>, "Scatter Plot": <ChartScatter/>}
    const icon = 
    <div className="flex flex-row gap-1">
        <ChevronDown/>
        {plotIcons[plotType as keyof typeof plotIcons]}
    </div>
    
    return (
        <BaseDropdown
            button={
                <ActionButton 
                    text={plotType}
                    icon={icon}
                    tooltip="Plot type"
                    disabled={!interactive}
                />
            }
            open={interactive ? undefined : false}
        >
        {
            ["Scatter Plot", "Line Chart", "Bar Chart", "Histogram"].map((type, index) => {
                return (
                    <DropdownMenuItem key={index} onClick={() => onClick(type)}>
                        {plotIcons[type as keyof typeof plotIcons]}
                        {type}
                    </DropdownMenuItem>
                );
            })
        }
        </BaseDropdown>
    );
}

export default PlotType;
