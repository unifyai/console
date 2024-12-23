"use client";
import React, { useState } from "react";
import { Span } from "@/types/evals/traces";
import { Button } from "@/components/UI/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/UI/popover";
import { GanttChart, FoldVertical, UnfoldVertical, FileText, CaseLower, Pilcrow, Columns, AlignJustify } from "lucide-react";
import { BarChart, Bar, CartesianGrid, XAxis, YAxis } from "recharts";
import { Accordion } from "@/components/UI/accordion";

import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/UI/chart";
import { ExpandAllProvider } from "./ExpandAllContext";
import { unifyByName, unifyTracesForChart, colorPalette } from "./unify";
import MergedSpanItem from "./MergedSpanItem";

/**
 * MultiTraceView: merges multiple arrays of spans, shows combined timeline,
 * plus an “expand all” toggle and diff mode toggles. Each merged span is
 * rendered via MergedSpanItem.
 */
const MultiTraceView: React.FC<{
  allTraces: Span[][];
  rowIndexes: number[];
}> = ({ allTraces, rowIndexes }) => {
  // Merge for diffs
  const mergedRoots = unifyByName(allTraces);

  // Diff mode toggling
  type DiffMode = "lines" | "words" | "characters";
  const modes: DiffMode[] = ["lines", "words", "characters"];
  const modeIcons = [<FileText key="lines"/>, <CaseLower key="words"/>, <Pilcrow key="chars"/>];
  const [modeIndex, setModeIndex] = useState(0);
  const diffMode = modes[modeIndex];
  const [splitView, setSplitView] = useState(true);

  const handleCycleMode = () => setModeIndex((prev) => (prev + 1) % modes.length);
  const handleToggleSplit = () => setSplitView((prev) => !prev);

  // Combined timeline
  const combinedData = unifyTracesForChart(allTraces);
  const [openChart, setOpenChart] = useState(false);

  // Expand/Collapse all
  const [expandAll, setExpandAll] = useState(false);
  const [toggleCounter, setToggleCounter] = useState(0);
  const handleToggleExpand = () => {
    setExpandAll(!expandAll);
    setToggleCounter((c) => c + 1);
  };
  const isExpanded = expandAll;

  return (
    <ExpandAllProvider expandAll={expandAll} toggleCounter={toggleCounter}>
      <div className="space-y-4">
        {/* Toolbar row */}
        <div className="flex items-center gap-2">
          {/* Combined Timeline popover */}
          <Popover open={openChart} onOpenChange={setOpenChart}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm">
                <GanttChart className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[700px] min-h-[400px] p-4">
              <p className="font-medium text-sm mb-2">Combined Timeline</p>
              <ChartContainer config={{}} className="min-h-[300px] w-fit">
                <BarChart
                  data={combinedData}
                  layout="vertical"
                  margin={{ left: 100, right: 30, top: 10, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} width={100} />
                  <XAxis type="number" tickLine={false} axisLine={false} domain={[0, "dataMax+1"]} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />

                  {allTraces.map((_, i) => {
                    const color = colorPalette[i % colorPalette.length];
                    return (
                      <React.Fragment key={i}>
                        <Bar dataKey={`start-${i}`} stackId={`range-${i}`} fill="transparent" radius={[8,8,8,8]} />
                        <Bar dataKey={`length-${i}`} stackId={`range-${i}`} fill={color} name={`Trace row ${rowIndexes[i]}`} />
                      </React.Fragment>
                    );
                  })}
                </BarChart>
              </ChartContainer>
            </PopoverContent>
          </Popover>

          {/* Diff mode toggles (on right) */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Expand/collapse all */}
            <Button variant="ghost" size="icon" onClick={handleToggleExpand}>
              {isExpanded ? <FoldVertical className="h-4 w-4" /> : <UnfoldVertical className="h-4 w-4" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleCycleMode}
              title={`Cycle diff mode (current: ${diffMode})`}
            >
              {modeIcons[modeIndex]}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggleSplit}
              title={splitView ? "Switch to Inline View" : "Switch to Split View"}
            >
              {splitView ? <Columns /> : <AlignJustify />}
            </Button>
          </div>
        </div>

        {/* Merged spans => structured diffs */}
        <Accordion type="multiple" className="space-y-2">
          {mergedRoots.map((mSpan, i) => (
            <MergedSpanItem
              key={i}
              merged={mSpan}
              rowIndexes={rowIndexes}
              diffMode={diffMode}
              splitView={splitView}
            />
          ))}
        </Accordion>
      </div>
    </ExpandAllProvider>
  );
};

export default MultiTraceView;