"use client";
import React from "react";
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/UI/accordion";
import {
  isDict,
  isList,
  isMatrix,
  isImage,
  isTrace,
} from "@/utils/evals/selection";

import DictionaryView from "./DictionaryView";
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
  Grid,
} from "lucide-react";

/** 
 * Decide the data type for an item => "trace", "dict", "list", "image", "matrix", or "string".
 */
function getValueType(value: any): "trace" | "dict" | "list" | "image" | "matrix" | "string" {
  if (isTrace(value))   return "trace";
  if (isDict(value))    return "dict";
  if (isList(value))    return "list";
  if (isImage(value))   return "image";
  if (isMatrix(value))  return "matrix";
  return "string";
}

/** 
 * Pick an icon based on the data type.
 */
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

/**
 * pickView decides which specialized component to render
 * given a base "value" + "comparables."
 */
function pickView(props: LogComparisonProps): JSX.Element {
  const { value } = props;

  // If it's a single or array of Spans => trace
  if (isTrace(value)) {
    const traceArr = Array.isArray(value) ? value : [value];
    return <TraceView {...props} value={traceArr} />;
  }
  // If it's a dictionary
  if (isDict(value)) {
    return <DictionaryView {...props} />;
  }
  // If it's a list
  if (isList(value)) {
    return <ListView {...props} />;
  }
  // If it's an image
  if (isImage(value)) {
    return <ImageView {...props} />;
  }
  // If it's a matrix
  if (isMatrix(value)) {
    return <MatrixView {...props} />;
  }
  // Fallback => String
  return <StringView {...props} />;
}

/**
 * renderListItemSingle:
 * SINGLE mode => Base list => 1 <AccordionItem> per element.
 * We show an icon for each item’s data type next to "Item #".
 */
function renderListItemSingle(
  index: number,
  itemValue: any,
  props: Omit<LogComparisonProps, "value" | "comparables">
): JSX.Element {
  const { baseLogIndex, comparisonLogsIndex, nestingLevel = 0 } = props;
  const label = `Item ${index}`;
  const indentClass = `pl-${nestingLevel * 4}`;

  // Infer type/icon for the item
  const itemType = getValueType(itemValue);
  const icon = getTypeIcon(itemType);

  // Child props => pass itemValue as base, no comparables
  const childProps: LogComparisonProps = {
    value: itemValue,
    comparables: [],
    baseLogIndex,
    comparisonLogsIndex,
    nestingLevel: nestingLevel + 1,
  };

  return (
    <AccordionItem key={index} value={label}>
      <AccordionTrigger className={`${indentClass}`}>
        {/* Single mode => label in red by default. Show icon + label */}
        <span className="inline-flex items-center gap-2">
          {icon}
          {label}
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
 * renderListItemMulti:
 * MULTI mode => merges an element from base (subValues[0]) + comparables (subValues[1..]).
 * If base item exists => red label, else green => only comparables.
 * Also show an icon for the subValues' type (base or first non-undefined).
 */
function renderListItemMulti(
  index: number,
  subValues: any[],
  rowIndexes: number[],
  nestingLevel: number
): JSX.Element {
  const label = `Item ${index}`;
  const indentClass = `pl-${nestingLevel * 4}`;

  // subValues[0] => the base item
  const baseItem = subValues[0];
  const isInBase = baseItem !== undefined;
  const labelColorClass = isInBase ? "text-red-600" : "text-green-600";

  // Find a sample to determine icon
  let sample = baseItem;
  if (sample === undefined) {
    sample = subValues.find((v) => v !== undefined);
  }
  const itemType = sample ? getValueType(sample) : "string";
  const icon = getTypeIcon(itemType);

  // Child props => base= subValues[0], comparables= subValues[1..]
  const childProps: LogComparisonProps = {
    value: subValues[0],
    comparables: subValues.slice(1),
    baseLogIndex: rowIndexes[0],
    comparisonLogsIndex: rowIndexes.slice(1),
    nestingLevel: nestingLevel + 1,
  };

  return (
    <AccordionItem key={index} value={label}>
      <AccordionTrigger className={`${indentClass} ${labelColorClass}`}>
        <span className="inline-flex items-center gap-2">
          {icon}
          {label}
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
 * renderListMulti:
 * For multi-lists, find the widest length among [baseList, ...comps].
 * For each index, combine subValues => call renderListItemMulti.
 */
function renderListMulti(
  lists: any[],
  rowIndexes: number[],
  nestingLevel: number
): JSX.Element[] {
  if (!lists.length) {
    return [
      <p key="nolists" className="text-sm text-red-500">
        No lists to compare.
      </p>,
    ];
  }
  const maxLength = Math.max(
    ...lists.map((lst) => (Array.isArray(lst) ? lst.length : 0))
  );

  const items: JSX.Element[] = [];
  for (let index = 0; index < maxLength; index++) {
    // subValues => [baseItem, compItem1, compItem2...]
    const subValues = lists.map((lst) =>
      Array.isArray(lst) ? lst[index] : undefined
    );
    items.push(renderListItemMulti(index, subValues, rowIndexes, nestingLevel));
  }
  return items;
}

type ListViewProps = LogComparisonProps;

/**
 * ListView:
 * - SINGLE mode => base list => each item => red label, with icon for data type.
 * - MULTI mode => merges elements at each index => item => red if base, else green, plus an icon.
 */
const ListView: React.FC<ListViewProps> = ({
  value,
  comparables,
  baseLogIndex,
  comparisonLogsIndex,
  nestingLevel = 0,
}) => {
  if (!isList(value)) {
    return <p className="text-red-500">ListView: Value is not a valid list.</p>;
  }

  // SINGLE MODE => no comparables
  if (!comparables || comparables.length === 0) {
    return (
      <>
        {value.map((item, idx) =>
          renderListItemSingle(idx, item, {
            baseLogIndex,
            comparisonLogsIndex,
            nestingLevel,
          })
        )}
      </>
    );
  }

  // MULTI MODE => merges sub-items index by index
  const allLists = [value, ...comparables];
  const allIndexes = [baseLogIndex, ...comparisonLogsIndex];

  return <>{renderListMulti(allLists, allIndexes, nestingLevel)}</>;
};

export default ListView;