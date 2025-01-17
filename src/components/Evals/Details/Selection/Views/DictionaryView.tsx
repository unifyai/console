"use client";
import React, { useState } from "react";
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Accordion,
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
  Grid,
  FoldVertical,
  UnfoldVertical
} from "lucide-react";
import RowBadge from "./RowBadge";
import ActionButton from "@/components/Common/Buttons/Action";

/** Type guard for trace data (a single or array of Span). */
function isTrace(x: any): x is Span | Span[] {
  if (!x) return false;
  if (isSpan(x)) return true;
  return Array.isArray(x) && x.every(isSpan);
}

/** Decide which specialized view to render. */
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

/** pickView => subcomponent dispatch: */
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

/*-----------------------------------------------------------------------------
 SINGLE MODE => base dictionary only => no differences
   Returns an <AccordionItem> for a single dictionary property.
-----------------------------------------------------------------------------*/
function renderDictPropertySingle(
  propertyName: string,
  val: any,
  props: Omit<LogComparisonProps, "value" | "comparables"> & { nestingLevel: number }
): JSX.Element {
  const { baseLogIndex, nestingLevel } = props;
  const indentClass = `pl-${nestingLevel * 4}`;
  const valType = getValueType(val);
  const icon = getTypeIcon(valType);

  const childProps: LogComparisonProps = {
    value: val,
    comparables: [],
    baseLogIndex,
    comparisonLogsIndex: [],
    nestingLevel,
  };

  return (
    <AccordionItem key={propertyName} value={propertyName}>
      <AccordionTrigger className={indentClass}>
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

/*-----------------------------------------------------------------------------
 MULTI MODE => base + comparables => highlight diffs
   Returns an <AccordionItem> for a dictionary property across multiple logs.
-----------------------------------------------------------------------------*/
function renderDictPropertyMulti(
  propertyName: string,
  dicts: any[],
  dictIndexes: number[],
  nestingLevel: number
): JSX.Element {
  // subValues[0] => base; subValues[1..] => comps
  const subValues = dicts.map((d) => (d && isDict(d) ? d[propertyName] : undefined));
  const baseVal = subValues[0];
  const compVals = subValues.slice(1);
  const baseHasIt = baseVal !== undefined;

  // presence diffs
  const redSet = new Set<number>();
  const greenSet = new Set<number>();

  compVals.forEach((compVal, i) => {
    const row = dictIndexes[i + 1];
    const compHasIt = compVal !== undefined;
    if (baseHasIt && !compHasIt) {
      redSet.add(row);
    } else if (!baseHasIt && compHasIt) {
      greenSet.add(row);
    }
  });

  const redRows = Array.from(redSet).sort((a, b) => a - b);
  const greenRows = Array.from(greenSet).sort((a, b) => a - b);

  let labelColorClass = "";
  if (redRows.length > 0 && baseHasIt) {
    labelColorClass = "text-red-600";
  } else if (greenRows.length > 0 && !baseHasIt) {
    labelColorClass = "text-green-600";
  }

  // Icon => from the first non-undefined
  let sample = baseVal;
  if (sample === undefined) {
    sample = compVals.find((v) => v !== undefined);
  }
  const valType = sample ? getValueType(sample) : "string";
  const icon = getTypeIcon(valType);

  const childProps: LogComparisonProps = {
    value: baseVal,
    comparables: compVals,
    baseLogIndex: dictIndexes[0],
    comparisonLogsIndex: dictIndexes.slice(1),
    nestingLevel,
  };

  // Possibly show base row if diffs
  const baseHasDiff = baseHasIt && (redRows.length > 0 || greenRows.length > 0);
  const baseRows = baseHasDiff ? [dictIndexes[0]] : [];

  const indentClass = `pl-${nestingLevel * 4}`;

  return (
    <AccordionItem key={propertyName} value={propertyName}>
      <AccordionTrigger className={`${indentClass} ${labelColorClass}`}>
        <span className="inline-flex items-center gap-2">
          {icon}
          {propertyName}
          {(baseRows.length > 0 || redRows.length > 0 || greenRows.length > 0) && (
            <div className="ml-2 flex gap-1">
              {redRows.length > 0 && (
                <RowBadge rowNumbers={redRows} customClass="bg-red-300 text-red-800" />
              )}
              {greenRows.length > 0 && (
                <RowBadge rowNumbers={greenRows} customClass="bg-green-300 text-green-800" />
              )}
            </div>
          )}
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

/**
 * DictionaryView:
 * Wraps the single or multi-mode dictionary items in an <Accordion>,
 * providing its own "Expand All/Collapse All" control.
 */
const DictionaryView: React.FC<DictionaryViewProps> = ({
  value,
  comparables,
  baseLogIndex,
  comparisonLogsIndex,
  nestingLevel = 0
}) => {
  // Validate
  if (!isDict(value)) {
    return (
      <p className="text-red-500">
        DictionaryView: Base value is not a dictionary.
      </p>
    );
  }

  // Single vs multi
  let allKeys: string[];
  let allDicts: any[];
  let allIndexes: number[];

  if (!comparables || comparables.length === 0) {
    // Single-mode => just base
    allKeys = Object.keys(value);
    allDicts = [value];
    allIndexes = [baseLogIndex];
  } else {
    // Multi-mode => union of keys from base + comparables
    const joined = [value, ...comparables];
    allDicts = joined;
    allIndexes = [baseLogIndex, ...comparisonLogsIndex];

    const unionKeys = new Set<string>();
    joined.forEach((obj) => {
      if (obj && isDict(obj)) {
        Object.keys(obj).forEach((k) => unionKeys.add(k));
      }
    });
    allKeys = Array.from(unionKeys).sort();
  }

  // Local expand/collapse control
  const [openItems, setOpenItems] = useState<string[]>([]);
  const everythingOpen = allKeys.length > 0 && openItems.length === allKeys.length;

  function handleToggleAll() {
    if (everythingOpen) setOpenItems([]);
    else setOpenItems(allKeys);
  }

  // Render each property as an <AccordionItem>
  function renderProperties() {
    return allKeys.map((propertyKey) => {
      if (comparables && comparables.length > 0) {
        // multi
        return renderDictPropertyMulti(propertyKey, allDicts, allIndexes, nestingLevel + 1);
      } else {
        // single
        const val = value[propertyKey];
        return renderDictPropertySingle(propertyKey, val, {
          baseLogIndex,
          comparisonLogsIndex: [],
          nestingLevel: nestingLevel + 1,
        });
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Optional label row */}
      <div className="flex items-center justify-between">
        <p className="font-bold text-sm">Dictionary</p>
        {allKeys.length > 0 && (
          <ActionButton
            variant="ghost"
            size="icon"
            tooltip={everythingOpen ? "Collapse All" : "Expand All"}
            onClick={handleToggleAll}
            icon={
              everythingOpen
                ? <FoldVertical className="h-4 w-4" />
                : <UnfoldVertical className="h-4 w-4" />
            }
          />
        )}
      </div>

      <Accordion
        type="multiple"
        value={openItems}
        onValueChange={setOpenItems}
      >
        {renderProperties()}
      </Accordion>
    </div>
  );
};

export default DictionaryView;