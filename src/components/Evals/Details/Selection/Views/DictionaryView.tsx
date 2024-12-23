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

import ListView from "./ListView";
import ImageView from "./ImageView";
import MatrixView from "./MatrixView";
import StringView from "./StringView";
import TraceView from "./TraceView/index";

import { Span } from "@/types/evals/traces";
import { LogComparisonProps } from "./types";

/** 
 * Detect if a value is a single Span or an array of Spans (i.e., a trace).
 */
function isTrace(x: any): x is Span | Span[] {
  if (!x) return false;
  if (isSpan(x)) return true;
  if (Array.isArray(x) && x.every((item) => isSpan(item))) return true;
  return false;
}

/**
 * Single-compare case: Renders a single [key, val] in an accordion item,
 * and recurses (if val is a dict/list/trace etc.)
 */
function renderDictPropertySingle(
  propertyName: string,
  val: any,
  props: Omit<LogComparisonProps, "value" | "comparables" | "propertyName">
): JSX.Element {
  const { baseLogIndex, comparisonLogsIndex, nestingLevel = 0 } = props;

  // Child props = single base val, no comparables
  const childProps: LogComparisonProps = {
    value: val,
    comparables: [],
    baseLogIndex,
    comparisonLogsIndex,
    nestingLevel: nestingLevel + 1
  };

  const indentClass = `pl-${nestingLevel * 4}`;
  return (
    <AccordionItem key={propertyName} value={propertyName}>
      <AccordionTrigger className={indentClass}>{propertyName}</AccordionTrigger>
      <AccordionContent>
        <div className={indentClass}>
          {pickView(childProps)}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

/**
 * Multi-compare case: For each key, gather the array of sub-values across
 * the base plus all comparables. Then we display them inside an AccordionItem
 * so nested structures also appear as accordion expansions. 
 */
function renderDictPropertyMulti(
  propertyName: string,
  dicts: any[],            // array of dictionaries: [baseDict, ...comparableDicts]
  dictIndexes: number[],   // rowIndices: [baseLogIndex, ...comparisonLogsIndex]
  nestingLevel: number
) {
  // Gather sub-values for each dictionary for this key
  const subValues = dicts.map((d) => (d && isDict(d) ? d[propertyName] : undefined));

  // For consistency, the first item is the "value," the rest are "comparables"
  const childProps: LogComparisonProps = {
    value: subValues[0],
    comparables: subValues.slice(1),
    baseLogIndex: dictIndexes[0],
    comparisonLogsIndex: dictIndexes.slice(1),
    nestingLevel: nestingLevel + 1
  };

  const indentClass = `pl-${nestingLevel * 4}`;

  return (
    <AccordionItem key={propertyName} value={propertyName} className={indentClass}>
      <AccordionTrigger className={indentClass}>{propertyName}</AccordionTrigger>
      <AccordionContent>
        <div className={indentClass}>
          {pickView(childProps)}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

/**
 * pickView is a helper that chooses which specialized component to render
 * (DictionaryView, ListView, TraceView, etc.) given the base “value” plus
 * its “comparables.” This is the same logic you’d do at top-level, but
 * recurses within dictionary keys. 
 */
function pickView(props: LogComparisonProps): JSX.Element {
  const { value, comparables } = props;

  // If there's only the base value (SINGLE), we check type on that
  // If there are comparables, we must see if they're all dict, or all list, etc.
  // But to keep it simple, we rely on each specialized "View" to handle single or multi.

  // Detect if base value is a trace
  if (isTrace(value)) {
    const traceArr = Array.isArray(value) ? value : [value];
    return <TraceView {...props} value={traceArr} />;
  }

  // Dictionary?
  if (isDict(value)) {
    return <DictionaryView {...props} />;
  }

  // List?
  if (isList(value)) {
    return <ListView {...props} />;
  }

  // Image?
  if (isImage(value)) {
    return <ImageView {...props} />;
  }

  // Matrix?
  if (isMatrix(value)) {
    return <MatrixView {...props} />;
  }

  // Fallback => String
  return <StringView {...props} />;
}

type DictionaryViewProps = LogComparisonProps;

/**
 * DictionaryView:
 * - SINGLE mode (no comparables): render each key as an AccordionItem, recursing if nested.
 * - MULTI mode: gather union keys across [base, ...comparables], 
 *               then for each key, create an AccordionItem that recurses 
 *               with all sub-values side by side (structurally).
 */
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

  // ------------------ SINGLE MODE ------------------
  if (!comparables || comparables.length === 0) {
    return (
      <div className="border-l">
        <Accordion type="multiple" className="space-y-1 ml-4">
          {Object.entries(value).map(([k, v]) =>
            renderDictPropertySingle(k, v, {
              baseLogIndex,
              comparisonLogsIndex,
              nestingLevel
            })
          )}
        </Accordion>
      </div>
    );
  }

  // ------------------- MULTI MODE ------------------
  // 1) Combine base + comparables => array of dicts
  const allDicts = [value, ...comparables];
  // 2) Combine row indexes => array of indexes
  const allIndexes = [baseLogIndex, ...comparisonLogsIndex];

  // 3) Gather the union of keys across all dictionaries
  const allKeys = new Set<string>();
  allDicts.forEach((d) => {
    if (isDict(d)) {
      for (const k of Object.keys(d)) {
        allKeys.add(k);
      }
    }
  });

  const keyArray = Array.from(allKeys).sort(); // optional sort

  // 4) For each key, render an AccordionItem that recurses into sub-values
  const indentClass = `pl-${nestingLevel * 4}`;
  return (
    <div className="border-l">
      <Accordion type="multiple" className="space-y-1 ml-4">
        {keyArray.map((k) =>
          renderDictPropertyMulti(k, allDicts, allIndexes, nestingLevel)
        )}
      </Accordion>
    </div>
  );
};

export default DictionaryView;