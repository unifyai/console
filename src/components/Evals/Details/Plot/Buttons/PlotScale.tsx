"use client";

import SettingButton from "@/components/Common/Buttons/Setting";
import ActionButton from "@/components/Common/Buttons/Action";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import { DropdownMenuItem } from "@/components/UI/dropdown-menu";
import { ChevronDown, ChartLine } from "lucide-react";
import { LogFieldsResponseProps } from "@/types/evals/logs";

const PlotScale = ({scaleX, scaleY, setScaleX, setScaleY, logScaleXEnabled, logScaleYEnabled, selectedXAxisProperty, fields}: {
    scaleX: string, 
    scaleY: string,
    setScaleX: (x: string | null) => void,
    setScaleY: (y: string | null) => void,
    selectedXAxisProperty: string | null,
    fields: LogFieldsResponseProps,
    logScaleXEnabled: boolean,
    logScaleYEnabled: boolean
}) => {

    // Check available options depending on data type and values
    let [optionsY, optionsX] = [["linear"], ["linear"]]
    if (logScaleYEnabled) optionsY.push("log")
    if (selectedXAxisProperty && fields[selectedXAxisProperty] && !["float", "int"].includes(fields[selectedXAxisProperty].data_type))
        console.log("X axis non numeric. Cannot set logarithmic scale.")
    else
        if (logScaleXEnabled) optionsX.push("log")

    // Axis selector
    const selector = (axis: "X" | "Y") => {

        // Handle X or Y Axis
        const scale = axis === "X" ? scaleX : scaleY;
        const setScale = axis === "X" ? setScaleX : setScaleY;
        const options = axis === "X" ? optionsX : optionsY;
        
        // Display dropdown or static text depending on length of options list
        const disabled = options.length === 1;
        const icon = disabled ? null : <ChevronDown/>
        const tooltip = disabled ? `Log scale not available for ${axis} data range`: `Select ${axis} axis scale`
        const button = <ActionButton tooltip={tooltip} icon={icon} text={scale} disabled={disabled}/>;
        const open = disabled ? false : undefined
        const choices =
            <BaseDropdown button={button} open={open}>
                {options.map((option: string, index: number) => <DropdownMenuItem key={index} onSelect={() => setScale(option)}>{option}</DropdownMenuItem>)}
            </BaseDropdown>
        
        return (choices);
    }

    // Main component
    const button = <SettingButton tooltip={"Set axes scales"} icon={<ChartLine/>}/>
    return (
        <BaseDropdown button={button}>
            <div className="flex flex-col gap-3 p-2">
                <div className="flex flex-row justify-between gap-3 items-center">
                    <p className="font-bold text-sm">X Axis</p>
                    {selector("X")}
                </div>
                <div className="flex flex-row justify-between gap-3 items-center">
                    <p className="font-bold text-sm">Y Axis</p>
                    {selector("Y")}
                </div>
            </div>
        </BaseDropdown>
    );
}

export default PlotScale