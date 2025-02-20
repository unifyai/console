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
      return (val as Record<string, unknown>)["0"];
    }
  }
  return val;
}
function rowLabel(rowIndex: number) {
  return `Row ${rowIndex + 1}`;
}

// Helper to compare two arrays shallowly:
function shallowArrayEquals(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

/*******************************************************************************
 * (B) Helpers: building row->columns maps
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
 * (C) buildLogWithChosenColumns
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
    if (Object.prototype.hasOwnProperty.call(safeEntries, c)) {
      newEntries[c] = safeEntries[c];
    }
  }

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
    if (!Object.prototype.hasOwnProperty.call(safeParams, c)) continue;
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
 ******************************************************************************/

function shallowEqualBooleanRecords(
  a: Record<string, boolean>,
  b: Record<string, boolean>
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key in a) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

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
  updateItem: (item: TileProps, attrName: ItemType) => (newValue: string | undefined) => void;
}) {
  const sortedLogs = useMemo(() => {
    return [...logs];
  }, [logs]);

  const selectedCells = useMemo(() => {
    return selection_ ? selection_.split(",") : [];
  }, [selection_]);

  const indexToColumns = useMemo(() => {
    return buildIndexToColumnsMapFromId(selectedCells, sortedLogs);
  }, [selectedCells, sortedLogs]);

  const selectedRowIndices = useMemo(() => {
    return buildRowIndicesInSelectionOrder(selectedCells, sortedLogs);
  }, [selectedCells, sortedLogs]);

  const columnOrdering = useMemo(() => columnOrdering_?.split(",") || [], [columnOrdering_]);
  const hiddenColumns = hiddenColumns_ ? hiddenColumns_.split(",") : [];

  const [globalEntryOrderings, setGlobalEntryOrderings] = useState<{ [key: string]: string[] }>({});
  const [globalParamOrderings, setGlobalParamOrderings] = useState<{ [key: string]: string[] }>({});

  const [panelCount, setPanelCount] = useState(1);
  const [displayMode, setDisplayMode] = useState<"markdown" | "text" | "raw">("markdown");

  const [editMode, setEditMode] = useState(false);
  const [prevOpenAccordions, setPrevOpenAccordions] = useState<string[]>([]);

  const [entriesFilter, setEntriesFilter] = useState<Record<string, boolean>>({});
  const [paramsFilter, setParamsFilter] = useState<Record<string, boolean>>({});

  const baseLogIndex = selectedRowIndices[0];
  const baseLog = baseLogIndex !== undefined ? sortedLogs[baseLogIndex] : null;

  const entryKeys = useMemo(() => {
    if (!baseLog) return [];
    return Object.keys(baseLog.entries ?? {});
  }, [baseLog]);

  const paramKeys = useMemo(() => {
    if (!baseLog) return [];
    return Object.keys(baseLog.params ?? {});
  }, [baseLog]);

  useEffect(() => {
    const updatedEntries: Record<string, boolean> = { ...entriesFilter };
    entryKeys.forEach((k) => {
      if (!(k in updatedEntries)) {
        updatedEntries[k] = true;
      }
    });
    Object.keys(updatedEntries).forEach((k) => {
      if (!entryKeys.includes(k)) {
        delete updatedEntries[k];
      }
    });

    const updatedParams: Record<string, boolean> = { ...paramsFilter };
    paramKeys.forEach((k) => {
      if (!(k in updatedParams)) {
        updatedParams[k] = true;
      }
    });
    Object.keys(updatedParams).forEach((k) => {
      if (!paramKeys.includes(k)) {
        delete updatedParams[k];
      }
    });

    if (!shallowEqualBooleanRecords(updatedEntries, entriesFilter)) {
      setEntriesFilter(updatedEntries);
    }
    if (!shallowEqualBooleanRecords(updatedParams, paramsFilter)) {
      setParamsFilter(updatedParams);
    }
  }, [entryKeys, paramKeys, entriesFilter, paramsFilter]);

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
            onClick={() => {
              setDisplayMode((prev) => {
                const newVal =
                  prev === "markdown" ? "text" : prev === "text" ? "raw" : "markdown";
                return newVal;
              });
            }}
            variant="ghost"
            size="icon"
          />
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
                <div className="flex justify-between items-center mb-5 mt-3">
                  <span className="font-bold text-sm">
                    {(entryKeys.every(key => entriesFilter[key] !== false) &&
                      paramKeys.every(key => paramsFilter[key] !== false))
                      ? "Hide all" : "Show all"}
                  </span>
                  <Switch
                    checked={
                      (entryKeys.every(key => entriesFilter[key] !== false) &&
                        paramKeys.every(key => paramsFilter[key] !== false))
                    }
                    onCheckedChange={(checked) => {
                      const newE: Record<string, boolean> = {};
                      entryKeys.forEach((key) => { newE[key] = checked; });
                      if (!shallowEqualBooleanRecords(newE, entriesFilter)) {
                        setEntriesFilter(newE);
                      }

                      const newP: Record<string, boolean> = {};
                      paramKeys.forEach((key) => { newP[key] = checked; });
                      if (!shallowEqualBooleanRecords(newP, paramsFilter)) {
                        setParamsFilter(newP);
                      }
                    }}
                  />
                </div>
                {/* entries toggles */}
                <div className="mt-2">
                  <div className="flex justify-between items-center mb-1">
                    <p className="font-bold text-sm">Entries</p>
                    <Switch
                      checked={entryKeys.every(key => entriesFilter[key] !== false)}
                      onCheckedChange={(checked) => {
                        const newEntries: Record<string, boolean> = {};
                        entryKeys.forEach((key) => {
                          newEntries[key] = checked;
                        });
                        if (!shallowEqualBooleanRecords(newEntries, entriesFilter)) {
                          setEntriesFilter(newEntries);
                        }
                      }}
                    />
                  </div>
                  {entryKeys.map((key) => (
                    <div
                      key={`entry-filter-${key}`}
                      className="flex flex-row gap-2 items-center justify-between py-1 pl-4"
                    >
                      <span className="text-sm max-w-[200px] truncate" title={key}>{key}</span>
                      <Switch
                        checked={entriesFilter[key] !== false}
                        onCheckedChange={(checked) => {
                          setEntriesFilter((prev) => {
                            if (prev[key] === checked) {
                              return prev;
                            }
                            const newVal = { ...prev, [key]: checked };
                            return newVal;
                          });
                        }}
                      />
                    </div>
                  ))}
                </div>
                {/* params toggles */}
                {paramKeys.length > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between items-center mb-1">
                      <p className="font-bold text-sm">Params</p>
                      <Switch
                        checked={paramKeys.every(key => paramsFilter[key] !== false)}
                        onCheckedChange={(checked) => {
                          const newParams: Record<string, boolean> = {};
                          paramKeys.forEach((key) => {
                            newParams[key] = checked;
                          });
                          if (!shallowEqualBooleanRecords(newParams, paramsFilter)) {
                            setParamsFilter(newParams);
                          }
                        }}
                      />
                    </div>
                    {paramKeys.map((key) => (
                      <div
                        key={`param-filter-${key}`}
                        className="flex flex-row gap-2 items-center justify-between py-1 pl-4"
                      >
                        <span className="text-sm max-w-[200px] truncate" title={key}>{key}</span>
                        <Switch
                          checked={paramsFilter[key] !== false}
                          onCheckedChange={(checked) => {
                            setParamsFilter((prev) => {
                              if (prev[key] === checked) {
                                return prev;
                              }
                              const newVal = { ...prev, [key]: checked };
                              return newVal;
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
          <ActionButton
            tooltip={`Cycle panel count (currently: ${panelCount})`}
            icon={<SquareSplitHorizontal className="h-4 w-4" />}
            onClick={() => {
              setPanelCount((prev) => {
                const newVal = prev === 3 ? 1 : prev + 1;
                return newVal;
              });
            }}
            variant="ghost"
            size="icon"
          />
          <ActionButton
            tooltip={
              editMode
                ? "Edit mode active – drag and drop enabled"
                : "Activate edit mode for drag and drop"
            }
            icon={<Grab className="h-4 w-4" />}
            onClick={() => {
              if (!editMode) {
                setPrevOpenAccordions(openAccordionItems);
                setOpenAccordionItems([]);
                setEditMode(true);
              } else {
                setOpenAccordionItems(prevOpenAccordions);
                setEditMode(false);
              }
            }}
            variant={editMode ? "primary" : "ghost"}
            size="icon"
          />
        </div>
      </div>

      <div className="flex-1 flex flex-row gap-2 overflow-hidden">
        {Array.from({ length: panelCount }).map((_, idx) => (
          <SelectionPanel
            key={`panel-${idx}`}
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
            selectionOrder={["params","entries"]}
            onHideEntry={(prop) => {
              setEntriesFilter((prev) => {
                if (prev[prop] === false) {
                  return prev;
                }
                const newVal = { ...prev, [prop]: false };
                return newVal;
              });
            }}
            onHideParam={(prop) => {
              setParamsFilter((prev) => {
                if (prev[prop] === false) {
                  return prev;
                }
                const newVal = { ...prev, [prop]: false };
                return newVal;
              });
            }}
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
 * (E) "SelectionPanel" component
 ******************************************************************************/
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
  let baseIndexParam = parseInt(item.base_index ?? "0", 10);
  if (isNaN(baseIndexParam)) baseIndexParam = 0;
  if (baseIndexParam < 0 || baseIndexParam >= selectedRowIndices.length) {
    baseIndexParam = 0;
  }

  const [openItemsMap, setOpenItemsMap] = useState<Record<number, string[]>>({});
  const [openParamItemsMap, setOpenParamItemsMap] = useState<Record<number, string[]>>({});
  const [openItems, setOpenItems] = useState<string[]>([]);
  const [openParamItems, setOpenParamItems] = useState<string[]>([]);

  type DiffMode = "none" | "lines" | "words" | "characters";
  const allModes: DiffMode[] = ["none", "lines", "words", "characters"];
  const [modeIndex, setModeIndex] = useState(0);
  const diffMode = allModes[modeIndex];
  const [splitView, setSplitView] = useState(false);

  const baseRowIndex = selectedRowIndices[baseIndexParam] ?? -1;
  const comparisonRowIndices = selectedRowIndices.filter((_, i) => i !== baseIndexParam);

  const buildLogIfValid = useCallback((ri: number) => {
    if (ri < 0 || ri >= logs.length) return null;
    return buildLogWithChosenColumns(
      logs[ri],
      ri,
      params,
      indexToColumns,
      columnOrdering,
      hiddenColumns
    );
  }, [logs, params, indexToColumns, columnOrdering, hiddenColumns]);

  const baseLog = useMemo(() => buildLogIfValid(baseRowIndex), [baseRowIndex, buildLogIfValid]);
  const comparisonLogs = useMemo(
    () => comparisonRowIndices.map((ri) => buildLogIfValid(ri)).filter((x) => x) as LogProps[],
    [comparisonRowIndices, buildLogIfValid]
  );

  const entryKeys = useMemo(() => {
    if (!baseLog) return [];
    const cE = comparisonLogs.map((cl) => cl.entries);
    return gatherUnionOfKeys(baseLog.entries, cE);
  }, [baseLog, comparisonLogs]);

  const paramKeys = useMemo(() => {
    if (!baseLog) return [];
    const cP = comparisonLogs.map((cl) => cl.params);
    return gatherUnionOfKeys(baseLog.params, cP);
  }, [baseLog, comparisonLogs]);

  const defaultOpenEntries = useMemo(() => {
    if (!baseLog) return [];
    return defaultOpenFor(entryKeys, baseLog.entries ?? {});
  }, [entryKeys, baseLog]);

  const defaultOpenParams = useMemo(() => {
    if (!baseLog) return [];
    return defaultOpenFor(paramKeys, baseLog.params ?? {});
  }, [paramKeys, baseLog]);

  const prevBaseIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (prevBaseIndexRef.current === baseRowIndex) {
      return;
    }
    if (baseRowIndex < 0) return;
    if (!baseLog) return;

    if (prevBaseIndexRef.current != null) {
      setOpenItemsMap((prev) => {
        const newVal = { ...prev, [prevBaseIndexRef.current!]: openItems };
        return newVal;
      });
      setOpenParamItemsMap((prev) => {
        const newVal = { ...prev, [prevBaseIndexRef.current!]: openParamItems };
        return newVal;
      });
    }
    const oldE = openItemsMap[baseRowIndex] ?? defaultOpenEntries;
    const oldP = openParamItemsMap[baseRowIndex] ?? defaultOpenParams;

    setOpenItems(oldE);
    setOpenParamItems(oldP);
    prevBaseIndexRef.current = baseRowIndex;
  }, [
    baseRowIndex,
    openItems,
    openParamItems,
    openItemsMap,
    openParamItemsMap,
    defaultOpenEntries,
    defaultOpenParams,
    baseLog,
  ]);

  const [entryOrder, setEntryOrder] = useState<string[]>(entryKeys);
  const [paramOrder, setParamOrder] = useState<string[]>(paramKeys);

  function visibleEntries(): string[] {
    return entryKeys.filter((col) => entriesFilter[col] !== false);
  }
  function visibleEntriesKey() {
    const arr = [...visibleEntries()].sort();
    return arr.join(",");
  }
  function visibleParams(): string[] {
    return paramKeys.filter((col) => paramsFilter[col] !== false);
  }
  function visibleParamsKey() {
    const arr = [...visibleParams()].sort();
    return arr.join(",");
  }

  useEffect(() => {
    const vKey = visibleEntriesKey();
    const reorder = globalEntryOrderings[vKey];
    if (reorder && JSON.stringify(entryOrder) !== JSON.stringify(reorder)) {
      setEntryOrder(reorder);
    } else if (!reorder && entryOrder.length === 0) {
      const fallback = visibleEntries();
      if (!shallowArrayEquals(fallback, entryOrder)) {
        setEntryOrder(fallback);
      }
    }
  }, [entryKeys, entriesFilter]); // intentionally not including entryOrder in deps

  useEffect(() => {
    const vKey = visibleParamsKey();
    const reorder = globalParamOrderings[vKey];
    if (reorder && JSON.stringify(paramOrder) !== JSON.stringify(reorder)) {
      setParamOrder(reorder);
    } else if (!reorder && paramOrder.length === 0) {
      const fallback = visibleParams();
      if (!shallowArrayEquals(fallback, paramOrder)) {
        setParamOrder(fallback);
      }
    }
  }, [paramKeys, paramsFilter]); // intentionally not including paramOrder in deps

  useEffect(() => {
    if (entryKeys.length > 0) {
      const missing = entryKeys.filter((c) => !entryOrder.includes(c));
      if (missing.length > 0) {
        setEntryOrder((prev) => {
          const newVal = [...prev, ...missing];
          return newVal;
        });
      }
    }
  }, [entryKeys]);

  useEffect(() => {
    if (paramKeys.length > 0) {
      const missingP = paramKeys.filter((c) => !paramOrder.includes(c));
      if (missingP.length > 0) {
        setParamOrder((prev) => {
          const newVal = [...prev, ...missingP];
          return newVal;
        });
      }
    }
  }, [paramKeys]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleEntryDragEnd(event: any) {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setEntryOrder((items) => {
        const newOrder = arrayMove(items, items.indexOf(active.id), items.indexOf(over.id));
        if (!shallowArrayEquals(newOrder, items)) {
          const key = visibleEntriesKey();
          setGlobalEntryOrderings((prev) => {
            const updated = { ...prev, [key]: newOrder };
            return updated;
          });
          return newOrder;
        } else {
          return items;
        }
      });
    }
  }

  function handleParamDragEnd(event: any) {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setParamOrder((items) => {
        const newOrder = arrayMove(items, items.indexOf(active.id), items.indexOf(over.id));
        if (!shallowArrayEquals(newOrder, items)) {
          const key = visibleParamsKey();
          setGlobalParamOrderings((prev) => {
            const updated = { ...prev, [key]: newOrder };
            return updated;
          });
          return newOrder;
        } else {
          return items;
        }
      });
    }
  }

  // A helper to detect if a base value + comps are all empty => skip
  function isAllEmpty(baseVal: any, comps: any[]) {
    const arr = [baseVal, ...comps];
    for (const v of arr) {
      if (!isEmptyOrBlank(v)) {
        return false;
      }
    }
    return true;
  }
  function isEmptyOrBlank(v: any) {
    if (v === null || v === undefined) return true;
    if (typeof v === "string" && v.trim().length === 0) return true;
    return false;
  }

  /*****************************************************************************
   * Build param section
   *****************************************************************************/
  const paramSection = useMemo(() => {
    if (!baseLog) return null;

    const areAllOpenParams = paramOrder.length > 0 &&
      paramOrder.every((p) => openParamItems.includes(p)) &&
      openParamItems.length === paramOrder.length;

    if (paramOrder.length === 0) {
      return null;
    }

    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between sticky top-0 z-10 bg-background py-2 border-b border-muted">
          <p className="font-bold text-lg">Params</p>
          <ActionButton
            variant="ghost"
            size="icon"
            tooltip={areAllOpenParams ? "Collapse All" : "Expand All"}
            onClick={() => {
              if (areAllOpenParams) {
                setOpenParamItems([]);
              } else {
                setOpenParamItems(paramOrder);
              }
            }}
            icon={areAllOpenParams ? <FoldVertical /> : <UnfoldVertical />}
          />
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleParamDragEnd}>
          <SortableContext items={paramOrder} strategy={verticalListSortingStrategy}>
            <Accordion
              type="multiple"
              value={editMode ? [] : openParamItems}
              onValueChange={(vals) => {
                if (!editMode) {
                  setOpenParamItems(vals);
                }
              }}
            >
              {paramOrder
                .filter((col) => paramsFilter[col] !== false)
                .map((col) => {
                  const baseParam = baseLog.params?.[col];
                  const compVals = comparisonLogs.map((cl) => cl.params?.[col]);
                  // If all empty => skip entirely
                  if (isAllEmpty(baseParam, compVals)) {
                    return null;
                  }

                  // Build paramVersion array if needed
                  const compVers = comparisonLogs.map((cl) => {
                    const p = cl.params?.[col];
                    if (
                      p &&
                      typeof p === "object" &&
                      "paramValue" in p &&
                      "paramVersion" in p
                    ) {
                      return p.paramVersion as string;
                    }
                    return "";
                  });
                  const baseVer = ((): string => {
                    if (
                      baseParam &&
                      typeof baseParam === "object" &&
                      "paramValue" in baseParam &&
                      "paramVersion" in baseParam
                    ) {
                      return baseParam.paramVersion as string;
                    }
                    return "";
                  })();
                  const baseVal =
                    baseParam &&
                    typeof baseParam === "object" &&
                    "paramValue" in baseParam &&
                    "paramVersion" in baseParam
                      ? baseParam.paramValue
                      : baseParam;

                  const selEntry = (
                    <SelectionEntry
                      key={`param-${col}`}
                      source="params"
                      property={col}
                      value={baseVal}
                      version={baseVer}
                      comparableVersions={compVers}
                      baseLog={baseLog ?? undefined}
                      baseLogIndex={baseRowIndex + 1}
                      comparisonLogs={comparisonLogs}
                      comparisonLogsIndex={comparisonRowIndices.map((x) => x + 1)}
                      diffMode={diffMode}
                      splitView={splitView}
                      displayMode={displayMode}
                      onHideColumn={onHideParam}
                      tableItem={tableItem}
                      updateItem={updateItem}
                      editMode={editMode}
                      onAccordionValueChange={(vals) => {
                        if (!editMode) {
                          setOpenParamItems(vals);
                        }
                      }}
                    />
                  );

                  if (!selEntry) {
                    // If the SelectionEntry returned null => skip
                    return null;
                  }

                  return (
                    <SortableAccordionItem
                      key={`param-${col}`}
                      id={col}
                      editMode={editMode}
                    >
                      {selEntry}
                    </SortableAccordionItem>
                  );
                })}
            </Accordion>
          </SortableContext>
        </DndContext>
      </div>
    );
  }, [
    baseLog,
    paramOrder,
    openParamItems,
    editMode,
    handleParamDragEnd,
    paramKeys,
    paramsFilter,
    sensors,
    comparisonLogs,
    diffMode,
    splitView,
    displayMode,
    onHideParam,
    tableItem,
    updateItem,
    baseRowIndex,
    comparisonRowIndices,
  ]);

  /*****************************************************************************
   * Build entries section
   *****************************************************************************/
  const entriesSection = useMemo(() => {
    if (!baseLog) return null;

    const areAllOpenEntries = entryOrder.length > 0 &&
      entryOrder.every((e) => openItems.includes(e)) &&
      openItems.length === entryOrder.length;

    if (entryOrder.length === 0) {
      return null;
    }

    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between sticky top-0 z-10 bg-background py-2 border-b border-muted">
          <p className="font-bold text-lg">Entries</p>
          <ActionButton
            variant="ghost"
            size="icon"
            tooltip={areAllOpenEntries ? "Collapse All" : "Expand All"}
            onClick={() => {
              if (areAllOpenEntries) {
                setOpenItems([]);
              } else {
                setOpenItems(entryOrder);
              }
            }}
            icon={areAllOpenEntries ? <FoldVertical /> : <UnfoldVertical />}
          />
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleEntryDragEnd}>
          <SortableContext items={entryOrder} strategy={verticalListSortingStrategy}>
            <Accordion
              type="multiple"
              value={editMode ? [] : openItems}
              onValueChange={(vals) => {
                if (!editMode) {
                  setOpenItems(vals);
                }
              }}
            >
              {entryOrder
                .filter((col) => entriesFilter[col] !== false)
                .map((col) => {
                  const baseVal = baseLog.entries?.[col];
                  const compVals = comparisonLogs.map((cl) => cl.entries?.[col]);
                  if (isAllEmpty(baseVal, compVals)) {
                    return null; // skip entirely
                  }

                  const selEntry = (
                    <SelectionEntry
                      key={`entry-${col}`}
                      source="entries"
                      property={col}
                      value={baseVal}
                      baseLog={baseLog ?? undefined}
                      baseLogIndex={baseRowIndex + 1}
                      comparisonLogs={comparisonLogs}
                      comparisonLogsIndex={comparisonRowIndices.map((x) => x + 1)}
                      diffMode={diffMode}
                      splitView={splitView}
                      displayMode={displayMode}
                      onHideColumn={onHideEntry}
                      tableItem={tableItem}
                      updateItem={updateItem}
                      editMode={editMode}
                      onAccordionValueChange={(vals) => {
                        if (!editMode) {
                          setOpenItems(vals);
                        }
                      }}
                    />
                  );

                  if (!selEntry) {
                    return null;
                  }

                  return (
                    <SortableAccordionItem
                      key={`entry-${col}`}
                      id={col}
                      editMode={editMode}
                    >
                      {selEntry}
                    </SortableAccordionItem>
                  );
                })}
            </Accordion>
          </SortableContext>
        </DndContext>
      </div>
    );
  }, [
    baseLog,
    entryOrder,
    openItems,
    editMode,
    handleEntryDragEnd,
    entryKeys,
    entriesFilter,
    sensors,
    comparisonLogs,
    diffMode,
    splitView,
    displayMode,
    onHideEntry,
    tableItem,
    updateItem,
    baseRowIndex,
    comparisonRowIndices,
  ]);

  // Renders both sections
  const content = (
    <div className="flex flex-col gap-6">
      {paramSection}
      {entriesSection}
    </div>
  );

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
                selectedRowIndices[baseRowIndex] !== undefined
                  ? rowLabel(selectedRowIndices[baseRowIndex])
                  : ""
              }
              onValueChange={(newLabel) => {
                const found = selectedRowIndices.findIndex((r) => rowLabel(r) === newLabel);
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
                setModeIndex((prev) => {
                  const nextIndex = (prev + 1) % allModes.length;
                  return nextIndex;
                });
              }}
              variant="ghost"
              size="icon"
            />
            <ActionButton
              tooltip={splitView ? "Switch to Inline View" : "Switch to Split View"}
              icon={splitView ? <Columns className="h-4 w-4" /> : <AlignJustify className="h-4 w-4" />}
              onClick={() => {
                setSplitView((prev) => !prev);
              }}
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
 * (F) "SortableAccordionItem"
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
      <div className={editMode ? "flex-1 ml-0" : "flex-1 ml-2"}>{children}</div>
    </div>
  );
}