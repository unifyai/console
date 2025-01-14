"use client";

import BaseDropdown from "@/components/Common/Dropdowns/Base";
import ActionButton from "@/components/Common/Buttons/Action";
import { Dispatch, SetStateAction } from "react";
import { DropdownMenuItem } from "@/components/UI/dropdown-menu";
import { metrics } from "@/constants/logs";
import { ChevronDown } from "lucide-react";

const PlotAxis = ({properties, axisProperty, setAxisProperty, axis, plotType}: {
    properties: string[],
    axisProperty: string | undefined,
    setAxisProperty: (x: string | undefined) => void,
    axis: string,
    plotType: string
}) => {
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
            label="Select an axis property"
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
