"use client";

import BaseDropdown from "@/components/Common/Dropdowns/Base";
import { DropdownMenuItem } from "@/components/UI/dropdown-menu";
import ActionButton from "@/components/Common/Buttons/Action";
import { ChevronDown } from "lucide-react";
import { Dispatch, SetStateAction } from "react";

const PlotType = ({plotType, setPlotType, numericAxisProperties, setSelectedYAxisProperty}: {
    plotType: string, 
    setPlotType: (x: string | null) => void,
    numericAxisProperties: string[],
    setSelectedYAxisProperty: (x: string | null) => void
}) => {
    const onClick = (type: string) => {
        setPlotType(type)
        const selectedYAxisProperty = type === "Bar Chart" ? "count" : numericAxisProperties[0];
        setSelectedYAxisProperty(selectedYAxisProperty)
    } 
    return (
        <BaseDropdown
            button={
                <ActionButton 
                    text={plotType}
                    icon={<ChevronDown/>}
                    tooltip="Plot type"
                />
            }
            label="Select plot type"
        >
        {
            ["Scatter Plot", "Line Chart", "Bar Chart"].map((property, index) => {
                return (
                    <DropdownMenuItem key={index} onClick={() => onClick(property)}>
                        {property}
                    </DropdownMenuItem>
                );
            })
        }
        </BaseDropdown>
    );
}

export default PlotType;
