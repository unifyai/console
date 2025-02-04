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
import RawView from "./Views/RawView";

import Tooltip from "@/components/Common/Misc/Tooltip";

import {
  isDict,
  isList,
  isMatrix,
  isImage,
  isTrace,
  isNumber,
  isTimestamp,
  isChat,
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
  MessagesSquare // icon for "chat"
} from "lucide-react";

/** Either "entries" or "params", determining which field of the log object to read from. */
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
 * Decide which specialized component to display based on the data type.
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

/**
 * SelectionEntry:
 */
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
  version?: string;
  comparableVersions?: string[];
};

const SelectionEntry: React.FC<SelectionEntryProps> = ({
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
}) => {
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

  const renderedContent = getSelectionView(
    rawValue,
    comparables,
    version,
    comparableVersions,
    baseLogIndex,
    comparisonLogsIndex,
    diffMode,
    splitView,
    rawMode
  );

  return (
    <AccordionItem value={property}>
      <AccordionTrigger>
        <span className="inline-flex items-center gap-2">
          <Tooltip content={valueType}>
            {icon}
          </Tooltip>
          {property}
        </span>
      </AccordionTrigger>

      <AccordionContent>
        {renderedContent}
      </AccordionContent>
    </AccordionItem>
  );
};

export default SelectionEntry;