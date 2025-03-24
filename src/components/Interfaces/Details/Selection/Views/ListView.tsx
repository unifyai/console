"use client";

import React, { useMemo, useEffect, useCallback } from "react";
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
  
  
  // check if all are open
  const allOpen = subPaths.every((p) => openKeys.has(p));
  
  if (allOpen) {
    // collapse - call collapseRecursively
    collapseRecursively(subPaths);
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
  }
) {
  const { 
    baseLogIndex, comparisonLogsIndex, version, comparableVersions, 
    diffMode, splitView, displayMode, nestingLevel, prefix, parentPath,
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
          handleRecursiveToggle(e, path, firstVal, comparables, prefix, nestingLevel, expandRecursively, collapseRecursively, openKeys);
        }
        
        // Get separator classes for this item
        const separatorClasses = getSeparatorClasses(i, itemCount);
        
        return (
          <AccordionItem key={lbl} value={lbl} className={separatorClasses}>
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
              <div className={contentIndentClass}>
                {groups.map((group, idx) => (
                  <div key={idx} className={getSeparatorClasses(idx, groups.length)}>
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
  // Subscribe to context values we need
  const openKeys = usePanelExpandContextSelector((ctx) => ctx.openKeys);
  const setOpenKeys = usePanelExpandContextSelector((ctx) => ctx.setOpenKeys);
  const forceExpandAll = usePanelExpandContextSelector((ctx) => ctx.forceExpandAll);
  const forceCollapseAll = usePanelExpandContextSelector((ctx) => ctx.forceCollapseAll);
  const toggleKey = usePanelExpandContextSelector((ctx) => ctx.toggleKey);
  const expandRecursively = usePanelExpandContextSelector((ctx) => ctx.expandRecursively);
  const collapseRecursively = usePanelExpandContextSelector((ctx) => ctx.collapseRecursively);

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
  
  // Memoize toggle handlers to prevent recreation on displayMode changes
  const handleToggle = useCallback((index: number) => {
    const path = buildItemPath(index);
    toggleKey(path);
  }, [toggleKey, parentPath, prefix, nestingLevel]);
  
  // Memoize the buildItemPath function to maintain consistent paths across renders
  const buildItemPath = useCallback((i: number) => {
    return parentPath 
      ? `${parentPath}.${i}` 
      : makePrefixedListPath(prefix, nestingLevel, i);
  }, [parentPath, prefix, nestingLevel]);
  
  // Memoize the itemLabel function for consistent labels
  const itemLabel = useCallback((i: number) => {
    return `${i}`;
  }, []);
  
  // Memoize recursive expand/collapse handlers
  const handleRecursiveExpandCollapse = useCallback((e: React.MouseEvent, index: number, itemValue: any, itemComparables: any[]) => {
    const path = buildItemPath(index);
    
    handleRecursiveToggle(
      e,
      path,
      itemValue,
      itemComparables,
      prefix,
      nestingLevel + 1,
      expandRecursively,
      collapseRecursively,
      openKeys
    );
  }, [buildItemPath, prefix, nestingLevel, expandRecursively, collapseRecursively, openKeys]);
  
  // Memoize all item paths to avoid recalculation on display mode changes
  const itemPaths = useMemo(() => {
    const paths = [];
    for (let i = 0; i < maxLength; i++) {
      paths.push({
        index: i,
        path: buildItemPath(i)
      });
    }
    return paths;
  }, [maxLength, buildItemPath]);
  
  // Memoize the open values for the accordion
  const openValues = useMemo(() => {
    return itemPaths
      .filter(({ path }) => openKeys.has(path))
      .map(({ index }) => itemLabel(index));
  }, [itemPaths, openKeys, itemLabel]);
  
  // This effect shouldn't run when displayMode changes
  useEffect(() => {
    if (!isValidBase && !isValidComparables) return;
    
    if (forceExpandAll || forceCollapseAll) {
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
        ) : [];
        
        // Add nested paths if this item contains nested data
        if (isDict(itemValue) || isList(itemValue)) {
          if (itemComparables.length > 0) {
            paths.push(...gatherAllSubPathsMulti(itemValue, itemComparables, itemPath, prefix, nestingLevel + 1));
          } else {
            paths.push(...gatherAllSubPaths(itemValue, itemPath, prefix, nestingLevel + 1));
          }
        }
      }
      
      if (forceExpandAll) {
        expandRecursively(paths);
      } else {
        collapseRecursively(paths);
      }
    }
  }, [
    forceExpandAll,
    forceCollapseAll,
    isValidBase,
    isValidComparables,
    maxLength,
    buildItemPath,
    value,
    comparables,
    prefix,
    nestingLevel,
    expandRecursively,
    collapseRecursively
    // displayMode intentionally left out of dependencies
  ]);

  // Memoize all rendered items to prevent rerendering on display mode change
  const renderedItems = useMemo(() => {
    if (!isValidBase && !isValidComparables) {
      return null;
    }
    
    const multiMode = isValidComparables;
    const items = [];
    
    for (let i = 0; i < maxLength; i++) {
      const baseItem = Array.isArray(value) && i < value.length ? value[i] : undefined;
      const compItems = comparables ? comparables.map(c => 
        Array.isArray(c) && i < c.length ? c[i] : undefined
      ) : [];
      
      items.push(
        multiMode 
          ? renderMultiItem(i, baseItem, compItems)
          : renderSingleItem(i, baseItem)
      );
    }
    
    return items;
  }, [
    isValidBase,
    isValidComparables,
    maxLength,
    value,
    comparables,
    // The state needed for rendering but explicitly NOT including displayMode
    baseLogIndex,
    comparisonLogsIndex,
    diffMode,
    splitView,
    nestingLevel,
    version,
    comparableVersions,
    // Add the missing dependencies
    renderMultiItem,
    renderSingleItem
  ]);

  function renderSingleItem(index: number, itemValue: any) {
    // Skip undefined items
    if (itemValue === undefined) return null;
    
    const path = buildItemPath(index);
    const isOpen = openKeys.has(path);
    const valueType = getValueType(itemValue);
    const icon = getTypeIcon(valueType);
    const isExpandable = isDict(itemValue) || isList(itemValue);
    
    // Get indentation classes based on nesting level
    const indentClass = getIndentClasses(nestingLevel);
    // Always use content indent for children
    const contentIndentClass = getContentIndentClasses(nestingLevel);
    
    function handleExpandClick(e: React.MouseEvent) {
      e.stopPropagation();
      handleToggle(index);
    }
    
    return (
      <AccordionItem key={`item-${index}`} value={itemLabel(index)} className="border-0">
        <AccordionTrigger
          onClick={handleExpandClick}
          className="py-1.5 hover:no-underline"
        >
          <div className="flex items-center gap-2">
            <span className="text-primary">{icon}</span>
            <span className="text-sm font-mono">[{index}]</span>
          </div>
          {isExpandable && (
            <div
              className="absolute right-5 z-10"
              onClick={(e) => handleRecursiveExpandCollapse(e, index, itemValue, [])}
            >
              <ActionButton
                variant="ghost"
                size="sm"
                tooltip={isOpen ? "Fold all" : "Unfold all"}
                icon={
                  isOpen ? (
                    <FoldVertical className="h-3 w-3" />
                  ) : (
                    <UnfoldVertical className="h-3 w-3" />
                  )
                }
              />
            </div>
          )}
        </AccordionTrigger>
        <AccordionContent>
          <div className={contentIndentClass}>
            {pickView({
              value: itemValue,
              comparables: [],
              baseLogIndex,
              comparisonLogsIndex: [],
              diffMode,
              splitView,
              displayMode,
              version,
              comparableVersions,
              nestingLevel: nestingLevel + 1,
              prefix,
              parentPath: path,
            })}
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  }

  function renderMultiItem(index: number, baseItem: any, compItems: any[]) {
    // Skip totally undefined items
    if (baseItem === undefined && compItems.every((c) => c === undefined)) {
      return null;
    }
    
    const path = buildItemPath(index);
    const isOpen = openKeys.has(path);
    
    const { redRows, greenRows } = presenceDiff(
      baseItem,
      compItems,
      baseLogIndex,
      comparisonLogsIndex
    );
    
    const isInBase = baseItem !== undefined;
    
    // Use unifyType to decide what icon to show
    const unifiedType = unifyType(baseItem, compItems);
    const icon = getTypeIcon(unifiedType);
    const isExpandable = ["dict", "list"].includes(unifiedType);
    
    // Get indentation classes based on nesting level
    const indentClass = getIndentClasses(nestingLevel);
    // Always use content indent for children
    const contentIndentClass = getContentIndentClasses(nestingLevel);
    
    function handleExpandClick(e: React.MouseEvent) {
      e.stopPropagation();
      handleToggle(index);
    }
    
    return (
      <AccordionItem key={`item-${index}`} value={itemLabel(index)} className="border-0">
        <AccordionTrigger
          onClick={handleExpandClick}
          className="py-1.5 hover:no-underline"
        >
          <div className="flex items-center gap-2">
            <span className="text-primary">{icon}</span>
            <span className="text-sm font-mono">[{index}]</span>
            <div className="flex items-center gap-1">
              {isInBase ? (
                <RowBadge rowNumbers={[baseLogIndex]} mode="base" />
              ) : null}
              {redRows.length > 0 && <RowBadge rowNumbers={redRows} mode="delete" />}
              {greenRows.length > 0 && <RowBadge rowNumbers={greenRows} mode="insert" />}
            </div>
          </div>
          {isExpandable && (
            <div
              className="absolute right-5 z-10"
              onClick={(e) => handleRecursiveExpandCollapse(e, index, baseItem, compItems)}
            >
              <ActionButton
                variant="ghost"
                size="sm"
                tooltip={isOpen ? "Fold all" : "Unfold all"}
                icon={
                  isOpen ? (
                    <FoldVertical className="h-3 w-3" />
                  ) : (
                    <UnfoldVertical className="h-3 w-3" />
                  )
                }
              />
            </div>
          )}
        </AccordionTrigger>
        <AccordionContent>
          <div className={contentIndentClass}>
            {pickView({
              value: baseItem,
              comparables: compItems,
              baseLogIndex,
              comparisonLogsIndex,
              diffMode,
              splitView,
              displayMode,
              version,
              comparableVersions,
              nestingLevel: nestingLevel + 1,
              prefix,
              parentPath: path,
            })}
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  }

  if (diffMode === "none" && isValidComparables) {
    // Render no-diff mode for multi-mode
    return renderNoDiffMode(
      maxLength,
      Array.isArray(value) ? value : [],
      Array.isArray(comparables[0]) ? comparables as any[][] : [],
      [baseLogIndex, ...comparisonLogsIndex],
      openKeys,
      setOpenKeys,
      buildItemPath,
      itemLabel,
      {
        baseLogIndex,
        comparisonLogsIndex,
        version,
        comparableVersions,
        diffMode,
        splitView,
        displayMode,
        nestingLevel,
        prefix,
        parentPath,
        expandRecursively,
        collapseRecursively,
      }
    );
  }

  // If there's nothing to render in either mode
  if (!isValidBase && !isValidComparables) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-red-500">
          ListView: neither base nor comparables are valid arrays
        </p>
      </div>
    );
  }
  
  // Fix for the linter error by safely handling null renderedItems
  return (
    <Accordion type="multiple" value={openValues} onValueChange={() => {}}>
      <div className="flex flex-col">
        {renderedItems?.map((item, idx) => (
          <div key={`item-wrapper-${idx}`} className={getSeparatorClasses(idx, renderedItems.length)}>
            {item}
          </div>
        )) || null}
      </div>
    </Accordion>
  );
}