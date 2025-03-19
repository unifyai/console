"use client";

import React, { useState, useMemo, useEffect } from "react";
import { LogProps } from "@/types/evals/logs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/UI/accordion";

import DictionaryView from "./Views/DictionaryView";
import ImageView from "./Views/ImageView";
import ListView from "./Views/ListView";
import MatrixView from "./Views/MatrixView";
import StringView from "./Views/StringView";
import TraceView from "./Views/TraceView";
import NumberView from "./Views/NumberView";
import TimestampView from "./Views/TimestampView";
import ChatOutView from "./Views/ChatView/ChatOutView";
import PdfView from "./Views/PdfView";

import Tooltip from "@/components/Common/Misc/Tooltip";
import { CircleMinus, FoldVertical, UnfoldVertical } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";

import RawView from "./Views/RawView";
import {
  isTrace,
  isDict,
  isList,
  isImage,
  isMatrix,
  isNumber,
  isTimestamp,
  isChat
} from "@/utils/evals/selection";
import { isPdf } from "./SelectionUtils";

import {
  Waypoints,
  CurlyBraces,
  Brackets,
  ImageIcon,
  Grid,
  Text,
  Hash,
  Clock,
  MessagesSquare,
  FileText
} from "lucide-react";

import { useExpandContextSelector } from "@/contexts/ExpandContext";
import {
  makePrefixedDictPath,
  makePrefixedListPath,
  gatherAllSubPaths,
  gatherAllSubPathsMulti
} from "@/utils/evals/pathUtils";

import { ItemType, TileProps } from "@/types/evals/grid";

//////////////////////////////////////////////////////////////////////////////
// Type definitions
//////////////////////////////////////////////////////////////////////////////
type SourceType = "entries" | "params";
type DiffMode = "none" | "lines" | "words" | "characters";

//////////////////////////////////////////////////////////////////////////////
// Helpers
//////////////////////////////////////////////////////////////////////////////
function isEmptyOrBlank(v: any): boolean {
  return v == null || (typeof v === "string" && !v.trim());
}

/**
 * If multiple distinct types appear among base+comparables, treat as string.
 */
function getValueType(value: any):
  "trace" | "dict" | "list" | "image" | "matrix" | "string" | "number" | "timestamp" | "chat" | "pdf"
{
  if (isTrace(value))     return "trace";
  if (isDict(value))      return "dict";
  if (isList(value))      return "list";
  if (isPdf(value))       return "pdf";
  if (isImage(value))     return "image";
  if (isMatrix(value))    return "matrix";
  if (isNumber(value))    return "number";
  if (isTimestamp(value)) return "timestamp";
  if (isChat(value))      return "chat";
  return "string";
}

function unifyType(baseVal: any, comps: any[]): string {
  const arr = [];
  if (!isEmptyOrBlank(baseVal)) arr.push(baseVal);
  comps.forEach((c) => {
    if (!isEmptyOrBlank(c)) arr.push(c);
  });
  if (!arr.length) return "string";

  const typeSet = new Set<string>();
  arr.forEach((val) => {
    typeSet.add(getValueType(val));
  });
  if (typeSet.size === 1) return Array.from(typeSet)[0];
  return "string";
}

function getTypeIcon(valueType: string) {
  switch (valueType) {
    case "trace":
      return <Waypoints className="h-4 w-4 text-primary" />;
    case "dict":
      return <CurlyBraces className="h-4 w-4 text-primary" />;
    case "list":
      return <Brackets className="h-4 w-4 text-primary" />;
    case "image":
      return <ImageIcon className="h-4 w-4 text-primary" />;
    case "matrix":
      return <Grid className="h-4 w-4 text-primary" />;
    case "number":
      return <Hash className="h-4 w-4 text-primary" />;
    case "timestamp":
      return <Clock className="h-4 w-4 text-primary" />;
    case "chat":
      return <MessagesSquare className="h-4 w-4 text-primary" />;
    case "pdf":
      return <FileText className="h-4 w-4 text-primary" />;
    default:
      return <Text className="h-4 w-4 text-primary" />;
  }
}

/**
 * Render specialized subcomponent or raw for the given value/comparables.
 */
function getSelectionView(
  val: any,
  comps: any[],
  version: string,
  vers: string[],
  baseLogIndex: number,
  compLogIndex: number[],
  diffMode: DiffMode,
  splitView: boolean,
  displayMode: "text" | "markdown" | "raw",
  nestingLevel: number,
  prefix: string,
  parentPath: string
) {
  // If user wants "raw"
  if (displayMode === "raw") {
    return (
      <RawView
        value={val}
        comparables={comps}
        version={version}
        comparableVersions={vers}
        baseLogIndex={baseLogIndex}
        comparisonLogsIndex={compLogIndex}
        diffMode={diffMode}
        splitView={splitView}
      />
    );
  }

  // unify
  const finalType = unifyType(val, comps);

  switch (finalType) {
    case "trace":
      return (
        <TraceView
          value={Array.isArray(val) ? val : [val]}
          comparables={comps.map((c) => (Array.isArray(c) ? c : c ? [c] : []))}
          baseLogIndex={baseLogIndex}
          comparisonLogsIndex={compLogIndex}
          diffMode={diffMode}
          splitView={splitView}
          version={version}
          comparableVersions={vers}
          displayMode={displayMode}
        />
      );
    case "chat":
      return (
        <ChatOutView
          value={val}
          comparables={comps}
          baseLogIndex={baseLogIndex}
          comparisonLogsIndex={compLogIndex}
          diffMode={diffMode}
          splitView={splitView}
          version={version}
          comparableVersions={vers}
          displayMode={displayMode}
        />
      );
    case "dict":
      return (
        <DictionaryView
          value={val}
          comparables={comps}
          baseLogIndex={baseLogIndex}
          comparisonLogsIndex={compLogIndex}
          diffMode={diffMode}
          splitView={splitView}
          version={version}
          comparableVersions={vers}
          displayMode={displayMode}
          nestingLevel={nestingLevel}
          prefix={prefix}
          parentPath={parentPath}
        />
      );
    case "list":
      return (
        <ListView
          value={val}
          comparables={comps}
          baseLogIndex={baseLogIndex}
          comparisonLogsIndex={compLogIndex}
          diffMode={diffMode}
          splitView={splitView}
          version={version}
          comparableVersions={vers}
          displayMode={displayMode}
          nestingLevel={nestingLevel}
          prefix={prefix}
        />
      );
    case "pdf":
      return (
        <PdfView
          value={val}
          comparables={comps}
          baseLogIndex={baseLogIndex}
          comparisonLogsIndex={compLogIndex}
          diffMode={diffMode}
          splitView={splitView}
          version={version}
          comparableVersions={vers}
          displayMode={displayMode}
        />
      );
    case "image":
      return (
        <ImageView
          value={val}
          comparables={comps}
          baseLogIndex={baseLogIndex}
          comparisonLogsIndex={compLogIndex}
          diffMode={diffMode}
          splitView={splitView}
          version={version}
          comparableVersions={vers}
          displayMode={displayMode}
        />
      );
    case "matrix":
      return (
        <MatrixView
          value={val}
          comparables={comps}
          baseLogIndex={baseLogIndex}
          comparisonLogsIndex={compLogIndex}
          diffMode={diffMode}
          splitView={splitView}
          version={version}
          comparableVersions={vers}
          displayMode={displayMode}
        />
      );
    case "number":
      return (
        <NumberView
          value={val}
          comparables={comps}
          baseLogIndex={baseLogIndex}
          comparisonLogsIndex={compLogIndex}
          diffMode={diffMode}
          splitView={splitView}
          version={version}
          comparableVersions={vers}
          displayMode={displayMode}
        />
      );
    case "timestamp":
      return (
        <TimestampView
          value={val}
          comparables={comps}
          baseLogIndex={baseLogIndex}
          comparisonLogsIndex={compLogIndex}
          diffMode={diffMode}
          splitView={splitView}
          version={version}
          comparableVersions={vers}
          displayMode={displayMode}
        />
      );
    default:
      return (
        <StringView
          value={val}
          comparables={comps}
          baseLogIndex={baseLogIndex}
          comparisonLogsIndex={compLogIndex}
          diffMode={diffMode}
          splitView={splitView}
          version={version}
          comparableVersions={vers}
          displayMode={displayMode}
        />
      );
  }
}

//////////////////////////////////////////////////////////////////////////////
// The main "SelectionEntry" component
//////////////////////////////////////////////////////////////////////////////
interface SelectionEntryProps {
  source?: SourceType;
  property: string;
  value: any;
  baseLog: LogProps | undefined;
  baseLogIndex: number;
  comparisonLogs?: LogProps[];
  comparisonLogsIndex: number[];
  diffMode: DiffMode;
  splitView: boolean;
  displayMode: "text" | "markdown" | "raw";
  version?: string;
  comparableVersions?: string[];
  tableItem: TileProps | undefined;
  updateItem: (item: TileProps, attrName: ItemType) => (newValue: string | undefined) => void;
  onAccordionValueChange?: (value: string[]) => void;
  onHideColumn?: (prop: string) => void;
  editMode?: boolean;
  forceExpandAll?: boolean;
  forceCollapseAll?: boolean;
}

/**
 * SelectionEntry Component
 * 
 * This component renders a single entry from a selected log, showing differnt views
 * based on the data type.
 * 
 * IMPORTANT: This component expects the following:
 * - baseLogIndex: 0-based index of the row in the selection (expected to be 0-based)
 * - comparisonLogsIndex: Array of 0-based indices for comparison rows
 * 
 * These indices are passed as-is to the view components, which should maintain them as 0-based
 * until final display in RowBadge.
 */
export default function SelectionEntry({
  source = "entries",
  property,
  value,
  baseLog,
  baseLogIndex,
  comparisonLogs,
  comparisonLogsIndex,
  diffMode,
  splitView,
  displayMode,
  version = "",
  comparableVersions = [],
  tableItem,
  updateItem,
  onAccordionValueChange,
  onHideColumn,
  editMode = false,
  forceExpandAll,
  forceCollapseAll,
}: SelectionEntryProps) {
  const [hovered, setHovered] = useState(false);
  const [prevAccordionValues, setPrevAccordionValues] = useState<string[]>([]);
  
  // Use context selectors to only subscribe to the parts of the context we need
  const openKeys = useExpandContextSelector(ctx => ctx.openKeys);
  const setOpenKeys = useExpandContextSelector(ctx => ctx.setOpenKeys);

  // gather comparables
  const comps = (comparisonLogs ?? []).map((cl) => {
    const container = source === "params" ? (cl.params || {}) : (cl.entries || {});
    const rawVal = container[property];
    if (source === "params" && rawVal && typeof rawVal === "object") {
      return rawVal.paramValue; // param object with paramValue
    }
    return rawVal;
  });

  // Possibly handle paramValue on the base as well
  let rawValue = value;
  if (source === "params" && value && typeof value === "object") {
    rawValue = value.paramValue;
  }

  // Check if empty for conditional rendering later
  const allVals = [rawValue, ...comps];
  const isEmpty = allVals.every(isEmptyOrBlank);

  // find type - moved before early return
  const unifiedType = !isEmpty ? unifyType(rawValue, comps) : "";
  const icon = !isEmpty ? getTypeIcon(unifiedType) : null;
  
  // is it dict/list? - moved before early return
  const isDictOrList = !isEmpty && (unifiedType === "dict" || unifiedType === "list");

  // We'll pass nestingLevel=0 for top-level
  const childNesting = 0;

  // Build the top-level path for dictionaries/lists - moved before early return
  const topLevelPath = useMemo(() => {
    if (!isDictOrList) return "";
    const prefixStr = source === "entries" ? "entries" : "params";
    // at top-level, we keep nestingLevel = 0
    return makePrefixedDictPath(prefixStr, 0, property);
  }, [isDictOrList, property, source]);

  // We'll gather all subpaths for a fully recursive approach
  // when user clicks the global expand button (the "FoldVertical / UnfoldVertical").
  const subPaths = useMemo(() => {
    if (!isDictOrList || !topLevelPath) return [];
    const prefixStr = source === "entries" ? "entries" : "params";

    // In multi-mode, use gatherAllSubPathsMulti to include keys from comparables
    if (comps && comps.length > 0) {
      return gatherAllSubPathsMulti(rawValue, comps, topLevelPath, prefixStr, 0);
    } else {
      // In single-mode, use the original gatherAllSubPaths
      return gatherAllSubPaths(rawValue, topLevelPath, prefixStr, 0);
    }
  }, [rawValue, isDictOrList, topLevelPath, source, comps]);

  // check if all subPaths are in openKeys => allOpen
  const allOpen = useMemo(() => {
    if (!isDictOrList || !subPaths.length) return false;
    return subPaths.every((p) => openKeys.has(p));
  }, [isDictOrList, subPaths, openKeys]);
  
  // Return early if empty - after all hooks have been called
  if (isEmpty) {
    return null;
  }

  function handleDeselectColumn() {
    onHideColumn?.(property);
  }

  // global expand/collapse => fully recursive
  const handleGlobalExpandToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDictOrList) return;

    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (allOpen) {
        // collapse everything
        subPaths.forEach((p) => next.delete(p));
      } else {
        // expand everything
        subPaths.forEach((p) => next.add(p));
      }
      return next;
    });
  };

  // subcomponent that actually renders the value
  const renderedContent = getSelectionView(
    rawValue,
    comps,
    version,
    comparableVersions,
    baseLogIndex,
    comparisonLogsIndex,
    diffMode,
    splitView,
    displayMode,
    childNesting, // now always 0 if top-level
    source === "entries" ? "entries" : "params",
    topLevelPath // Pass the top-level path as parentPath
  );

  // For the shadcn <AccordionItem>, we unify property => so the parent's "onValueChange" logic sees a simpler string
  const itemValue = property;

  return (
    <AccordionItem
      value={itemValue}
      onDragStart={() => {
        setPrevAccordionValues([]);
        onAccordionValueChange?.([]);
      }}
      onDragEnd={() => {
        onAccordionValueChange?.(prevAccordionValues);
      }}
    >
      <AccordionTrigger
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={(evt) => {
          // if we're in edit mode, block toggling
          if (editMode) {
            evt.preventDefault();
            evt.stopPropagation();
          }
        }}
        className="flex items-center relative group"
      >
        <div className="inline-flex items-center gap-2">
          <Tooltip content={hovered ? "Hide column" : unifiedType}>
            <span
              className="cursor-pointer inline-flex items-center transition duration-200"
              onClick={handleDeselectColumn}
            >
              {hovered ? (
                <CircleMinus className="h-4 w-4 text-muted-foreground2" />
              ) : (
                icon
              )}
            </span>
          </Tooltip>
          <Tooltip content={unifiedType}>
            <span>{property}</span>
          </Tooltip>
        </div>

        {!editMode && isDictOrList && subPaths.length > 0 && (
          <div className="absolute right-5 flex gap-1 items-center">
            <ActionButton
              variant="ghost"
              size="icon"
              tooltip={allOpen ? "Collapse All" : "Expand All"}
              onClick={handleGlobalExpandToggle}
              icon={allOpen ? <FoldVertical size={16} /> : <UnfoldVertical size={16} />}
            />
          </div>
        )}
      </AccordionTrigger>

      <AccordionContent>
        {renderedContent}
      </AccordionContent>
    </AccordionItem>
  );
}