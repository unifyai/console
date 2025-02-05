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

/*────────────────────────────────────────────────────────────────────────────
  buildKeyToTypeMap => figure out type for each key (string, dict, etc.)
────────────────────────────────────────────────────────────────────────────*/
function buildKeyToTypeMap(
  allKeys: string[],
  baseValue: any,
  comparables: any[] | undefined
): Record<string, string> {
  const map: Record<string, string> = {};
  allKeys.forEach((k) => {
    let sample = baseValue ? baseValue[k] : undefined;
    if (sample === undefined && comparables) {
      for (const c of comparables) {
        if (c && isDict(c) && c[k] !== undefined) {
          sample = c[k];
          break;
        }
      }
    }
    map[k] = getValueType(sample);
  });
  return map;
}

/*────────────────────────────────────────────────────────────────────────────
  pickView => specialized or raw
  Accepts forceExpandAll? for child expansions
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
  toggleOnePropertyExpand => toggles just that property in openItems,
  also toggles child forced expansions for that property alone
────────────────────────────────────────────────────────────────────────────*/
function toggleOnePropertyExpand(
  propertyKey: string,
  openItems: string[],
  setOpenItems: React.Dispatch<React.SetStateAction<string[]>>,
  childForceExpand: string[],
  setChildForceExpand: React.Dispatch<React.SetStateAction<string[]>>
) {
  const isOpen = openItems.includes(propertyKey);
  if (!isOpen) {
    // expand just this property
    setOpenItems((prev) => [...prev, propertyKey]);
    setChildForceExpand((prev) => [...prev, propertyKey]);
  } else {
    // collapse just this property
    setOpenItems((prev) => prev.filter((k) => k !== propertyKey));
    setChildForceExpand((prev) => prev.filter((k) => k !== propertyKey));
  }
}

/*────────────────────────────────────────────────────────────────────────────
 DictionaryView:
 - Expands each property individually if user toggles it
 - If forceExpandAll flips from false->true or true->false, either opens or closes everything
 - Avoid infinite loops with a didExpandRef
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
    forceExpandAll = false,
  } = props;

  if (!isDict(value)) {
    return <p className="text-red-500">DictionaryView: Value is not a dictionary.</p>;
  }

  // build the union set of property keys
  let allKeys: string[] = [];
  let allDicts: any[] = [];
  let allIndexes: number[] = [];

  if (!comparables || comparables.length === 0) {
    allKeys = Object.keys(value).sort();
    allDicts = [value];
    allIndexes = [baseLogIndex];
  } else {
    const joined = [value, ...comparables];
    allDicts = joined;
    allIndexes = [baseLogIndex, ...comparisonLogsIndex];

    const union = new Set<string>();
    joined.forEach((obj) => {
      if (obj && isDict(obj)) {
        Object.keys(obj).forEach((k) => union.add(k));
      }
    });
    allKeys = Array.from(union).sort();
  }

  // figure out default expansions for string/number/matrix/image
  const keyTypeMap = useMemo(() => buildKeyToTypeMap(allKeys, value, comparables), [
    allKeys,
    value,
    comparables
  ]);

  const defaultOpenKeys = useMemo(() => {
    return allKeys.filter((k) =>
      ["string", "number", "matrix", "image"].includes(keyTypeMap[k])
    );
  }, [allKeys, keyTypeMap]);

  // local open items
  const [openItems, setOpenItems] = useState(defaultOpenKeys);

  // track which props are forcibly expanded for their child dictionary/list
  const [childForceExpand, setChildForceExpand] = useState<string[]>([]);

  // handle symmetrical force expansions => open or close everything
  const didExpandRef = useRef(false);
  useEffect(() => {
    if (forceExpandAll && !didExpandRef.current) {
      // open everything
      setOpenItems(allKeys);
      setChildForceExpand(allKeys);
      didExpandRef.current = true;
    } else if (!forceExpandAll && didExpandRef.current) {
      // close everything
      setOpenItems([]);
      setChildForceExpand([]);
      didExpandRef.current = false;
    }
  }, [forceExpandAll, allKeys]);

  // render single-mode property
  function renderSingleProperty(propKey: string, val: any) {
    const valType = getValueType(val);
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
      forceExpandAll: isChildForceExpand,
    };

    return (
      <AccordionItem key={propKey} value={propKey}>
        <AccordionTrigger className="relative group flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            {icon} {propKey}
          </span>

          {(valType === "dict" || valType === "list") && (
            <div
              className="
              absolute right-5
              opacity-0 group-hover:opacity-100
              transition-opacity
              flex gap-1 items-center
              "
            >
              <Button
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleOnePropertyExpand(propKey, openItems, setOpenItems, childForceExpand, setChildForceExpand);
                }}
              >
                {isOpen ? <FoldVertical size={16} /> : <UnfoldVertical size={16} />}
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

  // render multi-mode property
  function renderMultiProperty(propKey: string) {
    const subValues = allDicts.map((d) => (d && isDict(d) ? d[propKey] : undefined));
    const baseVal = subValues[0];
    const compVals = subValues.slice(1);

    let sample = baseVal;
    if (sample === undefined) {
      sample = compVals.find((v) => v !== undefined);
    }
    const valType = getValueType(sample);
    const icon = getTypeIcon(valType);

    const isOpen = openItems.includes(propKey);
    const isChildForceExpand = childForceExpand.includes(propKey);

    const childProps: LogComparisonProps & { forceExpandAll?: boolean } = {
      value: baseVal,
      comparables: compVals,
      baseLogIndex: allIndexes[0],
      comparisonLogsIndex: allIndexes.slice(1),
      nestingLevel: nestingLevel + 1,
      diffMode: props.diffMode,
      splitView: props.splitView,
      version: props.version,
      comparableVersions: props.comparableVersions,
      forceExpandAll: isChildForceExpand,
    };

    return (
      <AccordionItem key={propKey} value={propKey}>
        <AccordionTrigger className="relative group flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            {icon} {propKey}
          </span>

          {(valType === "dict" || valType === "list") && (
            <div
              className="
              absolute right-5
              opacity-0 group-hover:opacity-100
              transition-opacity
              flex gap-1 items-center
              "
            >
              <Button
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleOnePropertyExpand(propKey, openItems, setOpenItems, childForceExpand, setChildForceExpand);
                }}
              >
                {isOpen ? <FoldVertical size={16} /> : <UnfoldVertical size={16} />}
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
    return allKeys.map((propKey) => {
      if (!comparables || comparables.length === 0) {
        const val = value[propKey];
        return renderSingleProperty(propKey, val);
      } else {
        return renderMultiProperty(propKey);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Accordion type="multiple" value={openItems} onValueChange={setOpenItems}>
        {renderProperties()}
      </Accordion>
    </div>
  );
};

export default DictionaryView;