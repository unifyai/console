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
  ChevronsLeftRightEllipsis,
  ChevronDown,
  ChevronRight,
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

import type { Span } from "@/types/evals/traces";

import { unifyTracesForChart } from "./unify"; 
import SpanNode from "./nodes/SpanNode";


interface SingleTraceViewProps {
  spans: Span[];          // top-level spans for this single trace
  baseLogIndex?: number;  // optional row index for a label
}


interface SpanTreeNode {
  span: Span;
  children: SpanTreeNode[];
}

/** Convert each top-level Span => SpanTreeNode, recursively. */
function buildTree(spans: Span[]): SpanTreeNode[] {
  return spans.map((s) => ({
    span: s,
    children: s.child_spans?.length
      ? buildTree(s.child_spans)
      : [],
  }));
}

/** A small helper to format time, e.g. +0.42s. */
function formatTime(val?: number) {
  if (val == null) return "";
  return (val >= 0 ? `+${val.toFixed(2)}` : val.toFixed(2)) + "s";
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

  // ID for tracking expansions
  const nodeId = `${span.span_name}-${span.id}`;
  // If top-level => always expanded, else we can toggle if children exist
  const canCollapse = depth >= 1 && hasChildren;
  const isExpanded = expansions[nodeId] ?? true;

  // Check if selected
  const isSelected = span.id === selectedSpanId;

  // We can color the text or do something if we want. For now, just normal text.
  const name = span.span_name;
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
        {isSelected ? <ChevronsLeftRightEllipsis className="w-4 h-4 text-primary-foreground" /> : <ChevronsLeftRightEllipsis className="w-4 h-4 text-primary" />}
        <span className="font-medium text-sm">{name}</span>
        {offsetTxt && (
          <span className="text-xs text-muted-foreground ml-2">
            {offsetTxt}
          </span>
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


function SingleTraceDetail({ span }: { span: Span }) {
  return (
    <div className="w-full h-full flex flex-col">
      {/* Pinned name row */}
      <div className="flex items-center justify-between mb-2 border-b pb-2">
        <p className="text-base font-semibold text-foreground">
          {span.span_name}
        </p>
        {/* No diff toggles needed for single trace, so maybe just empty region */}
        <div />
      </div>

      {/* scrollable detail */}
      <div className="overflow-auto flex-1 p-2">
        {/* Show offset, exec_time, errors, inputs, outputs, etc. */}
        <p className="text-sm text-muted-foreground mb-1">
          ID: {span.id}
        </p>
        {span.errors && (
          <p className="text-destructive">Error: {span.errors}</p>
        )}
        <p className="text-sm">Offset: {formatTime(span.offset)}</p>
        <p className="text-sm">Exec Time: {formatTime(span.exec_time)}</p>

        {span.inputs && (
          <div className="border p-2 rounded bg-background my-2">
            <strong className="block underline mb-1 text-sm">Inputs:</strong>
            <pre className="whitespace-pre-wrap text-xs">
              {JSON.stringify(span.inputs, null, 2)}
            </pre>
          </div>
        )}
        {span.outputs && (
          <div className="border p-2 rounded bg-background my-2">
            <strong className="block underline mb-1 text-sm">Outputs:</strong>
            <pre className="whitespace-pre-wrap text-xs">
              {JSON.stringify(span.outputs, null, 2)}
            </pre>
          </div>
        )}
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
    nodes.push({
      id: nodeId,
      position: { x: depth*X_GAP, y: rowStart*Y_GAP },
      type: "span",
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

    let usedRows=1;
    let childRow = rowStart;

    if (span.child_spans?.length) {
      for (const child of span.child_spans) {
        const subUsed = layoutSpan(child, depth+1, childRow, nodeId);
        childRow += subUsed;
        usedRows += subUsed;
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


export default function SingleTraceView({
  spans,
  baseLogIndex=0,
}: SingleTraceViewProps) {

  // Build a tree for the left collapsible
  const traceTree = useMemo(() => buildTree(spans), [spans]);
  // expansions
  const [expansions, setExpansions] = useState<Record<string, boolean>>({});
  // selected Span
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(null);

  // timeline + flow dialogs
  const [ timelineOpen, setTimelineOpen ] = useState(false);
  const [ flowOpen, setFlowOpen ] = useState(false);

  // Build timeline data (for single trace, unifyTracesForChart can handle [spans])
  const timelineData = unifyTracesForChart([spans]);

  // Build flow
  const { nodes, edges } = useMemo(() => buildSingleTraceFlow(spans), [spans]);

  return (
    <div className="border rounded-md bg-background p-4 space-y-4 w-full">
      {/* Top row => title + timeline + flow */}
      <div className="flex items-center justify-between">
        <p className="text-lg font-bold">
          Single Trace (Row {baseLogIndex})
        </p>
        <div className="flex gap-2">
          <ActionButton
            variant="outline"
            size="sm"
            icon={<GanttChart/>}
            tooltip="Timeline View"
            onClick={()=> setTimelineOpen(true)}
          />
          <ActionButton
            variant="outline"
            size="sm"
            icon={<GitBranch/>}
            tooltip="Flow View"
            onClick={()=> setFlowOpen(true)}
          />
        </div>
      </div>

      {/* The main area => flex row, left = auto width for tree, right = fill */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          height: "600px",
          gap: "1rem",
        }}
      >
        {/* LEFT => auto-size horizontally to fit the tree content */}
        <div
          style={{
            flex: "0 0 auto",
            minWidth: "max-content",
            overflowY: "auto",
            border: "1px solid var(--muted)",
            borderRadius: "0.25rem",
            padding: "0.5rem",
            maxHeight: "100%",
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

        {/* RIGHT => fill remaining space for details */}
        <div
          style={{
            flex: "1 1 auto",
            overflowY: "auto",
            border: "1px solid var(--muted)",
            borderRadius: "0.25rem",
            padding: "0.5rem",
            maxHeight: "100%",
          }}
        >
          {selectedSpan ? (
            <SingleTraceDetail span={selectedSpan}/>
          ) : (
            <p className="italic text-sm text-muted-foreground">
              Select a span from the left
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
              A timeline of all spans in this single trace
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 h-full overflow-auto">
            <ChartContainer config={{}} className="w-full h-full">
              <BarChart
                data={timelineData}
                layout="vertical"
                margin={{ left:140, right:40, top:20, bottom:20 }}
                barSize={24}
              >
                <CartesianGrid
                  stroke="#E5E7EB"
                  strokeDasharray="3 3"
                  horizontal={false}
                />
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
                  tickFormatter={(val)=> `${val.toFixed(1)}s`}
                  domain={[0,"dataMax+0.5"]}
                />
                <ChartTooltip
                  content={<ChartTooltipContent/>}
                  separator=": "
                  offset={10}
                  filterNull
                  cursor={{ stroke:"#ccc", strokeDasharray:"3 3"}}
                  wrapperStyle={{
                    backgroundColor:"#fff",
                    border:"1px solid #ccc",
                    borderRadius:"0.25rem",
                    boxShadow:"0 2px 6px rgba(0,0,0,0.15)",
                    padding:"0.5rem",
                  }}
                  labelStyle={{
                    fontWeight:600,
                    marginBottom:"0.25rem",
                  }}
                  itemStyle={{
                    fontSize:"0.85rem",
                    padding:"2px 0",
                  }}
                />
                {/* single trace => index=0 => “start-0” & “length-0” */}
                <Bar dataKey="start-0" stackId="range-0" fill="transparent"/>
                <Bar dataKey="length-0" stackId="range-0" fill="var(--primary)" radius={[4,4,4,4]}>
                  <LabelList
                    dataKey="length-0"
                    position="right"
                    formatter={(v:number)=> `${v.toFixed(2)}s`}
                    fill="#4B5563"
                    style={{ fontSize:"0.75rem" }}
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
              A left-to-right flow of all spans in this single trace
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto mt-4 border rounded-md relative bg-muted/10">
            <ReactFlowProvider>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={{ span: SpanNode }}
                fitView
                proOptions={{ hideAttribution:true}}
              >
                <Background/>
                <Controls/>
                <MiniMap
                  nodeStrokeColor="var(--foreground)"
                  nodeColor="var(--primary)"
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