"use client";
import React, { useState, useMemo, useCallback } from "react";
import { Span } from "@/types/evals/traces";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/UI/popover";
import { Accordion } from "@/components/UI/accordion";
import { BarChart, Bar, CartesianGrid, XAxis, YAxis } from "recharts";
import { GanttChart, FoldVertical, UnfoldVertical } from "lucide-react";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/UI/chart";

import ActionButton from "@/components/Common/Buttons/Action";
import SingleSpanItem from "./SingleSpanItem";
import { unifyTracesForChart } from "./unify";

/**
 * Recursively collects all .id fields from root spans plus their child_spans
 * to enable "Expand All" / "Collapse All."
 */
function collectAllSpanIds(spans: Span[]): string[] {
  let ids: string[] = [];
  for (const span of spans) {
    ids.push(span.id);
    if (span.child_spans?.length) {
      ids = ids.concat(collectAllSpanIds(span.child_spans));
    }
  }
  return ids;
}

interface SingleTraceViewProps {
  spans: Span[];
}

export default function SingleTraceView({ spans }: SingleTraceViewProps) {
  // Timeline popover state
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Recharts data for timeline
  const chartData = unifyTracesForChart([spans]);

  // Gather all IDs for "Expand All"
  const allSpanIds = useMemo(() => collectAllSpanIds(spans), [spans]);

  // Currently expanded accordion items
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // Check if everything is expanded
  const everythingExpanded = expandedItems.length === allSpanIds.length;

  // Toggle fully open/closed
  const handleToggleAll = useCallback(() => {
    if (everythingExpanded) {
      setExpandedItems([]);
    } else {
      setExpandedItems(allSpanIds);
    }
  }, [everythingExpanded, allSpanIds]);

  return (
    <div className="space-y-3">
      {/* Timeline Popover & Expand/Collapse Button */}
      <div className="flex justify-end">
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger>
            <ActionButton
              variant="ghost"
              size="icon"
              tooltip="Show Timeline"
              icon={<GanttChart />}
              onClick={() => setPopoverOpen(true)}
            />
          </PopoverTrigger>
          <PopoverContent className="w-fit h-fit p-4">
            <p className="font-medium text-sm mb-2">Timeline View</p>
            <ChartContainer config={{}} className="min-h-[300px] w-full">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ left: 100, right: 30, top: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <YAxis
                  dataKey="label"
                  type="category"
                  tickLine={false}
                  axisLine={false}
                  width={100}
                />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  domain={[0, "dataMax+1"]}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar
                  dataKey="start-0"
                  stackId="range-0"
                  fill="transparent"
                  radius={[8, 8, 8, 8]}
                />
                <Bar
                  dataKey="length-0"
                  stackId="range-0"
                  fill="#9333ea"
                  name="Single Trace"
                />
              </BarChart>
            </ChartContainer>
          </PopoverContent>
        </Popover>

        <div className="ml-auto flex items-center gap-2">
          <ActionButton
            tooltip={everythingExpanded ? "Collapse All" : "Expand All"}
            icon={
              everythingExpanded ? (
                <FoldVertical className="h-4 w-4" />
              ) : (
                <UnfoldVertical className="h-4 w-4" />
              )
            }
            onClick={handleToggleAll}
            variant="ghost"
            size="icon"
          />
        </div>
      </div>

      {/* Single top-level Accordion controlling all nesting. */}
      <Accordion
        type="multiple"
        value={expandedItems}
        onValueChange={setExpandedItems}
        className="space-y-2"
      >
        {spans.map((rootSpan) => (
          <SingleSpanItem key={rootSpan.id} span={rootSpan} depth={0} />
        ))}
      </Accordion>
    </div>
  );
}