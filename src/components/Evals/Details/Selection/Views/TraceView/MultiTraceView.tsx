"use client";
import React, { useState, useMemo, useCallback } from "react";
import { Span } from "@/types/evals/traces";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/UI/popover";
import {
  Accordion
} from "@/components/UI/accordion";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis
} from "recharts";
import {
  GanttChart,
  FoldVertical,
  UnfoldVertical,
  FileText,
  CaseLower,
  Pilcrow,
  Columns,
  AlignJustify
} from "lucide-react";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent
} from "@/components/UI/chart";

import ActionButton from "@/components/Common/Buttons/Action";
import { unifyByName, unifyTracesForChart, colorPalette } from "./unify";
import MergedSpanItem, { MergedSpan } from "./MergedSpanItem";

/**
 * Collect all Accordion item IDs from root merges plus their children,
 * including the sub-field keys (offset-, execTime-, errors-, inputs-, outputs-),
 * so “Expand/Collapse All” will open every item.
 */
function collectAllMergedSpanIds(mergedRoots: MergedSpan[]): string[] {
  const ids: string[] = [];

  function recurse(ms: MergedSpan) {
    // The main ID for this merged span
    const mainId = `${ms.spanName}-${ms.baseSpan?.id ?? "no-base"}`;
    ids.push(mainId);

    // Gather standard sub-field IDs matching what's in MergedSpanItem
    const fieldKeys = [
      `offset-${mainId}`,
      `execTime-${mainId}`,
      `inputs-${mainId}`,
      `outputs-${mainId}`,
    ];

    const hasErrors = ms.baseSpan?.errors || ms.comparableSpans.some(c => c?.errors);
    if (hasErrors) {
      fieldKeys.push(`errors-${mainId}`);
    }
    ids.push(...fieldKeys);

    // Recurse children
    if (ms.children && ms.children.length > 0) {
      ms.children.forEach(recurse);
    }
  }

  mergedRoots.forEach(recurse);
  return ids;
}

/**
 * MultiTraceView merges multiple trace arrays for side-by-side diffs,
 * shows a combined timeline, and houses a single top-level Accordion
 * to control “Expand/Collapse All” across merges.
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
  const modeIcons = [
    <FileText key="lines"/>,
    <CaseLower key="words"/>,
    <Pilcrow key="chars"/>
  ];
  const [modeIndex, setModeIndex] = useState(0);
  const diffMode = modes[modeIndex];

  const handleCycleMode = () => setModeIndex(prev => (prev + 1) % modes.length);

  // Split vs inline diff mode
  const [splitView, setSplitView] = useState(false);
  const handleToggleSplit = () => setSplitView(prev => !prev);

  // Combined timeline
  const combinedData = unifyTracesForChart(allTraces);
  const [openChart, setOpenChart] = useState(false);

  // Collect all IDs for “Expand/Collapse All”
  const allMergedIds = useMemo(() => collectAllMergedSpanIds(mergedRoots), [mergedRoots]);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const everythingExpanded = expandedItems.length === allMergedIds.length;

  // Toggle expand/collapse
  const handleToggleExpand = useCallback(() => {
    if (everythingExpanded) {
      setExpandedItems([]);
    } else {
      setExpandedItems(allMergedIds);
    }
  }, [everythingExpanded, allMergedIds]);

  return (
    <div className="space-y-4">
      {/* Toolbar row */}
      <div className="flex justify-between gap-2">
        {/* Combined Timeline popover */}
        <Popover open={openChart} onOpenChange={setOpenChart}>
          <PopoverTrigger>
            <ActionButton
              tooltip="Combined Timeline"
              icon={<GanttChart/>}
              variant="ghost"
              size="icon"
              onClick={() => setOpenChart(true)}
            />
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
                {allTraces.map((_, i) => {
                  const color = colorPalette[i % colorPalette.length];
                  return (
                    <React.Fragment key={i}>
                      <Bar
                        dataKey={`start-${i}`}
                        stackId={`range-${i}`}
                        fill="transparent"
                        radius={[8,8,8,8]}
                      />
                      <Bar
                        dataKey={`length-${i}`}
                        stackId={`range-${i}`}
                        fill={color}
                        name={`Trace row ${rowIndexes[i]}`}
                      />
                    </React.Fragment>
                  );
                })}
              </BarChart>
            </ChartContainer>
          </PopoverContent>
        </Popover>

        {/* Expand/Collapse All */}
        <div className="flex items-center gap-2">
          <ActionButton
            tooltip={everythingExpanded ? "Collapse All" : "Expand All"}
            icon={
              everythingExpanded
                ? <FoldVertical className="h-4 w-4" />
                : <UnfoldVertical className="h-4 w-4" />
            }
            onClick={handleToggleExpand}
            variant="ghost"
            size="icon"
          />

          {/* Cycle diff mode */}
          <ActionButton
            tooltip={`Cycle diff mode (current: ${diffMode})`}
            icon={modeIcons[modeIndex]}
            onClick={handleCycleMode}
            variant="ghost"
            size="icon"
          />

          {/* Split/Inline toggle */}
          <ActionButton
            tooltip={splitView ? "Switch to Inline View" : "Switch to Split View"}
            icon={
              splitView
                ? <Columns className="h-4 w-4" />
                : <AlignJustify className="h-4 w-4" />
            }
            onClick={handleToggleSplit}
            variant="ghost"
            size="icon"
          />
        </div>
      </div>

      {/* Single top-level Accordion controlling everything */}
      <Accordion
        type="multiple"
        className="space-y-2"
        value={expandedItems}
        onValueChange={setExpandedItems}
      >
        {mergedRoots.map((mSpan, i) => (
          <MergedSpanItem
            key={i}
            merged={mSpan}
            rowIndexes={rowIndexes}
            diffMode={diffMode}
            splitView={splitView}
            depth={0}
          />
        ))}
      </Accordion>
    </div>
  );
};

export default MultiTraceView;