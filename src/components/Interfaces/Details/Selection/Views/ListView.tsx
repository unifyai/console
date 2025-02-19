"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  unifyType: merges baseVal + comparables to produce a single type.
  If multiple distinct types appear, fallback to "string."
───────────────────────────────────────────────────────────────────────────*/
function unifyType(baseVal: any, comps: any[]): string {
  const allVals: any[] = [];
  if (baseVal !== undefined) {
    allVals.push(baseVal);
  }
  comps.forEach((c) => {
    if (c !== undefined) {
      allVals.push(c);
    }
  });

  if (allVals.length === 0) {
    return "string";
  }

  const typeSet = new Set<string>();
  for (const val of allVals) {
    const t = getValueType(val);
    typeSet.add(t);
  }

  return typeSet.size === 1 ? Array.from(typeSet)[0] : "string";
}

/*───────────────────────────────────────────────────────────────────────────
  pickView => specialized sub-view. (No changes here, preserving original logic)
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
  toggleOneItemExpand => toggles just that item label expansion
───────────────────────────────────────────────────────────────────────────*/
function toggleOneItemExpand(
  label: string,
  openItems: string[],
  setOpenItems: React.Dispatch<React.SetStateAction<string[]>>,
  childForceExpand: string[],
  setChildForceExpand: React.Dispatch<React.SetStateAction<string[]>>
) {
  if (!childForceExpand.includes(label)) {
    setChildForceExpand((prev) => [...prev, label]);
  } else {
    setChildForceExpand((prev) => prev.filter((it) => it !== label));
  }
}

/*───────────────────────────────────────────────────────────────────────────
  ListView component
  - preserves expansions, icons, single vs. multi logic, etc.
  - now uses unifyType for each item
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
    displayMode = "markdown",
  } = props;

  // single vs multi
  const singleMode = !comparables || comparables.length === 0;

  // figure out how many items
  let itemCount = Array.isArray(value) ? value.length : 0;
  if (!singleMode && comparables) {
    const compLens = comparables.map((c) => (isList(c) ? c.length : 0));
    itemCount = Math.max(itemCount, ...compLens);
  }

  // Pre-build item labels
  const allItemLabels = useMemo(
    () => Array.from({ length: itemCount }, (_, i) => `Item ${i}`),
    [itemCount]
  );

  // For expansions
  const [openItems, setOpenItems] = useState<string[]>([]);
  const [childForceExpand, setChildForceExpand] = useState<string[]>([]);

  // guess item type => used only for default expansions
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

  // build default expansions
  const defaultOpenItems = useMemo(() => {
    return allItemLabels.filter((label, i) => {
      const t = guessItemType(i);
      return ["string", "number", "matrix", "image"].includes(t);
    });
  }, [allItemLabels]);

  // On mount, set default expansions
  useEffect(() => {
    setOpenItems(defaultOpenItems);
  }, [defaultOpenItems.join(",")]); // minimal re-run

  // If forceExpandAll changes, we open or close everything
  useEffect(() => {
    if (forceExpandAll) {
      setOpenItems(allItemLabels);
      setChildForceExpand(allItemLabels);
    } else {
      // revert to default
      setOpenItems(defaultOpenItems);
      setChildForceExpand(defaultOpenItems);
    }
  }, [forceExpandAll, allItemLabels, defaultOpenItems]);

  if (!isList(value)) {
    return <p className="text-red-500">ListView: Value is not a valid list.</p>;
  }

  /*───────────────────────────────────────────────────────────────────────────
    Single-mode => only base array
    Multi-mode => base array + comparables
  ───────────────────────────────────────────────────────────────────────────*/
  function renderSingleItem(index: number) {
    const label = `Item ${index}`;
    const arrValue = Array.isArray(value) ? value[index] : undefined;

    // unify => baseVal=arrValue, no comps
    const finalType = unifyType(arrValue, []);
    const icon = getTypeIcon(finalType);

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
      displayMode,
      forceExpandAll: isChildForceExpand,
    };

    return (
      <AccordionItem key={label} value={label}>
        <AccordionTrigger className="relative group flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            {icon} {label}
          </span>

          {isOpen && (finalType === "dict" || finalType === "list") && (
            <div className="absolute right-5 flex gap-1 items-center">
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
                {isChildForceExpand ? <FoldVertical size={16} /> : <UnfoldVertical size={16} />}
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

  function renderMultiItem(index: number) {
    const label = `Item ${index}`;
    const baseArr = Array.isArray(value) ? value : [];
    const baseVal = baseArr[index];
    // gather subVals => [baseVal, ...]
    const subVals = [baseVal];
    (comparables ?? []).forEach((c) => {
      if (isList(c)) {
        subVals.push(c[index]);
      } else {
        subVals.push(undefined);
      }
    });

    // unify => baseVal + comps
    const finalType = unifyType(subVals[0], subVals.slice(1));
    const icon = getTypeIcon(finalType);

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
      displayMode,
      forceExpandAll: isChildForceExpand,
    };

    return (
      <AccordionItem key={label} value={label}>
        <AccordionTrigger className="relative group flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            {icon} {label}
          </span>

          {isOpen && (finalType === "dict" || finalType === "list") && (
            <div className="absolute right-5 flex gap-1 items-center">
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
                {isChildForceExpand ? <FoldVertical size={16} /> : <UnfoldVertical size={16} />}
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
    const items: JSX.Element[] = [];
    for (let i = 0; i < itemCount; i++) {
      if (singleMode) {
        items.push(renderSingleItem(i));
      } else {
        items.push(renderMultiItem(i));
      }
    }
    return items;
  }

  return (
    <div className="flex flex-col gap-2">
      <Accordion
        key={`list-${forceExpandAll ? "open" : "closed"}`}
        type="multiple"
        value={openItems}
        onValueChange={setOpenItems}
      >
        {renderAllItems()}
      </Accordion>
    </div>
  );
};

export default ListView;