import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,

} from "react";
import { LogProps } from "@/types/evals/logs";
import SelectionHints from "./Hints";
import ActionButton from "@/components/Common/Buttons/Action";
import { Combobox } from "@/components/UI/Combobox";
import { sanitizeId } from "@/utils/evals/columnOperations";
import {
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
  Grab,
  ChevronsUpDown,
} from "lucide-react";
import { BasePopover } from "@/components/Common/Popovers/Base";
import { Switch } from "@/components/UI/switch";
import { Button } from "@/components/UI/button";

import { TileProps, ItemType } from "@/types/evals/grid";

import { useExpandContextSelector } from "@/contexts/ExpandContext";
import {
  makePrefixedDictPath,
  gatherAllSubPaths,
  gatherAllSubPathsMulti,
} from "@/utils/evals/pathUtils";

import {
  buildIndexToColumnsMapFromId,
  buildRowIndicesInSelectionOrder,
  shallowEqualBooleanRecords,
} from "./SelectionUtils";


import SelectionPanel from "./SelectionPanel";

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
  tableItem,
  item,
  updateItem,
}: {
  params: Record<string, unknown>;
  logs: LogProps[];
  selection_: string | undefined;
  baseIndex_: string | undefined;
  columnOrdering_: string | undefined;
  tableItem: TileProps | undefined;
  item: TileProps;
  updateItem: (item: TileProps, attrName: ItemType) => (
    newValue: string | undefined
  ) => void;
}) {
  /******************************************************************************
   * Prepare sorted logs & selection data
   ******************************************************************************/
  const sortedLogs = useMemo(() => [...logs], [logs]);

  // Use context selectors to only subscribe to the parts of the context we need
  const openKeys = useExpandContextSelector(ctx => ctx.openKeys);
  const setOpenKeys = useExpandContextSelector(ctx => ctx.setOpenKeys);
  const forceExpandAll = useExpandContextSelector(ctx => ctx.forceExpandAll);
  const forceCollapseAll = useExpandContextSelector(ctx => ctx.forceCollapseAll);
  const expandAll = useExpandContextSelector(ctx => ctx.expandAll);
  const collapseAll = useExpandContextSelector(ctx => ctx.collapseAll);

  const selectedCells = useMemo(() => {
    const arr = selection_ ? selection_.split(",") : [];
    return arr.map(token => {
      // token might look like "277932_Entries/trace"
      // so let's rewrite the part after "_" as short.
      const underscorePos = token.indexOf("_");
      if (underscorePos < 1) return token;
      const rowPart = token.slice(0, underscorePos); // e.g. "277932"
      let colPart = token.slice(underscorePos + 1);  // e.g. "Entries/trace"
      colPart = sanitizeId(colPart);               // => "trace"
      return rowPart + "_" + colPart;               // => "277932_trace"
    });
  }, [selection_]);
  const indexToColumns = useMemo(() => {
    const map = buildIndexToColumnsMapFromId(selectedCells, sortedLogs);
    return map;
  }, [selectedCells, sortedLogs]);

  const selectedRowIndices = useMemo(() => {
    return buildRowIndicesInSelectionOrder(selectedCells, sortedLogs);
  }, [selectedCells, sortedLogs]);

  const columnOrdering = useMemo(() => {
    return columnOrdering_ ? columnOrdering_.split(",").map(sanitizeId) : [];
  }, [columnOrdering_]);

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
  if (item.base_index) {
    baseIndexParam = parseInt(item.base_index, 10);
  }
  if (selectedRowIndices.length === 0) {
    baseIndexParam = 0;
  }
  
  // When in no-diff mode, always use the earliest selected row as base
  if (diffMode === "none" && selectedRowIndices.length > 0) {
    baseIndexParam = 0; // Force to first selected row in no-diff mode
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
      if (!(k in updatedE)) {
        updatedE[k] = true;
      }
    });
    Object.keys(updatedE).forEach((k) => {
      if (!entryKeysFromBase.includes(k)) {
        delete updatedE[k];
      }
    });

    const updatedP: Record<string, boolean> = { ...paramsFilter };
    paramKeysFromBase.forEach((k) => {
      if (!(k in updatedP)) {
        updatedP[k] = true;
      }
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
    const result = false;
    return result;
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

                {/* Params toggles - moved to appear before Entries */}
                {paramKeysFromBase.length > 0 && (
                  <div className="mt-2">
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

                {/* Entries toggles - moved to appear after Params */}
                <div className="mt-4">
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
            {diffMode === "none" ? (
              // When in no-diff mode, show a button styled like a disabled combobox
              <Button 
                variant="outline"
                className="w-[110px] justify-between px-2 py-1 opacity-50 cursor-not-allowed"
              >
                {selectedRowIndices[baseIndexParam] !== undefined 
                  ? `Row ${selectedRowIndices[baseIndexParam] + 1}` 
                  : "Pick base row"}
                <ChevronsUpDown className="ml-1 h-4 w-4 opacity-50" />
              </Button>
            ) : (
              // Otherwise show the normal combobox
              <Combobox
                items={selectedRowIndices.map((rIdx, i) => ({
                  value: String(i),       // internal value = position in selection array
                  label: `Row ${rIdx + 1}`,  // Use actual row index (rIdx) + 1 for the label
                  dataIndex: i,
                }))}
                value={String(baseIndexParam)}
                onValueChange={(newVal) => {
                  const idx = parseInt(newVal, 10);
                  if (!isNaN(idx) && String(idx) !== item.base_index) {
                    updateItem(item, "base_index")(String(idx));
                  }
                }}
                placeholder="Pick base row"
                className="w-[110px]"
              />
            )}
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