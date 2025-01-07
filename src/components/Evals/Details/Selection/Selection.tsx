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
  params: LogItemProps;
  logs: LogProps[];
}) {

  const [columnOrderStr] = useQueryState("column_order");
  const [hiddenColumnsStr] = useQueryState("hidden_columns");
  const columnOrdering = columnOrderStr ? columnOrderStr.split(",") : [];
  const hiddenColumns = hiddenColumnsStr ? hiddenColumnsStr.split(",") : [];


  const sortedLogs = useMemo(() => {
    // Insert your own logic if you do a custom sort
    return [...logs];
  }, [logs]);


  const [selectedCells] = useQueryState(
    "selected",
    parseAsArrayOf(parseAsString).withDefault([])
  );
  const indexToColumns = useMemo(() => {
    return buildIndexToColumnsMapFromId(selectedCells, sortedLogs);
  }, [selectedCells, sortedLogs]);

  // Gather the unique rowIndices from that map
  const selectedRowIndices = useMemo(() => {
    return Object.keys(indexToColumns)
      .map((key) => parseInt(key, 10))
      .filter((n) => !isNaN(n))
      .sort((a, b) => a - b);
  }, [indexToColumns]);


  const [baseIndexParamStr, setBaseIndexParamStr] = useQueryState("base_idx", parseAsString);
  let baseIndexParam = baseIndexParamStr ? parseInt(baseIndexParamStr, 10) : 0;
  if (isNaN(baseIndexParam) || baseIndexParam < 0 || baseIndexParam >= selectedRowIndices.length) {
    baseIndexParam = 0;
  }

  // The actual rowIndex in sortedLogs for the “base log”
  const baseRowIndex = selectedRowIndices[baseIndexParam] ?? -1;
  // The other row indices => comparisons
  const comparisonRowIndices = selectedRowIndices.filter((_, i) => i !== baseIndexParam);


  function buildLogWithChosenColumns(originalLog: LogProps, rowIndex: number): LogProps {
    const chosenCols = indexToColumns[rowIndex] ?? new Set<string>();
    const safeEntries = originalLog.entries ?? {};

    // Filter out hidden columns
    const afterHidden = Array.from(chosenCols).filter(c => !hiddenColumns.includes(c));
    // Respect columnOrdering if any
    let finalCols: string[];
    if (columnOrdering.length > 0) {
      finalCols = columnOrdering.filter(c => afterHidden.includes(c));
    } else {
      finalCols = afterHidden;
    }

    const newEntries: Record<string, unknown> = {};
    for (const c of finalCols) {
      if (safeEntries.hasOwnProperty(c)) {
        newEntries[c] = safeEntries[c];
      }
    }
    return { ...originalLog, entries: newEntries };
  }

  // Build final base log
  const baseLog = useMemo(() => {
    if (baseRowIndex < 0 || baseRowIndex >= sortedLogs.length) {
      return undefined;
    }
    const original = sortedLogs[baseRowIndex];
    return buildLogWithChosenColumns(original, baseRowIndex);
  }, [baseRowIndex, sortedLogs, indexToColumns, columnOrdering, hiddenColumns]);

  // Build final comparison logs
  const comparisonLogs = useMemo(() => {
    return comparisonRowIndices
      .map((ri) => {
        if (ri < 0 || ri >= sortedLogs.length) return null;
        const original = sortedLogs[ri];
        return buildLogWithChosenColumns(original, ri);
      })
      .filter((x): x is LogProps => x !== null);
  }, [comparisonRowIndices, sortedLogs, indexToColumns, columnOrdering, hiddenColumns]);


  const comboItems = useMemo(() => {
    return selectedRowIndices.map((rowIndex, i) => {
      const displayLabel = rowLabel(rowIndex); // e.g. "Row 5"
      return {
        value: displayLabel, // used for searching & display
        label: displayLabel,
        dataIndex: i,       // which item in selectedRowIndices this is
      };
    });
  }, [selectedRowIndices]);

  // The current displayed “value” for the combobox
  const currentBaseLabel = comboItems[baseIndexParam]?.value || "";

  const [openItems, setOpenItems] = useState<string[]>([]);
  const entryKeys = (baseLog && baseLog.entries) ? Object.keys(baseLog.entries) : [];
  const everythingOpen = entryKeys.length > 0 && openItems.length === entryKeys.length;
  const handleToggleAll = () => {
    if (everythingOpen) setOpenItems([]);
    else setOpenItems(entryKeys);
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
    // We have a base log => show the details pane
    content = (
      <div className="flex flex-col gap-2">
        {/* Title row => combobox if multi-rows, plus "Expand All" */}
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
                      value: item.value, // "Row 5"
                      label: item.label, // "Row 5"
                    }))}
                    value={currentBaseLabel} // e.g. "Row 5"
                    onValueChange={(newLabel) => {
                      const found = comboItems.find((x) => x.value === newLabel);
                      if (found) {
                        setBaseIndexParamStr(String(found.dataIndex));
                      } else {
                        setBaseIndexParamStr("0");
                      }
                    }}
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

        <Accordion type="multiple" value={openItems} onValueChange={setOpenItems}>
          {entryKeys.map((col) => (
            <SelectionEntry
              key={col}
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
    );
  }

  // Return a single set of hooks usage, then conditionally render content
  return (
    <div className="bg-background rounded-md w-full h-full overflow-y-scroll p-5 flex flex-col">
      {content}
    </div>
  );
}