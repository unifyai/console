"use client";
import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/UI/accordion";
import { Combobox } from "@/components/UI/Combobox";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Span } from "@/types/evals/traces";
import {
  computeSpanDiffByName,
  wrapAsRootSpan,
  PatchDiffNode,
} from "./computeDiff";

import getIconForSpanType from "./IconSelection";

import DictionaryView from "../DictionaryView";
import ListView from "../ListView";
import ImageView from "../ImageView";
import MatrixView from "../MatrixView";
import StringView from "../StringView";
import NumberView from "../NumberView";
import TimestampView from "../TimestampView";
import ExecutionTimeView from "../ExecutionTimeView";

import { isDict, isList, isMatrix, isImage, isNumber, isTimestamp, isChat } from "@/utils/evals/selection";

import { CopyButton } from "@/components/Common/Buttons/Copy";
import { LogComparisonProps } from "../types";
import Tooltip from "@/components/Common/Misc/Tooltip";
import ChatView from "../ChatView";

/*------------------------------------------------------------------------
  Helper functions for compressing row indices => "1-3,5,7-9", etc.
------------------------------------------------------------------------*/
function compressRowNumbers(rows: number[]): string {
  if (!rows.length) return "";
  const sorted = [...rows].sort((a, b) => a - b);

  const ranges: string[] = [];
  let start = sorted[0];
  let end = start;
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    if (current === end + 1) {
      end = current;
    } else {
      if (start === end) {
        ranges.push(String(start));
      } else {
        ranges.push(`${start}-${end}`);
      }
      start = current;
      end = current;
    }
  }
  if (start === end) {
    ranges.push(String(start));
  } else {
    ranges.push(`${start}-${end}`);
  }
  return ranges.join(", ");
}

function labelForRows(rows: number[]): string {
  if (!rows.length) return "--";
  const compressed = compressRowNumbers(rows);
  return rows.length === 1 ? `Row ${compressed}` : `Rows ${compressed}`;
}

/*---------------------------------------------------------------------
  Basic checks for empty usage
---------------------------------------------------------------------*/
function isEmptyValue(val: any): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === "string" && val.trim() === "") return true;
  if (Array.isArray(val) && val.length === 0) return true;
  if (isDict(val) && Object.keys(val).length === 0) return true;
  return false;
}
function allEmpty(baseVal: any, comps: any[]): boolean {
  if (!comps) comps = [];
  if (!isEmptyValue(baseVal)) return false;
  for (const c of comps) {
    if (!isEmptyValue(c)) {
      return false;
    }
  }
  return true;
}

/*---------------------------------------------------------------------
  pickView => local helper that chooses which specialized component
---------------------------------------------------------------------*/
function pickView(
  baseVal: any,
  comps: any[],
  baseLogIndex: number,
  comparisonLogsIndex: number[],
  diffMode: LogComparisonProps["diffMode"],
  splitView: LogComparisonProps["splitView"]
): JSX.Element {
  if (isChat(baseVal)) {
    return (
      <ChatView
        value={baseVal}
        comparables={comps}
        baseLogIndex={baseLogIndex}
        comparisonLogsIndex={comparisonLogsIndex}
        diffMode={diffMode ?? "none"}
        splitView={splitView ?? false}
      />
    );
  }
  if (isDict(baseVal)) {
    return (
      <DictionaryView
        value={baseVal}
        comparables={comps}
        baseLogIndex={baseLogIndex}
        comparisonLogsIndex={comparisonLogsIndex}
        diffMode={diffMode ?? "none"}
        splitView={splitView ?? false}
      />
    );
  }
  if (isList(baseVal)) {
    return (
      <ListView
        value={baseVal}
        comparables={comps}
        baseLogIndex={baseLogIndex}
        comparisonLogsIndex={comparisonLogsIndex}
        diffMode={diffMode ?? "none"}
        splitView={splitView ?? false}
      />
    );
  }
  if (isImage(baseVal)) {
    return (
      <ImageView
        value={baseVal}
        comparables={comps}
        baseLogIndex={baseLogIndex}
        comparisonLogsIndex={comparisonLogsIndex}
        diffMode={diffMode ?? "none"}
        splitView={splitView ?? false}
      />
    );
  }
  if (isMatrix(baseVal)) {
    return (
      <MatrixView
        value={baseVal}
        comparables={comps}
        baseLogIndex={baseLogIndex}
        comparisonLogsIndex={comparisonLogsIndex}
        diffMode={diffMode ?? "none"}
        splitView={splitView ?? false}
      />
    );
  }
  if (isNumber(baseVal)) {
    return (
      <NumberView
        value={baseVal}
        comparables={comps}
        baseLogIndex={baseLogIndex}
        comparisonLogsIndex={comparisonLogsIndex}
        diffMode={diffMode ?? "none"}
        splitView={splitView ?? false}
      />
    );
  }
  if (isTimestamp(baseVal)) {
    return (
      <TimestampView
        value={baseVal}
        comparables={comps}
        baseLogIndex={baseLogIndex}
        comparisonLogsIndex={comparisonLogsIndex}
        diffMode={diffMode ?? "none"}
        splitView={splitView ?? false}
      />
    );
  }
  // Fallback => string
  return (
    <StringView
      value={baseVal}
      comparables={comps}
      baseLogIndex={baseLogIndex}
      comparisonLogsIndex={comparisonLogsIndex}
      diffMode={diffMode ?? "none"}
      splitView={splitView ?? false}
    />
  );
}

/*---------------------------------------------------------------------
  PatchDetailPanel => right pane details for a single Span
---------------------------------------------------------------------*/
function PatchDetailPanel({
  node,
  baseRowIndex,
  comparisonLogsIndex,
  allTraces,
  allRowIndexes,
  diffMode,
  splitView,
}: {
  node: PatchDiffNode;
  baseRowIndex: number;
  comparisonLogsIndex: number[];
  allTraces: Span[][];
  allRowIndexes: number[];
  diffMode?: LogComparisonProps["diffMode"];
  splitView?: LogComparisonProps["splitView"];
}) {
  if (!node.baseSpanRef && !node.targetSpanRef) {
    return <p className="italic text-sm">No base or target data</p>;
  }
  const mainSpan = node.baseSpanRef || node.targetSpanRef;
  const spanId = mainSpan?.id ?? "(no id)";

  /**
   * gatherField => collects base+comps for a specific field ("inputs","outputs", etc.)
   */
  function gatherField(field: string) {
    const bSpan = node.baseSpanRef;
    const tSpan = node.targetSpanRef;

    // If both references are actually the same object, just show that once
    if (bSpan && tSpan && bSpan === tSpan) {
      return { baseVal: bSpan[field], comps: [] };
    }

    // Otherwise differ by marker
    switch (node.marker) {
      case "+":
        return { baseVal: tSpan?.[field], comps: [] };
      case "-":
        return { baseVal: bSpan?.[field], comps: [] };
      case "r":
      case " ":
        // Possibly multiple comparisons
        if (comparisonLogsIndex.length <= 1) {
          const b = bSpan?.[field];
          const t = tSpan ? tSpan[field] : undefined;
          return { baseVal: b, comps: t !== undefined ? [t] : [] };
        }
        // If we have multiple comp rows, find that span by name in each row
        const realName = bSpan?.span_name || tSpan?.span_name || node.name;
        const baseVal = bSpan?.[field];
        const compsArr = comparisonLogsIndex.map((r) => {
          const match = findSpanByNameInRow(allTraces, allRowIndexes, r, realName);
          return match?.[field];
        });
        return { baseVal, comps: compsArr };
      default:
        return { baseVal: undefined, comps: [] };
    }
  }

  // findSpanByNameInRow => BFS in that row's trace looking for matching name
  function findSpanByNameInRow(
    traces: Span[][],
    rowIndexes: number[],
    rowIndex: number,
    spanName: string
  ): Span | undefined {
    const i = rowIndexes.indexOf(rowIndex);
    if (i < 0) return undefined;
    const rowSpans = traces[i];
    if (!rowSpans) return undefined;
    const queue = [...rowSpans];
    while (queue.length) {
      const s = queue.shift()!;
      if (s.span_name === spanName) {
        return s;
      }
      if (s.child_spans) {
        queue.push(...s.child_spans);
      }
    }
    return undefined;
  }

  function maybeRenderBlock(
    title: string,
    baseVal: any,
    comps: any[],
    isAccordionItem?: boolean
  ) {
    if (allEmpty(baseVal, comps)) return null;
    const view = pickView(
      baseVal,
      comps,
      baseRowIndex,
      comparisonLogsIndex,
      diffMode ?? "none",
      splitView ?? false
    );
    if (isAccordionItem) {
      return (
        <AccordionItem key={title} value={title}>
          <AccordionTrigger className="font-medium">{title}</AccordionTrigger>
          <AccordionContent className="pl-2 border-l">
            {view}
          </AccordionContent>
        </AccordionItem>
      );
    }
    return (
      <div key={title}>
        <p className="font-semibold text-sm mb-2">{title}</p>
        <div className="border border-muted p-2 rounded">{view}</div>
      </div>
    );
  }

  // Gather standard fields
  const { baseVal: bInputs, comps: cInputs } = gatherField("inputs");
  const { baseVal: bOutputs, comps: cOutputs } = gatherField("outputs");
  const { baseVal: bExecTime, comps: cExecTime } = gatherField("exec_time");
  const { baseVal: bCode, comps: cCode } = gatherField("code");
  const { baseVal: bErrors, comps: cErrors } = gatherField("errors");

  // Possibly also show ID as a separate block
  function gatherID() {
    const bSpan = node.baseSpanRef;
    const tSpan = node.targetSpanRef;
    if (bSpan && tSpan && bSpan === tSpan) {
      return { baseVal: bSpan.id ?? "", comps: [] };
    }
    if (comparisonLogsIndex.length <= 1) {
      const bId = bSpan?.id ?? "";
      const tId = tSpan?.id ?? "";
      return tId ? { baseVal: bId, comps: [tId] } : { baseVal: bId, comps: [] };
    }
    const realName = bSpan?.span_name || tSpan?.span_name || node.name;
    const bId = bSpan?.id ?? "";
    const compsArr = comparisonLogsIndex.map((r) => {
      const match = findSpanByNameInRow(allTraces, allRowIndexes, r, realName);
      return match?.id ?? "";
    });
    return { baseVal: bId, comps: compsArr };
  }
  const { baseVal: bId, comps: cId } = gatherID();

  // Render blocks
  const contentBlocks: JSX.Element[] = [];
  const block1 = maybeRenderBlock("Inputs", bInputs, cInputs, false);
  if (block1) contentBlocks.push(block1);
  const block2 = maybeRenderBlock("Outputs", bOutputs, cOutputs, false);
  if (block2) contentBlocks.push(block2);

  // Add execution time with consistent block styling
  if (!allEmpty(bExecTime, cExecTime)) {
    contentBlocks.push(
      <div key="execution-time">
        <p className="font-semibold text-sm mb-2">Execution Time</p>
        <div className="border border-muted p-2 rounded">
          <ExecutionTimeView
            value={bExecTime}
            comparables={cExecTime}
            baseLogIndex={baseRowIndex}
            comparisonLogsIndex={comparisonLogsIndex}
            diffMode={diffMode}
            splitView={splitView}
          />
        </div>
      </div>
    );
  }

  const accordionItems: JSX.Element[] = [];
  const codeBlock = maybeRenderBlock("Code", bCode, cCode, true);
  if (codeBlock) accordionItems.push(codeBlock);
  const errorsBlock = maybeRenderBlock("Errors", bErrors, cErrors, true);
  if (errorsBlock) accordionItems.push(errorsBlock);
  const idsBlock = maybeRenderBlock("IDs", bId, cId, true);
  if (idsBlock) accordionItems.push(idsBlock);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="font-bold text-sm">{node.name}</p>
        <CopyButton
          content={spanId}
          copyMessage="Copied trace ID!"
          tooltipContent="Copy Base Span ID"
        />
      </div>

      {contentBlocks.map((blockEl) => blockEl)}

      {accordionItems.length > 0 && (
        <Accordion type="multiple" defaultValue={[]} className="mt-3">
          {accordionItems}
        </Accordion>
      )}
    </div>
  );
}

/*---------------------------------------------------------------------
  CollapsiblePatchLineNode => the left tree node
  (Single vs multi-mode exec-time logic in "timeLabel"/"timeTooltip")
---------------------------------------------------------------------*/
function CollapsiblePatchLineNode({
  node,
  parentCenterY,
  depth,
  collapsedNodes,
  setCollapsedNodes,
  selectedNode,
  onSelectNode,
  multiMode,
}: {
  node: PatchDiffNode;
  parentCenterY: number;
  depth: number;
  collapsedNodes: Record<string, boolean>;
  setCollapsedNodes: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  selectedNode: PatchDiffNode | null;
  onSelectNode: (n: PatchDiffNode | null) => void;
  multiMode: boolean;
}) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [segmentHeight, setSegmentHeight] = useState(0);

  const ROW_HEIGHT = 32;
  const BOX_SIZE = 24;
  const children = node.children ?? [];

  useEffect(() => {
    if (!nodeRef.current) return;
    const rect = nodeRef.current.getBoundingClientRect();
    const childCenterY = rect.y + ROW_HEIGHT / 2;
    setSegmentHeight(childCenterY - parentCenterY);
  }, [parentCenterY, collapsedNodes]);

  // Marker => for color
  const markerColors: Record<string, string> = {
    "+": "text-green-600",
    "-": "text-red-600",
    r: "text-purple-600",
    " ": "",
  };

  const isSelected = selectedNode === node;
  const nodeId = `${node.name}_${node.baseSpanRef?.id ?? ""}_${node.targetSpanRef?.id ?? ""}`;
  const hasChildren = children.length > 0;
  const isCollapsed = collapsedNodes[nodeId] === true;

  const colorClass = isSelected
    ? "bg-primary text-primary-foreground"
    : `hover:bg-muted ${markerColors[node.marker]}`;

  function handleToggleCollapse(e: React.MouseEvent) {
    e.stopPropagation();
    setCollapsedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  }

  function handleClickSpan() {
    onSelectNode(isSelected ? null : node);
  }

  const showLine = depth > 0;
  const spanType = node.baseSpanRef?.type ?? node.targetSpanRef?.type;
  const IconComponent = getIconForSpanType(spanType);

  //========================
  // Execution Time
  //========================
  const baseTime = node.baseSpanRef?.exec_time ?? 0;
  const targetTime = node.targetSpanRef?.exec_time ?? 0;

  let timeLabel = "";
  let timeTooltip = "";

  if (!multiMode) {
    if (baseTime) {
      timeLabel = `${baseTime.toFixed(2)}s`;
      timeTooltip = `Execution Time ${baseTime.toFixed(2)}s`;
    }
  } else {
    if (node.marker === "+") {
      if (targetTime) {
        timeLabel = `${targetTime.toFixed(2)}s`;
        timeTooltip = `Execution Time (Comparison Only): ${targetTime.toFixed(2)}s`;
      }
    } else if (node.marker === "-") {
      if (baseTime) {
        timeLabel = `${baseTime.toFixed(2)}s`;
        timeTooltip = `Execution Time (Base Only): ${baseTime.toFixed(2)}s`;
      }
    } else {
      // marker " " or "r"
      const diff = targetTime - baseTime;
      if (baseTime || targetTime) {
        const sign = diff >= 0 ? "+" : "-";
        const absDiff = Math.abs(diff).toFixed(2);
        timeLabel = `${sign}${absDiff}s`;
        timeTooltip =
          `Execution Times\n` +
          `Base ${baseTime.toFixed(2)}s\n` +
          `Comparison ${targetTime.toFixed(2)}s\n` +
          `Difference ${sign}${absDiff}s`;
        if (!baseTime && !targetTime) {
          timeLabel = "";
          timeTooltip = "";
        }
      }
    }
  }

  //========================
  // Cost (similar to exec_time)
  //========================
  const baseCost = node.baseSpanRef?.cost ?? 0;
  const baseCostIncCache = node.baseSpanRef?.cost_inc_cache ?? 0;
  const targetCost = node.targetSpanRef?.cost ?? 0;
  const targetCostIncCache = node.targetSpanRef?.cost_inc_cache ?? 0;

  let costLabel = "";
  let costTooltip = "";

  if (!multiMode) {
    if (baseCost > 0 || baseCostIncCache > 0) {
      costLabel = `$${baseCost.toFixed(4)}`;
      costTooltip = `LLM cost $${baseCost.toFixed(4)}\nIncluding cache: $${baseCostIncCache.toFixed(4)}`;
    }
  } else {
    if (node.marker === "+") {
      if (targetCost > 0 || targetCostIncCache > 0) {
        costLabel = `$${targetCost.toFixed(4)}`;
        costTooltip = `LLM cost (Comparison Only): $${targetCost.toFixed(4)}\nIncluding cache: $${targetCostIncCache.toFixed(4)}`;
      }
    } else if (node.marker === "-") {
      if (baseCost > 0 || baseCostIncCache > 0) {
        costLabel = `$${baseCost.toFixed(4)}`;
        costTooltip = `LLM cost (Base Only): $${baseCost.toFixed(4)}\nIncluding cache: $${baseCostIncCache.toFixed(4)}`;
      }
    } else {
      // marker " " or "r"
      if (baseCost || targetCost || baseCostIncCache || targetCostIncCache) {
        const diffC = targetCost - baseCost;
        const signC = diffC >= 0 ? "+" : "-";
        const absDiffC = Math.abs(diffC).toFixed(4);
        costLabel = `${signC}$${absDiffC}`;
        costTooltip =
          `LLM Costs\n` +
          `Base $${baseCost.toFixed(4)} (Including cache: $${baseCostIncCache.toFixed(4)})\n` +
          `Comparison $${targetCost.toFixed(4)} (Including cache: $${targetCostIncCache.toFixed(4)})\n` +
          `Difference ${signC}$${absDiffC}`;
        if (!(baseCost || targetCost || baseCostIncCache || targetCostIncCache)) {
          costLabel = "";
          costTooltip = "";
        }
      }
    }
  }

  return (
    <div className="relative" ref={nodeRef} style={{ position: "relative" }}>
      {showLine && (
        <div
          className="absolute border-l-2 border-b-2 rounded-bl-lg"
          style={{
            height: Math.abs(segmentHeight) - ROW_HEIGHT / 2,
            top: -Math.abs(segmentHeight) + ROW_HEIGHT,
            left: -BOX_SIZE + 18,
            width: BOX_SIZE / 4,
            borderColor: "var(--muted, #888)",
          }}
        />
      )}

      <div
        className={`flex items-center gap-2 cursor-pointer rounded ${colorClass}`}
        style={{ height: ROW_HEIGHT }}
        onClick={handleClickSpan}
      >
        {IconComponent && (
          <div
            style={{ width: BOX_SIZE, height: BOX_SIZE }}
            className="flex items-center justify-center"
          >
            <Tooltip content={spanType ?? "Span"}>
              <IconComponent className="h-4 w-4" />
            </Tooltip>
          </div>
        )}

        <span className="font-medium text-sm w-3">
          {node.marker === " " ? "" : node.marker}
        </span>

        {/* Span name + optional time/cost labels */}
        <div className="truncate flex items-center">
          {node.name}
          {timeLabel && (
            <Tooltip content={timeTooltip}>
              <span className="ml-2 text-xs text-muted-foreground">
                {timeLabel}
              </span>
            </Tooltip>
          )}
          {costLabel && (
            <Tooltip content={costTooltip}>
              <span className="ml-2 text-xs text-muted-foreground">
                {costLabel}
              </span>
            </Tooltip>
          )}
        </div>

        {hasChildren && (
          <button
            className="p-1 hover:bg-secondary text-muted-foreground rounded-sm ml-auto mr-1"
            onClick={handleToggleCollapse}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        )}
        {isSelected && (
          <div
            className="absolute left-0 top-0 w-full h-full bg-primary/20"
            style={{ zIndex: -1 }}
          />
        )}
      </div>

      {!isCollapsed && (
        <div className="pl-4">
          {children.map((child, idx) => {
            const rect = nodeRef.current?.getBoundingClientRect();
            const myCenter = (rect?.y ?? 0) + ROW_HEIGHT / 2;
            return (
              <CollapsiblePatchLineNode
                key={idx}
                node={child}
                parentCenterY={myCenter}
                depth={depth + 1}
                collapsedNodes={collapsedNodes}
                setCollapsedNodes={setCollapsedNodes}
                selectedNode={selectedNode}
                onSelectNode={onSelectNode}
                multiMode={multiMode}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/*---------------------------------------------------------------------
  UnifiedTraceView => top-level trace comparison
---------------------------------------------------------------------*/
interface UnifiedTraceViewProps {
  allTraces: Span[][];
  rowIndexes: number[];
  diffMode?: LogComparisonProps["diffMode"];
  splitView?: LogComparisonProps["splitView"];
}

/**
 * We flatten out the synthetic "ROOT" node so that the UI never shows "ROOT".
 */
function flattenRootNode(root: PatchDiffNode | null): PatchDiffNode[] {
  if (!root) return [];
  if (root.name === "ROOT") {
    // Just return its children, effectively skipping the root node
    return root.children;
  }
  // Otherwise it's a normal node
  return [root];
}

/**
 * BFS to find a node matching the given ID among multiple top-level roots.
 */
function findNodeInForest(forest: PatchDiffNode[], spanId: string): PatchDiffNode | null {
  const queue = [...forest];
  while (queue.length) {
    const current = queue.shift()!;
    if (current.baseSpanRef?.id === spanId || current.targetSpanRef?.id === spanId) {
      return current;
    }
    if (current.children && current.children.length) {
      queue.push(...current.children);
    }
  }
  return null;
}

export default function UnifiedTraceView({
  allTraces,
  rowIndexes,
  diffMode = "none",
  splitView = false,
}: UnifiedTraceViewProps) {

  console.log("allTraces", allTraces);
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

  // Keep track of which node is currently selected
  const [selectedNode, setSelectedNode] = useState<PatchDiffNode | null>(null);
  const [selectedSpanId, setSelectedSpanId] = useState<string>("");

  // single vs multi
  const multiMode = rowIndexes.length > 1;

  // Base row's spans
  const baseRowSpans = useMemo(() => {
    if (!allTraces.length) return [];
    return allTraces[0] ?? [];
  }, [allTraces]);

  // Grouping logic
  const [groupSignature, setGroupSignature] = useState("");

  function minimalSpanHierarchy(span: Span): any {
    return {
      name: span.span_name,
      children: (span.child_spans ?? []).map(minimalSpanHierarchy),
    };
  }
  function minimalSpanTree(spans: Span[]): any {
    return spans.map(minimalSpanHierarchy);
  }

  const groupedRows = useMemo(() => {
    const result: { signature: string; rowIndices: number[] }[] = [];
    if (allTraces.length <= 1) return result;
    const map = new Map<string, number[]>();

    const rest = rowIndexes.slice(1);
    rest.forEach((r) => {
      const i = rowIndexes.indexOf(r);
      const shape = minimalSpanTree(allTraces[i]);
      const sig = JSON.stringify(shape);
      if (!map.has(sig)) map.set(sig, []);
      map.get(sig)!.push(r);
    });

    for (const [signature, rows] of Array.from(map.entries())) {
      rows.sort((a, b) => a - b);
      result.push({ signature, rowIndices: rows });
    }
    return result;
  }, [allTraces, rowIndexes]);

  function labelForGroupRows(rows: number[]): string {
    if (!rows.length) return "--";
    if (rows.length === 1) return `Row ${rows[0]}`;
    return `Rows ${rows.join(", ")}`;
  }

  const groupOptions = useMemo(() => {
    const arr = [{ value: "", label: "-- None --" }];
    groupedRows.forEach((g) => {
      arr.push({ value: g.signature, label: labelForGroupRows(g.rowIndices) });
    });
    return arr;
  }, [groupedRows]);

  function unifyGroupIntoOne(rowIndices: number[]): Span[] {
    if (!rowIndices.length) return [];
    const firstRow = rowIndices[0];
    const i = rowIndexes.indexOf(firstRow);
    return allTraces[i] ?? [];
  }

  // Build final patched diff
  const finalPatchRoot = useMemo<PatchDiffNode | null>(() => {
    if (!allTraces.length) return null;
    // Wrap the base row in the synthetic "ROOT"
    const baseWrapped = wrapAsRootSpan(baseRowSpans, "baseRow");
    if (!groupSignature) {
      // Compare with itself => minimal changes
      return computeSpanDiffByName(baseWrapped, baseWrapped);
    }
    const found = groupedRows.find((x) => x.signature === groupSignature);
    if (!found) {
      return computeSpanDiffByName(baseWrapped, baseWrapped);
    }
    // unify those group rows => single array
    const groupSpans = unifyGroupIntoOne(found.rowIndices);
    const groupWrapped = wrapAsRootSpan(groupSpans, "groupRow");
    return computeSpanDiffByName(baseWrapped, groupWrapped);
  }, [groupSignature, groupedRows, baseRowSpans, allTraces, rowIndexes]);

  // Decide which row(s) is the "compare" side
  const groupCompareRows = useMemo(() => {
    if (!groupSignature) return [];
    const found = groupedRows.find((g) => g.signature === groupSignature);
    if (!found) return [];
    return found.rowIndices;
  }, [groupSignature, groupedRows]);

  // Whenever finalPatchRoot changes, flatten out the "ROOT" node,
  // then find any previously selectedSpanId.
  useEffect(() => {
    if (!finalPatchRoot) return;

    // Flatten root => forest
    const forest = flattenRootNode(finalPatchRoot);

    if (!selectedSpanId) {
      // if nothing is selected, pick the first child if any
      if (forest.length > 0) {
        const candidate = forest[0];
        const newId = candidate.baseSpanRef?.id ?? candidate.targetSpanRef?.id ?? "";
        setSelectedNode(candidate);
        setSelectedSpanId(newId);
      } else {
        setSelectedNode(null);
        setSelectedSpanId("");
      }
      return;
    }

    // Otherwise see if we can find it
    const found = findNodeInForest(forest, selectedSpanId);
    if (!found) {
      if (forest.length > 0) {
        const candidate = forest[0];
        const newId = candidate.baseSpanRef?.id ?? candidate.targetSpanRef?.id ?? "";
        setSelectedNode(candidate);
        setSelectedSpanId(newId);
      } else {
        setSelectedNode(null);
        setSelectedSpanId("");
      }
    } else {
      setSelectedNode(found);
    }
  }, [finalPatchRoot]);

  function onSelectNode(n: PatchDiffNode | null) {
    if (!n) {
      setSelectedNode(null);
      setSelectedSpanId("");
    } else {
      const newId = n.baseSpanRef?.id ?? n.targetSpanRef?.id ?? "";
      setSelectedNode(n);
      setSelectedSpanId(newId);
    }
  }

  function handleGroupChange(val: string) {
    setGroupSignature(val);
    setCollapsedNodes({});
    setSelectedNode(null);
    setSelectedSpanId("");
  }

  function renderPatchTree() {
    if (!finalPatchRoot) {
      return <p className="text-sm italic text-muted-foreground mt-2">No trace data</p>;
    }
    const forest = flattenRootNode(finalPatchRoot);
    if (!forest.length) {
      return <p className="text-sm italic text-muted-foreground mt-2">No top-level spans</p>;
    }
    return (
      <>
        {forest.map((oneRoot, i) => (
          <CollapsiblePatchLineNode
            key={i}
            node={oneRoot}
            parentCenterY={0}
            depth={0}
            collapsedNodes={collapsedNodes}
            setCollapsedNodes={setCollapsedNodes}
            selectedNode={selectedNode}
            onSelectNode={onSelectNode}
            multiMode={multiMode}
          />
        ))}
      </>
    );
  }

  function renderDetail() {
    if (!selectedNode) {
      return <p className="text-sm italic">Select a node on the left</p>;
    }
    return (
      <PatchDetailPanel
        node={selectedNode}
        baseRowIndex={rowIndexes[0]}
        comparisonLogsIndex={groupCompareRows}
        allTraces={allTraces}
        allRowIndexes={rowIndexes}
        diffMode={diffMode}
        splitView={splitView}
      />
    );
  }

  return (
    <div className="bg-background rounded-md w-full h-full p-4 flex flex-col gap-4">
      <div style={{ display: "flex", gap: "1rem", height: "600px" }}>
        <div
          style={{
            flex: "0 0 300px",
            border: "1px solid var(--muted)",
            borderRadius: "0.25rem",
            position: "relative",
            overflowY: "auto",
          }}
        >
          {rowIndexes.length > 1 && (
            <div className="sticky top-0 bg-background p-2 z-10 border-b border-muted space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-semibold block">
                  Compare with:
                </span>
                <Combobox
                  items={groupOptions}
                  value={groupSignature}
                  onValueChange={handleGroupChange}
                  placeholder="Pick a group..."
                  className="w-fit items-center"
                />
              </div>
            </div>
          )}
          <div className="p-2">{renderPatchTree()}</div>
        </div>

        <div
          style={{
            flex: "1 1 auto",
            border: "1px solid var(--muted)",
            borderRadius: "0.25rem",
            overflowY: "auto",
            padding: "0.5rem",
          }}
        >
          {renderDetail()}
        </div>
      </div>
    </div>
  );
}