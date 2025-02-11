"use client";
import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/UI/accordion";
import { Combobox } from "@/components/UI/Combobox";
import { ChevronDown, ChevronRight, Clock, Code, DollarSign, AlertTriangle, FileInput, FileOutput, IdCard } from "lucide-react";

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

import { LogComparisonProps } from "../types";
import Tooltip from "@/components/Common/Misc/Tooltip";
import ChatView from "../ChatView";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/UI/hover-card";
import TimelineViewButton from "./TimelineView";
import { formatTime } from "@/utils/evals/format";

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

  function gatherField(field: string) {
    const bSpan = node.baseSpanRef;
    const tSpan = node.targetSpanRef;

    if (bSpan && tSpan && bSpan === tSpan) {
      return { baseVal: bSpan[field], comps: [] };
    }

    switch (node.marker) {
      case "+":
        return { baseVal: tSpan?.[field], comps: [] };
      case "-":
        return { baseVal: bSpan?.[field], comps: [] };
      case "r":
      case " ":
        if (comparisonLogsIndex.length <= 1) {
          const b = bSpan?.[field];
          const t = tSpan ? tSpan[field] : undefined;
          return { baseVal: b, comps: t !== undefined ? [t] : [] };
        }
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

  // Define section icons mapping
  const sectionIcons: Record<string, JSX.Element> = {
    "Inputs": <FileInput className="h-4 w-4 text-primary" />,
    "Outputs": <FileOutput className="h-4 w-4 text-primary" />,
    "Execution Time": <Clock className="h-4 w-4 text-primary" />,
    "Code": <Code className="h-4 w-4 text-primary" />,
    "Errors": <AlertTriangle className="h-4 w-4 text-primary" />,
    "Cost": <DollarSign className="h-4 w-4 text-primary" />,
    "IDs": <IdCard className="h-4 w-4 text-primary" />,
  };

  // Helper to render a standard accordion item
  function maybeRenderBlock(title: string, baseVal: any, comps: any[]): JSX.Element | null {
    if (allEmpty(baseVal, comps)) {
      return null;
    }

    const view = pickView(baseVal, comps, baseRowIndex, comparisonLogsIndex, diffMode, splitView);

    return (
      <AccordionItem key={title} value={title}>
        <AccordionTrigger className="relative group flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            {sectionIcons[title] || null}<span>{title}</span>
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <div className="border-l ml-4 pl-1">{view}</div>
        </AccordionContent>
      </AccordionItem>
    );
  }

  // Specialized renderer for execution time
  function renderExecutionTime(): JSX.Element | null {
    if (allEmpty(bExecTime, cExecTime)) return null;
    return (
      <AccordionItem key="Execution Time" value="Execution Time">
        <AccordionTrigger className="relative group flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            {sectionIcons["Execution Time"]} <span>Execution Time</span>
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <div className="border-l ml-4 pl-1">
            <ExecutionTimeView
              value={bExecTime}
              comparables={cExecTime}
              baseLogIndex={baseRowIndex}
              comparisonLogsIndex={comparisonLogsIndex}
              diffMode={diffMode}
              splitView={splitView}
            />
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  }

  // Specialized renderer for cost section
  function renderCostBlock(): JSX.Element | null {
    if (allEmpty(bCost, cCost) && allEmpty(bCostIncCache, cCostIncCache)) return null;
    const content = (
      <div className="flex flex-col gap-2">
        <div>
          <p className="font-semibold text-sm mb-2">Cost ($)</p>
          <div className="border border-muted p-2 rounded">
            <NumberView
              value={bCost}
              comparables={cCost}
              baseLogIndex={baseRowIndex}
              comparisonLogsIndex={comparisonLogsIndex}
              diffMode={diffMode}
              splitView={splitView}
            />
          </div>
        </div>
        <div>
          <p className="font-semibold text-sm mb-2">Cost including cache ($)</p>
          <div className="border border-muted p-2 rounded">
            <NumberView
              value={bCostIncCache}
              comparables={cCostIncCache}
              baseLogIndex={baseRowIndex}
              comparisonLogsIndex={comparisonLogsIndex}
              diffMode={diffMode}
              splitView={splitView}
            />
          </div>
        </div>
      </div>
    );
    return (
      <AccordionItem key="Cost" value="Cost">
        <AccordionTrigger className="relative group flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            {sectionIcons["Cost"]} <span>Cost</span>
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <div className="border-l ml-4 pl-1">{content}</div>
        </AccordionContent>
      </AccordionItem>
    );
  }

  // Get all field values
  const { baseVal: bInputs, comps: cInputs } = gatherField("inputs");
  const { baseVal: bOutputs, comps: cOutputs } = gatherField("outputs");
  const { baseVal: bCode, comps: cCode } = gatherField("code");
  const { baseVal: bErrors, comps: cErrors } = gatherField("errors");
  const { baseVal: bExecTime, comps: cExecTime } = gatherField("exec_time");
  const { baseVal: bCost, comps: cCost } = gatherField("cost");
  const { baseVal: bCostIncCache, comps: cCostIncCache } = gatherField("cost_inc_cache");

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

  const showTimelineButton = allRowIndexes.length === 1 || (allTraces.length > 1 && comparisonLogsIndex.length === 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="font-bold text-sm">{node.name}</p>
        {showTimelineButton && TimelineViewButton && <TimelineViewButton baseTrace={allTraces[0]} />}
      </div>
      
      <Accordion type="multiple" defaultValue={["Inputs", "Outputs"]} className="mt-3">
        {maybeRenderBlock("Inputs", bInputs, cInputs)}
        {maybeRenderBlock("Outputs", bOutputs, cOutputs)}
        {maybeRenderBlock("Code", bCode, cCode)}
        {renderExecutionTime()}
        {maybeRenderBlock("Errors", bErrors, cErrors)}
        {renderCostBlock()}
        {maybeRenderBlock("IDs", bId, cId)}
      </Accordion>
    </div>
  );
}

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

  const baseTime = node.baseSpanRef?.exec_time ?? 0;
  const targetTime = node.targetSpanRef?.exec_time ?? 0;

  let timeLabel = "";
  let timeData: any = null;

  if (!multiMode) {
    if (baseTime) {
      const { value, unit } = formatTime(baseTime);
      timeLabel = `${value.toFixed(2)}${unit}`;
      timeData = {
        title: "Execution Time",
        baseTime,
      };
    }
  } else {
    if (node.marker === "+") {
      if (targetTime) {
        const { value, unit } = formatTime(targetTime);
        timeLabel = `${value.toFixed(2)}${unit}`;
        timeData = {
          title: "Execution Time (Comparison Only)",
          targetTime,
        };
      }
    } else if (node.marker === "-") {
      if (baseTime) {
        const { value, unit } = formatTime(baseTime);
        timeLabel = `${value.toFixed(2)}${unit}`;
        timeData = {
          title: "Execution Time (Base Only)",
          baseTime,
        };
      }
    } else {
      const diff = targetTime - baseTime;
      if (baseTime || targetTime) {
        const { value, unit } = formatTime(Math.abs(diff));
        const sign = diff >= 0 ? "+" : "-";
        timeLabel = `${sign}${value.toFixed(2)}${unit}`;
        timeData = {
          title: "Execution Times",
          baseTime,
          targetTime,
          diffSign: sign,
          diffValue: value,
          diffUnit: unit,
        };
        if (!baseTime && !targetTime) {
          timeLabel = "";
          timeData = null;
        }
      }
    }
  }

  const baseCost = node.baseSpanRef?.cost ?? 0;
  const baseCostIncCache = node.baseSpanRef?.cost_inc_cache ?? 0;
  const targetCost = node.targetSpanRef?.cost ?? 0;
  const targetCostIncCache = node.targetSpanRef?.cost_inc_cache ?? 0;

  let costLabel = "";
  let costData: any = null;

  if (!multiMode) {
    if (baseCost > 0 || baseCostIncCache > 0) {
      costLabel = `$${baseCost.toFixed(4)}`;
      costData = {
        title: "LLM Cost Details",
        baseCost,
        baseCostIncCache,
      };
    }
  } else {
    if (node.marker === "+") {
      if (targetCost > 0 || targetCostIncCache > 0) {
        costLabel = `$${targetCost.toFixed(4)}`;
        costData = {
          title: "LLM Cost (Comparison Only)",
          targetCost,
          targetCostIncCache,
        };
      }
    } else if (node.marker === "-") {
      if (baseCost > 0 || baseCostIncCache > 0) {
        costLabel = `$${baseCost.toFixed(4)}`;
        costData = {
          title: "LLM Cost (Base Only)",
          baseCost,
          baseCostIncCache,
        };
      }
    } else {
      if (baseCost || targetCost || baseCostIncCache || targetCostIncCache) {
        const diffC = targetCost - baseCost;
        const signC = diffC >= 0 ? "+" : "-";
        const absDiffC = Math.abs(diffC).toFixed(4);

        const diffCIC = targetCostIncCache - baseCostIncCache;
        const signCIC = diffCIC >= 0 ? "+" : "-";
        const absDiffCIC = Math.abs(diffCIC).toFixed(4);

        costLabel = `${signC}$${absDiffC}`;
        costData = {
          title: "LLM Costs",
          baseCost,
          baseCostIncCache,
          targetCost,
          targetCostIncCache,
          diffSign: signC,
          diffAbs: absDiffC,
          diffSignIncCache: signCIC,
          diffAbsIncCache: absDiffCIC,
        };
        if (
          !(
            baseCost ||
            targetCost ||
            baseCostIncCache ||
            targetCostIncCache
          )
        ) {
          costLabel = "";
          costData = null;
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
          {timeLabel && timeData && (
            <HoverCard>
              <HoverCardTrigger asChild>
                <span className="ml-2 text-xs text-muted-foreground underline cursor-pointer">
                  {timeLabel}
                </span>
              </HoverCardTrigger>
              <HoverCardContent className="p-2 w-fit">
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p className="font-semibold">{timeData.title}</p>
                  {timeData.baseTime !== undefined && (
                    <p>Base Execution Time: {(() => {
                      const { value, unit } = formatTime(timeData.baseTime);
                      return `${value.toFixed(2)}${unit}`;
                    })()}</p>
                  )}
                  {timeData.targetTime !== undefined && (
                    <p>
                      Comparison Execution Time: {(() => {
                        const { value, unit } = formatTime(timeData.targetTime);
                        return `${value.toFixed(2)}${unit}`;
                      })()}
                    </p>
                  )}
                  {timeData.diffSign && (
                    <p>
                      Difference: {timeData.diffSign}{timeData.diffValue.toFixed(2)}{timeData.diffUnit}
                    </p>
                  )}
                </div>
              </HoverCardContent>
            </HoverCard>
          )}
          {costLabel && costData && (
            <HoverCard>
              <HoverCardTrigger asChild>
                <span className="ml-2 text-xs text-muted-foreground underline cursor-pointer">
                  {costLabel}
                </span>
              </HoverCardTrigger>
              <HoverCardContent className="p-2 w-fit">
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p className="font-semibold">{costData.title}</p>
                  {costData.baseCost !== undefined && (
                    <p>
                      Base Cost: ${costData.baseCost.toFixed(4)} (Including
                      cache: ${costData.baseCostIncCache.toFixed(4)})
                    </p>
                  )}
                  {costData.targetCost !== undefined && (
                    <p>
                      Comparison Cost: ${costData.targetCost.toFixed(4)}{" "}
                      (Including cache: ${costData.targetCostIncCache.toFixed(4)}
                      )
                    </p>
                  )}
                  {costData.diffSign && (
                    <p>
                      Difference: {costData.diffSign}${costData.diffAbs}{" "}
                      (Including cache: {costData.diffSignIncCache}$
                      {costData.diffAbsIncCache})
                    </p>
                  )}
                </div>
              </HoverCardContent>
            </HoverCard>
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

interface UnifiedTraceViewProps {
  allTraces: Span[][];
  rowIndexes: number[];
  diffMode?: LogComparisonProps["diffMode"];
  splitView?: LogComparisonProps["splitView"];
}

function flattenRootNode(root: PatchDiffNode | null): PatchDiffNode[] {
  if (!root) return [];
  if (root.name === "ROOT") {
    return root.children;
  }
  return [root];
}

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
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

  const [selectedNode, setSelectedNode] = useState<PatchDiffNode | null>(null);
  const [selectedSpanId, setSelectedSpanId] = useState<string>("");

  const multiMode = rowIndexes.length > 1;

  const baseRowSpans = useMemo(() => {
    if (!allTraces.length) return [];
    return allTraces[0] ?? [];
  }, [allTraces]);

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
    const compressed = compressRowNumbers(rows);
    return rows.length === 1 ? `Row ${compressed}` : `Rows ${compressed}`;
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

  const finalPatchRoot = useMemo<PatchDiffNode | null>(() => {
    if (!allTraces.length) return null;
    const baseWrapped = wrapAsRootSpan(baseRowSpans, "baseRow");
    if (!groupSignature) {
      return computeSpanDiffByName(baseWrapped, baseWrapped);
    }
    const found = groupedRows.find((x) => x.signature === groupSignature);
    if (!found) {
      return computeSpanDiffByName(baseWrapped, baseWrapped);
    }
    const groupSpans = unifyGroupIntoOne(found.rowIndices);
    const groupWrapped = wrapAsRootSpan(groupSpans, "groupRow");
    return computeSpanDiffByName(baseWrapped, groupWrapped);
  }, [groupSignature, groupedRows, baseRowSpans, allTraces, rowIndexes]);

  const groupCompareRows = useMemo(() => {
    if (!groupSignature) return [];
    const found = groupedRows.find((g) => g.signature === groupSignature);
    if (!found) return [];
    return found.rowIndices;
  }, [groupSignature, groupedRows]);

  useEffect(() => {
    if (!finalPatchRoot) return;

    const forest = flattenRootNode(finalPatchRoot);

    if (!selectedSpanId) {
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
            <div className="sticky top-0 bg-background p-2 border-b border-muted space-y-2">
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