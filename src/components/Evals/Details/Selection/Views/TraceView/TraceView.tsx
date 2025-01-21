"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
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

/*---------------------------------------------------------------------
  PatchDetailPanel: 
   - Extended so if we have multiple “groupCompareRowIndices,” 
     we gather each row’s matching Span (by name) for each field 
     as comparables. This yields multi-diff in the right-hand pane.
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
  comparisonLogsIndex: number[]; // group or single
  allTraces: Span[][];
  allRowIndexes: number[];
}) {
  if (!node.baseSpanRef && !node.targetSpanRef) {
    return <p className="italic text-sm">No base or target data</p>;
  }

  let label = "Unchanged";
  if (node.marker === "+") label = "Added";
  else if (node.marker === "-") label = "Removed";
  else if (node.marker === "r") label = "Replaced";

  const fields = ["inputs", "outputs", "code", "errors"];

  /**
   * Provided a row index (like row #10) and a spanName,
   * find that row’s Spans array => find a matching span by name.
   * If you want ID-based matching, you could do that instead, but
   * for now we do name-based to keep consistent with the patch diff.
   */
  function findSpanByNameInRow(rowIndex: number, spanName: string): Span | undefined {
    const i = allRowIndexes.indexOf(rowIndex);
    if (i < 0) return undefined;
    const rowSpans = allTraces[i];
    if (!rowSpans) return undefined;
    const queue = [...rowSpans];
    while (queue.length) {
      const s = queue.shift()!;
      if (s.span_name === spanName) return s;
      if (s.child_spans) {
        queue.push(...s.child_spans);
      }
    }
    return undefined;
  }

  function getBaseAndComparables(field: string) {
    const marker = node.marker;
    const bSpan = node.baseSpanRef;
    const tSpan = node.targetSpanRef;

    // By default, do the old approach with up to one target:
    let baseVal: any;
    let comps: any[] = [];

    if (marker === " " || marker === "r") {
      baseVal = bSpan?.[field];
      if (tSpan) comps.push(tSpan[field]);
    } else if (marker === "+") {
      baseVal = tSpan?.[field];
    } else if (marker === "-") {
      baseVal = bSpan?.[field];
    }

    /*----------------------------------------------------------
      NEW LOGIC: If comparisonLogsIndex includes multiple rows, 
      we want to gather each row’s value for the same field 
      instead of just one. 
      We'll skip the single “comps.push(tSpan[field])” approach 
      and do a multi approach: each row => findSpan => field. 
    ----------------------------------------------------------*/
    if (comparisonLogsIndex.length > 1) {
      // If we have >1 row => gather them all
      // Overwrite comps with a new array of each row's value
      const name = node.baseSpanRef ? node.baseSpanRef.span_name : node.name;
      // If marker is "+" or "-" or "r", we might also want to use node.targetSpanRef?.span_name
      // but we typically unify by name. We'll just assume baseSpanRef or node.name is correct.
      const realSpanName = bSpan?.span_name || tSpan?.span_name || name;

      const multiComps: any[] = [];
      comparisonLogsIndex.forEach((rowN) => {
        const match = findSpanByNameInRow(rowN, realSpanName);
        if (match) {
          multiComps.push(match[field]);
        } else {
          multiComps.push(undefined);
        }
      });
      comps = multiComps;
    }

    return { baseVal, comps };
  }

  function pickView(value: any, comps: any[]) {
    if (!comps) comps = [];

    if (isTrace(value)) {
      return <p className="italic text-sm">(Span data)</p>;
    }
    if (isDict(value)) {
      return (
        <DictionaryView
          value={value}
          comparables={comps}
          baseLogIndex={baseRowIndex}
          comparisonLogsIndex={comparisonLogsIndex}
        />
      );
    }
    if (isList(value)) {
      return (
        <ListView
          value={value}
          comparables={comps}
          baseLogIndex={baseRowIndex}
          comparisonLogsIndex={comparisonLogsIndex}
        />
      );
    }
    if (isImage(value)) {
      return (
        <ImageView
          value={value}
          comparables={comps}
          baseLogIndex={baseRowIndex}
          comparisonLogsIndex={comparisonLogsIndex}
        />
      );
    }
    if (isMatrix(value)) {
      return (
        <MatrixView
          value={value}
          comparables={comps}
          baseLogIndex={baseRowIndex}
          comparisonLogsIndex={comparisonLogsIndex}
        />
      );
    }
    // Default => string
    return (
      <StringView
        value={value ?? ""}
        comparables={comps}
        baseLogIndex={baseRowIndex}
        comparisonLogsIndex={comparisonLogsIndex}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-bold text-sm">{node.name}</p>
      {fields.map((field) => {
        const { baseVal, comps } = getBaseAndComparables(field);
        // Skip if base & comps are both undefined
        const isEmptyComps = comps.length && comps.every((c) => c === undefined);
        if (baseVal === undefined && (!comps.length || isEmptyComps)) {
          return null;
        }
        const content = pickView(baseVal, comps);
        return (
          <div key={field} className="border rounded p-2 bg-background">
            <p className="font-semibold text-sm mb-2">{field}</p>
            {content}
          </div>
        );
      })}
    </div>
  );
}

/*---------------------------------------------------------------------
  convertSpanToPatchNode: same as before
---------------------------------------------------------------------*/
function convertSpanToPatchNode(span: Span): PatchDiffNode {
  return {
    name: span.span_name,
    marker: " ",
    baseSpanRef: span,
    targetSpanRef: undefined,
    children: (span.child_spans ?? []).map(convertSpanToPatchNode),
  };
}

/*---------------------------------------------------------------------
  CollapsiblePatchLineNode: unchanged, 
  skipping root if marker=" " & name="ROOT"
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

  // skip "ROOT" if unchanged:
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
  UnifiedTraceView:
  - We skip the old single-row combobox
  - We skip including base row in grouping
  - We unify only the structure for base vs. group
  - For the detail data (inputs, outputs, code, etc.), 
    we pass all row indices in the group as “comparables.”
---------------------------------------------------------------------*/
interface UnifiedTraceViewProps {
  allTraces: Span[][];  // each element is an array of spans for a row
  rowIndexes: number[]; // the row index for each item in allTraces
}

export default function UnifiedTraceView({ allTraces, rowIndexes }: UnifiedTraceViewProps) {
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});
  const [selectedNode, setSelectedNode] = useState<PatchDiffNode | null>(null);

  // Possibly for timeline usage
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [flowOpen, setFlowOpen] = useState(false);
  const timelineData = useMemo(() => unifyTracesForChart(allTraces), [allTraces]);

  // Base row => rowIndexes[0]
  const baseRowSpans = useMemo(() => {
    if (!allTraces.length) return [] as Span[];
    return allTraces[0] ?? [];
  }, [allTraces]);

  // For grouping
  const [groupSignature, setGroupSignature] = useState("");

  /** Structure-only to decide grouping (skip code, inputs, etc.) */
  function minimalSpanHierarchy(span: Span): any {
    return {
      name: span.span_name,
      children: (span.child_spans ?? []).map(minimalSpanHierarchy),
    };
  }
  function minimalSpanTree(spans: Span[]): any {
    return spans.map(minimalSpanHierarchy);
  }

  // skip rowIndexes[0] from grouping
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

  // Build combobox items => each group
  function compressRowNumbers(rows: number[]): string {
    if (!rows.length) return "";
    const sorted = rows.slice().sort((a, b) => a - b);
    const out: string[] = [];
    let start = sorted[0],
      end = start;
    for (let i = 1; i < sorted.length; i++) {
      const cur = sorted[i];
      if (cur === end + 1) {
        end = cur;
      } else {
        if (start === end) out.push(String(start));
        else out.push(`${start}-${end}`);
        start = cur;
        end = cur;
      }
    }
    if (start === end) out.push(String(start));
    else out.push(`${start}-${end}`);
    return out.join(",");
  }

  const groupOptions = useMemo(() => {
    const arr = [{ value: "", label: "-- None --" }];
    groupedRows.forEach((g) => {
      const label = `Row(s): ${compressRowNumbers(g.rowIndices)}`;
      arr.push({ value: g.signature, label });
    });
    return arr;
  }, [groupedRows]);

  /** unifyGroupIntoOne: if they’re truly identical, we can just pick the first row’s real spans */
  function unifyGroupIntoOne(rowIndices: number[]): Span[] {
    if (!rowIndices.length) return [];
    const firstRow = rowIndices[0];
    const i = rowIndexes.indexOf(firstRow);
    return allTraces[i] ?? [];
  }

  /** patchRoot => base vs group. If no group => just base alone. */
  const finalPatchRoot = useMemo<PatchDiffNode | null>(() => {
    if (!allTraces.length) return null;
    if (!groupSignature) {
      // show base alone
      const root = wrapAsRootSpan(baseRowSpans, "baseAlone");
      return convertSpanToPatchNode(root);
    }
    const found = groupedRows.find((x) => x.signature === groupSignature);
    if (!found) {
      const root = wrapAsRootSpan(baseRowSpans, "fallbackBase");
      return convertSpanToPatchNode(root);
    }
    const groupSpans = unifyGroupIntoOne(found.rowIndices);
    const baseWrapped = wrapAsRootSpan(baseRowSpans, "baseRow");
    const groupWrapped = wrapAsRootSpan(groupSpans, "groupRow");
    return computeSpanDiffByName(baseWrapped, groupWrapped);
  }, [groupSignature, groupedRows, baseRowSpans, allTraces, rowIndexes]);

  /** For the detail panel => pass all rowIndices in that group as “comparisons.” */
  const groupCompareRows = useMemo(() => {
    if (!groupSignature) return [];
    const found = groupedRows.find((g) => g.signature === groupSignature);
    if (!found) return [];
    return found.rowIndices;
  }, [groupSignature, groupedRows]);

  // handle combo changes
  function handleGroupChange(val: string) {
    setGroupSignature(val);
    setCollapsedNodes({});
    setSelectedNode(null);
  }

  function renderDetail() {
    if (!selectedNode) {
      return <p className="text-sm italic">Select a node on the left</p>;
    }
    // pass groupCompareRows => so PatchDetailPanel can gather multiple comparables
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