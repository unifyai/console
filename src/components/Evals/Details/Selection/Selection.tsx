"use client";

import React, { useMemo, useState, useEffect } from "react";
import { LogProps } from "@/types/evals/logs";
import { useQueryState } from "nuqs";
import { parseAsArrayOf, parseAsString } from "nuqs";
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
  FileText,
  CaseLower,
  Pilcrow,
  Columns,
  AlignJustify,
  SquareSplitHorizontal,
  Code
} from "lucide-react";

/*******************************************************************************
 * (A) Basic type checks & helpers that were in the original Selection code
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
  return false; // Your original check said "return false;"
}
function isNumber(val: any) {
  return typeof val === "number";
}

/** Called in certain expansions to decide default open. */
function getValueType(value: any) {
  if (isTrace(value)) return "trace";
  if (isDict(value)) return "dict";
  if (isList(value)) {
    if (isMatrix(value)) return "matrix";
    return "list";
  }
  if (isImage(value)) return "image";
  if (isNumber(value)) return "number";
  return "string";
}


function defaultOpenFor(keys: string[], obj: Record<string, unknown>) {
  return keys.filter((k) => {
    const val = obj[k];
    const t = getValueType(val);
    return ["string", "number", "matrix", "image"].includes(t);
  });
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

/** For labeling row pickers, e.g. "Row 5". */
function rowLabel(rowIndex: number) {
  return `Row ${rowIndex + 1}`;
}

/*******************************************************************************
 * (B) The parent's buildIndexToColumnsMapFromId + buildRowIndicesInSelectionOrder
 *     from original code
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
 * (C) The parent's buildLogWithChosenColumns from the original code
 *     This is crucial for param version logic.
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

  // “entries”
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
    }
  }

  // “params”
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

    // If the storedVal is a string that might index into globalParams[c]
    // This is where paramVersion logic is created
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
    // otherwise keep as-is
    newParams[c] = unwrapSingleKeyObject(storedVal);
  }

  return {
    ...originalLog,
    entries: newEntries,
    params: newParams,
  };
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
}: {
  params: Record<string, unknown>;
  logs: LogProps[];
}) {
  // 1) Possibly reorder logs or just keep them
  const sortedLogs = useMemo(() => [...logs], [logs]);

  // 2) Which cells are selected
  const [selectedCells] = useQueryState(
    "selected",
    parseAsArrayOf(parseAsString).withDefault([])
  );

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

  // 5) Possibly read column order, hidden columns
  const [columnOrderStr] = useQueryState("column_order");
  const [hiddenColumnsStr] = useQueryState("hidden_columns");
  const columnOrdering = columnOrderStr ? columnOrderStr.split(",") : [];
  const hiddenColumns = hiddenColumnsStr ? hiddenColumnsStr.split(",") : [];

  // 6) Let user cycle # of side-by-side panels. Each has independent state
  const [panelCount, setPanelCount] = useState(1);
  function handleCyclePanelCount() {
    setPanelCount((prev) => (prev === 3 ? 1 : prev + 1));
  }

  // (NEW) Raw Mode
  const [rawMode, setRawMode] = useState(false);
  function toggleRawMode() {
    setRawMode((prev) => !prev);
  }

  // If user hasn't selected anything, just show hints
  if (!selectedRowIndices.length) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background rounded-md">
        <SelectionHints />
      </div>
    );
  }

  // Return multiple panels side-by-side
  return (
    <div className="flex flex-col w-full h-full overflow-hidden bg-background rounded-md">
      {/* A top bar */}
      <div className="p-2 border-b border-muted flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Selected {selectedRowIndices.length} row(s)
        </p>
        <div className="flex items-center gap-2">
          <ActionButton
            tooltip={rawMode ? "Viewing as raw text" : "Viewing with specialized components"}
            icon={<Code className={`h-4 w-4 ${rawMode ? "bg-primary" : ""}`} />}
            onClick={toggleRawMode}
            variant={rawMode ? "primary" : "ghost"}
            size="icon"
          />
          <ActionButton
            tooltip={`Cycle panel count (currently: ${panelCount})`}
            icon={<SquareSplitHorizontal className="h-4 w-4" />}
            onClick={handleCyclePanelCount}
            variant="ghost"
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
            // pass rawMode here
            rawMode={rawMode}
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
}: {
  panelId: number;
  params: Record<string, unknown>;
  logs: LogProps[];
  indexToColumns: Record<number, Set<string>>;
  selectedRowIndices: number[];
  hiddenColumns: string[];
  columnOrdering: string[];
  rawMode: boolean;
}) {
  // 1) local state: pick a base row among the selected rowIndices
  const [baseIndexParam, setBaseIndexParam] = useState(0);
  if (
    baseIndexParam < 0 ||
    baseIndexParam >= selectedRowIndices.length
  ) {
    setBaseIndexParam(0);
  }
  const baseRowIndex = selectedRowIndices[baseIndexParam] ?? -1;
  const comparisonRowIndices = selectedRowIndices.filter(
    (_, i) => i !== baseIndexParam
  );

  // 2) local expansions: openItems, openParamItems
  const [openItems, setOpenItems] = useState<string[]>([]);
  const [openParamItems, setOpenParamItems] = useState<string[]>([]);
  const [didInit, setDidInit] = useState(false);

  // 3) diff mode & split
  type DiffMode = "none" | "lines" | "words" | "characters";
  const allModes: DiffMode[] = ["none", "lines", "words", "characters"];
  const modeIcons = [
    <EyeOff key="none" />,
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

  // 4) build baseLog & comparison logs
  const baseLog = useMemo<LogProps | undefined>(() => {
    if (baseRowIndex < 0 || baseRowIndex >= logs.length) return undefined;
    return buildLogWithChosenColumns(
      logs[baseRowIndex],
      baseRowIndex,
      params,
      indexToColumns,
      columnOrdering,
      hiddenColumns
    );
  }, [
    baseRowIndex,
    logs,
    params,
    indexToColumns,
    columnOrdering,
    hiddenColumns,
  ]);

  const comparisonLogs = useMemo(() => {
    return comparisonRowIndices
      .map((ri) =>
        ri < 0 || ri >= logs.length
          ? null
          : buildLogWithChosenColumns(
              logs[ri],
              ri,
              params,
              indexToColumns,
              columnOrdering,
              hiddenColumns
            )
      )
      .filter((x): x is LogProps => x !== null);
  }, [
    comparisonRowIndices,
    logs,
    params,
    indexToColumns,
    columnOrdering,
    hiddenColumns,
  ]);

  // 5) gather keys => default expansions
  // Changed: Use the union of base and comparison keys (for entries and params)
  const baseEntryKeys = baseLog ? Object.keys(baseLog.entries) : [];
  const compEntryKeys = comparisonLogs.reduce((acc: string[], log) => {
    if (log && log.entries) {
      return acc.concat(Object.keys(log.entries));
    }
    return acc;
  }, [] as string[]);
  const entryKeys = Array.from(new Set([...baseEntryKeys, ...compEntryKeys]));

  const baseParamKeys = baseLog ? Object.keys(baseLog.params) : [];
  const compParamKeys = comparisonLogs.reduce((acc: string[], log) => {
    if (log && log.params) {
      return acc.concat(Object.keys(log.params));
    }
    return acc;
  }, [] as string[]);
  const paramKeys = Array.from(new Set([...baseParamKeys, ...compParamKeys]));

  const defaultOpenEntries = useMemo(() => {
    if (!baseLog) return [];
    return defaultOpenFor(entryKeys, baseLog.entries);
  }, [baseLog, entryKeys]);

  const defaultOpenParams = useMemo(() => {
    if (!baseLog) return [];
    return defaultOpenFor(paramKeys, baseLog.params);
  }, [baseLog, paramKeys]);

  // When baseLog first becomes available, set expansions
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

  // 6) if no base log => show hints
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
              icon={
                everythingOpen
                  ? <FoldVertical className="h-4 w-4" />
                  : <UnfoldVertical className="h-4 w-4" />
              }
            />
          </div>
          <Accordion
            type="multiple"
            value={openItems}
            onValueChange={setOpenItems}
          >
            {entryKeys.map((col) => (
              <SelectionEntry
                key={col}
                source="entries"
                property={col}
                value={baseLog.entries[col]}
                baseLog={baseLog}
                baseLogIndex={baseRowIndex + 1}
                comparisonLogs={comparisonLogs}
                comparisonLogsIndex={comparisonRowIndices.map(x => x + 1)}
                diffMode={diffMode}
                splitView={splitView}
                // pass rawMode
                rawMode={rawMode}
              />
            ))}
          </Accordion>
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
              icon={
                everythingOpenParams
                  ? <FoldVertical className="h-4 w-4" />
                  : <UnfoldVertical className="h-4 w-4" />
              }
            />
          </div>
          <Accordion
            type="multiple"
            value={openParamItems}
            onValueChange={setOpenParamItems}
          >
            {paramKeys.map((col) => (
              <SelectionEntry
                key={col}
                source="params"
                property={col}
                value={baseLog.params[col]}
                baseLog={baseLog}
                baseLogIndex={baseRowIndex + 1}
                comparisonLogs={comparisonLogs}
                comparisonLogsIndex={comparisonRowIndices.map(x => x + 1)}
                diffMode={diffMode}
                splitView={splitView}
                rawMode={rawMode}
              />
            ))}
          </Accordion>
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
                if (found >= 0) {
                  setBaseIndexParam(found);
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

      {/* The scrollable panel content */}
      <div className="flex-1 overflow-y-auto px-5 min-h-0">
        {content}
      </div>
    </div>
  );
}