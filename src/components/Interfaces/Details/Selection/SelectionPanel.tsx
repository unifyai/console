import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
} from "react";
import { LogFieldsResponseProps, LogProps } from "@/types/evals/logs";
import SelectionEntry from "./SelectionEntry";
import { Accordion } from "@/components/UI/accordion";
import ActionButton from "@/components/Common/Buttons/Action";
import { PersistedTraceViewState } from "./Views/TraceView/TraceView";
import { PatchDiffNode } from "./Views/TraceView/computeDiff";
import { Label } from "@/components/UI/label";

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
  Binary,
  Settings,
  SquareSplitHorizontal,
  Edit
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
import { TileProps, ItemType, LogsActions } from "@/types/evals/grid";

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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from "@/components/UI/select";

import { createContext, useContextSelector } from "use-context-selector";
import { TableActions } from "@/contexts/hooks/tile/useTableTile";
import { Span } from "@/types/evals/traces";

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
viewTracesAsDict: boolean;
setViewTracesAsDict: (value: boolean) => void;
};

// Define PanelState interface to match what's in Selection.tsx
interface PanelState {
displayMode: "markdown" | "text" | "raw";
diffModeIdx: number;
splitView: boolean;
editMode: boolean;
cellEditMode: boolean;
entriesFilter: Record<string, boolean>;
paramsFilter: Record<string, boolean>;
entryOrderings: { [key: string]: string[] };
paramOrderings: { [key: string]: string[] };
entryOrder: string[];
paramOrder: string[];
localOpenKeys: Set<string>;
savedOpenKeys: Set<string>;
viewTracesAsDict: boolean;
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
viewTracesAsDict,
setViewTracesAsDict,
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
    viewTracesAsDict,
    setViewTracesAsDict,
  }),
  [openKeys, setOpenKeys, forceExpandAll, forceCollapseAll, toggleKey, expandAll, collapseAll, expandRecursively, collapseRecursively, viewTracesAsDict, setViewTracesAsDict]
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
  fields,
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
  selectedRowCount,
  currentPanelCount,
  onPanelCountChange,
  onSaveMany,
  logsActions,
  updateLogsDeep,
  context
}: {
  panelId: number;
  panelState: PanelState;
  onPanelStateChange: (updates: Partial<PanelState>) => void;
  fields: LogFieldsResponseProps;
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
  selectedRowCount: number;
  currentPanelCount: number;
  onPanelCountChange: React.Dispatch<React.SetStateAction<number>>;
  onSaveMany: (rowIds: string[], desc: { source: "entries" | "params"; path: (string|number)[]; newValue: any }) => void;
  logsActions: LogsActions;
  updateLogsDeep: (rowIds: string[], desc: { source: "entries" | "params"; path: (string|number)[]; newValue: any }) => void; 
  context: string | null
}) {
  // Extract all values from panelState
  const {
    displayMode,
    diffModeIdx,
    splitView,
    editMode,
    cellEditMode,
    entriesFilter,
    paramsFilter,
    entryOrderings,
    paramOrderings,
    entryOrder,
    paramOrder,
    localOpenKeys,
    savedOpenKeys,
    viewTracesAsDict,
  } = panelState;

  const allDiffModes = ["none", "lines", "words", "characters"] as const;
  const diffMode = allDiffModes[diffModeIdx];

  // Local baseIndex state - this still needs to be local as it's specific to the selection
  const [baseIndexParam, setBaseIndexParam] = useState(initialBaseIndex);

  // Add a state to store trace view state for each property
  // DEPRECATED: Keeping for backward compatibility, but using the new separated state approach
  const [traceStateMap, setTraceStateMap] = useState<Record<string, {
    collapsedNodes: Record<string, boolean>;
    selectedNode: PatchDiffNode | null;
    selectedSpanId: string;
    groupSignature: string;
    traceExpandOpenKeys: Set<string>;
    leftScrollPosition: number;
    rightScrollPosition: number;
  }>>({});

  // Refactored: Separate UI state from scroll state by using two distinct state maps
  const [traceUIStateMap, setTraceUIStateMap] = useState<Record<string, {
    collapsedNodes: Record<string, boolean>;
    selectedNode: PatchDiffNode | null;
    selectedSpanId: string;
    groupSignature: string;
    traceExpandOpenKeys: Set<string>;
  }>>({});

  const [traceScrollStateMap, setTraceScrollStateMap] = useState<Record<string, {
    leftScrollPosition: number;
    rightScrollPosition: number;
  }>>({});

  // Sync the old traceStateMap with the new split state for backward compatibility
  // This ensures any legacy code still works while we transition to the new approach
  useEffect(() => {
    // Only update when necessary to avoid loops
    let needsUpdate = false;
    const updatedMap: typeof traceStateMap = {};

    // Check if we need to sync any properties
    Object.keys({...traceUIStateMap, ...traceScrollStateMap}).forEach(prop => {
      const uiState = traceUIStateMap[prop] || {
        collapsedNodes: {},
        selectedNode: null,
        selectedSpanId: "",
        groupSignature: "",
        traceExpandOpenKeys: new Set<string>(),
      };

      const scrollState = traceScrollStateMap[prop] || {
        leftScrollPosition: 0,
        rightScrollPosition: 0
      };

      // If this property doesn't exist in traceStateMap or its values differ
      if (!traceStateMap[prop] ||
          traceStateMap[prop].leftScrollPosition !== scrollState.leftScrollPosition ||
          traceStateMap[prop].rightScrollPosition !== scrollState.rightScrollPosition) {
        needsUpdate = true;
        updatedMap[prop] = {
          ...uiState,
          ...scrollState
        };
      }
    });

    // Update the legacy map only if changes were detected
    if (needsUpdate) {
      setTraceStateMap(prev => ({
        ...prev,
        ...updatedMap
      }));
    }
  }, [traceUIStateMap, traceScrollStateMap, traceStateMap]);

  // Function to get or create trace state for a property
  const getTraceStateFor = useCallback((prop: string): PersistedTraceViewState => {
    // Create UI state if it doesn't exist yet
    if (!traceUIStateMap[prop]) {
      setTraceUIStateMap(prev => ({
        ...prev,
        [prop]: {
          // UI state
          collapsedNodes: {},
          selectedNode: null,
          selectedSpanId: "",
          groupSignature: "",
          traceExpandOpenKeys: new Set<string>(),
        }
      }));
    }

    // Create scroll state if it doesn't exist yet
    if (!traceScrollStateMap[prop]) {
      setTraceScrollStateMap(prev => ({
        ...prev,
        [prop]: {
          // Scroll state
          leftScrollPosition: 0,
          rightScrollPosition: 0
        }
      }));
    }

    // Return the persisted state with getters and setters that affect separate state slices
    return {
      // UI state getters and setters
      collapsedNodes: traceUIStateMap[prop]?.collapsedNodes || {},
      setCollapsedNodes: (value) => {
        setTraceUIStateMap(prev => {
          const propState = prev[prop] || {
            collapsedNodes: {},
            selectedNode: null,
            selectedSpanId: "",
            groupSignature: "",
            traceExpandOpenKeys: new Set<string>(),
          };
          const newCollapsedNodes = typeof value === "function"
            ? value(propState.collapsedNodes)
            : value;

          return {
            ...prev,
            [prop]: {
              ...propState,
              collapsedNodes: newCollapsedNodes
            }
          };
        });
      },
      selectedNode: traceUIStateMap[prop]?.selectedNode || null,
      setSelectedNode: (node) => {
        setTraceUIStateMap(prev => {
          const propState = prev[prop] || {
            collapsedNodes: {},
            selectedNode: null,
            selectedSpanId: "",
            groupSignature: "",
            traceExpandOpenKeys: new Set<string>(),
          };

          // Handle function updater
          const newNode = typeof node === "function" ? node(propState.selectedNode) : node;

          // Skip update if same node
          if (newNode === propState.selectedNode) {
            return prev;
          }

          // Skip update if equivalent node
          if (newNode && propState.selectedNode &&
              newNode.name === propState.selectedNode.name &&
              ((newNode.baseSpanRef?.id === propState.selectedNode.baseSpanRef?.id) ||
                (!newNode.baseSpanRef && !propState.selectedNode.baseSpanRef)) &&
              ((newNode.targetSpanRef?.id === propState.selectedNode.targetSpanRef?.id) ||
                (!newNode.targetSpanRef && !propState.selectedNode.targetSpanRef))) {
            return prev;
          }

          return {
            ...prev,
            [prop]: {
              ...propState,
              selectedNode: newNode
            }
          };
        });
      },
      selectedSpanId: traceUIStateMap[prop]?.selectedSpanId || "",
      setSelectedSpanId: (id) => {
        setTraceUIStateMap(prev => {
          const propState = prev[prop] || {
            collapsedNodes: {},
            selectedNode: null,
            selectedSpanId: "",
            groupSignature: "",
            traceExpandOpenKeys: new Set<string>(),
          };
          const newId = typeof id === "function" ? id(propState.selectedSpanId) : id;
          return {
            ...prev,
            [prop]: {
              ...propState,
              selectedSpanId: newId
            }
          };
        });
      },
      groupSignature: traceUIStateMap[prop]?.groupSignature || "",
      setGroupSignature: (sig) => {
        setTraceUIStateMap(prev => {
          const propState = prev[prop] || {
            collapsedNodes: {},
            selectedNode: null,
            selectedSpanId: "",
            groupSignature: "",
            traceExpandOpenKeys: new Set<string>(),
          };
          const newSig = typeof sig === "function" ? sig(propState.groupSignature) : sig;
          return {
            ...prev,
            [prop]: {
              ...propState,
              groupSignature: newSig
            }
          };
        });
      },
      traceExpandOpenKeys: traceUIStateMap[prop]?.traceExpandOpenKeys || new Set<string>(),
      setTraceExpandOpenKeys: (value) => {
        setTraceUIStateMap(prev => {
          const propState = prev[prop] || {
            collapsedNodes: {},
            selectedNode: null,
            selectedSpanId: "",
            groupSignature: "",
            traceExpandOpenKeys: new Set<string>(),
          };
          const newKeys = typeof value === "function"
            ? value(propState.traceExpandOpenKeys)
            : value;
          return {
            ...prev,
            [prop]: {
              ...propState,
              traceExpandOpenKeys: newKeys
            }
          };
        });
      },

      // Scroll state getters and setters (updating only the scroll state slice)
      leftScrollPosition: traceScrollStateMap[prop]?.leftScrollPosition || 0,
      setLeftScrollPosition: (value) => {
        setTraceScrollStateMap(prev => {
          const propState = prev[prop] || {
            leftScrollPosition: 0,
            rightScrollPosition: 0
          };
          const newPosition = typeof value === "function"
            ? value(propState.leftScrollPosition)
            : value;

          // Avoid updating if scroll position hasn't changed
          if (newPosition === propState.leftScrollPosition) {
            return prev;
          }

          // Only update the scroll position in the scroll state map
          return {
            ...prev,
            [prop]: {
              ...propState,
              leftScrollPosition: newPosition
            }
          };
        });
      },
      rightScrollPosition: traceScrollStateMap[prop]?.rightScrollPosition || 0,
      setRightScrollPosition: (value) => {
        setTraceScrollStateMap(prev => {
          const propState = prev[prop] || {
            leftScrollPosition: 0,
            rightScrollPosition: 0
          };
          const newPosition = typeof value === "function"
            ? value(propState.rightScrollPosition)
            : value;

          // Avoid updating if scroll position hasn't changed
          if (newPosition === propState.rightScrollPosition) {
            return prev;
          }

          // Only update the scroll position in the scroll state map
          return {
            ...prev,
            [prop]: {
              ...propState,
              rightScrollPosition: newPosition
            }
          };
        });
      }
    };
  }, [traceUIStateMap, traceScrollStateMap]);

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
  const visibleEntries = useCallback((): string[] => {
    const filtered = entryKeys.filter((col) => entriesFilter[col] !== false);
    return filtered;
  }, [entryKeys, entriesFilter]);
  
  const visibleEntriesKey = useCallback((): string => {
    const arr = [...visibleEntries()];
    return arr.join(",");
  }, [visibleEntries]);
  
  const visibleParams = useCallback((): string[] => {
    const filtered = paramKeys.filter((col) => paramsFilter[col] !== false);
    return filtered;
  }, [paramKeys, paramsFilter]);
  
  const visibleParamsKey = useCallback((): string => {
    const arr = [...visibleParams()];
    return arr.join(",");
  }, [visibleParams]);

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
  }, [paramKeys, paramsFilter, paramOrderings, visibleParams, visibleParamsKey, columnOrdering, paramOrder, allPossibleColumns?.params, onPanelStateChange]);

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
  }, [entryKeys, entriesFilter, entryOrderings, entryOrder, visibleEntries, visibleEntriesKey, columnOrdering, allPossibleColumns?.entries, onPanelStateChange]);

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
   * This function is no longer used to filter columns, but kept for potential future use
   * or if specific conditional rendering based on emptiness is needed elsewhere.
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

    // Consistent with SelectionEntry: check both for non-empty paths and that all are open
    const allOpen = subPathSet.size > 0 && Array.from(subPathSet).every((sp) => localOpenKeys.has(sp));
    return allOpen;
  }

  // Function to expand/collapse all entries
  function onEntriesExpandToggle() {
    if (editMode) return;
    if (!baseLog) return;

    const visibleE = entryKeys.filter((k) => entriesFilter[k] !== false);
    const subPathSet = new Set<string>();
    const topLevelPaths: string[] = []; // Array to store just the top-level paths

    // Include paths for the top-level entries themselves
    const prefixStr = "entries";
    visibleE.forEach((k) => {
      // Add the root path for this entry
      const rootPath = makePrefixedDictPath(prefixStr, 0, k);
      subPathSet.add(rootPath);
      topLevelPaths.push(rootPath); // Store top-level paths separately

      // Also add all subpaths
      const spList = gatherSubpathsForProperty(false, k);
      spList.forEach((sp) => subPathSet.add(sp));
    });

    // Convert to array for the recursive functions
    const subPaths = Array.from(subPathSet);
    if (subPaths.length === 0) return;

    // Directly calculate if all are open rather than using areAllOpenEntries
    // This ensures we're using the exact same paths we're about to expand/collapse
    const currentlyAllOpen = subPaths.every(path => localOpenKeys.has(path));

    if (currentlyAllOpen) {
      // Collapse all - use collapseRecursively directly
      // When collapsing, exclude the top-level paths to keep parents open
      const childPaths = subPaths.filter(path => !topLevelPaths.includes(path));
      collapseRecursively(childPaths);
    } else {
      // Expand all - use expandRecursively directly
      expandRecursively(subPaths);
    }
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

    // Consistent with SelectionEntry: check both for non-empty paths and that all are open
    return subPathSet.size > 0 && Array.from(subPathSet).every((sp: string) => localOpenKeys.has(sp));
  }

  // Function to expand/collapse all params
  function onParamsExpandToggle() {
    if (editMode) return;
    if (!baseLog) return;

    const visibleP = paramKeys.filter((k) => paramsFilter[k] !== false);
    const subPathSet = new Set<string>();
    const topLevelPaths: string[] = []; // Array to store just the top-level paths

    // Include paths for the top-level params themselves
    const prefixStr = "params";
    visibleP.forEach((k) => {
      // Add the root path for this param
      const rootPath = makePrefixedDictPath(prefixStr, 0, k);
      subPathSet.add(rootPath);
      topLevelPaths.push(rootPath); // Store top-level paths separately

      // Also add all subpaths
      const spList = gatherSubpathsForProperty(true, k);
      spList.forEach((sp: string) => subPathSet.add(sp));
    });

    // Convert to array for the recursive functions
    const subPaths = Array.from(subPathSet);
    if (subPaths.length === 0) return;

    // Directly calculate if all are open rather than using areAllOpenParams
    // This ensures we're using the exact same paths we're about to expand/collapse
    const currentlyAllOpen = subPaths.every(path => localOpenKeys.has(path));

    if (currentlyAllOpen) {
      // Collapse all - use collapseRecursively directly
      // When collapsing, exclude the top-level paths to keep parents open
      const childPaths = subPaths.filter(path => !topLevelPaths.includes(path));
      collapseRecursively(childPaths);
    } else {
      // Expand all - use expandRecursively directly
      expandRecursively(subPaths);
    }
  }

  /*****************************************************************************
     * Handle Save Edit Local (For single edits)
     *****************************************************************************/
  type LocalEdit = { logIndex: number; source: "entries" | "params"; path: (string|number)[]; newValue: any };

  const handleSaveEditLocal = useCallback((desc: LocalEdit) => {

    // Path normalization and trace path fixing (unchanged)
    function coerceNumericStrings(original: (string|number)[]): (string|number)[] {
      return original.map(seg => typeof seg === 'string' && /^\d+$/.test(seg) ? Number(seg) : seg);
    }
    const normalisedPath = coerceNumericStrings(desc.path);
    let fixedPath = normalisedPath; // Start with the normalized path

    // --- Correction Logic ---
    // Check if the path looks like ['trace', 0, ...] or similar
    if (fixedPath.length > 1 && fixedPath[1] === 0) {
        const traceKey = fixedPath[0] as string;
        // Find the base log corresponding to the edited logIndex
        const editedLog = sortedLogs[desc.logIndex];
        const containerRoot = (desc.source === "params" ? editedLog?.params : editedLog?.entries) ?? {};
        // Get the actual data stored under the first key (e.g., 'trace')
        const actualTraceData = containerRoot[traceKey];

        // If the actual data is an OBJECT (not an array), the '0' index is incorrect and should be removed.
        // This happens when the trace structure is a single object root span.
        if (actualTraceData && typeof actualTraceData === 'object' && !Array.isArray(actualTraceData)) {
            fixedPath = [traceKey, ...fixedPath.slice(2)]; // Create new path: ['trace', 'inputs', 'a']
        }
        // If actualTraceData *is* an array, the path ['trace', 0, ...] is likely correct, so we leave it.
        // If actualTraceData is not found or not an object/array, we also leave the path as is.
    }

    // Find the logId for the single log index
    const targetLog = sortedLogs[desc.logIndex];
    if (!targetLog) {
      console.error(`[SelectionPanel] Could not find log at index ${desc.logIndex}`);
      return;
    }
    const targetRowId = String(targetLog.id);

    // Prepare descriptor for onSaveMany
    const saveDesc = {
      source: desc.source,
      path: fixedPath, // Use the potentially corrected path
      newValue: desc.newValue,
    };

    // Propagate save for the single row ID
    onSaveMany([targetRowId], saveDesc);

  }, [sortedLogs, onSaveMany]); // baseLog dependency removed as it's not used in the callback logic

  /*****************************************************************************
   * Handle Group Save Edit Local (For grouped edits)
   *****************************************************************************/
  type GroupLocalEdit = { logIndices: number[]; source: "entries" | "params"; path: (string|number)[]; newValue: any };

  const handleGroupSaveEditLocal = useCallback((desc: GroupLocalEdit) => {

    // Path normalization and trace path fixing (same as single edit)
    function coerceNumericStrings(original: (string|number)[]): (string|number)[] {
      return original.map(seg => typeof seg === 'string' && /^\d+$/.test(seg) ? Number(seg) : seg);
    }
    const normalisedPath = coerceNumericStrings(desc.path);
    let fixedPath = normalisedPath; // Start with the normalized path

    // --- Correction Logic (same as above, but check against the first log in the group) ---
    if (fixedPath.length > 1 && fixedPath[1] === 0 && desc.logIndices.length > 0) {
        const traceKey = fixedPath[0] as string;
        // Find the first log corresponding to the edited logIndices
        const firstEditedLog = sortedLogs[desc.logIndices[0]];
        const containerRoot = (desc.source === "params" ? firstEditedLog?.params : firstEditedLog?.entries) ?? {};
        const actualTraceData = containerRoot[traceKey];

        // If the actual data is an OBJECT (not an array), remove the '0' index.
        if (actualTraceData && typeof actualTraceData === 'object' && !Array.isArray(actualTraceData)) {
            fixedPath = [traceKey, ...fixedPath.slice(2)];
        }
    }

    // Map logIndices to logIds
    const targetRowIds = desc.logIndices.map(logIndex => {
      const targetLog = sortedLogs[logIndex];
      if (!targetLog) {
        console.error(`[SelectionPanel] Could not find log at index ${logIndex} during group save`);
        return null; // Skip invalid indices
      }
      return String(targetLog.id);
    }).filter((id): id is string => id !== null); // Filter out nulls

    if (targetRowIds.length === 0) {
      console.error("[SelectionPanel] No valid row IDs found for group save.");
      return;
    }

    // Prepare descriptor for onSaveMany
    const saveDesc = {
      source: desc.source,
      path: fixedPath, // Use the potentially corrected path
      newValue: desc.newValue,
    };

    // Propagate save for ALL row IDs in the group
    onSaveMany(targetRowIds, saveDesc);

  }, [sortedLogs, onSaveMany]); // baseLog dependency removed as it's not used in the callback logic

    /*****************************************************************************
     * Handle Trace Update (from polling)
     *****************************************************************************/
    const handleTraceUpdate = useCallback((logIndex: number, fieldName: string, newTrace: Span[]) => {
      if (!updateLogsDeep) {
          console.warn("[SelectionPanel] handleTraceUpdate: updateLogsDeep not available.");
          return;
      }

      const targetLog = sortedLogs[logIndex];
      if (!targetLog) {
          console.error(`[SelectionPanel] handleTraceUpdate: Could not find log at index ${logIndex}`);
          return;
      }
      const targetRowId = String(targetLog.id);

      const source = fields[fieldName].field_type === 'param' ? 'params' : 'entries' // Need to add support for derived_entries in Traces 

      updateLogsDeep([targetRowId], {
          source: source,
          path: [fieldName],
          newValue: newTrace
      });
  }, [sortedLogs, updateLogsDeep, fields]);

  /*****************************************************************************
   * EntriesSection Component - Pass both save handlers and trace update handler
   *****************************************************************************/
  function EntriesSection() {
    if (!baseLog) return null;
    const cols = entryOrder.filter((col) => entriesFilter[col] !== false);
    // Do not filter out columns based on isAllEmpty. Show all selected & visible columns.
    const filtered = [...cols];
    if (!filtered.length) return null;
    const allOpen = areAllOpenEntries();
    const accordionValue = filtered.filter((prop) => localOpenKeys.has(makePrefixedDictPath("entries", 0, prop)));
    const baseIndexForSelection = baseRowIndex;
    const compIndicesForSelection = comparisonRowIndices;

    const entryComponentsToRender = filtered.map((entryKey) => {
      if (!baseLog.entries?.hasOwnProperty(entryKey)) {
        return null;
      }
      const baseEntryVal = baseLog.entries?.[entryKey];
      const traceState = getTraceStateFor(`entries-${entryKey}`);
      const isImmutable = fields[entryKey]?.mutable === "true";
      return (
        <SortableAccordionItem key={entryKey} id={entryKey} editMode={editMode} onTraceUpdate={handleTraceUpdate}>
          <SelectionEntry
            property={entryKey}
            source="entries"
            value={baseEntryVal}
            baseLog={baseLog}
            baseLogIndex={baseIndexForSelection}
            comparisonLogs={comparisonLogs}
            comparisonLogsIndex={compIndicesForSelection}
            diffMode={cellEditMode ? "none" : diffMode}
            splitView={splitView}
            displayMode={displayMode}
            version=""
            comparableVersions={[]}
            tableItem={tableItem}
            updateItem={updateItem}
            onHideColumn={(p) => onPanelStateChange({ entriesFilter: { ...entriesFilter, [p]: false } })}
            editMode={editMode}
            panelOpenKeys={localOpenKeys}
            panelSetOpenKeys={(updatedOpenKeys) => onPanelStateChange({ localOpenKeys: typeof updatedOpenKeys === 'function' ? updatedOpenKeys(localOpenKeys) : updatedOpenKeys })}
            externalTraceState={traceState}
            viewTracesAsDict={viewTracesAsDict}
            fieldName={entryKey}
            isImmutable={isImmutable}
            cellEditMode={cellEditMode}
            onSaveEdit={handleSaveEditLocal}
            onGroupSaveEdit={handleGroupSaveEditLocal}
            onTraceUpdate={handleTraceUpdate}
            logsActions={logsActions}
            context={context}
          />
        </SortableAccordionItem>
      );
    });

    return (
      <div className="flex flex-col gap-2">
        <div className="sticky top-0 z-10 bg-background py-2 border-b border-muted flex items-center justify-between">
          <p className="font-bold text-lg">Entries</p>
          {!cellEditMode && <ActionButton variant="ghost" size="icon" tooltip={allOpen ? "Collapse all" : "Expand all"} onClick={onEntriesExpandToggle} icon={allOpen ? <FoldVertical /> : <UnfoldVertical />} />}
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleEntryDragEnd}>
          <SortableContext items={filtered} strategy={verticalListSortingStrategy}>
            <Accordion type="multiple" value={accordionValue} onValueChange={(newValues) => handleAccordionValueChange(newValues, filtered, false)}>
              {entryComponentsToRender}
            </Accordion>
          </SortableContext>
        </DndContext>
      </div>
    );
  }

  /*****************************************************************************
   * ParamSection Component - Pass both save handlers and trace update handler
   *****************************************************************************/
  function ParamSection() {
    if (!baseLog) return null;
    const cols = paramOrder.filter((col) => paramsFilter[col] !== false);
    // Do not filter out columns based on isAllEmpty. Show all selected & visible columns.
    const filtered = [...cols]; 
    if (!filtered.length) return null;
    const allOpen = areAllOpenParams();
    const accordionValue = filtered.filter((prop) => localOpenKeys.has(makePrefixedDictPath("params", 0, prop)));
    const baseIndexForSelection = baseRowIndex;
    const compIndicesForSelection = comparisonRowIndices;

    const paramComponentsToRender = filtered.map((paramKey) => {
      if (!baseLog.params?.hasOwnProperty(paramKey)) {
        return null;
      }
      const baseParamVal = baseLog.params?.[paramKey];
      const traceState = getTraceStateFor(`params-${paramKey}`);
      const isImmutable = fields[paramKey]?.mutable === "false";
      return (
        <SortableAccordionItem key={paramKey} id={paramKey} editMode={editMode} onTraceUpdate={handleTraceUpdate}>
          <SelectionEntry
            source="params"
            property={paramKey}
            value={baseParamVal}
            baseLog={baseLog}
            baseLogIndex={baseIndexForSelection}
            comparisonLogs={comparisonLogs}
            comparisonLogsIndex={compIndicesForSelection}
            diffMode={cellEditMode ? "none" : diffMode}
            splitView={splitView}
            displayMode={displayMode}
            tableItem={tableItem}
            updateItem={updateItem}
            version=""
            comparableVersions={[]}
            onHideColumn={(p) => onPanelStateChange({ paramsFilter: { ...paramsFilter, [p]: false } })}
            editMode={editMode}
            panelOpenKeys={localOpenKeys}
            panelSetOpenKeys={(updatedOpenKeys) => onPanelStateChange({ localOpenKeys: typeof updatedOpenKeys === 'function' ? updatedOpenKeys(localOpenKeys) : updatedOpenKeys })}
            externalTraceState={traceState}
            viewTracesAsDict={viewTracesAsDict}
            fieldName={paramKey}
            isImmutable={isImmutable}
            cellEditMode={cellEditMode}
            onSaveEdit={handleSaveEditLocal}
            onGroupSaveEdit={handleGroupSaveEditLocal}
            onTraceUpdate={handleTraceUpdate}
            logsActions={logsActions}
            context={context}
          />
        </SortableAccordionItem>
      );
    });

    return (
      <div className="flex flex-col gap-2">
        <div className="sticky top-0 z-10 bg-background py-2 border-b border-muted flex items-center justify-between">
          <p className="font-bold text-lg">Params</p>
          {!cellEditMode && <ActionButton variant="ghost" size="icon" tooltip={allOpen ? "Collapse all" : "Expand all"} onClick={onParamsExpandToggle} icon={allOpen ? <FoldVertical /> : <UnfoldVertical />} />}
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleParamDragEnd}>
          <SortableContext items={filtered} strategy={verticalListSortingStrategy}>
            <Accordion type="multiple" value={accordionValue} onValueChange={(newValues) => handleAccordionValueChange(newValues, filtered, true)}>
              {paramComponentsToRender}
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
      viewTracesAsDict={viewTracesAsDict}
      setViewTracesAsDict={(value) => onPanelStateChange({ viewTracesAsDict: value })}
    >
      <div className="flex flex-col w-full h-full overflow-hidden">
        {/* Panel-specific controls */}
        <div className="p-2 border-b border-muted flex items-center justify-between">
          {/* Left side: Selected Row Count */}
          <div className="text-sm text-muted-foreground">
            Selected {selectedRowCount} row(s)
          </div>
          {/* Right side: Controls */}
          <div className="flex items-center gap-2">
            {/* Edit Mode Toggle Button */}
            <ActionButton
              tooltip={cellEditMode ? "Switch to View Mode" : "Switch to Edit Mode"}
              icon={<Edit className="h-4 w-4" />}
              onClick={() => {
                const turningOnEdit = !cellEditMode;
                onPanelStateChange({
                  cellEditMode: turningOnEdit,
                  // If turning on edit mode, force diffMode to 'none'
                  ...(turningOnEdit && { diffModeIdx: 0 }),
                });
              }}
              variant={cellEditMode ? "primary" : "ghost"} // Highlight when active
              size="icon"
            />

            {/* Base row selection (Moved here) - Conditional on diffMode !== 'none' AND not cellEditMode */}
            {selectedRowIndices.length > 1 && diffMode !== 'none' && !cellEditMode && (
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
            )}

            {/* Column Visibility Popover (Moved Here) */}
            <BasePopover
                context="tile"
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
                  <div className="max-h-[60vh] overflow-y-auto command-scrollbar pr-2">
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

            {/* Settings Popover */}
            <BasePopover
              context="tile"
              button={
                <ActionButton
                  tooltip="View settings"
                  icon={<Settings className="h-4 w-4" />}
                  variant="ghost"
                  size="icon"
                />
              }
            >
              <div className="flex flex-col gap-4 p-4 w-64">
                <h4 className="font-medium leading-none text-center mb-2">View Settings</h4>

                {/* Display Mode */}
                <div className="flex items-center justify-between">
                  <Label>Display As</Label>
                  <Select
                    value={displayMode}
                    onValueChange={(value: "markdown" | "text" | "raw") => {
                      onPanelStateChange({ displayMode: value });
                    }}
                  >
                    <SelectTrigger className="w-[110px]">
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="markdown">Markdown</SelectItem>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="raw">Raw</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Trace View Mode */}
                <div className="flex items-center justify-between">
                  <Label htmlFor={`trace-view-mode-${panelId}`}>Trace View</Label>
                  {/* Use Select instead of Switch */}
                  <Select
                    value={String(viewTracesAsDict)} // Convert boolean to string for value
                    onValueChange={(value) => {
                      onPanelStateChange({ viewTracesAsDict: value === 'true' }); // Convert string back to boolean
                    }}
                  >
                    <SelectTrigger className="w-[110px]">
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="false">Specialized</SelectItem>
                      <SelectItem value="true">Dictionary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Diff Controls (Conditional) */}
                {selectedRowIndices.length > 1 && (
                  <>
                    <div className="flex items-center justify-between">
                      <Label className={cellEditMode ? 'text-muted-foreground' : ''}>Diff Mode</Label>
                      <Select
                        disabled={cellEditMode} // Disable if cell edit mode is ON
                        value={String(diffModeIdx)}
                        onValueChange={(value) => {
                          const newIndex = parseInt(value, 10);
                          if (!isNaN(newIndex) && newIndex >= 0 && newIndex < allDiffModes.length) {
                            onPanelStateChange({ diffModeIdx: newIndex });
                          }
                        }}
                      >
                        <SelectTrigger className="w-[110px]" disabled={cellEditMode}>
                          <SelectValue placeholder="Select mode" />
                        </SelectTrigger>
                        <SelectContent>
                          {allDiffModes.map((mode, index) => (
                            <SelectItem key={mode} value={String(index)}>
                              {mode.charAt(0).toUpperCase() + mode.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      {/* Disable Label and Switch when editing or diffMode is none */}
                      <Label htmlFor={`split-view-${panelId}`} className={cellEditMode || diffMode === 'none' ? 'text-muted-foreground' : ''}>Split View</Label>
                      <Switch
                        id={`split-view-${panelId}`}
                        checked={splitView}
                        onCheckedChange={(checked) => onPanelStateChange({ splitView: checked })}
                        disabled={cellEditMode || diffMode === 'none'} // Disable Switch when editing or diffMode is none
                      />
                    </div>
                  </>
                )}

                {/* Sort Mode */}
                <div className="flex items-center justify-between">
                    <Label htmlFor={`edit-mode-${panelId}`}>Sort Mode</Label>
                    <Switch
                      id={`edit-mode-${panelId}`}
                      checked={editMode}
                      onCheckedChange={(checked) => {
                        if (checked) {
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
                      }}
                    />
                </div>
              </div>
            </BasePopover>

            {/* Panel Count Cycle Button */}
            <ActionButton
              tooltip={`Cycle panel count (currently: ${currentPanelCount})`}
              icon={<SquareSplitHorizontal className="h-4 w-4" />}
              onClick={() => {
                onPanelCountChange((prev) => (prev === 2 ? 1 : prev + 1));
              }}
              variant="ghost"
              size="icon"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto command-scrollbar px-5 min-h-0 space-y-6">
          {EntriesSection()}
          {ParamSection()}
        </div>
      </div>
    </PanelExpandProvider>
  );
}