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
import { Waypoints, CurlyBraces, Brackets, ImageIcon, Grid, Text, Hash, Clock, MessagesSquare } from "lucide-react";

import { TileProps, ItemType } from "@/types/evals/grid";
import { sanitizeId } from "@/utils/evals/columnOperations";

/**
 * source is either "entries" or "params"
 */
type SourceType = "entries" | "params";
type DiffMode = "none" | "lines" | "words" | "characters";

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
 * getSelectionView: pick specialized component, or raw if rawMode.
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
  rawMode: boolean
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
    case "trace": {
      const baseArr = Array.isArray(value) ? value : [value];
      const compArrs = comparables.map((c) =>
        Array.isArray(c) ? c : c ? [c] : []
      );
      return (
        <TraceView
          value={baseArr}
          comparables={compArrs}
          baseLogIndex={baseLogIndex}
          comparisonLogsIndex={comparisonLogsIndex}
          diffMode={diffMode}
          splitView={splitView}
          version={version}
          comparableVersions={comparableVersions}
        />
      );
    }
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
  item,
  utils,
  onAccordionValueChange,
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
  item: TileProps;
  utils: {getCardById: (tileId: string) => TileProps, updateCardById: (tileId: string, partial: Partial<TileProps>) => void};
  onAccordionValueChange?: (value: string[]) => void;
}) {
  const [hovered, setHovered] = useState(false);

  // Gather comparables
  let comparables = (comparisonLogs ?? []).map((cl) => {
    const container = source === "params" ? cl.params ?? {} : cl.entries ?? {};
    return container[property];
  });

  // Possibly read paramVersion structure
  let rawValue = value;
  if (source === "params" && value && typeof value === "object") {
    rawValue = value.paramValue;
    comparables = comparables.map((c) => c?.paramValue);
  }

  const valueType = getValueType(rawValue);
  const icon = getTypeIcon(valueType);

  // Deselect column function
  const handleDeselectColumn = (event: React.MouseEvent) => {
    event.stopPropagation();
    
    // Find the parent table item that owns this selection
    const tableItem = utils.getCardById(item.table || "");
    if (!tableItem) {
      console.warn('Could not find parent table item');
      return;
    }
    
    const selectedCells = tableItem.selected ? tableItem.selected.split(",") : [];
    
    const newSelected = selectedCells.filter((cell) => {
      const underscorePos = cell.indexOf("_");
      if (underscorePos < 1) return true;
      const col = cell.slice(underscorePos + 1);
      const keep = sanitizeId(col) !== sanitizeId(property);
      return keep;
    });
    
    // Update the table item's selected property instead of the current item
    utils.updateCardById(tableItem.i, { selected: newSelected.length ? newSelected.join(",") : undefined });
  };

  // Render the specialized or raw
  const renderedContent = getSelectionView(
    rawValue,
    comparables,
    version,
    comparableVersions,
    baseLogIndex,
    comparisonLogsIndex,
    diffMode || "none",
    splitView,
    rawMode
  );

  return (
    <AccordionItem value={property} onDragStart={() => {
      // Collapse this item when dragging starts
      onAccordionValueChange?.([]);
    }}>
      <AccordionTrigger
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="flex items-center"
      >
        <div className="inline-flex items-center gap-2">
          <Tooltip content={hovered ? "Remove from selection" : valueType}>
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
      </AccordionTrigger>
      <AccordionContent>
        {renderedContent}
      </AccordionContent>
    </AccordionItem>
  );
}