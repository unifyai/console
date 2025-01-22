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
  Helpers for row-labelling with singular/plural
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
  PatchDetailPanel:
   - We do not show ID text, but we provide a CopyButton for the ID at the top.
   - We treat "exec_time" as a normal field, so you can see it in e.g. a StringView.
   - "inputs", "outputs", and "exec_time" are shown as normal blocks.
   - "code" and "errors" go into an accordion, folded by default.
   - Also new: an “IDs” accordion item at the bottom, which uses pickView
     to display base ID + comparable IDs in a list (if multiple).
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

  // We'll pick whichever is available for copying ID
  const mainSpan = node.baseSpanRef || node.targetSpanRef;
  const spanId = mainSpan?.id ?? "(no id)";

  // Helper: find a matching span by name in a given row
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

  // We'll reuse pickView from older logic to display text, arrays, etc.
  function pickView(baseValue: any, comps: any[]): JSX.Element {
    if (!comps) comps = [];
    if (isTrace(baseValue)) {
      return <p className="italic text-sm">(Span data)</p>;
    }
    if (isDict(baseValue)) {
      return (
        <DictionaryView
          value={baseValue}
          comparables={comps}
          baseLogIndex={baseRowIndex}
          comparisonLogsIndex={comparisonLogsIndex}
        />
      );
    }
    if (isList(baseValue)) {
      return (
        <ListView
          value={baseValue}
          comparables={comps}
          baseLogIndex={baseRowIndex}
          comparisonLogsIndex={comparisonLogsIndex}
        />
      );
    }
    if (isImage(baseValue)) {
      return (
        <ImageView
          value={baseValue}
          comparables={comps}
          baseLogIndex={baseRowIndex}
          comparisonLogsIndex={comparisonLogsIndex}
        />
      );
    }
    if (isMatrix(baseValue)) {
      return (
        <MatrixView
          value={baseValue}
          comparables={comps}
          baseLogIndex={baseRowIndex}
          comparisonLogsIndex={comparisonLogsIndex}
        />
      );
    }
    // fallback => string
    return (
      <StringView
        value={baseValue ?? ""}
        comparables={comps}
        baseLogIndex={baseRowIndex}
        comparisonLogsIndex={comparisonLogsIndex}
      />
    );
  }

  /**
   * gatherFieldValues => returns the baseVal and comps for the specified field,
   * if there's multi-compare. If baseSpanRef===targetSpanRef => no diff => just baseVal.
   */
  function gatherFieldValues(field: string) {
    const bSpan = node.baseSpanRef;
    const tSpan = node.targetSpanRef;
    // If truly no diff => bSpan===tSpan, so just show base
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
          // single compare => base vs target
          return {
            baseVal: bSpan?.[field],
            comps: tSpan ? [tSpan[field]] : [],
          };
        }
        // multi-compare => gather
        const baseVal = bSpan?.[field];
        const realName = bSpan?.span_name || tSpan?.span_name || node.name;
        const compsArr = comparisonLogsIndex.map((rowN) => {
          const match = findSpanByNameInRow(rowN, realName);
          return match?.[field];
        });
        return { baseVal, comps: compsArr };
      default:
        return { baseVal: undefined, comps: [] };
    }
  }

  // We'll handle inputs/outputs/exec_time as direct blocks, code/errors in an accordion
  const { baseVal: baseInputs, comps: compsInputs } = gatherFieldValues("inputs");
  const { baseVal: baseOutputs, comps: compsOutputs } = gatherFieldValues("outputs");
  const { baseVal: baseExecTime, comps: compsExecTime } = gatherFieldValues("exec_time");

  const inputsView = pickView(baseInputs, compsInputs);
  const outputsView = pickView(baseOutputs, compsOutputs);
  const execTimeView = pickView(baseExecTime, compsExecTime);

  // code & errors => also in the accordion
  const { baseVal: baseCode, comps: compsCode } = gatherFieldValues("code");
  const { baseVal: baseErrors, comps: compsErrors } = gatherFieldValues("errors");

  const codeView = pickView(baseCode, compsCode);
  const errorsView = pickView(baseErrors, compsErrors);

  // Gather IDs => treat as array of strings (for multi-diff)
  function gatherIdValues() {
    const bSpan = node.baseSpanRef;
    const tSpan = node.targetSpanRef;
    // If base===target, only show base ID
    if (bSpan && tSpan && bSpan === tSpan) {
      return { baseVal: bSpan.id ?? "(no id)", comps: [] };
    }
    if (comparisonLogsIndex.length <= 1) {
      // single compare
      const bId = bSpan?.id ?? "(no id)";
      const tId = tSpan ? (tSpan.id ?? "(no id)") : undefined;
      if (tId !== undefined) {
        return { baseVal: bId, comps: [tId] };
      } else {
        return { baseVal: bId, comps: [] };
      }
    } else {
      // multi => gather each row's ID
      const bId = bSpan?.id ?? "(no id)";
      const realName = bSpan?.span_name || tSpan?.span_name || node.name;
      const compsArr = comparisonLogsIndex.map((rowN) => {
        const match = findSpanByNameInRow(rowN, realName);
        return match?.id ?? "(no id)";
      });
      return { baseVal: bId, comps: compsArr };
    }
  }

  const { baseVal: baseID, comps: compsID } = gatherIdValues();
  const idView = pickView(baseID, compsID);

  return (
    <div className="flex flex-col gap-3">
      {/* Title row => left: node name, right: CopyButton => ID */}
      <div className="flex items-center justify-between">
        <p className="font-bold text-sm">{node.name}</p>
        <CopyButton
          content={String(spanId)}
          copyMessage="Copied trace ID!"
          tooltipContent="Copy Base Span ID"
        />
      </div>

      {/* Inputs */}
      <div>
        <p className="font-semibold text-sm mb-2">Inputs</p>
        <div className="border border-muted p-2 rounded">
          {inputsView}
        </div>
      </div>

      {/* Outputs */}
      <div>
        <p className="font-semibold text-sm mt-2 mb-2">Outputs</p>
        <div className="border border-muted p-2 rounded">
          {outputsView}
        </div>
      </div>

      {/* Execution Time */}
      <div>
        <p className="font-semibold text-sm mt-2 mb-2">Execution Time</p>
        <div className="border border-muted p-2 rounded">
          {execTimeView}
        </div>
      </div>

      {/* code + errors => folded accordion by default */}
      <Accordion type="multiple" defaultValue={[]} className="mt-3">
        <AccordionItem value="code">
          <AccordionTrigger className="font-medium">Code</AccordionTrigger>
          <AccordionContent className="pl-2 border-l">
            {codeView}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="errors">
          <AccordionTrigger className="font-medium">Errors</AccordionTrigger>
          <AccordionContent className="pl-2 border-l">
            {errorsView}
          </AccordionContent>
        </AccordionItem>

        {/* Additional item => IDs */}
        <AccordionItem value="ids">
          <AccordionTrigger className="font-medium">IDs</AccordionTrigger>
          <AccordionContent className="pl-2 border-l">
            {idView}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

/*---------------------------------------------------------------------
  CollapsiblePatchLineNode => Left side patch tree
  (unchanged except we skip "ROOT" if base==base => no changes displayed)
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

  // If top node is "ROOT" with marker=== " " => skip if there's children
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
  UnifiedTraceView
    - If user picks "None," we do base vs. base => no diffs
    - The rest is unchanged
---------------------------------------------------------------------*/
interface UnifiedTraceViewProps {
  allTraces: Span[][];  // each element is an array of spans for a row
  rowIndexes: number[]; // the row index for each item in allTraces
}

export default function UnifiedTraceView({ allTraces, rowIndexes }: UnifiedTraceViewProps) {
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});
  const [selectedNode, setSelectedNode] = useState<PatchDiffNode | null>(null);

  // "baseRow" => rowIndexes[0]
  const baseRowSpans = useMemo(() => {
    if (!allTraces.length) return [] as Span[];
    return allTraces[0] ?? [];
  }, [allTraces]);

  // grouping
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

  // finalPatchRoot => if no group => base vs base => no difference
  const finalPatchRoot = useMemo<PatchDiffNode | null>(() => {
    if (!allTraces.length) return null;
    const baseWrapped = wrapAsRootSpan(baseRowSpans, "baseRow");
    if (!groupSignature) {
      // base vs. base => no difference
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
        {/* Left => patch tree & combobox */}
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

        {/* Right => detail panel */}
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