"use client";

import React, { useMemo, useState } from "react";
import { LogProps } from "@/types/evals/logs";
import SelectionHints from "./Hints";
import SelectionEntry from "./SelectionEntry";
import { useQueryState } from "nuqs";
import { parseAsArrayOf, parseAsString } from "nuqs";
import { Accordion } from "@/components/UI/accordion";
import ActionButton from "@/components/Common/Buttons/Action";
import { FoldVertical, UnfoldVertical, EyeOff, FileText, CaseLower, Pilcrow, Columns, AlignJustify } from "lucide-react";
import { Combobox } from "@/components/UI/Combobox";
import { sanitizeId } from "@/utils/evals/columnOperations";

/**
 * Helper to parse tokens like "116812_call_transcripts" => logId="116812", columnName="call_transcripts"
 * Then build a map rowIndex -> Set<string> of selected columns.
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

/**
 * Build row indices in the order cells were selected (no duplicates).
 */
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

/** A small helper for row label => "Row 5". */
function rowLabel(rowIndex: number) {
  return `Row ${rowIndex + 1}`;
}

// Basic type checks for top-level
function isList(val: any) {
  return Array.isArray(val);
}
function isDict(val: any) {
  return val && typeof val === "object" && !Array.isArray(val);
}
function isMatrix(val: any) {
  if (!isList(val)) return false;
  return val.length > 0 && Array.isArray(val[0]);
}
function isImage(val: any) {
  return typeof val === "string" && val.startsWith("data:image/");
}
function isTrace(val: any) {
  return false;
}
function getValueType(value: any) {
  if (isTrace(value))   return "trace";
  if (isDict(value))    return "dict";
  if (isList(value)) {
    if (isMatrix(value)) return "matrix";
    return "list";
  }
  if (isImage(value))   return "image";
  return "string";
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

export default function Selection({
  params,
  logs,
}: {
  params: Record<string, unknown>;
  logs: LogProps[];
}) {
  // 1) Query state for columns
  const [columnOrderStr] = useQueryState("column_order");
  const [hiddenColumnsStr] = useQueryState("hidden_columns");
  const columnOrdering = columnOrderStr ? columnOrderStr.split(",") : [];
  const hiddenColumns = hiddenColumnsStr ? hiddenColumnsStr.split(",") : [];

  // Possibly reorder logs or just keep them
  const sortedLogs = useMemo(() => [...logs], [logs]);

  // 2) Query state for selected cells
  const [selectedCells] = useQueryState(
    "selected",
    parseAsArrayOf(parseAsString).withDefault([])
  );
  // Build rowIndex -> set of selected columns
  const indexToColumns = useMemo(
    () => buildIndexToColumnsMapFromId(selectedCells, sortedLogs),
    [selectedCells, sortedLogs]
  );
  // Get row indices in selection order
  const selectedRowIndices = useMemo(
    () => buildRowIndicesInSelectionOrder(selectedCells, sortedLogs),
    [selectedCells, sortedLogs]
  );

  // 3) Base row picking
  const [baseIndexParamStr, setBaseIndexParamStr] = useQueryState(
    "base_idx",
    parseAsString
  );
  let baseIndexParam = baseIndexParamStr ? parseInt(baseIndexParamStr, 10) : 0;
  if (
    isNaN(baseIndexParam) ||
    baseIndexParam < 0 ||
    baseIndexParam >= selectedRowIndices.length
  ) {
    baseIndexParam = 0;
  }
  const baseRowIndex = selectedRowIndices[baseIndexParam] ?? -1;
  const comparisonRowIndices = selectedRowIndices.filter(
    (_, i) => i !== baseIndexParam
  );

  // 4) Build logs with chosen columns
  function buildLogWithChosenColumns(
    originalLog: LogProps,
    rowIndex: number,
    globalParams: Record<string, unknown>
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

      // If the storedVal is a string that might index into “params[c]” in globalParams
      if (typeof storedVal === "string" && globalParams.hasOwnProperty(c)) {
        const possibleObj = globalParams[c];
        if (possibleObj && typeof possibleObj === "object") {
          const castObj = possibleObj as Record<string, unknown>;
          const mappedVal = castObj[storedVal];
          if (mappedVal !== undefined) {
            newParams[c] = {
              "paramValue": mappedVal,
              "paramVersion" : unwrapSingleKeyObject(storedVal)
            }
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

  // Build the base log
  const baseLog = useMemo(() => {
    if (baseRowIndex < 0 || baseRowIndex >= sortedLogs.length) {
      return undefined;
    }
    return buildLogWithChosenColumns(sortedLogs[baseRowIndex], baseRowIndex, params);
  }, [
    baseRowIndex,
    sortedLogs,
    indexToColumns,
    columnOrdering,
    hiddenColumns,
    params,
  ]);

  // Build the comparison logs
  const comparisonLogs = useMemo(() => {
    return comparisonRowIndices
      .map((ri) =>
        ri < 0 || ri >= sortedLogs.length
          ? null
          : buildLogWithChosenColumns(sortedLogs[ri], ri, params)
      )
      .filter((x): x is LogProps => x !== null);
  }, [
    comparisonRowIndices,
    sortedLogs,
    indexToColumns,
    columnOrdering,
    hiddenColumns,
    params,
  ]);

  // 5) Decide default expansions
  const [openItems, setOpenItems] = useState<string[]>([]);
  const [openParamItems, setOpenParamItems] = useState<string[]>([]);

  const entryKeys = baseLog ? Object.keys(baseLog.entries) : [];
  const paramKeys = baseLog ? Object.keys(baseLog.params) : [];

  function defaultOpenFor(keys: string[], obj: Record<string, unknown>) {
    return keys.filter((k) => {
      const val = obj[k];
      const t = getValueType(val);
      return ["string", "matrix", "image"].includes(t);
    });
  }

  const defaultOpenEntries = useMemo(() => {
    if (!baseLog) return [];
    return defaultOpenFor(entryKeys, baseLog.entries);
  }, [baseLog, entryKeys]);

  const defaultOpenParams = useMemo(() => {
    if (!baseLog) return [];
    return defaultOpenFor(paramKeys, baseLog.params);
  }, [baseLog, paramKeys]);

  const [didInit, setDidInit] = useState(false);
  React.useEffect(() => {
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

  // 6) Possibly pick a base row with the combobox
  const comboItems = useMemo(() => {
    return selectedRowIndices.map((rowIndex, i) => {
      return {
        value: rowLabel(rowIndex),
        label: rowLabel(rowIndex),
        dataIndex: i,
      };
    });
  }, [selectedRowIndices]);

  const currentBaseLabel = comboItems[baseIndexParam]?.value || "";
  function handleBaseChange(newLabel: string) {
    const found = comboItems.find((x) => x.value === newLabel);
    setBaseIndexParamStr(found ? String(found.dataIndex) : "0");
  }

  // 7) Diff toggles
  type DiffMode = "none" | "lines" | "words" | "characters";
  const allModes: DiffMode[] = ["none", "lines", "words", "characters"];
  const modeIcons = [
    <EyeOff key="none" />,
    <FileText key="lines" />,
    <CaseLower key="words" />,
    <Pilcrow key="characters" />
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

  // 8) Now content depending on whether baseLog is present
  let content: JSX.Element;
  if (!baseLog) {
    content = (
      <div className="flex items-center justify-center h-full w-full">
        <SelectionHints />
      </div>
    );
  } else {
    // Build sections in a fixed order: (1) Params, then (2) Entries
    // if each section is present.
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
              />
            ))}
          </Accordion>
        </div>
      );
    }

    // Always render params first if present, then entries
    const sections: JSX.Element[] = [];
    if (paramsSection) sections.push(paramsSection);
    if (entriesSection) sections.push(entriesSection);

    content = <div className="flex flex-col gap-6">{sections}</div>;
  }

  // 9) Return with pinned heading if multiple rows are selected
  return (
    <div className="bg-background rounded-md w-full h-full flex flex-col">
      {selectedRowIndices.length > 1 && (
        <div className="sticky top-0 z-10 bg-background px-5 py-2 border-b border-muted flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Base:</span>
            <Combobox
              items={comboItems}
              value={currentBaseLabel}
              onValueChange={handleBaseChange}
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
              tooltip={
                splitView
                  ? "Switch to Inline View"
                  : "Switch to Split View"
              }
              icon={
                splitView ? <Columns className="h-4 w-4" /> : <AlignJustify className="h-4 w-4" />
              }
              onClick={handleToggleSplit}
              variant="ghost"
              size="icon"
            />
          </div>
        </div>
      )}

      {/* The scrollable area */}
      <div className="overflow-y-auto px-5 flex-1">
        {content}
      </div>
    </div>
  );
}