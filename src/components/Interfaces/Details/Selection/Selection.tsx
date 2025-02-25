import React, {
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
  Dispatch,
  SetStateAction,
} from "react";
import { LogProps } from "@/types/evals/logs";
import SelectionHints from "./Hints";
import SelectionEntry from "./SelectionEntry";
import { Accordion } from "@/components/UI/accordion";
import ActionButton from "@/components/Common/Buttons/Action";
import { Combobox } from "@/components/UI/Combobox";
import { sanitizeId } from "@/utils/evals/columnOperations";
import {
  FoldVertical,
  UnfoldVertical,
  FileText,
  CaseLower,
  Pilcrow,
  Columns,
  AlignJustify,
  SquareSplitHorizontal,
  Code,
  SquareSlash,
  Type,
  RemoveFormatting,
  Rows3,
  GripVertical,
  Grab,
} from "lucide-react";
import { BasePopover } from "@/components/Common/Popovers/Base";
import { Switch } from "@/components/UI/switch";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TileProps, ItemType } from "@/types/evals/grid";

import { useExpandContext } from "@/contexts/ExpandContext";
import {
  makePrefixedDictPath,
  gatherAllSubPaths,
  gatherAllSubPathsMulti,
} from "@/utils/evals/pathUtils";

/*******************************************************************************
 * Helper & Utility Functions
 ******************************************************************************/

/** Basic logging utility for debugging. */
function debugLog(area: string, msg: string, data?: any) {
  console.log(`[Selection:${area}]`, msg, data ?? "");
}

/** Data shape checks from both old & new code. */
function isDict(val: any): boolean {
  return val && typeof val === "object" && !Array.isArray(val);
}
function isList(val: any): boolean {
  return Array.isArray(val);
}
function isMatrix(val: any): boolean {
  return isList(val) && val.length > 0 && Array.isArray(val[0]);
}
function isImage(val: any): boolean {
  return typeof val === "string" && val.startsWith("data:image/");
}
function isTrace(val: any): boolean {
  // originally always false in old code
  return false;
}
function isNumber(val: any): boolean {
  return typeof val === "number" || val instanceof Number;
}

/** Possibly used for param expansions from the old code. */
function unwrapSingleKeyObject(val: unknown) {
  if (val && typeof val === "object" && !Array.isArray(val)) {
    const keys = Object.keys(val);
    if (keys.length === 1 && keys[0] === "0") {
      return (val as Record<string, unknown>)["0"];
    }
  }
  return val;
}

/** For row labeling in combobox, etc. */
function rowLabel(rowIndex: number) {
  return `Row ${rowIndex + 1}`;
}

/** Shallow compare for array of strings. */
function shallowArrayEquals(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

/** Shallow compare for boolean record objects. */
function shallowEqualBooleanRecords(
  a: Record<string, boolean>,
  b: Record<string, boolean>
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

/**
 * Parse the selection string into a map:
 *   rowIndex => Set of column names selected
 */
function buildIndexToColumnsMapFromId(
  selectedCells: string[],
  sortedLogs: LogProps[]
): Record<number, Set<string>> {
  const map: Record<number, Set<string>> = {};
  for (const token of selectedCells) {
    const underscorePos = token.indexOf("_");
    if (underscorePos < 1) continue;
    const logIdStr = token.slice(0, underscorePos);

    let columnName = token.slice(underscorePos + 1);
    const slashPos = columnName.indexOf("/");
    if (slashPos >= 0) {
      columnName = columnName.slice(slashPos + 1).trim();
    }

    const rowIndex = sortedLogs.findIndex((log) => String(log.id) === logIdStr);
    if (rowIndex < 0) continue;
    if (!map[rowIndex]) {
      map[rowIndex] = new Set<string>();
    }
    map[rowIndex].add(columnName);
  }
  return map;
}

/** Build row selection order from the selected cells. */
function buildRowIndicesInSelectionOrder(
  selectedCells: string[],
  sortedLogs: LogProps[]
): number[] {
  const seen = new Set<number>();
  const rowIndices: number[] = [];
  for (const token of selectedCells) {
    const underscorePos = token.indexOf("_");
    if (underscorePos < 1) continue;
    const logIdStr = token.slice(0, underscorePos);
    const rowIndex = sortedLogs.findIndex((log) => String(log.id) === logIdStr);
    if (rowIndex < 0) continue;
    if (!seen.has(rowIndex)) {
      seen.add(rowIndex);
      rowIndices.push(rowIndex);
    }
  }
  return rowIndices;
}

/*******************************************************************************
 * buildLogWithChosenColumns
 *   From original code, merges param expansions and hidden/ordered columns.
 ******************************************************************************/
function buildLogWithChosenColumns(
  originalLog: LogProps,
  rowIndex: number,
  globalParams: Record<string, unknown>,
  indexToColumns: Record<number, Set<string>>,
  columnOrdering: string[],
  hiddenColumns: string[]
): LogProps {
  const chosen = indexToColumns[rowIndex] ?? new Set<string>();
  const safeEntries = originalLog.entries ?? {};

  const afterHiddenEntries = Array.from(chosen).filter(
    (c) => !hiddenColumns.includes(c)
  );

  const finalColsEntries =
    columnOrdering.length > 0
      ? columnOrdering
          .filter((c) => afterHiddenEntries.includes(c))
          .map(sanitizeId)
      : afterHiddenEntries.map(sanitizeId);

  const newEntries: Record<string, unknown> = {};
  for (const c of finalColsEntries) {
    if (Object.prototype.hasOwnProperty.call(safeEntries, c)) {
      newEntries[c] = safeEntries[c];
    }
  }

  const safeParams = originalLog.params ?? {};
  const afterHiddenParams = Array.from(chosen).filter(
    (c) => !hiddenColumns.includes(c)
  );
  const finalColsParams =
    columnOrdering.length > 0
      ? columnOrdering
          .filter((c) => afterHiddenParams.includes(c))
          .map(sanitizeId)
      : afterHiddenParams.map(sanitizeId);

  const newParams: Record<string, unknown> = {};
  for (const c of finalColsParams) {
    if (!Object.prototype.hasOwnProperty.call(safeParams, c)) {
      continue;
    }
    const storedVal = safeParams[c];
    if (typeof storedVal === "string" && globalParams.hasOwnProperty(c)) {
      const candidateObj = globalParams[c];
      if (candidateObj && typeof candidateObj === "object") {
        if ((candidateObj as Record<string, unknown>).hasOwnProperty(storedVal)) {
          newParams[c] = {
            paramValue: (candidateObj as Record<string, unknown>)[storedVal],
            paramVersion: unwrapSingleKeyObject(storedVal),
          };
          continue;
        }
      }
    }
    newParams[c] = unwrapSingleKeyObject(storedVal);
  }

  return {
    ...originalLog,
    entries: newEntries,
    params: newParams,
  };
}

/*******************************************************************************
 * Main "Selection" Component
 *   - Merged logic from old & new code
 ******************************************************************************/
export default function Selection({
  params,
  logs,
  selection_,
  baseIndex_,
  columnOrdering_,
  hiddenColumns_,
  tableItem,
  item,
  updateItem,
}: {
  params: Record<string, unknown>;
  logs: LogProps[];
  selection_: string | undefined;
  baseIndex_: string | undefined;
  columnOrdering_: string | undefined;
  hiddenColumns_: string | undefined;
  tableItem: TileProps | undefined;
  item: TileProps;
  updateItem: (item: TileProps, attrName: ItemType) => (
    newValue: string | undefined
  ) => void;
}) {
  /*******************************************************************************
   * Prepare sorted logs & selection data
   ******************************************************************************/
  const sortedLogs = useMemo(() => [...logs], [logs]);

  // Get expand context at the top level to use across the component
  const expandContext = useExpandContext();
  const { openKeys, setOpenKeys, forceExpandAll, forceCollapseAll } = expandContext;

  const selectedCells = useMemo(() => {
    const arr = selection_ ? selection_.split(",") : [];
    debugLog("selection", "Parsed selected cells:", arr);
    return arr;
  }, [selection_]);

  const indexToColumns = useMemo(() => {
    const map = buildIndexToColumnsMapFromId(selectedCells, sortedLogs);
    debugLog("columns", "Index->Columns map:", map);
    return map;
  }, [selectedCells, sortedLogs]);

  const selectedRowIndices = useMemo(() => {
    const arr = buildRowIndicesInSelectionOrder(selectedCells, sortedLogs);
    debugLog("rows", "Row selection order:", arr);
    return arr;
  }, [selectedCells, sortedLogs]);

  const columnOrdering = useMemo(() => {
    return columnOrdering_ ? columnOrdering_.split(",") : [];
  }, [columnOrdering_]);

  const hiddenColumns = useMemo(() => {
    return hiddenColumns_ ? hiddenColumns_.split(",") : [];
  }, [hiddenColumns_]);

  /*******************************************************************************
   * Panel & Display States
   ******************************************************************************/
  const [panelCount, setPanelCount] = useState(1);
  const [panels, setPanels] = useState<{baseRowIndex: number}[]>([{baseRowIndex: selectedRowIndices[0]}]);

  // Distinguish "display mode" from "diff mode" 
  // The user can cycle display among markdown/text/raw
  const [displayMode, setDisplayMode] = useState<"markdown" | "text" | "raw">(
    "markdown"
  );

  // The old code's diffMode cycles among: none/lines/words/characters
  type DiffMode = "none" | "lines" | "words" | "characters";
  const allDiffModes: DiffMode[] = ["none", "lines", "words", "characters"];
  const [diffModeIdx, setDiffModeIdx] = useState(0);
  const diffMode = allDiffModes[diffModeIdx];

  // Toggle inline vs. split diff
  const [splitView, setSplitView] = useState(false);

  // Edit mode, which we unify from both codebases
  const [editMode, setEditMode] = useState(false);

  // Because the new code uses ExpandContext, we must forcibly close all expansions
  // when edit mode turns ON, and restore them when edit mode turns OFF.
  const [savedOpenKeys, setSavedOpenKeys] = useState<Set<string>>(new Set());

  // Update panels when panelCount changes
  useEffect(() => {
    setPanels(Array.from({ length: panelCount }).map(() => ({ baseRowIndex: selectedRowIndices[0] })));
  }, [panelCount, selectedRowIndices]);

  function toggleEditMode() {
    if (!editMode) {
      // turning ON => save current expansions, then close them all
      setSavedOpenKeys(new Set(openKeys));
      setOpenKeys(new Set()); // forcibly close all expansions
      setEditMode(true);
    } else {
      // turning OFF => restore expansions
      setOpenKeys(savedOpenKeys);
      setSavedOpenKeys(new Set());
      setEditMode(false);
    }
  }

  /*******************************************************************************
   * Show/hide columns toggles for entries/params
   ******************************************************************************/
  const [entriesFilter, setEntriesFilter] = useState<Record<string, boolean>>({});
  const [paramsFilter, setParamsFilter] = useState<Record<string, boolean>>({});

  // Determine the base row index
  let baseIndexParam = 0;
  if (baseIndex_ && !isNaN(parseInt(baseIndex_, 10))) {
    baseIndexParam = parseInt(baseIndex_, 10);
  }
  if (item.base_index && !isNaN(parseInt(item.base_index, 10))) {
    baseIndexParam = parseInt(item.base_index, 10);
  }
  if (baseIndexParam < 0 || baseIndexParam >= selectedRowIndices.length) {
    baseIndexParam = 0;
  }
  const baseRowIndex = selectedRowIndices[baseIndexParam] ?? -1;
  const baseLog = baseRowIndex >= 0 ? sortedLogs[baseRowIndex] : null;

  // For default toggles, gather keys from base (entries & params)
  const entryKeysFromBase = useMemo(() => {
    return baseLog ? Object.keys(baseLog.entries ?? {}) : [];
  }, [baseLog]);
  const paramKeysFromBase = useMemo(() => {
    return baseLog ? Object.keys(baseLog.params ?? {}) : [];
  }, [baseLog]);

  // Ensure filters have defaults for any new keys
  useEffect(() => {
    if (!baseLog) return;

    const updatedE: Record<string, boolean> = { ...entriesFilter };
    entryKeysFromBase.forEach((k) => {
      if (!(k in updatedE)) updatedE[k] = true;
    });
    Object.keys(updatedE).forEach((k) => {
      if (!entryKeysFromBase.includes(k)) {
        delete updatedE[k];
      }
    });

    const updatedP: Record<string, boolean> = { ...paramsFilter };
    paramKeysFromBase.forEach((k) => {
      if (!(k in updatedP)) updatedP[k] = true;
    });
    Object.keys(updatedP).forEach((k) => {
      if (!paramKeysFromBase.includes(k)) {
        delete updatedP[k];
      }
    });

    if (!shallowEqualBooleanRecords(updatedE, entriesFilter)) {
      setEntriesFilter(updatedE);
    }
    if (!shallowEqualBooleanRecords(updatedP, paramsFilter)) {
      setParamsFilter(updatedP);
    }
  }, [baseLog, entryKeysFromBase, paramKeysFromBase, entriesFilter, paramsFilter]);

  /*******************************************************************************
   * Global reorder state (from old code)
   ******************************************************************************/
  const [globalEntryOrderings, setGlobalEntryOrderings] = useState<{
    [key: string]: string[];
  }>({});
  const [globalParamOrderings, setGlobalParamOrderings] = useState<{
    [key: string]: string[];
  }>({});

  /*******************************************************************************
   * Expand/Collapse at top-level for entire "Entries" or "Params" sections
   ******************************************************************************/
  function isAllEmpty(val: any) {
    if (val === null || val === undefined) return true;
    if (typeof val === "string" && !val.trim()) return true;
    return false;
  }

  function gatherSubpathsForProperty(isParams: boolean, propName: string) {
    // Check if we're dealing with params and if baseLog even exists
    if (!baseLog) return new Set<string>();
    
    // Decide whether to use "entries" or "params"
    const propContainer = isParams ? (baseLog.params || {}) : (baseLog.entries || {});
    // Find the raw value for the target property
    const raw = propContainer[propName];
    
    // For params, unwrap the .paramValue
    const rawVal = isParams && raw && typeof raw === "object" ? raw.paramValue : raw;
    
    // Empty? Nothing to expand.
    if (!rawVal) return new Set<string>();
    
    // Build the appropriate root path for this property
    const prefixStr = isParams ? "params" : "entries";
    const rootPath = makePrefixedDictPath(prefixStr, 0, propName);
    
    // For multi-mode path gathering
    const compareProps = panels.filter(sp => {
      return sp.baseRowIndex !== baseIndexParam && sp.baseRowIndex >= 0;
    });
    
    let comparables: any[] = [];
    
    // For multi-mode, gather comparable values from the selected logs
    if (compareProps.length > 0) {
      comparables = compareProps.map(sp => {
        const log = sortedLogs[sp.baseRowIndex];
        if (!log) return undefined;
        
        const container = isParams ? (log.params || {}) : (log.entries || {});
        const val = container[propName];
        return isParams && val && typeof val === "object" ? val.paramValue : val;
      }).filter(v => v !== undefined);
    }
    
    // Now gather all subpaths - use gatherAllSubPathsMulti if we have comparables
    let subPaths: string[];
    if (comparables.length > 0) {
      subPaths = gatherAllSubPathsMulti(rawVal, comparables, rootPath, prefixStr, 0);
    } else {
      subPaths = gatherAllSubPaths(rawVal, rootPath, prefixStr, 0);
    }
    
    console.log(`[Selection:gatherSubpathsForProperty] ${propName}`, {
      isParams,
      rootPath,
      subPathCount: subPaths.length,
      hasComparables: comparables.length > 0
    });
    
    return new Set(subPaths);
  }

  function areAllOpen_Entries(): boolean {
    if (editMode) return false;
    if (!baseLog) return false;
    if (forceExpandAll) return true;
    const visibleE = entryKeysFromBase.filter((k) => entriesFilter[k] !== false);
    if (!visibleE.length) return false;
    
    // Check both the top-level items and their subpaths
    const subPathSet = new Set<string>();
    
    // Include paths for the top-level entries themselves
    const prefixStr = "entries";
    visibleE.forEach((k) => {
      // Add the root path for this entry
      const rootPath = makePrefixedDictPath(prefixStr, 0, k);
      subPathSet.add(rootPath);
      
      // Also add all subpaths
      const spList = gatherSubpathsForProperty(false, k);
      spList.forEach((sp) => subPathSet.add(sp));
    });

    return subPathSet.size > 0 && Array.from(subPathSet).every((sp) => openKeys.has(sp));
  }

  function onEntriesExpandToggle() {
    if (editMode) return;
    if (!baseLog) return;
    
    const visibleE = entryKeysFromBase.filter((k) => entriesFilter[k] !== false);
    const subPathSet = new Set<string>();
    
    // Include paths for the top-level entries themselves
    const prefixStr = "entries";
    visibleE.forEach((k) => {
      // Add the root path for this entry
      const rootPath = makePrefixedDictPath(prefixStr, 0, k);
      subPathSet.add(rootPath);
      
      // Also add all subpaths
      const spList = gatherSubpathsForProperty(false, k);
      spList.forEach((sp) => subPathSet.add(sp));
    });
    
    const currentlyAllOpen = areAllOpen_Entries();
    
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (currentlyAllOpen) {
        subPathSet.forEach((sp) => next.delete(sp));
      } else {
        subPathSet.forEach((sp) => next.add(sp));
      }
      return next;
    });
  }

  function areAllOpen_Params(): boolean {
    if (editMode) return false;
    if (!baseLog) return false;
    if (forceExpandAll) return true;
    const visibleP = paramKeysFromBase.filter((k) => paramsFilter[k] !== false);
    if (!visibleP.length) return false;
    
    // Check both the top-level items and their subpaths
    const subPathSet = new Set<string>();
    
    // Include paths for the top-level params themselves
    const prefixStr = "params";
    visibleP.forEach((k) => {
      // Add the root path for this param
      const rootPath = makePrefixedDictPath(prefixStr, 0, k);
      subPathSet.add(rootPath);
      
      // Also add all subpaths
      const spList = gatherSubpathsForProperty(true, k);
      spList.forEach((sp) => subPathSet.add(sp));
    });

    return subPathSet.size > 0 && Array.from(subPathSet).every((sp) => openKeys.has(sp));
  }

  function onParamsExpandToggle() {
    if (editMode) return;
    if (!baseLog) return;
    
    const visibleP = paramKeysFromBase.filter((k) => paramsFilter[k] !== false);
    const subPathSet = new Set<string>();
    
    // Include paths for the top-level params themselves
    const prefixStr = "params";
    visibleP.forEach((k) => {
      // Add the root path for this param
      const rootPath = makePrefixedDictPath(prefixStr, 0, k);
      subPathSet.add(rootPath);
      
      // Also add all subpaths
      const spList = gatherSubpathsForProperty(true, k);
      spList.forEach((sp) => subPathSet.add(sp));
    });
    
    const currentlyAllOpen = areAllOpen_Params();
    
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (currentlyAllOpen) {
        subPathSet.forEach((sp) => next.delete(sp));
      } else {
        subPathSet.forEach((sp) => next.add(sp));
      }
      return next;
    });
  }

  // Helper function for accordion values
  const getAccordionValue = useCallback((filtered: string[], isParams: boolean) => {
    return filtered.filter(col => {
      const paths = gatherSubpathsForProperty(isParams, col);
      return Array.from(paths).some(path => openKeys.has(path));
    });
  }, [openKeys, gatherSubpathsForProperty]);

  // Helper function for accordion value changes
  const handleAccordionValueChange = useCallback((newVals: string[], filtered: string[], isParams: boolean) => {
    const currentValues = new Set(getAccordionValue(filtered, isParams));
    const newValues = new Set(newVals);
    
    // Find added and removed values
    const added = Array.from(newValues).filter(val => !currentValues.has(val));
    const removed = Array.from(currentValues).filter(val => !newValues.has(val));
    
    setOpenKeys(prev => {
      const next = new Set(prev);
      
      // For added values, add all their paths
      added.forEach(col => {
        const paths = gatherSubpathsForProperty(isParams, col);
        Array.from(paths).forEach(path => next.add(path));
      });
      
      // For removed values, remove all their paths
      removed.forEach(col => {
        const paths = gatherSubpathsForProperty(isParams, col);
        Array.from(paths).forEach(path => next.delete(path));
      });
      
      return next;
    });
  }, [openKeys, setOpenKeys, getAccordionValue, gatherSubpathsForProperty]);

  /*******************************************************************************
   * If no rows selected, just show hints
   ******************************************************************************/
  if (!selectedRowIndices.length) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background rounded-md">
        <SelectionHints />
      </div>
    );
  }

  /*******************************************************************************
   * Top bar for toggles
   ******************************************************************************/
  return (
    <div className="flex flex-col w-full h-full overflow-hidden bg-background rounded-md">
      {/* Top bar */}
      <div className="p-2 border-b border-muted flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Selected {selectedRowIndices.length} row(s)
        </p>
        <div className="flex items-center gap-2">
          {/* Cycle display mode */}
          <ActionButton
            tooltip={
              displayMode === "raw"
                ? "Viewing as raw"
                : displayMode === "markdown"
                ? "Viewing as markdown"
                : "Viewing as text"
            }
            icon={
              displayMode === "raw" ? (
                <Code className="h-4 w-4" />
              ) : displayMode === "markdown" ? (
                <Type className="h-4 w-4" />
              ) : (
                <RemoveFormatting className="h-4 w-4" />
              )
            }
            onClick={() => {
              setDisplayMode((prev) => {
                if (prev === "markdown") return "text";
                if (prev === "text") return "raw";
                return "markdown";
              });
            }}
            variant="ghost"
            size="icon"
          />

          {/* Show/Hide columns Popover */}
          <BasePopover
            button={
              <ActionButton
                tooltip="Show / hide columns"
                icon={<Rows3 className="h-4 w-4" />}
                variant="ghost"
                size="icon"
              />
            }
          >
            <div className="flex flex-col gap-1 p-3">
              <p className="font-bold text-medium pb-1">Select visible columns</p>
              <div className="max-h-[60vh] overflow-y-auto pr-2">
                {/* Master toggle for all */}
                <div className="flex justify-between items-center mb-5 mt-3">
                  <span className="font-bold text-sm">
                    {entryKeysFromBase.every((k) => entriesFilter[k] !== false) &&
                    paramKeysFromBase.every((k) => paramsFilter[k] !== false)
                      ? "Hide all"
                      : "Show all"}
                  </span>
                  <Switch
                    checked={
                      entryKeysFromBase.every((k) => entriesFilter[k] !== false) &&
                      paramKeysFromBase.every((k) => paramsFilter[k] !== false)
                    }
                    onCheckedChange={(checked) => {
                      const newE: Record<string, boolean> = {};
                      entryKeysFromBase.forEach((k) => {
                        newE[k] = checked;
                      });
                      if (!shallowEqualBooleanRecords(newE, entriesFilter)) {
                        setEntriesFilter(newE);
                      }

                      const newP: Record<string, boolean> = {};
                      paramKeysFromBase.forEach((k) => {
                        newP[k] = checked;
                      });
                      if (!shallowEqualBooleanRecords(newP, paramsFilter)) {
                        setParamsFilter(newP);
                      }
                    }}
                  />
                </div>

                {/* Entries toggles */}
                <div className="mt-2">
                  <div className="flex justify-between items-center mb-1">
                    <p className="font-bold text-sm">Entries</p>
                    <Switch
                      checked={entryKeysFromBase.every(
                        (k) => entriesFilter[k] !== false
                      )}
                      onCheckedChange={(checked) => {
                        const newVal: Record<string, boolean> = {};
                        entryKeysFromBase.forEach((k) => {
                          newVal[k] = checked;
                        });
                        if (!shallowEqualBooleanRecords(newVal, entriesFilter)) {
                          setEntriesFilter(newVal);
                        }
                      }}
                    />
                  </div>
                  {entryKeysFromBase.map((k) => (
                    <div
                      key={k}
                      className="flex items-center justify-between py-1 pl-4"
                    >
                      <span className="text-sm max-w-[200px] truncate" title={k}>
                        {k}
                      </span>
                      <Switch
                        checked={entriesFilter[k] !== false}
                        onCheckedChange={(checked) => {
                          setEntriesFilter((prev) => {
                            if (prev[k] === checked) {
                              return prev;
                            }
                            const newObj = { ...prev, [k]: checked };
                            return newObj;
                          });
                        }}
                      />
                    </div>
                  ))}
                </div>

                {/* Params toggles */}
                {paramKeysFromBase.length > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between items-center mb-1">
                      <p className="font-bold text-sm">Params</p>
                      <Switch
                        checked={paramKeysFromBase.every(
                          (k) => paramsFilter[k] !== false
                        )}
                        onCheckedChange={(checked) => {
                          const newVal: Record<string, boolean> = {};
                          paramKeysFromBase.forEach((k) => {
                            newVal[k] = checked;
                          });
                          if (!shallowEqualBooleanRecords(newVal, paramsFilter)) {
                            setParamsFilter(newVal);
                          }
                        }}
                      />
                    </div>
                    {paramKeysFromBase.map((k) => (
                      <div
                        key={k}
                        className="flex items-center justify-between py-1 pl-4"
                      >
                        <span className="text-sm max-w-[200px] truncate" title={k}>
                          {k}
                        </span>
                        <Switch
                          checked={paramsFilter[k] !== false}
                          onCheckedChange={(checked) => {
                            setParamsFilter((prev) => {
                              if (prev[k] === checked) {
                                return prev;
                              }
                              const newObj = { ...prev, [k]: checked };
                              return newObj;
                            });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </BasePopover>

          {/* Cycle panel count */}
          <ActionButton
            tooltip={`Cycle panel count (currently: ${panelCount})`}
            icon={<SquareSplitHorizontal className="h-4 w-4" />}
            onClick={() => {
              setPanelCount((prev) => (prev === 3 ? 1 : prev + 1));
            }}
            variant="ghost"
            size="icon"
          />

          {/* Toggle Edit Mode (with forced close logic) */}
          <ActionButton
            tooltip={
              editMode
                ? "Edit mode active – drag and drop"
                : "Activate edit mode for sorting"
            }
            icon={<Grab className="h-4 w-4" />}
            onClick={toggleEditMode}
            variant={editMode ? "primary" : "ghost"}
            size="icon"
          />
        </div>
      </div>

      {/* Base row selection & diff controls - moved here from bottom */}
      {selectedRowIndices.length > 1 && (
        <div className="border-b border-muted bg-background px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Base:</span>
            <Combobox
              items={selectedRowIndices.map((rIdx, i) => ({
                value: rowLabel(rIdx),
                label: rowLabel(rIdx),
                dataIndex: i,
              }))}
              value={
                selectedRowIndices[baseRowIndex] !== undefined
                  ? rowLabel(selectedRowIndices[baseRowIndex])
                  : ""
              }
              onValueChange={(newLabel) => {
                const newIdx = selectedRowIndices.findIndex(
                  (r) => rowLabel(r) === newLabel
                );
                if (newIdx >= 0 && String(newIdx) !== item.base_index) {
                  updateItem(item, "base_index")(String(newIdx));
                }
              }}
              placeholder="Pick base row"
              className="w-[110px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <ActionButton
              tooltip={`Cycle diff mode (current: ${diffMode})`}
              icon={
                diffMode === "none"
                  ? <SquareSlash />
                  : diffMode === "lines"
                  ? <FileText />
                  : diffMode === "words"
                  ? <CaseLower />
                  : <Pilcrow />
              }
              onClick={() => {
                setDiffModeIdx((prev) => (prev + 1) % allDiffModes.length);
              }}
              variant="ghost"
              size="icon"
            />
            <ActionButton
              tooltip={splitView ? "Switch to Inline View" : "Switch to Split View"}
              icon={
                splitView ? (
                  <Columns className="h-4 w-4" />
                ) : (
                  <AlignJustify className="h-4 w-4" />
                )
              }
              onClick={() => setSplitView(!splitView)}
              variant="ghost"
              size="icon"
            />
          </div>
        </div>
      )}

      {/* Main content: multiple panels */}
      <div className="flex-1 flex flex-row gap-2 overflow-hidden">
        {Array.from({ length: panelCount }).map((_, idx) => (
          <SelectionPanel
            key={`panel-${idx}`}
            logs={logs}
            sortedLogs={sortedLogs}
            params={params}
            selectedRowIndices={selectedRowIndices}
            columnOrdering={columnOrdering}
            hiddenColumns={hiddenColumns}
            indexToColumns={indexToColumns}
            entriesFilter={entriesFilter}
            paramsFilter={paramsFilter}
            editMode={editMode}
            displayMode={displayMode}
            diffMode={diffMode}
            splitView={splitView}
            tableItem={tableItem}
            item={item}
            updateItem={updateItem}
            onEntriesExpandToggle={onEntriesExpandToggle}
            onParamsExpandToggle={onParamsExpandToggle}
            areAllOpenEntries={areAllOpen_Entries}
            areAllOpenParams={areAllOpen_Params}
            setEntriesFilter={setEntriesFilter}
            setParamsFilter={setParamsFilter}
            globalEntryOrderings={globalEntryOrderings}
            setGlobalEntryOrderings={setGlobalEntryOrderings}
            globalParamOrderings={globalParamOrderings}
            setGlobalParamOrderings={setGlobalParamOrderings}
            panelId={idx}
            panels={panels}
          />
        ))}
      </div>
    </div>
  );
}

/*******************************************************************************
 * "SelectionPanel" Subcomponent
 *   Merges the old & new param/entry building with reorder logic + expand toggles
 ******************************************************************************/
function SelectionPanel({
  panelId,
  logs,
  sortedLogs,
  params,
  selectedRowIndices,
  columnOrdering,
  hiddenColumns,
  indexToColumns,
  entriesFilter,
  paramsFilter,
  editMode,
  displayMode,
  diffMode,
  splitView,
  tableItem,
  item,
  updateItem,
  onEntriesExpandToggle,
  onParamsExpandToggle,
  areAllOpenEntries,
  areAllOpenParams,
  setEntriesFilter,
  setParamsFilter,
  globalEntryOrderings,
  setGlobalEntryOrderings,
  globalParamOrderings,
  setGlobalParamOrderings,
  panels,
}: {
  panelId: number;
  logs: LogProps[];
  sortedLogs: LogProps[];
  params: Record<string, unknown>;
  selectedRowIndices: number[];
  columnOrdering: string[];
  hiddenColumns: string[];
  indexToColumns: Record<number, Set<string>>;
  entriesFilter: Record<string, boolean>;
  paramsFilter: Record<string, boolean>;
  editMode: boolean;
  displayMode: "markdown" | "text" | "raw";
  diffMode: "none" | "lines" | "words" | "characters";
  splitView: boolean;
  tableItem: TileProps | undefined;
  item: TileProps;
  updateItem: (item: TileProps, attrName: ItemType) => (newValue: string | undefined) => void;
  onEntriesExpandToggle: () => void;
  onParamsExpandToggle: () => void;
  areAllOpenEntries: () => boolean;
  areAllOpenParams: () => boolean;
  setEntriesFilter: Dispatch<SetStateAction<Record<string, boolean>>>;
  setParamsFilter: Dispatch<SetStateAction<Record<string, boolean>>>;
  globalEntryOrderings: { [key: string]: string[] };
  setGlobalEntryOrderings: Dispatch<SetStateAction<{ [key: string]: string[] }>>;
  globalParamOrderings: { [key: string]: string[] };
  setGlobalParamOrderings: Dispatch<SetStateAction<{ [key: string]: string[] }>>;
  panels: {baseRowIndex: number}[];
}) {
  // Get the expand context at the SelectionPanel component level
  const { openKeys, setOpenKeys } = useExpandContext();

  // Add versions
  const version = "";
  const comparableVersions: string[] = [];

  // Create a local handleAccordionValueChange function
  const handleAccordionValueChange = (newVals: string[], filtered: string[], isParams: boolean) => {
    const next = new Set(openKeys);
    
    // For shallow toggling, only update the root path for each property
    filtered.forEach(prop => {
      const prefixStr = isParams ? "params" : "entries";
      const rootPath = makePrefixedDictPath(prefixStr, 0, prop);
      const shouldBeOpen = newVals.includes(prop);
      
      if (shouldBeOpen) {
        next.add(rootPath);
      } else {
        next.delete(rootPath);
      }
    });
    
    setOpenKeys(next);
  };

  // baseIndex from item/baseIndex
  let baseIndexParam = parseInt(item.base_index ?? "0", 10);
  if (isNaN(baseIndexParam)) {
    baseIndexParam = 0;
  }
  if (baseIndexParam < 0 || baseIndexParam >= selectedRowIndices.length) {
    baseIndexParam = 0;
  }

  const baseRowIndex = selectedRowIndices[baseIndexParam] ?? -1;

  const buildLogIfValid = useCallback(
    (rIdx: number) => {
      if (rIdx < 0 || rIdx >= logs.length) return null;
      return buildLogWithChosenColumns(
        logs[rIdx],
        rIdx,
        params,
        indexToColumns,
        columnOrdering,
        hiddenColumns
      );
    },
    [logs, params, indexToColumns, columnOrdering, hiddenColumns]
  );

  const baseLog = useMemo(() => buildLogIfValid(baseRowIndex), [
    baseRowIndex,
    buildLogIfValid,
  ]);

  const comparisonRowIndices = selectedRowIndices.filter(
    (_, i) => i !== baseIndexParam
  );
  const comparisonLogs = useMemo(() => {
    return comparisonRowIndices
      .map((ri) => buildLogIfValid(ri))
      .filter(Boolean) as LogProps[];
  }, [comparisonRowIndices, buildLogIfValid]);

  /** Helper to union all param or entry keys from base + comps */
  function gatherUnionOfKeys(
    baseObj: Record<string, unknown> | undefined,
    comps: (Record<string, unknown> | undefined)[]
  ): string[] {
    const s = new Set<string>();
    if (baseObj) {
      for (const k of Object.keys(baseObj)) {
        s.add(k);
      }
    }
    comps.forEach((c) => {
      if (c) {
        for (const k of Object.keys(c)) {
          s.add(k);
        }
      }
    });
    return Array.from(s).sort();
  }

  const entryKeys = useMemo(() => {
    if (!baseLog) return [];
    return gatherUnionOfKeys(
      baseLog.entries,
      comparisonLogs.map((cl) => cl.entries)
    );
  }, [baseLog, comparisonLogs]);

  const paramKeys = useMemo(() => {
    if (!baseLog) return [];
    return gatherUnionOfKeys(
      baseLog.params,
      comparisonLogs.map((cl) => cl.params)
    );
  }, [baseLog, comparisonLogs]);

  // Filter "visible" columns
  function visibleEntries(): string[] {
    return entryKeys.filter((col) => entriesFilter[col] !== false);
  }
  function visibleEntriesKey(): string {
    const arr = [...visibleEntries()].sort();
    return arr.join(",");
  }
  function visibleParams(): string[] {
    return paramKeys.filter((col) => paramsFilter[col] !== false);
  }
  function visibleParamsKey(): string {
    const arr = [...visibleParams()].sort();
    return arr.join(",");
  }

  // Local reorder states (the old code approach uses a global dictionary)
  const [entryOrder, setEntryOrder] = useState<string[]>([]);
  const [paramOrder, setParamOrder] = useState<string[]>([]);

  // On mount / filter change, load from global reorder or fallback
  useEffect(() => {
    const vKey = visibleParamsKey();
    const reorder = globalParamOrderings[vKey];
    const fallback = visibleParams();
    if (reorder && !shallowArrayEquals(reorder, paramOrder)) {
      setParamOrder(reorder);
    } else if (!reorder && fallback.length !== paramOrder.length) {
      setParamOrder(fallback);
    }
    // ensure we append any new paramKeys that weren't in paramOrder
    const missing = paramKeys.filter((c) => !paramOrder.includes(c));
    if (missing.length > 0) {
      setParamOrder((prev) => [...prev, ...missing]);
    }
  }, [paramKeys, paramsFilter, globalParamOrderings]);

  useEffect(() => {
    const vKey = visibleEntriesKey();
    const reorder = globalEntryOrderings[vKey];
    const fallback = visibleEntries();
    if (reorder && !shallowArrayEquals(reorder, entryOrder)) {
      setEntryOrder(reorder);
    } else if (!reorder && fallback.length !== entryOrder.length) {
      setEntryOrder(fallback);
    }
    // ensure we append any new entryKeys
    const missingE = entryKeys.filter((c) => !entryOrder.includes(c));
    if (missingE.length > 0) {
      setEntryOrder((prev) => [...prev, ...missingE]);
    }
  }, [entryKeys, entriesFilter, globalEntryOrderings]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // DnD handlers
  function handleParamDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setParamOrder((items) => {
      const oldIndex = items.indexOf(active.id as string);
      const newIndex = items.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return items;
      const reordered = arrayMove(items, oldIndex, newIndex);
      if (!shallowArrayEquals(reordered, items)) {
        const key = visibleParamsKey();
        setGlobalParamOrderings((prev) => ({
          ...prev,
          [key]: reordered,
        }));
        return reordered;
      }
      return items;
    });
  }

  function handleEntryDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setEntryOrder((items) => {
      const oldIndex = items.indexOf(active.id as string);
      const newIndex = items.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return items;
      const reordered = arrayMove(items, oldIndex, newIndex);
      if (!shallowArrayEquals(reordered, items)) {
        const key = visibleEntriesKey();
        setGlobalEntryOrderings((prev) => ({
          ...prev,
          [key]: reordered,
        }));
        return reordered;
      }
      return items;
    });
  }

  /*****************************************************************************
   * Detect if a base value + comps are all empty => skip column 
   *****************************************************************************/
  function isAllEmpty(baseVal: any, comps: any[]): boolean {
    const arr = [baseVal, ...comps];
    for (const v of arr) {
      if (!isBlank(v)) return false;
    }
    return true;
  }
  function isBlank(v: any) {
    if (v == null) return true;
    if (typeof v === "string" && !v.trim()) return true;
    return false;
  }

  /*****************************************************************************
   * ParamSection Component - Converted from buildParamSection function
   *****************************************************************************/
  function ParamSection() {
    if (!baseLog) return null;

    // Visible columns
    const cols = paramOrder.filter((col) => paramsFilter[col] !== false);
    const filtered = cols.filter((col) => {
      const baseVal = baseLog.params?.[col];
      const compVals = comparisonLogs.map((cl) => cl.params?.[col]);
      return !isAllEmpty(baseVal, compVals);
    });
    if (!filtered.length) return null;

    const allOpen = areAllOpenParams();

    // Calculate accordionValue based on only the root paths of each property
    const accordionValue = filtered.filter((prop) => {
      // Check if the root path itself is in openKeys (for shallow toggling)
      const prefixStr = "params";
      const rootPath = makePrefixedDictPath(prefixStr, 0, prop);
      return openKeys.has(rootPath);
    });

    return (
      <div className="flex flex-col gap-2">
        <div className="sticky top-0 z-10 bg-background py-2 border-b border-muted flex items-center justify-between">
          <p className="font-bold text-lg">Params</p>
          <ActionButton
            variant="ghost"
            size="icon"
            tooltip={allOpen ? "Collapse All" : "Expand All"}
            onClick={onParamsExpandToggle}
            icon={allOpen ? <FoldVertical /> : <UnfoldVertical />}
          />
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleParamDragEnd}
        >
          <SortableContext items={filtered} strategy={verticalListSortingStrategy}>
            <Accordion 
              type="multiple"
              value={accordionValue}
              onValueChange={(newValues) => {
                handleAccordionValueChange(newValues, filtered, true);
              }}
            >
              {filtered.map((prop) => (
                <SortableAccordionItem
                  key={prop}
                  id={prop}
                  editMode={editMode}
                >
                  <SelectionEntry
                    source="params"
                    property={prop}
                    value={baseLog.params?.[prop]}
                    baseLog={baseLog}
                    baseLogIndex={selectedRowIndices[baseRowIndex]}
                    comparisonLogs={comparisonLogs}
                    comparisonLogsIndex={comparisonRowIndices}
                    diffMode={diffMode}
                    splitView={splitView}
                    displayMode={displayMode}
                    tableItem={tableItem}
                    updateItem={updateItem}
                    version={version}
                    comparableVersions={comparableVersions}
                    onHideColumn={(p) => {
                      setParamsFilter((prev) => ({
                        ...prev,
                        [p]: false,
                      }));
                    }}
                    editMode={editMode}
                  />
                </SortableAccordionItem>
              ))}
            </Accordion>
          </SortableContext>
        </DndContext>
      </div>
    );
  }

  /*****************************************************************************
   * EntriesSection Component - Converted from buildEntriesSection function
   *****************************************************************************/
  function EntriesSection() {
    if (!baseLog) return null;

    // Visible columns
    const cols = entryOrder.filter((col) => entriesFilter[col] !== false);
    const filtered = cols.filter((col) => {
      const baseVal = baseLog.entries?.[col];
      const compVals = comparisonLogs.map((cl) => cl.entries?.[col]);
      return !isAllEmpty(baseVal, compVals);
    });
    if (!filtered.length) return null;

    const allOpen = areAllOpenEntries();
    
    // Calculate accordionValue based on only the root paths of each property
    const accordionValue = filtered.filter((prop) => {
      // Check if the root path itself is in openKeys (for shallow toggling)
      const prefixStr = "entries";
      const rootPath = makePrefixedDictPath(prefixStr, 0, prop);
      return openKeys.has(rootPath);
    });

    return (
      <div className="flex flex-col gap-2">
        <div className="sticky top-0 z-10 bg-background py-2 border-b border-muted flex items-center justify-between">
          <p className="font-bold text-lg">Entries</p>
          <ActionButton
            variant="ghost"
            size="icon"
            tooltip={allOpen ? "Collapse All" : "Expand All"}
            onClick={onEntriesExpandToggle}
            icon={allOpen ? <FoldVertical /> : <UnfoldVertical />}
          />
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleEntryDragEnd}
        >
          <SortableContext items={filtered} strategy={verticalListSortingStrategy}>
            <Accordion 
              type="multiple"
              value={accordionValue}
              onValueChange={(newValues) => {
                handleAccordionValueChange(newValues, filtered, false);
              }}
            >
              {filtered.map((prop) => (
                <SortableAccordionItem
                  key={prop}
                  id={prop}
                  editMode={editMode}
                >
                  <SelectionEntry
                    source="entries"
                    property={prop}
                    value={baseLog.entries?.[prop]}
                    baseLog={baseLog}
                    baseLogIndex={selectedRowIndices[baseRowIndex]}
                    comparisonLogs={comparisonLogs}
                    comparisonLogsIndex={comparisonRowIndices}
                    diffMode={diffMode}
                    splitView={splitView}
                    displayMode={displayMode}
                    tableItem={tableItem}
                    updateItem={updateItem}
                    version={version}
                    comparableVersions={comparableVersions}
                    onHideColumn={(p) => {
                      setEntriesFilter((prev) => ({
                        ...prev,
                        [p]: false,
                      }));
                    }}
                    editMode={editMode}
                  />
                </SortableAccordionItem>
              ))}
            </Accordion>
          </SortableContext>
        </DndContext>
      </div>
    );
  }

  if (!baseLog) {
    return (
      <div className="flex flex-col w-full h-full overflow-hidden bg-background">
        <p className="text-sm text-muted-foreground p-2">
          No valid base row (panel {panelId + 1})
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto px-5 min-h-0 space-y-6">
        <ParamSection />
        <EntriesSection />
      </div>
    </div>
  );
}

/*******************************************************************************
 * SortableAccordionItem: used for drag-and-drop ordering
 ******************************************************************************/
function SortableAccordionItem({
  id,
  children,
  editMode,
}: {
  id: string;
  children: React.ReactNode;
  editMode?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    minHeight: "48px",
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center">
      {editMode && (
        <div className="drag-handle p-2 cursor-grab" {...attributes} {...listeners}>
          <GripVertical className="h-4 w-4 text-primary" />
        </div>
      )}
      <div className={editMode ? "flex-1 ml-0" : "flex-1 ml-2"}>{children}</div>
    </div>
  );
}