"use client";
import { useEffect, useState } from "react";
import { Sigma, LoaderCircle, Workflow } from "lucide-react";
import { LogProps } from "@/types/evals/logs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/UI/accordion";
import { Button } from "@/components/UI/button";
import Tooltip from "@/components/Common/Misc/Tooltip";

const PlotAggregate = ({
  interactive = true,
  plotType,
  groupings,
  isAggregated,
  setIsAggregated,
  logs,
}: {
  interactive?: boolean;
  plotType: string;
  groupings: { [key: string]: string[] };
  isAggregated: string | undefined;
  setIsAggregated: ((x: string | undefined) => void) | undefined;
  logs: LogProps[] | undefined;
}) => {

  // Only render aggregation selector if at least one table has group by applied
  if (!Object.values(groupings).length) {
    return null;
  }

  /* Display loader when data updates */
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setLoading(false);
  }, [logs]);

  /* Available options */
  const choices = { ...groupings };

  /* Selection handler */
  const onSelect = (selection: string | undefined) => {
    if (!interactive || !setIsAggregated) return;
    setLoading(true);
    setIsAggregated(selection === isAggregated ? undefined : selection);
  };

  const hasChoices = Object.keys(choices).length > 0;

  return (
    <AccordionItem value="plot-aggregate" disabled={loading || !interactive}>
      <AccordionTrigger disabled={loading || !interactive}>
        <Tooltip content="Use aggregate metrics as data points." side="left">
          <div className="flex items-center gap-2">
            {loading ? <LoaderCircle className="animate-spin" size={20} /> : <Sigma size={20} />}
            {`Aggregate: ${isAggregated ?? ""}`}
          </div>
        </Tooltip>
      </AccordionTrigger>
      <AccordionContent>
        <div className="max-h-60 overflow-y-auto pr-2 space-y-1">
           {/* Button for "None" option */}
           <Button
             key="none-aggregate"
             variant={!isAggregated ? "primary" : "list_item"}
             size="lg"
             className="w-full justify-start h-auto py-1 text-md"
             onClick={() => onSelect(undefined)}
             disabled={loading || !interactive}
           >
             None
           </Button>

          {/* Accordion for Tables */}
          {hasChoices && (
            <Accordion type="multiple" className="w-full">
                {Object.entries(choices).map(([table, columns]) => (
                <AccordionItem key={`aggregate-${table}`} value={`aggregate-${table}`} className="border-b-0">
                    {/* Table Name Trigger */}
                    <AccordionTrigger
                      className="text-md font-semibold text-muted-foreground hover:no-underline justify-start py-1 px-1"
                      disabled={loading || !interactive}
                    >
                      {table}
                    </AccordionTrigger>
                    {/* Content: Columns */}
                    <AccordionContent className="pl-3 pb-1 space-y-1">
                    {columns.map((column, index) => {
                        const selection = `${table}.${column}`;
                        return (
                        <Button
                            key={selection}
                            variant={selection === isAggregated ? "primary" : "list_item"}
                            size="lg"
                            className="flex flex-row gap-2 items-center w-full justify-start h-auto py-1 text-md"
                            onClick={() => onSelect(selection)}
                            disabled={loading || !interactive}
                        >
                            {index != 0 && <Workflow/>}
                            {column}
                        </Button>
                        );
                    })}
                    </AccordionContent>
                </AccordionItem>
                ))}
            </Accordion>
            )}

          {/* Fallback if no property */}
          {!hasChoices && (
            <p className="text-md text-muted-foreground px-2 py-1">
              No properties available for aggregation.
            </p>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

export default PlotAggregate;