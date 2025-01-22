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

/*-----------------------------------------------------------------------------
  Plural/singular row labeler
-----------------------------------------------------------------------------*/
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
  A small helper to decide if a baseVal+comps is genuinely empty.
  For strings => "" => empty. For arrays/lists => length=0 => empty, etc.
  Adjust as needed for your environment.
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
  PatchDetailPanel:
   - For each field (inputs, outputs, exec_time, code, errors, IDs),
     we skip rendering if base+comps are all empty.
---------------------------------------------------------------------*/
function PatchDetailPanel({
  node,
  baseRowIndex,
  comparisonLogsIndex,
  allTraces,
  allRowIndexes,
}: {
  node: PatchDiffNode;
  baseRowIndex: number;
  comparisonLogsIndex: number[];
  allTraces: Span[][];
  allRowIndexes: number[];
}) {
  if (!node.baseSpanRef && !node.targetSpanRef) {
    return <p className="italic text-sm">No base or target data</p>;
  }

  const mainSpan = node.baseSpanRef || node.targetSpanRef;
  const spanId = mainSpan?.id ?? "(no id)";

  // gather a field => baseVal + comps
  function gatherField(field: string) {
    const bSpan = node.baseSpanRef;
    const tSpan = node.targetSpanRef;

    // same span => no diff
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
          return {
            baseVal: bSpan?.[field],
            comps: tSpan ? [tSpan[field]] : [],
          };
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

  // For multi-lookup by name
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

  function pickView(baseVal: any, comps: any[]): JSX.Element {
    if (!comps) comps = [];
    // custom detection
    if (isTrace(baseVal)) {
      return <p className="italic text-sm">(Span data)</p>;
    }
    if (isDict(baseVal)) {
      return (
        <DictionaryView
          value={baseVal}
          comparables={comps}
          baseLogIndex={baseRowIndex}
          comparisonLogsIndex={comparisonLogsIndex}
        />
      );
    }
    if (isList(baseVal)) {
      return (
        <ListView
          value={baseVal}
          comparables={comps}
          baseLogIndex={baseRowIndex}
          comparisonLogsIndex={comparisonLogsIndex}
        />
      );
    }
    if (isImage(baseVal)) {
      return (
        <ImageView
          value={baseVal}
          comparables={comps}
          baseLogIndex={baseRowIndex}
          comparisonLogsIndex={comparisonLogsIndex}
        />
      );
    }
    if (isMatrix(baseVal)) {
      return (
        <MatrixView
          value={baseVal}
          comparables={comps}
          baseLogIndex={baseRowIndex}
          comparisonLogsIndex={comparisonLogsIndex}
        />
      );
    }
    // fallback => string
    return (
      <StringView
        value={baseVal ?? ""}
        comparables={comps}
        baseLogIndex={baseRowIndex}
        comparisonLogsIndex={comparisonLogsIndex}
      />
    );
  }

  // gather ID as well => treat as a single field
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
    } else {
      // multi
      const realName = bSpan?.span_name || tSpan?.span_name || node.name;
      const bId = bSpan?.id ?? "";
      const compsArr = comparisonLogsIndex.map((r) => {
        const match = findSpanByNameInRow(r, realName);
        return match?.id ?? "";
      });
      return { baseVal: bId, comps: compsArr };
    }
  }

  // We'll define small utility for rendering a block if there's data
  const contentBlocks: JSX.Element[] = [];

  function maybeRenderBlock(
    title: string,
    baseVal: any,
    comps: any[],
    isAccordionItem?: boolean
  ) {
    if (!baseVal && !comps) return; // skip
    // if all empty => skip
    if (allEmpty(baseVal, comps)) return;

    const view = pickView(baseVal, comps);

    if (isAccordionItem) {
      // For code/errors/IDs
      return (
        <AccordionItem key={title} value={title}>
          <AccordionTrigger className="font-medium">{title}</AccordionTrigger>
          <AccordionContent className="pl-2 border-l">
            {view}
          </AccordionContent>
        </AccordionItem>
      );
    } else {
      // normal block => inputs, outputs, exec_time
      contentBlocks.push(
        <div key={title}>
          <p className="font-semibold text-sm mb-2">{title}</p>
          <div className="border border-muted p-2 rounded">
            {view}
          </div>
        </div>
      );
    }
  }

  // gather data for fields
  const { baseVal: bInputs, comps: cInputs } = gatherField("inputs");
  const { baseVal: bOutputs, comps: cOutputs } = gatherField("outputs");
  const { baseVal: bExecTime, comps: cExecTime } = gatherField("exec_time");

  const { baseVal: bCode, comps: cCode } = gatherField("code");
  const { baseVal: bErrors, comps: cErrors } = gatherField("errors");
  const { baseVal: bId, comps: cId } = gatherID();

  // render normal blocks for inputs, outputs, exec_time
  maybeRenderBlock("Inputs", bInputs, cInputs);
  maybeRenderBlock("Outputs", bOutputs, cOutputs);
  maybeRenderBlock("Execution Time", bExecTime, cExecTime);

  // prepare the accordion items => code, errors, IDs
  const accordionItems: JSX.Element[] = [];
  const codeBlock = maybeRenderBlock("Code", bCode, cCode, true);
  const errorsBlock = maybeRenderBlock("Errors", bErrors, cErrors, true);
  const idsBlock = maybeRenderBlock("IDs", bId, cId, true);

  // codeBlock, errorsBlock, idsBlock might be undefined if there's no data

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

      {/* the normal content blocks */}
      {contentBlocks}

      {/* the Accordion for code, errors, IDs => only if they exist */}
      {(codeBlock || errorsBlock || idsBlock) && (
        <Accordion type="multiple" defaultValue={[]} className="mt-3">
          {codeBlock}
          {errorsBlock}
          {idsBlock}
        </Accordion>
      )}
    </div>
  );
}

/*---------------------------------------------------------------------
  CollapsiblePatchLineNode => left side patch tree (unchanged).
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

  // if top node is ROOT w/ marker " " => skip if children
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
      {/* connector line from parent node */}
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
            <IconComponent className="h-4 w-4" />
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
  UnifiedTraceView => top-level main
---------------------------------------------------------------------*/
interface UnifiedTraceViewProps {
  allTraces: Span[][];  // each element is an array of spans for a row
  rowIndexes: number[]; // the row index for each item in allTraces
}

export default function UnifiedTraceView({ allTraces, rowIndexes }: UnifiedTraceViewProps) {
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});
  const [selectedNode, setSelectedNode] = useState<PatchDiffNode | null>(null);

  const baseRowSpans = useMemo(() => {
    if (!allTraces.length) return [] as Span[];
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

  // grouping
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

  // finalPatchRoot => if no group => base vs base => no difference
  const finalPatchRoot = useMemo<PatchDiffNode | null>(() => {
    if (!allTraces.length) return null;
    const baseWrapped = wrapAsRootSpan(baseRowSpans, "baseRow");
    if (!groupSignature) {
      // base vs base => no difference
      return computeSpanDiffByName(baseWrapped, baseWrapped);
    }
    const found = groupedRows.find((x) => x.signature === groupSignature);
    if (!found) {
      // fallback => base vs base
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
      />
    );
  }

  return (
    <div className="bg-background rounded-md w-full h-full p-4 flex flex-col gap-4">
      <div style={{ display: "flex", gap: "1rem", height: "600px" }}>
        {/* left tree & combo */}
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

        {/* right detail panel */}
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
