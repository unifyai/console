"use client";

import React, { useMemo, useState } from "react";
import { LogProps } from "@/types/evals/logs";
import SelectionHints from "./Hints";
import SelectionEntry from "./SelectionEntry";
import { useQueryState } from "nuqs";
import { parseAsArrayOf, parseAsString } from "nuqs";
import { Accordion } from "@/components/UI/accordion";
import ActionButton from "@/components/Common/Buttons/Action";
import { FoldVertical, UnfoldVertical } from "lucide-react";
import { Combobox } from "@/components/UI/Combobox";
import { sanitizeId } from "@/utils/evals/columnOperations";

/**
 * Helper to parse tokens like "116812_call_transcripts" => logId="116812", columnName="call_transcripts"
 * Then build a map rowIndex -> Set of columns for each selected cell.
 */
function buildIndexToColumnsMapFromId(
  selectedCells: string[],
  sortedLogs: LogProps[]
): Record<number, Set<string>> {
  const map: Record<number, Set<string>> = {};
  for (const token of selectedCells) {
    const underscorePos = token.indexOf("_");
    if (underscorePos < 1) continue; // skip invalid tokens
    const logIdStr = token.slice(0, underscorePos);
    const columnName = token.slice(underscorePos + 1);

    // Find rowIndex for log.id == logIdStr:
    const rowIndex = sortedLogs.findIndex((log) => String(log.id) === logIdStr);
    if (rowIndex < 0) continue; // not found => skip

    if (!map[rowIndex]) {
      map[rowIndex] = new Set<string>();
    }
    map[rowIndex].add(columnName);
  }
  return map;
}

/** 
 * Build row indices in the order cells were selected, ignoring duplicates.
 * Ensures that the first cell clicked becomes the base row, etc.
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
    const rowIndex = sortedLogs.findIndex(log => String(log.id) === logIdStr);
    if (rowIndex < 0) continue;
    if (!seen.has(rowIndex)) {
      seen.add(rowIndex);
      rowIndices.push(rowIndex);
    }
  }

  return rowIndices;
}

/** A small helper to return a user-friendly label like "Row 5" for rowIndex=4 */
function rowLabel(rowIndex: number) {
  return `Row ${rowIndex + 1}`;
}

/** Minimal type check for top-level values: string, matrix, image, etc. */
function isList(val: any) {
  return Array.isArray(val);
}
function isDict(val: any) {
  return val && typeof val === "object" && !Array.isArray(val);
}
function isMatrix(val: any) {
  if (!isList(val)) return false;
  // For a matrix, each item is also an array => minimal check
  return val.length > 0 && Array.isArray(val[0]);
}
function isImage(val: any) {
  // If your images are strings like "data:image/..." or some path
  // Here is a minimal placeholder
  return typeof val === "string" && val.startsWith("data:image/");
}
function isTrace(val: any) {
  // your logic for span or array of spans
  // or skip if not needed at top-level
  return false;
}

function getValueType(value: any): "trace" | "dict" | "list" | "image" | "matrix" | "string" {
  if (isTrace(value))   return "trace";
  if (isDict(value))    return "dict";
  if (isList(value)) {
    // further check matrix
    if (isMatrix(value)) return "matrix";
    return "list";
  }
  if (isImage(value))   return "image";
  return "string"; // fallback
}

export default function Selection({
  params,
  logs,
}: {
  params: Record<string, unknown>;
  logs: LogProps[];
}) {
  const [columnOrderStr] = useQueryState("column_order");
  const [hiddenColumnsStr] = useQueryState("hidden_columns");
  const columnOrdering = columnOrderStr ? columnOrderStr.split(",") : [];
  const hiddenColumns = hiddenColumnsStr ? hiddenColumnsStr.split(",") : [];

  // You can optionally reorder logs or keep them as is
  const sortedLogs = useMemo(() => {
    return [...logs];
  }, [logs]);

  // The “selected” query param => array of e.g. "123_columnName"
  const [selectedCells] = useQueryState(
    "selected",
    parseAsArrayOf(parseAsString).withDefault([])
  );
  // Map rowIndex -> set of selected columns for that row
  const indexToColumns = useMemo(() => {
    return buildIndexToColumnsMapFromId(selectedCells, sortedLogs);
  }, [selectedCells, sortedLogs]);

  // Distinct rowIndices in selection order
  const selectedRowIndices = useMemo(() => {
    return buildRowIndicesInSelectionOrder(selectedCells, sortedLogs);
  }, [selectedCells, sortedLogs]);

  // baseIndexParam => the user can pick which row is base, default to first
  const [baseIndexParamStr, setBaseIndexParamStr] = useQueryState("base_idx", parseAsString);
  let baseIndexParam = baseIndexParamStr ? parseInt(baseIndexParamStr, 10) : 0;
  if (
    isNaN(baseIndexParam) ||
    baseIndexParam < 0 ||
    baseIndexParam >= selectedRowIndices.length
  ) {
    baseIndexParam = 0;
  }

  const baseRowIndex = selectedRowIndices[baseIndexParam] ?? -1;
  const comparisonRowIndices = selectedRowIndices.filter((_, i) => i !== baseIndexParam);

  /**
   * Build a LogProps with only the user-chosen columns from indexToColumns,
   * also skipping hidden columns, and respecting column ordering.
   * We do this for both .entries and .params.
   */
  function buildLogWithChosenColumns(originalLog: LogProps, rowIndex: number): LogProps {
    const chosenCols = indexToColumns[rowIndex] ?? new Set<string>();

    // .entries
    const safeEntries = originalLog.entries ?? {};
    const afterHiddenEntries = Array.from(chosenCols).filter((c) => !hiddenColumns.includes(c));
    let finalColsEntries: string[];
    if (columnOrdering.length > 0) {
      finalColsEntries = columnOrdering
        .filter((c) => afterHiddenEntries.includes(c))
        .map(sanitizeId);
    } else {
      finalColsEntries = afterHiddenEntries.map(sanitizeId);
    }
    const newEntries: Record<string, unknown> = {};
    for (const c of finalColsEntries) {
      if (safeEntries.hasOwnProperty(c)) {
        newEntries[c] = safeEntries[c];
      }
    }

    // .params
    const safeParams = originalLog.params ?? {};
    const afterHiddenParams = Array.from(chosenCols).filter((c) => !hiddenColumns.includes(c));
    let finalColsParams: string[];
    if (columnOrdering.length > 0) {
      finalColsParams = columnOrdering
        .filter((c) => afterHiddenParams.includes(c))
        .map(sanitizeId);
    } else {
      finalColsParams = afterHiddenParams.map(sanitizeId);
    }
    const newParams: Record<string, unknown> = {};
    for (const c of finalColsParams) {
      if (safeParams.hasOwnProperty(c)) {
        newParams[c] = safeParams[c];
      }
    }

    return {
      ...originalLog,
      entries: newEntries,
      params: newParams,
    };
  }

  // The base log
  const baseLog = useMemo(() => {
    if (baseRowIndex < 0 || baseRowIndex >= sortedLogs.length) {
      return undefined;
    }
    return buildLogWithChosenColumns(sortedLogs[baseRowIndex], baseRowIndex);
  }, [
    baseRowIndex,
    sortedLogs,
    indexToColumns,
    columnOrdering,
    hiddenColumns,
  ]);

  // The comparison logs
  const comparisonLogs = useMemo(() => {
    return comparisonRowIndices
      .map((ri) => {
        if (ri < 0 || ri >= sortedLogs.length) {
          return null;
        }
        return buildLogWithChosenColumns(sortedLogs[ri], ri);
      })
      .filter((x): x is LogProps => x !== null);
  }, [
    comparisonRowIndices,
    sortedLogs,
    indexToColumns,
    columnOrdering,
    hiddenColumns,
  ]);

  // Build combobox items => e.g. "Row 5"
  const comboItems = useMemo(() => {
    return selectedRowIndices.map((rowIndex, i) => {
      const displayLabel = rowLabel(rowIndex);
      return {
        value: displayLabel,
        label: displayLabel,
        dataIndex: i,
      };
    });
  }, [selectedRowIndices]);

  const currentBaseLabel = comboItems[baseIndexParam]?.value || "";
  const handleBaseChange = (newLabel: string) => {
    const found = comboItems.find((x) => x.value === newLabel);
    if (found) {
      setBaseIndexParamStr(String(found.dataIndex));
    } else {
      setBaseIndexParamStr("0");
    }
  };

  // State for expansions in the Accordion (“Entries” & “Params”)
  // We add logic so if a top-level property is string/matrix/image => auto expand
  const [openItems, setOpenItems] = useState<string[]>([]);
  const [openParamItems, setOpenParamItems] = useState<string[]>([]);

  // We gather the default expansions once:
  const entryKeys = baseLog ? Object.keys(baseLog.entries) : [];
  const paramKeys = baseLog ? Object.keys(baseLog.params) : [];

  // For “Entries,” check each key => if it’s string, matrix, or image => auto open
  const defaultOpenEntries = useMemo(() => {
    if (!baseLog) return [];
    const out: string[] = [];
    for (const k of entryKeys) {
      const val = baseLog.entries[k];
      const type = getValueType(val);
      if (["string","matrix","image"].includes(type)) {
        out.push(k);
      }
    }
    return out;
  }, [baseLog, entryKeys]);

  // For “Params,” do the same
  const defaultOpenParams = useMemo(() => {
    if (!baseLog) return [];
    const out: string[] = [];
    for (const k of paramKeys) {
      const val = baseLog.params[k];
      const type = getValueType(val);
      if (["string","matrix","image"].includes(type)) {
        out.push(k);
      }
    }
    return out;
  }, [baseLog, paramKeys]);

  // We'll lazily initialize expansions from these default sets, so they only run once.
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
  const everythingOpenParams =
    paramKeys.length > 0 && openParamItems.length === paramKeys.length;

  const handleToggleAll = () => {
    if (everythingOpen) setOpenItems([]);
    else setOpenItems(entryKeys);
  };

  const handleToggleAllParams = () => {
    if (everythingOpenParams) setOpenParamItems([]);
    else setOpenParamItems(paramKeys);
  };

  const canPickBase = selectedRowIndices.length > 1;

  let content;
  if (!baseLog) {
    content = (
      <div className="flex items-center justify-center h-full w-full">
        <SelectionHints />
      </div>
    );
  } else {
    content = (
      <div className="flex flex-col gap-4">
        {/* Title row => combobox if multiple rows, plus "Expand All" for entries */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="font-bold text-lg">Entries</p>
            </div>
            <div className="flex items-center gap-2">
              {canPickBase && (
                <>
                  <span className="text-sm text-muted-foreground">Base:</span>
                  <Combobox
                    items={comboItems.map((item) => ({
                      value: item.value,
                      label: item.label,
                    }))}
                    value={currentBaseLabel}
                    onValueChange={handleBaseChange}
                    placeholder="Pick base row"
                    className="w-[110px]"
                  />
                </>
              )}
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
          </div>

          {/* Accordion => “Entries” */}
          <Accordion
            type="multiple"
            value={openItems}
            onValueChange={setOpenItems}
          >
            {entryKeys.map(col => (
              <SelectionEntry
                key={col}
                source="entries"
                property={col}
                value={baseLog.entries[col]}
                baseLog={baseLog}
                baseLogIndex={baseRowIndex + 1}
                comparisonLogs={comparisonLogs}
                comparisonLogsIndex={comparisonRowIndices.map(x => x + 1)}
              />
            ))}
          </Accordion>
        </div>

        {/* “Params” if any */}
        {paramKeys.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="font-bold text-lg">Params</p>
              </div>
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
              {paramKeys.map(col => (
                <SelectionEntry
                  key={col}
                  source="params"
                  property={col}
                  value={baseLog.params[col]}
                  baseLog={baseLog}
                  baseLogIndex={baseRowIndex + 1}
                  comparisonLogs={comparisonLogs}
                  comparisonLogsIndex={comparisonRowIndices.map(x => x + 1)}
                />
              ))}
            </Accordion>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-background rounded-md w-full h-full overflow-y-scroll p-5 flex flex-col">
      {content}
    </div>
  );
}

