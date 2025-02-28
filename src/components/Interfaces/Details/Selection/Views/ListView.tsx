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
import { useExpandContextSelector } from "@/contexts/ExpandContext";

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
  let subPaths: string[];
  if (comparables && comparables.length > 0) {
    subPaths = gatherAllSubPathsMulti(baseValue, comparables, path, prefix, nestingLevel);
  } else {
    subPaths = gatherAllSubPaths(baseValue, path, prefix, nestingLevel);
  }
  const allOpen = subPaths.every((p) => openKeys.has(p));
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
  groupRowsByValue => groups values by their JSON representation for no-diff mode
────────────────────────────────────────────────────────────────────────────*/
function groupRowsByValue(rowValuePairs: { rowIndex: number; val: any }[]) {
  const map = new Map<string, { value: any; rows: number[] }>();
  
  rowValuePairs.forEach(({ rowIndex, val }) => {
    // Use a stable JSON representation as the key for grouping
    // Handle undefined/null values specially since they stringify differently
    let key;
    if (val === undefined) {
      key = "::undefined::";
    } else if (val === null) {
      key = "::null::";
    } else {
      try {
        key = JSON.stringify(val);
      } catch (e) {
        // If value can't be stringified (e.g., circular reference)
        // use a fallback representation
        key = `::object::${typeof val}::${Object.keys(val).sort().join(",")}`;
      }
    }

    if (!map.has(key)) {
      map.set(key, { value: val, rows: [] });
    }
    map.get(key)!.rows.push(rowIndex);
  });

  // Return an array of groups with sorted row indices
  return Array.from(map.values()).map((group) => ({
    value: group.value,
    rows: group.rows.sort((a, b) => a - b),
  }));
}

/*─────────────────────────────────────────────────────────────────────────
  renderNoDiffMode => render in no-diff mode with superset indices and grouped values
──────────────────────────────────────────────────────────────────────────*/
function renderNoDiffMode(
  itemCount: number,
  baseArr: any[],
  comparables: any[][],
  rowIndices: number[],
  openKeys: Set<string>,
  setOpenKeys: React.Dispatch<React.SetStateAction<Set<string>>>,
  buildItemPath: (i: number) => string,
  itemLabel: (i: number) => string,
  options: {
    baseLogIndex: number,
    comparisonLogsIndex: number[],
    version: string,
    comparableVersions: string[],
    diffMode: "none" | "lines" | "words" | "characters",
    splitView: boolean,
    displayMode: "text" | "markdown",
    nestingLevel: number,
    prefix: string,
    parentPath: string,
  }
) {
  const { 
    baseLogIndex, comparisonLogsIndex, version, comparableVersions, 
    diffMode, splitView, displayMode, nestingLevel, prefix, parentPath 
  } = options;
  
  // Build the open values array for the accordion
  const openValues: string[] = [];
  for (let i = 0; i < itemCount; i++) {
    const path = buildItemPath(i);
    if (openKeys.has(path)) {
      openValues.push(itemLabel(i));
    }
  }

  // Function to handle accordion value change
  function handleAccordionValueChange(newVals: string[]) {
    const oldSet = new Set(openValues);
    const nextSet = new Set(newVals);

    for (let i = 0; i < itemCount; i++) {
      const lbl = itemLabel(i);
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
    <Accordion
      type="multiple"
      value={openValues}
      onValueChange={handleAccordionValueChange}
    >
      {Array.from({ length: itemCount }, (_, i) => {
        // 1. Gather values for this index from all rows
        const rowValuePairs: { rowIndex: number, val: any }[] = [];
        
        // Add base value if it exists
        if (i < baseArr.length) {
          rowValuePairs.push({ rowIndex: rowIndices[0], val: baseArr[i] });
        }
        
        // Add comparable values if they exist
        comparables.forEach((compArr, j) => {
          if (compArr && i < compArr.length) {
            rowValuePairs.push({ rowIndex: rowIndices[j + 1], val: compArr[i] });
          }
        });
        
        // 2. Group identical values
        const groups = groupRowsByValue(rowValuePairs);
        
        // Collect all row indices for this index to show in the accordion trigger
        const allRowsForIndex = rowValuePairs.map(pair => pair.rowIndex).sort((a, b) => a - b);
        
        // 3. Create the path for this index
        const path = buildItemPath(i);
        const lbl = itemLabel(i);
        
        // 4. Determine type and icon for the item (using the first non-undefined value)
        const firstVal = rowValuePairs.find(p => p.val !== undefined)?.val;
        const itemType = getValueType(firstVal);
        const icon = getTypeIcon(itemType);
        
        // 5. Setup recursive toggle handler
        const isPathOpen = openKeys.has(path);
        function handleExpandClick(e: React.MouseEvent) {
          e.stopPropagation();
          // Find the first value that's a complex type
          const complexVal = rowValuePairs.find(p => {
            const v = p.val;
            return isDict(v) || isList(v);
          })?.val;
          
          if (complexVal) {
            // We'll use just this one value for gathering sub-paths
            // since we only need the structure, not the actual values
            handleRecursiveToggle(
              complexVal,
              [], // No comparables in this context
              path,
              prefix,
              nestingLevel,
              openKeys,
              setOpenKeys
            );
          }
        }
        
        return (
          <AccordionItem key={lbl} value={lbl}>
            <AccordionTrigger className="relative group flex items-center justify-between">
              <span className="inline-flex items-center gap-2">
                {icon} {lbl}
                {allRowsForIndex.length > 0 && (
                  <div className="ml-2 flex gap-1">
                    <RowBadge rowNumbers={allRowsForIndex} mode="none" />
                  </div>
                )}
              </span>
              {(itemType === "dict" || itemType === "list") && (
                <div className="absolute right-5 flex gap-1 items-center">
                  <ActionButton
                    variant="ghost"
                    size="icon"
                    tooltip={isPathOpen ? "Collapse All Children" : "Expand All Children"}
                    onClick={handleExpandClick}
                    icon={isPathOpen ? <FoldVertical size={16} /> : <UnfoldVertical size={16} />}
                  />
                </div>
              )}
            </AccordionTrigger>
            
            <AccordionContent>
              <div className="border-l ml-4 pl-1">
                {groups.map((group, idx) => (
                  <div key={idx} className="mb-2">
                    <RowBadge rowNumbers={group.rows} mode="none" />
                    <div className="mt-1">
                      {pickView({
                        value: group.value,
                        comparables: [], // No comparables since we're showing a single unified value
                        baseLogIndex: group.rows[0], // Use the first row as the base
                        comparisonLogsIndex: [], // No comparison indices
                        version,
                        comparableVersions,
                        diffMode,
                        splitView,
                        displayMode,
                        nestingLevel: nestingLevel + 1,
                        prefix,
                        parentPath: path,
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
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
  // Use context selectors to only subscribe to the parts of the context we need
  const openKeys = useExpandContextSelector(ctx => ctx.openKeys);
  const setOpenKeys = useExpandContextSelector(ctx => ctx.setOpenKeys);
  const forceExpandAll = useExpandContextSelector(ctx => ctx.forceExpandAll);
  const forceCollapseAll = useExpandContextSelector(ctx => ctx.forceCollapseAll);

  // Check if base is a valid list
  const isValidList = isList(value);
  
  // For multi-mode, check if any comparable is a valid list
  const multiMode = comparables && comparables.length > 0;
  const hasValidComparables = multiMode && comparables.some(comp => isList(comp));
  
  // In multi-mode, we can proceed if either the base or any comparable is a valid list
  const canProceed = isValidList || hasValidComparables;
  
  const baseArr = isValidList ? (Array.isArray(value) ? value : []) as any[] : [];

  // itemCount => max length among base & comps
  let itemCount = baseArr.length;
  if (canProceed && multiMode) {
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
    if (!canProceed || !parentPath) return; // if we don't have any valid lists or parent path, we can't proceed
    
    if (forceExpandAll || forceCollapseAll) {      
      const newSet = new Set(openKeys);
      
      // Choose the appropriate path gathering function based on mode
      let subPaths: string[];
      if (multiMode) {
        // In multi-mode, use gatherAllSubPathsMulti to include items from comparables
        subPaths = gatherAllSubPathsMulti(value, comparables || [], parentPath, prefix, nestingLevel);
      } else {
        // In single-mode, use the original method
        subPaths = gatherAllSubPaths(value, parentPath, prefix, nestingLevel);
      }

      if (forceExpandAll) {
        subPaths.forEach((sp) => newSet.add(sp));
      } else {
        subPaths.forEach((sp) => newSet.delete(sp));
      }
      setOpenKeys(newSet);
    }
  }, [forceExpandAll, forceCollapseAll, parentPath, prefix, nestingLevel, openKeys, value, multiMode, comparables, canProceed, setOpenKeys]);

  // We define "openValues" similarly to dictionary => which items are open
  const openValues = useMemo(() => {
    if (!canProceed) return [];
    
    const arr: string[] = [];
    for (let i = 0; i < itemCount; i++) {
      const path = buildItemPath(i);
      // We store the "AccordionItem value" as itemLabel(i).
      // If openKeys.has(path) => this means we want item i open => itemLabel(i).
      if (openKeys.has(path)) {
        arr.push(itemLabel(i));
      }
    }
    return arr;
  }, [itemCount, openKeys, canProceed, buildItemPath]);

  // Early return after all hooks are called
  if (!canProceed) {
    return <p className="text-red-500">
      {multiMode 
        ? "ListView: neither base nor comparables are valid lists." 
        : "ListView: base value is not a list."}
    </p>;
  }

  // Transform comparables into arrays for the no-diff mode
  const comparableArrays = multiMode 
    ? comparables.map(c => (isList(c) ? (c as any[]) : []))
    : [];

  // For no-diff rendering, we need rowIndices
  const rowIndices = [baseLogIndex, ...comparisonLogsIndex];

  // Define the renderSingleItem function for single-mode
  function renderSingleItem(index: number) {
    const lbl = itemLabel(index);
    const arrValue = baseArr[index];
    const finalType = unifyType(arrValue, []);
    const icon = getTypeIcon(finalType);
    const path = buildItemPath(index);
    const isOpen = openKeys.has(path);

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

  // Define the renderMultiItem function for multi-mode
  function renderMultiItem(index: number) {
    const lbl = itemLabel(index);
    const baseVal = baseArr[index];
    const compVals = (comparables ?? []).map((c) => (isList(c) ? c[index] : undefined));
    const finalType = unifyType(baseVal, compVals);
    const icon = getTypeIcon(finalType);

    const path = buildItemPath(index);
    const isOpen = forceExpandAll || openKeys.has(path);

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

  // Function to render all items
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

  // Handle accordion value change
  function handleAccordionValueChange(newVals: string[]) {
    const oldSet = new Set(openValues);
    const nextSet = new Set(newVals);

    for (let i = 0; i < itemCount; i++) {
      const lbl = itemLabel(i);
      const had = oldSet.has(lbl);
      const now = nextSet.has(lbl);
      if (had !== now) {
        const path = buildItemPath(i);
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

  // Return the appropriate view based on diffMode and multiMode
  return (
    <div className="flex flex-col gap-2">
      {diffMode === "none" && multiMode ? (
        // No-diff mode with multiple values
        renderNoDiffMode(
          itemCount,
          baseArr,
          comparableArrays,
          rowIndices,
          openKeys,
          setOpenKeys,
          buildItemPath,
          itemLabel,
          {
            baseLogIndex,
            comparisonLogsIndex,
            version,
            comparableVersions,
            diffMode: diffMode as "none",
            splitView,
            displayMode: displayMode as "text" | "markdown",
            nestingLevel,
            prefix,
            parentPath,
          }
        )
      ) : (
        <Accordion
          type="multiple"
          value={openValues}
          onValueChange={handleAccordionValueChange}
        >
          {renderAllItems()}
        </Accordion>
      )}
    </div>
  );
}