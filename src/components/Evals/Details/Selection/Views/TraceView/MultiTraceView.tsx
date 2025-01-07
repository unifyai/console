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
  FileText,
  CaseLower,
  Pilcrow,
  Columns,
  AlignJustify,
  Eye,
  EyeOff,
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

import DiffViewer from "@/components/Common/Misc/DiffViewer";
import MultiSpanNode from "./nodes/MultiSpanNode"; 
import { unifyByName, unifyTracesForChart, colorPalette } from "./unify";
import type { Span } from "@/types/evals/traces";


interface MergedSpan {
  spanName: string;
  baseSpan?: Span;
  comparableSpans: (Span | undefined)[];
  children: MergedSpan[];
}

interface MultiTraceViewProps {
  allTraces: Span[][]; 
  rowIndexes: number[];
}

function compressRowNumbers(rows: number[]): string {
  if (!rows.length) return "";
  const sorted = [...rows].sort((a, b) => a - b);

  const ranges: string[] = [];
  let start = sorted[0];
  let end = start;

  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    if (cur === end + 1) {
      end = cur;
    } else {
      if (start === end) {
        ranges.push(String(start));
      } else {
        ranges.push(`${start}-${end}`);
      }
      start = cur;
      end = cur;
    }
  }
  if (start === end) {
    ranges.push(String(start));
  } else {
    ranges.push(`${start}-${end}`);
  }
  return ranges.join(",");
}


function CollapsibleMergedNode({
  node,
  depth,
  expansions,
  setExpansions,
  onSelectNode,
  selectedNode,
  rowIndexes,
}: {
  node: MergedSpan;
  depth: number;
  expansions: Record<string, boolean>;
  setExpansions: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onSelectNode: (n: MergedSpan) => void;
  selectedNode?: MergedSpan;
  rowIndexes: number[];
}) {
  const { spanName, baseSpan, comparableSpans, children } = node;
  const hasChildren = children && children.length > 0;

  // We'll build a stable ID for expansions
  const nodeId = `${spanName}-${baseSpan?.id ?? "no-base"}`;
  const isExpanded = expansions[nodeId] ?? true;
  const canCollapse = depth >= 1 && hasChildren;

  // color-coded text
  const inBase = !!baseSpan;
  const textColor = inBase ? "text-red-600" : "text-green-600";

  // gather row indexes
  const rowList: number[] = [];
  if (baseSpan) rowList.push(rowIndexes[0]);
  comparableSpans.forEach((c, i) => {
    if (c) {
      rowList.push(rowIndexes[i + 1]);
    }
  });
  const rowString = compressRowNumbers(rowList);

  // check if selected in the tree
  const isSelected = selectedNode === node;

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
        {isSelected ? <ChevronsLeftRightEllipsis className="w-4 h-4 text-primary-foreground" /> : <ChevronsLeftRightEllipsis className="w-4 h-4 text-primary" />}
        <span className={`font-medium text-sm ${textColor}`}>
          {spanName}
        </span>
        {rowString && (
          <span className="text-xs text-muted-foreground ml-2">
            Rows: {rowString}
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


function groupComparablesByValue(
  comparables: (Span | undefined)[],
  rowIndexes: number[],
  getValue: (s: Span | undefined) => string
) {
  const map = new Map<string, number[]>();
  comparables.forEach((comp, i) => {
    const txt = getValue(comp);
    const compRow = rowIndexes[i + 1];
    const arr = map.get(txt) || [];
    arr.push(compRow);
    map.set(txt, arr);
  });
  return Array.from(map.entries()).map(([text, rows]) => ({ text, rows }));
}


function MergedFieldDiff({
  label,
  baseVal,
  comparables,
  rowIndexes,
  diffMode,
  splitView,
  hideIdentical,
  getValue,
}: {
  label: string;
  baseVal: Span | undefined;
  comparables: (Span | undefined)[];
  rowIndexes: number[];
  diffMode: "lines" | "words" | "characters";
  splitView: boolean;
  hideIdentical: boolean;
  getValue: (s: Span | undefined) => string;
}) {
  const baseText = getValue(baseVal);

  // if base + comps are all empty => skip entirely
  const allEmpty = !baseText && comparables.every((c) => !getValue(c));
  if (allEmpty) return null;

  // group comps by identical text
  const groups = groupComparablesByValue(comparables, rowIndexes, getValue);
  // if hideIdentical and everything matches base => skip
  if (hideIdentical && groups.length === 1 && groups[0].text === baseText) {
    return null;
  }

  return (
    <div className="bg-secondary/10 border p-2 rounded space-y-2 mb-4">
      <p className="font-medium text-sm">{label}</p>
      {comparables.length === 0 ? (
        <pre className="ml-2 text-sm">{baseText}</pre>
      ) : (
        groups.map((g, i) => {
          const rowSet = compressRowNumbers(g.rows);
          return (
            <div key={i} className="ml-2 border-l pl-2 mb-2">
              <p className="text-xs text-muted-foreground mb-1">
                Diff row {rowIndexes[0]} with row(s) {rowSet}
              </p>
              <DiffViewer
                oldValue={baseText}
                newValue={g.text}
                splitView={splitView}
                mode={diffMode}
                hideLineNumbers
                hideMarkers
                showDiffOnly={false}
              />
            </div>
          );
        })
      )}
    </div>
  );
}


function MultiDetailPanel({
  node,
  rowIndexes,
}: {
  node: MergedSpan;
  rowIndexes: number[];
}) {
  const [modeIndex, setModeIndex] = useState(0);
  const diffModes = ["lines", "words", "characters"] as const;
  const modeIcons = [<FileText key="f"/>, <CaseLower key="c"/>, <Pilcrow key="p"/>];
  const diffMode = diffModes[modeIndex];

  const [splitView, setSplitView] = useState(false);
  const [hideIdentical, setHideIdentical] = useState(false);

  const handleCycleMode = () => setModeIndex((prev) => (prev + 1) % diffModes.length);
  const handleToggleSplit = () => setSplitView((p) => !p);
  const handleToggleHide = () => setHideIdentical((p) => !p);

  const { spanName, baseSpan, comparableSpans } = node;
  if (!baseSpan && comparableSpans.every((c) => !c)) {
    return <p className="p-2 italic text-sm">No data in this node</p>;
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Name + toggles */}
      <div className="flex items-center justify-between mb-2 border-b pb-2">
        <p className="text-base font-semibold text-foreground">
          {spanName}
        </p>
        <div className="flex items-center gap-2">
          <ActionButton
            tooltip={`Diff mode (${diffMode})`}
            variant="ghost"
            size="icon"
            icon={modeIcons[modeIndex]}
            onClick={handleCycleMode}
          />
          <ActionButton
            tooltip={splitView ? "Inline diffs" : "Split diffs"}
            icon={splitView ? <Columns/> : <AlignJustify/>}
            variant="ghost"
            size="icon"
            onClick={handleToggleSplit}
          />
          <ActionButton
            tooltip={hideIdentical ? "Show identical" : "Hide identical"}
            icon={hideIdentical ? <EyeOff/> : <Eye/>}
            variant="ghost"
            size="icon"
            onClick={handleToggleHide}
          />
        </div>
      </div>

      {/* diffs */}
      <div className="overflow-auto flex-1 p-2">
        <MergedFieldDiff
          label="Offset"
          baseVal={baseSpan}
          comparables={comparableSpans}
          rowIndexes={rowIndexes}
          diffMode={diffMode}
          splitView={splitView}
          hideIdentical={hideIdentical}
          getValue={(s) => s?.offset != null ? String(s.offset) : ""}
        />

        <MergedFieldDiff
          label="Exec Time"
          baseVal={baseSpan}
          comparables={comparableSpans}
          rowIndexes={rowIndexes}
          diffMode={diffMode}
          splitView={splitView}
          hideIdentical={hideIdentical}
          getValue={(s) => s?.exec_time != null ? String(s.exec_time) : ""}
        />

        {(baseSpan?.errors || comparableSpans.some(c => c?.errors)) && (
          <MergedFieldDiff
            label="Errors"
            baseVal={baseSpan}
            comparables={comparableSpans}
            rowIndexes={rowIndexes}
            diffMode={diffMode}
            splitView={splitView}
            hideIdentical={hideIdentical}
            getValue={(s) => s?.errors ?? ""}
          />
        )}

        <MergedFieldDiff
          label="Inputs"
          baseVal={baseSpan}
          comparables={comparableSpans}
          rowIndexes={rowIndexes}
          diffMode={diffMode}
          splitView={splitView}
          hideIdentical={hideIdentical}
          getValue={(s) => JSON.stringify(s?.inputs ?? {}, null, 2)}
        />

        <MergedFieldDiff
          label="Outputs"
          baseVal={baseSpan}
          comparables={comparableSpans}
          rowIndexes={rowIndexes}
          diffMode={diffMode}
          splitView={splitView}
          hideIdentical={hideIdentical}
          getValue={(s) => JSON.stringify(s?.outputs ?? {}, null, 2)}
        />
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// buildMergedFlow => single merged flow from MergedSpan[] + rowIndexes
// -----------------------------------------------------------------------------
function buildMergedFlow(
  merges: MergedSpan[],
  rowIndexes: number[],
  depth=0,
  row=0,
  parentId?: string
): { nodes: Node[]; edges: Edge[]; usedRows: number } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let localUsedRows = 0;

  function layoutSpan(
    merge: MergedSpan,
    depth: number,
    row: number,
    rowIndexes: number[],
    parentId?: string
  ): number {
    // Is it in base?
    const inBase = !!merge.baseSpan;

    // gather the actual row indexes for display
    const actualRows: number[] = [];
    if (merge.baseSpan) actualRows.push(rowIndexes[0]);
    merge.comparableSpans.forEach((c, i) => {
      if (c) actualRows.push(rowIndexes[i + 1]);
    });
    const rowString = compressRowNumbers(actualRows);

    // node id
    const nodeId = `${merge.spanName}-d${depth}-r${row}-b${inBase?"1":"0"}`;
    nodes.push({
      id: nodeId,
      position: { x: depth*320, y: row*120 },
      type: "multiSpan",
      data: {
        spanName: merge.spanName,
        inBase,
        rowString,
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
        const subUsed = layoutSpan(child, depth+1, childRow, rowIndexes, nodeId);
        childRow += subUsed;
        used += subUsed;
      }
    }
    return used;
  }

  let currentRow = row;
  merges.forEach((m) => {
    const subUsed = layoutSpan(m, depth, currentRow, rowIndexes, parentId);
    currentRow += subUsed;
    localUsedRows += subUsed;
  });

  return { nodes, edges, usedRows: localUsedRows };
}

// -----------------------------------------------------------------------------
// The main MultiTraceView
// -----------------------------------------------------------------------------
export default function MultiTraceView({
  allTraces,
  rowIndexes
}: MultiTraceViewProps) {

  // 1) unify => array of MergedSpan roots
  const mergedData = useMemo(() => unifyByName(allTraces), [allTraces]);

  // 2) expansions for left collapsible
  const [expansions, setExpansions] = useState<Record<string, boolean>>({});

  // 3) selected node => detail
  const [selectedNode, setSelectedNode] = useState<MergedSpan | null>(null);

  // 4) sub-dialog states
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [flowOpen, setFlowOpen] = useState(false);

  // 5) timeline data
  const timelineData = useMemo(() => unifyTracesForChart(allTraces), [allTraces]);

  // 6) single merged flow from MergedSpan[]
  const { nodes, edges } = useMemo(
    () => buildMergedFlow(mergedData, rowIndexes),
    [mergedData, rowIndexes]
  );

  return (
    <div className="border rounded-md bg-background p-4 space-y-4 w-full">
      {/* Header row: timeline + flow */}
      <div className="flex items-center justify-between">
        <p className="text-lg font-bold">
          Trace View
        </p>
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

      {/* Main layout => left collapsible, right detail diffs */}
      <div style={{ display: "flex", flexDirection: "row", height: "600px", gap: "1rem" }}>
        {/* Left => collapsible tree */}
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
              selectedNode={selectedNode || undefined}
              rowIndexes={rowIndexes}
            />
          ))}
        </div>

        {/* Right => detail diff panel */}
        <div
          style={{
            flex:"1 1 auto",
            overflowY:"auto",
            border:"1px solid var(--muted)",
            borderRadius:"0.25rem",
            padding:"0.5rem",
          }}
        >
          {selectedNode ? (
            <MultiDetailPanel
              node={selectedNode}
              rowIndexes={rowIndexes}
            />
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
                margin={{ left:140, right:40, top:20, bottom:20 }}
              >
                <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" horizontal={false}/>
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
                  tickFormatter={(v)=> `${v.toFixed(1)}s`}
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
                {allTraces.map((_, i) => {
                  const fillColor= colorPalette[i % colorPalette.length];
                  return (
                    <React.Fragment key={i}>
                      <Bar dataKey={`start-${i}`} stackId={`range-${i}`} fill="transparent"/>
                      <Bar dataKey={`length-${i}`} stackId={`range-${i}`} fill={fillColor} radius={[4,4,4,4]}>
                        <LabelList
                          dataKey={`length-${i}`}
                          position="right"
                          formatter={(val:number)=> `${val.toFixed(2)}s`}
                          fill="#4B5563"
                          style={{ fontSize:"0.75rem"}}
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
                proOptions={{ hideAttribution:true }}
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