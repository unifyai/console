"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent
} from "@/components/UI/accordion";
import ActionButton from "@/components/Common/Buttons/Action";
import DiffViewer from "@/components/Common/Misc/DiffViewer";

import { BarChart, Bar, CartesianGrid, XAxis, YAxis, LabelList } from "recharts"; // <-- Imported LabelList
import {
  GanttChart,
  FoldVertical,
  UnfoldVertical,
  FileText,
  CaseLower,
  Pilcrow,
  Columns,
  AlignJustify,
  Eye,
  EyeOff,
  GitBranch,
  ChevronsLeftRightEllipsis
} from "lucide-react";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,

} from "@/components/UI/chart";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/UI/dialog";

import { Span } from "@/types/evals/traces";
import { unifyByName, unifyTracesForChart, colorPalette } from "./unify";

// Bring in our custom “MultiSpanNode”
import MultiSpanNode from "./nodes/MultiSpanNode";

// ReactFlow
import ReactFlow, {
  ReactFlowProvider,
  Node,
  Edge,
  Background,
  Controls
} from "reactflow";
import "reactflow/dist/style.css";

/**
 * MergedSpan interface: multi-diff structure
 */
export interface MergedSpan {
  spanName: string;
  baseSpan?: Span;
  comparableSpans: Array<Span | undefined>;
  children: MergedSpan[];
}

/**
 * Flatten merges for the <Accordion>.
 */
function flattenAllMergedSpans(
  merges: MergedSpan[],
  depth = 0
): Array<{ merged: MergedSpan; depth: number; itemId: string }> {
  const results: Array<{ merged: MergedSpan; depth: number; itemId: string }> = [];
  for (const m of merges) {
    const itemId = `${m.spanName}-${m.baseSpan?.id ?? "no-base"}`;
    results.push({ merged: m, depth, itemId });
    if (m.children?.length) {
      results.push(...flattenAllMergedSpans(m.children, depth + 1));
    }
  }
  return results;
}

function collectAllMergedSpanIds(merges: MergedSpan[]): string[] {
  return flattenAllMergedSpans(merges).map((f) => f.itemId);
}

/**
 * Group comparables for textual diffs (like “Inputs,” “Outputs”).
 */
function groupComparablesByValue(
  comparables: Array<Span | undefined>,
  rowIndexes: number[],
  getValue: (s: Span | undefined) => string
) {
  const map = new Map<string, number[]>();
  comparables.forEach((comp, i) => {
    const text = getValue(comp);
    const compRow = rowIndexes[i + 1];
    const arr = map.get(text) || [];
    arr.push(compRow);
    map.set(text, arr);
  });
  return Array.from(map.entries()).map(([text, rowIndices]) => ({ text, rowIndices }));
}

/**
 * FieldDiff for e.g. "Inputs," "Outputs," etc.
 */
function MergedFieldDiff({
  label,
  baseSpan,
  comparables,
  rowIndexes,
  getValue,
  diffMode,
  splitView
}: {
  label: string;
  baseSpan?: Span;
  comparables: Array<Span | undefined>;
  rowIndexes: number[];
  getValue: (s: Span | undefined) => string;
  diffMode: "lines" | "words" | "characters";
  splitView: boolean;
}) {
  const baseText = getValue(baseSpan);
  const groups = groupComparablesByValue(comparables, rowIndexes, getValue);

  // If no data in base or comparables, show a small note
  if (!baseSpan && groups.every((g) => g.text === "")) {
    return (
      <em className="text-xs text-muted-foreground">
        No data in base or comparables
      </em>
    );
  }

  return (
    <div className="p-2 border rounded bg-secondary/10 space-y-2">
      <p className="font-medium text-sm">{label}</p>
      {groups.map((group, idx) => (
        <div key={idx} className="ml-3 border-l pl-2">
          <p className="text-xs text-muted-foreground mb-1">
            Diff row {rowIndexes[0]} with row(s) {group.rowIndices.join(", ")}
          </p>
          <DiffViewer
            oldValue={baseText}
            newValue={group.text}
            hideLineNumbers
            hideMarkers
            showDiffOnly={false}
            mode={diffMode}
            splitView={splitView}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Build a hierarchical left→right layout so parent spans are at x=0,
 * children are at x=1, etc. Each trace is offset vertically from the previous one.
 */
function buildHierarchicalLayout(
  allTraces: Span[][],
  rowIndexes: number[]
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const X_GAP = 200;
  const Y_GAP = 50;

  let currentTraceTop = 0;

  // Recursively place a single span subtree
  function layoutSpan(
    span: Span,
    level: number,
    rowStart: number,
    traceIndex: number,
    parentId?: string
  ): number {
    const nodeId = `trace-${traceIndex}-span-${span.id}-lvl-${level}`;
    const rowIndex = rowIndexes[traceIndex] ?? -1;

    // Create the node with MultiSpanNode
    nodes.push({
      id: nodeId,
      position: { x: level * X_GAP, y: rowStart * Y_GAP },
      type: "multiSpan",
      data: {
        icon: ChevronsLeftRightEllipsis,
        title: span.span_name,
        ID: span.id,
        offset: span.offset,
        execTime: span.exec_time,
        hasError: Boolean(span.errors),
        traceIndex,
        rowIndex
      },
      draggable: false,
      selectable: false,
      connectable: false
    });

    // Link parent -> child
    if (parentId) {
      edges.push({
        id: `edge-${parentId}-${nodeId}`,
        source: parentId,
        target: nodeId,
        type: "smoothstep",
        animated: true
      });
    }

    let usedRows = 1;
    let childOffset = rowStart;

    if (span.child_spans && span.child_spans.length) {
      for (const child of span.child_spans) {
        const subUsed = layoutSpan(child, level + 1, childOffset, traceIndex, nodeId);
        childOffset += subUsed;
        usedRows += subUsed;
      }
    }
    return usedRows;
  }

  // For each trace, place top-level spans one by one
  for (let tIndex = 0; tIndex < allTraces.length; tIndex++) {
    const trace = allTraces[tIndex];
    let traceHeight = 0;
    for (const topSpan of trace) {
      const subtreeRows = layoutSpan(topSpan, 0, currentTraceTop + traceHeight, tIndex);
      traceHeight += subtreeRows;
    }
    currentTraceTop += traceHeight + 1; // space after each trace
  }

  return { nodes, edges };
}

// Node types => use the MultiSpanNode
const nodeTypes = {
  multiSpan: MultiSpanNode
};

/**
 * MultiTraceView:  
 *  - Renders multi-diff in an accordion.  
 *  - Has a timeline dialog for combined timeline.  
 *  - Has a “Hierarchical Flow” dialog using ReactFlow.  
 */
export default function MultiTraceView({
  allTraces,
  rowIndexes
}: {
  allTraces: Span[][];
  rowIndexes: number[];
}) {
  // Flatten merges for the Accordion
  const mergedRoots = unifyByName(allTraces);
  const flattenedMerged = useMemo(() => flattenAllMergedSpans(mergedRoots), [mergedRoots]);
  const allIds = useMemo(() => collectAllMergedSpanIds(mergedRoots), [mergedRoots]);

  // Expand/collapse logic
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const everythingExpanded = expandedItems.length === allIds.length;

  const handleToggleAll = useCallback(() => {
    if (everythingExpanded) {
      setExpandedItems([]);
    } else {
      setExpandedItems(allIds);
    }
  }, [everythingExpanded, allIds]);

  // Combined Timeline => in a Dialog
  const [timelineOpen, setTimelineOpen] = useState(false);
  const combinedData = unifyTracesForChart(allTraces);

  // Flow View => in a Dialog
  const [flowOpen, setFlowOpen] = useState(false);
  const { nodes, edges } = useMemo(
    () => buildHierarchicalLayout(allTraces, rowIndexes),
    [allTraces, rowIndexes]
  );

  // Diff toggles
  type DiffMode = "lines" | "words" | "characters";
  const modes: DiffMode[] = ["lines", "words", "characters"];
  const modeIcons = [<FileText key="lines" />, <CaseLower key="words" />, <Pilcrow key="chars" />];
  const [modeIndex, setModeIndex] = useState(0);
  const diffMode = modes[modeIndex];
  const handleCycleMode = () => setModeIndex((p) => (p + 1) % modes.length);

  const [splitView, setSplitView] = useState(false);
  const handleToggleSplit = () => setSplitView((p) => !p);

  const [hideIdentical, setHideIdentical] = useState(false);
  const toggleHideIdentical = () => setHideIdentical((p) => !p);

  // Helper: skip if everything is identical
  function allIdenticalFor(
    baseSpan: Span | undefined,
    comparables: Array<Span | undefined>,
    getVal: (s: Span | undefined) => string
  ) {
    if (!hideIdentical) return false;
    const baseText = getVal(baseSpan);
    return comparables.every((c) => getVal(c) === baseText);
  }

  return (
    <div className="space-y-4">
      {/* ───────────────── Toolbar row ───────────────── */}
      <div className="flex justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Combined Timeline Button => dialog */}
          <ActionButton
            tooltip="Combined Timeline"
            icon={<GanttChart />}
            variant="ghost"
            size="icon"
            onClick={() => setTimelineOpen(true)}
          />

          {/* Timeline Dialog */}
          <Dialog open={timelineOpen} onOpenChange={setTimelineOpen}>
            <DialogContent className="w-[90vw] h-[90vh] max-w-none max-h-none p-4">
              <DialogHeader>
                <DialogTitle>Timeline View</DialogTitle>
                <DialogDescription>
                  A timeline of all Spans in the Trace.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 h-full overflow-auto">
                <ChartContainer config={{}} className="w-full h-full">
                  {/* 
                      Updated styling starts below:
                      - We add barSize, round corners
                      - We show vertical-grid lines only (CartesianGrid with horizontal={false})
                      - We label the X-axis in seconds
                      - We add a LabelList for each bar to display duration at the bar's end
                  */}
                  <BarChart
                    data={combinedData}
                    layout="vertical"
                    barSize={24}
                    margin={{ left: 140, right: 60, top: 20, bottom: 20 }}
                  >
                    <CartesianGrid
                      stroke="#E5E7EB"
                      strokeDasharray="3 3"
                      horizontal={false}
                    />
                    <YAxis
                      dataKey="label"
                      type="category"
                      width={130}
                      tickLine={false}
                      axisLine={false}
                      stroke="#4B5563"
                    />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      stroke="#4B5563"
                      tickFormatter={(val) => `${val.toFixed(1)}s`}
                      domain={[0, "dataMax+0.5"]}
                    />
                    <ChartTooltip
                      content={<ChartTooltipContent />}
                      separator=": "
                      offset={10}
                      filterNull
                      cursor={{ stroke: "#ccc", strokeDasharray: "3 3" }}
                      wrapperStyle={{
                        backgroundColor: "#fff",
                        border: "1px solid #ccc",
                        borderRadius: "0.25rem",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                        padding: "0.5rem"
                      }}
                      labelStyle={{
                        fontWeight: 600,
                        marginBottom: "0.25rem",
                        marginRight: "0.25rem"
                      }}
                      itemStyle={{
                        fontSize: "0.85rem",
                        padding: "2px 0"
                      }}
                    />

                    {allTraces.map((_, i) => {
                      const color = colorPalette[i % colorPalette.length];
                      return (
                        <React.Fragment key={i}>
                          {/* Invisible offset bar */}
                          <Bar
                            dataKey={`start-${i}`}
                            stackId={`range-${i}`}
                            fill="transparent"
                          />
                          {/* Actual duration bar with labels */}
                          <Bar
                            dataKey={`length-${i}`}
                            stackId={`range-${i}`}
                            fill={color}
                            radius={[4, 4, 4, 4]}
                            name={`Trace row ${rowIndexes[i]}`}
                          >
                            <LabelList
                              dataKey={`length-${i}`}
                              position="right"
                              formatter={(value: number) => `${value.toFixed(2)}s`}
                              fill="#4B5563"
                              style={{ fontSize: "0.75rem" }}
                            />
                          </Bar>
                        </React.Fragment>
                      );
                    })}
                  </BarChart>
                </ChartContainer>
              </div>
            </DialogContent>
          </Dialog>

          {/* Flow Dialog button */}
          <ActionButton
            tooltip="Hierarchical Flow"
            icon={<GitBranch />}
            variant="ghost"
            size="icon"
            onClick={() => setFlowOpen(true)}
          />

          {/* Flow Dialog */}
          <Dialog open={flowOpen} onOpenChange={setFlowOpen}>
            <DialogContent className="w-[90vw] h-[90vh] max-w-none max-h-none flex flex-col p-4">
              <DialogHeader>
                <DialogTitle>Trace Flow</DialogTitle>
                <DialogDescription>
                  A left-to-right flow of all Spans in the Trace.
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-auto mt-4 border rounded-md relative bg-muted/10">
                <ReactFlowProvider>
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    fitView
                    proOptions={{ hideAttribution: true }}
                  >
                    <Background />
                    <Controls />
                  </ReactFlow>
                </ReactFlowProvider>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Right side toggles */}
        <div className="flex items-center gap-2">
          {/* Expand/Collapse All */}
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

          {/* Diff Mode */}
          <ActionButton
            tooltip={`Cycle diff mode (current: ${diffMode})`}
            icon={modeIcons[modeIndex]}
            onClick={handleCycleMode}
            variant="ghost"
            size="icon"
          />

          {/* Split vs Inline diffs */}
          <ActionButton
            tooltip={splitView ? "Switch to Inline View" : "Switch to Split View"}
            icon={splitView ? <Columns className="h-4 w-4" /> : <AlignJustify className="h-4 w-4" />}
            onClick={handleToggleSplit}
            variant="ghost"
            size="icon"
          />

          {/* Hide Identical */}
          <ActionButton
            tooltip={hideIdentical ? "Show identical fields" : "Hide identical fields"}
            icon={hideIdentical ? <EyeOff /> : <Eye />}
            onClick={toggleHideIdentical}
            variant="ghost"
            size="icon"
          />
        </div>
      </div>

      {/* ───────────────── Accordion for Multi-Trace Diff ───────────────── */}
      <Accordion
        type="multiple"
        className="space-y-2"
        value={expandedItems}
        onValueChange={setExpandedItems}
      >
        {flattenedMerged.map(({ merged, depth, itemId }) => {
          const { spanName, baseSpan, comparableSpans } = merged;
          const hasErrors = baseSpan?.errors || comparableSpans.some((c) => c?.errors);

          function skipIfAllIdentical(getVal: (s: Span | undefined) => string) {
            if (!hideIdentical) return false;
            const baseText = getVal(baseSpan);
            return comparableSpans.every((cmp) => getVal(cmp) === baseText);
          }

          return (
            <AccordionItem key={itemId} value={itemId}>
              <AccordionTrigger>
                <div
                  className="flex items-center gap-2"
                  style={{ marginLeft: depth * 16 }}
                >
                  <ChevronsLeftRightEllipsis className="h-4 w-4 text-primary" />
                  <span className="font-semibold">{spanName}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="border-l pl-4 space-y-3" style={{ marginLeft: depth * 16 }}>
                  {/* Base row reference */}
                  {baseSpan && (
                    <p className="ml-2 text-xs italic text-muted-foreground">
                      Row {rowIndexes[0]} (Base): {baseSpan.id}
                    </p>
                  )}
                  {/* Comparables row references */}
                  {comparableSpans.map((c, idx) => (
                    <p key={idx} className="ml-2 text-xs italic text-muted-foreground">
                      Row {rowIndexes[idx + 1]}: {c?.id ?? "N/A"}
                    </p>
                  ))}

                  {/* Offset */}
                  {!skipIfAllIdentical((s) => String(s?.offset ?? 0)) && (
                    <MergedFieldDiff
                      label="Offset"
                      baseSpan={baseSpan}
                      comparables={comparableSpans}
                      rowIndexes={rowIndexes}
                      getValue={(s) => String(s?.offset ?? 0)}
                      diffMode={diffMode}
                      splitView={splitView}
                    />
                  )}

                  {/* Exec Time */}
                  {!skipIfAllIdentical((s) => String(s?.exec_time ?? 0)) && (
                    <MergedFieldDiff
                      label="Exec Time"
                      baseSpan={baseSpan}
                      comparables={comparableSpans}
                      rowIndexes={rowIndexes}
                      getValue={(s) => String(s?.exec_time ?? 0)}
                      diffMode={diffMode}
                      splitView={splitView}
                    />
                  )}

                  {/* Errors */}
                  {hasErrors &&
                    !skipIfAllIdentical((s) => s?.errors ?? "") && (
                      <MergedFieldDiff
                        label="Errors"
                        baseSpan={baseSpan}
                        comparables={comparableSpans}
                        rowIndexes={rowIndexes}
                        getValue={(s) => s?.errors ?? ""}
                        diffMode={diffMode}
                        splitView={splitView}
                      />
                    )}

                  {/* Inputs */}
                  {!skipIfAllIdentical((s) =>
                    JSON.stringify(s?.inputs ?? {}, null, 2)
                  ) && (
                    <MergedFieldDiff
                      label="Inputs"
                      baseSpan={baseSpan}
                      comparables={comparableSpans}
                      rowIndexes={rowIndexes}
                      getValue={(s) => JSON.stringify(s?.inputs ?? {}, null, 2)}
                      diffMode={diffMode}
                      splitView={splitView}
                    />
                  )}

                  {/* Outputs */}
                  {!skipIfAllIdentical((s) =>
                    JSON.stringify(s?.outputs ?? {}, null, 2)
                  ) && (
                    <MergedFieldDiff
                      label="Outputs"
                      baseSpan={baseSpan}
                      comparables={comparableSpans}
                      rowIndexes={rowIndexes}
                      getValue={(s) => JSON.stringify(s?.outputs ?? {}, null, 2)}
                      diffMode={diffMode}
                      splitView={splitView}
                    />
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
