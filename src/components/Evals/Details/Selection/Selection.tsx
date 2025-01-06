"use client";

import React, { useState } from "react";
import { LogProps, LogItemProps } from "@/types/evals/logs";
import SelectionHints from "./Hints";
import SelectionEntry from "./SelectionEntry";
import { useQueryState } from "nuqs";
import { Accordion } from "@/components/UI/accordion";
import ActionButton from "@/components/Common/Buttons/Action";
import { FoldVertical, UnfoldVertical } from "lucide-react";
import { parseAsArrayOf, parseAsString } from "nuqs";
import { extractBaseAndComparisonLogs } from "@/utils/evals/selection";

const Selection = ({ params, logs }: { params: LogItemProps; logs: LogProps[] }) => {

  // Get column ordering if specified
  const columnOrdering = useQueryState("column_order")[0]?.split(",") || [];

  // Get hidden columns to remove from the details view
  const hiddenColumns = useQueryState("hidden_columns")[0]?.split(",") || [];

  // Sort logs based on the column ordering if any
  const sortedLogs = [...logs].sort((a, b) => {
    for (const column of columnOrdering) {
      // Prefer `entries[column]` if it exists, otherwise fallback to `params[column]`
      const aValue = a.entries[column] ?? a.params[column];
      const bValue = b.entries[column] ?? b.params[column];
  
      // If both are undefined, just skip this column (continue to next)
      if (aValue === undefined && bValue === undefined) {
        continue;
      }
  
      // Only compare if both values exist
      if (aValue < bValue) return -1;
      if (aValue > bValue) return 1;
    }
    // If everything in columnOrdering is equal (or not set), consider them "equal"
    return 0;
  });

  // Filter out hidden columns from each log
  // If no column order was given, default to the log's own columns
  const filteredLogs = sortedLogs.map(log => {
    const columnsToUse = columnOrdering.length > 0
      ? columnOrdering // Use the order from URL, if present
      : Object.keys(log.entries); // Otherwise, show all columns

    const newEntries = columnsToUse.reduce((acc, col) => {
      if (hiddenColumns.includes(col)) {
        return acc; // skip hidden columns
      }
      // Prefer entry from log.entries if available
      if (log.entries.hasOwnProperty(col)) {
        acc[col] = log.entries[col];
      }
      return acc;
    }, {} as Record<string, unknown>);

    return {
      ...log,
      entries: newEntries,
    };
  });

  // Pull relevant IDs from query string and rebuild base/comparison logs 
  const [selectedCells, _]  = useQueryState(
    "selected", 
    parseAsArrayOf(parseAsString).withDefault([])
  );
  const { baseLogIndex, baseLog, comparisonLogsIndex, comparisonLogs } = extractBaseAndComparisonLogs(selectedCells, filteredLogs);

  // The top-level Accordion’s expanded items
  const [openItems, setOpenItems] = useState<string[]>([]);

  // If we have a base log, collect all property keys
  const entryKeys = baseLog ? Object.keys(baseLog.entries) : [];

  // Check if everything is open
  const everythingOpen = entryKeys.length > 0 && openItems.length === entryKeys.length;

  // Expand/Collapse everything
  const handleToggleAll = () => {
    if (everythingOpen) {
      setOpenItems([]);
    } else {
      setOpenItems(entryKeys);
    }
  };

  // Renders each property from the base log as a SelectionEntry in the top-level Accordion
  const entriesNodes = (base: LogProps) => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
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
        {Object.entries(base.entries).map(([property, value]) => (
          <SelectionEntry
            key={property}
            property={property}
            value={value}
            baseLog={base}
            baseLogIndex={baseLogIndex}
            comparisonLogs={comparisonLogs}
            comparisonLogsIndex={comparisonLogsIndex}
          />
        ))}
      </Accordion>
    </div>
  );

  return (
    <div className="bg-background rounded-md w-full h-full overflow-y-scroll p-5 flex flex-col">
      {baseLog ? (
        <div className="relative gap-4 flex flex-col">
          {entriesNodes(baseLog)}
        </div>
      ) : (
        <div className="flex items-center justify-center h-full w-full">
          <SelectionHints />
        </div>
      )}
    </div>
  );
};

export default Selection;