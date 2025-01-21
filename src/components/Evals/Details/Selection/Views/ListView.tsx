"use client";

import React, { useMemo, useState } from "react";
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

function renderListItemSingle(
  index: number,
  itemValue: any,
  props: Omit<LogComparisonProps, "value" | "comparables">
) {
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
    <AccordionItem key={label} value={label}>
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

function renderListItemMulti(
  index: number,
  subValues: any[],
  rowIndexes: number[],
  nestingLevel: number
) {
  const label = `Item ${index}`;
  const indentClass = `pl-${nestingLevel * 4}`;

  const baseVal = subValues[0];
  const compVals = subValues.slice(1);
  const baseHas = baseVal !== undefined;

  const redSet = new Set<number>();
  const greenSet = new Set<number>();
  compVals.forEach((cv, i) => {
    if (baseHas && cv === undefined) {
      redSet.add(rowIndexes[i + 1]);
    } else if (!baseHas && cv !== undefined) {
      greenSet.add(rowIndexes[i + 1]);
    }
  });

  const redRows = Array.from(redSet).sort((a, b) => a - b);
  const greenRows = Array.from(greenSet).sort((a, b) => a - b);

  let labelColorClass = "";
  if (redRows.length > 0 && baseHas) labelColorClass = "text-red-600";
  else if (greenRows.length > 0 && !baseHas) labelColorClass = "text-green-600";

  let sample = baseVal;
  if (sample === undefined) sample = compVals.find((v) => v !== undefined);
  const itemType = sample ? getValueType(sample) : "string";
  const icon = getTypeIcon(itemType);

  const showBaseBadge = baseHas && (redRows.length > 0 || greenRows.length > 0);
  const baseRows = showBaseBadge ? [rowIndexes[0]] : [];

  const childProps: LogComparisonProps = {
    value: baseVal,
    comparables: compVals,
    baseLogIndex: rowIndexes[0],
    comparisonLogsIndex: rowIndexes.slice(1),
    nestingLevel,
  };

  return (
    <AccordionItem key={label} value={label}>
      <AccordionTrigger className={`${indentClass} ${labelColorClass}`}>
        <span className="inline-flex items-center gap-2">
          {icon}
          {label}
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

function renderListMulti(
  lists: any[],
  rowIndexes: number[],
  nestingLevel: number
) {
  const maxLength = Math.max(
    ...lists.map((l) => (Array.isArray(l) ? l.length : 0))
  );
  const result: JSX.Element[] = [];
  for (let i = 0; i < maxLength; i++) {
    const subVals = lists.map((l) => (Array.isArray(l) ? l[i] : undefined));
    result.push(renderListItemMulti(i, subVals, rowIndexes, nestingLevel));
  }
  return result;
}

type ListViewProps = LogComparisonProps;

const ListView: React.FC<ListViewProps> = ({
  value,
  comparables,
  baseLogIndex,
  comparisonLogsIndex,
  nestingLevel = 0,
}) => {
  // hooks first
  const multiMode = (comparables && comparables.length > 0) ? true : false;

  let labelKeys: string[] = [];
  if (!multiMode) {
    if (Array.isArray(value)) {
      labelKeys = value.map((_, idx: number) => `Item ${idx}`);
    }
  } else {
    const baseLen = Array.isArray(value) ? value.length : 0;
    const compLens = (comparables ?? []).map((arr) => (Array.isArray(arr) ? arr.length : 0));
    const maxLen = Math.max(baseLen, ...compLens);
    labelKeys = Array.from({ length: maxLen }, (_, i) => `Item ${i}`);
  }

  // gather which should be default open
  const defaultOpen = useMemo(() => {
    const out: string[] = [];
    if (!multiMode) {
      if (Array.isArray(value)) {
        value.forEach((item, idx) => {
          const t = getValueType(item);
          if (["string","matrix","image"].includes(t)) {
            out.push(`Item ${idx}`);
          }
        });
      }
    } else {
      const allLists = [value, ...(comparables ?? [])];
      for (let i = 0; i < labelKeys.length; i++) {
        // find first defined sample
        let sample = undefined;
        for (const arr of allLists) {
          if (Array.isArray(arr) && arr[i] !== undefined) {
            sample = arr[i];
            break;
          }
        }
        const t = getValueType(sample);
        if (["string","matrix","image"].includes(t)) {
          out.push(`Item ${i}`);
        }
      }
    }
    return out;
  }, [multiMode, labelKeys, value, comparables]);

  const [openItems, setOpenItems] = useState<string[]>(defaultOpen);

  // now any early return
  if (!isList(value)) {
    return <p className="text-red-500">ListView: Value is not a valid list.</p>;
  }

  let listItems: JSX.Element[] = [];
  if (!multiMode) {
    if (Array.isArray(value)) {
      listItems = value.map((item, idx) =>
        renderListItemSingle(idx, item, {
          baseLogIndex,
          nestingLevel,
          comparisonLogsIndex: [],
        })
      );
    }
  } else {
    const allLists = [value, ...(comparables ?? [])];
    const rowIdxs = [baseLogIndex, ...(comparisonLogsIndex ?? [])];
    listItems = renderListMulti(allLists, rowIdxs, nestingLevel);
  }

  const everythingOpen = labelKeys.length > 0 && openItems.length === labelKeys.length;

  function handleToggleAll() {
    if (everythingOpen) setOpenItems([]);
    else setOpenItems(labelKeys);
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