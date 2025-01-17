"use client";

import React, { useMemo, useState } from "react";
import { LogProps, LogItemProps } from "@/types/evals/logs";
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
 * Helper to parse tokens like "116812_call_transcripts" => logId="116812", column="call_transcripts"
 * Then find in sortedLogs whichever rowIndex has .id == "116812". Store rowIndex -> columns.
 */
function buildIndexToColumnsMapFromId(
  selectedCells: string[],
  sortedLogs: LogProps[]
): Record<number, Set<string>> {
  const map: Record<number, Set<string>> = {};
  for (const token of selectedCells) {
    const underscorePos = token.indexOf("_");
    if (underscorePos < 1) continue; // skip any invalid tokens
    const logIdStr = token.slice(0, underscorePos);
    const columnName = token.slice(underscorePos + 1);

    // find rowIndex for log.id == logIdStr:
    const rowIndex = sortedLogs.findIndex((log) => String(log.id) === logIdStr);
    if (rowIndex < 0) continue; // not found => skip

    if (!map[rowIndex]) {
      map[rowIndex] = new Set<string>();
    }
    map[rowIndex].add(columnName);
  }
  return map;
}

/** A small helper to return a user-friendly label like "Row 5" for rowIndex=4 */
function rowLabel(rowIndex: number) {
  return `Row ${rowIndex + 1}`;
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

  // Optional sorting logic 
  const sortedLogs = useMemo(() => {
    return [...logs];
  }, [logs]);

  // The “selected” query param => array of e.g. "123_columnName"
  const [selectedCells] = useQueryState(
    "selected",
    parseAsArrayOf(parseAsString).withDefault([])
  );
  // Map rowIndex -> set of selected columns 
  const indexToColumns = useMemo(() => {
    return buildIndexToColumnsMapFromId(selectedCells, sortedLogs);
  }, [selectedCells, sortedLogs]);

  // Distinct rowIndices that are selected
  const selectedRowIndices = useMemo(() => {
    return Object.keys(indexToColumns)
      .map((key) => parseInt(key, 10))
      .filter((n) => !isNaN(n))
      .sort((a, b) => a - b);
  }, [indexToColumns]);

  // Which row is “base”
  const [baseIndexParamStr, setBaseIndexParamStr] = useQueryState("base_idx", parseAsString);
  let baseIndexParam = baseIndexParamStr ? parseInt(baseIndexParamStr, 10) : 0;
  if (isNaN(baseIndexParam) || baseIndexParam < 0 || baseIndexParam >= selectedRowIndices.length) {
    baseIndexParam = 0;
  }

  // The rowIndex in sortedLogs for the base 
  const baseRowIndex = selectedRowIndices[baseIndexParam] ?? -1;
  // The rest => for comparisons
  const comparisonRowIndices = selectedRowIndices.filter((_, i) => i !== baseIndexParam);

  /**
   * Build a new LogProps object (base or comparison) with only the 
   * “chosen” columns from selectedCells, also filtering out hidden columns, 
   * and respecting column order. Now we do the same for .params as well.
   */
  function buildLogWithChosenColumns(originalLog: LogProps, rowIndex: number): LogProps {
    // The user-chosen columns 
    const chosenCols = indexToColumns[rowIndex] ?? new Set<string>();

    // Filtration & ordering for entries
    const safeEntries = originalLog.entries ?? {};
    const afterHiddenEntries = Array.from(chosenCols).filter(c => !hiddenColumns.includes(c));
    let finalColsEntries: string[];
    if (columnOrdering.length > 0) {
      finalColsEntries = columnOrdering
        .filter(c => afterHiddenEntries.includes(c))
        .map(sanitizeId);
    } else {
      finalColsEntries = afterHiddenEntries.map(sanitizeId);
    }
    // Rebuild entries
    const newEntries: Record<string, unknown> = {};
    for (const c of finalColsEntries) {
      if (safeEntries.hasOwnProperty(c)) {
        newEntries[c] = safeEntries[c];
      }
    }

    // Filtration & ordering for params
    const safeParams = originalLog.params ?? {};
    const afterHiddenParams = Array.from(chosenCols).filter(c => !hiddenColumns.includes(c));
    let finalColsParams: string[];
    if (columnOrdering.length > 0) {
      finalColsParams = columnOrdering
        .filter(c => afterHiddenParams.includes(c))
        .map(sanitizeId);
    } else {
      finalColsParams = afterHiddenParams.map(sanitizeId);
    }
    // Rebuild params
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
  }, [baseRowIndex, sortedLogs, indexToColumns, columnOrdering, hiddenColumns]);

  // The comparisons
  const comparisonLogs = useMemo(() => {
    return comparisonRowIndices
      .map((ri) => {
        if (ri < 0 || ri >= sortedLogs.length) {
          return null;
        }
        return buildLogWithChosenColumns(sortedLogs[ri], ri);
      })
      .filter((x): x is LogProps => x !== null);
  }, [comparisonRowIndices, sortedLogs, indexToColumns, columnOrdering, hiddenColumns]);

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

  // Conditionals for expansions in the Accordion (“Entries” & “Params”)
  const [openItems, setOpenItems] = useState<string[]>([]);
  const [openParamItems, setOpenParamItems] = useState<string[]>([]);

  const entryKeys = baseLog ? Object.keys(baseLog.entries) : [];
  const everythingOpen = entryKeys.length > 0 && openItems.length === entryKeys.length;

  const handleToggleAll = () => {
    if (everythingOpen) setOpenItems([]);
    else setOpenItems(entryKeys);
  };

  const paramKeys = baseLog ? Object.keys(baseLog.params) : [];
  const everythingOpenParams =
    paramKeys.length > 0 && openParamItems.length === paramKeys.length;

  const handleToggleAllParams = () => {
    if (everythingOpenParams) setOpenParamItems([]);
    else setOpenParamItems(paramKeys);
  };

  const canPickBase = selectedRowIndices.length > 1;

  // If we have no baseLog => show hints
  let content;
  if (!baseLog) {
    content = (
      <div className="flex items-center justify-center h-full w-full">
        <SelectionHints />
      </div>
    );
  } else {
    // We have a base => show “Entries” + “Params”
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