"use client";

import BaseDropdown from "@/components/Common/Dropdowns/Base";
import ActionButton from "@/components/Common/Buttons/Action";
import { DropdownMenuItem } from "@/components/UI/dropdown-menu";
import { metrics } from "@/constants/logs";
import { ChevronDown } from "lucide-react";
import { LogFieldsResponseProps } from "@/types/evals/logs";

const PlotAxis = ({fields, axisProperty, setAxisProperty, axis, plotType}: {
    fields: LogFieldsResponseProps,
    axisProperty: string | undefined,
    setAxisProperty: (x: string | undefined) => void,
    axis: string,
    plotType: string
}) => {
    let properties;
    if (plotType === "Bar Chart") {
        properties = Object
            .entries(fields)
            .filter(([name, { data_type, field_type }]) => field_type != "param")
            .map(([name]) => name);
    } else if (plotType === "Histogram") {
        properties = Object
            .entries(fields)
            .filter(([name, { data_type, field_type }]) => field_type != "param" && (data_type === "float" || data_type === "int" || data_type === "timestamp"))
            .map(([name]) => name);
    } else {
        properties = Object
            .entries(fields)
            .filter(([name, { data_type, field_type }]) => field_type != "param" && (data_type === "float" || data_type === "int"))
            .map(([name]) => name);
    }
    const choices = 
        axis === "X" 
          ? plotType === "Line Chart" 
            ? ["Log Time"].concat(properties) 
            : properties
          : plotType === "Bar Chart"
            ? metrics
            : properties ;
    return (
        <BaseDropdown
            button={
                <ActionButton 
                    tooltip="Select property" 
                    icon={<ChevronDown/>}
                    text={axisProperty ? axisProperty : `${axis}-axis`} 
                />
            }
        >
            {choices.map((property, index) => {
                return (
                    <DropdownMenuItem key={index} onSelect={() => setAxisProperty(property)}>
                        {property}
                    </DropdownMenuItem>
                );
            })
          }
        </BaseDropdown>
    )
}

export default PlotAxis;
