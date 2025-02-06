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

  // local state hooks - must be called unconditionally at the top level
  const [openItems, setOpenItems] = useState<string[]>([]);
  const [childForceExpand, setChildForceExpand] = useState<string[]>([]);
  const didExpandRef = useRef(false);

  // build the union set of property keys
  const allKeysAndData = useMemo(() => {
    let keys: string[] = [];
    let dicts: any[] = [];
    let indexes: number[] = [];

    if (!comparables || comparables.length === 0) {
      keys = Object.keys(value || {}).sort();
      dicts = [value];
      indexes = [baseLogIndex];
    } else {
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

  // figure out default expansions for string/number/matrix/image
  const keyTypeMap = useMemo(() => {
    const map: Record<string, string> = {};
    allKeysAndData.allKeys.forEach((k) => {
      let sample = value ? value[k] : undefined;
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
  }, [allKeysAndData.allKeys, value, comparables]);

  const defaultOpenKeys = useMemo(() => {
    return allKeysAndData.allKeys.filter((k) =>
      ["string", "number", "matrix", "image"].includes(keyTypeMap[k])
    );
  }, [allKeysAndData.allKeys, keyTypeMap]);

  // Set initial open items
  useEffect(() => {
    setOpenItems(defaultOpenKeys);
  }, [defaultOpenKeys]);

  // handle symmetrical force expansions => open or close everything
  useEffect(() => {
    if (forceExpandAll && !didExpandRef.current) {
      // open everything
      setOpenItems(allKeysAndData.allKeys);
      setChildForceExpand(allKeysAndData.allKeys);
      didExpandRef.current = true;
    } else if (!forceExpandAll && didExpandRef.current) {
      // close everything
      setOpenItems([]);
      setChildForceExpand([]);
      didExpandRef.current = false;
    }
  }, [forceExpandAll, allKeysAndData.allKeys]);

  if (!isDict(value)) {
    return <p className="text-red-500">DictionaryView: Value is not a dictionary.</p>;
  }

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
    const subValues = allKeysAndData.allDicts.map((d) => (d && isDict(d) ? d[propKey] : undefined));
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
      baseLogIndex: allKeysAndData.allIndexes[0],
      comparisonLogsIndex: allKeysAndData.allIndexes.slice(1),
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
    return allKeysAndData.allKeys.map((propKey) => {
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