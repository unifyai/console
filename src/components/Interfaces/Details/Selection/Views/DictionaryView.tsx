"use client";

import React, { useMemo, useEffect, useCallback, useState, useRef } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/UI/accordion";
import { FoldVertical, UnfoldVertical } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";

import {
  isDict,
  isList,
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
  makePrefixedDictPath,
  sanitizePropertyKey,
} from "@/utils/evals/pathUtils";
import { usePanelExpandContextSelector } from "@/components/Interfaces/Details/Selection/SelectionPanel";
import { getIndentClasses, getContentIndentClasses, getSeparatorClasses } from "./useIndentation";
import { useTraceExpandContextSelector } from "./TraceView/TraceExpandContext";

import { LogComparisonProps } from "./types";
import { getValueType, getTypeIcon } from "./ViewTypes";
import RowBadge from "./RowBadge";

// Subcomponents
import TraceView from "./TraceView";
import ChatView from "./ChatView";
import ListView from "./ListView";
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
    if (v == null) return false;
    if (typeof v === "string" && v.trim() === "") return false;
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
function pickView(props: LogComparisonProps & { prefix?: string; parentPath?: string }) {
  const { value, parentPath = "", prefix = "", nestingLevel = 0 } = props;

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
  presenceDiff => highlight inserted/deleted dictionary keys (multi-mode)
────────────────────────────────────────────────────────────────────────────*/
function presenceDiff(
  baseVal: any,
  compVals: any[],
  baseRow: number,
  compRows: number[]
) {
  const baseHas = baseVal !== undefined;
  const redSet = new Set<number>();
  const greenSet = new Set<number>();

  compVals.forEach((cVal, i) => {
    const row = compRows[i];
    const cHas = cVal !== undefined;
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
  handleRecursiveToggle => expand/collapse everything under the given path
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
  const allOpen = subPaths.every((sp) => openKeys.has(sp));
  
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

/*────────────────────────────────────────────────────────────────────────────
  DictionaryView => dictionary-level expansions, presence diffs, icons,
  "forceExpandAll / forceCollapseAll" logic in one pass
────────────────────────────────────────────────────────────────────────────*/
interface DictionaryViewProps extends LogComparisonProps {
  prefix?: string;
  parentPath?: string;        // The parent's fully qualified path (e.g. "entries.dict.0.a")
  nestingLevel?: number;
}

/*─────────────────────────────────────────────────────────────────────────
  renderNoDiffMode => render in no-diff mode with superset keys and grouped values
──────────────────────────────────────────────────────────────────────────*/
function renderNoDiffMode(
  allKeys: string[], 
  value: any, 
  comparables: any[], 
  rowIndices: number[],
  openKeys: Set<string>,
  setOpenKeys: React.Dispatch<React.SetStateAction<Set<string>>>,
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
  // Always use content indent for children regardless of level
  const contentIndentClass = getContentIndentClasses(nestingLevel);
  
  // Build the open values array for the accordion
  const openValues = allKeys
    .map((k) => {
      const builtPath = parentPath
        ? parentPath + "." + sanitizePropertyKey(k)
        : makePrefixedDictPath(prefix, nestingLevel, k);
      return openKeys.has(builtPath) ? builtPath : null;
    })
    .filter(Boolean) as string[];

  // Function to handle accordion value change
  function handleAccordionValueChange(newVals: string[]) {
    const oldSet = new Set(openValues);
    const nextSet = new Set(newVals);
    const changedAdded = Array.from(nextSet).filter((v) => !oldSet.has(v));
    const changedRemoved = Array.from(oldSet).filter((v) => !nextSet.has(v));
    
    setOpenKeys((prev) => {
      const updated = new Set(prev);
      changedAdded.forEach((v) => updated.add(v));
      changedRemoved.forEach((v) => updated.delete(v));
      return updated;
    });
  }

  return (
    <Accordion
      type="multiple"
      value={openValues}
      onValueChange={handleAccordionValueChange}
    >
      {allKeys.map((k, idx) => {
        // 1. Gather values for this key from all rows
        const rowValuePairs: { rowIndex: number, val: any }[] = [];
        
        // Add base value if it exists
        if (value && isDict(value) && Object.prototype.hasOwnProperty.call(value, k)) {
          rowValuePairs.push({ rowIndex: rowIndices[0], val: value[k] });
        }
        
        // Add comparable values if they exist
        comparables.forEach((compDict, i) => {
          if (compDict && isDict(compDict) && Object.prototype.hasOwnProperty.call(compDict, k)) {
            rowValuePairs.push({ rowIndex: rowIndices[i + 1], val: compDict[k] });
          }
        });
        
        // 2. Group identical values
        const groups = groupRowsByValue(rowValuePairs);
        
        // Collect all row indices for this key to show in the accordion trigger
        const allRowsForKey = rowValuePairs.map(pair => pair.rowIndex).sort((a, b) => a - b);
        
        // 3. Create the path for this key
        const path = parentPath
          ? parentPath + "." + sanitizePropertyKey(k)
          : makePrefixedDictPath(prefix, nestingLevel, k);

        // get the current value for this key
        const currentValue = value?.[k];
        const currentComparables = comparables.map((c) => c?.[k]);
        
        // 4. Determine type and icon for the key (using the first non-undefined value)
        const firstVal = rowValuePairs.find(p => p.val !== undefined)?.val;
        const keyType = getValueType(firstVal);
        const icon = getTypeIcon(keyType);
        
        // 5. Setup recursive toggle handler
        const isPathOpen = openKeys.has(path);
        function handleExpandToggle(e: React.MouseEvent) {
          e.stopPropagation();
          handleRecursiveToggle(e, path, currentValue, currentComparables, prefix, nestingLevel, expandRecursively, collapseRecursively, openKeys);
        }
        
        // Get separator classes for this item
        const separatorClasses = getSeparatorClasses(idx, allKeys.length);
        
        return (
          <AccordionItem key={k} value={path} className={separatorClasses}>
            <AccordionTrigger className="relative group flex items-center justify-between">
              <span className="inline-flex items-center gap-2">
                {icon} {k}
                {allRowsForKey.length > 1 && (
                  <div className="ml-2 flex gap-1">
                    <RowBadge rowNumbers={allRowsForKey} mode="none" />
                  </div>
                )}
              </span>
              {(keyType === "dict" || keyType === "list") && (
                <div className="absolute right-5 flex gap-1 items-center">
                  <ActionButton
                    variant="ghost"
                    size="icon"
                    tooltip={isPathOpen ? "Collapse All Children" : "Expand All Children"}
                    onClick={handleExpandToggle}
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

export default function DictionaryView({
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
  parentPath = "", // new param to track parent's path
}: DictionaryViewProps) {
  
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
  const panelSetOpenKeys = usePanelExpandContextSelector((ctx) => ctx.setOpenKeys);
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

  // Extract all keys from base and comparables, filtering out ONLY undefined values
  const allKeys = useMemo(() => {
    const keys = new Set<string>();

    // Add keys from base object (if it exists and isn't null)
    if (value && typeof value === "object") {
      Object.keys(value).forEach((k) => keys.add(k));
    }

    // Add keys from comparable objects
    for (const comp of comparables) {
      if (comp && typeof comp === "object") {
        Object.keys(comp).forEach((k) => keys.add(k));
      }
    }

    // Convert to array and sort alphabetically
    return Array.from(keys).sort((a, b) => {
      // Try to sort numerically if both are numeric strings
      const aNum = Number(a);
      const bNum = Number(b);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return aNum - bNum;
      }
      return a.localeCompare(b);
    });
  }, [value, comparables]);

  // Memoize path construction for keys to avoid recalculation
  const keyPaths = useMemo(() => {
    return allKeys.map(k => {
      const builtPath = parentPath
        ? parentPath + "." + sanitizePropertyKey(k)
        : makePrefixedDictPath(prefix, nestingLevel, k);
      
      return {
        key: k,
        path: builtPath
      };
    });
  }, [allKeys, parentPath, prefix, nestingLevel]);

  // Helper function to gather all paths for expand/collapse
  const gatherAllPaths = useCallback(() => {
    const subPaths: string[] = [];
    for (const k of allKeys) {
      const builtPath = parentPath
        ? parentPath + "." + sanitizePropertyKey(k)
        : makePrefixedDictPath(prefix, nestingLevel, k);
      subPaths.push(builtPath);

      // Add deeper nested paths if they exist
      const baseVal = value?.[k];
      const comps = comparables.map((c) => c?.[k]);
      
      if (isDict(baseVal) || isList(baseVal)) {
        if (comps.length > 0) {
          const nestedPaths = gatherAllSubPathsMulti(baseVal, comps, builtPath, prefix, nestingLevel + 1);
          subPaths.push(...nestedPaths);
        } else {
          const nestedPaths = gatherAllSubPaths(baseVal, builtPath, prefix, nestingLevel + 1);
          subPaths.push(...nestedPaths);
        }
      }
    }
    return subPaths;
  }, [allKeys, parentPath, prefix, nestingLevel, value, comparables]);

  // This effect shouldn't run when displayMode changes
  useEffect(() => {
    if (!inTraceView) {
      // When not in TraceView, rely on parent context
      return;
    }
    
    // Handle local expand/collapse for TraceView mode
    if (traceForceExpandAll) {
      const paths = gatherAllPaths();  
      effectiveExpandRecursively(paths);
    } else if (traceForceCollapseAll) {
      const paths = gatherAllPaths();
      effectiveCollapseRecursively(paths);
    }
  }, [traceForceExpandAll, traceForceCollapseAll, inTraceView]);

  // Check if we have comparables => multi-mode
  const multiMode = comparables.some((c) => c !== undefined);

  // Build the open values array for the accordion (using memoized keyPaths)
  const openValues = useMemo(() => {
    return keyPaths
      .filter(({ path }) => effectiveOpenKeys.has(path))
      .map(({ key }) => key);
  }, [keyPaths, effectiveOpenKeys]);

  // Memoize all rendered keys to prevent rerendering on display mode change
  const renderedKeys = useMemo(() => {
    return allKeys.map(k => {
      const baseVal = value?.[k];
      const comps = comparables.map((c) => c?.[k]);
      
      return multiMode 
        ? renderMultiKey(k, baseVal, comps)
        : renderSingleKey(k, baseVal);
    });
  }, [
    allKeys, 
    value, 
    comparables, 
    multiMode, 
    // The state needed for rendering but explicitly NOT including displayMode
    baseLogIndex,
    comparisonLogsIndex,
    diffMode,
    splitView,
    nestingLevel,
    version,
    comparableVersions,
    // Add the missing dependencies
    renderMultiKey,
    renderSingleKey
  ]);

  function renderSingleKey(k: string, baseVal: any) {
    if (baseVal === undefined) return null;

    const path = keyPaths.find(kp => kp.key === k)?.path || '';
    const isOpen = effectiveOpenKeys.has(path);
    const _valueType = getValueType(baseVal);
    const icon = getTypeIcon(_valueType);
    const isExpandable = isDict(baseVal) || isList(baseVal);
    
    // Get indentation classes based on nesting level
    const indentClass = getIndentClasses(nestingLevel);
    // Always use content indent for children
    const contentIndentClass = getContentIndentClasses(nestingLevel);

    function handleExpandToggle(e: React.MouseEvent) {
      e.stopPropagation();
      handleToggle(k, path);
    }

    return (
      <AccordionItem key={k} value={k} className="border-0">
        <AccordionTrigger
          onClick={handleExpandToggle}
          className="py-1.5 hover:no-underline"
        >
          <div className="flex items-center gap-2">
            <span className="text-primary">{icon}</span>
            <span className="text-sm font-mono">{k}</span>
          </div>
          {isExpandable && (
            <div
              className="absolute right-5 z-10"
              onClick={(e) => handleRecursiveExpandCollapse(e, k, baseVal, [])}
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
            {/* Use displayMode as a prop to child components */}
            {pickView({
              value: baseVal,
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
              parentPath: path, // pass fully-qualified path to children
            })}
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  }

  function renderMultiKey(k: string, baseVal: any, comps: any[]) {
    const path = keyPaths.find(kp => kp.key === k)?.path || '';
    const isOpen = effectiveOpenKeys.has(path);
    
    // Skip completely if everyone is undefined
    if (!baseVal && comps.every((c) => !c)) {
      return null;
    }

    // Type indicator
    const unifiedType = unifyType(baseVal, comps);
    const icon = getTypeIcon(unifiedType);
    const isExpandable = ["dict", "list"].includes(unifiedType);

    // Presence/absence highlighting indicators
    const presenceInfo = presenceDiff(baseVal, comps, baseLogIndex, comparisonLogsIndex);

    // Base element present?
    const isInBase = baseVal !== undefined;

    // Indentation handling
    const indentClass = getIndentClasses(nestingLevel);
    const contentIndentClass = getContentIndentClasses(nestingLevel);

    function handleExpandToggle(e: React.MouseEvent) {
      e.stopPropagation();
      handleToggle(k, path);
    }

    return (
      <AccordionItem className={indentClass} key={k} value={k}>
        <AccordionTrigger
          className={`text-sm ${isExpandable ? "cursor-pointer" : "cursor-default no-underline"}`}
          onClick={isExpandable ? handleExpandToggle : undefined}
        >
          <div className="flex items-center mr-auto">
            <div className="flex items-center">
              <span className="text-primary">{icon}</span>
              <span className="block ml-2 font-medium">{k}</span>
              <div className="flex items-center gap-1 ml-2">
                {isInBase ? (
                  <RowBadge rowNumbers={[baseLogIndex]} mode="base" />
                ) : null}
                {presenceInfo.redRows.length > 0 && <RowBadge rowNumbers={presenceInfo.redRows} mode="delete" />}
                {presenceInfo.greenRows.length > 0 && <RowBadge rowNumbers={presenceInfo.greenRows} mode="insert" />}
              </div>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent
          className={contentIndentClass}
          {... !isExpandable ? { forceMount: true } : {}}
        >
          <div className="mt-2">
            {pickView({
              value: baseVal,
              comparables: comps,
              baseLogIndex,
              comparisonLogsIndex,
              diffMode,
              splitView,
              displayMode,
              version,
              comparableVersions,
              nestingLevel: nestingLevel + 1,
              prefix,
              parentPath: path, // pass fully-qualified path to children
            })}
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  }

  function handleToggle(propertyKey: string, builtPath: string) {
    effectiveToggleKey(builtPath);
  }

  // Memoize recursive expand/collapse handlers to prevent recreation on displayMode changes
  const handleRecursiveExpandCollapse = useCallback((e: React.MouseEvent, propertyKey: string, itemValue: any, itemComparables: any[]) => {
    const path = parentPath
      ? parentPath + "." + sanitizePropertyKey(propertyKey)
      : makePrefixedDictPath(prefix, nestingLevel, propertyKey);

    const currentValue = value?.[propertyKey];
    const currentComparables = comparables.map((c) => c?.[propertyKey]);
    
    handleRecursiveToggle(
      e,
      path,
      currentValue,
      currentComparables,
      prefix,
      nestingLevel + 1,
      effectiveExpandRecursively,
      effectiveCollapseRecursively,
      effectiveOpenKeys
    );
  }, [parentPath, prefix, nestingLevel, effectiveExpandRecursively, effectiveCollapseRecursively, effectiveOpenKeys]);

  if (diffMode === "none") {
    return renderNoDiffMode(
      allKeys,
      value,
      comparables,
      [baseLogIndex, ...comparisonLogsIndex],
      effectiveOpenKeys,
      effectiveSetOpenKeys,
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
        expandRecursively: effectiveExpandRecursively,
        collapseRecursively: effectiveCollapseRecursively,
      }
    );
  }

  // No need to add displayMode as a dependency here
  return (
    <Accordion type="multiple" value={openValues} onValueChange={() => {}}>
      <div className="flex flex-col">
        {renderedKeys.map((item, idx) => (
          <div key={`key-${idx}`} className={getSeparatorClasses(idx, renderedKeys.length)}>
            {item}
          </div>
        ))}
      </div>
    </Accordion>
  );
}
