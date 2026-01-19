'use client';
import { useEffect, useState } from 'react';
import { metrics } from '@/constants/logs';
import { LoaderCircle } from 'lucide-react';
import { LogProps, LogFieldsResponseProps } from '@/types/interfaces/logs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/UI/accordion';
import { Button } from '@/components/UI/button';
import Tooltip from '@/components/Common/Misc/Tooltip';
import { RxBorderBottom, RxBorderLeft } from 'react-icons/rx';

const PlotAxis = ({
  interactive = true,
  fields,
  axisProperty,
  setAxisProperty,
  axis,
  plotType,
  logs,
  metric,
  setMetric,
}: {
  interactive: boolean;
  logs: LogProps[] | undefined;
  fields: LogFieldsResponseProps;
  plotType: string;
  axis: string;
  axisProperty: string | undefined;
  metric: string;
  setAxisProperty: ((x: string | undefined) => void) | undefined;
  setMetric: ((metric: string) => void) | undefined;
}) => {
  /* Display loader when data updates */
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setLoading(false);
  }, [logs]);

  // Don't render Y axis selector for Histogram
  if (plotType === 'Histogram' && axis === 'Y') {
    return null;
  }

  /* Available options */
  let properties: string[];
  if (plotType === 'Bar Chart') {
    properties = Object.entries(fields || {}).map(([name]) => name);
  } else if (plotType === 'Histogram' || plotType === 'Line Chart' || 'Scatter Plot') {
    properties = Object.entries(fields || {})
      .filter(
        ([name, { dataType, fieldType }]) =>
          dataType === 'float' ||
          dataType === 'int' ||
          dataType === 'timestamp' ||
          dataType === 'time' ||
          dataType === 'timedelta' ||
          dataType === 'date' ||
          dataType === 'bool'
      )
      .map(([name]) => name);
  } else {
    properties = Object.entries(fields || {})
      .filter(([name, { dataType, fieldType }]) => dataType === 'float' || dataType === 'int')
      .map(([name]) => name);
  }
  const choices = properties.reduce((acc: { [key: string]: string[] }, item) => {
    const [table, column] = item.split('.');
    acc[table] = acc[table] || [];
    acc[table].push(column);
    return acc;
  }, {}) as { [key: string]: string[] };

  /* Selection handler */
  const onSelect = (table: string, column: string, metricSelection?: string) => {
    if (!interactive || !setAxisProperty || !setMetric) return;

    const selection = `${table}.${column}`;
    setLoading(true);

    if (plotType === 'Bar Chart' && axis === 'Y' && metricSelection) {
      if (selection === axisProperty && metricSelection === metric) {
        setAxisProperty(undefined);
        setMetric('mean');
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
    if (plotType === 'Bar Chart' && axis === 'Y') {
      return `${axis}-axis: ${axisProperty} (${metric})`;
    }
    return `${axis}-axis: ${axisProperty}`;
  };

  return (
    <AccordionItem value={`axis-${axis.toLowerCase()}`} disabled={loading || !interactive}>
      <AccordionTrigger disabled={loading || !interactive}>
        <Tooltip content="Axes values reflect filters applied by the source table." side="left">
          <div className="flex flex-row items-center gap-2">
            {loading ? (
              <LoaderCircle className="animate-spin" size={20} />
            ) : axis === 'X' ? (
              <RxBorderBottom size={20} />
            ) : (
              <RxBorderLeft size={20} />
            )}
            {triggerText()}
          </div>
        </Tooltip>
      </AccordionTrigger>
      <AccordionContent>
        <div className="command-scrollbar max-h-60 space-y-1 overflow-y-auto pr-2">
          {/* Outer Accordion for Tables */}
          <Accordion type="multiple" className="w-full">
            {Object.entries(choices).map(([table, columns]) => (
              <AccordionItem key={table} value={table} className="border-b-0">
                {/* Table Name Trigger */}
                <AccordionTrigger
                  className="text-label justify-start px-1 py-1 text-muted-foreground hover:no-underline"
                  disabled={loading || !interactive}
                >
                  {table}
                </AccordionTrigger>
                {/* Content: Columns (or nested accordion for Bar Y) */}
                <AccordionContent className="space-y-1 pb-1 pl-3">
                  {columns.map((column) => {
                    const selection = `${table}.${column}`;

                    // For Bar Chart Y-axis, show metric options within a nested accordion
                    if (plotType === 'Bar Chart' && axis === 'Y') {
                      return (
                        // Inner Accordion for Metrics per Column
                        <Accordion key={column} type="single" collapsible className="w-full">
                          <AccordionItem value={`${table}-${column}`} className="border-b-0">
                            {/* Column Name Trigger (for metrics) */}
                            <AccordionTrigger
                              className={`justify-start rounded px-2 py-1 hover:no-underline ${
                                selection === axisProperty
                                  ? 'bg-primary/10 text-primary' // Highlight if this column is selected
                                  : 'hover:bg-muted'
                              }`}
                              disabled={loading || !interactive}
                            >
                              <span className="text-md">{column}</span>
                            </AccordionTrigger>
                            {/* Content: Metric Buttons */}
                            <AccordionContent className="pb-1 pl-4 pr-1">
                              <ul className="m-0 list-none space-y-1 p-0">
                                {metrics.map((m) => (
                                  <li key={m}>
                                    <Button
                                      variant={
                                        selection === axisProperty && m === metric
                                          ? 'primary'
                                          : 'listItem'
                                      }
                                      size="lg"
                                      className="text-md h-auto w-full justify-start py-1"
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
                          variant={selection === axisProperty ? 'primary' : 'listItem'}
                          size="lg"
                          className="text-md h-auto w-full justify-start py-1"
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
            <p className="text-md px-2 py-1 text-muted-foreground">
              No suitable properties found for {axis}-axis.
            </p>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

export default PlotAxis;
