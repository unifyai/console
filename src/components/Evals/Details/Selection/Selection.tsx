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

  // Get hidden columns to remove from the details view
  const hiddenColumns = useQueryState("hidden_columns")[0]?.split(",") || [];
  console.log(hiddenColumns)

  // Filter out hidden columns from entries and params
  const filteredLogs = logs.map((log) => {
    return {
      ...log,
      entries: Object.fromEntries(
        Object.entries(log.entries).filter(([key]) => !hiddenColumns.includes(key))
      ),
      params: Object.fromEntries(
        Object.entries(log.params).filter(([key]) => !hiddenColumns.includes(key))
      ),
    }
  })

  // Pull relevant IDs from query string and reconstruct base and comparison logs based on the cells
  const [selectedCells, _]  = useQueryState(
    "selected", 
    parseAsArrayOf(parseAsString).withDefault([])                    // [logId1_colId1,logId1_colId2,logId2_colId3,...]
  )
  const { baseLogIndex, baseLog, comparisonLogsIndex, comparisonLogs } = extractBaseAndComparisonLogs(selectedCells, filteredLogs)

  console.log({baseLogIndex, baseLog, comparisonLogsIndex, comparisonLogs})

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
            key={property}               // unique string key (property name)
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