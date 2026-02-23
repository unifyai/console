'use client';
import { useEffect, useState } from 'react';
import { Sigma, LoaderCircle, Workflow } from 'lucide-react';
import { LogProps } from '@/types/interfaces/logs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/UI/accordion';
import { Button } from '@/components/UI/button';
import Tooltip from '@/components/Common/Misc/Tooltip';

const PlotAggregate = ({
  interactive = true,
  plotType,
  groupings,
  aggregateProperty,
  setAggregateProperty,
  logs,
}: {
  interactive?: boolean;
  plotType: string;
  groupings: { [key: string]: string[] };
  aggregateProperty: string | undefined;
  setAggregateProperty: ((x: string | undefined) => void) | undefined;
  logs: LogProps[] | undefined;
}) => {
  /* Display loader when data updates */
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setLoading(false);
  }, [logs]);

  // Only render aggregation selector if at least one table has group by applied
  if (!Object.values(groupings).length) {
    return null;
  }

  /* Available options */
  const choices = { ...groupings };

  /* Selection handler */
  const onSelect = (selection: string | undefined) => {
    if (!interactive || !setAggregateProperty) return;
    setLoading(true);
    setAggregateProperty(selection === aggregateProperty ? undefined : selection);
  };

  const hasChoices = Object.keys(choices).length > 0;

  return (
    <AccordionItem value="plot-aggregate" disabled={loading || !interactive}>
      <AccordionTrigger disabled={loading || !interactive}>
        <Tooltip content="Use aggregate metrics as data points." side="left">
          <div className="flex items-center gap-2">
            {loading ? <LoaderCircle className="animate-spin" size={20} /> : <Sigma size={20} />}
            {`Aggregate: ${aggregateProperty ?? ''}`}
          </div>
        </Tooltip>
      </AccordionTrigger>
      <AccordionContent>
        <div className="command-scrollbar max-h-60 space-y-1 overflow-y-auto pr-2">
          {/* Button for "None" option */}
          <Button
            key="none-aggregate"
            variant={!aggregateProperty ? 'primary' : 'listItem'}
            size="lg"
            className="text-md h-auto w-full justify-start py-1"
            onClick={() => onSelect(undefined)}
            disabled={loading || !interactive}
          >
            None
          </Button>

          {/* Accordion for Tables */}
          {hasChoices && (
            <Accordion type="multiple" className="w-full">
              {Object.entries(choices).map(([table, columns]) => (
                <AccordionItem
                  key={`aggregate-${table}`}
                  value={`aggregate-${table}`}
                  className="border-b-0"
                >
                  {/* Table Name Trigger */}
                  <AccordionTrigger
                    className="text-label justify-start px-1 py-1 text-muted-foreground hover:no-underline"
                    disabled={loading || !interactive}
                  >
                    {table}
                  </AccordionTrigger>
                  {/* Content: Columns */}
                  <AccordionContent className="space-y-1 pb-1 pl-3">
                    {columns.map((column, index) => {
                      const selection = `${table}.${column}`;
                      return (
                        <Button
                          key={selection}
                          variant={selection === aggregateProperty ? 'primary' : 'listItem'}
                          size="lg"
                          className="text-md flex h-auto w-full flex-row items-center justify-start gap-2 py-1"
                          onClick={() => onSelect(selection)}
                          disabled={loading || !interactive}
                        >
                          {index != 0 && <Workflow />}
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
            <p className="text-md px-2 py-1 text-muted-foreground">
              No properties available for aggregation.
            </p>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

export default PlotAggregate;
