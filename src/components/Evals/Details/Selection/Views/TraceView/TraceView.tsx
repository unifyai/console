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
import { unifyTracesForChart } from "./unify";
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
import { isDict, isList, isMatrix, isImage, isTrace } from "@/utils/evals/selection";

import RowBadge from "../RowBadge";
import ActionButton from "@/components/Common/Buttons/Action";
import { CopyButton } from "@/components/Common/Buttons/Copy";
import { LogComparisonProps } from "../types";
import Tooltip from "@/components/Common/Misc/Tooltip";

/*--------------------------------------------------------------
  compressRowNumbers + labelForRows => for grouping row indices
--------------------------------------------------------------*/
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
  Helper to skip rendering if a base + comps are all empty
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
  pickView => local helper that chooses DictionaryView/ListView/etc.
---------------------------------------------------------------------*/
function pickView(
  baseVal: any, 
  comps: any[],
  baseLogIndex: number,
  comparisonLogsIndex: number[],
  diffMode: LogComparisonProps["diffMode"],
  splitView: LogComparisonProps["splitView"]
): JSX.Element {
  if (isTrace(baseVal)) {
    return <p className="italic text-sm">(Span data ignored here)</p>;
  }
  if (isDict(baseVal)) {
    return (
      <DictionaryView
        value={baseVal}
        comparables={comps}
        baseLogIndex={baseLogIndex}
        comparisonLogsIndex={comparisonLogsIndex}
        diffMode={diffMode}
        splitView={splitView}
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
        diffMode={diffMode}
        splitView={splitView}
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
        diffMode={diffMode}
        splitView={splitView}
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
        diffMode={diffMode}
        splitView={splitView}
      />
    );
  }
  // fallback => string
  return (
    <StringView
      value={baseVal}
      comparables={comps}
      baseLogIndex={baseLogIndex}
      comparisonLogsIndex={comparisonLogsIndex}
      diffMode={diffMode}
      splitView={splitView}
    />
  );
}

/*---------------------------------------------------------------------
  PatchDetailPanel => the right pane's detail about a single Span
  (Inputs, Outputs, Code, Errors, etc.)
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

  // pass these in explicitly
  diffMode?: LogComparisonProps["diffMode"];
  splitView?: LogComparisonProps["splitView"];

}) {
  if (!node.baseSpanRef && !node.targetSpanRef) {
    return <p className="italic text-sm">No base or target data</p>;
  }
  const mainSpan = node.baseSpanRef || node.targetSpanRef;
  const spanId = mainSpan?.id ?? "(no id)";

  /**
   * gatherField => returns { baseVal, comps: any[] }
   * so we can pass them to pickView
   */
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
        // multi
        const realName = bSpan?.span_name || tSpan?.span_name || node.name;
        const baseVal = bSpan?.[field];
        const compsArr = comparisonLogsIndex.map((r) => {
          const match = findSpanByNameInRow(r, realName);
          return match?.[field];
        });
        return { baseVal, comps: compsArr };
      default:
        return { baseVal: undefined, comps: [] };
    }
  }

  // helper for findSpanByNameInRow
  function findSpanByNameInRow(rowIndex: number, spanName: string): Span | undefined {
    const i = allRowIndexes.indexOf(rowIndex);
    if (i < 0) return undefined;
    const rowSpans = allTraces[i];
    if (!rowSpans) return undefined;
    const queue = [...rowSpans];
    while (queue.length) {
      const s = queue.shift()!;
      if (s.span_name === spanName) return s;
      if (s.child_spans) queue.push(...s.child_spans);
    }
    return undefined;
  }

  /**
   * maybeRenderBlock => optionally skip if all empty,
   * otherwise calls pickView to generate the content
   */
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
      diffMode,
      splitView
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
    } else {
      return (
        <div key={title}>
          <p className="font-semibold text-sm mb-2">{title}</p>
          <div className="border border-muted p-2 rounded">
            {view}
          </div>
        </div>
      );
    }
  }

  // gather data
  const { baseVal: bInputs, comps: cInputs } = gatherField("inputs");
  const { baseVal: bOutputs, comps: cOutputs } = gatherField("outputs");
  const { baseVal: bExecTime, comps: cExecTime } = gatherField("exec_time");
  const { baseVal: bCode, comps: cCode } = gatherField("code");
  const { baseVal: bErrors, comps: cErrors } = gatherField("errors");

  // gather ID as well
  function gatherID() {
    const bSpan = node.baseSpanRef;
    const tSpan = node.targetSpanRef;
    if (bSpan && tSpan && bSpan === tSpan) {
      return { baseVal: bSpan.id ?? "", comps: [] };
    }
    if (comparisonLogsIndex.length <= 1) {
      const bId = bSpan?.id ?? "";
      const tId = tSpan ? (tSpan.id ?? "") : "";
      return tId ? { baseVal: bId, comps: [tId] } : { baseVal: bId, comps: [] };
    }
    const realName = bSpan?.span_name || tSpan?.span_name || node.name;
    const bId = bSpan?.id ?? "";
    const compsArr = comparisonLogsIndex.map((r) => {
      const match = findSpanByNameInRow(r, realName);
      return match?.id ?? "";
    });
    return { baseVal: bId, comps: compsArr };
  }
  const { baseVal: bId, comps: cId } = gatherID();

  // Now render blocks
  const contentBlocks: JSX.Element[] = [];

  // inputs, outputs, exec_time as normal blocks
  const block1 = maybeRenderBlock("Inputs", bInputs, cInputs, false);
  if (block1) contentBlocks.push(block1);
  const block2 = maybeRenderBlock("Outputs", bOutputs, cOutputs, false);
  if (block2) contentBlocks.push(block2);
  const block3 = maybeRenderBlock("Execution Time", bExecTime, cExecTime, false);
  if (block3) contentBlocks.push(block3);

  // code, errors, IDs => in an accordion
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
---------------------------------------------------------------------*/
function CollapsiblePatchLineNode({
  node,
  parentCenterY,
  depth,
  collapsedNodes,
  setCollapsedNodes,
  selectedNode,
  onSelectNode,
}: {
  node: PatchDiffNode;
  parentCenterY: number;
  depth: number;
  collapsedNodes: Record<string, boolean>;
  setCollapsedNodes: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  selectedNode: PatchDiffNode | null;
  onSelectNode: (n: PatchDiffNode | null) => void;
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

  // If top-level is "ROOT" with no real marker => skip rendering it, show children
  if (depth === 0 && node.name === "ROOT" && node.marker === " " && children.length) {
    return (
      <>
        {children.map((child, idx) => (
          <CollapsiblePatchLineNode
            key={idx}
            node={child}
            parentCenterY={0}
            depth={0}
            collapsedNodes={collapsedNodes}
            setCollapsedNodes={setCollapsedNodes}
            selectedNode={selectedNode}
            onSelectNode={onSelectNode}
          />
        ))}
      </>
    );
  }

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
        <span className="truncate">{node.name}</span>

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
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/*---------------------------------------------------------------------
  UnifiedTraceView => top-level trace comparison, receives diffMode/splitView
---------------------------------------------------------------------*/
interface UnifiedTraceViewProps {
  allTraces: Span[][];
  rowIndexes: number[];
  diffMode?: LogComparisonProps["diffMode"];
  splitView?: LogComparisonProps["splitView"];
}

export default function UnifiedTraceView({
  allTraces,
  rowIndexes,
  diffMode = "none",
  splitView = false,
}: UnifiedTraceViewProps) {
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});
  const [selectedNode, setSelectedNode] = useState<PatchDiffNode | null>(null);

  const baseRowSpans = useMemo(() => {
    if (!allTraces.length) return [];
    return allTraces[0] ?? [];
  }, [allTraces]);

  // For multi grouping (not strictly about diff)
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

  const groupOptions = useMemo(() => {
    const arr = [{ value: "", label: "-- None --" }];
    groupedRows.forEach((g) => {
      arr.push({ value: g.signature, label: labelForRows(g.rowIndices) });
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
      // comparing baseRow to itself => no changes
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

  function handleGroupChange(val: string) {
    setGroupSignature(val);
    setCollapsedNodes({});
    setSelectedNode(null);
  }

  function renderPatchTree() {
    if (!finalPatchRoot) {
      return (
        <p className="text-sm italic text-muted-foreground mt-2">
          No trace data
        </p>
      );
    }
    return (
      <CollapsiblePatchLineNode
        node={finalPatchRoot}
        parentCenterY={0}
        depth={0}
        collapsedNodes={collapsedNodes}
        setCollapsedNodes={setCollapsedNodes}
        selectedNode={selectedNode}
        onSelectNode={setSelectedNode}
      />
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
        {/* Left tree & combo */}
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

        {/* Right detail panel */}
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