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
import RowBadge from "./RowBadge";

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
 SINGLE MODE => base dictionary only => no differences to highlight
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
-----------------------------------------------------------------------------*/
function renderDictPropertyMulti(
  propertyName: string,
  dicts: any[],
  dictIndexes: number[],
  nestingLevel: number
): JSX.Element {
  // subValues[0] => base, subValues[1..] => comps
  const subValues = dicts.map((d) => (d && isDict(d) ? d[propertyName] : undefined));
  const baseVal = subValues[0];
  const compVals = subValues.slice(1);
  const baseHasIt = baseVal !== undefined;

  // For each comparable => if base has it but comp is missing => red
  // if base missing but comp has => green
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

  // Decide label color:
  // If no diffs => black. If baseVal => at least one missing => red. If base missing => at least one comp has => green
  let labelColorClass = "";
  if (redRows.length > 0 && baseHasIt) {
    labelColorClass = "text-red-600";
  } else if (greenRows.length > 0 && !baseHasIt) {
    labelColorClass = "text-green-600";
  }

  // Icon => pick from the first non-undefined sample
  let sample = baseVal;
  if (sample === undefined) {
    sample = compVals.find((v) => v !== undefined);
  }
  const valType = sample ? getValueType(sample) : "string";
  const icon = getTypeIcon(valType);

  // Child props => pass baseVal + compVals
  const childProps: LogComparisonProps = {
    value: baseVal,
    comparables: compVals,
    baseLogIndex: dictIndexes[0],
    comparisonLogsIndex: dictIndexes.slice(1),
    nestingLevel,
  };

  // Potential single row badge for base if it’s present, but only if you want 
  // to show that “base has it.” Typically if the base has it and no comp differs, 
  // no diff => we might skip a badge. 
  // We'll omit the base row badge if there's no difference from any comp.
  const showBaseBadge = baseHasIt && (redRows.length > 0 || greenRows.length > 0);
  const baseRows = showBaseBadge ? [dictIndexes[0]] : [];

  const indentClass = `pl-${nestingLevel * 4}`;

  return (
    <AccordionItem key={propertyName} value={propertyName}>
      <AccordionTrigger className={`${indentClass} ${labelColorClass}`}>
        <span className="inline-flex items-center gap-2">
          {icon}
          {propertyName}

          {/* Display row badges for diffs */}
          {(baseRows.length > 0 || redRows.length > 0 || greenRows.length > 0) && (
            <div className="ml-2 flex gap-1">
              {/* {baseRows.length > 0 && (
                <RowBadge
                  rowNumbers={baseRows}
                  customClass="bg-slate-200 text-foreground"
                />
              )} */}
              {redRows.length > 0 && (
                <RowBadge
                  rowNumbers={redRows}
                  customClass="bg-red-300 text-red-800"
                />
              )}
              {greenRows.length > 0 && (
                <RowBadge
                  rowNumbers={greenRows}
                  customClass="bg-green-300 text-green-800"
                />
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
 *   - Single mode => no diffs
 *   - Multi mode => highlight keys that differ in presence from base
 */
const DictionaryView: React.FC<DictionaryViewProps> = ({
  value,
  comparables,
  baseLogIndex,
  comparisonLogsIndex,
  nestingLevel = 0
}) => {
  if (!isDict(value)) {
    return (
      <p className="text-red-500">
        DictionaryView: Base value is not a dictionary.
      </p>
    );
  }

  if (!comparables || comparables.length === 0) {
    // Single-mode => just render each property with no diffs
    return (
      <>
        {Object.entries(value).map(([k, v]) =>
          renderDictPropertySingle(k, v, {
            baseLogIndex,
            comparisonLogsIndex: [],
            nestingLevel: nestingLevel + 1,
          })
        )}
      </>
    );
  }

  // Multi-mode => union of keys from base + all comparables
  const allDicts = [value, ...comparables];
  const allIndexes = [baseLogIndex, ...comparisonLogsIndex];

  const allKeys = new Set<string>();
  allDicts.forEach((obj) => {
    if (obj && isDict(obj)) {
      Object.keys(obj).forEach((k) => allKeys.add(k));
    }
  });

  return (
    <>
      {Array.from(allKeys).sort().map((propertyKey) =>
        renderDictPropertyMulti(propertyKey, allDicts, allIndexes, nestingLevel + 1)
      )}
    </>
  );
};

export default DictionaryView;
