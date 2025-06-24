"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
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
import { PersistedTraceViewState } from "./Views/TraceView/TraceView";
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
  FileText,
  Save
} from "lucide-react";

import {
  makePrefixedDictPath,
  makePrefixedListPath,
  gatherAllSubPaths,
  gatherAllSubPathsMulti
} from "@/utils/evals/pathUtils";

import { ItemType, LogsActions, TileProps } from "@/types/evals/grid";

import { createContext, useContextSelector } from "use-context-selector";
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import { LogComparisonProps } from "./Views/types";
import { Span } from "@/types/evals/traces";

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
  baseLog: LogProps | undefined,
  baseLogIndex: number,
  comparisonLogs: LogProps[] | undefined,
  compLogIndex: number[],
  diffMode: DiffMode,
  splitView: boolean,
  displayMode: "text" | "markdown" | "raw",
  nestingLevel: number,
  prefix: string,
  parentPath: string,
  valueType: string,
  fieldName: string,
  isImmutable?: boolean,
  viewTracesAsDict?: boolean,
  persistedTraceState?: PersistedTraceViewState,
  cellEditMode?: boolean,
  onSaveEdit?: LogComparisonProps['onSaveEdit'],
  onGroupSaveEdit?: LogComparisonProps['onGroupSaveEdit'],
  onTraceUpdate?: (logIndex: number, fieldName: string, newTrace: Span[]) => void,
  path?: (string | number)[],
  logsActions?: LogsActions,
  context: string | null = null,
) {
  // Force diffMode to 'none' if cellEditMode is true
  const effectiveDiffMode = cellEditMode ? "none" : diffMode;

  // Common props for all views
  const commonViewProps = {
      value: val,
      comparables: comps,
      version: version,
      comparableVersions: vers,
      baseLogIndex: baseLogIndex,
      comparisonLogsIndex: compLogIndex,
      diffMode: effectiveDiffMode,
      splitView: splitView,
      displayMode: displayMode,
      cellEditMode: cellEditMode,
      onSaveEdit: onSaveEdit,
      onGroupSaveEdit: onGroupSaveEdit,
      path: path,
  };

  // If user wants "raw"
  if (displayMode === "raw") {
    return <RawView {...commonViewProps} />;
  }

  // Check if we should override trace view
  if (valueType === "trace" && viewTracesAsDict) {
    // When viewTracesAsDict is true, render the trace as a dictionary
    return <DictionaryView {...commonViewProps} nestingLevel={nestingLevel} prefix={prefix} parentPath={parentPath} viewTracesAsDict={viewTracesAsDict} logsActions={logsActions} context={context} baseLog={baseLog} comparisonLogs={comparisonLogs} fieldName={fieldName}/>;
  }

  // Use the determined type instead of re-unifying
  switch (valueType) {
    case "trace":
      return <TraceView {...commonViewProps} value={Array.isArray(val) ? val : [val]} comparables={comps.map((c) => (Array.isArray(c) ? c : c ? [c] : []))} persistedState={persistedTraceState} isImmutable={isImmutable} logsActions={logsActions} context={context} baseLog={baseLog} comparisonLogs={comparisonLogs} fieldName={fieldName} onTraceUpdate={onTraceUpdate}/>;
    case "chat":
      return <ChatOutView {...commonViewProps} isImmutable={isImmutable} logsActions={logsActions} context={context} baseLog={baseLog} comparisonLogs={comparisonLogs} fieldName={fieldName}/>;
    case "dict":
      return <DictionaryView {...commonViewProps} nestingLevel={nestingLevel} prefix={prefix} parentPath={parentPath} viewTracesAsDict={viewTracesAsDict} isImmutable={isImmutable} logsActions={logsActions} context={context} baseLog={baseLog} comparisonLogs={comparisonLogs} fieldName={fieldName} onTraceUpdate={onTraceUpdate}/>;
    case "list":
      return <ListView {...commonViewProps} nestingLevel={nestingLevel} prefix={prefix} parentPath={parentPath} viewTracesAsDict={viewTracesAsDict} isImmutable={isImmutable} logsActions={logsActions} context={context} baseLog={baseLog} comparisonLogs={comparisonLogs} fieldName={fieldName} onTraceUpdate={onTraceUpdate}/>;
    case "pdf":
      return <PdfView {...commonViewProps} />;
    case "image":
      return <ImageView {...commonViewProps} />;
    case "matrix":
      return <MatrixView {...commonViewProps} />;
    case "number":
      return <NumberView {...commonViewProps} isImmutable={isImmutable}/>;
    case "timestamp":
      return <TimestampView {...commonViewProps} isImmutable={isImmutable}/>;
    default: // string
      return <StringView {...commonViewProps} isImmutable={isImmutable}/>;
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
  onHideColumn?: (prop: string) => void;
  editMode?: boolean;
  forceExpandAll?: boolean;
  forceCollapseAll?: boolean;
  panelOpenKeys: Set<string>;
  panelSetOpenKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
  viewTracesAsDict?: boolean;
  externalTraceState?: PersistedTraceViewState;
  dragAttributes?: DraggableAttributes;
  dragListeners?: SyntheticListenerMap;
  fieldName: string;
  isImmutable?: boolean;
  cellEditMode?: boolean;
  onSaveEdit?: (desc: { logIndex: number; source: SourceType; path: (string | number)[]; newValue: any }) => void;
  onGroupSaveEdit?: (desc: { logIndices: number[]; source: SourceType; path: (string | number)[]; newValue: any }) => void;
  onTraceUpdate?: (logIndex: number, fieldName: string, newTrace: Span[]) => void;
  path?: (string | number)[];
  logsActions: LogsActions;
  context: string | null
}

/**
 * SelectionEntry Component
 *
 * This component renders a single entry from a selected log, showing differnt views
 * based on the data type.
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
  onHideColumn,
  editMode = false,
  forceExpandAll,
  forceCollapseAll,
  panelOpenKeys,
  panelSetOpenKeys,
  viewTracesAsDict = false,
  externalTraceState,
  dragAttributes,
  dragListeners,
  fieldName,
  isImmutable,
  cellEditMode = false,
  onSaveEdit,
  onGroupSaveEdit,
  onTraceUpdate,
  path: incomingPath,
  logsActions,
  context
}: SelectionEntryProps) {
  // Context access for expand/collapse
  const expandRecursively = useMemo(() => {
    return (paths: string[]) => panelSetOpenKeys((prev) => new Set([...Array.from(prev), ...paths]));
  }, [panelSetOpenKeys]);

  const collapseRecursively = useMemo(() => {
    return (paths: string[]) => panelSetOpenKeys((prev) => {
        const next = new Set(prev);
        paths.forEach(path => next.delete(path));
        return next;
      });
  }, [panelSetOpenKeys]);

  const openKeys = panelOpenKeys;
  // const setOpenKeys = panelSetOpenKeys; // Not directly used below, but needed for context

  const comps = (comparisonLogs ?? []).map((cl) => {
    const container = source === "params" ? (cl.params || {}) : (cl.entries || {});
    const rawVal = container[property];
    if (source === "params" && rawVal && typeof rawVal === "object") {
      return rawVal.paramValue;
    }
    return rawVal;
  });
  let rawValue = value;
  if (source === "params" && value && typeof value === "object") {
    rawValue = value.paramValue;
  }
  const allVals = [rawValue, ...comps];
  const isEmpty = allVals.every(isEmptyOrBlank); // Still useful for conditional logic, just not for early return
  const unifiedType = unifyType(rawValue, comps); // unifyType will return "string" if all are empty/null
  const icon = getTypeIcon(unifiedType); // getTypeIcon will return Text icon for "string"
  const isTopLevelExpandable = !isEmpty && (unifiedType === "dict" || unifiedType === "list" || (unifiedType === "trace" && viewTracesAsDict));
  const childNesting = 0;
  const topLevelPath = useMemo(() => {
    if (!isTopLevelExpandable) return "";
    const prefixStr = source === "entries" ? "entries" : "params";
    return makePrefixedDictPath(prefixStr, 0, property);
  }, [isTopLevelExpandable, source, property]);

  const subPaths = useMemo(() => {
    if (!isTopLevelExpandable || !topLevelPath) return [];
    const prefixStr = source === "entries" ? "entries" : "params";
    let paths: string[] = [];
    if (comps && comps.length > 0) {
      paths = gatherAllSubPathsMulti(rawValue, comps, topLevelPath, prefixStr, 0);
    } else {
      paths = gatherAllSubPaths(rawValue, topLevelPath, prefixStr, 0);
    }
    return paths;
  }, [rawValue, isTopLevelExpandable, topLevelPath, source, comps]);

  const allOpen = useMemo(() => {
    if (!isTopLevelExpandable || !subPaths.length) return false;
    return subPaths.every(path => panelOpenKeys.has(path));
  }, [isTopLevelExpandable, subPaths, panelOpenKeys]);

  // Trace state management
  const [traceUIState, setTraceUIState] = useState({ collapsedNodes: {} as Record<string, boolean>, selectedNode: null as any | null, selectedSpanId: "", groupSignature: "", traceExpandOpenKeys: new Set<string>(), });
  const [traceScrollState, setTraceScrollState] = useState({ leftScrollPosition: 0, rightScrollPosition: 0, });
  
  // Memoize trace state setters to prevent unnecessary re-renders
  const traceStateSetters = useMemo(() => ({
    setCollapsedNodes: (v: any) => setTraceUIState(p => ({ ...p, collapsedNodes: typeof v === 'function' ? v(p.collapsedNodes) : v })),
    setSelectedNode: (v: any) => setTraceUIState(p => ({ ...p, selectedNode: typeof v === 'function' ? v(p.selectedNode) : v })),
    setSelectedSpanId: (v: any) => setTraceUIState(p => ({ ...p, selectedSpanId: typeof v === 'function' ? v(p.selectedSpanId) : v })),
    setGroupSignature: (v: any) => setTraceUIState(p => ({ ...p, groupSignature: typeof v === 'function' ? v(p.groupSignature) : v })),
    setTraceExpandOpenKeys: (v: any) => setTraceUIState(p => ({ ...p, traceExpandOpenKeys: typeof v === 'function' ? v(p.traceExpandOpenKeys) : v })),
    setLeftScrollPosition: (v: any) => setTraceScrollState(p => ({ ...p, leftScrollPosition: typeof v === 'function' ? v(p.leftScrollPosition) : v })),
    setRightScrollPosition: (v: any) => setTraceScrollState(p => ({ ...p, rightScrollPosition: typeof v === 'function' ? v(p.rightScrollPosition) : v })),
  }), []);
  
  const persistedTraceState = useMemo(() => externalTraceState || {
    collapsedNodes: traceUIState.collapsedNodes,
    selectedNode: traceUIState.selectedNode,
    selectedSpanId: traceUIState.selectedSpanId,
    groupSignature: traceUIState.groupSignature,
    traceExpandOpenKeys: traceUIState.traceExpandOpenKeys,
    leftScrollPosition: traceScrollState.leftScrollPosition,
    rightScrollPosition: traceScrollState.rightScrollPosition,
    ...traceStateSetters
  }, [traceUIState, traceScrollState, externalTraceState, traceStateSetters]);
  const valuePath: (string | number)[] = useMemo(() => incomingPath && incomingPath.length > 0 ? incomingPath : [property], [incomingPath, property]);

  // Wrapper for single save edits (adds source)
  const handleSaveEditForView = useCallback((desc: { logIndex: number; path: (string | number)[]; newValue: any }) => {
    if (onSaveEdit) {
      onSaveEdit({ ...desc, source: source });
    }
  }, [onSaveEdit, source]);

  // Wrapper for group save edits (adds source)
  const handleGroupSaveEditForView = useCallback((desc: { logIndices: number[]; path: (string | number)[]; newValue: any }) => {
      if (onGroupSaveEdit) {
          onGroupSaveEdit({ ...desc, source: source });
      }
  }, [onGroupSaveEdit, source]);

  // Render content memo (now passes both save handlers)
  const renderedContent = useMemo(() => {
    // If isEmpty is true, unifiedType will be "string", so getSelectionView will render StringView
    return getSelectionView(
      rawValue, comps, version, comparableVersions, baseLog, baseLogIndex, comparisonLogs, comparisonLogsIndex,
      diffMode, splitView, displayMode, childNesting, source === "entries" ? "entries" : "params",
      topLevelPath, unifiedType, fieldName, isImmutable, viewTracesAsDict, persistedTraceState, cellEditMode,
      handleSaveEditForView, handleGroupSaveEditForView, onTraceUpdate, valuePath,
      logsActions, context
    );
  }, [
    rawValue, comps, version, comparableVersions, baseLog, baseLogIndex, comparisonLogs, comparisonLogsIndex,
    diffMode, splitView, displayMode, childNesting, source, topLevelPath, unifiedType,
    fieldName, isImmutable, viewTracesAsDict, persistedTraceState, cellEditMode,
    handleSaveEditForView, handleGroupSaveEditForView, onTraceUpdate, valuePath,
    logsActions, context
  ]);

  const itemValue = property;

  function handleDeselectColumn() { onHideColumn?.(property); }

  // Global expand/collapse handler
  const handleGlobalExpandToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isTopLevelExpandable) return;
    let currentSubPaths: string[] = [];
    if (comps && comps.length > 0) {
      currentSubPaths = gatherAllSubPathsMulti(rawValue, comps, topLevelPath, source === "entries" ? "entries" : "params", 0);
    } else {
      currentSubPaths = gatherAllSubPaths(rawValue, topLevelPath, source === "entries" ? "entries" : "params", 0);
    }
    if (currentSubPaths.length === 0) return;
    const currentlyAllOpen = currentSubPaths.every(path => panelOpenKeys.has(path));
    if (currentlyAllOpen) {
      const childPaths = currentSubPaths.filter(path => path !== topLevelPath);
      collapseRecursively(childPaths);
    } else {
      expandRecursively([...currentSubPaths]);
    }
  };

  // Leaf check
  const isLeaf = useMemo(() => (unifiedType === "trace" ? false : !isTopLevelExpandable), [unifiedType, isTopLevelExpandable]);

  // Content node rendering
  const contentNode = useMemo(() => renderedContent, [renderedContent]);

  // No longer returning null if isEmpty is true. Always render the accordion item.
  // if (isEmpty) return null; 

  return (
    <AccordionItem value={itemValue}>
      <AccordionTrigger
        {...(dragAttributes ? { ...dragAttributes, ...dragListeners } : {})}
        onClick={(evt) => { if (editMode) { evt.preventDefault(); evt.stopPropagation(); } }}
        className="flex items-center relative group"
      >
        <div className="inline-flex items-center gap-2">
          <Tooltip content={unifiedType}>
            <span className="inline-flex items-center">{icon}</span>
          </Tooltip>
          <span className={`inline-block align-middle ${cellEditMode && isLeaf ? "cursor-text" : ""}`}>{property}</span>
          <ActionButton
            tooltip="Hide column"
            icon={<CircleMinus className="h-3 w-3" />}
            variant="ghost"
            size="sm"
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-destructive hover:text-destructive-foreground p-0 flex items-center justify-center"
            onClick={(e) => { e.stopPropagation(); handleDeselectColumn(); }}
          />
        </div>
        {!cellEditMode && !editMode && isTopLevelExpandable && subPaths.length > 0 && (
          <div className="absolute right-5 flex gap-1 items-center">
            <ActionButton
              variant="ghost"
              size="icon"
              tooltip={allOpen ? "Collapse all" : "Expand all"}
              onClick={handleGlobalExpandToggle}
              icon={allOpen ? <FoldVertical size={16} /> : <UnfoldVertical size={16} />}
            />
          </div>
        )}
      </AccordionTrigger>
      <AccordionContent>
        <div className="border-l border-l-muted ml-4 pl-3 relative">{contentNode}</div>
      </AccordionContent>
    </AccordionItem>
  );
}