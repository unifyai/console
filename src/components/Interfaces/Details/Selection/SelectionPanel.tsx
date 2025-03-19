import React, {
    useMemo,
    useState,
    useEffect,
    useCallback,
    Dispatch,
    SetStateAction,
  } from "react";
  import { LogProps } from "@/types/evals/logs";
  import SelectionEntry from "./SelectionEntry";
  import { Accordion } from "@/components/UI/accordion";
  import ActionButton from "@/components/Common/Buttons/Action";

  import {
    FoldVertical,
    UnfoldVertical,
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
  
  import { useExpandContextSelector } from "@/contexts/ExpandContext";
  import {
    makePrefixedDictPath,
  } from "@/utils/evals/pathUtils";

  import {
    buildLogWithChosenColumns,
    shallowArrayEquals,
  } from "./SelectionUtils";

  import SortableAccordionItem from "./SortableAccordionItem";
/*******************************************************************************
 * "SelectionPanel" Subcomponent
 *   Merges the old & new param/entry building with reorder logic + expand toggles
 ******************************************************************************/
export default function SelectionPanel({
    panelId,
    logs,
    sortedLogs,
    params,
    selectedRowIndices,
    columnOrdering,
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
  }): React.ReactNode {
    // Use context selectors to only subscribe to the parts of the context we need
    const openKeys = useExpandContextSelector(ctx => ctx.openKeys);
    const setOpenKeys = useExpandContextSelector(ctx => ctx.setOpenKeys);
  
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
  
    // baseIndex from item/base_index
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
      
      // If we have a preferred order, use it to order the keys
      if (preferredOrder && preferredOrder.length > 0) {
        // First get all keys that are both in the union and in the preferred order
        const orderedKeys = preferredOrder.filter(key => s.has(key));
        
        // Then get any keys from the union that aren't in the preferred order
        const remainingKeys = Array.from(s).filter(key => !preferredOrder.includes(key));
        
        // Return ordered keys followed by any remaining keys (which we'll sort for consistency)
        return [...orderedKeys, ...remainingKeys.sort()];
      }
      
      // If no preferred order, return all keys (default to sorted for backward compatibility)
      return Array.from(s).sort();
    }
  
    const entryKeys = useMemo(() => {
      if (!baseLog) return [];
      return gatherUnionOfKeys(
        baseLog.entries,
        comparisonLogs.map((cl) => cl.entries),
        columnOrdering
      );
    }, [baseLog, comparisonLogs, columnOrdering]);
  
    const paramKeys = useMemo(() => {
      if (!baseLog) return [];
      return gatherUnionOfKeys(
        baseLog.params,
        comparisonLogs.map((cl) => cl.params),
        columnOrdering
      );
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
  
    // Local reorder states (the old code approach uses a global dictionary)
    const [entryOrder, setEntryOrder] = useState<string[]>([]);
    const [paramOrder, setParamOrder] = useState<string[]>([]);
  
    // On mount / filter change, load from global reorder or fallback
    useEffect(() => {
      const vKey = visibleParamsKey();
      const reorder = globalParamOrderings[vKey];
      const fallback = visibleParams();
      
      let finalP: string[] = [];
      if (reorder && !shallowArrayEquals(reorder, paramOrder)) {
        finalP = reorder;
        setParamOrder(reorder);
      } else if (!reorder && JSON.stringify(fallback) !== JSON.stringify(paramOrder)) {
        finalP = fallback;
        setParamOrder(fallback);
      }
  
      if (finalP.length === 0) {
        return;
      }
      
      // FIXED: Only consider visible keys (not filtered out) when checking for missing keys
      const visible = visibleParams();
      const missing = visible.filter((c) => !finalP.includes(c));
      
      if (missing.length > 0) {
        setParamOrder((prev) => [...prev, ...missing]);
      }
    }, [panelId, paramKeys, paramsFilter, globalParamOrderings, paramOrder, visibleParamsKey]);
  
    useEffect(() => {
      const vKey = visibleEntriesKey();
      const reorder = globalEntryOrderings[vKey];
      const fallback = visibleEntries();
  
      let finalE: string[] = [];
      if (reorder && !shallowArrayEquals(reorder, entryOrder)) {
        finalE = reorder;
        setEntryOrder(reorder);
      } else if (!reorder && JSON.stringify(fallback) !== JSON.stringify(entryOrder)) {
        finalE = fallback;
        setEntryOrder(fallback);
      }
  
      if (finalE.length === 0) {
        return;
      }
  
      // FIXED: Only consider visible keys (not filtered out) when checking for missing keys
      const visible = visibleEntries();
      const missingE = visible.filter((c) => !finalE.includes(c));
      
      if (missingE.length > 0) {
        setEntryOrder((prev) => [...prev, ...missingE]);
      }
    }, [panelId, entryKeys, entriesFilter, globalEntryOrderings, entryOrder, visibleEntriesKey]);
  
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
  
      // IMPORTANT: We need to pass the actual row indices to SelectionEntry
      // baseRowIndex is already the 0-based row index, so no need to subtract 1
      const baseIndexForSelection = baseRowIndex; // Don't subtract 1, it's already 0-based
      
      // Map the comparison row indices directly (they're already 0-based)
      const compIndicesForSelection = comparisonRowIndices;
      
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
  
      // IMPORTANT: We need to pass the actual row indices to SelectionEntry
      // baseRowIndex is already the 0-based row index, so no need to subtract 1
      const baseIndexForSelection = baseRowIndex; // Don't subtract 1, it's already 0-based
      
      // Map the comparison row indices directly (they're already 0-based)
      const compIndicesForSelection = comparisonRowIndices;
      
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