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
import { X } from "lucide-react";

import RawView from "./Views/RawView";
import { isTrace, isDict, isList, isImage, isMatrix, isNumber, isTimestamp, isChat } from "@/utils/evals/selection";
import { 
  Waypoints, CurlyBraces, Brackets, ImageIcon, Grid, Text, Hash, Clock, MessagesSquare, 
  FoldVertical, UnfoldVertical 
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
 * getValueType: detects top-level type
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
 * getTypeIcon: returns appropriate icon for type
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
 * getSelectionView: specialized or raw, optionally passing forceExpandAll
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
  rawMode: boolean,
  forceExpandAll?: boolean
) {
  if (rawMode) {
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
  const valueType = getValueType(value);
  switch (valueType) {
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
        />
      );
    default:
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
  rawMode,
  version = "",
  comparableVersions = [],
  tableItem,
  updateItem,
  onAccordionValueChange,
  onHideColumn,
}: {
  source?: SourceType;
  property: string;
  value: any;
  baseLog: LogProps;
  baseLogIndex: number;
  comparisonLogs?: LogProps[];
  comparisonLogsIndex: number[];
  diffMode: DiffMode;
  splitView: boolean;
  rawMode: boolean;
  version?: string;
  comparableVersions?: string[];
  tableItem: TileProps | undefined;
  updateItem: (item: TileProps, attrName: ItemType) => (newValue: string | undefined) => void;
  onAccordionValueChange?: (value: string[]) => void;
  onHideColumn?: (prop: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  // local expandAll for top-level dict/list
  const [expandAll, setExpandAll] = useState(false);

  // Add a state to track if this accordion item is open
  const [isOpen, setIsOpen] = useState(false);

  // Gather comparables
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

  const valueType = getValueType(rawValue);
  const icon = getTypeIcon(valueType);

  // “remove from selection” function
  const handleDeselectColumn = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (onHideColumn) {
      onHideColumn(property);
    }
  };

  // forcibly open or close the parent's accordion item => ensures dict is mounted
  const forciblySetAccordionOpen = (open: boolean) => {
    if (onAccordionValueChange) {
      if (open) {
        onAccordionValueChange([property]);
      } else {
        onAccordionValueChange([]);
      }
    }
  };

  // Modify the expand/collapse toggle function
  const handleExpandToggle = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent trigger's onClick from firing
    if (!expandAll) {
      // Expand: force the accordion open (if needed) and expand all child items
      forciblySetAccordionOpen(true);
      setExpandAll(true);
    } else {
      // Collapse All: collapse the child items but do not fold the parent entry
      setExpandAll(false);
    }
  };

  // specialized or raw
  const renderedContent = getSelectionView(
    rawValue,
    comps,
    version,
    comparableVersions,
    baseLogIndex,
    comparisonLogsIndex,
    diffMode || "none",
    splitView,
    rawMode,
    expandAll
  );

  return (
    <AccordionItem
      value={property}
      onDragStart={() => {
        // if user drags, close
        onAccordionValueChange?.([]);
      }}
    >
      <AccordionTrigger
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => {
          // Toggle open state when clicked
          setIsOpen(!isOpen);
          setExpandAll(false);
        }}
        className="flex items-center relative group"
      >
        <div className="inline-flex items-center gap-2">
          <Tooltip content={hovered ? "Hide column" : valueType}>
            <span
              className="cursor-pointer inline-flex items-center transition duration-200"
              onClick={handleDeselectColumn}
            >
              {hovered ? <X className="h-4 w-4 text-red-500" /> : icon}
            </span>
          </Tooltip>
          <Tooltip content={valueType}>
            <span>{property}</span>
          </Tooltip>
        </div>

        {/* Only show expand/collapse button when open */}
        {isOpen && (valueType === "dict" || valueType === "list") && (
          <div
            className="
              absolute right-5
              flex gap-1 items-center
            "
          >
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