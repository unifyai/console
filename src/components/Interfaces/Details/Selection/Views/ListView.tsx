"use client";

import React, { useMemo, useEffect } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/UI/accordion";
import { Button } from "@/components/UI/button";
import { FoldVertical, UnfoldVertical } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";

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
import {
  gatherAllSubPaths,
  gatherAllSubPathsMulti,
  makePrefixedListPath,
  sanitizePropertyKey,
} from "@/utils/evals/pathUtils";
import { useExpandContext } from "@/contexts/ExpandContext";

import { LogComparisonProps } from "./types";
import { getValueType, getTypeIcon } from "./ViewTypes";
import RowBadge from "./RowBadge";

// Subcomponents (similar to dictionary)
import TraceView from "./TraceView";
import ChatView from "./ChatView";
import DictionaryView from "./DictionaryView";
import ImageView from "./ImageView";
import MatrixView from "./MatrixView";
import StringView from "./StringView";
import NumberView from "./NumberView";
import TimestampView from "./TimestampView";

/*────────────────────────────────────────────────────────────────────────────
  unifyType => merges base + comps => single type. If multiple distinct => "string."
────────────────────────────────────────────────────────────────────────────*/
function unifyType(baseVal: any, comps: any[]): string {
  const filtered = [baseVal, ...comps].filter((v) => {
    if (v === null || v === undefined) return false;
    if (typeof v === "string" && v.trim().length === 0) return false;
    return true;
  });
  if (!filtered.length) return "string";

  const typeSet = new Set<string>();
  for (const val of filtered) {
    typeSet.add(getValueType(val));
  }
  return typeSet.size === 1 ? Array.from(typeSet)[0] : "string";
}

/*────────────────────────────────────────────────────────────────────────────
  pickView => specialized child rendering
────────────────────────────────────────────────────────────────────────────*/
function pickView(props: LogComparisonProps & { prefix?: string; parentPath?: string; nestingLevel?: number }) {
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
  presenceDiff => highlight inserted/deleted items in multi-mode
────────────────────────────────────────────────────────────────────────────*/
function presenceDiff(
  baseVal: any,
  compVals: any[],
  baseRowIndex: number,
  compRowIndices: number[]
) {
  const baseHas = baseVal !== undefined;
  const redSet = new Set<number>();
  const greenSet = new Set<number>();

  compVals.forEach((val, i) => {
    const row = compRowIndices[i];
    const cHas = val !== undefined;
    if (baseHas && !cHas) {
      redSet.add(row);
    } else if (!baseHas && cHas) {
      greenSet.add(row);
    }
  });

  return {
    redRows: Array.from(redSet).sort((a, b) => a - b),
    greenRows: Array.from(greenSet).sort((a, b) => a - b),
  };
}

/*────────────────────────────────────────────────────────────────────────────
  handleRecursiveToggle => expand/collapse entire sublist recursively
────────────────────────────────────────────────────────────────────────────*/
function handleRecursiveToggle(
  baseValue: unknown,
  comparables: unknown[],
  path: string,
  prefix: string,
  nestingLevel: number,
  openKeys: Set<string>,
  setOpenKeys: React.Dispatch<React.SetStateAction<Set<string>>>
) {
  console.log(`[ListView:handleRecursiveToggle] path=${path}, prefix=${prefix}, level=${nestingLevel}`, {
    baseValue,
    openKeysCount: openKeys.size
  });

  let subPaths: string[];
  if (comparables && comparables.length > 0) {
    subPaths = gatherAllSubPathsMulti(baseValue, comparables, path, prefix, nestingLevel);
  } else {
    subPaths = gatherAllSubPaths(baseValue, path, prefix, nestingLevel);
  }
  console.log(`[ListView:handleRecursiveToggle] subPaths gathered:`, subPaths);

  const allOpen = subPaths.every((p) => openKeys.has(p));
  console.log(`[ListView:handleRecursiveToggle] allOpen=${allOpen}`);

  setOpenKeys((prev) => {
    const next = new Set(prev);
    if (allOpen) {
      subPaths.forEach((sp) => next.delete(sp));
    } else {
      subPaths.forEach((sp) => next.add(sp));
    }
    return next;
  });
}

/*────────────────────────────────────────────────────────────────────────────
  "ListView" main component
────────────────────────────────────────────────────────────────────────────*/
interface ListViewProps extends LogComparisonProps {
  prefix?: string;
  parentPath?: string;    // parent's fully qualified path
  nestingLevel?: number;
}

export default function ListView({
  value,
  comparables,
  baseLogIndex,
  comparisonLogsIndex,
  version = "",
  comparableVersions = [],
  diffMode = "none",
  splitView = false,
  displayMode = "markdown",
  nestingLevel = 0,
  prefix = "entries",
  parentPath = "",
}: ListViewProps) {
  const { openKeys, setOpenKeys, forceExpandAll, forceCollapseAll } = useExpandContext();

  // Check if value is a list but don't return early
  const isValidList = isList(value);
  
  // Only log if we have a valid list
  if (isValidList) {
    console.log(`[ListView:render] prefix=${prefix}, parentPath=${parentPath}, nesting=${nestingLevel}`, {
      length: value.length,
      openKeysCount: openKeys.size,
      forceExpandAll,
      forceCollapseAll,
    });
  }

  // Single vs multi
  const multiMode = comparables && comparables.length > 0;
  const baseArr = isValidList ? (Array.isArray(value) ? value : []) as any[] : [];

  // itemCount => max length among base & comps
  let itemCount = baseArr.length;
  if (isValidList && multiMode) {
    const compLens = (comparables ?? []).map((c) => (isList(c) ? c.length : 0));
    itemCount = Math.max(itemCount, ...compLens);
  }

  // Define buildItemPath function before using it in hooks
  function buildItemPath(i: number) {
    if (parentPath) {
      return parentPath + "." + i;
    } else {
      return makePrefixedListPath(prefix, nestingLevel, i);
    }
  }

  // function to label => "Item 0"
  function itemLabel(i: number) {
    return `Item ${i}`;
  }

  // On mount or if forceExpandAll/forceCollapseAll changes => expand/collapse all
  // Always call useEffect but conditionally execute its body
  useEffect(() => {
    if (!isValidList || !parentPath) return; // if we have no valid list or parent path, we can't proceed
    
    if (forceExpandAll || forceCollapseAll) {
      console.log(`[ListView:useEffect(forceExpand|collapseAll)] Starting global expand/collapse`, {
        parentPath,
        multiMode,
        value,
        comparables,
        valueLength: Array.isArray(value) ? value.length : 0,
        hasComparables: comparables && comparables.length > 0
      });
      
      const newSet = new Set(openKeys);
      
      // Choose the appropriate path gathering function based on mode
      let subPaths: string[];
      if (multiMode) {
        // In multi-mode, use gatherAllSubPathsMulti to include items from comparables
        subPaths = gatherAllSubPathsMulti(value, comparables || [], parentPath, prefix, nestingLevel);
        console.log(`[ListView:useEffect] Using multi-mode path gathering`, {
          parentPath, 
          subPathCount: subPaths.length,
          compareCount: comparables ? comparables.length : 0
        });
      } else {
        // In single-mode, use the original method
        subPaths = gatherAllSubPaths(value, parentPath, prefix, nestingLevel);
        console.log(`[ListView:useEffect] Using single-mode path gathering`, {
          parentPath,
          subPathCount: subPaths.length
        });
      }
      
      console.log(`[ListView:useEffect(forceExpand|collapseAll)] parentPath=${parentPath}`, {
        subPathsCount: subPaths.length,
        subPaths,
        forceExpandAll,
        forceCollapseAll,
        multiMode
      });

      if (forceExpandAll) {
        subPaths.forEach((sp) => newSet.add(sp));
      } else {
        subPaths.forEach((sp) => newSet.delete(sp));
      }
      setOpenKeys(newSet);
    }
  }, [forceExpandAll, forceCollapseAll, parentPath, prefix, nestingLevel, openKeys, value, multiMode, comparables, isValidList, setOpenKeys]);

  // We define "openValues" similarly to dictionary => which items are open
  const openValues = useMemo(() => {
    if (!isValidList) return [];
    
    const arr: string[] = [];
    for (let i = 0; i < itemCount; i++) {
      const path = buildItemPath(i);
      // We store the "AccordionItem value" as itemLabel(i).
      // If openKeys.has(path) => this means we want item i open => itemLabel(i).
      if (openKeys.has(path)) {
        arr.push(itemLabel(i));
      }
    }
    console.log(`[ListView:openValues] computed:`, arr);
    return arr;
  }, [itemCount, openKeys, isValidList, buildItemPath, itemLabel]);

  // Early return after all hooks are called
  if (!isValidList) {
    return <p className="text-red-500">ListView: base value is not a list.</p>;
  }

  // onValueChange => compare old vs. new => toggle difference
  function handleValueChange(newVals: string[]) {
    const oldSet = new Set(openValues);
    const nextSet = new Set(newVals);

    // find changed => for each changed => toggleKey( buildItemPath(...) )
    for (let i = 0; i < itemCount; i++) {
      const lbl = itemLabel(i);
      const had = oldSet.has(lbl);
      const now = nextSet.has(lbl);
      if (had !== now) {
        const path = buildItemPath(i);
        // toggle
        if (openKeys.has(path)) {
          // remove
          setOpenKeys((prev) => {
            const updated = new Set(prev);
            updated.delete(path);
            return updated;
          });
        } else {
          // add
          setOpenKeys((prev) => {
            const updated = new Set(prev);
            updated.add(path);
            return updated;
          });
        }
      }
    }
  }

  /*─────────────────────────────────────────────────────────────────────────
    renderSingleItem => for single-mode
  ──────────────────────────────────────────────────────────────────────────*/
  function renderSingleItem(index: number) {
    const lbl = itemLabel(index);
    const arrValue = baseArr[index];
    const finalType = unifyType(arrValue, []);
    const icon = getTypeIcon(finalType);
    const path = buildItemPath(index);
    const isOpen = openKeys.has(path);

    // If it's isDict/isList => show FoldVertical button
    function handleExpandClick(e: React.MouseEvent) {
      e.stopPropagation();
      handleRecursiveToggle(
        arrValue,
        [],
        path,
        prefix,
        nestingLevel,
        openKeys,
        setOpenKeys
      );
    }

    return (
      <AccordionItem key={lbl} value={lbl}>
        <AccordionTrigger className="relative group flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            {icon} {lbl}
          </span>
          {isOpen && (finalType === "dict" || finalType === "list") && (
            <div className="absolute right-5 flex gap-1 items-center">
              <ActionButton
                variant="ghost"
                size="icon"
                tooltip={isOpen ? "Collapse All Children" : "Expand All Children"}
                onClick={handleExpandClick}
                icon={isOpen ? <FoldVertical size={16} /> : <UnfoldVertical size={16} />}
              />
            </div>
          )}
        </AccordionTrigger>
        <AccordionContent>
          <div className="border-l ml-4 pl-1">
            {pickView({
              value: arrValue,
              comparables: [],
              baseLogIndex,
              comparisonLogsIndex: [],
              diffMode,
              splitView,
              version,
              comparableVersions,
              displayMode,
              prefix,
              parentPath: path,
              nestingLevel: nestingLevel + 1,
            })}
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  }

  /*─────────────────────────────────────────────────────────────────────────
    renderMultiItem => presence diff in multi-mode
  ──────────────────────────────────────────────────────────────────────────*/
  function renderMultiItem(index: number) {
    const lbl = itemLabel(index);
    const baseVal = baseArr[index];
    const compVals = (comparables ?? []).map((c) => (isList(c) ? c[index] : undefined));
    const finalType = unifyType(baseVal, compVals);
    const icon = getTypeIcon(finalType);

    const path = buildItemPath(index);
    const isOpen = forceExpandAll || openKeys.has(path);

    // presence diff
    const { redRows, greenRows } = presenceDiff(baseVal, compVals, baseLogIndex, comparisonLogsIndex);
    let labelColor = "";
    const baseHas = baseVal !== undefined;
    if (baseHas && redRows.length > 0) {
      labelColor = "text-red-600";
    } else if (!baseHas && greenRows.length > 0) {
      labelColor = "text-green-600";
    }

    function handleExpandClick(e: React.MouseEvent) {
      e.stopPropagation();
      handleRecursiveToggle(
        baseVal,
        compVals,
        path,
        prefix,
        nestingLevel,
        openKeys,
        setOpenKeys
      );
    }

    return (
      <AccordionItem key={lbl} value={lbl}>
        <AccordionTrigger
          className={`relative group flex items-center justify-between ${labelColor}`}
        >
          <span className="inline-flex items-center gap-2">
            {icon} {lbl}
            {(redRows.length > 0 || greenRows.length > 0) && (
              <div className="ml-2 flex gap-1">
                {redRows.length > 0 && <RowBadge rowNumbers={redRows} mode="delete" />}
                {greenRows.length > 0 && <RowBadge rowNumbers={greenRows} mode="insert" />}
              </div>
            )}
          </span>
          {isOpen && (finalType === "dict" || finalType === "list") && (
            <div className="absolute right-5 flex gap-1 items-center">
              <ActionButton
                variant="ghost"
                size="icon"
                tooltip={isOpen ? "Collapse All Children" : "Expand All Children"}
                onClick={handleExpandClick}
                icon={isOpen ? <FoldVertical size={16} /> : <UnfoldVertical size={16} />}
              />
            </div>
          )}
        </AccordionTrigger>
        <AccordionContent>
          <div className="border-l ml-4 pl-1">
            {pickView({
              value: baseVal,
              comparables: compVals,
              baseLogIndex,
              comparisonLogsIndex,
              diffMode,
              splitView,
              version,
              comparableVersions,
              displayMode,
              prefix,
              parentPath: path,
              nestingLevel: nestingLevel + 1,
            })}
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  }

  // Actually render all items
  function renderAllItems() {
    const items: JSX.Element[] = [];
    for (let i = 0; i < itemCount; i++) {
      if (!comparables || !comparables.length) {
        items.push(renderSingleItem(i));
      } else {
        items.push(renderMultiItem(i));
      }
    }
    return items;
  }

  function handleAccordionValueChange(newVals: string[]) {
    const oldSet = new Set(openValues);
    const nextSet = new Set(newVals);

    for (let i = 0; i < itemCount; i++) {
      const lbl = `Item ${i}`;
      const had = oldSet.has(lbl);
      const now = nextSet.has(lbl);
      if (had !== now) {
        const path = buildItemPath(i);
        // toggle
        if (openKeys.has(path)) {
          setOpenKeys((prev) => {
            const updated = new Set(prev);
            updated.delete(path);
            return updated;
          });
        } else {
          setOpenKeys((prev) => {
            const updated = new Set(prev);
            updated.add(path);
            return updated;
          });
        }
      }
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Accordion
        type="multiple"
        value={openValues}
        onValueChange={handleAccordionValueChange}
      >
        {renderAllItems()}
      </Accordion>
    </div>
  );
}