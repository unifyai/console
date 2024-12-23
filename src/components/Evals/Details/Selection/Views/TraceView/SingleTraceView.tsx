"use client";
import React, { useState } from "react";
import { Span } from "@/types/evals/traces";
import { Button } from "@/components/UI/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/UI/popover";
import { Accordion } from "@/components/UI/accordion";
import { BarChart, Bar, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  GanttChart,
} from "lucide-react";

import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/UI/chart";
import { unifyTracesForChart } from "./unify";
import SingleSpanItem from "./SingleSpanItem";
import ActionButton from "@/components/Common/Buttons/Action";

/**
 * SingleTraceView: Renders a single set of spans with a timeline popover and
 * an accordion for drilling into each span’s details.
 */
const SingleTraceView: React.FC<{ spans: Span[] }> = ({ spans }) => {
  const [open, setOpen] = useState(false);

  // Prepare data for the timeline chart
  const singleChartData = unifyTracesForChart([spans]); // pass an array of arrays

  return (
    <div className="space-y-3">
      {/* Timeline Popover */}
      <div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger>
            <ActionButton
              variant="ghost"
              size="icon"
              tooltip="Show Timeline"
              icon={<GanttChart />}
              onClick={() => setOpen(true)}
            />
          </PopoverTrigger>
          <PopoverContent className="w-[700px] min-h-[400px] p-4">
            <p className="font-medium text-sm mb-2">Timeline View</p>
            <ChartContainer config={{}} className="min-h-[300px] w-full">
              <BarChart
                data={singleChartData}
                layout="vertical"
                margin={{ left: 100, right: 30, top: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} width={100} />
                <XAxis type="number" tickLine={false} axisLine={false} domain={[0, "dataMax+1"]} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />

                {/* Single trace => i=0 */}
                <Bar dataKey="start-0" stackId="range-0" fill="transparent" radius={[8, 8, 8, 8]} />
                <Bar dataKey="length-0" stackId="range-0" fill="#9333ea" name="Single Trace" />
              </BarChart>
            </ChartContainer>
          </PopoverContent>
        </Popover>
      </div>

      {/* Spans Accordion */}
      <Accordion type="multiple" className="space-y-2">
        {spans.map((span) => (
          <SingleSpanItem key={span.id} span={span} />
        ))}
      </Accordion>
    </div>
  );
};

export default SingleTraceView;