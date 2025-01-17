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
  PatchDetailPanel: Displays fields (inputs, outputs, code, errors)
                    by reusing the specialized DictionaryView, etc.
---------------------------------------------------------------------*/
function PatchDetailPanel({
  node,
  baseRowIndex,
  comparisonLogsIndex,
}: {
  node: PatchDiffNode;
  baseRowIndex: number;
  comparisonLogsIndex: number[];
}) {
  if (!node.baseSpanRef && !node.targetSpanRef) {
    return <p className="italic text-sm">No base or target data</p>;
  }

  let label = "Unchanged";
  if (node.marker === "+") label = "Added";
  else if (node.marker === "-") label = "Removed";
  else if (node.marker === "r") label = "Replaced";

  const fields = ["inputs", "outputs", "code", "errors"];

  function getBaseAndComparables(field: string) {
    const marker = node.marker;
    const bSpan = node.baseSpanRef;
    const tSpan = node.targetSpanRef;

    let baseVal: any;
    const comps: any[] = [];

    // If marker === " " or "r", both base & target matter
    if (marker === " " || marker === "r") {
      baseVal = bSpan?.[field];
      if (tSpan) comps.push(tSpan[field]);
    } else if (marker === "+") {
      baseVal = tSpan?.[field];
    } else if (marker === "-") {
      baseVal = bSpan?.[field];
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
        if (baseVal === undefined && (!comps.length || comps[0] === undefined)) {
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

/** Convert a Span to a PatchDiffNode with marker=" " (unchanged) */
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
  CollapsiblePatchLineNode: renders each node in the patch tree.
  The big fix: call useEffect unconditionally, then do the “root skip.”
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

  // 1) Always call the effect. If nodeRef.current doesn't exist or we skip
  //    the "root" rendering, it won't break the Hooks rules:
  useEffect(() => {
    if (!nodeRef.current) return;
    const rect = nodeRef.current.getBoundingClientRect();
    const childCenterY = rect.y + ROW_HEIGHT / 2;
    setSegmentHeight(childCenterY - parentCenterY);
  }, [parentCenterY, collapsedNodes]);

  // 2) If top-level node is "ROOT" & marker=" " & children exist, skip
  //    rendering this node label and just render its children:
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

  // The rest: normal rendering
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
  UnifiedTraceView: Manages base vs compare selection, displays a patch
                    tree of differences, and a detail panel.
---------------------------------------------------------------------*/
interface UnifiedTraceViewProps {
  allTraces: Span[][];  // each element is an array of spans for a row
  rowIndexes: number[]; // the row index for each item in allTraces
}

export default function UnifiedTraceView({ allTraces, rowIndexes }: UnifiedTraceViewProps) {
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});
  const [selectedNode, setSelectedNode] = useState<PatchDiffNode | null>(null);

  // If multiple rows exist, let user choose one to compare to base
  const [compareIndex, setCompareIndex] = useState<number | "">("");

  // Example toggles
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [flowOpen, setFlowOpen] = useState(false);

  // Always call useEffect, then conditionally do logic inside
  useEffect(() => {
    if (!timelineOpen) return;
    // timeline logic if needed
  }, [timelineOpen]);

  useEffect(() => {
    if (!flowOpen) return;
    // flow logic if needed
  }, [flowOpen]);

  // Possibly you use unifyTracesForChart for a Gantt or timeline display
  const timelineData = useMemo(() => unifyTracesForChart(allTraces), [allTraces]);

  const singleRowMode = allTraces.length <= 1;

  // Build the patch diff from base (row 0) to selected compareIndex
  const patchRoot = useMemo<PatchDiffNode | null>(() => {
    if (!allTraces.length) return null; // no data
    const baseRoot = wrapAsRootSpan(allTraces[0], "baseRoot");

    // If single row or user set to “none,” just show base alone
    if (singleRowMode || compareIndex === "") {
      return convertSpanToPatchNode(baseRoot);
    }

    // Compare with the chosen row
    const tIdx = Number(compareIndex);
    if (!allTraces[tIdx]) return null;
    const targetRoot = wrapAsRootSpan(allTraces[tIdx], "targetRoot");
    return computeSpanDiffByName(baseRoot, targetRoot);
  }, [allTraces, singleRowMode, compareIndex]);

  // Render detail panel for the selected node
  function renderDetail() {
    if (!selectedNode) {
      return <p className="text-sm italic">Select a node on the left</p>;
    }
    // If comparing, pass that row index; else none
    const compRows =
      compareIndex !== "" && !singleRowMode
        ? [rowIndexes[Number(compareIndex)]]
        : [];
    return (
      <PatchDetailPanel
        node={selectedNode}
        baseRowIndex={rowIndexes[0]}
        comparisonLogsIndex={compRows}
      />
    );
  }

  // Build items for the “Compare with” combobox
  const compareOptions = useMemo(() => {
    const arr = [{ value: "", label: "-- None --" }];
    allTraces.slice(1).forEach((_, i) => {
      const realIdx = i + 1;
      arr.push({
        value: String(realIdx),
        label: `Row ${rowIndexes[realIdx]}`,
      });
    });
    return arr;
  }, [allTraces, rowIndexes]);

  const handleCompareChange = (val: string) => {
    setSelectedNode(null);
    setCompareIndex(val ? Number(val) : "");
    setCollapsedNodes({});
  };

  return (
    <div className="bg-background rounded-md w-full h-full p-4 flex flex-col gap-4">
      <div style={{ display: "flex", gap: "1rem", height: "600px" }}>
        {/* Left side => patch tree */}
        <div
          style={{
            flex: "0 0 300px",
            border: "1px solid var(--muted)",
            borderRadius: "0.25rem",
            position: "relative",
            overflowY: "auto",
          }}
        >
          {/* Only show Combobox if multiple rows */}
          {!singleRowMode && (
            <div className="sticky top-0 bg-background p-2 z-10 border-b border-muted">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground font-semibold block">
                  Compare with:
                </label>
                <Combobox
                  items={compareOptions}
                  value={compareIndex.toString()}
                  onValueChange={handleCompareChange}
                  placeholder="Pick a row..."
                  className="w-fit items-center"
                />
              </div>
            </div>
          )}

          <div className="p-2">
            {patchRoot ? (
              <CollapsiblePatchLineNode
                node={patchRoot}
                parentCenterY={0}
                depth={0}
                collapsedNodes={collapsedNodes}
                setCollapsedNodes={setCollapsedNodes}
                selectedNode={selectedNode}
                onSelectNode={setSelectedNode}
              />
            ) : (
              <p className="text-sm italic text-muted-foreground mt-2">
                No trace data
              </p>
            )}
          </div>
        </div>

        {/* Right side => detail panel */}
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