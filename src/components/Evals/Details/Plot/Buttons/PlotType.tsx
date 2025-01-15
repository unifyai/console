"use client";

import BaseDropdown from "@/components/Common/Dropdowns/Base";
import { DropdownMenuItem } from "@/components/UI/dropdown-menu";
import ActionButton from "@/components/Common/Buttons/Action";
import { ChevronDown } from "lucide-react";
import { Dispatch, SetStateAction } from "react";

const PlotType = ({plotType, setPlotType, numericAxisProperties, selectedYAxisProperty, setSelectedYAxisProperty}: {
    plotType: string, 
    setPlotType: (x: string | null) => void,
    numericAxisProperties: string[],
    selectedYAxisProperty: string | null,
    setSelectedYAxisProperty: (x: string | null) => void
}) => {
    const onClick = (type: string) => {
        setPlotType(type)
        const yAxis = 
            type === "Bar Chart" 
                ? "count" 
                : selectedYAxisProperty && numericAxisProperties.includes(selectedYAxisProperty)
                    ? selectedYAxisProperty
                    : numericAxisProperties[0];
        setSelectedYAxisProperty(yAxis)
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
