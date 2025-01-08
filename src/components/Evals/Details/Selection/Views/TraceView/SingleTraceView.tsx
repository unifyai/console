import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/UI/dialog";
import ActionButton from "@/components/Common/Buttons/Action";

import {
  GanttChart,
  GitBranch,
  ChevronDown,
  ChevronRight,
  Waypoints,
  CurlyBraces,
  Brackets,
  ImageIcon,
  Grid,
  Text as TextIcon,
  FoldVertical,
  UnfoldVertical,
} from "lucide-react";

import { BarChart, Bar, CartesianGrid, XAxis, YAxis, LabelList } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/UI/chart";

import ReactFlow, {
  ReactFlowProvider,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
} from "reactflow";
import "reactflow/dist/style.css";

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/UI/accordion";

import { isDict, isList, isMatrix, isImage, isTrace } from "@/utils/evals/selection";
import DictionaryView from "../DictionaryView";
import ListView from "../ListView";
import ImageView from "../ImageView";
import MatrixView from "../MatrixView";
import StringView from "../StringView";

import getIconForSpanType from "./IconSelection";

import type { Span } from "@/types/evals/traces";
import { unifyTracesForChart } from "./unify"; 
import SpanNode from "./nodes/SpanNode";


function getValueType(value: any):
  | "trace"
  | "dict"
  | "list"
  | "image"
  | "matrix"
  | "string"
{
  if (isTrace(value)) return "trace";
  if (isDict(value))  return "dict";
  if (isList(value))  return "list";
  if (isImage(value)) return "image";
  if (isMatrix(value))return "matrix";
  return "string";
}

function getTypeIcon(valueType: string) {
  switch (valueType) {
    case "trace":
      return <Waypoints className="h-4 w-4 text-primary" />;
    case "dict":
      return <CurlyBraces className="h-4 w-4 text-primary" />;
    case "list":
      return <Brackets className="h-4 w-4 text-primary" />;
    case "image":
      return <ImageIcon className="h-4 w-4 text-primary" />;
    case "matrix":
      return <Grid className="h-4 w-4 text-primary" />;
    default:
      return <TextIcon className="h-4 w-4 text-primary" />;
  }
}


interface SpanTreeNode {
  span: Span;
  children: SpanTreeNode[];
}

function buildTree(spans: Span[]): SpanTreeNode[] {
  return spans.map((s) => ({
    span: s,
    children: (s.child_spans?.length ?? 0) > 0 ? buildTree(s.child_spans) : [],
  }));
}


function formatTime(val?: number) {
  if (val == null) return "";
  const sign = val >= 0 ? "+" : "";
  return `${sign}${val.toFixed(2)}s`;
}


function CollapsibleSpanNode({
  node,
  depth,
  expansions,
  setExpansions,
  onSelectSpan,
  selectedSpanId,
}: {
  node: SpanTreeNode;
  depth: number;
  expansions: Record<string, boolean>;
  setExpansions: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onSelectSpan: (s: Span) => void;
  selectedSpanId?: string;
}) {
  const { span, children } = node;
  const hasChildren = children.length > 0;

  // A stable ID for expansions:
  const nodeId = `${span.span_name}-${span.id}`;
  // If top-level => always expanded; else togglable if children exist
  const canCollapse = depth >= 1 && hasChildren;
  const isExpanded = expansions[nodeId] ?? true;

  // Check if selected
  const isSelected = selectedSpanId === span.id;
  // Icon for the span’s type
  const IconComponent = getIconForSpanType(span.type);
  // Optional short offset text
  const offsetTxt = formatTime(span.offset);

  return (
    <div className="relative pl-4 border-l border-muted">
      <div
        className={
          "py-1 px-2 flex items-center gap-2 cursor-pointer rounded " +
          (isSelected ? "bg-accent text-accent-foreground" : "hover:bg-muted")
        }
        style={{ marginLeft: depth ? "0.5rem" : 0 }}
        onClick={() => onSelectSpan(span)}
      >
        <IconComponent
          className={
            "w-4 h-4 " +
            (isSelected ? "text-primary-foreground" : "text-primary")
          }
        />
        <span className="font-medium text-sm">{span.span_name}</span>

        {offsetTxt && (
          <span className="text-xs text-muted-foreground ml-2">{offsetTxt}</span>
        )}

        {canCollapse && (
          <button
            className="ml-auto text-muted-foreground hover:text-foreground p-0.5"
            onClick={(e) => {
              e.stopPropagation();
              setExpansions((prev) => ({
                ...prev,
                [nodeId]: !prev[nodeId],
              }));
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {depth === 0 && hasChildren && (
        <div className="ml-4">
          {children.map((child, i) => (
            <CollapsibleSpanNode
              key={child.span.id + i}
              node={child}
              depth={depth + 1}
              expansions={expansions}
              setExpansions={setExpansions}
              onSelectSpan={onSelectSpan}
              selectedSpanId={selectedSpanId}
            />
          ))}
        </div>
      )}
      {canCollapse && isExpanded && (
        <div className="ml-4">
          {children.map((child, i) => (
            <CollapsibleSpanNode
              key={child.span.id + i}
              node={child}
              depth={depth + 1}
              expansions={expansions}
              setExpansions={setExpansions}
              onSelectSpan={onSelectSpan}
              selectedSpanId={selectedSpanId}
            />
          ))}
        </div>
      )}
    </div>
  );
}


function renderSingleValue(value: any, baseIndex: number) {
  if (isTrace(value)) {
    // If truly nested spans, you could do a nested SingleTraceView,
    // but typically “code” or “inputs” won't be full “trace.”  
    return <p className="text-sm text-muted-foreground">(Span data detected)</p>;
  }

  if (isDict(value)) {
    return (
      <DictionaryView
        value={value}
        comparables={[]}
        baseLogIndex={baseIndex}
        comparisonLogsIndex={[]}
      />
    );
  }
  if (isList(value)) {
    return (
      <ListView
        value={value}
        comparables={[]}
        baseLogIndex={baseIndex}
        comparisonLogsIndex={[]}
      />
    );
  }
  if (isImage(value)) {
    return (
      <ImageView
        value={value}
        comparables={[]}
        baseLogIndex={baseIndex}
        comparisonLogsIndex={[]}
      />
    );
  }
  if (isMatrix(value)) {
    return (
      <MatrixView
        value={value}
        comparables={[]}
        baseLogIndex={baseIndex}
        comparisonLogsIndex={[]}
      />
    );
  }
  // fallback => string
  return (
    <StringView
      value={value ?? ""}
      comparables={[]}
      baseLogIndex={baseIndex}
      comparisonLogsIndex={[]}
    />
  );
}

/**
 * SingleTraceDetail: displays each major field in an Accordion, with
 * a "SpanTypeIcon" to the left of the span name, plus an “Expand All” button
 * on the right to toggle open/close all keys at once.
 */
function SingleTraceDetail({
  span,
  baseLogIndex,
}: {
  span: Span;
  baseLogIndex: number;
}) {
  const [openItems, setOpenItems] = useState<string[]>([]);

  // Collect the fields you want in an accordion
  const rawEntries: Record<string, unknown> = {
    id: span.id,
    parent_span_id: span.parent_span_id,
    type: span.type,
    timestamp: span.timestamp,
    offset: span.offset,
    exec_time: span.exec_time,
    code: span.code,
    errors: span.errors,
    inputs: span.inputs,
    outputs: span.outputs,
  };

  // Filter out fields that are undefined/unset
  const entries = Object.entries(rawEntries).filter(([_, v]) => v !== undefined);
  // For toggling all items
  const entryKeys = entries.map(([k]) => k);
  const everythingOpen = entryKeys.length > 0 && openItems.length === entryKeys.length;

  // Expand all / collapse all
  const handleToggleAll = () => {
    if (everythingOpen) {
      setOpenItems([]);
    } else {
      setOpenItems(entryKeys);
    }
  };

  // The icon for the “span.type” in the header
  const SpanTypeIcon = getIconForSpanType(span.type);

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header row => icon + name on the left, "Expand All" button on the right */}
      <div className="flex items-center justify-between mb-2 border-b pb-2">
        <div className="flex items-center gap-2">
          <SpanTypeIcon className="h-5 w-5 text-primary" />
          <p className="text-base font-semibold text-foreground">{span.span_name}</p>
        </div>
        
        {/* Expand/Collapse all button */}
        <ActionButton
          variant="ghost"
          size="icon"
          tooltip={everythingOpen ? "Collapse All" : "Expand All"}
          onClick={handleToggleAll}
          icon={
            everythingOpen ? (
              <FoldVertical className="h-4 w-4" />
            ) : (
              <UnfoldVertical className="h-4 w-4" />
            )
          }
        />
      </div>

      <div className="overflow-auto flex-1 p-2">
        <Accordion
          type="multiple"
          value={openItems}
          onValueChange={setOpenItems}
        >
          {entries.map(([key, val]) => {
            const type = getValueType(val);
            const icon = getTypeIcon(type);

            return (
              <AccordionItem key={key} value={key}>
                <AccordionTrigger>
                  <span className="inline-flex items-center gap-2">
                    {icon}
                    {key}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  {renderSingleValue(val, baseLogIndex)}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </div>
  );
}

function buildSingleTraceFlow(spans: Span[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const X_GAP = 300;
  const Y_GAP = 100;
  let currentRow = 0;

  function layoutSpan(span: Span, depth: number, rowStart: number, parentId?: string): number {
    const nodeId = `span-${span.id}-d${depth}`;
    const IconComponent = getIconForSpanType(span.type);

    nodes.push({
      id: nodeId,
      position: { x: depth * X_GAP, y: rowStart * Y_GAP },
      type: "span",
      data: {
        icon: IconComponent,
        title: span.span_name,
        ID: span.id,
        offset: span.offset,
        execTime: span.exec_time,
        hasError: !!span.errors,
      },
      draggable: false,
      selectable: false,
      connectable: false,
    });

    if (parentId) {
      edges.push({
        id: `edge-${parentId}-to-${nodeId}`,
        source: parentId,
        target: nodeId,
        type: "smoothstep",
        animated: true,
      });
    }

    let usedRows = 1;
    let childRow = rowStart;

    if (span.child_spans?.length) {
      for (const child of span.child_spans) {
        const subUsed = layoutSpan(child, depth + 1, childRow, nodeId);
        childRow += subUsed;
        usedRows += subUsed;
      }
    }
    return usedRows;
  }

  for (const topSpan of spans) {
    const subtreeUsed = layoutSpan(topSpan, 0, currentRow);
    currentRow += subtreeUsed;
  }

  return { nodes, edges };
}


interface SingleTraceViewProps {
  spans: Span[];
  baseLogIndex?: number;
}

export default function SingleTraceView({ spans, baseLogIndex = 0 }: SingleTraceViewProps) {
  // Build a tree for the left-hand collapsible panel
  const traceTree = useMemo(() => buildTree(spans), [spans]);

  // Keep track of expansions in the left tree
  const [expansions, setExpansions] = useState<Record<string, boolean>>({});

  // Which span is selected
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(null);

  // State for timeline & flow modals
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [flowOpen, setFlowOpen] = useState(false);

  // Build timeline chart data
  const timelineData = unifyTracesForChart([spans]);

  // Build flow
  const { nodes, edges } = useMemo(() => buildSingleTraceFlow(spans), [spans]);

  return (
    <div className="border rounded-md bg-background p-4 space-y-4 w-full">
      {/* Header => Title + Timeline & Flow buttons */}
      <div className="flex items-center justify-between">
        <p className="text-lg font-bold">Single Trace (Row {baseLogIndex})</p>
        <div className="flex gap-2">
          <ActionButton
            variant="outline"
            size="sm"
            icon={<GanttChart />}
            tooltip="Timeline View"
            onClick={() => setTimelineOpen(true)}
          />
          <ActionButton
            variant="outline"
            size="sm"
            icon={<GitBranch />}
            tooltip="Flow View"
            onClick={() => setFlowOpen(true)}
          />
        </div>
      </div>

      {/* Main layout => LEFT: collapsible tree, RIGHT: detail panel */}
      <div className="flex flex-row gap-4" style={{ height: "600px" }}>
        {/* LEFT: Collapsible tree of spans */}
        <div
          style={{
            flex: "0 0 auto",
            minWidth: "max-content",
            overflowY: "auto",
            border: "1px solid var(--muted)",
            borderRadius: "0.25rem",
            padding: "0.5rem",
          }}
        >
          {traceTree.map((node, idx) => (
            <CollapsibleSpanNode
              key={node.span.id + idx}
              node={node}
              depth={0}
              expansions={expansions}
              setExpansions={setExpansions}
              onSelectSpan={setSelectedSpan}
              selectedSpanId={selectedSpan?.id}
            />
          ))}
        </div>

        {/* RIGHT: detail panel => specialized views in Accordion + Expand All button */}
        <div
          style={{
            flex: "1 1 auto",
            overflowY: "auto",
            border: "1px solid var(--muted)",
            borderRadius: "0.25rem",
            padding: "0.5rem",
          }}
        >
          {selectedSpan ? (
            <SingleTraceDetail span={selectedSpan} baseLogIndex={baseLogIndex} />
          ) : (
            <p className="italic text-sm text-muted-foreground">
              Select a span from the left to view details.
            </p>
          )}
        </div>
      </div>

      {/* Timeline Dialog */}
      <Dialog open={timelineOpen} onOpenChange={setTimelineOpen}>
        <DialogContent className="w-[80vw] h-[80vh] max-w-none max-h-none p-4">
          <DialogHeader>
            <DialogTitle>Timeline View</DialogTitle>
            <DialogDescription>
              A timeline of all spans in this single trace.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 h-full overflow-auto">
            <ChartContainer config={{}} className="w-full h-full">
              <BarChart
                data={timelineData}
                layout="vertical"
                margin={{ left: 140, right: 40, top: 20, bottom: 20 }}
                barSize={24}
              >
                <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" horizontal={false} />
                <YAxis
                  dataKey="label"
                  type="category"
                  tickLine={false}
                  axisLine={false}
                  width={130}
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
                    padding: "0.5rem",
                  }}
                  labelStyle={{
                    fontWeight: 600,
                    marginBottom: "0.25rem",
                  }}
                  itemStyle={{
                    fontSize: "0.85rem",
                    padding: "2px 0",
                  }}
                />
                {/* For single trace we only have index 0 in unifyTracesForChart */}
                <Bar dataKey="start-0" stackId="range-0" fill="transparent" />
                <Bar
                  dataKey="length-0"
                  stackId="range-0"
                  fill="var(--primary)"
                  radius={[4, 4, 4, 4]}
                >
                  <LabelList
                    dataKey="length-0"
                    position="right"
                    formatter={(v: number) => `${v.toFixed(2)}s`}
                    fill="#4B5563"
                    style={{ fontSize: "0.75rem" }}
                  />
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>
        </DialogContent>
      </Dialog>

      {/* Flow Dialog */}
      <Dialog open={flowOpen} onOpenChange={setFlowOpen}>
        <DialogContent className="w-[80vw] h-[80vh] max-w-none max-h-none p-4 flex flex-col">
          <DialogHeader>
            <DialogTitle>Trace Flow</DialogTitle>
            <DialogDescription>
              A left-to-right flow of all spans in this single trace.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto mt-4 border rounded-md relative bg-muted/10">
            <ReactFlowProvider>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={{ span: SpanNode }}
                fitView
                proOptions={{ hideAttribution: true }}
              >
                <Background />
                <Controls />
                <MiniMap
                  nodeColor="var(--primary)"
                  nodeStrokeColor="var(--foreground)"
                  pannable
                />
              </ReactFlow>
            </ReactFlowProvider>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}