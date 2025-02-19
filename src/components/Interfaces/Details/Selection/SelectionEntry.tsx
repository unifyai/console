"use client";

import React, { useState } from "react";
import { LogProps } from "@/types/evals/logs";
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent
} from "@/components/UI/accordion";

import DictionaryView from "./Views/DictionaryView";
import ListView from "./Views/ListView";
import ImageView from "./Views/ImageView";
import MatrixView from "./Views/MatrixView";
import StringView from "./Views/StringView";
import TraceView from "./Views/TraceView";
import NumberView from "./Views/NumberView";
import TimestampView from "./Views/TimestampView";
import ChatOutView from "./Views/ChatView/ChatOutView";

import Tooltip from "@/components/Common/Misc/Tooltip";
import { CircleMinus } from "lucide-react";

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
  FoldVertical,
  UnfoldVertical
} from "lucide-react";

import { ItemType, TileProps } from "@/types/evals/grid";
import { sanitizeId } from "@/utils/evals/columnOperations";
import { Button } from "@/components/UI/button"; // for expand/collapse toggles

/**
 * Type definitions
 */
type SourceType = "entries" | "params";
type DiffMode = "none" | "lines" | "words" | "characters";

/**
 * getValueType: detects top-level type for a single value
 */
function getValueType(value: any):
  "trace" | "dict" | "list" | "image" | "matrix" | "string" | "number" | "timestamp" | "chat"
{
  if (isTrace(value))   return "trace";
  if (isDict(value))    return "dict";
  if (isList(value))    return "list";
  if (isImage(value))   return "image";
  if (isMatrix(value))  return "matrix";
  if (isNumber(value))  return "number";
  if (isTimestamp(value)) return "timestamp";
  if (isChat(value))    return "chat";
  return "string";
}

/**
 * getTypeIcon: returns appropriate icon
 */
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
    default:
      return <Text className="h-4 w-4 text-primary" />;
  }
}

/**
 * unifyType: uses baseVal + comparables to decide on a single type. 
 * If multiple distinct types appear, fallback to "string."
 */
function unifyType(
  baseVal: any,
  comps: any[]
):
  "trace" | "dict" | "list" | "image" | "matrix" | "string" | "number" | "timestamp" | "chat"
{
  // gather all non-undefined values
  const allVals: any[] = [];
  if (baseVal !== undefined) {
    allVals.push(baseVal);
  }
  comps.forEach(c => {
    if (c !== undefined) {
      allVals.push(c);
    }
  });

  // if we still have nothing => "string"
  if (allVals.length === 0) {
    return "string";
  }

  // gather distinct types
  const typeSet = new Set<string>();
  for (const val of allVals) {
    const t = getValueType(val);
    typeSet.add(t);
  }

  // if exactly one => use it; else fallback to "string"
  if (typeSet.size === 1) {
    return Array.from(typeSet)[0] as any;
  }
  return "string";
}

/**
 * getSelectionView: specialized or raw, using unifyType(...) 
 * for the final type, not just getValueType(value).
 */
function getSelectionView(
  value: any,
  comparables: any[],
  version: string,
  comparableVersions: string[],
  baseLogIndex: number,
  comparisonLogsIndex: number[],
  diffMode: DiffMode,
  splitView: boolean,
  displayMode: "text" | "markdown" | "raw",
  forceExpandAll?: boolean
) {
  // if raw => skip type logic
  if (displayMode === "raw") {
    return (
      <RawView
        value={value}
        comparables={comparables}
        version={version}
        comparableVersions={comparableVersions}
        baseLogIndex={baseLogIndex}
        comparisonLogsIndex={comparisonLogsIndex}
        diffMode={diffMode}
        splitView={splitView}
      />
    );
  }

  // (ADDED) unify the type from base + comps
  const finalType = unifyType(value, comparables);

  switch (finalType) {
    case "trace":
      return (
        <TraceView
          value={Array.isArray(value) ? value : [value]}
          comparables={comparables.map((c) =>
            Array.isArray(c) ? c : c ? [c] : []
          )}
          baseLogIndex={baseLogIndex}
          comparisonLogsIndex={comparisonLogsIndex}
          diffMode={diffMode}
          splitView={splitView}
          version={version}
          comparableVersions={comparableVersions}
          displayMode={displayMode}
        />
      );
    case "chat":
      return (
        <ChatOutView
          value={value}
          comparables={comparables}
          baseLogIndex={baseLogIndex}
          comparisonLogsIndex={comparisonLogsIndex}
          diffMode={diffMode}
          splitView={splitView}
          version={version}
          comparableVersions={comparableVersions}
          displayMode={displayMode}
        />
      );
    case "dict":
      return (
        <DictionaryView
          value={value}
          comparables={comparables}
          baseLogIndex={baseLogIndex}
          comparisonLogsIndex={comparisonLogsIndex}
          diffMode={diffMode}
          splitView={splitView}
          version={version}
          comparableVersions={comparableVersions}
          forceExpandAll={forceExpandAll}
          displayMode={displayMode}
        />
      );
    case "list":
      return (
        <ListView
          value={value}
          comparables={comparables}
          baseLogIndex={baseLogIndex}
          comparisonLogsIndex={comparisonLogsIndex}
          diffMode={diffMode}
          splitView={splitView}
          version={version}
          comparableVersions={comparableVersions}
          forceExpandAll={forceExpandAll}
          displayMode={displayMode}
        />
      );
    case "image":
      return (
        <ImageView
          value={value}
          comparables={comparables}
          baseLogIndex={baseLogIndex}
          comparisonLogsIndex={comparisonLogsIndex}
          diffMode={diffMode}
          splitView={splitView}
          version={version}
          comparableVersions={comparableVersions}
          displayMode={displayMode}
        />
      );
    case "matrix":
      return (
        <MatrixView
          value={value}
          comparables={comparables}
          baseLogIndex={baseLogIndex}
          comparisonLogsIndex={comparisonLogsIndex}
          diffMode={diffMode}
          splitView={splitView}
          version={version}
          comparableVersions={comparableVersions}
          displayMode={displayMode}
        />
      );
    case "number":
      return (
        <NumberView
          value={value}
          comparables={comparables}
          baseLogIndex={baseLogIndex}
          comparisonLogsIndex={comparisonLogsIndex}
          diffMode={diffMode}
          splitView={splitView}
          version={version}
          comparableVersions={comparableVersions}
          displayMode={displayMode}
        />
      );
    case "timestamp":
      return (
        <TimestampView
          value={value}
          comparables={comparables}
          baseLogIndex={baseLogIndex}
          comparisonLogsIndex={comparisonLogsIndex}
          diffMode={diffMode}
          splitView={splitView}
          version={version}
          comparableVersions={comparableVersions}
          displayMode={displayMode}
        />
      );
    default:
      // fallback => "string"
      return (
        <StringView
          value={value}
          comparables={comparables}
          baseLogIndex={baseLogIndex}
          comparisonLogsIndex={comparisonLogsIndex}
          diffMode={diffMode}
          splitView={splitView}
          version={version}
          comparableVersions={comparableVersions}
          displayMode={displayMode}
        />
      );
  }
}

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
}: {
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
}) {
  const [hovered, setHovered] = useState(false);
  const [expandAll, setExpandAll] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [prevAccordionValues, setPrevAccordionValues] = useState<string[]>([]);

  // Gather comparables from the relevant container
  let comps = (comparisonLogs ?? []).map((cl) => {
    const container = source === "params" ? cl.params ?? {} : cl.entries ?? {};
    return container[property];
  });

  // Possibly read paramVersion structure
  let rawValue = value;
  if (source === "params" && value && typeof value === "object") {
    rawValue = value.paramValue; 
    comps = comps.map((c) => c?.paramValue);
  }

  // unify the type from base + comparables for the icon
  const unifiedType = unifyType(rawValue, comps);
  const icon = getTypeIcon(unifiedType);

  const handleDeselectColumn = () => {
    console.log("[DEBUG] handleDeselectColumn called");
    if (onHideColumn) {
      onHideColumn(property);
    }
  };

  const forciblySetAccordionOpen = (open: boolean) => {
    if (onAccordionValueChange) {
      if (open) {
        onAccordionValueChange([property]);
      } else {
        onAccordionValueChange([]);
      }
    }
  };

  const handleExpandToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!expandAll) {
      forciblySetAccordionOpen(true);
      setExpandAll(true);
    } else {
      setExpandAll(false);
    }
  };

  // specialized or raw content
  const renderedContent = getSelectionView(
    rawValue,
    comps,
    version,
    comparableVersions,
    baseLogIndex,
    comparisonLogsIndex,
    diffMode || "none",
    splitView,
    displayMode,
    expandAll
  );

  return (
    <AccordionItem
      value={property}
      onDragStart={() => {
        setPrevAccordionValues(
          typeof onAccordionValueChange === "function"
            ? [] // or read your current expanded values...
            : []
        );
        onAccordionValueChange?.([]);
      }}
      onDragEnd={() => {
        onAccordionValueChange?.(prevAccordionValues);
      }}
    >
      <AccordionTrigger
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => {
          if (!editMode) {
            setIsOpen(!isOpen);
            setExpandAll(false);
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

        {/* check unifiedType instead of (valueType === "dict" || valueType === "list") */}
        {(!editMode && isOpen && (unifiedType === "dict" || unifiedType === "list")) && (
          <div className="absolute right-5 flex gap-1 items-center">
            <Button
              variant="ghost"
              onClick={handleExpandToggle}
            >
              {expandAll ? <FoldVertical size={16} /> : <UnfoldVertical size={16} />}
            </Button>
          </div>
        )}
      </AccordionTrigger>

      <AccordionContent>
        {renderedContent}
      </AccordionContent>
    </AccordionItem>
  );
}