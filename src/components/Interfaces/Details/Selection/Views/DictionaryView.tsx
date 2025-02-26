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
  isDict,
  isList,
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
  makePrefixedDictPath,
  sanitizePropertyKey,
} from "@/utils/evals/pathUtils";
import { useExpandContextSelector } from "@/contexts/ExpandContext";

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
  baseValue: unknown,
  comparables: unknown[],
  path: string,
  prefix: string,
  nestingLevel: number,
  openKeys: Set<string>,
  setOpenKeys: React.Dispatch<React.SetStateAction<Set<string>>>
) {
  // gather any subpaths under "path"
  let subPaths: string[];
  if (comparables && comparables.length > 0) {
    // In multi-mode, use gatherAllSubPathsMulti to include all keys
    subPaths = gatherAllSubPathsMulti(baseValue, comparables, path, prefix, nestingLevel);
  } else {
    // In single-mode, use the original method
    subPaths = gatherAllSubPaths(baseValue, path, prefix, nestingLevel);
  }
  
  // check if all are open
  const allOpen = subPaths.every((sp) => openKeys.has(sp));

  setOpenKeys((prev) => {
    const next = new Set(prev);
    if (allOpen) {
      // collapse - remove them
      subPaths.forEach((sp) => {
        next.delete(sp);
      });
    } else {
      // expand - add them
      subPaths.forEach((sp) => {
        next.add(sp);
      });
    }
    return next;
  });
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
  // Use context selectors to only subscribe to the parts of the context we need
  const openKeys = useExpandContextSelector(ctx => ctx.openKeys);
  const setOpenKeys = useExpandContextSelector(ctx => ctx.setOpenKeys);
  const forceExpandAll = useExpandContextSelector(ctx => ctx.forceExpandAll);
  const forceCollapseAll = useExpandContextSelector(ctx => ctx.forceCollapseAll);

  // Check if base is a dict first but don't return early
  const isValidDict = isDict(value);

  const singleMode = !comparables || comparables.length === 0;

  // gather union of all dictionary keys - handle invalid dict case inside
  const { allKeys, rowIndices } = useMemo(() => {
    if (!isValidDict) {
      return { allKeys: [], rowIndices: [] };
    }
    
    if (singleMode) {
      const baseObjKeys = Object.keys(value).sort();
      return {
        allKeys: baseObjKeys,
        rowIndices: [baseLogIndex],
      };
    } else {
      const arr = [value, ...comparables];
      const union = new Set<string>();
      arr.forEach((dict) => {
        if (dict && typeof dict === "object" && !Array.isArray(dict)) {
          Object.keys(dict).forEach((k) => union.add(k));
        }
      });
      const sortedKeys = Array.from(union).sort();
      return {
        allKeys: sortedKeys,
        rowIndices: [baseLogIndex, ...comparisonLogsIndex],
      };
    }
  }, [value, comparables, singleMode, baseLogIndex, comparisonLogsIndex, isValidDict]);

  // On mount or if forceExpandAll/forceCollapseAll changes => one pass
  // Always call useEffect, but conditionally execute its body
  useEffect(() => {
    if (!isValidDict) return;
    
    if (forceExpandAll || forceCollapseAll) {
      // Use parentPath directly as the root path for gathering subpaths
      // This ensures consistency with the top-level property path
      if (parentPath) {
        const newSet = new Set(openKeys);
        
        // Choose the appropriate path gathering function based on mode
        let subPaths: string[];
        if (!singleMode) {
          // In multi-mode, use gatherAllSubPathsMulti to include keys from comparables
          subPaths = gatherAllSubPathsMulti(value, comparables, parentPath, prefix, nestingLevel);
        } else {
          // In single-mode, use the original gatherAllSubPaths
          subPaths = gatherAllSubPaths(value, parentPath, prefix, nestingLevel);
        }

        if (forceExpandAll) {
          // expand all subpaths
          subPaths.forEach((sp) => newSet.add(sp));
        } else {
          // collapse all subpaths
          subPaths.forEach((sp) => newSet.delete(sp));
        }

        setOpenKeys(newSet);
      }
    }
  }, [forceExpandAll, forceCollapseAll, openKeys, parentPath, prefix, nestingLevel, value, comparables, singleMode, isValidDict, setOpenKeys]);

  /*─────────────────────────────────────────────────────────────────────────
    renderSingleKey => only base has data
  ──────────────────────────────────────────────────────────────────────────*/
  function renderSingleKey(k: string) {
    const baseVal = (value as Record<string, unknown>)[k];
    const type = unifyType(baseVal, []);
    const icon = getTypeIcon(type);

    // Build a fully qualified path that includes the parent's path if present
    const path = parentPath
      ? parentPath + "." + sanitizePropertyKey(k) // e.g. "entries.dict.0.a.sub_question"
      : makePrefixedDictPath(prefix, nestingLevel, k);

    const isOpen = openKeys.has(path);

    function handleExpandToggle(e: React.MouseEvent) {
      e.stopPropagation();
      handleRecursiveToggle(
        baseVal,
        [],
        path,
        prefix,
        nestingLevel,
        openKeys,
        setOpenKeys
      );
    }

    // Build tooltip text
    const isPathOpen = openKeys.has(path);

    return (
      <AccordionItem key={k} value={path}>
        <AccordionTrigger className="relative group flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            {icon} {k}
          </span>
          {(type === "dict" || type === "list") && (
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
          <div className="border-l ml-4 pl-1">
            {pickView({
              value: baseVal,
              comparables: [],
              baseLogIndex,
              comparisonLogsIndex: [],
              version,
              comparableVersions,
              diffMode,
              splitView,
              displayMode,
              nestingLevel: nestingLevel + 1,
              prefix,
              parentPath: path, // pass the newly built path on
            })}
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  }

  /*─────────────────────────────────────────────────────────────────────────
    renderMultiKey => presence diff
  ──────────────────────────────────────────────────────────────────────────*/
  function renderMultiKey(k: string) {
    const dictVals = [value, ...comparables];
    const fieldVals = dictVals.map((d) => (d && isDict(d) ? d[k] : undefined));
    const baseVal = fieldVals[0];
    const compVals = fieldVals.slice(1);

    const { redRows, greenRows } = presenceDiff(
      baseVal,
      compVals,
      rowIndices[0],
      rowIndices.slice(1)
    );

    let labelColor = "";
    const baseHas = baseVal !== undefined;
    if (baseHas && redRows.length > 0) {
      labelColor = "text-red-600";
    } else if (!baseHas && greenRows.length > 0) {
      labelColor = "text-green-600";
    }

    const propType = unifyType(baseVal, compVals);
    const icon = getTypeIcon(propType);

    // Build path that includes parent.
    const path = parentPath
      ? parentPath + "." + sanitizePropertyKey(k)
      : makePrefixedDictPath(prefix, nestingLevel, k);

    const isOpen = openKeys.has(path);

    function handleExpandToggle(e: React.MouseEvent) {
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

    // Build tooltip text
    const isPathOpen = openKeys.has(path);

    return (
      <AccordionItem key={k} value={path}>
        <AccordionTrigger
          className={`relative group flex items-center justify-between ${labelColor}`}
        >
          <span className="inline-flex items-center gap-2">
            {icon} {k}
            {(redRows.length > 0 || greenRows.length > 0) && (
              <div className="ml-2 flex gap-1">
                {redRows.length > 0 && <RowBadge rowNumbers={redRows} mode="delete" />}
                {greenRows.length > 0 && <RowBadge rowNumbers={greenRows} mode="insert" />}
              </div>
            )}
          </span>
          {(propType === "dict" || propType === "list") && (
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
          <div className="border-l ml-4 pl-1">
            {pickView({
              value: baseVal,
              comparables: compVals,
              baseLogIndex: rowIndices[0],
              comparisonLogsIndex: rowIndices.slice(1),
              version,
              comparableVersions,
              diffMode,
              splitView,
              displayMode,
              nestingLevel: nestingLevel + 1,
              prefix,
              parentPath: path, // pass forward
            })}
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  }

  /*─────────────────────────────────────────────────────────────────────────
    Build final
  ──────────────────────────────────────────────────────────────────────────*/
  const openValues = useMemo(() => {
    // If not a valid dictionary, return empty array
    if (!isValidDict) return [];
    
    // Gather all keys => build path => check if open
    // But we rely on the <Accordion value> = path approach:
    // So we only keep the ones that are in openKeys
    const paths = allKeys
      .map((k) => {
        // same logic as in renderSingleKey / renderMultiKey
        const builtPath = parentPath
          ? parentPath + "." + sanitizePropertyKey(k)
          : makePrefixedDictPath(prefix, nestingLevel, k);
        return builtPath;
      })
      .filter((p) => openKeys.has(p));
    return paths;
  }, [allKeys, openKeys, parentPath, prefix, nestingLevel, isValidDict]);

  // Return with conditional rendering based on isValidDict
  return (
    <div className="flex flex-col gap-2">
      {!isValidDict ? (
        <p className="text-red-500">
          DictionaryView: base value is not a dictionary.
        </p>
      ) : (
        <Accordion
          type="multiple"
          value={openValues}
          onValueChange={(newVals) => {
            const oldSet = new Set(openValues);
            const nextSet = new Set(newVals);
            const changedAdded = Array.from(nextSet).filter((v) => !oldSet.has(v));
            const changedRemoved = Array.from(oldSet).filter((v) => !nextSet.has(v));
            setOpenKeys((prev) => {
              const updated = new Set(prev);
              changedAdded.forEach((v) => {
                updated.add(v);
              });
              changedRemoved.forEach((v) => {
                updated.delete(v);
              });
              return updated;
            });
          }}
        >
          {allKeys.map((k) => (
            singleMode ? renderSingleKey(k) : renderMultiKey(k)
          ))}
        </Accordion>
      )}
    </div>
  );
}
