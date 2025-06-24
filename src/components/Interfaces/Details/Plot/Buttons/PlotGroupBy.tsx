"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { LogProps, LogFieldsResponseProps } from "@/types/evals/logs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/UI/accordion";
import { Button } from "@/components/UI/button";
import { BiCategoryAlt } from "react-icons/bi";
import Tooltip from "@/components/Common/Misc/Tooltip";

const PlotGroupBy = ({
  interactive = true,
  fields,
  groupBy,
  setGroupBy,
  logs,
  plotType
}: {
  interactive?: boolean;
  fields: LogFieldsResponseProps;
  groupBy: string | undefined;
  setGroupBy: ((x: string | undefined) => void) | undefined;
  logs: LogProps[] | undefined;
  plotType: string;
}) => {

    /* Display loader when data updates */
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        setLoading(false);
    }, [logs]);

    /* Available options */
    const properties = Object
        .entries(fields)
        .map(([name]) => name);
    const options = properties.reduce((acc: { [key: string]: string[] }, item) => {
        const [table, column] = item.split(".");
            if (table && column) {
                acc[table] = acc[table] || [];
                acc[table].push(column);
        }
        return acc;
        }, {}) as { [key: string]: string[] };
        
    /* Selection handler */
    const onSelect = (selection: string | undefined) => {
        if (!interactive || !setGroupBy) return;
        setLoading(true);
        setGroupBy(selection === groupBy ? undefined : selection);
    };

    return (
        <AccordionItem value="plot-group-by" disabled={loading || !interactive}>
        <AccordionTrigger disabled={loading || !interactive}>
            <Tooltip content="Assign a different color to data points based on the grouping field." side="left">
                <div className="flex flex-row items-center gap-2">
                    {loading ? <LoaderCircle className="animate-spin" size={20} /> : <BiCategoryAlt size={20}/>}
                    {`Group: ${groupBy ?? ""}`}
                </div>
            </Tooltip>
        </AccordionTrigger>
        <AccordionContent>
            <div className="max-h-60 overflow-y-auto command-scrollbar pr-2 space-y-1">
            {/* Button for "None" option */}
            <Button
                key="none-group-by"
                variant={!groupBy ? "primary" : "list_item"}
                size="lg"
                className="w-full justify-start h-auto py-1 text-md"
                onClick={() => onSelect(undefined)} // Select undefined for "None"
                disabled={loading || !interactive}
            >
                None
            </Button>

            {/* Accordion for Tables */}
            <Accordion type="multiple" className="w-full">
                {Object.entries(options).map(([table, columns]) => (
                <AccordionItem key={table} value={`group-${table}`} className="border-b-0">
                    {/* Table Name Trigger */}
                    <AccordionTrigger
                        className="text-md font-semibold text-muted-foreground hover:no-underline justify-start py-1 px-1"
                        disabled={loading || !interactive}
                    >
                    {table}
                    </AccordionTrigger>
                    {/* Content: Columns */}
                    <AccordionContent className="pl-3 pb-1 space-y-1">
                    {columns.map((column) => {
                        const selection = `${table}.${column}`;
                        return (
                            <Button
                                key={selection}
                                variant={selection === groupBy ? "primary" : "list_item"}
                                size="lg"
                                className="w-full justify-start h-auto py-1 text-md"
                                onClick={() => onSelect(selection)}
                                disabled={loading || !interactive}
                            >
                                {column}
                            </Button>
                        );
                    })}
                    </AccordionContent>
                </AccordionItem>
                ))}
            </Accordion>

            {/* Fallback if no property */}
            {properties.length === 0 && (
                <p className="text-md text-muted-foreground px-2 py-1">
                    No properties available for grouping.
                </p>
            )}
            </div>
        </AccordionContent>
        </AccordionItem>
    );
};

export default PlotGroupBy;