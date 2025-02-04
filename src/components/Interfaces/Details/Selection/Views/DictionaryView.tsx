"use client";
import React, { useMemo, useState } from "react";
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
  isSpan,
  isNumber,
  isTimestamp,
  isTrace,
  isChat,
} from "@/utils/evals/selection";

import ListView from "./ListView";
import ImageView from "./ImageView";
import MatrixView from "./MatrixView";
import StringView from "./StringView";
import TraceView from "./TraceView";
import NumberView from "./NumberView";
import TimestampView from "./TimestampView";
import ChatOutView from "./ChatView/ChatOutView"; // ← added import

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
  Hash,
  Clock,
} from "lucide-react";
import RowBadge from "./RowBadge";
import ActionButton from "@/components/Common/Buttons/Action";
import Tooltip from "@/components/Common/Misc/Tooltip";
import ChatView from "./ChatView";
import { getValueType, getTypeIcon } from "./ViewTypes";

function pickView(props: LogComparisonProps): JSX.Element {
  const { value } = props;

  if (isTrace(value)) {
    const traceArr = Array.isArray(value) ? value : [value];
    return <TraceView {...props} value={traceArr} />;
  }
  if (isChat(value)) {
    return <ChatView {...props} />;
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
  if (isNumber(value)) {
    return <NumberView {...props} />;
  }
  if (isTimestamp(value)) {
    return <TimestampView {...props} />;
  }
  return <StringView {...props} />;
}

/**
 * Helper to map each dictionary key => a sample type.
 */
function buildKeyToTypeMap(
  allKeys: string[],
  baseValue: any,
  comparables: any[] | undefined
): Record<string, string> {
  const map: Record<string, string> = {};
  allKeys.forEach((k) => {
    let sampleVal = baseValue ? baseValue[k] : undefined;
    if (sampleVal === undefined && comparables) {
      for (const c of comparables) {
        if (c && isDict(c) && c[k] !== undefined) {
          sampleVal = c[k];
          break;
        }
      }
    }
    const valType = getValueType(sampleVal);
    map[k] = valType;
  });
  return map;
}

function renderDictPropertySingle(
  propertyName: string,
  val: any,
  props: Omit<LogComparisonProps, "value" | "comparables"> & { nestingLevel: number }
) {
  const {
    baseLogIndex,
    nestingLevel,
    diffMode,
    splitView,
    version,
    comparableVersions,
  } = props;
  const indentClass = `pl-${nestingLevel * 4}`;
  const valType = getValueType(val);
  const icon = getTypeIcon(valType);

  const childProps: LogComparisonProps = {
    value: val,
    comparables: [],
    baseLogIndex,
    comparisonLogsIndex: [],
    nestingLevel,
    diffMode,
    splitView,
    version,
    comparableVersions,
  };

  const rendered = pickView(childProps);
  return (
    <AccordionItem key={propertyName} value={propertyName}>
      <AccordionTrigger className={indentClass}>
        <span className="inline-flex items-center gap-2">
          <Tooltip content={valType}>
            {icon}
          </Tooltip>
          {propertyName}
        </span>
      </AccordionTrigger>
      <AccordionContent>
        <div className={`border-l ml-4 ${indentClass}`}>
          {rendered}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function renderDictPropertyMulti(
  propertyName: string,
  dicts: any[],
  dictIndexes: number[],
  nestingLevel: number,
  diffMode?: LogComparisonProps["diffMode"],
  splitView?: LogComparisonProps["splitView"],
  version?: string,
  comparableVersions?: string[]
) {
  const subValues = dicts.map((d) => (d && isDict(d) ? d[propertyName] : undefined));
  const baseVal = subValues[0];
  const compVals = subValues.slice(1);
  const baseHasIt = baseVal !== undefined;

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
  if (redRows.length > 0 && baseHasIt) labelColorClass = "text-red-600";
  else if (greenRows.length > 0 && !baseHasIt) labelColorClass = "text-green-600";

  let sample = baseVal;
  if (sample === undefined) sample = compVals.find((v) => v !== undefined);
  const valType = sample ? getValueType(sample) : "string";
  const icon = getTypeIcon(valType);

  const childProps: LogComparisonProps = {
    value: baseVal,
    comparables: compVals,
    baseLogIndex: dictIndexes[0],
    comparisonLogsIndex: dictIndexes.slice(1),
    nestingLevel,
    diffMode,
    splitView,
    version,
    comparableVersions,
  };

  const baseHasDiff = baseHasIt && (redRows.length > 0 || greenRows.length > 0);
  const baseRows = baseHasDiff ? [dictIndexes[0]] : [];

  const indentClass = `pl-${nestingLevel * 4}`;

  return (
    <AccordionItem key={propertyName} value={propertyName}>
      <AccordionTrigger className={`${indentClass} ${labelColorClass}`}>
        <span className="inline-flex items-center gap-2">
          <Tooltip content={valType}>
            {icon}
          </Tooltip>
          {propertyName}
          {(baseRows.length > 0 || redRows.length > 0 || greenRows.length > 0) && (
            <div className="ml-2 flex gap-1">
              {redRows.length > 0 && <RowBadge rowNumbers={redRows} mode="delete" />}
              {greenRows.length > 0 && <RowBadge rowNumbers={greenRows} mode="insert" />}
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

const DictionaryView: React.FC<DictionaryViewProps> = ({
  value,
  comparables,
  baseLogIndex,
  comparisonLogsIndex,
  version = "",
  comparableVersions = [],
  nestingLevel = 0,
  diffMode = "none",
  splitView = false,
}) => {
  let allKeys: string[] = [];
  let allDicts: any[] = [];
  let allIndexes: number[] = [];

  if (!comparables || comparables.length === 0) {
    allKeys = isDict(value) ? Object.keys(value) : [];
    allDicts = [value];
    allIndexes = [baseLogIndex];
  } else {
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

  const keyTypeMap = useMemo(() => {
    return buildKeyToTypeMap(allKeys, value, comparables);
  }, [allKeys, value, comparables]);


  const defaultOpenKeys = useMemo(() => {
    return allKeys.filter((k) => {
      const t = keyTypeMap[k];
      return ["string","number","matrix","image"].includes(t);
    });
  }, [allKeys, keyTypeMap]);

  const [openItems, setOpenItems] = useState<string[]>(defaultOpenKeys);

  if (!isDict(value)) {
    return <p className="text-red-500">DictionaryView: Value is not a dictionary.</p>;
  }

  function renderProperties() {
    return allKeys.map((propertyKey) => {
      if (comparables && comparables.length > 0) {
        return renderDictPropertyMulti(
          propertyKey,
          allDicts,
          allIndexes,
          nestingLevel + 1,
          diffMode,
          splitView,
          version,
          comparableVersions
        );
      } else {
        const val = value[propertyKey];
        return renderDictPropertySingle(propertyKey, val, {
          baseLogIndex,
          comparisonLogsIndex: [],
          nestingLevel: nestingLevel + 1,
          diffMode,
          splitView,
          version,
          comparableVersions,
        });
      }
    });
  }

  const everythingOpen = allKeys.length > 0 && openItems.length === allKeys.length;

  function handleToggleAll() {
    if (everythingOpen) setOpenItems([]);
    else setOpenItems(allKeys);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p></p>
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
