"use client";

import { useEffect, useState } from "react";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import ActionButton from "@/components/Common/Buttons/Action";
import { DropdownMenuItem } from "@/components/UI/dropdown-menu";
import { metrics } from "@/constants/logs";
import { ChevronDown, LoaderCircle } from "lucide-react";
import { LogProps, LogFieldsResponseProps } from "@/types/evals/logs";

const PlotAxis = ({fields, axisProperty, setAxisProperty, axis, plotType, logs}: {
    fields: LogFieldsResponseProps,
    axisProperty: string | null,
    setAxisProperty: (x: string | null) => void,
    axis: string,
    plotType: string,
    logs: LogProps[] | undefined
}) => {

    /* Display loader when data updates */
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        setLoading(false);
    },[logs])

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
    const onSelect = (property: string) => {
        setAxisProperty(property)
        setLoading(true)
    }
    return (
        <BaseDropdown
            button={
                <ActionButton 
                    tooltip="Select property" 
                    icon={loading ? <LoaderCircle className="animate-spin text-green"/> : <ChevronDown/>}
                    text={axisProperty ? axisProperty : `${axis}-axis`} 
                    disabled={loading}
                />
            }
        >
            {choices.map((property, index) => {
                return (
                    <DropdownMenuItem key={index} onSelect={() => onSelect(property)}>
                        {property}
                    </DropdownMenuItem>
                );
            })
          }
        </BaseDropdown>
    )
}

export default PlotAxis;
