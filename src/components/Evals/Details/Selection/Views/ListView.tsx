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
 * a base "value" + "comparables." This is the same approach used
 * in DictionaryView, but adapted for lists.
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
 * Creates one <AccordionItem> for the item at “index” in SINGLE mode
 * (i.e., no “comparables”). We do not create a separate <Accordion>.
 */
function renderListItemSingle(
  index: number,
  itemValue: any,
  props: Omit<LogComparisonProps, "value" | "comparables">
): JSX.Element {
  const { baseLogIndex, comparisonLogsIndex, nestingLevel = 0 } = props;
  const label = `Item ${index}`;
  const indentClass = `pl-${nestingLevel * 4}`;

  // Child props => single base “value” & empty “comparables”
  const childProps: LogComparisonProps = {
    value: itemValue,
    comparables: [],
    baseLogIndex,
    comparisonLogsIndex,
    nestingLevel: nestingLevel + 1,
  };

  return (
    <AccordionItem key={index} value={label}>
      <AccordionTrigger className={indentClass}>
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
 * Creates one <AccordionItem> for the item at “index” in MULTI mode
 * (i.e., we have “comparables”). “subValues” holds the element
 * from each list at that index (or undefined if out of bounds).
 */
function renderListItemMulti(
  index: number,
  subValues: any[],
  rowIndexes: number[],
  nestingLevel: number
): JSX.Element {
  const label = `Item ${index}`;
  const indentClass = `pl-${nestingLevel * 4}`;

  const childProps: LogComparisonProps = {
    value: subValues[0], // base item
    comparables: subValues.slice(1),
    baseLogIndex: rowIndexes[0],
    comparisonLogsIndex: rowIndexes.slice(1),
    nestingLevel: nestingLevel + 1,
  };

  return (
    <AccordionItem key={index} value={label}>
      <AccordionTrigger className={indentClass}>{label}</AccordionTrigger>
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
 * 1) Takes [baseList, ...comparableLists].
 * 2) Finds max length among them.
 * 3) For i in [0..maxLen-1], gather the item from each list (or undefined).
 * 4) Return an array of <AccordionItem> for each index.
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
    // Gather the item from each list
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
 * - SINGLE mode => returns a set of <AccordionItem> for each element in the list.
 * - MULTI mode => compares elements across multiple lists in parallel, returning
 *                 <AccordionItem> for each index. 
 * We do NOT create nested <Accordion> here—only <AccordionItem>, so a
 * single top-level <Accordion> can control expand/collapse globally.
 */
const ListView: React.FC<ListViewProps> = (props) => {
  const {
    value,
    comparables,
    baseLogIndex,
    comparisonLogsIndex,
    nestingLevel = 0,
  } = props;

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

  // MULTI MODE
  const allLists = [value, ...comparables];
  const allIndexes = [baseLogIndex, ...comparisonLogsIndex];

  return <>{renderListMulti(allLists, allIndexes, nestingLevel)}</>;
};

export default ListView;