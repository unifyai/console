"use client";
import React from "react";
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent
} from "@/components/UI/accordion";
import {
  isDict,
  isList,
  isMatrix,
  isImage,
  isSpan
} from "@/utils/evals/selection";

import ListView from "./ListView";
import ImageView from "./ImageView";
import MatrixView from "./MatrixView";
import StringView from "./StringView";
import TraceView from "./TraceView";
import { Span } from "@/types/evals/traces";
import { LogComparisonProps } from "./types";

import { 
  Text as TextIcon,
  Pilcrow,
  CurlyBraces,
  Brackets,
  ImageIcon,
  Grid
} from "lucide-react";

function isTrace(x: any): x is Span | Span[] {
  if (!x) return false;
  if (isSpan(x)) return true;
  return Array.isArray(x) && x.every(isSpan);
}

function getValueType(value: any): "trace" | "dict" | "list" | "image" | "matrix" | "string" {
  if (isTrace(value))   return "trace";
  if (isDict(value))    return "dict";
  if (isList(value))    return "list";
  if (isImage(value))   return "image";
  if (isMatrix(value))  return "matrix";
  return "string";
}

function getTypeIcon(valueType: string) {
  switch (valueType) {
    case "trace":
      return <Pilcrow className="h-4 w-4 text-primary" />;
    case "dict":
      return <CurlyBraces className="h-4 w-4 text-primary" />;
    case "list":
      return <Brackets className="h-4 w-4 text-primary" />;
    case "image":
      return <ImageIcon className="h-4 w-4 text-primary" />;
    case "matrix":
      return <Grid className="h-4 w-4 text-primary" />;
    default:
      return <TextIcon className="h-4 w-4 text-primary" />;
  }
}

function pickView(props: LogComparisonProps): JSX.Element {
  const { value } = props;

  if (isTrace(value)) {
    const traceArr = Array.isArray(value) ? value : [value];
    return <TraceView {...props} value={traceArr} />;
  }

  if (isDict(value)) {
    return <DictionaryView {...props} />;
  }

  if (isList(value)) {
    return <ListView {...props} />;
  }

  if (isImage(value)) {
    return <ImageView {...props} />;
  }

  if (isMatrix(value)) {
    return <MatrixView {...props} />;
  }

  return <StringView {...props} />;
}

/**
 * Render a single dictionary property in SINGLE mode.
 */
function renderDictPropertySingle(
  propertyName: string,
  val: any,
  props: Omit<LogComparisonProps, "value" | "comparables" | "propertyName"> & { nestingLevel: number }
): JSX.Element {
  const { baseLogIndex, comparisonLogsIndex, nestingLevel } = props;

  // Compute indentation class based on nestingLevel
  const indentClass = `pl-${nestingLevel * 4}`;

  // Infer child type => icon
  const valType = getValueType(val);
  const icon = getTypeIcon(valType);

  const childProps: LogComparisonProps = {
    value: val,
    comparables: [],
    baseLogIndex,
    comparisonLogsIndex,
    nestingLevel: nestingLevel + 1
  };

  return (
    <AccordionItem key={propertyName} value={propertyName}>
      <AccordionTrigger className={`${indentClass}`}>
        <span className="inline-flex items-center gap-2">
          {icon}
          {propertyName}
        </span>
      </AccordionTrigger>
      <AccordionContent>
        <div className={`border-l ml-4 ${indentClass}`}>
          {pickView(childProps)}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

/**
 * Render a dictionary property in MULTI mode.
 */
function renderDictPropertyMulti(
  propertyName: string,
  dicts: any[],
  dictIndexes: number[],
  nestingLevel: number
): JSX.Element {
  // Gather sub-values => [baseVal, compVal1, compVal2...]
  const subValues = dicts.map((d) => (d && isDict(d) ? d[propertyName] : undefined));

  const baseVal = subValues[0];
  const labelColorClass = baseVal !== undefined ? "text-red-600" : "text-green-600";

  // For child type icon => pick the first non-undefined sample
  let sample = baseVal;
  if (sample === undefined) {
    sample = subValues.find((v) => v !== undefined);
  }
  const valType = sample ? getValueType(sample) : "string";
  const icon = getTypeIcon(valType);

  const childProps: LogComparisonProps = {
    value: subValues[0],
    comparables: subValues.slice(1),
    baseLogIndex: dictIndexes[0],
    comparisonLogsIndex: dictIndexes.slice(1),
    nestingLevel: nestingLevel + 1
  };

  const indentClass = `pl-${nestingLevel * 4}`;

  return (
    <AccordionItem key={propertyName} value={propertyName}>
      <AccordionTrigger className={`${indentClass} ${labelColorClass}`}>
        <span className="inline-flex items-center gap-2">
          {icon}
          {propertyName}
        </span>
      </AccordionTrigger>
      <AccordionContent>
        <div className={`border-l ml-4 ${indentClass}`}>
          {pickView(childProps)}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

type DictionaryViewProps = LogComparisonProps;

const DictionaryView: React.FC<DictionaryViewProps> = (props) => {
  const {
    value,
    comparables,
    baseLogIndex,
    comparisonLogsIndex,
    nestingLevel = 0
  } = props;

  if (!isDict(value)) {
    return (
      <p className="text-red-500">
        DictionaryView: Base value is not an object.
      </p>
    );
  }

  // SINGLE mode (no comparables)
  if (!comparables || comparables.length === 0) {
    const items = Object.entries(value).map(([k, v]) =>
      renderDictPropertySingle(k, v, {
        baseLogIndex,
        comparisonLogsIndex,
        nestingLevel: nestingLevel + 1
      })
    );
    return <>{items}</>;
  }

  // MULTI mode => union of keys
  const allDicts = [value, ...comparables];
  const allIndexes = [baseLogIndex, ...comparisonLogsIndex];
  const allKeys = new Set<string>();
  allDicts.forEach((d) => {
    if (isDict(d)) {
      Object.keys(d).forEach((k) => allKeys.add(k));
    }
  });

  const keyArray = Array.from(allKeys).sort();
  // Also do nestingLevel+1 for multi
  const items = keyArray.map((key) =>
    renderDictPropertyMulti(key, allDicts, allIndexes, nestingLevel + 1)
  );

  return <>{items}</>;
};

export default DictionaryView;