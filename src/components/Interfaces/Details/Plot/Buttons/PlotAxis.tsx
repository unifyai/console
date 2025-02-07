"use client";

import { useEffect, useState } from "react";
import { metrics } from "@/constants/logs";
import { LoaderCircle } from "lucide-react";
import { LogProps, LogFieldsResponseProps } from "@/types/evals/logs";
import AutoComplete from "@/components/Common/Misc/AutoComplete";

const PlotAxis = ({ interactive, fields, axisProperty, setAxisProperty, axis, plotType, logs }: {
    interactive: boolean
    fields: LogFieldsResponseProps,
    axisProperty: string | undefined,
    setAxisProperty: (x: string | undefined) => void,
    axis: string,
    plotType: string,
    logs: LogProps[] | undefined
}) => {

    /* Display loader when data updates */
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        setLoading(false);
    }, [logs])

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
                : properties;
    const onSelect = (property: string) => {
        setAxisProperty(property)
        setLoading(true)
    }
    return (
        (interactive && !loading) ? <AutoComplete
            type={`${axis}-axis`}
            items={choices.map((choice) => ({ label: choice, value: choice }))}
            defaultValue={axisProperty}
            onSelect={(currentValue: string) => onSelect(currentValue)}
            className="h-7 mx-1 text-xs w-[150px] shadow-none"
        /> : <div className="flex items-center justify-between h-7 mx-1 px-3 text-xs font-medium w-[150px] rounded-md truncate ... border border-1 shadow-none">
            {axisProperty ? axisProperty.slice(0, loading ? 15 : 18) + (axisProperty.length > (loading ? 15 : 18) ? "..." : "") : `${axis}-axis`}
            {loading && <LoaderCircle size={16} className="animate-spin text-primary" />}
        </div>
    );
}

export default PlotAxis;
