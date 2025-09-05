"use client";
import { useEffect, useState } from "react";
import { metrics } from "@/constants/logs";
import { LoaderCircle } from "lucide-react";
import { LogProps, LogFieldsResponseProps } from "@/types/interfaces/logs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/UI/accordion";
import { Button } from "@/components/UI/button";
import Tooltip from "@/components/Common/Misc/Tooltip";
import { RxBorderBottom, RxBorderLeft } from "react-icons/rx";

const PlotAxis = ({ interactive = true, fields, axisProperty, setAxisProperty, axis, plotType, logs, metric, setMetric }: {
    interactive: boolean
    logs: LogProps[] | undefined,
    fields: LogFieldsResponseProps,
    plotType: string,
    axis: string,
    axisProperty: string | undefined,
    metric: string,
    setAxisProperty: ((x: string | undefined) => void) | undefined,
    setMetric: ((metric: string) => void) | undefined
}) => {

    
    /* Display loader when data updates */
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        setLoading(false);
    }, [logs]);
    
    // Don't render Y axis selector for Histogram
    if (plotType === "Histogram" && axis === "Y") {
        return null;
    }

    /* Available options */
    let properties: string[];
    if (plotType === "Bar Chart") {
        properties = Object
            .entries(fields)
         .map(([name]) => name);
    } else if (plotType === "Histogram" || plotType === "Line Chart" || "Scatter Plot") {
        properties = Object
            .entries(fields)
            .filter(([name, { data_type, field_type }]) => (data_type === "float" || data_type === "int" || data_type === "timestamp" || data_type === "time" || data_type === "timedelta" || data_type === "date" || data_type === "bool"))
               .map(([name]) => name);
        } else {
        properties = Object
            .entries(fields)
            .filter(([name, { data_type, field_type }]) => (data_type === "float" || data_type === "int"))
         .map(([name]) => name);
     }
    const choices = properties.reduce((acc: {[key: string]: string[]}, item) => {
          const [table, column] = item.split(".");
              acc[table] = acc[table] || [];
              acc[table].push(column);
          return acc;
    }, {}) as {[key: string]: string[]};

    /* Selection handler */
    const onSelect = (table: string, column: string, metricSelection?: string) => {

        if (!interactive || !setAxisProperty || !setMetric) return;

        const selection = `${table}.${column}`;
        setLoading(true);

        if (plotType === "Bar Chart" && axis === "Y" && metricSelection) {
        if (selection === axisProperty && metricSelection === metric) {
            setAxisProperty(undefined);
            setMetric("mean");
        } else {
            setAxisProperty(selection);
            setMetric(metricSelection);
        }
        } else {
        if (selection === axisProperty) {
            setAxisProperty(undefined);
        } else {
            setAxisProperty(selection);
        }
        }
    };

    // Determine text for the trigger
    const triggerText = () => {
        if (!axisProperty) return `${axis}-axis`;
        if (plotType === "Bar Chart" && axis === "Y") {
        return `${axis}-axis: ${axisProperty} (${metric})`;
        }
        return `${axis}-axis: ${axisProperty}`;
    };

    return (
        <AccordionItem
            value={`axis-${axis.toLowerCase()}`}
            disabled={loading || !interactive}
        >
        <AccordionTrigger disabled={loading || !interactive}>
            <Tooltip content="Axes values reflect filters applied by the source table." side="left">
                <div className="flex flex-row items-center gap-2">
                    {loading 
                        ? <LoaderCircle className="animate-spin" size={20} /> 
                        : axis === "X" ? <RxBorderBottom size={20}/> : <RxBorderLeft size={20}/> 
                    }
                    {triggerText()}
                </div>
            </Tooltip>
        </AccordionTrigger>
        <AccordionContent>
            <div className="max-h-60 overflow-y-auto command-scrollbar pr-2 space-y-1">
            {/* Outer Accordion for Tables */}
            <Accordion type="multiple" className="w-full">
                {Object.entries(choices).map(([table, columns]) => (
                <AccordionItem key={table} value={table} className="border-b-0">
                    {/* Table Name Trigger */}
                    <AccordionTrigger
                    className="text-label text-muted-foreground hover:no-underline justify-start py-1 px-1"
                    disabled={loading || !interactive}
                    >
                    {table}
                    </AccordionTrigger>
                    {/* Content: Columns (or nested accordion for Bar Y) */}
                    <AccordionContent className="pl-3 pb-1 space-y-1">
                    {columns.map((column) => {
                        const selection = `${table}.${column}`;

                        // For Bar Chart Y-axis, show metric options within a nested accordion
                        if (plotType === "Bar Chart" && axis === "Y") {
                        return (
                            // Inner Accordion for Metrics per Column
                            <Accordion
                            key={column}
                            type="single"
                            collapsible
                            className="w-full"
                            >
                            <AccordionItem value={`${table}-${column}`} className="border-b-0">
                                {/* Column Name Trigger (for metrics) */}
                                <AccordionTrigger
                                className={`py-1 px-2 justify-start hover:no-underline rounded ${
                                    selection === axisProperty
                                    ? "bg-primary/10 text-primary" // Highlight if this column is selected
                                    : "hover:bg-muted"
                                }`}
                                disabled={loading || !interactive}
                                >
                                    <span className="text-md">{column}</span>
                                </AccordionTrigger>
                                {/* Content: Metric Buttons */}
                                <AccordionContent className="pl-4 pb-1 pr-1">
                                <ul className="list-none p-0 m-0 space-y-1">
                                    {metrics.map((m) => (
                                    <li key={m}>
                                        <Button
                                        variant={
                                            selection === axisProperty && m === metric
                                            ? "primary"
                                            : "list_item"
                                        }
                                        size="lg"
                                        className="w-full justify-start h-auto py-1 text-md"
                                        onClick={() => onSelect(table, column, m)}
                                        disabled={loading || !interactive}
                                        >
                                        ({m})
                                        </Button>
                                    </li>
                                    ))}
                                </ul>
                                </AccordionContent>
                            </AccordionItem>
                            </Accordion>
                        );
                        }
                        // Standard selection Button for other plot types/axes
                        else {
                        return (
                            <Button
                            key={column}
                            variant={
                                selection === axisProperty ? "primary" : "list_item"
                            }
                            size="lg"
                            className="w-full justify-start h-auto py-1 text-md"
                            onClick={() => onSelect(table, column)}
                            disabled={loading || !interactive}
                            >
                            {column}
                            </Button>
                        );
                        }
                    })}
                    </AccordionContent>
                </AccordionItem>
                ))}
            </Accordion>

            {/* Fallback if no property */}
            {properties.length === 0 && (
                <p className="text-md text-muted-foreground px-2 py-1">
                No suitable properties found for {axis}-axis.
                </p>
            )}
            </div>
        </AccordionContent>
        </AccordionItem>
    );
};

export default PlotAxis;