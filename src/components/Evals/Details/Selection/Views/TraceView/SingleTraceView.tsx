"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Span } from "@/types/evals/traces";

// Accordion & UI
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent
} from "@/components/UI/accordion";
import ActionButton from "@/components/Common/Buttons/Action";

// Icons (lucide-react)
import {
  GanttChart,
  FoldVertical,
  UnfoldVertical,
  GitBranch,
  ChevronsLeftRightEllipsis
} from "lucide-react";

// Charts for timeline
import { BarChart, Bar, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent
} from "@/components/UI/chart";

// ReactFlow
import ReactFlow, {
  ReactFlowProvider,
  Node,
  Edge,
  Background,
  Controls
} from "reactflow";
import "reactflow/dist/style.css";

// Import your original SpanNode
import SpanNode from "./nodes/SpanNode";

// Helper for timeline
import { unifyTracesForChart } from "./unify"; 

// Dialog (shadcn or similar)
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/UI/dialog";

/**
 * SingleTraceViewProps:
 * - spans: The array of top-level Spans for this single trace
 * - baseLogIndex?: optional row index if you want to label the row somewhere
 */
interface SingleTraceViewProps {
  spans: Span[];
  baseLogIndex?: number;
}

/**
 * Flatten all child spans so we can show them in one Accordion with indentation.
 */
function flattenSpans(spans: Span[], depth = 0): Array<{ span: Span; depth: number }> {
  const results: Array<{ span: Span; depth: number }> = [];
  for (const s of spans) {
    results.push({ span: s, depth });
    if (s.child_spans?.length) {
      results.push(...flattenSpans(s.child_spans, depth + 1));
    }
  }
  return results;
}

/**
 * Build a left→right hierarchical layout of the entire single trace
 * (including child spans). 
 * Each parent is at x=depth * X_GAP, each new sibling is stacked vertically. 
 */
function buildSingleTraceFlow(spans: Span[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const X_GAP = 300;
  const Y_GAP = 100;
  let currentRow = 0;

  function layoutSpan(span: Span, depth: number, rowStart: number, parentId?: string): number {
    const nodeId = `span-${span.id}-d${depth}`;
    nodes.push({
      id: nodeId,
      position: { x: depth * X_GAP, y: rowStart * Y_GAP },
      type: "span",  // We’ll use SpanNode
      data: {
        icon: ChevronsLeftRightEllipsis,
        title: span.span_name,
        ID: span.id,
        offset: span.offset,
        execTime: span.exec_time,
        hasError: Boolean(span.errors),
      },
      draggable: false,
      selectable: false,
      connectable: false
    });

    if (parentId) {
      edges.push({
        id: `edge-${parentId}-to-${nodeId}`,
        source: parentId,
        target: nodeId,
        type: "smoothstep",
        animated: true
      });
    }

    let usedRows = 1;
    let childRow = rowStart;
    if (span.child_spans?.length) {
      for (const child of span.child_spans) {
        const sub = layoutSpan(child, depth + 1, childRow, nodeId);
        childRow += sub;
        usedRows += sub;
      }
    }
    return usedRows;
  }

  // If multiple top-level spans, place each below the previous 
  for (const topSpan of spans) {
    const subtreeUsed = layoutSpan(topSpan, 0, currentRow);
    currentRow += subtreeUsed;
  }

  return { nodes, edges };
}

export default function SingleTraceView({ spans, baseLogIndex = 0 }: SingleTraceViewProps) {
  // Flatten for the single accordion
  const flattened = useMemo(() => flattenSpans(spans, 0), [spans]);
  const allIds = flattened.map((f) => f.span.id);

  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const everythingExpanded = expandedItems.length === allIds.length;

  const handleToggleAll = useCallback(() => {
    setExpandedItems(everythingExpanded ? [] : allIds);
  }, [everythingExpanded, allIds]);

  // Timeline data for a single trace
  const [timelineOpen, setTimelineOpen] = useState(false);
  const chartData = unifyTracesForChart([spans]);

  // Build horizontal flow (with children)
  const [flowOpen, setFlowOpen] = useState(false);
  const { nodes, edges } = useMemo(() => buildSingleTraceFlow(spans), [spans]);

  return (
    <div className="space-y-3">
      {/* Top Actions Row */}
      <div className="flex justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          {/* Timeline Button */}
          <ActionButton
            variant="ghost"
            size="icon"
            tooltip="Timeline View"
            icon={<GanttChart />}
            onClick={() => setTimelineOpen(true)}
          />
          <Dialog open={timelineOpen} onOpenChange={setTimelineOpen}>
            <DialogContent className="w-[90vw] h-[85vh] max-w-none max-h-none p-4">
              <DialogHeader>
                <DialogTitle>Timeline View</DialogTitle>
                <DialogDescription>
                  A timeline of all Spans in the Trace.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 h-full overflow-auto">
                <ChartContainer config={{}} className="w-full h-full">
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ left: 100, right: 20, top: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <YAxis
                      dataKey="label"
                      type="category"
                      tickLine={false}
                      axisLine={false}
                      width={120}
                    />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      domain={[0, "dataMax+1"]}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />

                    <Bar dataKey="start-0" stackId="range-0" fill="transparent" />
                    <Bar dataKey="length-0" stackId="range-0" fill="#9333ea" name="Single Trace" />
                  </BarChart>
                </ChartContainer>
              </div>
            </DialogContent>
          </Dialog>

          {/* Horizontal Flow Button */}
          <ActionButton
            variant="ghost"
            size="icon"
            tooltip="Horizontal Flow"
            icon={<GitBranch />}
            onClick={() => setFlowOpen(true)}
          />
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
                    nodeTypes={{ span: SpanNode }} // use your original SpanNode
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
        <div className="flex items-center gap-2">
          {/* Expand/Collapse All Button */}
          <ActionButton
            tooltip={everythingExpanded ? "Collapse All" : "Expand All"}
            icon={everythingExpanded ? <FoldVertical /> : <UnfoldVertical />}
            onClick={handleToggleAll}
            variant="ghost"
            size="icon"
          />
        </div>
      </div>

      {/* Single Accordion showing top-level + child spans (flattened) */}
      <Accordion
        type="multiple"
        value={expandedItems}
        onValueChange={setExpandedItems}
        className="space-y-2"
      >
        {flattened.map(({ span, depth }) => (
          <AccordionItem key={span.id} value={span.id}>
            <AccordionTrigger>
              <div className="flex items-center gap-2" style={{ marginLeft: depth * 16 }}>
                <ChevronsLeftRightEllipsis className="h-4 w-4 text-primary" />
                <span className="font-semibold">{span.span_name}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div
                className="border-l pl-4 space-y-2"
                style={{ marginLeft: depth * 16 }}
              >
                <p className="text-xs italic text-muted-foreground">
                  ID: {span.id}, offset: {span.offset ?? 0}, duration: {span.exec_time ?? 0}
                </p>
                {span.errors && (
                  <p className="text-destructive font-semibold">
                    Error: {span.errors}
                  </p>
                )}
                {/* Inputs */}
                {span.inputs && (
                  <div className="my-2 border p-2 rounded">
                    <strong className="block underline mb-1 text-sm">Inputs:</strong>
                    <pre className="whitespace-pre-wrap text-sm">
                      {JSON.stringify(span.inputs, null, 2)}
                    </pre>
                  </div>
                )}
                {/* Outputs */}
                {span.outputs && (
                  <div className="my-2 border p-2 rounded">
                    <strong className="block underline mb-1 text-sm">Outputs:</strong>
                    <pre className="whitespace-pre-wrap text-sm">
                      {JSON.stringify(span.outputs, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
