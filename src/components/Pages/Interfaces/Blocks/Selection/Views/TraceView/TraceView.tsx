"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/UI/accordion";
import { Combobox } from "@/components/UI/Combobox";
import { ChevronDown, ChevronRight, Clock, Code, DollarSign, AlertTriangle, FileInput, FileOutput, IdCard, FoldVertical, UnfoldVertical, Copy, Loader2, CheckCircle } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";

import { Span } from "@/types/interfaces/traces";
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

import { isDict, isList, isMatrix, isImage, isNumber, isTimestamp, isChat, AudioPlayer, isAudio } from "@/utils/interfaces/selection/selection";
import { gatherAllSubPaths } from "@/utils/interfaces/selection/pathUtils";

import { LogComparisonProps } from "../types";
import Tooltip from "@/components/Common/Misc/Tooltip";
import ChatView from "../ChatView";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/UI/hover-card";
import TimelineViewButton from "./TimelineView";
import { formatTime } from "@/utils/interfaces/format";
import { DoublePanels } from "@/components/Common/Body/DoublePanels";
import { TraceExpandProvider } from "./TraceExpandContext";
import { CopyButton } from "@/components/Common/Buttons/Copy";
import { useTracePolling } from "@/hooks/Interfaces/useTracePolling";
import { LogsActions } from "@/types/interfaces/grid";
import { LogProps } from "@/types/interfaces/logs";

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

// Helper to safely apply toFixed on potentially non-number inputs
function safeToFixed(val: any, digits: number = 2) {
  const num = typeof val === "number" ? val : Number(val);
  if (Number.isFinite(num)) {
    return num.toFixed(digits);
  }
  // Fallback – return string representation unchanged for non-numeric values
  return String(val);
}

function pickView(
  baseVal: any,
  comps: any[],
  baseLogIndex: number,
  comparisonLogsIndex: number[],
  diffMode: LogComparisonProps["diffMode"],
  splitView: LogComparisonProps["splitView"],
  displayMode: LogComparisonProps["displayMode"],
  fieldName: string,
  context: string | null,
  baseLog: LogProps | undefined,
  comparisonLogs: LogProps[] | undefined,
  logsActions?: LogsActions,
  isImmutable?: boolean,
  cellEditMode?: boolean,
  onSaveEdit?: LogComparisonProps['onSaveEdit'],
  onGroupSaveEdit?: LogComparisonProps['onGroupSaveEdit'],
  path: (string | number)[] = [],
): JSX.Element {

  const commonProps = {
      value: baseVal,
      comparables: comps,
      baseLogIndex: baseLogIndex,
      comparisonLogsIndex: comparisonLogsIndex,
      diffMode: cellEditMode ? "none" : diffMode,
      splitView: splitView ?? false,
      displayMode: displayMode,
      cellEditMode: cellEditMode,
      onSaveEdit: onSaveEdit,
      onGroupSaveEdit: onGroupSaveEdit,
      path: path,
  };

  if (isChat(baseVal)) {
    return <ChatView {...commonProps} isImmutable={isImmutable} logsActions={logsActions} context={context} baseLog={baseLog} comparisonLogs={comparisonLogs} fieldName={fieldName}/>;
  }
  if (isDict(baseVal)) {
    return <DictionaryView {...commonProps} isImmutable={isImmutable} logsActions={logsActions} context={context} baseLog={baseLog} comparisonLogs={comparisonLogs} fieldName={fieldName}/>;
  }
  if (isList(baseVal)) {
    return <ListView {...commonProps} isImmutable={isImmutable} logsActions={logsActions} context={context} baseLog={baseLog} comparisonLogs={comparisonLogs} fieldName={fieldName}/>;
  }
  if (isImage(baseVal)) {
    return <ImageView {...commonProps} />;
  }
  if (isAudio(baseVal)) {
    return <AudioPlayer {...commonProps} />;
  }
  if (isMatrix(baseVal)) {
    return <MatrixView {...commonProps} />;
  }
  if (isNumber(baseVal)) {
    return <NumberView {...commonProps} nested={true} isImmutable={isImmutable}/>;
  }
  if (isTimestamp(baseVal)) {
    return <TimestampView {...commonProps} nested={true} isImmutable={isImmutable}/>;
  }
  // Fallback => string
  return <StringView {...commonProps} nested={true} isImmutable={isImmutable}/>;
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
  fieldName,
  context,
  baseLog,
  comparisonLogs,
  logsActions,
  isImmutable,
  cellEditMode,
  onSaveEdit,
  onGroupSaveEdit,
  parentPath,
  nested
}: {
  title: string;
  baseVal: any;
  comps: any[];
  baseLogIndex: number;
  comparisonLogsIndex: number[];
  diffMode?: LogComparisonProps["diffMode"];
  splitView?: LogComparisonProps["splitView"];
  displayMode?: LogComparisonProps["displayMode"];
  persistedState?: PersistedTraceViewState;
  openSections: string[];
  setOpenSections: React.Dispatch<React.SetStateAction<string[]>>;
  sectionIcons: Record<string, JSX.Element>;
  fieldName: string,
  context: string | null,
  baseLog: LogProps | undefined,
  comparisonLogs: LogProps[] | undefined,
  logsActions?: LogsActions,
  isImmutable?: boolean;
  cellEditMode?: boolean;
  onSaveEdit?: LogComparisonProps['onSaveEdit'];
  onGroupSaveEdit?: LogComparisonProps['onGroupSaveEdit'];
  parentPath: (string | number)[];
  nested?: boolean;
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
  }, [persistedState, persistedState?.traceExpandOpenKeys, title, baseVal]);

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
              tooltip={allExpanded ? "Collapse all" : "Expand all"}
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
            diffMode={cellEditMode ? "none" : diffMode}
            splitView={splitView ?? false}
            displayMode={displayMode ?? "markdown"}
            nestingLevel={1}
            prefix={title.toLowerCase()}
            parentPath={title.toLowerCase()}
            customIconMapping={customIconMapping}
            cellEditMode={cellEditMode}
            onSaveEdit={onSaveEdit}
            onGroupSaveEdit={onGroupSaveEdit}
            path={parentPath}
            logsActions={logsActions}
            context={context}
            baseLog={baseLog}
            comparisonLogs={comparisonLogs}
            fieldName={fieldName}
            nested
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
  fieldName,
  context,
  baseLog,
  comparisonLogs,
  logsActions,
  diffMode,
  splitView,
  displayMode,
  persistedState,
  isImmutable, cellEditMode,
  onSaveEdit,
  onGroupSaveEdit,
  path,
}: {
  node: PatchDiffNode;
  baseRowIndex: number;
  comparisonLogsIndex: number[];
  allTraces: Span[][];
  allRowIndexes: number[];
  fieldName: string,
  context: string | null,
  baseLog: LogProps | undefined,
  comparisonLogs: LogProps[] | undefined,
  logsActions?: LogsActions,
  diffMode?: LogComparisonProps["diffMode"];
  splitView?: LogComparisonProps["splitView"];
  displayMode?: LogComparisonProps["displayMode"];
  persistedState?: PersistedTraceViewState;
  isImmutable?: boolean;
  cellEditMode?: boolean;
  onSaveEdit?: LogComparisonProps['onSaveEdit'];
  onGroupSaveEdit?: LogComparisonProps['onGroupSaveEdit'];
  path?: (string | number)[];
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


  // ------------------------------------------------------------------
  // Determine the *full* path (indices + "child_spans" segments) from the
  // root trace array to the currently selected span.  This guarantees that
  // edits performed on deeply-nested spans are written back to the correct
  // location in the trace structure.
  // ------------------------------------------------------------------

  const spanPathSegments = useMemo(() => {
    const targetId = node.baseSpanRef?.id || node.targetSpanRef?.id;

    function recurse(spans: Span[], acc: (string | number)[]): (string | number)[] | null {
      for (let i = 0; i < spans.length; i++) {
        const s = spans[i];
        if (s.id === targetId) {
          return [...acc, i];
        }
        if (s.childSpans && s.childSpans.length) {
          const found = recurse(s.childSpans, [...acc, i, "child_spans"]);
          if (found) return found;
        }
      }
      return null;
    }

    const roots = (allTraces?.[0] ?? []) as Span[];
    const res = recurse(roots, []);
    return res ?? [0]; // default to first span if not found
  }, [allTraces, node.baseSpanRef, node.targetSpanRef]);

  // Helper to construct a fully-qualified edit path for a given field key
  const buildFieldPath = useCallback(
    (fieldKey: string | number) => {
      return [
        ...(path ?? []), // usually ["trace"]
        ...spanPathSegments,
        fieldKey,
      ] as (string | number)[];
    },
    [path, spanPathSegments]
  );

  // Early return AFTER all hooks are declared (including findSpanById)
  if (!node.baseSpanRef && !node.targetSpanRef) {
    return <p className="italic text-body">No base or target data</p>;
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
        const realName = bSpan?.spanName || tSpan?.spanName || node.name;
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
      if (s.spanName === spanName) {
        return s;
      }
      if (s.childSpans) {
        queue.push(...s.childSpans);
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

  // --------------------------------------------------------------
  // Helper to fetch the freshest Span by its ID from `allTraces`.
  // Declared before any early returns to satisfy React Hooks rules.
  // --------------------------------------------------------------
  const findSpanById = (id: string): Span | undefined => {
    const stack: Span[] = [];
    allTraces.forEach((arr) => {
      stack.push(...(arr as Span[]));
    });
    while (stack.length) {
      const s = stack.pop()!;
      if (s.id === id) return s;
      if (s.childSpans && s.childSpans.length) {
        stack.push(...s.childSpans);
      }
    }
    return undefined;
  };

  // Helper to render a standard accordion item (updated to pass onGroupSaveEdit)
  function maybeRenderBlock(title: string, baseVal: any, comps: any[], fieldKey: string): JSX.Element | null {
    const isEmpty = allEmpty(baseVal, comps);
    if (isEmpty) return null;
    const fullPath = buildFieldPath(fieldKey);

    if (title === "Inputs" || title === "Outputs") {
      if (!isDict(baseVal)) {
         const view = pickView(baseVal, comps, baseRowIndex, comparisonLogsIndex, diffMode, splitView, displayMode ?? "markdown", fieldName, context, baseLog, comparisonLogs, logsActions, isImmutable, cellEditMode, onSaveEdit, onGroupSaveEdit, fullPath); // Pass group save
        return (
          <AccordionItem key={title} value={title}>
            <AccordionTrigger className="relative group flex items-center justify-between"><span className="inline-flex items-center gap-2">{sectionIcons[title] || null}<span>{title}</span></span></AccordionTrigger>
            <AccordionContent><div className="border-l ml-4 pl-1">{view}</div></AccordionContent>
          </AccordionItem>
        );
      }
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
          logsActions={logsActions}
          context={context}
          baseLog={baseLog}
          comparisonLogs={comparisonLogs}
          fieldName={fieldName}
          isImmutable={isImmutable}
          cellEditMode={cellEditMode}
          onSaveEdit={onSaveEdit}
          onGroupSaveEdit={onGroupSaveEdit}
          parentPath={fullPath}
          nested
        />
      );
    }

    const view = pickView(baseVal, comps, baseRowIndex, comparisonLogsIndex, diffMode, splitView, displayMode ?? "markdown", fieldName, context, baseLog, comparisonLogs, logsActions, isImmutable, cellEditMode, onSaveEdit, onGroupSaveEdit, fullPath); // Pass group save

    return (
      <AccordionItem key={title} value={title}>
        <AccordionTrigger className="relative group flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            {sectionIcons[title] || null}<span>{title}</span>
          </span></AccordionTrigger>
        <AccordionContent><div className="border-l ml-4 pl-1">{view}</div></AccordionContent>
      </AccordionItem>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-title">{node.name}</p>
          {node.baseSpanRef?.id && (
            <CopyButton
              content={node.baseSpanRef?.id ?? ""}
              copyMessage={
                node.baseSpanRef?.parentSpanId ? "Copied span ID" : "Copied trace ID"
              }
              tooltipContent={
                node.baseSpanRef?.parentSpanId ?
                "Copy span ID" :
                "Copy trace ID"
              }
            />
          )}
        </div>
        { (node.baseSpanRef || node.targetSpanRef) && (
          <TimelineViewButton
            baseSpanId={node.baseSpanRef?.id}
            targetSpanId={node.targetSpanRef && node.targetSpanRef !== node.baseSpanRef ? node.targetSpanRef.id : undefined}
            findSpanById={findSpanById}
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
            const realName = bSpan?.spanName || tSpan?.spanName || node.name;
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
                  <p className="text-title mb-2">Cost ($)</p>
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
                      cellEditMode={cellEditMode}
                      onSaveEdit={onSaveEdit}
                      onGroupSaveEdit={onGroupSaveEdit}
                      path={buildFieldPath("cost")}
                      isImmutable={isImmutable}
                    />
                  </div>
                </div>
                <div>
                  <p className="text-title mb-2">Cost including cache ($)</p>
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
                      cellEditMode={cellEditMode}
                      onSaveEdit={onSaveEdit}
                      onGroupSaveEdit={onGroupSaveEdit}
                      path={buildFieldPath("cost_inc_cache")}
                      isImmutable={isImmutable}
                    />
                  </div>
                </div>
              </div>
            );

            return (
              <AccordionItem key="Cost" value="Cost">
                <AccordionTrigger className="relative group flex items-center justify-between">
                  <span className="inline-flex items-center gap-2">{sectionIcons["Cost"]} <span>Cost</span></span>
                </AccordionTrigger>
                <AccordionContent><div className="border-l ml-4 pl-1">{content}</div></AccordionContent>
              </AccordionItem>
            );
          }
          return (
            <>
              {maybeRenderBlock("Inputs", bInputs, cInputs, "inputs")}
              {maybeRenderBlock("Outputs", bOutputs, cOutputs, "outputs")}
              {maybeRenderBlock("Code", bCode, cCode, "code")}
              {maybeRenderBlock("Execution Time", bExecTime, cExecTime, "exec_time")}
              {maybeRenderBlock("Errors", bErrors, cErrors, "errors")}
              {renderCostBlock()}
              {maybeRenderBlock(idSectionTitle, bId, cId, idSectionTitle.toLowerCase())}
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

  const baseTime = node.baseSpanRef?.execTime ?? 0;
  const targetTime = node.targetSpanRef?.execTime ?? 0;

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
      timeLabel = `${safeToFixed(value,2)}${unit}`;
      timeData = {
        title: "Execution Time",
        baseTime,
      };
    }
  } else {
    if (node.marker === "+") {
      if (targetTime) {
        const { value, unit } = formatTime(targetTime);
        timeLabel = `${safeToFixed(value,2)}${unit}`;
        timeData = {
          title: "Execution Time (Comparison Only)",
          targetTime,
        };
      }
    } else if (node.marker === "-") {
      if (baseTime) {
        const { value, unit } = formatTime(baseTime);
        timeLabel = `${safeToFixed(value,2)}${unit}`;
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
        timeLabel = `${sign}${safeToFixed(value,2)}${unit}`;
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
    ? (baseLlmUsageIncCache?.promptTokens ?? baseLlmUsage?.promptTokens ?? 0)
    : (baseLlmUsage?.promptTokens ?? 0);

  const baseReasoningTokens = isBaseSpanCached
    ? (baseLlmUsageIncCache?.reasoning_tokens ?? baseLlmUsage?.reasoning_tokens ?? 0)
    : (baseLlmUsage?.reasoning_tokens ?? 0);

  const baseCompletionTokens = isBaseSpanCached
    ? (baseLlmUsageIncCache?.completionTokens ?? baseLlmUsage?.completionTokens ?? 0)
    : (baseLlmUsage?.completionTokens ?? 0);

  const baseTotalTokens = isBaseSpanCached
    ? (baseLlmUsageIncCache?.totalTokens ?? baseLlmUsage?.totalTokens ?? 0)
    : (baseLlmUsage?.totalTokens ?? 0);

  const targetPromptTokens = isTargetSpanCached
    ? (targetLlmUsageIncCache?.promptTokens ?? targetLlmUsage?.promptTokens ?? 0)
    : (targetLlmUsage?.promptTokens ?? 0);

  const targetReasoningTokens = isTargetSpanCached
    ? (targetLlmUsageIncCache?.reasoning_tokens ?? targetLlmUsage?.reasoning_tokens ?? 0)
    : (targetLlmUsage?.reasoning_tokens ?? 0);

  const targetCompletionTokens = isTargetSpanCached
    ? (targetLlmUsageIncCache?.completionTokens ?? targetLlmUsage?.completionTokens ?? 0)
    : (targetLlmUsage?.completionTokens ?? 0);

  const targetTotalTokens = isTargetSpanCached
    ? (targetLlmUsageIncCache?.totalTokens ?? targetLlmUsage?.totalTokens ?? 0)
    : (targetLlmUsage?.totalTokens ?? 0);

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

  // Determine status icon (completed vs running)
  const spanCompleted = (node.baseSpanRef?.completed ?? node.targetSpanRef?.completed ?? true) === true;
  const StatusIcon = spanCompleted ? CheckCircle : Loader2;
  const statusIconClass = spanCompleted ? "text-green-600" : "animate-spin text-muted-foreground";

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

        <span className="text-body text-strong w-3">
          {node.marker === " " ? "" : node.marker}
        </span>

        {/* Span name + optional time/cost/token labels */}
        <div className="truncate flex items-center">
          {node.name}
          <StatusIcon className={`h-3 w-3 ml-1 ${statusIconClass}`} />
          {timeLabel && timeData && (
            <HoverCard>
              <HoverCardTrigger asChild>
                <span className={`ml-2 text-caption ${isSelected ? 'text-primary-foreground' : 'text-muted-foreground'} underline cursor-pointer`}>
                  {timeLabel}
                </span>
              </HoverCardTrigger>
              <HoverCardContent className="p-2 w-fit">
                <div className="space-y-1 text-caption text-muted-foreground">
                  <p className="font-semibold">{timeData.title}</p>
                  {timeData.baseTime !== undefined && (
                    <p>Base Execution Time: {(() => {
                      const { value, unit } = formatTime(timeData.baseTime);
                      return `${safeToFixed(value,2)}${unit}`;
                    })()}</p>
                  )}
                  {timeData.targetTime !== undefined && (
                    <p>
                      Comparison Execution Time: {(() => {
                        const { value, unit } = formatTime(timeData.targetTime);
                        return `${safeToFixed(value,2)}${unit}`;
                      })()}
                    </p>
                  )}
                  {timeData.diffSign && (
                    <p>
                      Difference: {timeData.diffSign}{safeToFixed(timeData.diffValue,2)}{timeData.diffUnit}
                    </p>
                  )}
                </div>
              </HoverCardContent>
            </HoverCard>
          )}
          {tokenLabel && tokenData && (
            <HoverCard>
              <HoverCardTrigger asChild>
                <span className={`ml-2 text-caption ${isSelected ? 'text-primary-foreground' : 'text-muted-foreground'} underline cursor-pointer`}>
                  {tokenLabel}
                </span>
              </HoverCardTrigger>
              <HoverCardContent className="p-2 w-fit">
                <div className="space-y-1 text-caption text-muted-foreground">
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
                <span className={`ml-2 text-caption ${isSelected ? 'text-primary-foreground' : 'text-muted-foreground'} underline cursor-pointer`}>
                  {costLabel}
                </span>
              </HoverCardTrigger>
              <HoverCardContent className="p-2 w-fit">
                <div className="space-y-1 text-caption text-muted-foreground">
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
  displayMode?: LogComparisonProps["displayMode"];
  persistedState?: PersistedTraceViewState;
  isImmutable?: boolean;
  cellEditMode?: boolean;
  onSaveEdit?: LogComparisonProps['onSaveEdit'];
  onGroupSaveEdit?: LogComparisonProps['onGroupSaveEdit'];
  onTraceUpdate?: (logIndex: number, fieldName: string, newTrace: Span[]) => void;
  path?: (string | number)[];
  logsActions?: LogsActions;
  context: string | null;
  baseLog: LogProps | undefined;
  comparisonLogs: LogProps[] | undefined;
  fieldName: string
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
  fieldName,
  context,
  baseLog,
  comparisonLogs,
  logsActions,
  isImmutable,
  diffMode,
  splitView,
  displayMode,
  persistedState,
  cellEditMode,
  onSaveEdit,
  onGroupSaveEdit,
  path,
}: {
  selectedNode: PatchDiffNode | null;
  baseRowIndex: number;
  comparisonLogsIndex: number[];
  allTraces: Span[][];
  allRowIndexes: number[];
  fieldName: string,
  context: string | null,
  baseLog: LogProps | undefined,
  comparisonLogs: LogProps[] | undefined,
  logsActions?: LogsActions,
  isImmutable?: boolean;
  diffMode?: LogComparisonProps["diffMode"];
  splitView?: LogComparisonProps["splitView"];
  displayMode?: LogComparisonProps["displayMode"];
  persistedState?: PersistedTraceViewState;
  cellEditMode?: boolean;
  onSaveEdit?: LogComparisonProps['onSaveEdit'];
  onGroupSaveEdit?: LogComparisonProps['onGroupSaveEdit'];
  path?: (string | number)[];
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
      logsActions={logsActions}
      context={context}
      baseLog={baseLog}
      comparisonLogs={comparisonLogs}
      fieldName={fieldName}
      diffMode={diffMode}
      splitView={splitView}
      displayMode={displayMode}
      persistedState={persistedState}
      cellEditMode={cellEditMode}
      isImmutable={isImmutable}
      onSaveEdit={onSaveEdit}
      onGroupSaveEdit={onGroupSaveEdit}
      path={path}
    />
  );
}, (prevProps, nextProps) => {
  // Custom comparator: allow re-render when either configuration OR the
  // *underlying trace data* changes.
  if (prevProps.allTraces !== nextProps.allTraces) {
    return false;
  }

  const configsEqual =
    prevProps.diffMode === nextProps.diffMode &&
    prevProps.splitView === nextProps.splitView &&
    prevProps.displayMode === nextProps.displayMode &&
    prevProps.cellEditMode === nextProps.cellEditMode;

  if (!configsEqual) return false;

  const prevIndices = JSON.stringify(prevProps.comparisonLogsIndex);
  const nextIndices = JSON.stringify(nextProps.comparisonLogsIndex);
  if (prevIndices !== nextIndices) return false;

  if (prevProps.baseRowIndex !== nextProps.baseRowIndex) return false;

  if (!prevProps.selectedNode || !nextProps.selectedNode) {
    return prevProps.selectedNode === nextProps.selectedNode;
  }

  const prevNode = prevProps.selectedNode;
  const nextNode = nextProps.selectedNode;

  return (
    prevNode.name === nextNode.name &&
    prevNode.marker === nextNode.marker &&
    prevNode.baseSpanRef?.id === nextNode.baseSpanRef?.id &&
    prevNode.targetSpanRef?.id === nextNode.targetSpanRef?.id &&
    prevNode.baseSpanRef === nextNode.baseSpanRef &&
    prevNode.targetSpanRef === nextNode.targetSpanRef
  );
});

// Internal function to check completion recursively
function isTraceComplete(spans: Span[]): boolean {
  if (!spans || !spans.length) return true; // An empty trace or no spans means it's "complete" in a sense.
  return spans.every((s) => (s.completed ?? true) && isTraceComplete(s.childSpans ?? []));
}

// Helper component to manage polling for a single trace
const TracePoller = ({
    log,
    logIndex,
    fieldName,
    logsActions,
    context,
    onTraceUpdate,
    initialTrace, // This will be the live trace from UnifiedTraceView's state
  }: {
    log: LogProps | undefined;
    logIndex: number;
    fieldName: string;
    logsActions: LogsActions | undefined;
    context: string | null;
    onTraceUpdate: ((logIndex: number, fieldName: string, newTrace: Span[]) => void) | undefined;
    initialTrace: Span[] | undefined;
  }) => {
    const traceDone = useMemo(() => {
      if (initialTrace === undefined) return false;
      return isTraceComplete(initialTrace);
    }, [initialTrace]);

    const { data: polledTrace } = useTracePolling(
      !traceDone ? log : undefined,
      logsActions,
      context,
      fieldName,
      500
    );

    useEffect(() => {
      if (onTraceUpdate) {
        if (Array.isArray(polledTrace)) {
          if (JSON.stringify(initialTrace) !== JSON.stringify(polledTrace)) {
            // console.debug(`Polled trace update detected for logIndex: ${logIndex}, field: ${fieldName}.`);
            onTraceUpdate(logIndex, fieldName, polledTrace);
          }
        }
        // Optional: Handle cases where polledTrace is undefined (e.g., error during fetch)
        // For now, if polledTrace is undefined, we don't trigger an update.
      }
    }, [polledTrace, initialTrace, onTraceUpdate, logIndex, fieldName]);

    return null;
  };


export default function UnifiedTraceView({
  allTraces, // Initial traces from props
  rowIndexes,
  diffMode = "none",
  splitView = false,
  displayMode = "markdown",
  persistedState,
  isImmutable,
  cellEditMode,
  onSaveEdit,
  onGroupSaveEdit,
  onTraceUpdate, // Callback to update traces in the parent (SelectionPanel -> global store)
  path,
  logsActions,
  context,
  baseLog,
  comparisonLogs,
  fieldName
}: UnifiedTraceViewProps) {
  // State to hold live-updated traces, initialized from props
  const [liveBaseTrace, setLiveBaseTrace] = useState<Span[]>(allTraces[0] ?? []);
  const [liveComparisonTraces, setLiveComparisonTraces] = useState<Span[][]>(allTraces.slice(1));

  // Keep live traces in sync if the initial `allTraces` prop changes (e.g., new selection)
  useEffect(() => {
    setLiveBaseTrace(allTraces[0] ?? []);
    setLiveComparisonTraces(allTraces.slice(1));
  }, [allTraces]);

  // Combine live traces for diff computation and rendering
  const liveAllTraces = useMemo(() => [liveBaseTrace, ...liveComparisonTraces], [liveBaseTrace, liveComparisonTraces]);

  // Local state for UI elements if no persistedState is provided
  const [localCollapsedNodes, setLocalCollapsedNodes] = useState<Record<string, boolean>>({});
  const [localSelectedNode, setLocalSelectedNode] = useState<PatchDiffNode | null>(null);
  const [localSelectedSpanId, setLocalSelectedSpanId] = useState<string>("");
  const [localGroupSignature, setLocalGroupSignature] = useState("");
  const [localTraceExpandOpenKeys, setLocalTraceExpandOpenKeys] = useState<Set<string>>(new Set());
  const [localLeftScrollPosition, setLocalLeftScrollPosition] = useState<number>(0);
  const [localRightScrollPosition, setLocalRightScrollPosition] = useState<number>(0);

  // Determine which state and setters to use (persisted or local)
  const collapsedNodes = persistedState?.collapsedNodes ?? localCollapsedNodes;
  const setCollapsedNodes = persistedState?.setCollapsedNodes ?? setLocalCollapsedNodes;
  
  // Values for dependency array of selection effect
  const currentSelectedNodeValue = persistedState ? persistedState.selectedNode : localSelectedNode;
  const currentSelectedSpanIdValue = persistedState ? persistedState.selectedSpanId : localSelectedSpanId;


  const groupSignature = persistedState?.groupSignature ?? localGroupSignature;
  const setGroupSignature = persistedState?.setGroupSignature ?? setLocalGroupSignature;
  const traceExpandOpenKeys = persistedState?.traceExpandOpenKeys ?? localTraceExpandOpenKeys;
  const setTraceExpandOpenKeys = persistedState?.setTraceExpandOpenKeys ?? setLocalTraceExpandOpenKeys;
  const leftScrollPosition = persistedState?.leftScrollPosition ?? localLeftScrollPosition;
  const setLeftScrollPosition = persistedState?.setLeftScrollPosition ?? setLocalLeftScrollPosition;
  const rightScrollPosition = persistedState?.rightScrollPosition ?? localRightScrollPosition;
  const setRightScrollPosition = persistedState?.setRightScrollPosition ?? setLocalRightScrollPosition;

  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);

  // Add flags to prevent scroll restoration during manual scrolling
  const isManuallyScrollingLeft = useRef(false);
  const isManuallyScrollingRight = useRef(false);
  const scrollLeftTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialRenderCompleted = useRef(false);

  useEffect(() => {
    if (!initialRenderCompleted.current) {
      if (leftScrollRef.current) leftScrollRef.current.scrollTop = leftScrollPosition;
      if (rightScrollRef.current) rightScrollRef.current.scrollTop = rightScrollPosition;
      initialRenderCompleted.current = true;
    }
  }, [leftScrollPosition, rightScrollPosition]);

  useEffect(() => {
    return () => {
      if (scrollLeftTimeoutRef.current) clearTimeout(scrollLeftTimeoutRef.current);
      if (scrollRightTimeoutRef.current) clearTimeout(scrollRightTimeoutRef.current);
    };
  }, []);

  const handleLeftScroll = (e: React.UIEvent<HTMLDivElement>) => {
    isManuallyScrollingLeft.current = true;
    const newScrollTop = (e.target as HTMLDivElement).scrollTop;
    if (scrollLeftTimeoutRef.current) clearTimeout(scrollLeftTimeoutRef.current);
    scrollLeftTimeoutRef.current = setTimeout(() => {
      if (newScrollTop !== leftScrollPosition) setLeftScrollPosition(newScrollTop);
      isManuallyScrollingLeft.current = false;
      scrollLeftTimeoutRef.current = null;
    }, 150);
  };

  const handleRightScroll = (e: React.UIEvent<HTMLDivElement>) => {
    isManuallyScrollingRight.current = true;
    const newScrollTop = (e.target as HTMLDivElement).scrollTop;
    if (scrollRightTimeoutRef.current) clearTimeout(scrollRightTimeoutRef.current);
    scrollRightTimeoutRef.current = setTimeout(() => {
      if (newScrollTop !== rightScrollPosition) setRightScrollPosition(newScrollTop);
      isManuallyScrollingRight.current = false;
      scrollRightTimeoutRef.current = null;
    }, 150);
  };

  const multiMode = rowIndexes.length > 1;
  const baseRowSpans = useMemo(() => liveBaseTrace, [liveBaseTrace]);

  const minimalSpanHierarchy = React.useCallback((span: Span): any => ({
    name: span.spanName,
    children: (span.childSpans ?? []).map(minimalSpanHierarchy),
  }), []);

  const minimalSpanTree = React.useCallback((spans: Span[]): any => spans.map(minimalSpanHierarchy), [minimalSpanHierarchy]);

  const groupedRows = useMemo(() => {
    const result: { signature: string; rowIndices: number[] }[] = [];
    if (liveAllTraces.length <= 1) return result;
    const map = new Map<string, number[]>();

    const restOfRowIndexes = rowIndexes.slice(1);
    liveComparisonTraces.forEach((trace, compTraceIndex) => {
      const originalRowIndex = restOfRowIndexes[compTraceIndex];
      if (!trace || originalRowIndex === undefined) return;
      const shape = minimalSpanTree(trace);
      const sig = JSON.stringify(shape);
      if (!map.has(sig)) map.set(sig, []);
      map.get(sig)!.push(originalRowIndex);
    });

    for (const [signature, rows] of Array.from(map.entries())) {
      rows.sort((a, b) => a - b);
      result.push({ signature, rowIndices: rows });
    }
    return result;
  }, [liveAllTraces, liveComparisonTraces, rowIndexes, minimalSpanTree]);

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

  const unifyGroupIntoOne = React.useCallback((targetRowIndices: number[]): Span[] => {
    if (!targetRowIndices.length) return [];
    const firstTargetRow = targetRowIndices[0];
    const indexInLiveAllTraces = rowIndexes.indexOf(firstTargetRow);
    return indexInLiveAllTraces !== -1 ? (liveAllTraces[indexInLiveAllTraces] ?? []) : [];
  }, [rowIndexes, liveAllTraces]);


  const finalPatchRoot = useMemo<PatchDiffNode | null>(() => {
    if (!liveAllTraces.length) return null;
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
  }, [groupSignature, groupedRows, baseRowSpans, liveAllTraces, unifyGroupIntoOne]);


  const groupCompareRows = useMemo(() => {
    if (!groupSignature) return [];
    const found = groupedRows.find((g) => g.signature === groupSignature);
    return found ? found.rowIndices : [];
  }, [groupSignature, groupedRows]);

  useEffect(() => {
    // Get current setters from closure. These are the latest versions.
    const currentSetSelectedNode = persistedState ? persistedState.setSelectedNode : setLocalSelectedNode;
    const currentSetSelectedSpanId = persistedState ? persistedState.setSelectedSpanId : setLocalSelectedSpanId;
    
    if (!finalPatchRoot) {
        // If no root, clear selection, calling setters only if current state is different
        if (currentSelectedNodeValue !== null) currentSetSelectedNode(null);
        if (currentSelectedSpanIdValue !== "") currentSetSelectedSpanId("");
        return;
    }

    const forest = flattenRootNode(finalPatchRoot);
    let newSelectedNodeCandidate: PatchDiffNode | null = null;
    let newSelectedSpanIdCandidate: string = "";

    if (forest.length > 0) {
        const idToFind = currentSelectedSpanIdValue; // Use current selectedSpanId from state/props
        if (!idToFind) { // If no span is currently selected by ID, select the first one
            newSelectedNodeCandidate = forest[0];
        } else { // A span ID is selected, try to find it
            newSelectedNodeCandidate = findNodeInForest(forest, idToFind);
            if (!newSelectedNodeCandidate) { // If previous selection not found, select the first one
                newSelectedNodeCandidate = forest[0];
            }
        }
    }

    if (newSelectedNodeCandidate) {
        newSelectedSpanIdCandidate = newSelectedNodeCandidate.baseSpanRef?.id || newSelectedNodeCandidate.targetSpanRef?.id || newSelectedNodeCandidate.name;
    }
    
    // Explicit check before calling setter for the node to prevent unnecessary calls if the setter itself isn't robust enough.
    // This complements the internal checks of persistedState.setSelectedNode.
    let shouldUpdateNode = false;
    if (currentSelectedNodeValue === null && newSelectedNodeCandidate !== null) {
        shouldUpdateNode = true;
    } else if (currentSelectedNodeValue !== null && newSelectedNodeCandidate === null) {
        shouldUpdateNode = true;
    } else if (currentSelectedNodeValue && newSelectedNodeCandidate) {
        if (currentSelectedNodeValue.name !== newSelectedNodeCandidate.name ||
            currentSelectedNodeValue.baseSpanRef?.id !== newSelectedNodeCandidate.baseSpanRef?.id ||
            currentSelectedNodeValue.targetSpanRef?.id !== newSelectedNodeCandidate.targetSpanRef?.id ||
            // Compare actual span object references if they exist
            currentSelectedNodeValue.baseSpanRef !== newSelectedNodeCandidate.baseSpanRef ||
            currentSelectedNodeValue.targetSpanRef !== newSelectedNodeCandidate.targetSpanRef
           ) {
            shouldUpdateNode = true;
        }
    }

    if (shouldUpdateNode) {
        currentSetSelectedNode(newSelectedNodeCandidate);
    }

    if (currentSelectedSpanIdValue !== newSelectedSpanIdCandidate) {
        currentSetSelectedSpanId(newSelectedSpanIdCandidate);
    }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [finalPatchRoot, currentSelectedSpanIdValue, currentSelectedNodeValue, persistedState, localSelectedNode, localSelectedSpanId, setLocalSelectedNode, setLocalSelectedSpanId]);
// Dependencies:
// - finalPatchRoot: Tree data changes.
// - currentSelectedSpanIdValue (value): The ID we're trying to select changes.
// - currentSelectedNodeValue (value): The actual selected node object changes.
// - persistedState: if its identity changes, it implies setters might have changed or selection state it holds changed.
// - local states and setters: to ensure effect re-runs if using local state and it changes.
// The goal is that this effect only triggers actual state-setting calls if a meaningful change in selection occurs.


  const onSelectNode = React.useCallback((n: PatchDiffNode | null) => {
    const currentSetSelectedNode = persistedState ? persistedState.setSelectedNode : setLocalSelectedNode;
    const currentSetSelectedSpanId = persistedState ? persistedState.setSelectedSpanId : setLocalSelectedSpanId;
    currentSetSelectedNode(n);
    currentSetSelectedSpanId(n ? (n.baseSpanRef?.id || n.targetSpanRef?.id || n.name) : "");
  }, [persistedState, setLocalSelectedNode, setLocalSelectedSpanId]); // Add local states to dep array

  const handleGroupChange = React.useCallback((val: string) => {
    setGroupSignature(val);
    setCollapsedNodes({});
    // Selection will be re-evaluated by the useEffect hook due to groupSignature change affecting finalPatchRoot
  }, [setGroupSignature, setCollapsedNodes]);

  function renderPatchTree() {
    if (!finalPatchRoot) return <p className="text-sm italic text-muted-foreground mt-2">No trace data</p>;
    const forest = flattenRootNode(finalPatchRoot);
    if (!forest.length) return <p className="text-sm italic text-muted-foreground mt-2">No top-level spans</p>;

    return (
      <React.Fragment key={`trace-tree-${currentSelectedSpanIdValue}`}>
        {forest.map((oneRoot, i) => (
          <CollapsiblePatchLineNode
            key={`${oneRoot.name}-${i}-${oneRoot.baseSpanRef?.id || 'no-base'}-${oneRoot.targetSpanRef?.id || 'no-target'}`}
            node={oneRoot}
            parentCenterY={0}
            depth={0}
            collapsedNodes={collapsedNodes}
            setCollapsedNodes={setCollapsedNodes}
            selectedNode={currentSelectedNodeValue}
            onSelectNode={onSelectNode}
            multiMode={multiMode}
          />
        ))}
      </React.Fragment>
    );
  }

  const renderDetail = React.useCallback(() => (
    <MemoizedDetailPanel
      selectedNode={currentSelectedNodeValue}
      baseRowIndex={rowIndexes[0]}
      comparisonLogsIndex={groupCompareRows}
      allTraces={liveAllTraces}
      allRowIndexes={rowIndexes}
      logsActions={logsActions}
      context={context}
      baseLog={baseLog}
      comparisonLogs={comparisonLogs}
      fieldName={fieldName}
      diffMode={diffMode}
      splitView={splitView}
      displayMode={displayMode}
      persistedState={persistedState}
      cellEditMode={cellEditMode}
      isImmutable={isImmutable}
      onSaveEdit={onSaveEdit}
      onGroupSaveEdit={onGroupSaveEdit}
      path={path}
    />
  ), [currentSelectedNodeValue, rowIndexes, groupCompareRows, liveAllTraces, diffMode, splitView, displayMode, persistedState, isImmutable, cellEditMode, onSaveEdit, onGroupSaveEdit, path, logsActions, context, baseLog, comparisonLogs, fieldName]);

  const baseTraceDone = useMemo(() => isTraceComplete(liveBaseTrace), [liveBaseTrace]);

  return (
    <TraceExpandProvider
      externalOpenKeys={traceExpandOpenKeys}
      setExternalOpenKeys={setTraceExpandOpenKeys}
    >
      <TracePoller
        log={baseLog}
        logIndex={rowIndexes[0]}
        fieldName={fieldName}
        logsActions={logsActions}
        context={context}
        onTraceUpdate={onTraceUpdate}
        initialTrace={liveBaseTrace}
      />
      {comparisonLogs?.map((log, index) => {
        const comparisonLogOriginalIndex = rowIndexes[index + 1];
        const liveCompTrace = liveComparisonTraces[index];
        if (comparisonLogOriginalIndex === undefined) return null;

        return (
          <TracePoller
            key={`poller-${comparisonLogOriginalIndex}`}
            log={log}
            logIndex={comparisonLogOriginalIndex}
            fieldName={fieldName}
            logsActions={logsActions}
            context={context}
            onTraceUpdate={onTraceUpdate}
            initialTrace={liveCompTrace}
          />
        );
      })}

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
                <div className="sticky top-0 z-10 bg-background border-b border-muted">
                  {!baseTraceDone && (
                    <div className="flex items-center gap-2 px-2 py-1">
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      <span className="text-caption text-muted-foreground">Streaming…</span>
                    </div>
                  )}
                  {rowIndexes.length > 1 && (
                    <div className="p-2 border-t border-muted flex items-center gap-2">
                      <span className="text-caption text-muted-foreground text-strong block">
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
                  )}
                </div>
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