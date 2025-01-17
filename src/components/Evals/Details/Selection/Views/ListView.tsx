"use client";
import React, { useState } from "react";
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Accordion
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
  FoldVertical,
  UnfoldVertical,
} from "lucide-react";
import RowBadge from "./RowBadge";
import ActionButton from "@/components/Common/Buttons/Action";

/** Decide data type => icon => subcomponent. */
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

/*-----------------------------------------------------------------------------
 SINGLE MODE => base list => no diffs
   Returns an <AccordionItem> for one array item.
-----------------------------------------------------------------------------*/
function renderListItemSingle(
  index: number,
  itemValue: any,
  props: Omit<LogComparisonProps, "value" | "comparables">
): JSX.Element {
  const { baseLogIndex, nestingLevel = 0 } = props;
  const label = `Item ${index}`;
  const indentClass = `pl-${nestingLevel * 4}`;
  const itemType = getValueType(itemValue);
  const icon = getTypeIcon(itemType);

  const childProps: LogComparisonProps = {
    value: itemValue,
    comparables: [],
    baseLogIndex,
    comparisonLogsIndex: [],
    nestingLevel,
  };

  return (
    <AccordionItem key={index} value={label}>
      <AccordionTrigger className={indentClass}>
        <span className="inline-flex items-center gap-2">
          {icon}
          {label}
        </span>
      </AccordionTrigger>
      <AccordionContent>
        <div className={`border-l ml-4 pl-1 ${indentClass}`}>
          {pickView(childProps)}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

/*-----------------------------------------------------------------------------
 MULTI MODE => base + comps => highlight presence diffs
   Returns an <AccordionItem> for one index across all logs.
-----------------------------------------------------------------------------*/
function renderListItemMulti(
  index: number,
  subValues: any[],
  rowIndexes: number[],
  nestingLevel: number
): JSX.Element {
  const label = `Item ${index}`;
  const indentClass = `pl-${nestingLevel * 4}`;

  // subValues[0] => base
  const baseVal = subValues[0];
  const compVals = subValues.slice(1);
  const baseHasIt = baseVal !== undefined;

  const redSet = new Set<number>();
  const greenSet = new Set<number>();
  compVals.forEach((cv, i) => {
    if (baseHasIt && cv === undefined) {
      redSet.add(rowIndexes[i + 1]);
    } else if (!baseHasIt && cv !== undefined) {
      greenSet.add(rowIndexes[i + 1]);
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

  // Icon => from a sample
  let sample = baseVal;
  if (sample === undefined) {
    sample = compVals.find((v) => v !== undefined);
  }
  const itemType = sample ? getValueType(sample) : "string";
  const icon = getTypeIcon(itemType);

  const showBaseBadge = baseHasIt && (redRows.length > 0 || greenRows.length > 0);
  const baseRows = showBaseBadge ? [rowIndexes[0]] : [];

  const childProps: LogComparisonProps = {
    value: baseVal,
    comparables: compVals,
    baseLogIndex: rowIndexes[0],
    comparisonLogsIndex: rowIndexes.slice(1),
    nestingLevel,
  };

  return (
    <AccordionItem key={index} value={label}>
      <AccordionTrigger className={`${indentClass} ${labelColorClass}`}>
        <span className="inline-flex items-center gap-2">
          {icon}
          {label}
          {(baseRows.length > 0 || redRows.length > 0 || greenRows.length > 0) && (
            <div className="ml-2 flex gap-1">
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

/**
 * Build up the full set of “item indices” to handle multi-mode
 * if arrays differ in length.
 */
function renderListMulti(
  lists: any[],
  rowIndexes: number[],
  nestingLevel: number
): JSX.Element[] {
  const maxLength = Math.max(
    ...lists.map((lst) => (Array.isArray(lst) ? lst.length : 0))
  );

  const items: JSX.Element[] = [];
  for (let idx = 0; idx < maxLength; idx++) {
    const subValues = lists.map((lst) =>
      Array.isArray(lst) ? lst[idx] : undefined
    );
    items.push(renderListItemMulti(idx, subValues, rowIndexes, nestingLevel));
  }
  return items;
}

type ListViewProps = LogComparisonProps;

/**
 * ListView:
 *   Wraps items in its own <Accordion>, with an “Expand All/Collapse All” button.
 */
const ListView: React.FC<ListViewProps> = ({
  value,
  comparables,
  baseLogIndex,
  comparisonLogsIndex,
  nestingLevel = 0,
}) => {
  //
  // 1) Always call hooks at the top, unconditionally
  //
  const [openItems, setOpenItems] = useState<string[]>([]);

  //
  // 2) Then do any early validation checks / returns
  //
  if (!isList(value)) {
    return <p className="text-red-500">ListView: Value is not a valid list.</p>;
  }

  // Single-mode or multi-mode data
  const multiMode = comparables && comparables.length > 0;

  // Build “labels” to drive the accordion items
  let labelKeys: string[] = [];
  if (!multiMode) {
    // single
    labelKeys = value.map((_: any, idx: number) => `Item ${idx}`);
  } else {
    // multi
    const maxLength = Math.max(
      value.length,
      ...comparables.map((arr) => (Array.isArray(arr) ? arr.length : 0))
    );
    labelKeys = Array.from({ length: maxLength }, (_, i) => `Item ${i}`);
  }

  // Expand/Collapse behavior
  const everythingOpen = labelKeys.length > 0 && openItems.length === labelKeys.length;

  function handleToggleAll() {
    if (everythingOpen) setOpenItems([]);
    else setOpenItems(labelKeys);
  }

  // Actual list items
  let listItems: JSX.Element[];

  if (!multiMode) {
    // Single-mode
    listItems = value.map((item: any, idx: number) =>
      renderListItemSingle(idx, item, {
        baseLogIndex,
        nestingLevel,
        comparisonLogsIndex: [],
      })
    );
  } else {
    // Multi-mode
    const allLists = [value, ...(comparables ?? [])];
    const rowIndexes = [baseLogIndex, ...(comparisonLogsIndex ?? [])];
    listItems = renderListMulti(allLists, rowIndexes, nestingLevel);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <p className="font-bold text-sm">List</p>
        {labelKeys.length > 0 && (
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
        {listItems}
      </Accordion>
    </div>
  );
};

export default ListView;