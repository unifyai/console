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
  Text as TextIcon,
  Pilcrow,
  Eye,
  EyeOff,
  FoldVertical,
  UnfoldVertical,
  CurlyBraces,
  Brackets,
  ImageIcon,
  Grid,
} from "lucide-react";

import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  LabelList,
} from "recharts";
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

import { Span } from "@/types/evals/traces";
import {
  unifyByName,
  unifyTracesForChart,
  colorPalette,
} from "./unify";
import MultiSpanNode from "./nodes/MultiSpanNode";
import getIconForSpanType from "./IconSelection";

import { isDict, isList, isMatrix, isImage, isTrace } from "@/utils/evals/selection";
import DictionaryView from "../DictionaryView";
import ListView from "../ListView";
import ImageView from "../ImageView";
import MatrixView from "../MatrixView";
import StringView from "../StringView";

export interface MergedSpan {
  spanName: string;
  baseSpan?: Span;                 // if present => in base
  comparableSpans: (Span | undefined)[];
  children: MergedSpan[];
}

/** Use the same logic as SingleTraceView to pick a type. */
function getValueType(value: any):
  | "dict"
  | "list"
  | "image"
  | "matrix"
  | "string"
  | "trace" {
  if (isTrace(value))   return "trace";
  if (isDict(value))    return "dict";
  if (isList(value))    return "list";
  if (isImage(value))   return "image";
  if (isMatrix(value))  return "matrix";
  return "string";
}

/** For field-level icons in the Accordion. */
function getTypeIcon(valueType: string) {
  switch (valueType) {
    case "trace":
      return <Pilcrow className="h-4 w-4 text-primary" />;
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

interface CollapsibleMergedNodeProps {
  node: MergedSpan;
  depth: number;
  expansions: Record<string, boolean>;
  setExpansions: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onSelectNode: (n: MergedSpan) => void;
  selectedNode?: MergedSpan | null;
  rowIndexes: number[];
}

function getAnySpanType(ms: MergedSpan): string | undefined {
  if (ms.baseSpan?.type) return ms.baseSpan.type;
  for (const c of ms.comparableSpans) {
    if (c?.type) return c.type;
  }
  return undefined;
}

function CollapsibleMergedNode({
  node,
  depth,
  expansions,
  setExpansions,
  onSelectNode,
  selectedNode,
  rowIndexes,
}: CollapsibleMergedNodeProps) {
  const { spanName, baseSpan, comparableSpans, children } = node;
  const hasChildren = children.length > 0;

  const nodeId = `${spanName}-${baseSpan?.id ?? "none"}`;
  const isExpanded = expansions[nodeId] ?? true;
  const canCollapse = depth >= 1 && hasChildren;

  // Red if baseSpan present; else green
  const inBase = !!baseSpan;
  const textColorClass = inBase ? "text-red-600" : "text-green-600";

  const isSelected = selectedNode === node;
  const iconType = getAnySpanType(node);
  const IconComponent = getIconForSpanType(iconType);

  return (
    <div className="relative pl-4 border-l border-muted">
      <div
        className={
          "py-1 px-2 flex items-center gap-2 cursor-pointer rounded " +
          (isSelected ? "bg-accent text-accent-foreground" : "hover:bg-muted")
        }
        style={{ marginLeft: depth ? "0.5rem" : 0 }}
        onClick={() => onSelectNode(node)}
      >
        <IconComponent className="w-4 h-4" />
        <span className={`font-medium text-sm ${textColorClass}`}>{spanName}</span>

        {canCollapse && (
          <button
            className="ml-auto text-muted-foreground hover:text-foreground p-0.5"
            onClick={(e) => {
              e.stopPropagation();
              setExpansions((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
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
            <CollapsibleMergedNode
              key={i}
              node={child}
              depth={depth + 1}
              expansions={expansions}
              setExpansions={setExpansions}
              onSelectNode={onSelectNode}
              selectedNode={selectedNode}
              rowIndexes={rowIndexes}
            />
          ))}
        </div>
      )}
      {canCollapse && isExpanded && (
        <div className="ml-4">
          {children.map((child, i) => (
            <CollapsibleMergedNode
              key={i}
              node={child}
              depth={depth + 1}
              expansions={expansions}
              setExpansions={setExpansions}
              onSelectNode={onSelectNode}
              selectedNode={selectedNode}
              rowIndexes={rowIndexes}
            />
          ))}
        </div>
      )}
    </div>
  );
}


function isAllIdentical(
  baseVal: unknown,
  compareVals: unknown[],
): boolean {
  const baseJSON = JSON.stringify(baseVal);
  return compareVals.every((v) => JSON.stringify(v) === baseJSON);
}


function fixUndefinedIfNeeded(val: any, sample: any) {
  if (val !== undefined && val !== null) return val;
  // If sample is a dict => use {}
  if (isDict(sample)) return {};
  // If sample is list => []
  if (isList(sample)) return [];
  if (isMatrix(sample)) return [];   // treat as empty array
  if (isImage(sample)) return "";    // treat as empty string
  // fallback => undefined is fine for string or "trace"
  return val;
}

function getMultiValueView(
  baseVal: any,
  compareVals: any[],
  baseIndex: number,
  compareIndexes: number[]
) {
  // If literally everything is undefined => skip
  const allUndefined = baseVal === undefined && compareVals.every((v) => v === undefined);
  if (allUndefined) {
    return <p className="italic text-sm text-muted-foreground">No data</p>;
  }

  // Figure out a sample for type detection
  let sample = baseVal;
  if (sample === undefined) {
    sample = compareVals.find((x) => x !== undefined);
  }
  // If still nothing => fallback to "string"
  if (!sample) sample = "";

  // Now we have a sample => detect type
  const vtype = getValueType(sample);

  // If baseVal is undefined but sample is dict/list => fix it
  let fixedBase = fixUndefinedIfNeeded(baseVal, sample);
  // Also fix each comparable
  let fixedCompares = compareVals.map((c) => fixUndefinedIfNeeded(c, sample));

  // Dispatch to the specialized multi-view
  switch (vtype) {
    case "trace":
      // If we want to handle nested spans, do so. For now => fallback:
      return (
        <p className="italic text-sm">
          (Span data detected - no specialized multi-trace view)
        </p>
      );
    case "dict":
      return (
        <DictionaryView
          value={fixedBase}
          comparables={fixedCompares}
          baseLogIndex={baseIndex}
          comparisonLogsIndex={compareIndexes}
        />
      );
    case "list":
      return (
        <ListView
          value={fixedBase}
          comparables={fixedCompares}
          baseLogIndex={baseIndex}
          comparisonLogsIndex={compareIndexes}
        />
      );
    case "image":
      return (
        <ImageView
          value={fixedBase}
          comparables={fixedCompares}
          baseLogIndex={baseIndex}
          comparisonLogsIndex={compareIndexes}
        />
      );
    case "matrix":
      return (
        <MatrixView
          value={fixedBase}
          comparables={fixedCompares}
          baseLogIndex={baseIndex}
          comparisonLogsIndex={compareIndexes}
        />
      );
    default: // "string"
      return (
        <StringView
          value={fixedBase ?? ""}
          comparables={fixedCompares}
          baseLogIndex={baseIndex}
          comparisonLogsIndex={compareIndexes}
        />
      );
  }
}

interface MultiDetailPanelProps {
  node: MergedSpan;
  rowIndexes: number[];
}

function MultiDetailPanel({ node, rowIndexes }: MultiDetailPanelProps) {
  const [hideIdentical, setHideIdentical] = useState(false);
  const handleToggleHide = () => setHideIdentical((p) => !p);

  // Expand All
  const [openItems, setOpenItems] = useState<string[]>([]);
  const fields = [
    { id: "offset",    label: "Offset" },
    { id: "exec_time", label: "Exec Time" },
    { id: "code",      label: "Code" },
    { id: "errors",    label: "Errors" },
    { id: "inputs",    label: "Inputs" },
    { id: "outputs",   label: "Outputs" },
  ];
  const allFieldIds = fields.map((f) => f.id);
  const everythingOpen = allFieldIds.length > 0 && openItems.length === allFieldIds.length;
  const handleToggleAll = () => {
    if (everythingOpen) setOpenItems([]);
    else setOpenItems(allFieldIds);
  };

  // Node => name + base/comparables
  const { spanName, baseSpan, comparableSpans } = node;
  const firstSpan = baseSpan || comparableSpans.find((s) => s);
  const IconComponent = getIconForSpanType(firstSpan?.type);

  // Indices
  const baseRowIndex = rowIndexes[0];
  const compareIndexes = rowIndexes.slice(1);

  return (
    <div className="w-full h-full flex flex-col">
      {/* top bar => icon + spanName, then toggles on the right */}
      <div className="flex items-center justify-between mb-2 border-b pb-2">
        <div className="flex items-center gap-2">
          {IconComponent && <IconComponent className="h-5 w-5 text-primary" />}
          <p className="text-base font-semibold text-foreground">{spanName}</p>
        </div>
        <div className="flex items-center gap-2">          <ActionButton
            tooltip={hideIdentical ? "Show identical" : "Hide identical"}
            variant="ghost"
            size="icon"
            icon={hideIdentical ? <EyeOff /> : <Eye />}
            onClick={handleToggleHide}
          />
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
      </div>

      <div className="overflow-auto flex-1 p-2">
        <Accordion
          type="multiple"
          value={openItems}
          onValueChange={setOpenItems}
        >
          {fields.map(({ id, label }) => {
            // Gather base + comps
            const baseVal = baseSpan ? (baseSpan as any)[id] : undefined;
            const compVals = comparableSpans.map((s) => s ? (s as any)[id] : undefined);

            // Hide identical => skip if all match top-level
            if (hideIdentical && isAllIdentical(baseVal, compVals)) {
              return null;
            }

            // Determine an icon from the sample
            let sample = baseVal ?? compVals.find((v) => v !== undefined);
            if (!sample) sample = ""; // fallback
            const type = getValueType(sample);
            const icon = getTypeIcon(type);

            // Actually render the specialized multi-value view
            const content = getMultiValueView(
              baseVal,
              compVals,
              baseRowIndex,
              compareIndexes
            );

            return (
              <AccordionItem key={id} value={id}>
                <AccordionTrigger>
                  <span className="inline-flex items-center gap-2">
                    {icon}
                    {label}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  {content}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </div>
  );
}

function getMergedSpanType(ms: MergedSpan): string | undefined {
  if (ms.baseSpan?.type) return ms.baseSpan.type;
  for (const c of ms.comparableSpans) {
    if (c?.type) return c.type;
  }
  return undefined;
}

function buildMergedFlow(
  merges: MergedSpan[],
  rowIndexes: number[],
  depth = 0,
  row = 0,
  parentId?: string
): { nodes: Node[]; edges: Edge[]; usedRows: number } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let localUsedRows = 0;

  function layoutSpan(merge: MergedSpan, depth: number, row: number, parentId?: string): number {
    const nodeId = `${merge.spanName}-d${depth}-r${row}`;
    const theType = getMergedSpanType(merge);
    const IconComponent = getIconForSpanType(theType);

    const usedRows: number[] = [];
    if (merge.baseSpan) usedRows.push(rowIndexes[0]);
    merge.comparableSpans.forEach((c, i) => {
      if (c) usedRows.push(rowIndexes[i + 1]);
    });
    const rowString = usedRows.sort((a, b) => a - b).join(", ");

    nodes.push({
      id: nodeId,
      position: { x: depth * 320, y: row * 120 },
      type: "multiSpan",
      data: {
        spanName: merge.spanName,
        inBase: !!merge.baseSpan,
        rowString,
        icon: IconComponent,
      },
      draggable: false,
      connectable: false,
      selectable: false,
    });

    if (parentId) {
      edges.push({
        id: `edge-${parentId}--${nodeId}`,
        source: parentId,
        target: nodeId,
        type: "smoothstep",
      });
    }

    let used = 1;
    let childRow = row;
    if (merge.children?.length) {
      for (const child of merge.children) {
        const subUsed = layoutSpan(child, depth + 1, childRow, nodeId);
        childRow += subUsed;
        used += subUsed;
      }
    }
    return used;
  }

  merges.forEach((m) => {
    const subUsed = layoutSpan(m, depth, row, parentId);
    row += subUsed;
    localUsedRows += subUsed;
  });

  return { nodes, edges, usedRows: localUsedRows };
}

export interface MultiTraceViewProps {
  allTraces: Span[][];
  rowIndexes: number[];
}

export default function MultiTraceView({ allTraces, rowIndexes }: MultiTraceViewProps) {
  // unify => MergedSpan[] root nodes
  const mergedData = useMemo(() => unifyByName(allTraces), [allTraces]);

  // expansions for left collapsible
  const [expansions, setExpansions] = useState<Record<string, boolean>>({});

  // selected node => detail on right
  const [selectedNode, setSelectedNode] = useState<MergedSpan | null>(null);

  // timeline & flow
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [flowOpen, setFlowOpen] = useState(false);

  // timeline data
  const timelineData = useMemo(() => unifyTracesForChart(allTraces), [allTraces]);

  // flow
  const { nodes, edges } = useMemo(
    () => buildMergedFlow(mergedData, rowIndexes),
    [mergedData, rowIndexes]
  );

  return (
    <div className="border rounded-md bg-background p-4 space-y-4 w-full">
      {/* Header => Title + Timeline & Flow */}
      <div className="flex items-center justify-between">
        <p className="text-lg font-bold">Trace View</p>
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

      {/* Main layout => left collapsible, right detail */}
      <div style={{ display: "flex", flexDirection: "row", height: "600px", gap: "1rem" }}>
        {/* Left => merges */}
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
          {mergedData.map((root, idx) => (
            <CollapsibleMergedNode
              key={idx}
              node={root}
              depth={0}
              expansions={expansions}
              setExpansions={setExpansions}
              onSelectNode={setSelectedNode}
              selectedNode={selectedNode}
              rowIndexes={rowIndexes}
            />
          ))}
        </div>

        {/* Right => detail panel => specialized multi-value views */}
        <div
          style={{
            flex: "1 1 auto",
            overflowY: "auto",
            border: "1px solid var(--muted)",
            borderRadius: "0.25rem",
            padding: "0.5rem",
          }}
        >
          {selectedNode ? (
            <MultiDetailPanel node={selectedNode} rowIndexes={rowIndexes} />
          ) : (
            <p className="text-sm italic text-muted-foreground">
              Select a node from the left
            </p>
          )}
        </div>
      </div>

      {/* Timeline Dialog */}
      <Dialog open={timelineOpen} onOpenChange={setTimelineOpen}>
        <DialogContent className="w-[80vw] h-[80vh] max-w-none max-h-none p-4">
          <DialogHeader>
            <DialogTitle>Combined Timeline</DialogTitle>
            <DialogDescription>
              A timeline of all spans across multiple runs
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 h-full overflow-auto">
            <ChartContainer config={{}} className="w-full h-full">
              <BarChart
                data={timelineData}
                layout="vertical"
                barSize={24}
                margin={{ left: 140, right: 40, top: 20, bottom: 20 }}
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
                  tickFormatter={(v) => `${v.toFixed(1)}s`}
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
                {allTraces.map((_, i) => {
                  const fillColor = colorPalette[i % colorPalette.length];
                  return (
                    <React.Fragment key={i}>
                      <Bar dataKey={`start-${i}`} stackId={`range-${i}`} fill="transparent" />
                      <Bar
                        dataKey={`length-${i}`}
                        stackId={`range-${i}`}
                        fill={fillColor}
                        radius={[4, 4, 4, 4]}
                      >
                        <LabelList
                          dataKey={`length-${i}`}
                          position="right"
                          formatter={(val: number) => `${val.toFixed(2)}s`}
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

      {/* Flow Dialog => single merged flow */}
      <Dialog open={flowOpen} onOpenChange={setFlowOpen}>
        <DialogContent className="w-[80vw] h-[80vh] max-w-none max-h-none p-4 flex flex-col">
          <DialogHeader>
            <DialogTitle>Single Merged Flow</DialogTitle>
            <DialogDescription>
              A single flow that merges all spans from base + comparables
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto mt-4 border rounded-md relative bg-muted/10">
            <ReactFlowProvider>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={{ multiSpan: MultiSpanNode }}
                fitView
                proOptions={{ hideAttribution: true }}
              >
                <Background />
                <Controls />
                <MiniMap
                  pannable
                  nodeColor="var(--primary)"
                  nodeStrokeColor="var(--foreground)"
                />
              </ReactFlow>
            </ReactFlowProvider>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}