"use client";

import BaseDropdown from "@/components/Common/Dropdowns/Base";
import { DropdownMenuItem } from "@/components/UI/dropdown-menu";
import ActionButton from "@/components/Common/Buttons/Action";
import { ChevronDown } from "lucide-react";
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
        .filter(([name, { data_type, field_type }]) => field_type != "param" && (data_type === "float" || data_type === "int"))
        .map(([name]) => name);
    
    // Update plot type and
    // - Set y axis to "count" if moving to a bar chart, or to the current y axis, or to the first numeric property if the current y axis isn't numeric
    // - Set x axis to the current x axis, or the first numeric property if the current x axis isn't numeric
    const onClick = (type: string) => {
        setPlotType(type)
        let yAxis: string;
        if (type === "Bar Chart") {
            yAxis = "count"
        } else {
            yAxis = selectedYAxisProperty && properties.includes(selectedYAxisProperty) ? selectedYAxisProperty : properties[0];
        }
        setSelectedYAxisProperty(yAxis)
        const xAxis = selectedXAxisProperty && properties.includes(selectedXAxisProperty) ? selectedXAxisProperty : properties[0];
        setSelectedXAxisProperty(xAxis)
    } 
    return (
        <BaseDropdown
            button={
                <ActionButton 
                    text={plotType}
                    icon={<ChevronDown/>}
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
                        {type}
                    </DropdownMenuItem>
                );
            })
        }
        </BaseDropdown>
    );
}

export default PlotType;
