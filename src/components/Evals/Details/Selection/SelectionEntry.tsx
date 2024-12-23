import React from "react";
import { LogProps } from "@/types/evals/logs";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/UI/accordion";

import DictionaryView from "./Views/DictionaryView";
import ListView from "./Views/ListView";
import ImageView from "./Views/ImageView";
import MatrixView from "./Views/MatrixView";
import StringView from "./Views/StringView";
import TraceView from "./Views/TraceView/index";

import {
  isDict,
  isList,
  isMatrix,
  isImage,
  isSpan,
} from "@/utils/evals/selection";
import { Span } from "@/types/evals/traces";

import {
  Waypoints,
  CurlyBraces,
  Brackets,
  ImageIcon,
  Grid,
  Text
} from "lucide-react";

type SelectionEntryProps = {
  property: string;
  value: any;
  key: number; // React uses the special "key" prop internally, but we'll keep it in the type signature
  baseLog: LogProps;
  baseLogIndex: number;
  comparisonLogs?: LogProps[];
  comparisonLogsIndex: number[];
};

/**
 * Helper to check if value is a trace
 */
function isTrace(x: any): x is Span | Span[] {
  if (!x) return false;
  if (isSpan(x)) return true;
  if (Array.isArray(x) && x.every((item) => isSpan(item))) {
    return true;
  }
  return false;
}

/** Determine string label for an item’s type. */
function getValueType(value: any): "trace" | "dict" | "list" | "image" | "matrix" | "string" {
  if (isTrace(value)) return "trace";
  if (isDict(value)) return "dict";
  if (isList(value)) return "list";
  if (isImage(value)) return "image";
  if (isMatrix(value)) return "matrix";
  return "string";
}

/** Return the appropriate icon for the type. */
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
 * Decide which specialized component to render, based on an item’s type.
 */
function getSelectionComponent(
  key: number,
  value: any,
  comparables: any[],
  baseLogIndex: number,
  comparisonLogsIndex: number[]
): React.ReactNode {
  // If recognized as a trace
  if (isTrace(value)) {
    // Always let TraceView handle single vs multi internally
    const baseArr = Array.isArray(value) ? value : [value];
    // Convert each comparable to an array of spans as well
    const compArrs = comparables.map((c) => (Array.isArray(c) ? c : c ? [c] : []));
    return (
      <TraceView
        value={baseArr}
        comparables={compArrs}
        baseLogIndex={baseLogIndex}
        comparisonLogsIndex={comparisonLogsIndex}
      />
    );
  }

  // DICTIONARY
  if (isDict(value)) {
    return (
      <DictionaryView
        key={key}
        value={value}
        comparables={comparables}
        baseLogIndex={baseLogIndex}
        comparisonLogsIndex={comparisonLogsIndex}
      />
    );
  }

  // LIST
  if (isList(value)) {
    return (
      <ListView
        key={key}
        value={value}
        comparables={comparables}
        baseLogIndex={baseLogIndex}
        comparisonLogsIndex={comparisonLogsIndex}
      />
    );
  }

  // IMAGE
  if (isImage(value)) {
    return (
      <ImageView
        key={key}
        value={value}
        comparables={comparables}
        baseLogIndex={baseLogIndex}
        comparisonLogsIndex={comparisonLogsIndex}
      />
    );
  }

  // MATRIX
  if (isMatrix(value)) {
    return (
      <MatrixView
        key={key}
        value={value}
        comparables={comparables}
        baseLogIndex={baseLogIndex}
        comparisonLogsIndex={comparisonLogsIndex}
      />
    );
  }

  // FALLBACK => STRING
  return (
    <StringView
      key={key}
      value={value}
      comparables={comparables}
      baseLogIndex={baseLogIndex}
      comparisonLogsIndex={comparisonLogsIndex}
    />
  );
}

/**
 * SelectionEntry renders one property/value (plus optional comparisons)
 * in an AccordionItem, choosing the specialized "View" based on the data type.
 */
const SelectionEntry: React.FC<SelectionEntryProps> = ({
  property,
  value,
  key,
  baseLog,
  baseLogIndex,
  comparisonLogs,
  comparisonLogsIndex,
}) => {
  // Gather parallel values from each comparison log for this property
  const comparables = comparisonLogs
    ? comparisonLogs.map((log) => log.entries[property])
    : [];

  const valueType = getValueType(value);
  const icon = getTypeIcon(valueType);

  // Decide which specialized component to render
  const renderedSelection = getSelectionComponent(
    key,
    value,
    comparables,
    baseLogIndex,
    comparisonLogsIndex
  );

  return (
    <AccordionItem value={property}>
      <AccordionTrigger>
        <span className="inline-flex items-center gap-2">
          {icon}
          {property}
        </span>
      </AccordionTrigger>
      <AccordionContent>{renderedSelection}</AccordionContent>
    </AccordionItem>
  );
};

export default SelectionEntry;