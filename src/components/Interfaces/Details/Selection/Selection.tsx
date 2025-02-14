"use client";

import React, {
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback
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
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TileProps, ItemType } from "@/types/evals/grid";

/*******************************************************************************
 * (A) Basic type checks & helpers
 ******************************************************************************/
function isList(val: any) {
  return Array.isArray(val);
}
function isDict(val: any) {
  return val && typeof val === "object" && !Array.isArray(val);
}
function isMatrix(val: any) {
  return isList(val) && val.length > 0 && Array.isArray(val[0]);
}
function isImage(val: any) {
  return typeof val === "string" && val.startsWith("data:image/");
}
function isTrace(val: any) {
  return false; // originally always false
}
function isNumber(val: any) {
  return typeof val === "number" || val instanceof Number;
}
function getValueType(value: any) {
  if (isTrace(value)) return "trace";
  if (isDict(value)) return "dict";
  if (isList(value)) return "list";
  if (isImage(value)) return "image";
  if (isMatrix(value)) return "matrix";
  if (isNumber(value)) return "number";
  return "string";
}
function defaultOpenFor(keys: string[], obj: Record<string, unknown>) {
  const result = keys.filter((k) => {
    const val = obj[k];
    const t = getValueType(val);
    return ["string", "number", "matrix", "image"].includes(t);
  });
  return result;
}
function unwrapSingleKeyObject(val: unknown) {
  if (val && typeof val === "object" && !Array.isArray(val)) {
    const keys = Object.keys(val);
    if (keys.length === 1 && keys[0] === "0") {
      const result = (val as Record<string, unknown>)["0"];
      return result;
    }
  }
  return val;
}
function rowLabel(rowIndex: number) {
  return `Row ${rowIndex + 1}`;
}

/*******************************************************************************
 * (B) Helpers: building row->columns maps from selection, etc.
 ******************************************************************************/
function buildIndexToColumnsMapFromId(
  selectedCells: string[],
  sortedLogs: LogProps[]
): Record<number, Set<string>> {
  const map: Record<number, Set<string>> = {};
  for (const token of selectedCells) {
    const underscorePos = token.indexOf("_");
    if (underscorePos < 1) continue;
    const logIdStr = token.slice(0, underscorePos);
    const columnName = token.slice(underscorePos + 1);
    const rowIndex = sortedLogs.findIndex((log) => String(log.id) === logIdStr);
    if (rowIndex < 0) continue;
    if (!map[rowIndex]) {
      map[rowIndex] = new Set<string>();
    }
    map[rowIndex].add(columnName);
  }
  return map;
}

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
 * (C) buildLogWithChosenColumns: used for param version logic
 ******************************************************************************/
function buildLogWithChosenColumns(
  originalLog: LogProps,
  rowIndex: number,
  globalParams: Record<string, unknown>,
  indexToColumns: Record<number, Set<string>>,
  columnOrdering: string[],
  hiddenColumns: string[]
): LogProps {
  const chosenCols = indexToColumns[rowIndex] ?? new Set<string>();
  // "entries"
  const safeEntries = originalLog.entries ?? {};
  const afterHiddenEntries = Array.from(chosenCols).filter(
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
    if (safeEntries.hasOwnProperty(c)) {
      newEntries[c] = safeEntries[c];
    } else {
      console.error(
        "[buildLogWithChosenColumns] Missing key in safeEntries:",
        c,
        "Available keys:",
        Object.keys(safeEntries)
      );
    }
  }
  // "params"
  const safeParams = originalLog.params ?? {};
  const afterHiddenParams = Array.from(chosenCols).filter(
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
    if (!safeParams.hasOwnProperty(c)) continue;
    const storedVal = safeParams[c];
    if (typeof storedVal === "string" && globalParams.hasOwnProperty(c)) {
      const possibleObj = globalParams[c];
      if (possibleObj && typeof possibleObj === "object") {
        const castObj = possibleObj as Record<string, unknown>;
        const mappedVal = castObj[storedVal];
        if (mappedVal !== undefined) {
          newParams[c] = {
            paramValue: mappedVal,
            paramVersion: unwrapSingleKeyObject(storedVal),
          };
          continue;
        }
      }
    }
    newParams[c] = unwrapSingleKeyObject(storedVal);
  }
  const result = {
    ...originalLog,
    entries: newEntries,
    params: newParams,
  };
  return result;
}

/*******************************************************************************
* (D) The main "Selection" parent component
*     - sorts logs
*     - reads selectedCells => rowIndices
*     - manages how many horizontal panels
*     - each panel is rendered with <SelectionPanel> for independent state
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
  params: Record<string, unknown>,
  logs: LogProps[],
  selection_: string | undefined,
  baseIndex_: string | undefined,
  columnOrdering_: string | undefined,
  hiddenColumns_: string | undefined,
  tableItem: TileProps | undefined,
  item: TileProps,
  updateItem: (item: TileProps, attrName: ItemType) => (newValue: string | undefined) => void
}) {
  // 1) Possibly reorder logs or just keep them
  const sortedLogs = useMemo(() => [...logs], [logs]);
  // 2) Which cells are selected (memoized)
  const selectedCells = useMemo(() => (selection_ ? selection_.split(",") : []), [selection_]);
  // 3) Build rowIndex -> columns
  const indexToColumns = useMemo(
    () => buildIndexToColumnsMapFromId(selectedCells, sortedLogs),
    [selectedCells, sortedLogs]
  );
  // 4) Build row indices
  const selectedRowIndices = useMemo(
    () => buildRowIndicesInSelectionOrder(selectedCells, sortedLogs),
    [selectedCells, sortedLogs]
  );
  // 5) Possibly read column order (memoized)
  const columnOrdering = useMemo(() => columnOrdering_?.split(",") || [], [columnOrdering_]);
  // Move the useMemo hooks above the conditional return
  const orderedEntryKeys = useMemo(() => {
    if (columnOrdering.length > 0) return columnOrdering;
    return sortedLogs[0] && sortedLogs[0].entries ? Object.keys(sortedLogs[0].entries) : [];
  }, [columnOrdering, sortedLogs]);
  
  const orderedParamKeys = useMemo(() => {
    return sortedLogs[0] && sortedLogs[0].params ? Object.keys(sortedLogs[0].params) : [];
  }, [sortedLogs]);
  // 6) For selection we ignore the table's hidden columns.
  const hiddenColumns: string[] = [];
  // 7) Global ordering state for entries and params (for the visible set of fields).
  const [globalEntryOrderings, setGlobalEntryOrderings] = useState<{[key: string]: string[]}>({});
  const [globalParamOrderings, setGlobalParamOrderings] = useState<{[key: string]: string[]}>({});
  // 8) Let user cycle # of side-by-side panels. Each has independent state
  const [panelCount, setPanelCount] = useState(1);
  const [displayMode, setDisplayMode] = useState<"markdown" | "text" | "raw">("markdown");
  // NEW: Edit mode: when active, all accordions are collapsed and locked.
  const [editMode, setEditMode] = useState(false);
  // Save the current open accordions state so we can restore later when turning off edit mode
  const [prevOpenAccordions, setPrevOpenAccordions] = useState<string[]>([]);
  // NEW: New local filter state for this Selection view:
  const [entriesFilter, setEntriesFilter] = useState<Record<string, boolean>>({});
  const [paramsFilter, setParamsFilter] = useState<Record<string, boolean>>({});
  // Compute a base log from the first selected row (if available)
  const baseLog = selectedRowIndices.length > 0 ? sortedLogs[selectedRowIndices[0]] : null;
  // Compute the keys for entries and params from the base log.
  const entryKeys = useMemo(() => {
    return baseLog ? Object.keys(baseLog.entries ?? {}) : [];
  }, [baseLog, baseLog?.entries]);
  const paramKeys = useMemo(() => {
    return baseLog ? Object.keys(baseLog.params ?? {}) : [];
  }, [baseLog, baseLog?.params]);
  useEffect(() => {
    setEntriesFilter((prev) => {
      const updated = { ...prev };
      // For each key from the new entryKeys, add it if missing (default true).
      entryKeys.forEach((key) => {
        if (!(key in updated)) {
          updated[key] = true;
        }
      });
      // Remove keys no longer present in entryKeys.
      Object.keys(updated).forEach((key) => {
        if (!entryKeys.includes(key)) {
          delete updated[key];
        }
      });
      return updated;
    });
    setParamsFilter((prev) => {
      const updated = { ...prev };
      // For each key from the new paramKeys, add it if missing (default true).
      paramKeys.forEach((key) => {
        if (!(key in updated)) {
          updated[key] = true;
        }
      });
      // Remove keys no longer present in paramKeys.
      Object.keys(updated).forEach((key) => {
        if (!paramKeys.includes(key)) {
          delete updated[key];
        }
      });
      return updated;
    });
  }, [entryKeys, paramKeys]);
  // Helper to determine if a column is an entry or param.
  const getSectionType = (column: string, baseLog: LogProps | null) => {
    if (!baseLog) return null;
    if (baseLog.entries && column in baseLog.entries) return 'entries';
    if (baseLog.params && column in baseLog.params) return 'params';
    return null;
  };
  // Determine the section order based on the first selected cell.
  const sectionOrder = useMemo(() => {
    if (!selectedCells.length || !baseLog) return ['entries', 'params'];
    const firstCell = selectedCells[0];
    const underscorePos = firstCell.indexOf("_");
    if (underscorePos < 1) return ['entries', 'params'];
    // Extract the part after the underscore.
    const firstColumn = firstCell.slice(underscorePos + 1);
    // If the extracted string contains a '/', split it to get the actual key.
    let keyToCheck = firstColumn;
    if (firstColumn.includes('/')) {
      const parts = firstColumn.split('/');
      keyToCheck = parts[1] || parts[0];
    }
    const firstType = getSectionType(keyToCheck, baseLog);
    return firstType === 'params' ? ['params', 'entries'] : ['entries', 'params'];
  }, [selectedCells, baseLog]);
  const [openAccordionItems, setOpenAccordionItems] = useState<string[]>([]);
  if (!selectedRowIndices.length) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background rounded-md">
        <SelectionHints />
      </div>
    );
  }
  return (
    <div className="flex flex-col w-full h-full overflow-hidden bg-background rounded-md">
      {/* A top bar just for toggling panelCount, raw mode, etc. */}
      <div className="p-2 border-b border-muted flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Selected {selectedRowIndices.length} row(s)
        </p>
        <div className="flex items-center gap-2 relative">
          <ActionButton
            tooltip={
              displayMode === "raw"
                ? "Viewing as raw data"
                : displayMode === "markdown"
                ? "Viewing as markdown"
                : "Viewing as plain text"
            }
            icon={
              displayMode === "raw"
                ? <Code className="h-4 w-4" />
                : displayMode === "markdown"
                ? <Type className="h-4 w-4" />
                : <RemoveFormatting className="h-4 w-4" />
            }
            onClick={() =>
              setDisplayMode((prev) =>
                prev === "markdown" ? "text" : prev === "text" ? "raw" : "markdown"
              )
            }
            variant="ghost"
            size="icon"
          />
          {/* Filter Menu using BasePopover with global and section toggles */}
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
                {/* Global toggle */}
                <div className="flex justify-between items-center mb-5 mt-3">
                  <span className="font-bold text-sm">
                    {(orderedEntryKeys.every(key => entriesFilter[key] !== false) &&
                      orderedParamKeys.every(key => paramsFilter[key] !== false))
                      ? "Hide all" : "Show all"}
                  </span>
                  <Switch
                    checked={
                      (orderedEntryKeys.every(key => entriesFilter[key] !== false) &&
                      orderedParamKeys.every(key => paramsFilter[key] !== false))
                    }
                    onCheckedChange={(checked) => {
                      const newEntries: Record<string, boolean> = {};
                      orderedEntryKeys.forEach((key) => {
                        newEntries[key] = checked;
                      });
                      setEntriesFilter(newEntries);
                      const newParams: Record<string, boolean> = {};
                      orderedParamKeys.forEach((key) => {
                        newParams[key] = checked;
                      });
                      setParamsFilter(newParams);
                    }}
                  />
                </div>
                {/* Entries Section */}
                <div className="mt-2">
                  <div className="flex justify-between items-center mb-1">
                    <p className="font-bold text-sm">Entries</p>
                    <Switch
                      checked={orderedEntryKeys.every(key => entriesFilter[key] !== false)}
                      onCheckedChange={(checked) => {
                        const newEntries: Record<string, boolean> = {};
                        orderedEntryKeys.forEach((key) => {
                          newEntries[key] = checked;
                        });
                        setEntriesFilter(newEntries);
                      }}
                    />
                  </div>
                  {orderedEntryKeys.map((key) => (
                    <div key={key} className="flex flex-row gap-2 items-center justify-between py-1 pl-4">
                      <span className="text-sm max-w-[200px] truncate" title={key}>{key}</span>
                      <Switch
                        checked={entriesFilter[key] !== false}
                        onCheckedChange={(checked) =>
                          setEntriesFilter(prev => ({ ...prev, [key]: checked }))
                        }
                      />
                    </div>
                  ))}
                </div>
                {/* Params Section */}
                {paramKeys.length > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between items-center mb-1">
                      <p className="font-bold text-sm">Params</p>
                      <Switch
                        checked={orderedParamKeys.every(key => paramsFilter[key] !== false)}
                        onCheckedChange={(checked) => {
                          const newParams: Record<string, boolean> = {};
                          orderedParamKeys.forEach((key) => {
                            newParams[key] = checked;
                          });
                          setParamsFilter(newParams);
                        }}
                      />
                    </div>
                    {orderedParamKeys.map((key) => (
                      <div key={key} className="flex flex-row gap-2 items-center justify-between py-1 pl-4">
                        <span className="text-sm max-w-[200px] truncate" title={key}>{key}</span>
                        <Switch
                          checked={paramsFilter[key] !== false}
                          onCheckedChange={(checked) =>
                            setParamsFilter(prev => ({ ...prev, [key]: checked }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </BasePopover>
          <ActionButton
            tooltip={`Cycle panel count (currently: ${panelCount})`}
            icon={<SquareSplitHorizontal className="h-4 w-4" />}
            onClick={() => setPanelCount((prev) => (prev === 3 ? 1 : prev + 1))}
            variant="ghost"
            size="icon"
          />
          {/* NEW: Edit mode button */}
          <ActionButton
            tooltip={editMode ? "Edit mode active – drag and drop enabled" : "Activate edit mode for drag and drop"}
            icon={<Grab className="h-4 w-4" />}
            onClick={() => {
              if (!editMode) {
                // On entering edit mode, save current open accordions and collapse them
                setPrevOpenAccordions(openAccordionItems);
                setOpenAccordionItems([]);
                setEditMode(true);
              } else {
                // Restore previous open states when turning off edit mode
                setOpenAccordionItems(prevOpenAccordions);
                setEditMode(false);
              }
            }}
            variant={editMode ? "primary" : "ghost"}
            size="icon"
          />
        </div>
      </div>
      {/* Panels in a horizontal row, each scrollable independently */}
      <div className="flex-1 flex flex-row gap-2 overflow-hidden">
        {Array.from({ length: panelCount }).map((_, idx) => (
          <SelectionPanel
            key={idx}
            panelId={idx}
            params={params}
            logs={sortedLogs}
            indexToColumns={indexToColumns}
            selectedRowIndices={selectedRowIndices}
            hiddenColumns={hiddenColumns}
            columnOrdering={columnOrdering}
            displayMode={displayMode}
            tableItem={tableItem}
            item={item}
            updateItem={updateItem}
            entriesFilter={entriesFilter}
            paramsFilter={paramsFilter}
            selectionOrder={sectionOrder}
            onHideEntry={(prop) => setEntriesFilter((prev) => ({ ...prev, [prop]: false }))}
            onHideParam={(prop) => setParamsFilter((prev) => ({ ...prev, [prop]: false }))}
            openAccordionItems={openAccordionItems}
            setOpenAccordionItems={setOpenAccordionItems}
            editMode={editMode}
            globalEntryOrderings={globalEntryOrderings}
            setGlobalEntryOrderings={setGlobalEntryOrderings}
            globalParamOrderings={globalParamOrderings}
            setGlobalParamOrderings={setGlobalParamOrderings}
          />
        ))}
      </div>
    </div>
  );
}

/*******************************************************************************
 * (E) "SelectionPanel": each panel is fully independent in expansions, base row,
 *     diff mode, etc.
 ******************************************************************************/
function SelectionPanel({
  panelId,
  params,
  logs,
  indexToColumns,
  selectedRowIndices,
  hiddenColumns,
  columnOrdering,
  displayMode,
  tableItem,
  item,
  entriesFilter,
  paramsFilter,
  selectionOrder,
  onHideEntry,
  onHideParam,
  updateItem,
  openAccordionItems,
  setOpenAccordionItems,
  editMode,
  globalEntryOrderings,
  setGlobalEntryOrderings,
  globalParamOrderings,
  setGlobalParamOrderings,
}: {
  panelId: number;
  params: Record<string, unknown>;
  logs: LogProps[];
  indexToColumns: Record<number, Set<string>>;
  selectedRowIndices: number[];
  hiddenColumns: string[];
  columnOrdering: string[];
  displayMode: "text" | "markdown" | "raw";
  tableItem: TileProps | undefined;
  item: TileProps;
  entriesFilter: Record<string, boolean>;
  paramsFilter: Record<string, boolean>;
  selectionOrder: string[];
  onHideEntry: (prop: string) => void;
  onHideParam: (prop: string) => void;
  updateItem: (item: TileProps, attrName: ItemType) => (newValue: string | undefined) => void;
  openAccordionItems: string[];
  setOpenAccordionItems: React.Dispatch<React.SetStateAction<string[]>>;
  editMode: boolean;
  globalEntryOrderings: { [key: string]: string[] };
  setGlobalEntryOrderings: React.Dispatch<React.SetStateAction<{ [key: string]: string[] }>>;
  globalParamOrderings: { [key: string]: string[] };
  setGlobalParamOrderings: React.Dispatch<React.SetStateAction<{ [key: string]: string[] }>>;
}) {
  // 1) local state: pick a base row among the selected rowIndices
  let baseIndexParam = parseInt(item.base_index ?? "0", 10);
  if (isNaN(baseIndexParam)) {
    baseIndexParam = 0;
  }
  if (baseIndexParam < 0 || baseIndexParam >= selectedRowIndices.length) {
    baseIndexParam = 0;
  }
  // 2) local expansions: openItems, openParamItems
  const [openItems, setOpenItems] = useState<string[]>([]);
  const [openParamItems, setOpenParamItems] = useState<string[]>([]);
  // 3) diff mode & split
  type DiffMode = "none" | "lines" | "words" | "characters";
  const allModes: DiffMode[] = ["none", "lines", "words", "characters"];
  const modeIcons = [
    <SquareSlash key="none" />,
    <FileText key="lines" />,
    <CaseLower key="words" />,
    <Pilcrow key="characters" />,
  ];
  const [modeIndex, setModeIndex] = useState(0);
  const diffMode = allModes[modeIndex];
  const [splitView, setSplitView] = useState(false);
  function handleCycleMode() {
    setModeIndex((prev) => (prev + 1) % allModes.length);
  }
  function handleToggleSplit() {
    setSplitView((prev) => !prev);
  }
  // 4) Build baseLog + comparison logs for THIS panel
  const baseRowIndex = selectedRowIndices[baseIndexParam] ?? -1;
  const comparisonRowIndices = selectedRowIndices.filter(
    (_, i) => i !== baseIndexParam
  );
  const buildLogIfValid = useCallback((ri: number) => {
    if (ri < 0 || ri >= logs.length) return null;
    return buildLogWithChosenColumns(
      logs[ri],
      ri,
      params,
      indexToColumns,
      columnOrdering,
      []  // always pass an empty array here
    );
  }, [logs, params, indexToColumns, columnOrdering]);
  const baseLog = useMemo(() => buildLogIfValid(baseRowIndex), [baseRowIndex, buildLogIfValid]);
  const comparisonLogs = useMemo(
    () => comparisonRowIndices.map((ri) => buildLogIfValid(ri)).filter((x) => x),
    [comparisonRowIndices, buildLogIfValid]
  ) as LogProps[];
  // gather keys => default expansions
  const entryKeys = useMemo(() => {
    return baseLog ? Object.keys(baseLog.entries ?? {}) : [];
  }, [baseLog, baseLog?.entries]);
  const paramKeys = useMemo(() => {
    return baseLog ? Object.keys(baseLog.params ?? {}) : [];
  }, [baseLog, baseLog?.params]);
  const defaultOpenEntries = useMemo(() => {
    if (!baseLog) return [];
    return defaultOpenFor(entryKeys, baseLog.entries);
  }, [baseLog, entryKeys]);
  const defaultOpenParams = useMemo(() => {
    if (!baseLog) return [];
    return defaultOpenFor(paramKeys, baseLog.params);
  }, [baseLog, paramKeys]);
  // New: dragging code ordering for entries and params.
  // Initialize local ordering state using default table order.
  const [entryOrder, setEntryOrder] = useState<string[]>(entryKeys);
  const [paramOrder, setParamOrder] = useState<string[]>(paramKeys);
  // Compute the visible ordering for rendering:
  // Only include columns that pass the toggle and also have a defined base value.
  const visibleEntryKeysForRendering = useMemo(() => {
    return entryOrder.filter(
      col => entriesFilter[col] !== false && baseLog?.entries[col] !== undefined
    );
  }, [entryOrder, entriesFilter, baseLog]);
  const currentEntryKey = useMemo(() => {
    return visibleEntryKeysForRendering.slice().sort().join(",");
  }, [visibleEntryKeysForRendering]);
  const visibleParamKeysForRendering = useMemo(() => {
    return paramOrder.filter(
      col => paramsFilter[col] !== false && baseLog?.params[col] !== undefined
    );
  }, [paramOrder, paramsFilter, baseLog]);
  const currentParamKey = useMemo(() => {
    return visibleParamKeysForRendering.slice().sort().join(",");
  }, [visibleParamKeysForRendering]);
  // If the global ordering exists for the current visible columns, update local entryOrder.
  useEffect(() => {
    if (globalEntryOrderings[currentEntryKey] &&
        JSON.stringify(entryOrder) !== JSON.stringify(globalEntryOrderings[currentEntryKey])) {
      setEntryOrder(globalEntryOrderings[currentEntryKey]);
    } else if (!globalEntryOrderings[currentEntryKey] && entryOrder.length === 0 && entryKeys.length > 0) {
      setEntryOrder(entryKeys);
    }
  }, [currentEntryKey, globalEntryOrderings, entryOrder, entryKeys]);
  useEffect(() => {
    if (globalParamOrderings[currentParamKey] &&
        JSON.stringify(paramOrder) !== JSON.stringify(globalParamOrderings[currentParamKey])) {
      setParamOrder(globalParamOrderings[currentParamKey]);
    } else if (!globalParamOrderings[currentParamKey] && paramOrder.length === 0 && paramKeys.length > 0) {
      setParamOrder(paramKeys);
    }
  }, [currentParamKey, globalParamOrderings, paramOrder, paramKeys]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );
  // Modify drag end callbacks to also update the global ordering.
  function handleEntryDragEnd(event: any) {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setEntryOrder((items) => {
        const newOrder = arrayMove(items, items.indexOf(active.id), items.indexOf(over.id));
        setGlobalEntryOrderings(prev => ({ ...prev, [currentEntryKey]: newOrder }));
        return newOrder;
      });
    }
  }
  function handleParamDragEnd(event: any) {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setParamOrder((items) => {
        const newOrder = arrayMove(items, items.indexOf(active.id), items.indexOf(over.id));
        setGlobalParamOrderings(prev => ({ ...prev, [currentParamKey]: newOrder }));
        return newOrder;
      });
    }
  }
  useEffect(() => {
    if (baseLog) {
      setOpenItems(defaultOpenEntries);
      setOpenParamItems(defaultOpenParams);
    }
  }, [baseLog, defaultOpenEntries, defaultOpenParams]);
  // If no columns survive filtering, render nothing for that section.
  const entriesToRender = entryOrder.filter(
    col => entriesFilter[col] !== false && baseLog?.entries[col] !== undefined
  );
  const paramsToRender = paramOrder.filter(
    col => paramsFilter[col] !== false && baseLog?.params[col] !== undefined
  );
  let content: JSX.Element;
  if (!baseLog) {
    content = (
      <div className="flex items-center justify-center h-full w-full">
        <SelectionHints />
      </div>
    );
  } else {
    let entriesSection: JSX.Element | null = null;
    if (entriesToRender.length > 0) {
      entriesSection = (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between sticky top-0 z-10 bg-background py-2 border-b border-muted">
            <p className="font-bold text-lg">Entries</p>
            <ActionButton
              variant="ghost"
              size="icon"
              tooltip={entriesToRender.length === entryKeys.length ? "Collapse All" : "Expand All"}
              onClick={() => {
                if (entriesToRender.length === entryKeys.length) {
                  setOpenItems([]);
                } else {
                  setOpenItems(entryKeys);
                }
              }}
              icon={entriesToRender.length === entryKeys.length ? <FoldVertical /> : <UnfoldVertical />}
            />
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleEntryDragEnd}>
            <SortableContext items={entryOrder} strategy={verticalListSortingStrategy}>
              <Accordion
                type="multiple"
                value={editMode ? openAccordionItems : openItems}
                onValueChange={editMode ? () => {} : setOpenItems}
              >
                {entryOrder
                  .filter((col) => entriesFilter[col] !== false && baseLog.entries[col] !== undefined)
                  .map((col) => (
                    <SortableAccordionItem key={col} id={col} editMode={editMode}>
                      <SelectionEntry
                        source="entries"
                        property={col}
                        value={baseLog.entries[col]}
                        baseLog={baseLog}
                        baseLogIndex={baseRowIndex + 1}
                        comparisonLogs={comparisonLogs}
                        comparisonLogsIndex={comparisonRowIndices.map((x) => x + 1)}
                        diffMode={diffMode || "none"}
                        splitView={splitView}
                        displayMode={displayMode}
                        onHideColumn={onHideEntry}
                        tableItem={tableItem}
                        updateItem={updateItem}
                        onAccordionValueChange={editMode ? setOpenAccordionItems : setOpenItems}
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
    let paramsSection: JSX.Element | null = null;
    if (paramsToRender.length > 0) {
      paramsSection = (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between sticky top-0 z-10 bg-background py-2 border-b border-muted">
            <p className="font-bold text-lg">Params</p>
            <ActionButton
              variant="ghost"
              size="icon"
              tooltip={paramsToRender.length === paramKeys.length ? "Collapse All" : "Expand All"}
              onClick={() => {
                if (paramsToRender.length === paramKeys.length) {
                  setOpenParamItems([]);
                } else {
                  setOpenParamItems(paramKeys);
                }
              }}
              icon={paramsToRender.length === paramKeys.length ? <FoldVertical /> : <UnfoldVertical />}
            />
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleParamDragEnd}>
            <SortableContext items={paramOrder} strategy={verticalListSortingStrategy}>
              <Accordion
                type="multiple"
                value={editMode ? openAccordionItems : openParamItems}
                onValueChange={editMode ? () => {} : setOpenParamItems}
              >
                {paramOrder
                  .filter((col) => paramsFilter[col] !== false && baseLog.params[col] !== undefined)
                  .map((col) => {
                    const baseParam = baseLog.params[col];
                    const baseDisplayValue =
                      baseParam &&
                      typeof baseParam === "object" &&
                      "paramValue" in baseParam &&
                      "paramVersion" in baseParam
                        ? baseParam.paramValue
                        : baseParam;
                    const baseVersion =
                      baseParam &&
                      typeof baseParam === "object" &&
                      "paramValue" in baseParam &&
                      "paramVersion" in baseParam
                        ? baseParam.paramVersion
                        : "";
                    const compVersions = comparisonLogs.map((log) => {
                      const param = log.params[col];
                      if (
                        param &&
                        typeof param === "object" &&
                        "paramValue" in param &&
                        "paramVersion" in param
                      ) {
                        return param.paramVersion as string;
                      }
                      return "";
                    });
                    return (
                      <SortableAccordionItem key={col} id={col} editMode={editMode}>
                        <SelectionEntry
                          source="params"
                          property={col}
                          value={baseDisplayValue}
                          version={baseVersion}
                          comparableVersions={compVersions}
                          baseLog={baseLog}
                          baseLogIndex={baseRowIndex + 1}
                          comparisonLogs={comparisonLogs}
                          comparisonLogsIndex={comparisonRowIndices.map((x) => x + 1)}
                          diffMode={diffMode}
                          splitView={splitView}
                          displayMode={displayMode}
                          onHideColumn={onHideParam}
                          tableItem={tableItem}
                          updateItem={updateItem}
                          onAccordionValueChange={editMode ? setOpenAccordionItems : setOpenParamItems}
                          editMode={editMode}
                        />
                      </SortableAccordionItem>
                    );
                  })}
              </Accordion>
            </SortableContext>
          </DndContext>
        </div>
      );
    }
    const renderedSections = selectionOrder
      .map(section => (section === 'entries' ? entriesSection : paramsSection))
      .filter(section => section !== null);
    content = renderedSections.length > 0 ? (
      <div className="flex flex-col gap-6">
        {renderedSections}
      </div>
    ) : (
      <div className="flex items-center justify-center h-full w-full">
        <p className="text-sm text-muted-foreground mt-5">Nothing to show ☹️ </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col w-full h-full overflow-hidden">
      {selectedRowIndices.length > 1 && (
        <div className="shrink-0 border-b border-muted bg-background flex items-center justify-between py-2 px-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Base:</span>
            <Combobox
              items={selectedRowIndices.map((rIdx, i) => {
                const label = rowLabel(rIdx);
                return { value: label, label, dataIndex: i };
              })}
              value={
                selectedRowIndices[baseIndexParam] !== undefined
                  ? rowLabel(selectedRowIndices[baseIndexParam])
                  : ""
              }
              onValueChange={(newLabel) => {
                const found = selectedRowIndices.findIndex(
                  (r) => rowLabel(r) === newLabel
                );
                if (found >= 0 && String(found) !== item.base_index) {
                  updateItem(item, "base_index")(String(found));
                }
              }}
              placeholder="Pick base row"
              className="w-[110px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <ActionButton
              tooltip={`Cycle diff mode (current: ${diffMode})`}
              icon={modeIcons[modeIndex]}
              onClick={handleCycleMode}
              variant="ghost"
              size="icon"
            />
            <ActionButton
              tooltip={splitView ? "Switch to Inline View" : "Switch to Split View"}
              icon={splitView ? <Columns className="h-4 w-4" /> : <AlignJustify className="h-4 w-4" />}
              onClick={handleToggleSplit}
              variant="ghost"
              size="icon"
            />
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-5 min-h-0">
        {content}
      </div>
    </div>
  );
}

/*******************************************************************************
 * (F) "SortableAccordionItem": for drag-and-drop
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
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
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
      <div className={editMode ? "flex-1 ml-0" : "flex-1 ml-2"}>
        {children}
      </div>
    </div>
  );
}

export {};