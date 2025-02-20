"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/UI/accordion";

import {
  isDict,
  isList,
  isMatrix,
  isImage,
  isTrace,
  isNumber,
  isTimestamp,
  isChat,
} from "@/utils/evals/selection";

import { LogComparisonProps } from "./types";
import { getValueType, getTypeIcon } from "./ViewTypes";

import ListView from "./ListView";
import ImageView from "./ImageView";
import MatrixView from "./MatrixView";
import StringView from "./StringView";
import TraceView from "./TraceView";
import NumberView from "./NumberView";
import TimestampView from "./TimestampView";
import ChatView from "./ChatView";

import { Button } from "@/components/UI/button";
import { FoldVertical, UnfoldVertical } from "lucide-react";

// RowBadge is used to show “insert/delete” row sets
import RowBadge from "./RowBadge";

/*────────────────────────────────────────────────────────────────────────────
  1) unifyType: merges baseVal + comparables to produce a single type.
     If multiple distinct types appear, fallback to "string."
────────────────────────────────────────────────────────────────────────────*/
function unifyType(baseVal: any, comps: any[]): string {
  const filtered = [baseVal, ...comps].filter((v) => {
    if (v === undefined || v === null) return false;
    if (typeof v === "string" && v.trim() === "") return false;
    return true;
  });
  if (filtered.length === 0) return "string";

  const typeSet = new Set<string>();
  for (const val of filtered) {
    const t = getValueType(val);
    typeSet.add(t);
  }
  return typeSet.size === 1 ? Array.from(typeSet)[0] : "string";
}

/*────────────────────────────────────────────────────────────────────────────
  2) pickView => specialized or fallback, with optional forceExpandAll
────────────────────────────────────────────────────────────────────────────*/
function pickView(
  props: LogComparisonProps & { forceExpandAll?: boolean }
): JSX.Element {
  const { value } = props;

  if (isTrace(value)) {
    const arr = Array.isArray(value) ? value : [value];
    return <TraceView {...props} value={arr} />;
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

/*────────────────────────────────────────────────────────────────────────────
  3) toggleOnePropertyExpand => toggles child expansions for a single key
────────────────────────────────────────────────────────────────────────────*/
function toggleOnePropertyExpand(
  propertyKey: string,
  openItems: string[],
  setOpenItems: React.Dispatch<React.SetStateAction<string[]>>,
  childForceExpand: string[],
  setChildForceExpand: React.Dispatch<React.SetStateAction<string[]>>
) {
  if (!childForceExpand.includes(propertyKey)) {
    setChildForceExpand((prev) => [...prev, propertyKey]);
  } else {
    setChildForceExpand((prev) => prev.filter((k) => k !== propertyKey));
  }
}

/*────────────────────────────────────────────────────────────────────────────
  DictionaryView component
  - Preserves expansions, icons, triggers, and now includes presence-diff for keys
────────────────────────────────────────────────────────────────────────────*/
type DictionaryViewProps = LogComparisonProps & {
  forceExpandAll?: boolean;
};

const DictionaryView: React.FC<DictionaryViewProps> = (props) => {
  const {
    value,
    comparables,
    baseLogIndex,
    comparisonLogsIndex,
    version = "",
    comparableVersions = [],
    nestingLevel = 0,
    diffMode = "none",
    splitView = false,
    displayMode = "markdown",
    forceExpandAll = false,
  } = props;

  // Collect keys + data from base + comps
  const allKeysAndData = useMemo(() => {
    let keys: string[] = [];
    let dicts: any[] = [];
    let indexes: number[] = [];

    if (!comparables || comparables.length === 0) {
      // single-mode
      keys = Object.keys(value || {}).sort();
      dicts = [value];
      indexes = [baseLogIndex];
    } else {
      // multi-mode
      const joined = [value, ...comparables];
      dicts = joined;
      indexes = [baseLogIndex, ...comparisonLogsIndex];

      const union = new Set<string>();
      joined.forEach((obj) => {
        if (obj && isDict(obj)) {
          Object.keys(obj).forEach((k) => union.add(k));
        }
      });
      keys = Array.from(union).sort();
    }

    return { allKeys: keys, allDicts: dicts, allIndexes: indexes };
  }, [value, comparables, baseLogIndex, comparisonLogsIndex]);

  // For dictionary expansions
  const [openItems, setOpenItems] = useState<string[]>([]);
  const [childForceExpand, setChildForceExpand] = useState<string[]>([]);

  // If forceExpandAll changes, open or close everything
  useEffect(() => {
    if (forceExpandAll) {
      setOpenItems(allKeysAndData.allKeys);
      setChildForceExpand(allKeysAndData.allKeys);
    } else {
      // revert to default
      // We'll auto-open simple types like string/number/image by default:
      const defaults = allKeysAndData.allKeys.filter((k) => {
        const sample = allKeysAndData.allDicts[0]?.[k];
        const t = getValueType(sample);
        return ["string", "number", "matrix", "image"].includes(t);
      });
      setOpenItems(defaults);
      setChildForceExpand(defaults);
    }
  }, [forceExpandAll, allKeysAndData.allKeys, allKeysAndData.allDicts]);

  if (!isDict(value)) {
    return (
      <p className="text-red-500">
        DictionaryView: Base Value is not a dictionary.
      </p>
    );
  }

  // Single property rendering => used in single-mode
  function renderSingleProperty(propKey: string, val: any) {
    // unify => baseVal=val, no comps => unifyType(val, [])
    const valType = unifyType(val, []);
    const icon = getTypeIcon(valType);
    const isOpen = openItems.includes(propKey);
    const isChildForceExpand = childForceExpand.includes(propKey);

    const childProps: LogComparisonProps & { forceExpandAll?: boolean } = {
      value: val,
      comparables: [],
      baseLogIndex,
      comparisonLogsIndex: [],
      nestingLevel: nestingLevel + 1,
      diffMode,
      splitView,
      version,
      comparableVersions,
      displayMode,
      forceExpandAll: isChildForceExpand,
    };

    return (
      <AccordionItem key={propKey} value={propKey}>
        <AccordionTrigger className="relative group flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            {icon} {propKey}
          </span>
          {isOpen && (valType === "dict" || valType === "list") && (
            <div className="absolute right-5 flex gap-1 items-center">
              <Button
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleOnePropertyExpand(
                    propKey,
                    openItems,
                    setOpenItems,
                    childForceExpand,
                    setChildForceExpand
                  );
                }}
              >
                {isChildForceExpand ? (
                  <FoldVertical size={16} />
                ) : (
                  <UnfoldVertical size={16} />
                )}
              </Button>
            </div>
          )}
        </AccordionTrigger>
        <AccordionContent>
          <div className="border-l ml-4 pl-1">{pickView(childProps)}</div>
        </AccordionContent>
      </AccordionItem>
    );
  }

  // Multi property => used in multi-mode
  function renderMultiProperty(propKey: string) {
    const dicts = allKeysAndData.allDicts;
    const subValues = dicts.map((d) => (d && isDict(d) ? d[propKey] : undefined));
    const baseVal = subValues[0];
    const compVals = subValues.slice(1);

    // Presence-diff logic:
    const baseHasIt = baseVal !== undefined;
    const redSet = new Set<number>();
    const greenSet = new Set<number>();
    compVals.forEach((cVal, i) => {
      const row = allKeysAndData.allIndexes[i + 1];
      const compHasIt = cVal !== undefined;
      if (baseHasIt && !compHasIt) {
        redSet.add(row);
      } else if (!baseHasIt && compHasIt) {
        greenSet.add(row);
      }
    });
    const redRows = Array.from(redSet).sort((a, b) => a - b);
    const greenRows = Array.from(greenSet).sort((a, b) => a - b);
    let labelColor = "";
    if (redRows.length > 0 && baseHasIt) {
      labelColor = "text-red-600";
    } else if (greenRows.length > 0 && !baseHasIt) {
      labelColor = "text-green-600";
    }

    // unify type for the property
    const propType = unifyType(baseVal, compVals);
    const icon = getTypeIcon(propType);

    const isOpen = openItems.includes(propKey);
    const isChildForceExpand = childForceExpand.includes(propKey);

    const childProps: LogComparisonProps & { forceExpandAll?: boolean } = {
      value: baseVal,
      comparables: compVals,
      baseLogIndex: allKeysAndData.allIndexes[0],
      comparisonLogsIndex: allKeysAndData.allIndexes.slice(1),
      nestingLevel: nestingLevel + 1,
      diffMode,
      splitView,
      version,
      comparableVersions,
      displayMode,
      forceExpandAll: isChildForceExpand,
    };

    return (
      <AccordionItem key={propKey} value={propKey}>
        <AccordionTrigger
          className={`relative group flex items-center justify-between ${labelColor}`}
        >
          <span className="inline-flex items-center gap-2">
            {icon} {propKey}
            {(redRows.length > 0 || greenRows.length > 0) && (
              <div className="flex gap-1 ml-2">
                {redRows.length > 0 && (
                  <RowBadge rowNumbers={redRows} mode="delete" />
                )}
                {greenRows.length > 0 && (
                  <RowBadge rowNumbers={greenRows} mode="insert" />
                )}
              </div>
            )}
          </span>
          {isOpen && (propType === "dict" || propType === "list") && (
            <div className="absolute right-5 flex gap-1 items-center">
              <Button
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleOnePropertyExpand(
                    propKey,
                    openItems,
                    setOpenItems,
                    childForceExpand,
                    setChildForceExpand
                  );
                }}
              >
                {isChildForceExpand ? (
                  <FoldVertical size={16} />
                ) : (
                  <UnfoldVertical size={16} />
                )}
              </Button>
            </div>
          )}
        </AccordionTrigger>
        <AccordionContent>
          <div className="border-l ml-4 pl-1">{pickView(childProps)}</div>
        </AccordionContent>
      </AccordionItem>
    );
  }

  function renderProperties() {
    return allKeysAndData.allKeys.map((propKey) => {
      if (!comparables || comparables.length === 0) {
        // single-mode
        const val = value[propKey];
        return renderSingleProperty(propKey, val);
      } else {
        // multi-mode
        return renderMultiProperty(propKey);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Accordion
        key={`dict-${forceExpandAll ? "open" : "closed"}`}
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