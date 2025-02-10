"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
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
  EyeOff,
  Eye,
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
} from "lucide-react";

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
import { LogFieldsResponseProps } from "@/types/evals/logs";
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
  return typeof val === "number";
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

  // 2) Which cells are selected
  const selectedCells = selection_ ? selection_.split(",") : [];

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

  // 5) Possibly read column order
  const columnOrdering = columnOrdering_?.split(",") || [];

  // 6) Possibly read hidden columns. -------------------------------------------
  // ADD: local "showHidden" toggle so user can override hidden columns in the selection
  const [showHidden, setShowHidden] = useState(false);
  const hiddenColumns = showHidden
    ? []
    : hiddenColumns_?.split(",") || [];

  // 7) Let user cycle # of side-by-side panels. Each has independent state
  const [panelCount, setPanelCount] = useState(1);
  const [rawMode, setRawMode] = useState(false);

  // If user hasn't selected anything, just show hints
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
        <div className="flex items-center gap-2">
          <ActionButton
            tooltip={rawMode ? "Viewing as raw text" : "Viewing with specialized components"}
            icon={rawMode ? <RemoveFormatting className="h-4 w-4" /> : <Type className="h-4 w-4" />}
            onClick={() => setRawMode((prev) => !prev)}
            variant={rawMode ? "primary" : "ghost"}
            size="icon"
          />
          <ActionButton
            tooltip={`Cycle panel count (currently: ${panelCount})`}
            icon={<SquareSplitHorizontal className="h-4 w-4" />}
            onClick={() => setPanelCount((prev) => (prev === 3 ? 1 : prev + 1))}
            variant="ghost"
            size="icon"
          />

          {/* NEW: Toggle button for showing/hiding hidden columns */}
          <ActionButton
            tooltip={
              showHidden
                ? "Currently showing hidden columns (click to revert)"
                : "Currently respecting hidden columns (click to show all)"
            }
            icon={showHidden ? <Eye /> : <EyeOff />}
            variant="ghost"
            onClick={() => setShowHidden((prev) => !prev)}
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
            rawMode={rawMode}
            tableItem={tableItem}
            item={item}
            updateItem={updateItem}
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
  rawMode,
  tableItem,
  item,
  updateItem,
}: {
  panelId: number;
  params: Record<string, unknown>;
  logs: LogProps[];
  indexToColumns: Record<number, Set<string>>;
  selectedRowIndices: number[];
  hiddenColumns: string[];
  columnOrdering: string[];
  rawMode: boolean;
  tableItem: TileProps | undefined;
  item: TileProps;
  updateItem: (item: TileProps, attrName: ItemType) => (newValue: string | undefined) => void;
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
  const [didInit, setDidInit] = useState(false);

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

  function buildLogIfValid(ri: number) {
    if (ri < 0 || ri >= logs.length) return null;
    return buildLogWithChosenColumns(
      logs[ri],
      ri,
      params,
      indexToColumns,
      columnOrdering,
      hiddenColumns
    );
  }

  const baseLog = useMemo(() => buildLogIfValid(baseRowIndex), [
    baseRowIndex,
    logs,
    params,
    indexToColumns,
    columnOrdering,
    hiddenColumns,
  ]);

  const comparisonLogs = useMemo(
    () => comparisonRowIndices.map((ri) => buildLogIfValid(ri)).filter((x) => x),
    [comparisonRowIndices, logs, params, indexToColumns, columnOrdering, hiddenColumns]
  ) as LogProps[];

  // gather keys => default expansions
  const entryKeys = baseLog ? Object.keys(baseLog.entries) : [];
  const paramKeys = baseLog ? Object.keys(baseLog.params) : [];

  const defaultOpenEntries = useMemo(() => {
    if (!baseLog) return [];
    return defaultOpenFor(entryKeys, baseLog.entries);
  }, [baseLog, entryKeys]);

  const defaultOpenParams = useMemo(() => {
    if (!baseLog) return [];
    return defaultOpenFor(paramKeys, baseLog.params);
  }, [baseLog, paramKeys]);

  // dragging code
  const [entryOrder, setEntryOrder] = useState<string[]>(entryKeys);
  const [paramOrder, setParamOrder] = useState<string[]>(paramKeys);

  // Use refs to store the previous base log id and key signatures.
  const prevBaseLogId = useRef<string | null>(null);
  const prevEntryKeySignature = useRef<string>("");
  const prevParamKeySignature = useRef<string>("");
  
  useEffect(() => {
    if (baseLog) {
      // Compute the new available keys.
      const newEntryKeys = Object.keys(baseLog.entries);
      const newParamKeys = Object.keys(baseLog.params);

      // Merge the new keys with the current ordering state:
      // • Keep keys already in order that still exist in the new log.
      // • Append any new keys (or drop ones that are no longer available).
      setEntryOrder((prevOrder) => {
        const common = prevOrder.filter((k) => newEntryKeys.includes(k));
        const appended = newEntryKeys.filter((k) => !common.includes(k));
        return [...common, ...appended];
      });

      setParamOrder((prevOrder) => {
        const common = prevOrder.filter((k) => newParamKeys.includes(k));
        const appended = newParamKeys.filter((k) => !common.includes(k));
        return [...common, ...appended];
      });

      // Update refs for comparison next time.
      prevBaseLogId.current = baseLog.id;
      prevEntryKeySignature.current = [...newEntryKeys].sort().join(",");
      prevParamKeySignature.current = [...newParamKeys].sort().join(",");
    }
  }, [baseLog]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleEntryDragEnd(event: any) {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setEntryOrder((items) =>
        arrayMove(items, items.indexOf(active.id), items.indexOf(over.id))
      );
    }
  }
  
  function handleParamDragEnd(event: any) {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setParamOrder((items) =>
        arrayMove(items, items.indexOf(active.id), items.indexOf(over.id))
      );
    }
  }

  useEffect(() => {
    if (baseLog && !didInit) {
      if (defaultOpenEntries.length > 0) {
        setOpenItems(defaultOpenEntries);
      }
      if (defaultOpenParams.length > 0) {
        setOpenParamItems(defaultOpenParams);
      }
      setDidInit(true);
    }
  }, [baseLog, didInit, defaultOpenEntries, defaultOpenParams]);

  const everythingOpen = entryKeys.length > 0 && openItems.length === entryKeys.length;
  const everythingOpenParams = paramKeys.length > 0 && openParamItems.length === paramKeys.length;

  function handleToggleAll() {
    setOpenItems(everythingOpen ? [] : entryKeys);
  }
  function handleToggleAllParams() {
    setOpenParamItems(everythingOpenParams ? [] : paramKeys);
  }

  // if no base => show hints
  let content: JSX.Element;
  if (!baseLog) {
    content = (
      <div className="flex items-center justify-center h-full w-full">
        <SelectionHints />
      </div>
    );
  } else {
    let entriesSection: JSX.Element | null = null;
    if (entryKeys.length > 0) {
      entriesSection = (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between sticky top-0 z-10 bg-background py-2 border-b border-muted">
            <p className="font-bold text-lg">Entries</p>
            <ActionButton
              variant="ghost"
              size="icon"
              tooltip={everythingOpen ? "Collapse All" : "Expand All"}
              onClick={handleToggleAll}
              icon={everythingOpen ? <FoldVertical /> : <UnfoldVertical />}
            />
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleEntryDragEnd}
          >
            <SortableContext items={entryOrder} strategy={verticalListSortingStrategy}>
              <Accordion type="multiple" value={openItems} onValueChange={setOpenItems}>
                {entryOrder.map((col) => (
                  <SortableAccordionItem key={col} id={col}>
                    <SelectionEntry
                      source="entries"
                      property={col}
                      value={baseLog.entries[col]}
                      baseLog={baseLog}
                      baseLogIndex={baseRowIndex + 1}
                      comparisonLogs={comparisonLogs}
                      comparisonLogsIndex={comparisonRowIndices.map((x) => x + 1)}
                      diffMode={diffMode}
                      splitView={splitView}
                      rawMode={rawMode}
                      tableItem={tableItem}
                      updateItem={updateItem}
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
    if (paramKeys.length > 0) {
      paramsSection = (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between sticky top-0 z-10 bg-background py-2 border-b border-muted">
            <p className="font-bold text-lg">Params</p>
            <ActionButton
              variant="ghost"
              size="icon"
              tooltip={everythingOpenParams ? "Collapse All" : "Expand All"}
              onClick={handleToggleAllParams}
              icon={everythingOpenParams ? <FoldVertical /> : <UnfoldVertical />}
            />
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleParamDragEnd}
          >
            <SortableContext items={paramOrder} strategy={verticalListSortingStrategy}>
              <Accordion type="multiple" value={openParamItems} onValueChange={setOpenParamItems}>
                {paramOrder.map((col) => {
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
                    <SortableAccordionItem key={col} id={col}>
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
                        rawMode={rawMode}
                        tableItem={tableItem}
                        updateItem={updateItem}
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

    content = (
      <div className="flex flex-col gap-6">
        {paramsSection}
        {entriesSection}
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
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}