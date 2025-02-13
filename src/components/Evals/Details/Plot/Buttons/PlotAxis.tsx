"use client";

import { useEffect, useState } from "react";
import { metrics } from "@/constants/logs";
import { ChevronDown, LoaderCircle } from "lucide-react";
import { LogProps, LogFieldsResponseProps } from "@/types/evals/logs";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import ActionButton from "@/components/Common/Buttons/Action";
import { DropdownMenuItem, DropdownMenuGroup, DropdownMenuSub, DropdownMenuPortal, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/UI/dropdown-menu";

const PlotAxis = ({ fields, axisProperty, setAxisProperty, axis, plotType, logs, metric, setMetric }: {
    fields: LogFieldsResponseProps,
    axisProperty: string | null,
    setAxisProperty: (x: string | null) => void,
    axis: string,
    plotType: string,
    logs: LogProps[] | undefined
    metric: string | null,
    setMetric: (metric: string | null) => void
}) => {

    /* Display loader when data updates */
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        setLoading(false);
    }, [logs])

    /* Available options */
    let properties: string[];
    if (plotType === "Bar Chart") {
        properties = Object
            .entries(fields)
            .filter(([name, { data_type, field_type }]) => field_type != "param")
            .map(([name]) => name);
    } else if (plotType === "Histogram" || plotType === "Line Chart") {
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
    const choices = properties.reduce((acc: {[key: string]: string[]}, item) => {
        const [table, column] = item.split(".");
        acc[table] = acc[table] || [];
        acc[table].push(column);
        return acc;
    }, {}) as {[key: string]: string[]};

    /* Selection handler */
    const onSelect = (selection: string, metric?: string) => {
        if (metric) {
            setAxisProperty(selection)
            setMetric(metric)
        } 
        else {
            setAxisProperty(selection)
        } 
        setLoading(true)
    }

    /* Dropdown button */
    const icon = loading ? <LoaderCircle className="animate-spin text-primary"/> : <ChevronDown/>
    const tooltip = "Select property"
    const text = axisProperty 
        ? (plotType === "Bar Chart" && axis === "Y") ? `${axisProperty}(${metric})` : axisProperty 
        : `${axis}-axis`
    const disabled = loading    
    const button = <ActionButton tooltip={tooltip} icon={icon} text={text} disabled={disabled}/>

    /** Main dropdown component
     * Properties are selected by first navigating to a desired table item to open a sub dropdown with its available fields
     * In the case of bar charts, an extra layer is added to select the metric to compute for the desired Y axis property
    */
    return (
        <BaseDropdown button={button}>
            {Object.entries(choices).map(([table, columns], choiceIndex) => {
                const tableTrigger = <DropdownMenuSubTrigger disabled={loading} className="hover:text-white data-[state=open]:text-white">{table}</DropdownMenuSubTrigger>
                const tableOptions = columns.map((column, optionIndex) => {

                    const selection = `${table}.${column}`

                    if (plotType === "Bar Chart" && axis === "Y") {
                        const metricsTrigger = <DropdownMenuSubTrigger className="hover:text-white data-[state=open]:text-white">{column}</DropdownMenuSubTrigger>
                        const columnOptions = metrics.map((metric, metricIndex) => {
                            return <DropdownMenuItem key={metricIndex} onSelect={() => onSelect(selection, metric)}>{metric}</DropdownMenuItem>
                        }) 
                        return (
                            <DropdownMenuGroup key={optionIndex}> 
                                <DropdownMenuSub>
                                    {metricsTrigger}
                                    <DropdownMenuPortal>
                                        <DropdownMenuSubContent>
                                            {columnOptions}
                                        </DropdownMenuSubContent>
                                    </DropdownMenuPortal>
                                </DropdownMenuSub>
                            </DropdownMenuGroup>
                    )}

                    return <DropdownMenuItem key={optionIndex} onSelect={() => onSelect(selection)}>{column}</DropdownMenuItem>

                })
                return (
                    <DropdownMenuGroup key={choiceIndex}> 
                        <DropdownMenuSub>
                            {tableTrigger}
                            <DropdownMenuPortal>
                                <DropdownMenuSubContent>
                                    {tableOptions}
                                </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                        </DropdownMenuSub>
                    </DropdownMenuGroup>
                )
            })
        }
        </BaseDropdown>
    );
}

export default PlotAxis;
