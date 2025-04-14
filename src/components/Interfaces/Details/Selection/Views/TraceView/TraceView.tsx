"use client";
import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/UI/accordion";
import { Combobox } from "@/components/UI/Combobox";
import { ChevronDown, ChevronRight, Clock, Code, DollarSign, AlertTriangle, FileInput, FileOutput, IdCard, FoldVertical, UnfoldVertical, Copy } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";

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
import { gatherAllSubPaths } from "@/utils/evals/pathUtils";

import { LogComparisonProps } from "../types";
import Tooltip from "@/components/Common/Misc/Tooltip";
import ChatView from "../ChatView";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/UI/hover-card";
import TimelineViewButton from "./TimelineView";
import { formatTime } from "@/utils/evals/format";
import { DoublePanels } from "@/components/Common/Body/DoublePanels";
import { TraceExpandProvider } from "./TraceExpandContext";
import { CopyButton } from "@/components/Common/Buttons/Copy";

// --- Added types for lifted state ---
export interface PersistedTraceViewState {
  collapsedNodes: Record<string, boolean>;
  setCollapsedNodes: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  selectedNode: PatchDiffNode | null;
  setSelectedNode: React.Dispatch<React.SetStateAction<PatchDiffNode | null>>;
  selectedSpanId: string;
  setSelectedSpanId: React.Dispatch<React.SetStateAction<string>>;
  groupSignature: string;
  setGroupSignature: React.Dispatch<React.SetStateAction<string>>;
  traceExpandOpenKeys: Set<string>;
  setTraceExpandOpenKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
  leftScrollPosition: number;
  setLeftScrollPosition: React.Dispatch<React.SetStateAction<number>>;
  rightScrollPosition: number;
  setRightScrollPosition: React.Dispatch<React.SetStateAction<number>>;
}

/*------------------------------------------------------------------------
  Helper functions for compressing row indices => "1-3,5,7-9", etc.
------------------------------------------------------------------------*/
function compressRowNumbers(rows: number[]): string {
  if (!rows.length) return "";
  // Convert 0-based indices to 1-based for UI display
  const sorted = [...rows]
    .sort((a, b) => a - b)
    .map(row => row + 1); // Add 1 to make it 1-based

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

// New helper function to format costs using scientific notation for very small numbers
function formatCost(value: any): string {
  // Convert the input value to a number
  const num = Number(value);
  if (isNaN(num)) return String(value);
  if (num === 0) return "0"; // if value is exactly zero, just return "0"
  // Use threshold 0.01 (as used in NumberView) to switch to exponential notation
  if (Math.abs(num) < 0.01) {
    return num.toExponential(2);
  }
  // Format with exactly 4 decimals then convert to a number to remove trailing zeros
  return parseFloat(num.toFixed(4)).toString();
}

function pickView(
  baseVal: any,
  comps: any[],
  baseLogIndex: number,
  comparisonLogsIndex: number[],
  diffMode: LogComparisonProps["diffMode"],
  splitView: LogComparisonProps["splitView"],
  displayMode: "text" | "markdown" | undefined
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
        displayMode={displayMode}
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
        displayMode={displayMode}
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
        displayMode={displayMode}
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
        displayMode={displayMode}
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
        displayMode={displayMode}
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
        displayMode={displayMode}
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
        displayMode={displayMode}
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
      displayMode={displayMode}
    />
  );
}

// Define DictionarySectionItem component to handle dictionary-type sections
function DictionarySectionItem({
  title,
  baseVal,
  comps,
  baseLogIndex,
  comparisonLogsIndex,
  diffMode,
  splitView,
  displayMode,
  persistedState,
  openSections,
  setOpenSections,
  sectionIcons,
}: {
  title: string;
  baseVal: any;
  comps: any[];
  baseLogIndex: number;
  comparisonLogsIndex: number[];
  diffMode?: LogComparisonProps["diffMode"];
  splitView?: LogComparisonProps["splitView"];
  displayMode?: "text" | "markdown" | undefined;
  persistedState?: PersistedTraceViewState;
  openSections: string[];
  setOpenSections: React.Dispatch<React.SetStateAction<string[]>>;
  sectionIcons: Record<string, JSX.Element>;
}) {
  // Create a custom icon mapping for the DictionaryView
  const customIconMapping: Record<string, JSX.Element> = {};
  
  // IMPORTANT: Declare hooks before any conditional returns
  // This ensures hooks are always called in the same order
  const [allExpanded, setAllExpanded] = useState<boolean>(false);
  const dictionaryRef = useRef<HTMLDivElement>(null);

  // Effect to update allExpanded state based on actual paths
  useEffect(() => {
    if (!persistedState) return; // Early return if no persistedState
    
    const parentPath = title.toLowerCase();
    const allKeys = Object.keys(baseVal || {});
    let allPaths: string[] = [];
    
    // Gather all paths
    for (const key of allKeys) {
      const keyPath = `${parentPath}.${key}`;
      allPaths.push(keyPath);
      
      // Get nested paths if the value is a dict or list
      const value = baseVal[key];
      if (isDict(value) || isList(value)) {
        const nestedPaths = gatherAllSubPaths(value, keyPath, parentPath, 1);
        allPaths.push(...nestedPaths);
      }
    }
    
    // Check if all paths are expanded
    const allPathsExpanded = allPaths.length > 0 && 
      allPaths.every(path => persistedState.traceExpandOpenKeys.has(path));
    
    setAllExpanded(allPathsExpanded);
  }, [persistedState?.traceExpandOpenKeys, title, baseVal]);

  // Handlers for expand/collapse actions
  const handleExpandAll = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent accordion from toggling
    
    if (!persistedState) return; // Early return if no persistedState
    
    setAllExpanded(true);
    
    // Ensure the parent accordion item is open
    if (!openSections.includes(title)) {
      setOpenSections(prev => [...prev, title]);
    }
    
    // Get all subpaths and expand them
    // Use TraceExpandContext for persisted state
    const parentPath = title.toLowerCase();
    let subPaths: string[] = [];
    
    // Add the parent path itself to ensure it's opened
    subPaths.push(parentPath);
    
    // Gather all keys
    const allKeys = Object.keys(baseVal || {});
    
    // Add paths for all keys
    for (const key of allKeys) {
      const keyPath = `${parentPath}.${key}`;
      subPaths.push(keyPath);
      
      // Get nested paths if the value is a dict or list
      const value = baseVal[key];
      if (isDict(value) || isList(value)) {
        // Add deeper nested paths
        const nestedPaths = gatherAllSubPaths(value, keyPath, parentPath, 1);
        subPaths.push(...nestedPaths);
      }
    }
    
    // Expand all paths
    persistedState.setTraceExpandOpenKeys(prev => {
      const newSet = new Set(prev);
      subPaths.forEach(path => newSet.add(path));
      return newSet;
    });
  };
  
  const handleCollapseAll = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent accordion from toggling
    
    if (!persistedState) return; // Early return if no persistedState
    
    setAllExpanded(false);
    
    // Get all subpaths and collapse them
    // Use TraceExpandContext for persisted state
    const parentPath = title.toLowerCase();
    let subPaths: string[] = [];
    
    // Gather all keys
    const allKeys = Object.keys(baseVal || {});
    
    // Add paths for all keys
    for (const key of allKeys) {
      const keyPath = `${parentPath}.${key}`;
      subPaths.push(keyPath);
      
      // Get nested paths if the value is a dict or list
      const value = baseVal[key];
      if (isDict(value) || isList(value)) {
        // Add deeper nested paths
        const nestedPaths = gatherAllSubPaths(value, keyPath, parentPath, 1);
        subPaths.push(...nestedPaths);
      }
    }
    
    // Get only child paths (keep the parent path open)
    const childPaths = subPaths.filter(path => path !== parentPath);
    
    // Collapse all paths
    persistedState.setTraceExpandOpenKeys(prev => {
      const newSet = new Set(prev);
      childPaths.forEach(path => newSet.delete(path));
      return newSet;
    });
  };
  
  return (
    <AccordionItem key={title} value={title}>
      <AccordionTrigger className="relative group flex items-center justify-between">
        <span className="inline-flex items-center gap-2">
          {sectionIcons[title] || null}<span>{title}</span>
        </span>
        {persistedState && (
          <div className="absolute right-5 flex gap-1 items-center">
            <ActionButton
              variant="ghost"
              size="sm"
              tooltip={allExpanded ? "Collapse All" : "Expand All"}
              onClick={allExpanded ? handleCollapseAll : handleExpandAll}
              icon={
                allExpanded ? (
                  <FoldVertical className="h-3 w-3" />
                ) : (
                  <UnfoldVertical className="h-3 w-3" />
                )
              }
            />
          </div>
        )}
      </AccordionTrigger>
      <AccordionContent>
        <div className="border-l ml-4 pl-1" ref={dictionaryRef}>
          <DictionaryView
            value={baseVal}
            comparables={comps}
            baseLogIndex={baseLogIndex}
            comparisonLogsIndex={comparisonLogsIndex}
            diffMode={diffMode ?? "none"}
            splitView={splitView ?? false}
            displayMode={displayMode ?? "markdown"}
            nestingLevel={1}
            prefix={title.toLowerCase()} // Use lowercase section name as prefix
            parentPath={title.toLowerCase()} // Use lowercase section name as parent path
            customIconMapping={customIconMapping}
          />
        </div>
      </AccordionContent>
    </AccordionItem>
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
  displayMode,
  persistedState,
}: {
  node: PatchDiffNode;
  baseRowIndex: number;
  comparisonLogsIndex: number[];
  allTraces: Span[][];
  allRowIndexes: number[];
  diffMode?: LogComparisonProps["diffMode"];
  splitView?: LogComparisonProps["splitView"];
  displayMode?: "text" | "markdown" | undefined;
  persistedState?: PersistedTraceViewState;
}) {
  // IMPORTANT: Declare ALL hooks at the top level before any conditional logic
  
  // Track which accordion items are open
  const [openSections, setOpenSections] = useState<string[]>(["Inputs", "Outputs"]);
  
  // Store stable references to props to avoid unnecessary re-renders
  const propsRef = React.useRef({
    node,
    baseRowIndex,
    comparisonLogsIndex,
    diffMode,
    splitView,
    displayMode
  });
  
  // Only update the reference if important props change
  React.useEffect(() => {
    const currentProps = propsRef.current;
    const nodeChanged = currentProps.node !== node && 
                       (currentProps.node?.name !== node.name || 
                        currentProps.node?.baseSpanRef?.id !== node.baseSpanRef?.id);
    
    const configChanged = currentProps.diffMode !== diffMode || 
                         currentProps.splitView !== splitView || 
                         currentProps.displayMode !== displayMode;
                          
    if (nodeChanged || configChanged) {
      propsRef.current = {
        node,
        baseRowIndex,
        comparisonLogsIndex,
        diffMode,
        splitView,
        displayMode
      };
    }
  }, [node, baseRowIndex, comparisonLogsIndex, diffMode, splitView, displayMode]);
  
  // Early return after all hooks are declared
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
    "ID": <IdCard className="h-4 w-4 text-primary" />,
    "IDs": <IdCard className="h-4 w-4 text-primary" />,
  };

  // Helper to render a standard accordion item
  function maybeRenderBlock(title: string, baseVal: any, comps: any[]): JSX.Element | null {
    // Determine if we should render anything by checking emptiness first
    const isEmpty = allEmpty(baseVal, comps);
    if (isEmpty) {
      return null;
    }

    // Special handling for "Inputs" and "Outputs" sections
    if (title === "Inputs" || title === "Outputs") {
      // If it's not a dictionary, fall back to standard rendering
      if (!isDict(baseVal)) {
        const view = pickView(baseVal, comps, baseRowIndex, comparisonLogsIndex, diffMode, splitView, displayMode ?? "markdown");
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

      // Use a dedicated component for dictionary inputs/outputs to encapsulate hooks
      return (
        <DictionarySectionItem 
          title={title}
          baseVal={baseVal}
          comps={comps}
          baseLogIndex={baseRowIndex}
          comparisonLogsIndex={comparisonLogsIndex}
          diffMode={diffMode}
          splitView={splitView}
          displayMode={displayMode}
          persistedState={persistedState}
          openSections={openSections}
          setOpenSections={setOpenSections}
          sectionIcons={sectionIcons}
        />
      );
    }

    // Standard rendering for other sections
    const view = pickView(baseVal, comps, baseRowIndex, comparisonLogsIndex, diffMode, splitView, displayMode ?? "markdown");

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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="font-bold text-sm">{node.name}</p>
          {node.baseSpanRef?.id && (
            <CopyButton
              content={node.baseSpanRef?.id ?? ""}
              copyMessage={
                node.baseSpanRef?.parent_span_id ? "Copied span ID" : "Copied trace ID"
              }
              tooltipContent={
                node.baseSpanRef?.parent_span_id ? 
                "Copy span ID" : 
                "Copy trace ID"
              }
            />
          )}
        </div>
        { (node.baseSpanRef || node.targetSpanRef) && (
          <TimelineViewButton
            baseTrace={
              node.baseSpanRef ? [node.baseSpanRef] : undefined
            }
            targetTrace={
              node.targetSpanRef && node.targetSpanRef !== node.baseSpanRef
                ? [node.targetSpanRef]
                : undefined
            }
          />
        )}
      </div>
      
      <Accordion 
        type="multiple" 
        defaultValue={["Inputs", "Outputs"]} 
        value={openSections}
        onValueChange={setOpenSections}
        className="mt-3"
      >
        {(() => {
          const { baseVal: bInputs, comps: cInputs } = gatherField("inputs");
          const { baseVal: bOutputs, comps: cOutputs } = gatherField("outputs");
          const { baseVal: bCode, comps: cCode } = gatherField("code");
          const { baseVal: bExecTime, comps: cExecTime } = gatherField("exec_time");
          const { baseVal: bErrors, comps: cErrors } = gatherField("errors");
          const { baseVal: bCost, comps: cCost } = gatherField("cost");
          const { baseVal: bCostIncCache, comps: cCostIncCache } = gatherField("cost_inc_cache");
          
          // Gather IDs
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
          
          // Determine if we're showing a single ID or multiple IDs
          const idSectionTitle = comparisonLogsIndex.length > 0 && cId.some(id => id !== "") ? "IDs" : "ID";
          
          // Specialized renderer for cost section
          function renderCostBlock(): JSX.Element | null {
            const isEmpty = allEmpty(bCost, cCost) && allEmpty(bCostIncCache, cCostIncCache);
            if (isEmpty) return null;
            
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
                      scientificNotation={true}
                      displayMode={displayMode}
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
                      scientificNotation={true}
                      displayMode={displayMode}
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
          
          // Return all accordion sections
          return (
            <>
              {maybeRenderBlock("Inputs", bInputs, cInputs)}
              {maybeRenderBlock("Outputs", bOutputs, cOutputs)}
              {maybeRenderBlock("Code", bCode, cCode)}
              {maybeRenderBlock("Execution Time", bExecTime, cExecTime)}
              {maybeRenderBlock("Errors", bErrors, cErrors)}
              {renderCostBlock()}
              {maybeRenderBlock(idSectionTitle, bId, cId)}
            </>
          );
        })()}
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

  const isSelected = selectedNode ? (
    node.name === selectedNode.name && 
    node.baseSpanRef?.id === selectedNode.baseSpanRef?.id &&
    node.targetSpanRef?.id === selectedNode.targetSpanRef?.id
  ) : false;

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

  // Extract LLM usage data
  const baseLlmUsage = node.baseSpanRef?.llm_usage;
  const baseLlmUsageIncCache = node.baseSpanRef?.llm_usage_inc_cache;
  const targetLlmUsage = node.targetSpanRef?.llm_usage;
  const targetLlmUsageIncCache = node.targetSpanRef?.llm_usage_inc_cache;
  
  // Check if this is a cached call based on type OR cached tokens
  const isBaseSpanCached = node.baseSpanRef?.type === "llm-cached" || 
                          (baseLlmUsage?.prompt_tokens_details?.cached_tokens ?? 0) > 0;
  const isTargetSpanCached = node.targetSpanRef?.type === "llm-cached" || 
                           (targetLlmUsage?.prompt_tokens_details?.cached_tokens ?? 0) > 0;

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


  // Get costs from LLM usage if available, otherwise use direct cost properties
  const baseCost = baseLlmUsage?.cost ?? node.baseSpanRef?.cost ?? 0;
  const baseCostIncCache = baseLlmUsageIncCache?.cost ?? node.baseSpanRef?.cost_inc_cache ?? 0;
  const targetCost = targetLlmUsage?.cost ?? node.targetSpanRef?.cost ?? 0;
  const targetCostIncCache = targetLlmUsageIncCache?.cost ?? node.targetSpanRef?.cost_inc_cache ?? 0;

  // Get token details - for cached calls, prefer llm_usage_inc_cache
  const basePromptTokens = isBaseSpanCached 
    ? (baseLlmUsageIncCache?.prompt_tokens ?? baseLlmUsage?.prompt_tokens ?? 0)
    : (baseLlmUsage?.prompt_tokens ?? 0);
  
  const baseReasoningTokens = isBaseSpanCached
    ? (baseLlmUsageIncCache?.reasoning_tokens ?? baseLlmUsage?.reasoning_tokens ?? 0)
    : (baseLlmUsage?.reasoning_tokens ?? 0);
  
  const baseCompletionTokens = isBaseSpanCached
    ? (baseLlmUsageIncCache?.completion_tokens ?? baseLlmUsage?.completion_tokens ?? 0)
    : (baseLlmUsage?.completion_tokens ?? 0);
  
  const baseTotalTokens = isBaseSpanCached
    ? (baseLlmUsageIncCache?.total_tokens ?? baseLlmUsage?.total_tokens ?? 0)
    : (baseLlmUsage?.total_tokens ?? 0);
  
  const targetPromptTokens = isTargetSpanCached
    ? (targetLlmUsageIncCache?.prompt_tokens ?? targetLlmUsage?.prompt_tokens ?? 0)
    : (targetLlmUsage?.prompt_tokens ?? 0);
  
  const targetReasoningTokens = isTargetSpanCached
    ? (targetLlmUsageIncCache?.reasoning_tokens ?? targetLlmUsage?.reasoning_tokens ?? 0)
    : (targetLlmUsage?.reasoning_tokens ?? 0);
  
  const targetCompletionTokens = isTargetSpanCached
    ? (targetLlmUsageIncCache?.completion_tokens ?? targetLlmUsage?.completion_tokens ?? 0)
    : (targetLlmUsage?.completion_tokens ?? 0);
  
  const targetTotalTokens = isTargetSpanCached
    ? (targetLlmUsageIncCache?.total_tokens ?? targetLlmUsage?.total_tokens ?? 0)
    : (targetLlmUsage?.total_tokens ?? 0);

  // Extract cached tokens info
  const baseCachedTokens = baseLlmUsage?.prompt_tokens_details?.cached_tokens ?? 0;
  const targetCachedTokens = targetLlmUsage?.prompt_tokens_details?.cached_tokens ?? 0;

  // Calculate effective token count (excluding cached tokens)
  const baseEffectiveTokens = baseTotalTokens - baseCachedTokens;
  const targetEffectiveTokens = targetTotalTokens - targetCachedTokens;

  // Prepare token label - show total tokens
  let tokenLabel = "";
  let tokenData: any = null;

  if (!multiMode) {
    if (baseTotalTokens > 0) {
      tokenLabel = `${baseTotalTokens} ${baseCachedTokens > 0 ? `(${baseCachedTokens} cached)` : ""} tks`;
      tokenData = {
        title: "Token Usage",
        basePromptTokens,
        baseReasoningTokens,
        baseCompletionTokens,
        baseTotalTokens,
        baseCachedTokens,
        baseEffectiveTokens,
        baseCost,
        isBaseCached: isBaseSpanCached,
        basePromptTokensDetails: baseLlmUsage?.prompt_tokens_details,
        baseCompletionTokensDetails: baseLlmUsage?.completion_tokens_details,
      };
    }
  } else {
    if (node.marker === "+") {
      if (targetTotalTokens > 0) {
        tokenLabel = `${targetTotalTokens} ${targetCachedTokens > 0 ? `(${targetCachedTokens} cached)` : ""} tks`;
        tokenData = {
          title: "Token Usage (Comparison Only)",
          targetPromptTokens,
          targetReasoningTokens,
          targetCompletionTokens,
          targetTotalTokens,
          targetCachedTokens,
          targetEffectiveTokens,
          targetCost,
          isTargetCached: isTargetSpanCached,
          targetPromptTokensDetails: targetLlmUsage?.prompt_tokens_details,
          targetCompletionTokensDetails: targetLlmUsage?.completion_tokens_details,
        };
      }
    } else if (node.marker === "-") {
      if (baseTotalTokens > 0) {
        tokenLabel = `${baseTotalTokens} ${baseCachedTokens > 0 ? `(${baseCachedTokens} cached)` : ""} tks`;
        tokenData = {
          title: "Token Usage (Base Only)",
          basePromptTokens,
          baseReasoningTokens,
          baseCompletionTokens,
          baseTotalTokens,
          baseCachedTokens,
          baseEffectiveTokens,
          baseCost,
          isBaseCached: isBaseSpanCached,
          basePromptTokensDetails: baseLlmUsage?.prompt_tokens_details,
          baseCompletionTokensDetails: baseLlmUsage?.completion_tokens_details,
        };
      }
    } else {
      if (baseTotalTokens > 0 || targetTotalTokens > 0) {
        const diffTokens = targetTotalTokens - baseTotalTokens;
        const diffEffectiveTokens = targetEffectiveTokens - baseEffectiveTokens;
        const signTokens = diffTokens >= 0 ? "+" : "-";
        tokenLabel = `${signTokens}${Math.abs(diffTokens)} tks`;
        tokenData = {
          title: "Token Usage",
          basePromptTokens,
          baseReasoningTokens,
          baseCompletionTokens,
          baseTotalTokens,
          baseCachedTokens,
          baseEffectiveTokens,
          targetPromptTokens,
          targetReasoningTokens,
          targetCompletionTokens,
          targetTotalTokens,
          targetCachedTokens,
          targetEffectiveTokens,
          diffSignTokens: signTokens,
          diffAbsTokens: Math.abs(diffTokens),
          diffEffectiveTokens: diffEffectiveTokens,
          isBaseCached: isBaseSpanCached,
          isTargetCached: isTargetSpanCached,
          basePromptTokensDetails: baseLlmUsage?.prompt_tokens_details,
          baseCompletionTokensDetails: baseLlmUsage?.completion_tokens_details,
          targetPromptTokensDetails: targetLlmUsage?.prompt_tokens_details,
          targetCompletionTokensDetails: targetLlmUsage?.completion_tokens_details,
        };
      }
    }
  }

  let costLabel = "";
  let costData: any = null;

  if (!multiMode) {
    if (baseCost > 0 || baseCostIncCache > 0) {
      costLabel = `$${formatCost(baseCost)}`;
      costData = {
        title: "LLM Cost Details",
        baseCost,
        baseCostIncCache,
      };
    }
  } else {
    if (node.marker === "+") {
      if (targetCost > 0 || targetCostIncCache > 0) {
        costLabel = `$${formatCost(targetCost)}`;
        costData = {
          title: "LLM Cost (Comparison Only)",
          targetCost,
          targetCostIncCache,
        };
      }
    } else if (node.marker === "-") {
      if (baseCost > 0 || baseCostIncCache > 0) {
        costLabel = `$${formatCost(baseCost)}`;
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
        const absDiffC = formatCost(Math.abs(diffC));
        costLabel = `${signC}$${absDiffC}`;
        costData = {
          title: "LLM Costs",
          baseCost,
          baseCostIncCache,
          targetCost,
          targetCostIncCache,
          diffSign: signC,
          diffAbs: absDiffC,
          diffSignIncCache: signC,
          diffAbsIncCache: absDiffC,
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

        {/* Span name + optional time/cost/token labels */}
        <div className="truncate flex items-center">
          {node.name}
          {timeLabel && timeData && (
            <HoverCard>
              <HoverCardTrigger asChild>
                <span className={`ml-2 text-xs ${isSelected ? 'text-primary-foreground' : 'text-muted-foreground'} underline cursor-pointer`}>
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
          {tokenLabel && tokenData && (
            <HoverCard>
              <HoverCardTrigger asChild>
                <span className={`ml-2 text-xs ${isSelected ? 'text-primary-foreground' : 'text-muted-foreground'} underline cursor-pointer`}>
                  {tokenLabel}
                </span>
              </HoverCardTrigger>
              <HoverCardContent className="p-2 w-fit">
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p className="font-semibold">{tokenData.title}</p>
                  {tokenData.baseTotalTokens > 0 && (
                    <div>
                      <p>Base Token Usage:{tokenData.isBaseCached ? " (From Cache)" : ""}</p>
                      <ul className="list-disc ml-4">
                        <li>Prompt: {tokenData.basePromptTokens}</li>
                        {tokenData.baseReasoningTokens > 0 && (
                          <li>Reasoning: {tokenData.baseReasoningTokens}</li>
                        )}
                        <li>Completion: {tokenData.baseCompletionTokens}</li>
                        <li>Total: {tokenData.baseTotalTokens}</li>
                        {tokenData.baseCachedTokens > 0 && (
                          <>
                            <li>Cached: {tokenData.baseCachedTokens}</li>
                            <li>Effective (excl. cached): {tokenData.baseEffectiveTokens}</li>
                          </>
                        )}
                      </ul>
                    </div>
                  )}
                  {tokenData.targetTotalTokens > 0 && (
                    <div>
                      <p>Comparison Token Usage:{tokenData.isTargetCached ? " (From Cache)" : ""}</p>
                      <ul className="list-disc ml-4">
                        <li>Prompt: {tokenData.targetPromptTokens}</li>
                        {tokenData.targetReasoningTokens > 0 && (
                          <li>Reasoning: {tokenData.targetReasoningTokens}</li>
                        )}
                        <li>Completion: {tokenData.targetCompletionTokens}</li>
                        <li>Total: {tokenData.targetTotalTokens}</li>
                        {tokenData.targetCachedTokens > 0 && (
                          <>
                            <li>Cached: {tokenData.targetCachedTokens}</li>
                            <li>Effective (excl. cached): {tokenData.targetEffectiveTokens}</li>
                          </>
                        )}
                      </ul>
                    </div>
                  )}
                  {tokenData.diffSignTokens && (
                    <p>
                      Difference: {tokenData.diffSignTokens}{tokenData.diffAbsTokens} tokens 
                      {(tokenData.baseCachedTokens > 0 || tokenData.targetCachedTokens > 0 || 
                       tokenData.isBaseCached || tokenData.isTargetCached) && 
                        ` (Effective: ${tokenData.diffEffectiveTokens >= 0 ? '+' : ''}${tokenData.diffEffectiveTokens})`
                      }
                    </p>
                  )}
                </div>
              </HoverCardContent>
            </HoverCard>
          )}
          {costLabel && costData && (
            <HoverCard>
              <HoverCardTrigger asChild>
                <span className={`ml-2 text-xs ${isSelected ? 'text-primary-foreground' : 'text-muted-foreground'} underline cursor-pointer`}>
                  {costLabel}
                </span>
              </HoverCardTrigger>
              <HoverCardContent className="p-2 w-fit">
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p className="font-semibold">{costData.title}</p>
                  {costData.baseCost !== undefined && (
                    <p>
                      Base Cost: ${formatCost(costData.baseCost)} (Including
                      cache: ${formatCost(costData.baseCostIncCache)})
                    </p>
                  )}
                  {costData.targetCost !== undefined && (
                    <p>
                      Comparison Cost: ${formatCost(costData.targetCost)}{" "}
                      (Including cache: ${formatCost(costData.targetCostIncCache)}
                      )
                    </p>
                  )}
                  {costData.diffSign && (
                    <p>
                      Difference: {costData.diffSign}${formatCost(costData.diffAbs)}{" "}
                      (Including cache: {costData.diffSignIncCache}$
                      {formatCost(costData.diffAbsIncCache)})
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
  displayMode?: "text" | "markdown" | undefined;
  // New prop for persisted state (optional)
  persistedState?: PersistedTraceViewState;
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

// Extract the detail panel to a separate component that can be memoized
const MemoizedDetailPanel = React.memo(function DetailPanel({
  selectedNode,
  baseRowIndex,
  comparisonLogsIndex,
  allTraces,
  allRowIndexes,
  diffMode,
  splitView,
  displayMode,
  persistedState
}: {
  selectedNode: PatchDiffNode | null;
  baseRowIndex: number;
  comparisonLogsIndex: number[];
  allTraces: Span[][];
  allRowIndexes: number[];
  diffMode?: LogComparisonProps["diffMode"];
  splitView?: LogComparisonProps["splitView"];
  displayMode?: "text" | "markdown" | undefined;
  persistedState?: PersistedTraceViewState;
}) {
  if (!selectedNode) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground italic">Select a trace span to view details</p>
      </div>
    );
  }

  return (
    <PatchDetailPanel
      node={selectedNode}
      baseRowIndex={baseRowIndex}
      comparisonLogsIndex={comparisonLogsIndex}
      allTraces={allTraces}
      allRowIndexes={allRowIndexes}
      diffMode={diffMode}
      splitView={splitView}
      displayMode={displayMode}
      persistedState={persistedState}
    />
  );
}, (prevProps, nextProps) => {
  // More robust comparison to prevent unnecessary re-renders
  
  // Compare basic config
  const configsEqual = prevProps.diffMode === nextProps.diffMode && 
    prevProps.splitView === nextProps.splitView && 
    prevProps.displayMode === nextProps.displayMode;
  
  if (!configsEqual) return false;
  
  // Compare indices arrays by stringify
  const prevIndices = JSON.stringify(prevProps.comparisonLogsIndex);
  const nextIndices = JSON.stringify(nextProps.comparisonLogsIndex);
  if (prevIndices !== nextIndices) return false;
  
  // Compare base index
  if (prevProps.baseRowIndex !== nextProps.baseRowIndex) return false;
  
  // If either node is null, compare strict equality
  if (!prevProps.selectedNode || !nextProps.selectedNode) {
    return prevProps.selectedNode === nextProps.selectedNode;
  }
  
  // Deep comparison of the important node properties
  const prevNode = prevProps.selectedNode;
  const nextNode = nextProps.selectedNode;
  
  return prevNode.name === nextNode.name && 
         prevNode.marker === nextNode.marker &&
         prevNode.baseSpanRef?.id === nextNode.baseSpanRef?.id &&
         prevNode.targetSpanRef?.id === nextNode.targetSpanRef?.id;
});

export default function UnifiedTraceView({
  allTraces,
  rowIndexes,
  diffMode = "none",
  splitView = false,
  displayMode = "markdown",
  persistedState,
}: UnifiedTraceViewProps) {
  // If the persisted state is not provided, fall back to local state
  const [localCollapsedNodes, setLocalCollapsedNodes] = useState<Record<string, boolean>>({});
  const [localSelectedNode, setLocalSelectedNode] = useState<PatchDiffNode | null>(null);
  const [localSelectedSpanId, setLocalSelectedSpanId] = useState<string>("");
  const [localGroupSignature, setLocalGroupSignature] = useState("");
  // State for trace expand keys and scroll positions
  const [localTraceExpandOpenKeys, setLocalTraceExpandOpenKeys] = useState<Set<string>>(new Set());
  const [localLeftScrollPosition, setLocalLeftScrollPosition] = useState<number>(0);
  const [localRightScrollPosition, setLocalRightScrollPosition] = useState<number>(0);

  // Use persisted state if provided, otherwise use local state
  const collapsedNodes = persistedState ? persistedState.collapsedNodes : localCollapsedNodes;
  const setCollapsedNodes = persistedState ? persistedState.setCollapsedNodes : setLocalCollapsedNodes;

  const selectedNode = persistedState ? persistedState.selectedNode : localSelectedNode;
  const setSelectedNode = persistedState ? persistedState.setSelectedNode : setLocalSelectedNode;

  const selectedSpanId = persistedState ? persistedState.selectedSpanId : localSelectedSpanId;
  const setSelectedSpanId = persistedState ? persistedState.setSelectedSpanId : setLocalSelectedSpanId;

  const groupSignature = persistedState ? persistedState.groupSignature : localGroupSignature;
  const setGroupSignature = persistedState ? persistedState.setGroupSignature : setLocalGroupSignature;
  
  // Get trace expand keys from persisted state if available
  const traceExpandOpenKeys = persistedState ? persistedState.traceExpandOpenKeys : localTraceExpandOpenKeys;
  const setTraceExpandOpenKeys = persistedState ? persistedState.setTraceExpandOpenKeys : setLocalTraceExpandOpenKeys;
  
  // Get scroll positions from persisted state if available
  const leftScrollPosition = persistedState ? persistedState.leftScrollPosition : localLeftScrollPosition;
  const setLeftScrollPosition = persistedState ? persistedState.setLeftScrollPosition : setLocalLeftScrollPosition;
  
  const rightScrollPosition = persistedState ? persistedState.rightScrollPosition : localRightScrollPosition;
  const setRightScrollPosition = persistedState ? persistedState.setRightScrollPosition : setLocalRightScrollPosition;
  
  // Create refs for left and right scroll containers
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  
  // Add flags to prevent scroll restoration during manual scrolling
  const isManuallyScrollingLeft = useRef(false);
  const isManuallyScrollingRight = useRef(false);
  const scrollLeftTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Flag to track initial render
  const initialRenderCompleted = useRef(false);

  // Restore scroll positions on initial mount only
  useEffect(() => {
    if (!initialRenderCompleted.current) {
      if (leftScrollRef.current) {
        leftScrollRef.current.scrollTop = leftScrollPosition;
      }
      if (rightScrollRef.current) {
        rightScrollRef.current.scrollTop = rightScrollPosition;
      }
      initialRenderCompleted.current = true;
    }
  }, [leftScrollPosition, rightScrollPosition]);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (scrollLeftTimeoutRef.current) {
        clearTimeout(scrollLeftTimeoutRef.current);
      }
      if (scrollRightTimeoutRef.current) {
        clearTimeout(scrollRightTimeoutRef.current);
      }
    };
  }, []);
  
  // Handlers to update scroll positions on scroll events with debouncing
  const handleLeftScroll = (e: React.UIEvent<HTMLDivElement>) => {
    // Set flag to indicate we're manually scrolling
    isManuallyScrollingLeft.current = true;
    
    // Get the current scroll position
    const newScrollTop = (e.target as HTMLDivElement).scrollTop;
    
    // Clear any existing timeout
    if (scrollLeftTimeoutRef.current) {
      clearTimeout(scrollLeftTimeoutRef.current);
    }
    
    // Set a new timeout to update the state after scrolling stops
    scrollLeftTimeoutRef.current = setTimeout(() => {
      // Only update if the value changed
      if (newScrollTop !== leftScrollPosition) {
        setLeftScrollPosition(newScrollTop);
      }
      
      // Reset the flag
      isManuallyScrollingLeft.current = false;
      scrollLeftTimeoutRef.current = null;
    }, 150); // Wait for scrolling to stop
  };
  
  const handleRightScroll = (e: React.UIEvent<HTMLDivElement>) => {
    // Set flag to indicate we're manually scrolling
    isManuallyScrollingRight.current = true;
    
    // Get the current scroll position
    const newScrollTop = (e.target as HTMLDivElement).scrollTop;
    
    // Clear any existing timeout
    if (scrollRightTimeoutRef.current) {
      clearTimeout(scrollRightTimeoutRef.current);
    }
    
    // Set a new timeout to update the state after scrolling stops
    scrollRightTimeoutRef.current = setTimeout(() => {
      // Only update if the value changed
      if (newScrollTop !== rightScrollPosition) {
        setRightScrollPosition(newScrollTop);
      }
      
      // Reset the flag
      isManuallyScrollingRight.current = false;
      scrollRightTimeoutRef.current = null;
    }, 150); // Wait for scrolling to stop
  };

  const multiMode = rowIndexes.length > 1;

  const baseRowSpans = useMemo(() => {
    if (!allTraces.length) return [];
    return allTraces[0] ?? [];
  }, [allTraces]);

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
        // Use candidate.name as a fallback if no id is present
        const newId = candidate.baseSpanRef?.id || candidate.targetSpanRef?.id || candidate.name;
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
        // Use candidate.name as a fallback if no id is present
        const newId = candidate.baseSpanRef?.id || candidate.targetSpanRef?.id || candidate.name;
        setSelectedNode(candidate);
        setSelectedSpanId(newId);
      } else {
        setSelectedNode(null);
        setSelectedSpanId("");
      }
    } else {
      // Always update the selectedNode with the found node to ensure proper rendering
      setSelectedNode(found);
    }
  }, [finalPatchRoot, selectedSpanId, setSelectedNode, setSelectedSpanId]);

  // Memoize functions to prevent recreations on each render
  const onSelectNode = React.useCallback((n: PatchDiffNode | null) => {
    if (!n) {
      setSelectedNode(null);
      setSelectedSpanId("");
      return;
    }
    
    // Use node name as fallback if no ID exists
    const newId = n.baseSpanRef?.id || n.targetSpanRef?.id || n.name;
    // Always update both the selected node and the span ID to keep them in sync
    setSelectedNode(n);
    setSelectedSpanId(newId);
  }, [setSelectedNode, setSelectedSpanId]);

  const handleGroupChange = React.useCallback((val: string) => {
    setGroupSignature(val);
    setCollapsedNodes({});
    setSelectedNode(null);
    setSelectedSpanId("");
  }, [setGroupSignature, setCollapsedNodes, setSelectedNode, setSelectedSpanId]);

  function renderPatchTree() {
    if (!finalPatchRoot) {
      return <p className="text-sm italic text-muted-foreground mt-2">No trace data</p>;
    }
    const forest = flattenRootNode(finalPatchRoot);
    if (!forest.length) {
      return <p className="text-sm italic text-muted-foreground mt-2">No top-level spans</p>;
    }
    
    // Add a key with selectedNode state to force remounting when selection changes
    // This ensures highlighting is properly updated
    return (
      <React.Fragment key={`trace-tree-${selectedSpanId}`}>
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
      </React.Fragment>
    );
  }

  // Memoize the renderDetail function to avoid recreating on each render
  const renderDetail = React.useCallback(() => {
    return (
      <MemoizedDetailPanel
        selectedNode={selectedNode}
        baseRowIndex={rowIndexes[0]}
        comparisonLogsIndex={groupCompareRows}
        allTraces={allTraces}
        allRowIndexes={rowIndexes}
        diffMode={diffMode}
        splitView={splitView}
        displayMode={displayMode}
        persistedState={persistedState}
      />
    );
  }, [selectedNode, rowIndexes, groupCompareRows, allTraces, diffMode, splitView, displayMode, persistedState]);

  return (
    <TraceExpandProvider
      externalOpenKeys={traceExpandOpenKeys}
      setExternalOpenKeys={setTraceExpandOpenKeys}
    >
      <div className="bg-background rounded-md w-full h-full p-4 flex flex-col gap-4">
        <div style={{ height: "600px" }}>
          <DoublePanels
            isLoading={false}
            defaultFirstSize={30}
            defaultSecondSize={70}
            first={
              <div
                ref={leftScrollRef}
                onScroll={handleLeftScroll}
                style={{
                  height: "100%",
                  border: "1px solid var(--muted)",
                  borderRadius: "0.25rem",
                  position: "relative",
                  overflowY: "auto",
                }}
              >
                {rowIndexes.length > 1 && (
                  <div className="sticky top-0 bg-background p-2 border-b border-muted space-y-2 z-10">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-semibold block">
                        Compare with:
                      </span>
                      <Combobox
                        items={groupOptions}
                        value={groupSignature}
                        onValueChange={handleGroupChange}
                        placeholder="Pick a group..."
                        className="w-fit items-center bg-background"
                      />
                    </div>
                  </div>
                )}
                <div className="p-2">{renderPatchTree()}</div>
              </div>
            }
            second={
              <div
                ref={rightScrollRef}
                onScroll={handleRightScroll}
                style={{
                  height: "100%",
                  border: "1px solid var(--muted)",
                  borderRadius: "0.25rem",
                  overflowY: "auto",
                  padding: "0.5rem",
                }}
              >
                {renderDetail()}
              </div>
            }
          />
        </div>
      </div>
    </TraceExpandProvider>
  );
}