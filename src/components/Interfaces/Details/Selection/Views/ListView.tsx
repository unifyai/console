"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/UI/accordion";

import {
  isList,
  isDict,
  isMatrix,
  isImage,
  isTrace,
  isNumber,
  isTimestamp,
  isChat,
} from "@/utils/evals/selection";

import DictionaryView from "./DictionaryView";
import ImageView from "./ImageView";
import MatrixView from "./MatrixView";
import StringView from "./StringView";
import TraceView from "./TraceView";
import NumberView from "./NumberView";
import TimestampView from "./TimestampView";
import ChatView from "./ChatView";

import { LogComparisonProps } from "./types";
import { getValueType, getTypeIcon } from "./ViewTypes";

import { Button } from "@/components/UI/button";
import { FoldVertical, UnfoldVertical } from "lucide-react";

/*───────────────────────────────────────────────────────────────────────────
  pickView => specialized or raw, with optional forceExpandAll for child expansions
───────────────────────────────────────────────────────────────────────────*/
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

/*───────────────────────────────────────────────────────────────────────────
  toggleOneItemExpand => toggles just that item label
───────────────────────────────────────────────────────────────────────────*/
function toggleOneItemExpand(
  label: string,
  openItems: string[],
  setOpenItems: React.Dispatch<React.SetStateAction<string[]>>,
  childForceExpand: string[],
  setChildForceExpand: React.Dispatch<React.SetStateAction<string[]>>,
) {
  const isOpen = openItems.includes(label);
  if (!isOpen) {
    // expand
    setOpenItems((prev) => [...prev, label]);
    setChildForceExpand((prev) => [...prev, label]);
  } else {
    // collapse
    setOpenItems((prev) => prev.filter((it) => it !== label));
    setChildForceExpand((prev) => prev.filter((it) => it !== label));
  }
}

/*───────────────────────────────────────────────────────────────────────────
  The main ListView:
   - Force expand/collapse all once per session using didExpandRef
   - Per-item toggles only affect that item, not siblings
───────────────────────────────────────────────────────────────────────────*/
type ListViewProps = LogComparisonProps & {
  forceExpandAll?: boolean;
};

const ListView: React.FC<ListViewProps> = (props) => {
  const {
    value,
    comparables,
    baseLogIndex,
    comparisonLogsIndex,
    version = "",
    comparableVersions = [],
    diffMode = "none",
    splitView = false,
    forceExpandAll = false,
  } = props;

  if (!isList(value)) {
    return (
      <p className="text-red-500">ListView: Value is not a valid list.</p>
    );
  }

  // single vs multi
  const singleMode = !comparables || comparables.length === 0;

  // figure out how many items
  let itemCount = Array.isArray(value) ? value.length : 0;
  if (!singleMode && comparables) {
    const compLens = comparables.map((c) => (isList(c) ? c.length : 0));
    itemCount = Math.max(itemCount, ...compLens);
  }

  // label them "Item <i>"
  const allItemLabels = useMemo(() => {
    return Array.from({ length: itemCount }, (_, i) => `Item ${i}`);
  }, [itemCount]);

  // guess item type => default expansions
  function guessItemType(index: number): string {
    let sample: any = Array.isArray(value) ? value[index] : undefined;
    if (sample === undefined && !singleMode && comparables) {
      for (const c of comparables) {
        if (isList(c) && c[index] !== undefined) {
          sample = c[index];
          break;
        }
      }
    }
    return getValueType(sample);
  }

  // default open items => string/number/matrix/image
  const defaultOpenItems = useMemo(() => {
    return allItemLabels.filter((lbl, i) => {
      const t = guessItemType(i);
      return ["string", "number", "matrix", "image"].includes(t);
    });
  }, [allItemLabels, value, comparables]);

  // local open items
  const [openItems, setOpenItems] = useState(defaultOpenItems);

  // track forced expansions for child items
  const [childForceExpand, setChildForceExpand] = useState<string[]>([]);

  // symmetrical expand/collapse all 
  const didExpandRef = useRef(false);
  useEffect(() => {
    if (forceExpandAll && !didExpandRef.current) {
      // expand all once
      setOpenItems(allItemLabels);
      setChildForceExpand(allItemLabels);
      didExpandRef.current = true;
    } else if (!forceExpandAll && didExpandRef.current) {
      // collapse all once
      setOpenItems([]);
      setChildForceExpand([]);
      didExpandRef.current = false;
    }
  }, [forceExpandAll, allItemLabels]);

  // single-mode item
  function renderSingleItem(index: number) {
    const label = `Item ${index}`;
    const arrValue = Array.isArray(value) ? value[index] : undefined;
    const typ = getValueType(arrValue);
    const icon = getTypeIcon(typ);
    const isOpen = openItems.includes(label);
    const isChildForceExpand = childForceExpand.includes(label);

    const childProps: LogComparisonProps & { forceExpandAll?: boolean } = {
      value: arrValue,
      comparables: [],
      baseLogIndex,
      comparisonLogsIndex: [],
      diffMode,
      splitView,
      version,
      comparableVersions,
      forceExpandAll: isChildForceExpand,
    };

    return (
      <AccordionItem key={label} value={label}>
        <AccordionTrigger className="relative group flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            {icon} {label}
          </span>

          {(typ === "dict" || typ === "list") && (
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
                  toggleOneItemExpand(
                    label,
                    openItems,
                    setOpenItems,
                    childForceExpand,
                    setChildForceExpand
                  );
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

  // multi-mode item
  function renderMultiItem(index: number) {
    const label = `Item ${index}`;
    const baseArr = Array.isArray(value) ? value : [];
    const itemVal = baseArr[index];
    const subVals = [itemVal];
    (comparables ?? []).forEach((c) => {
      if (isList(c)) subVals.push(c[index]);
      else subVals.push(undefined);
    });

    let sample = subVals[0];
    if (sample === undefined) {
      sample = subVals.find((v) => v !== undefined);
    }
    const typ = getValueType(sample);
    const icon = getTypeIcon(typ);

    const isOpen = openItems.includes(label);
    const isChildForceExpand = childForceExpand.includes(label);

    const childProps: LogComparisonProps & { forceExpandAll?: boolean } = {
      value: subVals[0],
      comparables: subVals.slice(1),
      baseLogIndex,
      comparisonLogsIndex,
      diffMode,
      splitView,
      version,
      comparableVersions,
      forceExpandAll: isChildForceExpand,
    };

    return (
      <AccordionItem key={label} value={label}>
        <AccordionTrigger className="relative group flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            {icon} {label}
          </span>

          {(typ === "dict" || typ === "list") && (
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
                  toggleOneItemExpand(
                    label,
                    openItems,
                    setOpenItems,
                    childForceExpand,
                    setChildForceExpand
                  );
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

  function renderAllItems() {
    const out: JSX.Element[] = [];
    for (let i = 0; i < itemCount; i++) {
      if (singleMode) out.push(renderSingleItem(i));
      else out.push(renderMultiItem(i));
    }
    return out;
  }

  return (
    <div className="flex flex-col gap-2">
      <Accordion type="multiple" value={openItems} onValueChange={setOpenItems}>
        {renderAllItems()}
      </Accordion>
    </div>
  );
};

export default ListView;