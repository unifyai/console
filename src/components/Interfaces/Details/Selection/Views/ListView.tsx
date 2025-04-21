"use client";

import React, { useMemo, useEffect, useCallback, useRef, useState } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/UI/accordion";
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
  isPdf,
} from "@/utils/evals/selection";
import {
  gatherAllSubPaths,
  gatherAllSubPathsMulti,
  makePrefixedListPath,
  sanitizePropertyKey,
} from "@/utils/evals/pathUtils";
import { usePanelExpandContextSelector } from "@/components/Interfaces/Details/Selection/SelectionPanel";
import { getIndentClasses, getContentIndentClasses, getSeparatorClasses } from "./useIndentation";
import { useTraceExpandContextSelector } from "./TraceView/TraceExpandContext";

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
import PdfView from "./PdfView";

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
function pickView(props: LogComparisonProps & { prefix?: string; parentPath?: string; nestingLevel?: number; viewTracesAsDict?: boolean }) {
  const { value, viewTracesAsDict } = props;

  // Handle trace rendering based on viewTracesAsDict flag
  if (isTrace(value) && !viewTracesAsDict) {
    return <TraceView {...props} />;
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
  if (isPdf(value)) {
    return <PdfView {...props} />;
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
    
    // Only mark as red/green if one has a value and the other doesn't
    // This prevents arrays with different content from being marked as deleted/inserted
    if (baseHas && !cHas) {
      redSet.add(row);
    } else if (!baseHas && cHas) {
      greenSet.add(row);
    }
    // Otherwise it's just a different value, which should be diffed not marked as deleted/inserted
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
  e: React.MouseEvent, 
  path: string, 
  value: any, 
  comparables: any[], 
  prefix: string, 
  nestingLevel: number,
  expandRecursively: (paths: string[]) => void,
  collapseRecursively: (paths: string[]) => void,
  openKeys: Set<string>
) {
  e.stopPropagation();
  
  // Always recompute subPaths to ensure we have the latest
  let subPaths: string[];
  if (comparables && comparables.length > 0) {
    subPaths = gatherAllSubPathsMulti(value, comparables, path, prefix, nestingLevel);
  } else {
    subPaths = gatherAllSubPaths(value, path, prefix, nestingLevel);
  }
  
  // Skip if no paths to process
  if (subPaths.length === 0) return;
  
  // Check if all subpaths are in openKeys => allOpen
  // This matches SelectionEntry's approach
  const currentlyAllOpen = subPaths.every((p) => openKeys.has(p));
  
  if (currentlyAllOpen) {
    // collapse - call collapseRecursively
    // When collapsing, exclude the parent path to keep it open
    const childPaths = subPaths.filter(subpath => subpath !== path);
    collapseRecursively(childPaths);
  } else {
    // expand - call expandRecursively
    expandRecursively(subPaths);
  }
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
    expandRecursively: (paths: string[]) => void,
    collapseRecursively: (paths: string[]) => void,
    viewTracesAsDict?: boolean,
  }
) {
  const { 
    baseLogIndex, comparisonLogsIndex, version, comparableVersions, 
    diffMode, splitView, displayMode, nestingLevel, prefix, parentPath, viewTracesAsDict,
    expandRecursively, collapseRecursively
  } = options;
  
  // Get indentation classes based on nesting level
  const indentClass = getIndentClasses(nestingLevel);
  // Always use content indent for children
  const contentIndentClass = getContentIndentClasses(nestingLevel);
  
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
        const baseVal = i < baseArr.length ? baseArr[i] : undefined;
        if (baseVal !== undefined) {
          rowValuePairs.push({ rowIndex: rowIndices[0], val: baseVal });
        }
        
        // Create array of comparable values
        const compVals: any[] = [];
        const compRowIndices: number[] = [];
        
        // Add comparable values if they exist
        comparables.forEach((compArr, j) => {
          if (compArr && i < compArr.length) {
            const compVal = compArr[i];
            compVals.push(compVal);
            compRowIndices.push(rowIndices[j + 1]);
            if (compVal !== undefined) {
              rowValuePairs.push({ rowIndex: rowIndices[j + 1], val: compVal });
            }
          }
        });
        
        // Calculate presence differences for red/green badges (matching Dictionary View)
        const presenceInfo = presenceDiff(
          baseVal,
          compVals,
          baseLogIndex,
          compRowIndices
        );
        
        // 2. Group identical values
        const groups = groupRowsByValue(rowValuePairs);
        
        // Collect all row indices for this index to show in the accordion trigger
        const allRowsForIndex = rowValuePairs.map(pair => pair.rowIndex).sort((a, b) => a - b);
        
        // 3. Create the path for this index
        const path = buildItemPath(i);
        const lbl = itemLabel(i);
        
        // 4. Determine type and icon for the item using unifyType (matching Dictionary View)
        const itemType = unifyType(baseVal, compVals);
        const icon = getTypeIcon(itemType);
        
        // Calculate all subpaths for this item to determine if all are open
        let itemSubPaths: string[] = [];
        
        // Only gather subpaths for dict or list types
        if (itemType === "dict" || itemType === "list") {
          // Add the path itself
          itemSubPaths.push(path);
          
          // Add all nested paths
          if (compVals && compVals.length > 0) {
            const nestedPaths = gatherAllSubPathsMulti(baseVal, compVals, path, prefix, nestingLevel);
            itemSubPaths.push(...nestedPaths);
          } else {
            const nestedPaths = gatherAllSubPaths(baseVal, path, prefix, nestingLevel);
            itemSubPaths.push(...nestedPaths);
          }
        }
        
        // Determine if all subpaths are open (not just the path itself)
        const isPathOpen = itemSubPaths.length > 0 && 
                          itemSubPaths.every(subpath => openKeys.has(subpath));
        
        // Get separator classes for this item
        const separatorClasses = getSeparatorClasses(i, itemCount);
        
        // Skip empty entries
        if (rowValuePairs.length === 0) {
          return null;
        }
        
        if (rowValuePairs.length === 1) {
          return (
            <AccordionItem key={lbl} value={lbl} className={separatorClasses}>
              <AccordionTrigger className="relative group flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  {icon} {lbl}
                  <div className="ml-2 flex gap-1 items-center">
                    {/* Show presence diff badges in no-diff mode (matching Dictionary View) */}
                    {(() => {
                      // Only show neutral badge if it contains rows not covered by red/green badges
                      const redGreenRows = new Set([...presenceInfo.redRows, ...presenceInfo.greenRows]);
                      const uniqueNeutralRows = allRowsForIndex.filter(row => !redGreenRows.has(row));
                      
                      return uniqueNeutralRows.length > 0 ? 
                        <RowBadge rowNumbers={uniqueNeutralRows} mode="none" /> : 
                        null;
                    })()}
                    {presenceInfo.redRows.length > 0 && <RowBadge rowNumbers={presenceInfo.redRows} mode="delete" />}
                    {presenceInfo.greenRows.length > 0 && <RowBadge rowNumbers={presenceInfo.greenRows} mode="insert" />}
                  </div>
                </span>
                {(itemType === "dict" || itemType === "list") && (
                  <div className="absolute right-5 flex gap-1 items-center">
                    <ActionButton
                      variant="ghost"
                      size="icon"
                      tooltip={isPathOpen ? "Collapse all children" : "Expand all children"}
                      onClick={(e) => handleRecursiveToggle(
                        e,
                        path,
                        baseVal,
                        compVals,
                        prefix,
                        nestingLevel,
                        expandRecursively,
                        collapseRecursively,
                        openKeys
                      )}
                      icon={isPathOpen ? <FoldVertical size={16} /> : <UnfoldVertical size={16} />}
                    />
                  </div>
                )}
              </AccordionTrigger>
              
              <AccordionContent>
                <div className={contentIndentClass}>
                  {pickView({
                    value: rowValuePairs[0].val,
                    comparables: [],
                    baseLogIndex: rowValuePairs[0].rowIndex,
                    comparisonLogsIndex: [],
                    version,
                    comparableVersions,
                    diffMode,
                    splitView,
                    displayMode,
                    nestingLevel: nestingLevel + 1,
                    prefix,
                    parentPath: path,
                    viewTracesAsDict,
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        }
        
        return (
          <AccordionItem key={lbl} value={lbl} className={separatorClasses}>
            <AccordionTrigger className="relative group flex items-center justify-between">
              <span className="inline-flex items-center gap-2">
                {icon} {lbl}
                <div className="ml-2 flex gap-1 items-center">
                  {/* Show presence diff badges in no-diff mode (matching Dictionary View) */}
                  {(() => {
                    // Only show neutral badge if it contains rows not covered by red/green badges
                    const redGreenRows = new Set([...presenceInfo.redRows, ...presenceInfo.greenRows]);
                    const uniqueNeutralRows = allRowsForIndex.filter(row => !redGreenRows.has(row));
                    
                    return uniqueNeutralRows.length > 0 ? 
                      <RowBadge rowNumbers={uniqueNeutralRows} mode="none" /> : 
                      null;
                  })()}
                  {presenceInfo.redRows.length > 0 && <RowBadge rowNumbers={presenceInfo.redRows} mode="delete" />}
                  {presenceInfo.greenRows.length > 0 && <RowBadge rowNumbers={presenceInfo.greenRows} mode="insert" />}
                </div>
              </span>
              {(itemType === "dict" || itemType === "list") && (
                <div className="absolute right-5 flex gap-1 items-center">
                  <ActionButton
                    variant="ghost"
                    size="icon"
                    tooltip={isPathOpen ? "Collapse all children" : "Expand all children"}
                    onClick={(e) => handleRecursiveToggle(
                      e,
                      path,
                      baseVal,
                      compVals,
                      prefix,
                      nestingLevel,
                      expandRecursively,
                      collapseRecursively,
                      openKeys
                    )}
                    icon={isPathOpen ? <FoldVertical size={16} /> : <UnfoldVertical size={16} />}
                  />
                </div>
              )}
            </AccordionTrigger>
            
            <AccordionContent>
              <div className={contentIndentClass}>
                {groups.map((group, idx) => (
                  <div key={idx} className={getSeparatorClasses(idx, groups.length)}>
                    {group.rows.length > 1 && <RowBadge rowNumbers={group.rows} mode="none" />}
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
                        viewTracesAsDict,
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

/*─────────────────────────────────────────────────────────────────────────
  renderDiffMode => render in diff mode (lines, words, characters) with specialized diff handling
──────────────────────────────────────────────────────────────────────────*/
function renderDiffMode(
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
    expandRecursively: (paths: string[]) => void,
    collapseRecursively: (paths: string[]) => void,
    viewTracesAsDict?: boolean,
  }
) {
  const { 
    baseLogIndex, comparisonLogsIndex, version, comparableVersions, 
    diffMode, splitView, displayMode, nestingLevel, prefix, parentPath, viewTracesAsDict,
    expandRecursively, collapseRecursively
  } = options;
  
  // Get indentation classes based on nesting level
  const indentClass = getIndentClasses(nestingLevel);
  // Always use content indent for children
  const contentIndentClass = getContentIndentClasses(nestingLevel);
  
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
        // 1. Get base value and comparable values at this index
        const baseVal = i < baseArr.length ? baseArr[i] : undefined;
        
        // Create array of comparable values, preserving their row indices
        const compVals: { val: any; rowIndex: number }[] = [];
        comparables.forEach((compArr, idx) => {
          if (compArr && i < compArr.length) {
            compVals.push({ val: compArr[i], rowIndex: comparisonLogsIndex[idx] });
          }
        });
        
        // Skip if no values found
        if (baseVal === undefined && compVals.length === 0) {
          return null;
        }
        
        // 2. Determine type based on available values, using unifyType for consistency with DictionaryView
        const allVals = [baseVal, ...compVals.map(cv => cv.val)].filter(v => v !== undefined);
        const itemType = unifyType(baseVal, compVals.map(cv => cv.val));
        const icon = getTypeIcon(itemType);
        
        // 3. Prepare presence info for row badges
        const basePresent = baseVal !== undefined;
        
        // 4. Create the path for this index
        const path = buildItemPath(i);
        const lbl = itemLabel(i);
        
        // 5. Collect all row indices for this index to show in the accordion trigger
        const baseRows = basePresent ? [baseLogIndex] : [];
        const compRows = compVals.map(cv => cv.rowIndex);
        const allRowsForIndex = [...baseRows, ...compRows].sort((a, b) => a - b);
        
        // 6. Setup recursive toggle handler
        // Calculate all subpaths for this item to determine if all are open
        let itemSubPaths: string[] = [];
        
        // Only gather subpaths for dict or list types
        if (itemType === "dict" || itemType === "list") {
          // Add the path itself
          itemSubPaths.push(path);
          
          // Add all nested paths
          if (compVals.length > 0) {
            const nestedPaths = gatherAllSubPathsMulti(baseVal, compVals.map(cv => cv.val), path, prefix, nestingLevel);
            itemSubPaths.push(...nestedPaths);
          } else {
            const nestedPaths = gatherAllSubPaths(baseVal, path, prefix, nestingLevel);
            itemSubPaths.push(...nestedPaths);
          }
        }
        
        // Determine if all subpaths are open (not just the path itself)
        const isPathOpen = itemSubPaths.length > 0 && 
                          itemSubPaths.every(subpath => openKeys.has(subpath));
        
        // Get separator classes for this item
        const separatorClasses = getSeparatorClasses(i, itemCount);
        
        // Presence/absence highlighting
        const presenceInfo = presenceDiff(
          baseVal, 
          compVals.map(cv => cv.val), 
          baseLogIndex, 
          compVals.map(cv => cv.rowIndex)
        );

        return (
          <AccordionItem key={lbl} value={lbl} className={separatorClasses}>
            <AccordionTrigger className="relative group flex items-center justify-between">
              <span className="inline-flex items-center gap-2">
                {icon} {lbl}
                <div className="ml-2 flex gap-1 items-center">
                  {(() => {
                    // Only show neutral badge if it contains rows not covered by red/green badges
                    const redGreenRows = new Set([...presenceInfo.redRows, ...presenceInfo.greenRows]);
                    const uniqueNeutralRows = allRowsForIndex.filter(row => !redGreenRows.has(row));
                    
                    return uniqueNeutralRows.length > 0 ? 
                      <RowBadge rowNumbers={uniqueNeutralRows} mode="none" /> : 
                      null;
                  })()}
                  {presenceInfo.redRows.length > 0 && <RowBadge rowNumbers={presenceInfo.redRows} mode="delete" />}
                  {presenceInfo.greenRows.length > 0 && <RowBadge rowNumbers={presenceInfo.greenRows} mode="insert" />}
                </div>
              </span>
              {(itemType === "dict" || itemType === "list") && (
                <div className="absolute right-5 flex gap-1 items-center">
                  <ActionButton
                    variant="ghost"
                    size="icon"
                    tooltip={isPathOpen ? "Collapse all children" : "Expand all children"}
                    onClick={(e) => handleRecursiveToggle(
                      e,
                      path,
                      baseVal,
                      compVals.map(cv => cv.val),
                      prefix,
                      nestingLevel,
                      expandRecursively,
                      collapseRecursively,
                      openKeys
                    )}
                    icon={isPathOpen ? <FoldVertical size={16} /> : <UnfoldVertical size={16} />}
                  />
                </div>
              )}
            </AccordionTrigger>
            
            <AccordionContent>
              <div className={contentIndentClass}>
                {(() => {
                  // Single row case - only one source contains this key
                  if ((basePresent && compVals.length === 0) || (!basePresent && compVals.length === 1)) {
                    // Get the value and row index from whichever source has it
                    const singleVal = basePresent ? baseVal : compVals[0].val;
                    const singleIdx = basePresent ? baseLogIndex : compVals[0].rowIndex;
                    
                    return pickView({
                      value: singleVal,
                      comparables: [],
                      baseLogIndex: singleIdx,
                      comparisonLogsIndex: [],
                      version,
                      comparableVersions,
                      diffMode,
                      splitView,
                      displayMode,
                      nestingLevel: nestingLevel + 1,
                      prefix,
                      parentPath: path,
                      viewTracesAsDict,
                    });
                  }
                  
                  // For complex types like dict or list, ensure consistent structure before diffing
                  if (itemType === "dict" || itemType === "list") {
                    // Check if we have type mismatches among the available values
                    const allVals = [baseVal, ...compVals.map(cv => cv.val)].filter(v => v !== undefined);
                    const allTypes = new Set(allVals.map(getValueType));
                    
                    // If we have multiple distinct types or mixed with undefined values,
                    // we'll use a similar approach to no-diff mode to show a unified view
                    if (allTypes.size > 1 || 
                        (baseVal === undefined && compVals.some(cv => isDict(cv.val) || isList(cv.val))) ||
                        ((isDict(baseVal) || isList(baseVal)) && compVals.some(cv => cv.val === undefined))) {
                      
                      // First, extract values by their primary type
                      const dictValues: {val: any, rowIndex: number}[] = [];
                      const listValues: {val: any, rowIndex: number}[] = [];
                      const otherValues: {val: any, rowIndex: number, type: string}[] = [];
                      
                      // Add base value if present
                      if (basePresent) {
                        const valType = getValueType(baseVal);
                        if (valType === "dict") {
                          dictValues.push({val: baseVal, rowIndex: baseLogIndex});
                        } else if (valType === "list") {
                          listValues.push({val: baseVal, rowIndex: baseLogIndex});
                        } else if (baseVal !== undefined) {
                          otherValues.push({val: baseVal, rowIndex: baseLogIndex, type: valType});
                        }
                      }
                      
                      // Add comparable values
                      compVals.forEach(({val, rowIndex}) => {
                        if (val === undefined) return;
                        
                        const valType = getValueType(val);
                        if (valType === "dict") {
                          dictValues.push({val, rowIndex});
                        } else if (valType === "list") {
                          listValues.push({val, rowIndex});
                        } else {
                          otherValues.push({val, rowIndex, type: valType});
                        }
                      });
                      
                      // Render all components
                      return (
                        <div className="space-y-2">
                          {/* Merge all dicts in a unified view */}
                          {dictValues.length > 0 && (
                            <div>
                              <div className="flex gap-1 mb-1">
                                <RowBadge rowNumbers={dictValues.map(d => d.rowIndex).sort((a, b) => a - b)} mode="none" />
                              </div>
                              {/* Use the first dict as the base and others as comparables */}
                              {pickView({
                                value: dictValues[0].val,
                                comparables: dictValues.slice(1).map(d => d.val),
                                baseLogIndex: dictValues[0].rowIndex,
                                comparisonLogsIndex: dictValues.slice(1).map(d => d.rowIndex),
                                version,
                                comparableVersions,
                                diffMode,
                                splitView,
                                displayMode,
                                nestingLevel: nestingLevel + 1,
                                prefix,
                                parentPath: path,
                                viewTracesAsDict,
                              })}
                            </div>
                          )}
                          
                          {/* Merge all lists in a unified view */}
                          {listValues.length > 0 && (
                            <div className={dictValues.length > 0 ? "mt-2 pt-2 border-t" : ""}>
                              <div className="flex gap-1 mb-1">
                                <RowBadge rowNumbers={listValues.map(l => l.rowIndex).sort((a, b) => a - b)} mode="none" />
                              </div>
                              {/* Use the first list as the base and others as comparables */}
                              {pickView({
                                value: listValues[0].val,
                                comparables: listValues.slice(1).map(l => l.val),
                                baseLogIndex: listValues[0].rowIndex,
                                comparisonLogsIndex: listValues.slice(1).map(l => l.rowIndex),
                                version,
                                comparableVersions,
                                diffMode,
                                splitView,
                                displayMode,
                                nestingLevel: nestingLevel + 1,
                                prefix,
                                parentPath: path,
                                viewTracesAsDict,
                              })}
                            </div>
                          )}
                          
                          {/* Group other values by exact structure */}
                          {otherValues.length > 0 && (
                            <>
                              {/* Group strings for diffing if possible */}
                              {(() => {
                                // Group strings for diffing if possible
                                const stringValues = otherValues.filter(v => typeof v.val === 'string');
                                const nonStringValues = otherValues.filter(v => typeof v.val !== 'string');
                                
                                // If we only have string values and more than one, diff them
                                if (stringValues.length > 1 && nonStringValues.length === 0) {
                                  const baseStringVal = stringValues[0].val;
                                  const compStringVals = stringValues.slice(1).map(v => v.val);
                                  
                                  return (
                                    <div className={dictValues.length > 0 || listValues.length > 0 ? "mt-2 pt-2 border-t" : ""}>
                                      <div className="flex gap-1 mb-1">
                                        <RowBadge rowNumbers={stringValues.map(s => s.rowIndex).sort((a, b) => a - b)} mode="none" />
                                      </div>
                                      {pickView({
                                        value: baseStringVal,
                                        comparables: compStringVals,
                                        baseLogIndex: stringValues[0].rowIndex,
                                        comparisonLogsIndex: stringValues.slice(1).map(s => s.rowIndex),
                                        version,
                                        comparableVersions,
                                        diffMode, // Use actual diff mode for strings
                                        splitView,
                                        displayMode,
                                        nestingLevel: nestingLevel + 1,
                                        prefix,
                                        parentPath: path,
                                        viewTracesAsDict,
                                      })}
                                    </div>
                                  );
                                }
                                
                                // Otherwise, group non-strings by their value
                                const groups: {val: any, rows: number[]}[] = [];
                                
                                otherValues.forEach(({val, rowIndex}) => {
                                  let found = false;
                                  for (const group of groups) {
                                    // For primitives, we can use direct equality
                                    if (val === group.val || 
                                        (typeof val === 'object' && typeof group.val === 'object' && 
                                         JSON.stringify(val) === JSON.stringify(group.val))) {
                                      group.rows.push(rowIndex);
                                      found = true;
                                      break;
                                    }
                                  }
                                  
                                  if (!found) {
                                    groups.push({val, rows: [rowIndex]});
                                  }
                                });
                                
                                return groups.map((group, i) => (
                                  <div key={i} className={(dictValues.length > 0 || listValues.length > 0 || i > 0) ? "mt-2 pt-2 border-t" : ""}>
                                    <div className="flex gap-1 mb-1">
                                      <RowBadge rowNumbers={group.rows.sort((a, b) => a - b)} mode="none" />
                                    </div>
                                    {pickView({
                                      value: group.val,
                                      comparables: [],
                                      baseLogIndex: group.rows[0],
                                      comparisonLogsIndex: [],
                                      version,
                                      comparableVersions,
                                      diffMode,
                                      splitView,
                                      displayMode,
                                      nestingLevel: nestingLevel + 1,
                                      prefix,
                                      parentPath: path,
                                      viewTracesAsDict,
                                    })}
                                  </div>
                                ));
                              })()}
                            </>
                          )}
                        </div>
                      );
                    }
                  }
                  
                  // Also check if we have strings that can be diffed together
                  if (typeof baseVal === 'string' && compVals.every(cv => typeof cv.val === 'string')) {
                    // All strings, use normal diffing
                    return pickView({
                      value: baseVal,
                      comparables: compVals.map(cv => cv.val),
                      baseLogIndex,
                      comparisonLogsIndex: compVals.map(cv => cv.rowIndex),
                      version,
                      comparableVersions,
                      diffMode,
                      splitView,
                      displayMode,
                      nestingLevel: nestingLevel + 1,
                      prefix,
                      parentPath: path,
                      viewTracesAsDict,
                    });
                  }
                  
                  // Standard diffing for compatible types
                  // If base is undefined but comparables exist, use first comparable as the base
                  if (baseVal === undefined && compVals.length > 0) {
                    const newBaseVal = compVals[0].val;
                    const newBaseLogIndex = compVals[0].rowIndex;
                    const remainingCompVals = compVals.slice(1);
                    
                    return pickView({
                      value: newBaseVal,
                      comparables: remainingCompVals.map(cv => cv.val),
                      baseLogIndex: newBaseLogIndex,
                      comparisonLogsIndex: remainingCompVals.map(cv => cv.rowIndex),
                      version,
                      comparableVersions,
                      diffMode,
                      splitView,
                      displayMode,
                      nestingLevel: nestingLevel + 1,
                      prefix,
                      parentPath: path,
                      viewTracesAsDict,
                    });
                  }
                  
                  // Regular case where base is defined
                  return pickView({
                    value: baseVal,
                    comparables: compVals.map(cv => cv.val),
                    baseLogIndex,
                    comparisonLogsIndex: compVals.map(cv => cv.rowIndex),
                    version,
                    comparableVersions,
                    diffMode,
                    splitView,
                    displayMode,
                    nestingLevel: nestingLevel + 1,
                    prefix,
                    parentPath: path,
                    viewTracesAsDict,
                  });
                })()}
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
  viewTracesAsDict?: boolean;
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
  viewTracesAsDict,
}: ListViewProps) {
  
  // We first need to detect if we're within a TraceView context
  // We'll try to access the TraceExpandContext selector without throwing
  const [inTraceView, setInTraceView] = useState(false);
  
  // Try to use TraceExpandContext
  const traceOpenKeys = useTraceExpandContextSelector((ctx) => {
    return ctx?.openKeys;
  });
  const traceSetOpenKeys = useTraceExpandContextSelector((ctx) => ctx?.setOpenKeys);
  const traceForceExpandAll = useTraceExpandContextSelector((ctx) => ctx?.forceExpandAll);
  const traceForceCollapseAll = useTraceExpandContextSelector((ctx) => ctx?.forceCollapseAll);
  const traceExpandRecursively = useTraceExpandContextSelector((ctx) => ctx?.expandRecursively);
  const traceCollapseRecursively = useTraceExpandContextSelector((ctx) => ctx?.collapseRecursively);
  const traceToggleKey = useTraceExpandContextSelector((ctx) => ctx?.toggleKey);
  const traceInstanceId = useTraceExpandContextSelector((ctx) => ctx?.instanceId);
  
  // Also fetch PanelExpandContext values
  const panelOpenKeys = usePanelExpandContextSelector((ctx) => {
    return ctx.openKeys;
  });
  const panelSetOpenKeys = usePanelExpandContextSelector((ctx) => {
    return ctx.setOpenKeys;
  });
  const panelForceExpandAll = usePanelExpandContextSelector((ctx) => ctx.forceExpandAll);
  const panelForceCollapseAll = usePanelExpandContextSelector((ctx) => ctx.forceCollapseAll);
  const panelExpandRecursively = usePanelExpandContextSelector((ctx) => ctx.expandRecursively);
  const panelCollapseRecursively = usePanelExpandContextSelector((ctx) => ctx.collapseRecursively);
  const panelToggleKey = usePanelExpandContextSelector((ctx) => ctx.toggleKey);
  
  // Fix the useEffect that detects if we're in TraceView context
  useEffect(() => {
    // We're ONLY in TraceView if we have a real trace instance ID 
    // AND proper trace context functions
    const isInTraceView = Boolean(traceInstanceId) && 
      typeof traceSetOpenKeys === 'function' && 
      traceSetOpenKeys.toString() !== '()=>{}';
    
    setInTraceView(isInTraceView);
  }, [traceInstanceId, traceSetOpenKeys]);

  // Use the appropriate context values based on our environment
  const effectiveOpenKeys = inTraceView ? traceOpenKeys : panelOpenKeys;
  const effectiveSetOpenKeys = inTraceView ? traceSetOpenKeys : panelSetOpenKeys;
  const effectiveForceExpandAll = inTraceView ? traceForceExpandAll : panelForceExpandAll;
  const effectiveForceCollapseAll = inTraceView ? traceForceCollapseAll : panelForceCollapseAll;
  const effectiveExpandRecursively = inTraceView ? traceExpandRecursively : panelExpandRecursively;
  const effectiveCollapseRecursively = inTraceView ? traceCollapseRecursively : panelCollapseRecursively;
  const effectiveToggleKey = inTraceView ? traceToggleKey : panelToggleKey;
  
  // Memoize the value and comparables array validity to avoid recalculation
  const { isValidBase, isValidComparables, maxLength } = useMemo(() => {
    const isBase = Array.isArray(value);
    const hasComps = comparables && comparables.some(c => Array.isArray(c));
    
    let max = 0;
    if (isBase) max = Math.max(max, value.length);
    if (comparables) {
      comparables.forEach(c => {
        if (Array.isArray(c)) max = Math.max(max, c.length);
      });
    }
    
    return {
      isValidBase: isBase,
      isValidComparables: hasComps,
      maxLength: max
    };
  }, [value, comparables]);
  
  // Memoize the buildItemPath function to maintain consistent paths across renders
  const buildItemPath = useCallback((i: number) => {
    // If we have a parentPath, we should use it directly and just append the index
    // This ensures paths like "entries.dict.0.pred_marks_split.0" work correctly
    if (parentPath) {
      const path = `${parentPath}.${i}`;
      return path;
    } 
    
    // Otherwise fall back to the standard list path
    const standardPath = makePrefixedListPath(prefix, nestingLevel, i);
    return standardPath;
  }, [parentPath, prefix, nestingLevel]);
  
  // Memoize the itemLabel function for consistent labels
  const itemLabel = useCallback((i: number) => {
    return `${i}`;
  }, []);

  // Function to handle toggling a single item
  function handleToggle(index: number) {
    const path = buildItemPath(index);
    effectiveToggleKey(path);
  }
  
  // Function to render an item with only single value
  function renderSingleItem(index: number, itemValue: any, rowIndex: number) {
    const path = buildItemPath(index);
    const lbl = itemLabel(index);
    const itemType = getValueType(itemValue);
    const icon = getTypeIcon(itemType);
    
    // Calculate all subpaths for this item to determine if all are open
    let itemSubPaths: string[] = [];
    
    // Only gather subpaths for dict or list types
    if (itemType === "dict" || itemType === "list") {
      // Add the path itself
      itemSubPaths.push(path);
      
      // Add all nested paths
      const nestedPaths = gatherAllSubPaths(itemValue, path, prefix, nestingLevel);
      itemSubPaths.push(...nestedPaths);
    }
    
    // Determine if all subpaths are open (not just the path itself)
    const isPathOpen = itemSubPaths.length > 0 && 
                      itemSubPaths.every(subpath => effectiveOpenKeys.has(subpath));

    function handleExpandToggle(e: React.MouseEvent) {
      e.stopPropagation();
      
      // Recalculate paths every time to ensure fresh data
      let currentSubPaths: string[] = [];
      
      // Add the root path itself
      currentSubPaths.push(path);
      
      // Add all subpaths
      const nestedPaths = gatherAllSubPaths(itemValue, path, prefix, nestingLevel);
      currentSubPaths.push(...nestedPaths);
      
      // Skip if no paths to process
      if (currentSubPaths.length === 0) return;
      
      // Check if all subpaths are currently open
      const currentlyAllOpen = currentSubPaths.every(subpath => effectiveOpenKeys.has(subpath));
      
      if (currentlyAllOpen) {
        // All paths are open, so collapse them
        // When collapsing, exclude the parent path to keep it open
        const childPaths = currentSubPaths.filter(subpath => subpath !== path);
        effectiveCollapseRecursively(childPaths);
      } else {
        // Not all paths are open, so expand them
        effectiveExpandRecursively(currentSubPaths);
      }
    }

    return (
      <AccordionItem key={lbl} value={lbl}>
        <AccordionTrigger className="relative group flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            {icon} {lbl}
            <RowBadge rowNumbers={[rowIndex]} mode="none" />
          </span>
          {(itemType === "dict" || itemType === "list") && (
            <div className="absolute right-5 flex gap-1 items-center">
              <ActionButton
                variant="ghost"
                size="icon"
                tooltip={isPathOpen ? "Collapse all children" : "Expand all children"}
                onClick={handleExpandToggle}
                icon={isPathOpen ? <FoldVertical size={16} /> : <UnfoldVertical size={16} />}
              />
            </div>
          )}
        </AccordionTrigger>
        
        <AccordionContent>
          <div className={getContentIndentClasses(nestingLevel)}>
            {pickView({
              value: itemValue,
              comparables: [],
              baseLogIndex: rowIndex,
              comparisonLogsIndex: [],
              version,
              comparableVersions,
              diffMode,
              splitView,
              displayMode,
              nestingLevel: nestingLevel + 1,
              prefix,
              parentPath: path,
              viewTracesAsDict,
            })}
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  }
  
  // Function to render an item with multiple values
  function renderMultiItem(index: number, baseVal: any, compVals: any[]) {
    const path = buildItemPath(index);
    const lbl = itemLabel(index);
    const itemType = unifyType(baseVal, compVals);
    const icon = getTypeIcon(itemType);
    const basePresent = baseVal !== undefined;
    
    // Collect row indices
    const baseRows = basePresent ? [baseLogIndex] : [];
    const compRows = compVals.length > 0 ? comparisonLogsIndex : [];
    const allRows = [...baseRows, ...compRows].sort((a, b) => a - b);
    
    // Calculate presence information for badges
    const presenceInfo = presenceDiff(
      baseVal,
      compVals,
      baseLogIndex,
      comparisonLogsIndex
    );
    
    // Calculate all subpaths for this item to determine if all are open
    let itemSubPaths: string[] = [];
    
    // Only gather subpaths for dict or list types
    if (itemType === "dict" || itemType === "list") {
      // Add the path itself
      itemSubPaths.push(path);
      
      // Add all nested paths
      if (compVals && compVals.length > 0) {
        const nestedPaths = gatherAllSubPathsMulti(baseVal, compVals, path, prefix, nestingLevel);
        itemSubPaths.push(...nestedPaths);
      } else {
        const nestedPaths = gatherAllSubPaths(baseVal, path, prefix, nestingLevel);
        itemSubPaths.push(...nestedPaths);
      }
    }
    
    // Determine if all subpaths are open (not just the path itself)
    const isPathOpen = itemSubPaths.length > 0 && 
                      itemSubPaths.every(subpath => effectiveOpenKeys.has(subpath));

    function handleExpandToggle(e: React.MouseEvent) {
      e.stopPropagation();
      
      // Recalculate paths every time to ensure fresh data
      let currentSubPaths: string[] = [];
      
      // Add the root path itself
      currentSubPaths.push(path);
      
      // Add all subpaths
      const nestedPaths = gatherAllSubPaths(baseVal, path, prefix, nestingLevel);
      currentSubPaths.push(...nestedPaths);
      
      // Skip if no paths to process
      if (currentSubPaths.length === 0) return;
      
      // Check if all subpaths are currently open
      const currentlyAllOpen = currentSubPaths.every(subpath => effectiveOpenKeys.has(subpath));
      
      if (currentlyAllOpen) {
        // All paths are open, so collapse them
        // When collapsing, exclude the parent path to keep it open
        const childPaths = currentSubPaths.filter(subpath => subpath !== path);
        effectiveCollapseRecursively(childPaths);
      } else {
        // Not all paths are open, so expand them
        effectiveExpandRecursively(currentSubPaths);
      }
    }

    return (
      <AccordionItem key={lbl} value={lbl}>
        <AccordionTrigger className="relative group flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            {icon} {lbl}
            <div className="ml-2 flex gap-1 items-center">
              {(() => {
                // Only show neutral badge if it contains rows not covered by red/green badges
                const redGreenRows = new Set([...presenceInfo.redRows, ...presenceInfo.greenRows]);
                const uniqueNeutralRows = allRows.filter(row => !redGreenRows.has(row));
                
                return uniqueNeutralRows.length > 0 ? 
                  <RowBadge rowNumbers={uniqueNeutralRows} mode="none" /> : 
                  null;
              })()}
              {presenceInfo.redRows.length > 0 && <RowBadge rowNumbers={presenceInfo.redRows} mode="delete" />}
              {presenceInfo.greenRows.length > 0 && <RowBadge rowNumbers={presenceInfo.greenRows} mode="insert" />}
            </div>
          </span>
          {(itemType === "dict" || itemType === "list") && (
            <div className="absolute right-5 flex gap-1 items-center">
              <ActionButton
                variant="ghost"
                size="icon"
                tooltip={isPathOpen ? "Collapse all children" : "Expand all children"}
                onClick={handleExpandToggle}
                icon={isPathOpen ? <FoldVertical size={16} /> : <UnfoldVertical size={16} />}
              />
            </div>
          )}
        </AccordionTrigger>
        
        <AccordionContent>
          <div className={getContentIndentClasses(nestingLevel)}>
            {(() => {
              // For diff mode with values of the same type
              if (diffMode !== "none") {
                // If base is undefined but comparables exist, use first comparable as base
                if (baseVal === undefined && compVals.length > 0 && compVals[0] !== undefined) {
                  const newBaseVal = compVals[0];
                  const newCompVals = compVals.slice(1);
                  
                  return pickView({
                    value: newBaseVal,
                    comparables: newCompVals,
                    baseLogIndex: comparisonLogsIndex[0],
                    comparisonLogsIndex: comparisonLogsIndex.slice(1),
                    version,
                    comparableVersions,
                    diffMode,
                    splitView,
                    displayMode,
                    nestingLevel: nestingLevel + 1,
                    prefix,
                    parentPath: path,
                    viewTracesAsDict,
                  });
                }
                
                // Regular diff case
                return pickView({
                  value: baseVal,
                  comparables: compVals,
                  baseLogIndex,
                  comparisonLogsIndex,
                  version,
                  comparableVersions,
                  diffMode,
                  splitView,
                  displayMode,
                  nestingLevel: nestingLevel + 1,
                  prefix,
                  parentPath: path,
                  viewTracesAsDict,
                });
              }
              
              // Group values in no-diff mode
              const rowValuePairs: { rowIndex: number, val: any }[] = [];
              
              // Add base value if present
              if (baseVal !== undefined) {
                rowValuePairs.push({ rowIndex: baseLogIndex, val: baseVal });
              }
              
              // Add comparable values
              compVals.forEach((val, i) => {
                if (val !== undefined) {
                  rowValuePairs.push({ rowIndex: comparisonLogsIndex[i], val });
                }
              });
              
              // Group by value
              const groups = groupRowsByValue(rowValuePairs);
              
              return groups.map((group, idx) => (
                <div key={idx} className={getSeparatorClasses(idx, groups.length)}>
                  {group.rows.length > 1 && <RowBadge rowNumbers={group.rows} mode="none" />}
                  <div className="mt-1">
                    {pickView({
                      value: group.value,
                      comparables: [],
                      baseLogIndex: group.rows[0],
                      comparisonLogsIndex: [],
                      version,
                      comparableVersions,
                      diffMode,
                      splitView,
                      displayMode,
                      nestingLevel: nestingLevel + 1,
                      prefix,
                      parentPath: path,
                      viewTracesAsDict,
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  }
  
  // Update the useEffect for forceExpandAll to trigger the recursive expansion
  useEffect(() => {
    if (!isValidBase && !isValidComparables) return;
    
    if (effectiveForceExpandAll || effectiveForceCollapseAll) {
      const paths: string[] = [];
      
      // Gather paths for each item and its nested content
      for (let i = 0; i < maxLength; i++) {
        const itemPath = buildItemPath(i);
        paths.push(itemPath);
        
        // Get the value at this index
        const itemValue = Array.isArray(value) && i < value.length ? value[i] : undefined;
        
        // Get comparable values at this index
        const itemComparables = comparables ? comparables.map(c => 
          Array.isArray(c) && i < c.length ? c[i] : undefined
        ).filter(v => v !== undefined) : [];
        
        // Add nested paths if this item contains nested data
        if (isDict(itemValue) || isList(itemValue)) {
          let subPaths = [];
          if (itemComparables.length > 0) {
            subPaths = gatherAllSubPathsMulti(itemValue, itemComparables, itemPath, prefix, nestingLevel + 1);
          } else {
            subPaths = gatherAllSubPaths(itemValue, itemPath, prefix, nestingLevel + 1);
          }
          paths.push(...subPaths);
        }
      }
      
      if (effectiveForceExpandAll) {
        effectiveExpandRecursively(paths);
      } else {
        effectiveCollapseRecursively(paths);
      }
    }
  }, [
    effectiveForceExpandAll,
    effectiveForceCollapseAll,
    isValidBase,
    isValidComparables,
    maxLength,
    buildItemPath,
    value,
    comparables,
    prefix,
    nestingLevel,
    effectiveExpandRecursively,
    effectiveCollapseRecursively
  ]);

  // No content case
  if (maxLength === 0) {
    return <div className="text-muted-foreground">Empty list</div>;
  }

  // Check if we have anything to show
  if (!isValidBase && !isValidComparables) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-red-500">
          ListView: neither base nor comparables are valid arrays
        </p>
      </div>
    );
  }

  // Setup array of indexes for accordion
  const indices = Array.from({ length: maxLength }, (_, i) => i);
  const openValues = indices
    .filter(i => effectiveOpenKeys.has(buildItemPath(i)))
    .map(i => itemLabel(i));

  // Function to handle accordion value change
  function handleAccordionValueChange(newVals: string[]) {
    const oldSet = new Set(openValues);
    const nextSet = new Set(newVals);

    for (let i = 0; i < maxLength; i++) {
      const lbl = itemLabel(i);
      const had = oldSet.has(lbl);
      const now = nextSet.has(lbl);
      if (had !== now) {
        // toggle
        handleToggle(i);
      }
    }
  }

  // First check for no-diff mode
  if (diffMode === "none") {
    if (isValidComparables) {
      // Build an array of [arrayValue, rowIndex] pairs for each comparable
      const validComparablePairs = comparables
        .map((c, i) => ({
          array: Array.isArray(c) ? c : undefined,
          rowIndex: comparisonLogsIndex[i],
        }));
      
      // Filter out only the valid pairs, preserving order but skipping invalid ones
      const finalComparables = validComparablePairs
        .filter((pair) => pair.array !== undefined)
        .map((pair) => pair.array!); // safe because we filtered out undefined
      
      const finalRowIndices = validComparablePairs
        .filter((pair) => pair.array !== undefined)
        .map((pair) => pair.rowIndex!);
      
      // Render no-diff mode for multi-mode
      return renderNoDiffMode(
        maxLength,
        Array.isArray(value) ? value : [],
        finalComparables,
        [baseLogIndex, ...finalRowIndices],
        effectiveOpenKeys,
        effectiveSetOpenKeys,
        buildItemPath,
        itemLabel,
        {
          baseLogIndex,
          comparisonLogsIndex: finalRowIndices,
          version,
          comparableVersions,
          diffMode,
          splitView,
          displayMode,
          nestingLevel,
          prefix,
          parentPath,
          expandRecursively: effectiveExpandRecursively,
          collapseRecursively: effectiveCollapseRecursively,
          viewTracesAsDict,
        }
      );
    }
  } 
  // For all other diff modes, use renderDiffMode
  else if (diffMode === "lines" || diffMode === "words" || diffMode === "characters") {
    if (isValidComparables || isValidBase) {
      // Build an array of [arrayValue, rowIndex] pairs for each comparable
      const validComparablePairs = comparables
        .map((c, i) => ({
          array: Array.isArray(c) ? c : undefined,
          rowIndex: comparisonLogsIndex[i],
        }));
      
      // Filter out only the valid pairs, preserving order but skipping invalid ones
      const finalComparables = validComparablePairs
        .filter((pair) => pair.array !== undefined)
        .map((pair) => pair.array!); // safe because we filtered out undefined
      
      const finalRowIndices = validComparablePairs
        .filter((pair) => pair.array !== undefined)
        .map((pair) => pair.rowIndex!);
      
      return renderDiffMode(
        maxLength,
        Array.isArray(value) ? value : [],
        finalComparables,
        [baseLogIndex, ...finalRowIndices],
        effectiveOpenKeys,
        effectiveSetOpenKeys,
        buildItemPath,
        itemLabel,
        {
          baseLogIndex,
          comparisonLogsIndex: finalRowIndices,
          version,
          comparableVersions,
          diffMode,
          splitView,
          displayMode,
          nestingLevel,
          prefix,
          parentPath,
          expandRecursively: effectiveExpandRecursively,
          collapseRecursively: effectiveCollapseRecursively,
          viewTracesAsDict,
        }
      );
    }
  }

  // If only base is valid and no comparables - use simplified view
  return (
    <Accordion
      type="multiple"
      value={openValues}
      onValueChange={handleAccordionValueChange}
    >
      {indices.map(i => {
        const baseArr = Array.isArray(value) ? value : [];
        const baseVal = i < baseArr.length ? baseArr[i] : undefined;
        
        if (baseVal === undefined) return null;
        
        return renderSingleItem(i, baseVal, baseLogIndex);
      })}
    </Accordion>
  );
}