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

import Tooltip from "@/components/Common/Misc/Tooltip";

import {
  isDict,
  isList,
  isMatrix,
  isImage,
  isTrace
} from "@/utils/evals/selection";
import {
  Waypoints,
  CurlyBraces,
  Brackets,
  ImageIcon,
  Grid,
  Text
} from "lucide-react";

/** Either "entries" or "params", determining which field of the log object to read from. */
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
};

function getValueType(value: any): "trace" | "dict" | "list" | "image" | "matrix" | "string" {
  if (isTrace(value)) return "trace";
  if (isDict(value))  return "dict";
  if (isList(value))  return "list";
  if (isImage(value)) return "image";
  if (isMatrix(value))return "matrix";
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
    default:
      return <Text className="h-4 w-4 text-primary" />;
  }
}

/**
 * Decide which specialized component to display based on the data type.
 * Each specialized "View" (DictionaryView, ListView, etc.) returns an array
 * of <AccordionItem> elements (instead of creating a new Accordion),
 * so the single top-level Accordion in Selection.tsx can manage expansion.
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
) {
  if (isTrace(value)) {
    const baseArr = Array.isArray(value) ? value : [value];
    const compArrs = comparables.map((c) => Array.isArray(c) ? c : c ? [c] : []);
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

  if (isDict(value)) {
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
  }

  if (isList(value)) {
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
  }

  if (isImage(value)) {
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
  }

  if (isMatrix(value)) {
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
  }

  // Fallback => string
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

/**
 * SelectionEntry:
 * - Renders an <AccordionItem> for the property.
 * - The specialized content (DictionaryView, ListView, TraceView, etc.)
 *   returns more <AccordionItem> elements if nested, letting the top-level 
 *   Accordion in Selection.tsx handle expansions at all levels.
 */
const SelectionEntry: React.FC<SelectionEntryProps> = ({
  source = "entries",
  property,
  value,
  baseLog,
  baseLogIndex,
  comparisonLogs,
  comparisonLogsIndex,
  diffMode,
  splitView
}) => {
  let comparables = (comparisonLogs ?? []).map((cl) => {
    const container = source === "params" ? cl.params ?? {} : cl.entries ?? {};
    return container[property];
  });

  let version = "";
  let comparableVersions = [];

  if (source === "params") {
    version = value.paramVersion;
    comparableVersions = comparables.map((c) => c.paramVersion);
    value = value.paramValue;
    comparables = comparables.map((c) => c.paramValue);
  }
  
  const valueType = getValueType(value);
  const icon = getTypeIcon(valueType);

  const renderedContent = getSelectionView(
    value,
    comparables,
    version,
    comparableVersions,
    baseLogIndex,
    comparisonLogsIndex,
    diffMode,
    splitView,
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
