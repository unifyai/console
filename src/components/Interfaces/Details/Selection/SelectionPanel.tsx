import React, {
    useMemo,
    useState,
    useEffect,
    useCallback,
  } from "react";
  import { LogProps } from "@/types/evals/logs";
  import SelectionEntry from "./SelectionEntry";
  import { Accordion } from "@/components/UI/accordion";
  import ActionButton from "@/components/Common/Buttons/Action";

  import {
    FoldVertical,
    UnfoldVertical,
    FileText,
    CaseLower,
    Pilcrow,
    Columns,
    AlignJustify,
    Code,
    SquareSlash,
    Type,
    RemoveFormatting,
    Rows3,
    Grab,
    ChevronsUpDown,
  } from "lucide-react";
  
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
    arrayMove,
  } from "@dnd-kit/sortable";
  import { TileProps, ItemType } from "@/types/evals/grid";
  
  import {
    makePrefixedDictPath,
    gatherAllSubPaths,
    gatherAllSubPathsMulti,
  } from "@/utils/evals/pathUtils";

  import {
    buildLogWithChosenColumns,
    shallowArrayEquals,
    shallowEqualBooleanRecords,
  } from "./SelectionUtils";

  import SortableAccordionItem from "./SortableAccordionItem";
  import { Combobox } from "@/components/UI/Combobox";
  import { BasePopover } from "@/components/Common/Popovers/Base";
  import { Switch } from "@/components/UI/switch";
  import { Button } from "@/components/UI/button";

  import { createContext, useContextSelector } from "use-context-selector";

// Create a custom context for panel-specific state
type PanelExpandContextType = {
  openKeys: Set<string>;
  setOpenKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
  forceExpandAll: boolean;
  forceCollapseAll: boolean;
  toggleKey: (path: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  expandRecursively: (paths: string[]) => void;
  collapseRecursively: (paths: string[]) => void;
};

// Define PanelState interface to match what's in Selection.tsx
interface PanelState {
  displayMode: "markdown" | "text" | "raw";
  diffModeIdx: number;
  splitView: boolean;
  editMode: boolean;
  entriesFilter: Record<string, boolean>;
  paramsFilter: Record<string, boolean>;
  entryOrderings: { [key: string]: string[] };
  paramOrderings: { [key: string]: string[] };
  entryOrder: string[];
  paramOrder: string[];
  localOpenKeys: Set<string>;
  savedOpenKeys: Set<string>;
}

const PanelExpandContext = createContext<PanelExpandContextType>(null as any);

function PanelExpandProvider({
  children,
  openKeys,
  setOpenKeys,
  forceExpandAll,
  forceCollapseAll,
  toggleKey,
  expandAll,
  collapseAll,
  expandRecursively,
  collapseRecursively,
}: React.PropsWithChildren<PanelExpandContextType>) {
  const value = useMemo(
    () => ({
      openKeys,
      setOpenKeys,
      forceExpandAll,
      forceCollapseAll,
      toggleKey,
      expandAll,
      collapseAll,
      expandRecursively,
      collapseRecursively,
    }),
    [openKeys, setOpenKeys, forceExpandAll, forceCollapseAll, toggleKey, expandAll, collapseAll, expandRecursively, collapseRecursively]
  );

  return (
    <PanelExpandContext.Provider value={value}>
      {children}
    </PanelExpandContext.Provider>
  );
}

// This works like useExpandContextSelector but gets values from our panel context
export function usePanelExpandContextSelector<T>(selector: (ctx: PanelExpandContextType) => T): T {
  const selected = useContextSelector(PanelExpandContext, selector);
  if (selected === undefined) {
    throw new Error("usePanelExpandContextSelector must be used within a PanelExpandProvider");
  }
  return selected;
}

/*******************************************************************************
 * "SelectionPanel" Subcomponent
 *   Each panel has its own independent state for display, diff mode, and expansions
 ******************************************************************************/
export default function SelectionPanel({
    panelId,
    panelState,
    onPanelStateChange,
    logs,
    sortedLogs,
    params,
    selectedRowIndices,
    columnOrdering,
    indexToColumns,
    tableItem,
    item,
    updateItem,
    initialBaseIndex,
    allPossibleColumns,
  }: {
    panelId: number;
    panelState: PanelState;
    onPanelStateChange: (updates: Partial<PanelState>) => void;
    logs: LogProps[];
    sortedLogs: LogProps[];
    params: Record<string, unknown>;
    selectedRowIndices: number[];
    columnOrdering: string[];
    indexToColumns: Record<number, Set<string>>;
    tableItem: TileProps | undefined;
    item: TileProps;
    updateItem: (item: TileProps, attrName: ItemType) => (newValue: string | undefined) => void;
    initialBaseIndex: number;
    allPossibleColumns?: { entries: string[], params: string[] };
  }) {
    // Extract all values from panelState
    const {
      displayMode,
      diffModeIdx,
      splitView,
      editMode,
      entriesFilter,
      paramsFilter,
      entryOrderings,
      paramOrderings,
      entryOrder,
      paramOrder,
      localOpenKeys,
      savedOpenKeys
    } = panelState;
    
    const allDiffModes = ["none", "lines", "words", "characters"] as const;
    const diffMode = allDiffModes[diffModeIdx];
    
    // Local baseIndex state - this still needs to be local as it's specific to the selection
    const [baseIndexParam, setBaseIndexParam] = useState(initialBaseIndex);
    
    // Check if baseIndexParam is valid in useEffect to avoid potential infinite re-render
    useEffect(() => {
      if (baseIndexParam < 0 || baseIndexParam >= selectedRowIndices.length) {
        setBaseIndexParam(0);
      }
    }, [baseIndexParam, selectedRowIndices.length]);
    
    const baseRowIndex = selectedRowIndices[baseIndexParam] ?? -1;
    
    // Local implementation of toggleKey using panelState.localOpenKeys
    const localToggleKey = useCallback((path: string) => {
      const next = new Set(localOpenKeys);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      onPanelStateChange({ localOpenKeys: next });
    }, [localOpenKeys, onPanelStateChange]);
    
    // Implement expandRecursively and collapseRecursively functions
    const expandRecursively = useCallback((paths: string[]) => {
      if (paths.length === 0) return;
      
      const next = new Set(localOpenKeys);
      paths.forEach((path) => {
        next.add(path);
      });
      onPanelStateChange({ localOpenKeys: next });
    }, [localOpenKeys, onPanelStateChange]);
    
    const collapseRecursively = useCallback((paths: string[]) => {
      if (paths.length === 0) return;
      
      const next = new Set(localOpenKeys);
      paths.forEach((path) => {
        next.delete(path);
      });
      onPanelStateChange({ localOpenKeys: next });
    }, [localOpenKeys, onPanelStateChange]);

    // Create a local handleAccordionValueChange function
    const handleAccordionValueChange = (newVals: string[], filtered: string[], isParams: boolean) => {
      const next = new Set(localOpenKeys);
      
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
      
      onPanelStateChange({ localOpenKeys: next });
    };

    // Add the gatherSubpathsForProperty function
    function gatherSubpathsForProperty(isParams: boolean, propName: string): Set<string> {
      // Check if we're dealing with params and if baseLog even exists
      if (!baseLog) {
        return new Set<string>();
      }
      
      // Decide whether to use "entries" or "params"
      const propContainer = isParams ? (baseLog.params || {}) : (baseLog.entries || {});
      // Find the raw value for the target property
      const raw = propContainer[propName];
      
      // For params, unwrap the .paramValue
      const rawVal = isParams && raw && typeof raw === "object" ? raw.paramValue : raw;
      
      // Empty? Nothing to expand.
      if (!rawVal) {
        return new Set<string>();
      }
      
      // Build the appropriate root path for this property
      const prefixStr = isParams ? "params" : "entries";
      const rootPath = makePrefixedDictPath(prefixStr, 0, propName);
      
      // For multi-mode path gathering
      const compareIndices = selectedRowIndices.filter((_, i) => i !== baseIndexParam);
      
      let comparables: any[] = [];
      
      // For multi-mode, gather comparable values from the selected logs
      if (compareIndices.length > 0) {
        comparables = compareIndices.map(rowIndex => {
          const log = sortedLogs[rowIndex];
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
  
    const buildLogIfValid = useCallback(
      (rIdx: number) => {
        if (rIdx < 0 || rIdx >= logs.length) return null;
        
        const result = buildLogWithChosenColumns(
          logs[rIdx],
          rIdx,
          params,
          indexToColumns,
          columnOrdering,
        );
                
        return result;
      },
      [logs, params, indexToColumns, columnOrdering]
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
      comps: (Record<string, unknown> | undefined)[],
      preferredOrder?: string[]
    ): string[] {
      // First gather all keys from base and comparables
      const keyset = new Set<string>();
      
      // Add base keys
      if (baseObj) {
        Object.keys(baseObj).forEach(k => keyset.add(k));
      }
      
      // Add comparable keys
      for (const comp of comps) {
        if (comp) {
          Object.keys(comp).forEach(k => keyset.add(k));
        }
      }
      
      // If we have a preferred order, use it to order the keys
      if (preferredOrder && preferredOrder.length > 0) {
        // Start with the keys that are in the preferred order
        const orderedKeys = preferredOrder.filter(k => keyset.has(k));
        
        // Add any remaining keys that weren't in the preferred order
        const remainingKeys = Array.from(keyset).filter(k => !preferredOrder.includes(k));
        
        return [...orderedKeys, ...remainingKeys];
      }
      
      // Fallback to using the key insertion order (which browser maintains for objects)
      return Array.from(keyset);
    }
  
    const entryKeys = useMemo(() => {
      if (!baseLog) return [];
      const keys = gatherUnionOfKeys(
        baseLog.entries,
        comparisonLogs.map((cl) => cl.entries),
        columnOrdering
      );
      return keys;
    }, [baseLog, comparisonLogs, columnOrdering]);
  
    const paramKeys = useMemo(() => {
      if (!baseLog) return [];
      const keys = gatherUnionOfKeys(
        baseLog.params,
        comparisonLogs.map((cl) => cl.params),
        columnOrdering
      );
      return keys;
    }, [baseLog, comparisonLogs, columnOrdering]);
  
    // Filter "visible" columns
    function visibleEntries(): string[] {
      const filtered = entryKeys.filter((col) => entriesFilter[col] !== false);
      return filtered;
    }
    function visibleEntriesKey(): string {
      const arr = [...visibleEntries()];
      return arr.join(",");
    }
    function visibleParams(): string[] {
      const filtered = paramKeys.filter((col) => paramsFilter[col] !== false);
      return filtered;
    }
    function visibleParamsKey(): string {
      const arr = [...visibleParams()];
      return arr.join(",");
    }
  
    // On mount / filter change, load from global reorder or fallback
    useEffect(() => {
      const vKey = visibleParamsKey();
      const reorder = paramOrderings[vKey];
      const fallback = visibleParams();
      
      // Include all possible columns, not just those in the current logs
      const allPossibleParamsCombined = allPossibleColumns?.params 
        ? Array.from(new Set([...fallback, ...allPossibleColumns.params]))
        : fallback;
      
      let finalP: string[] = [];
      if (reorder && !shallowArrayEquals(reorder, paramOrder)) {
        finalP = reorder;
        onPanelStateChange({ paramOrder: reorder });
      } else if (!reorder && JSON.stringify(allPossibleParamsCombined) !== JSON.stringify(paramOrder)) {
        // Use columnOrdering to order the parameters if applicable
        if (columnOrdering.length > 0) {
          // First use ordered items from columnOrdering that exist in the combined params
          const orderedItems = columnOrdering.filter(key => allPossibleParamsCombined.includes(key));
          // Then add any remaining items not in columnOrdering
          const remainingItems = allPossibleParamsCombined.filter(key => !columnOrdering.includes(key));
          finalP = [...orderedItems, ...remainingItems];
        } else {
          finalP = allPossibleParamsCombined;
        }
        onPanelStateChange({ paramOrder: finalP });
      }

      if (finalP.length === 0) {
        return;
      }
      
      // FIXED: Only consider visible keys (not filtered out) when checking for missing keys
      const visible = visibleParams();
      const missing = visible.filter((c) => !finalP.includes(c));
      
      if (missing.length > 0) {
        onPanelStateChange({ paramOrder: [...finalP, ...missing] });
      }
    }, [paramKeys, paramsFilter, paramOrderings, visibleParamsKey, columnOrdering, paramOrder, allPossibleColumns?.params]);
  
    useEffect(() => {
      const vKey = visibleEntriesKey();
      const reorder = entryOrderings[vKey];
      const fallback = visibleEntries();
  
      // Include all possible columns, not just those in the current logs
      const allPossibleEntriesCombined = allPossibleColumns?.entries 
        ? Array.from(new Set([...fallback, ...allPossibleColumns.entries]))
        : fallback;
  
      let finalE: string[] = [];
      if (reorder && !shallowArrayEquals(reorder, entryOrder)) {
        finalE = reorder;
        onPanelStateChange({ entryOrder: reorder });
      } else if (!reorder && JSON.stringify(allPossibleEntriesCombined) !== JSON.stringify(entryOrder)) {
        // Use columnOrdering to order the entries if applicable
        if (columnOrdering.length > 0) {
          // First use ordered items from columnOrdering that exist in the combined entries
          const orderedItems = columnOrdering.filter(key => allPossibleEntriesCombined.includes(key));
          // Then add any remaining items not in columnOrdering
          const remainingItems = allPossibleEntriesCombined.filter(key => !columnOrdering.includes(key));
          finalE = [...orderedItems, ...remainingItems];
        } else {
          finalE = allPossibleEntriesCombined;
        }
        onPanelStateChange({ entryOrder: finalE });
      }
  
      if (finalE.length === 0) {
        return;
      }
  
      // FIXED: Only consider visible keys (not filtered out) when checking for missing keys
      const visible = visibleEntries();
      const missingE = visible.filter((c) => !finalE.includes(c));
      
      if (missingE.length > 0) {
        onPanelStateChange({ entryOrder: [...finalE, ...missingE] });
      }
    }, [entryKeys, entriesFilter, entryOrderings, entryOrder, visibleEntriesKey, columnOrdering, allPossibleColumns?.entries]);
  
    const sensors = useSensors(
      useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    );
  
    // DnD handlers
    function handleParamDragEnd(event: DragEndEvent) {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      
      const oldIndex = paramOrder.indexOf(active.id as string);
      const newIndex = paramOrder.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;
      
      const reordered = arrayMove(paramOrder, oldIndex, newIndex);
      if (!shallowArrayEquals(reordered, paramOrder)) {
        const key = visibleParamsKey();
        onPanelStateChange({ 
          paramOrder: reordered,
          paramOrderings: {
            ...paramOrderings,
            [key]: reordered
          }
        });
      }
    }
  
    function handleEntryDragEnd(event: DragEndEvent) {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      
      const oldIndex = entryOrder.indexOf(active.id as string);
      const newIndex = entryOrder.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;
      
      const reordered = arrayMove(entryOrder, oldIndex, newIndex);
      if (!shallowArrayEquals(reordered, entryOrder)) {
        const key = visibleEntriesKey();
        onPanelStateChange({ 
          entryOrder: reordered,
          entryOrderings: {
            ...entryOrderings,
            [key]: reordered
          }
        });
      }
    }
  
    /*****************************************************************************
     * Detect if a base value + comps are all empty => skip column 
     *****************************************************************************/
    function isAllEmpty(baseVal: any, comps: any[]): boolean {
      const arr = [baseVal, ...comps];
      for (const v of arr) {
        if (!isBlank(v)) {
          return false;
        }
      }
      return true;
    }
    function isBlank(v: any) {
      if (v == null) {
        return true;
      }
      if (typeof v === "string" && !v.trim()) {
        return true;
      }
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
        const isEmpty = isAllEmpty(baseVal, compVals);
        return !isEmpty;
      });
      
      if (!filtered.length) return null;
      
      const allOpen = areAllOpenParams();
  
      // Calculate accordionValue based on only the root paths of each property
      const accordionValue = filtered.filter((prop) => {
        // Check if the root path itself is in openKeys (for shallow toggling)
        const prefixStr = "params";
        const rootPath = makePrefixedDictPath(prefixStr, 0, prop);
        return localOpenKeys.has(rootPath);
      });

      
      // IMPORTANT: We need to pass the actual row indices to SelectionEntry
      // baseRowIndex is already the 0-based row index, so no need to subtract 1
      const baseIndexForSelection = baseRowIndex; // Don't subtract 1, it's already 0-based
      
      // Map the comparison row indices directly (they're already 0-based)
      const compIndicesForSelection = comparisonRowIndices;
      
      const version = "";
      const comparableVersions: string[] = [];
      
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
                      baseLogIndex={baseIndexForSelection}
                      comparisonLogs={comparisonLogs}
                      comparisonLogsIndex={compIndicesForSelection}
                      diffMode={diffMode}
                      splitView={splitView}
                      displayMode={displayMode}
                      tableItem={tableItem}
                      updateItem={updateItem}
                      version={version}
                      comparableVersions={comparableVersions}
                      onHideColumn={(p) => {
                        onPanelStateChange({ paramsFilter: { ...paramsFilter, [p]: false } });
                      }}
                      editMode={editMode}
                      panelOpenKeys={localOpenKeys}
                      panelSetOpenKeys={(updatedOpenKeys) => 
                        onPanelStateChange({ localOpenKeys: typeof updatedOpenKeys === 'function' 
                          ? updatedOpenKeys(localOpenKeys) 
                          : updatedOpenKeys 
                        })
                      }
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
        const isEmpty = isAllEmpty(baseVal, compVals);
        return !isEmpty;
      });
      
      if (!filtered.length) return null;
      
      const allOpen = areAllOpenEntries();
      
      // Calculate accordionValue based on only the root paths of each property
      const accordionValue = filtered.filter((prop) => {
        // Check if the root path itself is in openKeys (for shallow toggling)
        const prefixStr = "entries";
        const rootPath = makePrefixedDictPath(prefixStr, 0, prop);
        return localOpenKeys.has(rootPath);
      });
  
      // IMPORTANT: We need to pass the actual row indices to SelectionEntry
      // baseRowIndex is already the 0-based row index, so no need to subtract 1
      const baseIndexForSelection = baseRowIndex; // Don't subtract 1, it's already 0-based
      
      // Map the comparison row indices directly (they're already 0-based)
      const compIndicesForSelection = comparisonRowIndices;
      
      const version = "";
      const comparableVersions: string[] = [];
      
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
                      baseLogIndex={baseIndexForSelection}
                      comparisonLogs={comparisonLogs}
                      comparisonLogsIndex={compIndicesForSelection}
                      diffMode={diffMode}
                      splitView={splitView}
                      displayMode={displayMode}
                      tableItem={tableItem}
                      updateItem={updateItem}
                      version={version}
                      comparableVersions={comparableVersions}
                      onHideColumn={(p) => {
                        onPanelStateChange({ entriesFilter: { ...entriesFilter, [p]: false } });
                      }}
                      editMode={editMode}
                      panelOpenKeys={localOpenKeys}
                      panelSetOpenKeys={(updatedOpenKeys) => 
                        onPanelStateChange({ localOpenKeys: typeof updatedOpenKeys === 'function' 
                          ? updatedOpenKeys(localOpenKeys) 
                          : updatedOpenKeys 
                        })
                      }
                    />
                  </SortableAccordionItem>
                ))}
              </Accordion>
            </SortableContext>
          </DndContext>
        </div>
      );
    }
  
    // Function to determine if all entries are expanded
    function areAllOpenEntries(): boolean {
      if (editMode) return false;
      if (!baseLog) return false;
      
      const visibleE = entryKeys.filter((k) => entriesFilter[k] !== false);
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
      
      const allOpen = subPathSet.size > 0 && Array.from(subPathSet).every((sp) => localOpenKeys.has(sp));
      return allOpen;
    }
    
    // Function to determine if all params are expanded
    function areAllOpenParams(): boolean {
      if (editMode) return false;
      if (!baseLog) return false;
      
      const visibleP = paramKeys.filter((k) => paramsFilter[k] !== false);
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
        spList.forEach((sp: string) => subPathSet.add(sp));
      });
      
      return subPathSet.size > 0 && Array.from(subPathSet).every((sp: string) => localOpenKeys.has(sp));
    }
    
    // Function to expand/collapse all entries
    function onEntriesExpandToggle() {
      if (editMode) return;
      if (!baseLog) return;
      
      const visibleE = entryKeys.filter((k) => entriesFilter[k] !== false);
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
      
      const currentlyAllOpen = areAllOpenEntries();
      
      if (currentlyAllOpen) {
        // Collapse all
        collapseRecursively(Array.from(subPathSet));
      } else {
        // Expand all
        expandRecursively(Array.from(subPathSet));
      }
    }
    
    // Function to expand/collapse all params
    function onParamsExpandToggle() {
      if (editMode) return;
      if (!baseLog) return;
      
      const visibleP = paramKeys.filter((k) => paramsFilter[k] !== false);
      const subPathSet = new Set<string>();
      
      // Include paths for the top-level params themselves
      const prefixStr = "params";
      visibleP.forEach((k) => {
        // Add the root path for this param
        const rootPath = makePrefixedDictPath(prefixStr, 0, k);
        subPathSet.add(rootPath);
        
        // Also add all subpaths
        const spList = gatherSubpathsForProperty(true, k);
        spList.forEach((sp: string) => subPathSet.add(sp));
      });
      
      const currentlyAllOpen = areAllOpenParams();
      
      const next = new Set(localOpenKeys);
      if (currentlyAllOpen) {
        subPathSet.forEach((sp: string) => next.delete(sp));
      } else {
        subPathSet.forEach((sp: string) => next.add(sp));
      }
      onPanelStateChange({ localOpenKeys: next });
    }
  
    // Function to toggle edit mode with expansion key management
    const toggleEditMode = () => {
      if (!editMode) {
        // turning ON => save current expansions, then close them all
        onPanelStateChange({
          savedOpenKeys: new Set(localOpenKeys),
          localOpenKeys: new Set(),
          editMode: true
        });
      } else {
        // turning OFF => restore expansions
        onPanelStateChange({
          localOpenKeys: savedOpenKeys,
          savedOpenKeys: new Set(),
          editMode: false
        });
      }
    };
  
    // Initialize filters when allPossibleColumns changes
    useEffect(() => {
      if (allPossibleColumns) {
        // Initialize entries filter
        const newEntriesFilter: Record<string, boolean> = {...entriesFilter};
        let entriesChanged = false;
        
        allPossibleColumns.entries.forEach(entry => {
          if (newEntriesFilter[entry] === undefined) {
            newEntriesFilter[entry] = true; // Default to visible
            entriesChanged = true;
          }
        });
        
        if (entriesChanged) {
          onPanelStateChange({ entriesFilter: newEntriesFilter });
        }
        
        // Initialize params filter
        const newParamsFilter: Record<string, boolean> = {...paramsFilter};
        let paramsChanged = false;
        
        allPossibleColumns.params.forEach(param => {
          if (newParamsFilter[param] === undefined) {
            newParamsFilter[param] = true; // Default to visible
            paramsChanged = true;
          }
        });
        
        if (paramsChanged) {
          onPanelStateChange({ paramsFilter: newParamsFilter });
        }
      }
    }, [allPossibleColumns, entriesFilter, paramsFilter]);
  
    if (!baseLog) {
      return (
        <div className="flex flex-col w-full h-full overflow-hidden bg-background">
          <p className="text-sm text-muted-foreground p-2">
            No valid base row
          </p>
        </div>
      );
    }
  
    return (
      <PanelExpandProvider
        openKeys={localOpenKeys}
        setOpenKeys={(updatedOpenKeys) => 
          onPanelStateChange({ localOpenKeys: typeof updatedOpenKeys === 'function' 
            ? updatedOpenKeys(localOpenKeys) 
            : updatedOpenKeys 
          })
        }
        forceExpandAll={false}
        forceCollapseAll={false}
        toggleKey={localToggleKey}
        expandAll={() => {}}
        collapseAll={() => {}}
        expandRecursively={expandRecursively}
        collapseRecursively={collapseRecursively}
      >
        <div className="flex flex-col w-full h-full overflow-hidden">
          {/* Panel-specific controls */}
          <div className="p-2 border-b border-muted flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {/* Panel ID text removed as requested */}
            </div>
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
                  let newDisplayMode: "markdown" | "text" | "raw";
                  if (displayMode === "markdown") newDisplayMode = "text";
                  else if (displayMode === "text") newDisplayMode = "raw";
                  else newDisplayMode = "markdown";
                  onPanelStateChange({ displayMode: newDisplayMode });
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
                        {(allPossibleColumns?.entries || entryKeys).every((k) => entriesFilter[k] !== false) &&
                        (allPossibleColumns?.params || paramKeys).every((k) => paramsFilter[k] !== false)
                          ? "Hide all"
                          : "Show all"}
                      </span>
                      <Switch
                        checked={
                          (allPossibleColumns?.entries || entryKeys).every((k) => entriesFilter[k] !== false) &&
                          (allPossibleColumns?.params || paramKeys).every((k) => paramsFilter[k] !== false)
                        }
                        onCheckedChange={(checked) => {
                          const newE: Record<string, boolean> = {};
                          (allPossibleColumns?.entries || entryKeys).forEach((k) => {
                            newE[k] = checked;
                          });
                          if (!shallowEqualBooleanRecords(newE, entriesFilter)) {
                            onPanelStateChange({ entriesFilter: newE });
                          }

                          const newP: Record<string, boolean> = {};
                          (allPossibleColumns?.params || paramKeys).forEach((k) => {
                            newP[k] = checked;
                          });
                          if (!shallowEqualBooleanRecords(newP, paramsFilter)) {
                            onPanelStateChange({ paramsFilter: newP });
                          }
                        }}
                      />
                    </div>

                    {/* Params toggles */}
                    {(allPossibleColumns?.params || paramKeys).length > 0 && (
                      <div className="mt-2">
                        <div className="flex justify-between items-center mb-1">
                          <p className="font-bold text-sm">Params</p>
                          <Switch
                            checked={(allPossibleColumns?.params || paramKeys).every(
                              (k) => paramsFilter[k] !== false
                            )}
                            onCheckedChange={(checked) => {
                              const newVal: Record<string, boolean> = {};
                              (allPossibleColumns?.params || paramKeys).forEach((k) => {
                                newVal[k] = checked;
                              });
                              if (!shallowEqualBooleanRecords(newVal, paramsFilter)) {
                                onPanelStateChange({ paramsFilter: newVal });
                              }
                            }}
                          />
                        </div>
                        {(allPossibleColumns?.params || paramKeys).map((k) => (
                          <div
                            key={k}
                            className="flex items-center justify-between py-1 pl-4"
                          >
                            <span className="text-sm w-[180px] truncate pr-2" title={k}>
                              {k}
                            </span>
                            <Switch
                              checked={paramsFilter[k] !== false}
                              onCheckedChange={(checked) => {
                                onPanelStateChange({ paramsFilter: { ...paramsFilter, [k]: checked } });
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Entries toggles */}
                    <div className="mt-4">
                      <div className="flex justify-between items-center mb-1">
                        <p className="font-bold text-sm">Entries</p>
                        <Switch
                          checked={(allPossibleColumns?.entries || entryKeys).every(
                            (k) => entriesFilter[k] !== false
                          )}
                          onCheckedChange={(checked) => {
                            const newVal: Record<string, boolean> = {};
                            (allPossibleColumns?.entries || entryKeys).forEach((k) => {
                              newVal[k] = checked;
                            });
                            if (!shallowEqualBooleanRecords(newVal, entriesFilter)) {
                              onPanelStateChange({ entriesFilter: newVal });
                            }
                          }}
                        />
                      </div>
                      {(allPossibleColumns?.entries || entryKeys).map((k) => (
                        <div
                          key={k}
                          className="flex items-center justify-between py-1 pl-4"
                        >
                          <span className="text-sm w-[180px] truncate pr-2" title={k}>
                            {k}
                          </span>
                          <Switch
                            checked={entriesFilter[k] !== false}
                            onCheckedChange={(checked) => {
                              onPanelStateChange({ entriesFilter: { ...entriesFilter, [k]: checked } });
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </BasePopover>
              
              {/* Toggle Edit Mode */}
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
          
          {/* Base row selection & diff controls */}
          {selectedRowIndices.length > 1 && (
            <div className="border-b border-muted bg-background px-3 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Base:</span>
                <Combobox
                  items={selectedRowIndices.map((rIdx, i) => ({
                    value: String(i),
                    label: `Row ${rIdx + 1}`,
                    dataIndex: i,
                  }))}
                  value={String(baseIndexParam)}
                  onValueChange={(newVal) => {
                    const idx = parseInt(newVal, 10);
                    if (!isNaN(idx)) {
                      setBaseIndexParam(idx);
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
                    const newDiffModeIdx = (diffModeIdx + 1) % allDiffModes.length;
                    onPanelStateChange({ diffModeIdx: newDiffModeIdx });
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
                  onClick={() => onPanelStateChange({ splitView: !splitView })}
                  variant="ghost"
                  size="icon"
                />
              </div>
            </div>
          )}
          
          <div className="flex-1 overflow-y-auto px-5 min-h-0 space-y-6">
            <ParamSection />
            <EntriesSection />
          </div>
        </div>
      </PanelExpandProvider>
    );
  }