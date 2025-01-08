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
  isSpan,
} from "@/utils/evals/selection";

import DictionaryView from "./DictionaryView";
import ImageView from "./ImageView";
import MatrixView from "./MatrixView";
import StringView from "./StringView";
import TraceView from "./TraceView";
import { Span } from "@/types/evals/traces";
import { LogComparisonProps } from "./types";

/** Checks if x is a single Span or an array of Spans (for a trace). */
function isTrace(x: any): x is Span | Span[] {
  if (!x) return false;
  if (isSpan(x)) return true;
  return Array.isArray(x) && x.every((item) => isSpan(item));
}

/**
 * pickView decides which specialized component to render given
 * a base "value" + "comparables." We keep the standard merging
 * logic in child components (DictionaryView, ListView, etc.).
 */
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

  // Fallback -> String
  return <StringView {...props} />;
}

/**
 * renderListItemSingle:
 * SINGLE mode => just the base list => 1 <AccordionItem> per element.
 * The base item’s label is red.
 */
function renderListItemSingle(
  index: number,
  itemValue: any,
  props: Omit<LogComparisonProps, "value" | "comparables">
): JSX.Element {
  const { baseLogIndex, comparisonLogsIndex, nestingLevel = 0 } = props;
  const label = `Item ${index}`;
  const indentClass = `pl-${nestingLevel * 4}`;

  // No comparables => just base item
  const childProps: LogComparisonProps = {
    value: itemValue,
    comparables: [],
    baseLogIndex,
    comparisonLogsIndex,
    nestingLevel: nestingLevel + 1,
  };

  return (
    <AccordionItem key={index} value={label}>
      {/* Red label in SINGLE mode (base item) */}
      <AccordionTrigger className={`${indentClass} text-red-600`}>
        {label}
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
 * We color the label red if a base item exists, else green if it’s purely from comparables.
 */
function renderListItemMulti(
  index: number,
  subValues: any[],
  rowIndexes: number[],
  nestingLevel: number
): JSX.Element {
  const label = `Item ${index}`;
  const indentClass = `pl-${nestingLevel * 4}`;

  // subValues[0] is the base item (if any), subValues[1..] are comparables
  const childProps: LogComparisonProps = {
    value: subValues[0],
    comparables: subValues.slice(1),
    baseLogIndex: rowIndexes[0],
    comparisonLogsIndex: rowIndexes.slice(1),
    nestingLevel: nestingLevel + 1,
  };

  // If there is a base item, label is red; otherwise only comparables => green
  const isInBase = subValues[0] !== undefined;
  const labelColorClass = isInBase ? "text-red-600" : "text-green-600";

  return (
    <AccordionItem key={index} value={label}>
      <AccordionTrigger className={`${indentClass} ${labelColorClass}`}>
        {label}
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
 * Compares multiple lists element-by-element:
 * 1. Gather [baseList, ...comparableLists].
 * 2. Find the widest length among them.
 * 3. At each index i, subValues => [baseItem, comp1, comp2...].
 * 4. Return a single <AccordionItem> (via renderListItemMulti) merging them.
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
 * - SINGLE MODE => base list => each item label is red.
 * - MULTI MODE => merges sub-items at each index and passes them to pickView.
 *   The label is red if subValues[0] is defined (in base), or green if not.
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

  // SINGLE MODE
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

  // MULTI MODE => [baseList, ...comparables], merges elements at each index
  const allLists = [value, ...comparables];
  const allIndexes = [baseLogIndex, ...comparisonLogsIndex];

  return <>{renderListMulti(allLists, allIndexes, nestingLevel)}</>;
};

export default ListView;