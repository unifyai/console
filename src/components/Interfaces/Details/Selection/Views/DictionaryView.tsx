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

/** Check if a value is a single Span or an array of Spans (i.e., a trace). */
function isTrace(x: any): x is Span | Span[] {
  if (!x) return false;
  if (isSpan(x)) return true;
  return Array.isArray(x) && x.every((item) => isSpan(item));
}

/**
 * pickView: chooses which specialized component to render (DictionaryView,
 * ListView, TraceView, etc.) for a base “value” + “comparables.”
 * We preserve the “merge” logic in each sub-view.
 */
function pickView(props: LogComparisonProps): JSX.Element {
  const { value } = props;

  // Single or multi trace?
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

/** 
 * renderDictPropertySingle (SINGLE mode):
 * Creates an <AccordionItem> for [propertyName, val].
 * Property label is colored red (base).
 */
function renderDictPropertySingle(
  propertyName: string,
  val: any,
  props: Omit<LogComparisonProps, "value" | "comparables" | "propertyName">
): JSX.Element {
  const { baseLogIndex, comparisonLogsIndex, nestingLevel = 0 } = props;
  const indentClass = `pl-${nestingLevel * 4}`;

  const childProps: LogComparisonProps = {
    value: val,
    comparables: [],
    baseLogIndex,
    comparisonLogsIndex,
    nestingLevel: nestingLevel + 1
  };

  return (
    <AccordionItem key={propertyName} value={propertyName}>
      {/* Single mode -> red label for base property */}
      <AccordionTrigger className={`${indentClass} text-red-600`}>
        {propertyName}
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
 * renderDictPropertyMulti (MULTI mode):
 *  - merges keys across base + comparables
 *  - subValues => [baseVal, compVal1, compVal2, ...]
 *  - label is red if baseVal != undefined, else green (only comparables).
 */
function renderDictPropertyMulti(
  propertyName: string,
  dicts: any[],          // [baseDict, ...comparableDicts]
  dictIndexes: number[], // [baseLogIndex, ...comparisonLogsIndex]
  nestingLevel: number
): JSX.Element {
  // Gather sub-values for each dict for this key
  const subValues = dicts.map((d) => (d && isDict(d) ? d[propertyName] : undefined));

  // The first item is “baseVal,” the rest are “comparables”
  const childProps: LogComparisonProps = {
    value: subValues[0],
    comparables: subValues.slice(1),
    baseLogIndex: dictIndexes[0],
    comparisonLogsIndex: dictIndexes.slice(1),
    nestingLevel: nestingLevel + 1
  };
  const indentClass = `pl-${nestingLevel * 4}`;

  // If baseVal exists => label is red, otherwise green
  const baseVal = subValues[0];
  const labelColorClass = baseVal !== undefined ? "text-red-600" : "text-green-600";

  return (
    <AccordionItem key={propertyName} value={propertyName}>
      <AccordionTrigger className={`${indentClass} ${labelColorClass}`}>
        {propertyName}
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

/**
 * DictionaryView:
 * - SINGLE mode => renders each key in the base dictionary as <AccordionItem> (label in red).
 * - MULTI mode => merges keys across [base, ...comparables], each key -> union of sub-values.
 *   Label color is red if the base dict has the key, otherwise green if it's only in comparables.
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

  // SINGLE MODE
  if (!comparables || comparables.length === 0) {
    const items = Object.entries(value).map(([k, v]) =>
      renderDictPropertySingle(k, v, {
        baseLogIndex,
        comparisonLogsIndex,
        nestingLevel
      })
    );

    return <>{items}</>;
  }

  // MULTI MODE
  // 1) Combine [baseDict, ...comparableDicts]
  const allDicts = [value, ...comparables];
  // 2) Combine row indexes
  const allIndexes = [baseLogIndex, ...comparisonLogsIndex];
  // 3) Gather union of keys
  const allKeys = new Set<string>();
  allDicts.forEach((d) => {
    if (isDict(d)) {
      Object.keys(d).forEach((k) => allKeys.add(k));
    }
  });

  const keyArray = Array.from(allKeys).sort();
  const items = keyArray.map((key) =>
    renderDictPropertyMulti(key, allDicts, allIndexes, nestingLevel)
  );

  return <>{items}</>;
};

export default DictionaryView;