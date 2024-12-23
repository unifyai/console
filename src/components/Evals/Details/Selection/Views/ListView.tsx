import React from "react";
import {
  Accordion,
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

import DictionaryView from "./DictionaryView";
import ImageView from "./ImageView";
import MatrixView from "./MatrixView";
import StringView from "./StringView";
import TraceView from "./TraceView/index";

import { Span } from "@/types/evals/traces";
import { LogComparisonProps } from "./types";

/** Helper to detect if a value is a single Span or an array of Spans. */
function isTrace(x: any): x is Span | Span[] {
  if (!x) return false;
  if (isSpan(x)) return true;
  if (Array.isArray(x) && x.every((item) => isSpan(item))) {
    return true;
  }
  return false;
}

/**
 * pickView: A helper that decides which specialized component
 * to render, given a base “value” plus comparables. 
 * This is the same approach used in DictionaryView’s multi logic.
 */
function pickView(props: LogComparisonProps): JSX.Element {
  const { value } = props;

  // If base is a trace
  if (isTrace(value)) {
    const traceArr = Array.isArray(value) ? value : [value];
    return <TraceView {...props} value={traceArr} />;
  }

  // If base is a dict
  if (isDict(value)) {
    return <DictionaryView {...props} />;
  }

  // If base is a list
  if (isList(value)) {
    return <ListView {...props} />;
  }

  // If base is an image
  if (isImage(value)) {
    return <ImageView {...props} />;
  }

  // If base is a matrix (2D array)
  if (isMatrix(value)) {
    return <MatrixView {...props} />;
  }

  // Fallback -> string or something rendered as string
  return <StringView {...props} />;
}

/* 
 Single-mode rendering of one list item (no comparables).
 Creates an AccordionItem for the item index, and recurses to pickView for itemValue.
*/
function renderListItemSingle(
  index: number,
  itemValue: any,
  props: Omit<LogComparisonProps, "value" | "comparables">
): JSX.Element {
  const { baseLogIndex, comparisonLogsIndex, nestingLevel = 0 } = props;
  const label = `Item ${index}`;
  const indentClass = `pl-${nestingLevel * 4}`;

  // childProps = single base value + no comparables
  const childProps: LogComparisonProps = {
    value: itemValue,
    comparables: [],
    baseLogIndex,
    comparisonLogsIndex,
    nestingLevel: nestingLevel + 1
  };

  return (
    <AccordionItem key={index} value={label}>
      <AccordionTrigger className={indentClass}>{label}</AccordionTrigger>
      <AccordionContent>
        <div className={indentClass}>{pickView(childProps)}</div>
      </AccordionContent>
    </AccordionItem>
  );
}

/**
 Multi-mode rendering of the entire list. We do a “structural compare”:
 1) Gather all lists => [base, ...comparables].
 2) Find their “max length” among them.
 3) For each index from [0..maxLen-1], we create an AccordionItem.
 4) We gather the sub-values at that index across all lists, calling pickView to recurse.
 */
function renderListMulti(
  lists: any[],            // array of lists: [baseValue, ...comparables]
  listIndexes: number[],   // row indices: [baseLogIndex, ...comparisonLogsIndex]
  nestingLevel: number
) {
  if (!lists.length) {
    return <p className="text-sm text-red-500">No lists to compare.</p>;
  }

  // Find the maximum length among all lists
  const maxLength = Math.max(
    ...lists.map((lst) => (Array.isArray(lst) ? lst.length : 0))
  );

  const indentClass = `pl-${nestingLevel * 4}`;
  return (
    <Accordion type="multiple" className="space-y-1 ml-4">
      {Array.from({ length: maxLength }).map((_, index) => {
        const label = `Item ${index}`;
        // Gather the item at `index` from each list; might be undefined if out of bounds
        const subValues = lists.map((lst) =>
          Array.isArray(lst) ? lst[index] : undefined
        );

        const childProps: LogComparisonProps = {
          value: subValues[0],             // base item
          comparables: subValues.slice(1), // rest
          baseLogIndex: listIndexes[0],
          comparisonLogsIndex: listIndexes.slice(1),
          nestingLevel: nestingLevel + 1
        };

        return (
          <AccordionItem key={index} value={label}>
            <AccordionTrigger className={indentClass}>
              {label}
            </AccordionTrigger>
            <AccordionContent>
              <div className={indentClass}>{pickView(childProps)}</div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

type ListViewProps = LogComparisonProps;

const ListView: React.FC<ListViewProps> = (props) => {
  const {
    value,
    comparables,
    baseLogIndex,
    comparisonLogsIndex,
    nestingLevel = 0
  } = props;

  // If base "value" is not actually a list, error out
  if (!isList(value)) {
    return <p className="text-red-500">ListView: Value is not a valid list.</p>;
  }

  // ----------------- SINGLE MODE -----------------
  if (!comparables || comparables.length === 0) {
    // Just show each item in an accordion
    return (
      <div className="border-l">
        <Accordion type="multiple" className="space-y-1 ml-4">
          {value.map((item, idx) =>
            renderListItemSingle(idx, item, {
              baseLogIndex,
              comparisonLogsIndex,
              nestingLevel
            })
          )}
        </Accordion>
      </div>
    );
  }

  // ---------------- MULTI MODE -----------------
  // [base, ...comparables] => arrays to compare element by element
  const allLists = [value, ...comparables];
  const allIndexes = [baseLogIndex, ...comparisonLogsIndex];

  return (
    <div className="border-l">
      {renderListMulti(allLists, allIndexes, nestingLevel)}
    </div>
  );
};

export default ListView;