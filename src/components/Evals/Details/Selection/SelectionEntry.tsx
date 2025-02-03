"use client";

import React from "react";
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

// These helpers and types help choose which specialized view to show.
import {
  isDict,
  isList,
  isMatrix,
  isImage,
  isNumber,
  isTimestamp,
  isChat,
  isTrace
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
  X
} from "lucide-react";

// Import RawView (for rawMode switching)
import RawView from "./Views/RawView";

// Remove the Popover import since we no longer use it.
// import { Popover, PopoverTrigger, PopoverContent } from "@/components/UI/popover";

// Import useQueryState (and helpers) as well as our column helper functions
import { useQueryState, parseAsArrayOf, parseAsString } from "nuqs";
import { sanitizeId } from "@/utils/evals/columnOperations";
import { getPartAfterFirstUnderscore } from "@/utils/evals/selection";

/**
 * Define types.
 * – source is either "entries" or "params"
 * – diffMode controls diffing methods
 * – rawMode toggles between raw versus specialized views.
 * In addition, we also pass along version and comparableVersions.
 */
type SourceType = "entries" | "params";
type DiffMode = "none" | "lines" | "words" | "characters";

type SelectionEntryProps = {
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
  version?: string;              // For param version display
  comparableVersions?: string[]; // For comparison version information
};

/**
 * getValueType returns a type string for determining which view to use.
 */
function getValueType(value: any):
  "trace" | "dict" | "list" | "image" | "matrix" | "string" | "number" | "timestamp" | "chat" {
  if (isTrace(value)) return "trace";
  if (isDict(value)) return "dict";
  if (isList(value)) return "list";
  if (isImage(value)) return "image";
  if (isMatrix(value)) return "matrix";
  if (isNumber(value)) return "number";
  if (isTimestamp(value)) return "timestamp";
  if (isChat(value)) return "chat";
  return "string";
}

/**
 * getTypeIcon returns a lucide icon based on the value type.
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
 * getSelectionView chooses which specialized component to render based on the type.
 * It passes along comparables, version, and comparableVersions.
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
    // Always show raw view if rawMode is enabled.
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

const SelectionEntry = ({
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
  comparableVersions = []
}: SelectionEntryProps) => {
  
  // Retrieve the "selected" state from the URL via nuqs.
  const [selectedCells, setSelectedCells] = useQueryState(
    "selected",
    parseAsArrayOf(parseAsString).withDefault([])
  );

  // Handler for deselecting this column.
  const handleDeselectColumn = () => {
    setSelectedCells((cells: string[]) => {
      const newCells = cells.filter(cell => {
        const col = getPartAfterFirstUnderscore(cell);
        return sanitizeId(col) !== sanitizeId(property);
      });
      return newCells;
    });
  };

  // Determine the type and corresponding icon.
  const valueType = getValueType(value);
  const icon = getTypeIcon(valueType);
  
  // Added hover state to toggle the icon on hover.
  const [hovered, setHovered] = React.useState(false);

  return (
    <AccordionItem value={property}>
      <AccordionTrigger className="flex items-center">
        <div className="inline-flex items-center gap-2">
          {/* Updated icon area using a single component that toggles on hover */}
          <Tooltip content={hovered ? "Deselect" : valueType}>
            <span
              className="cursor-pointer inline-flex items-center transition duration-200"
              onClick={(e) => {
                e.stopPropagation();
                handleDeselectColumn();
              }}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
            >
              {hovered ? <X className="h-4 w-4 text-red-500" /> : icon}
            </span>
          </Tooltip>
          {/* Updated property text wrapped with tooltip showing the data type */}
          <Tooltip content={valueType}>
            <span>{property}</span>
          </Tooltip>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        {getSelectionView(
          value,
          comparisonLogs ? comparisonLogs : [],
          version,
          comparableVersions ? comparableVersions : [],
          baseLogIndex,
          comparisonLogsIndex,
          diffMode,
          splitView,
          rawMode
        )}
      </AccordionContent>
    </AccordionItem>
  );
};

export default SelectionEntry;