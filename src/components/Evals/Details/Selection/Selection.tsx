"use client";

import React, { useState } from "react";
import { LogProps, LogItemProps } from "@/types/evals/logs";
import SelectionHints from "./Hints";
import SelectionEntry from "./SelectionEntry";
import { useQueryState } from "nuqs";
import { Accordion } from "@/components/UI/accordion";
import { Button } from "@/components/UI/button";
import { FoldVertical, UnfoldVertical } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";

const Selection = ({ params, logs }: { params: LogItemProps; logs: LogProps[] }) => {
  // Pull relevant IDs from query string
  const [comparisonLogsParam] = useQueryState("comparison");
  const [baseLogParam] = useQueryState("base");

  // Locate base log and its index
  const baseLog = logs.find((log) => log.id == baseLogParam);
  const baseLogIndex = logs.findIndex((log) => log.id == baseLogParam) + 1;

  // Locate comparison logs
  const comparisonLogs = comparisonLogsParam && logs
    ? comparisonLogsParam.split(",").map((value: string) => logs.find((log) => log.id == value)!)
    : [];
  const comparisonLogsIndex = comparisonLogsParam && logs
    ? comparisonLogs.map((value: LogProps) => logs.findIndex((log) => log.id == value.id) + 1)
    : [];


  const [openItems, setOpenItems] = useState<string[]>([]);

  // If we have a base log, collect all its property keys
  const entryKeys = baseLog ? Object.keys(baseLog.entries) : [];

  // Check if all possible items are open
  const anyOpen = entryKeys.length > 0 && openItems.length == entryKeys.length;

  // Toggle function on button click
  const handleToggleAll = () => {
    if (anyOpen) {
      // Collapse all
      setOpenItems([]);
    } else {
      // Expand all
      setOpenItems(entryKeys);
    }
  };

  // Render the list of SelectionEntry components for each property/value
  const entriesNodes = (baseLog: LogProps) => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="font-bold text-lg">Entries</p>
        <ActionButton
          variant="ghost"
          size="icon"
          tooltip={anyOpen ? "Collapse all" : "Expand all"}
          onClick={handleToggleAll}
          icon={anyOpen ? <FoldVertical className="h-4 w-4"/> : <UnfoldVertical className="h-4 w-4"/>}
        />
      </div>

      <Accordion
        type="multiple"
        className=""
        value={openItems}
        onValueChange={setOpenItems}
      >
        {Object.entries(baseLog.entries).map(([property, value], index) => (
          <SelectionEntry
            property={property}
            value={value}
            key={index}
            baseLog={baseLog}
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
          <div>{entriesNodes(baseLog)}</div>
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