import React, {
  useMemo,
  useState,
} from "react";
import { LogProps } from "@/types/evals/logs";
import SelectionHints from "./Hints";
import ActionButton from "@/components/Common/Buttons/Action";
import { SquareSplitHorizontal } from "lucide-react";
import { TileProps, ItemType } from "@/types/evals/grid";

import {
  buildIndexToColumnsMapFromId,
  buildRowIndicesInSelectionOrder,
} from "./SelectionUtils";

import SelectionPanel from "./SelectionPanel";

/*******************************************************************************
 * Main "Selection" Component
 *   - Merged logic from old & new code
 ******************************************************************************/
export default function Selection({
  params,
  logs,
  selection_,
  baseIndex_,
  columnOrdering_,
  tableItem,
  item,
  updateItem,
}: {
  params: Record<string, unknown>;
  logs: LogProps[];
  selection_: string | undefined;
  baseIndex_: string | undefined;
  columnOrdering_: string | undefined;
  tableItem: TileProps | undefined;
  item: TileProps;
  updateItem: (item: TileProps, attrName: ItemType) => (
    newValue: string | undefined
  ) => void;
}) {
  /******************************************************************************
   * Prepare sorted logs & selection data
   ******************************************************************************/
  const sortedLogs = useMemo(() => [...logs], [logs]);

  const selectedCells = useMemo(() => {
    const arr = selection_ ? selection_.split(",") : [];
    return arr.map(token => {
      // token might look like "277932_Entries/trace" or "277932_Entries/context1/fieldA"
      // so let's rewrite the part after "_" with prefixes removed but internal slashes preserved.
      const underscorePos = token.indexOf("_");
      if (underscorePos < 1) return token;
      const rowPart = token.slice(0, underscorePos); // e.g. "277932"
      let colPart = token.slice(underscorePos + 1);  // e.g. "Entries/trace" or "Entries/context1/fieldA"
      
      // Remove only the "Entries/" or "Parameters/" prefix if present, but preserve internal slashes
      let sanitizedCol = colPart;
      if (colPart.startsWith("Entries/")) {
        sanitizedCol = colPart.substring("Entries/".length);
      } else if (colPart.startsWith("Parameters/")) {
        sanitizedCol = colPart.substring("Parameters/".length);
      }
      
      return rowPart + "_" + sanitizedCol; // => "277932_trace" or "277932_context1/fieldA"
    });
  }, [selection_]);
  
  const indexToColumns = useMemo(() => {
    const map = buildIndexToColumnsMapFromId(selectedCells, sortedLogs);
    return map;
  }, [selectedCells, sortedLogs]);

  const selectedRowIndices = useMemo(() => {
    return buildRowIndicesInSelectionOrder(selectedCells, sortedLogs);
  }, [selectedCells, sortedLogs]);

  const columnOrdering = useMemo(() => {
    return columnOrdering_ ? columnOrdering_.split(",") : [];
  }, [columnOrdering_]);

  // Get all possible column names from all logs
  const allPossibleColumns = useMemo(() => {
    // Parse the columnOrdering_ string which contains all column names
    if (columnOrdering_ && columnOrdering_.length > 0) {
      const entryColumns = new Set<string>();
      const paramColumns = new Set<string>();
      
      columnOrdering_.split(',').forEach(col => {
        // Some columns might look like "Parameters/experiment" or "Entries/trace" or "Entries/context1/fieldA"
        if (col.startsWith('Parameters/')) {
          // Extract the parameter name without the "Parameters/" prefix but preserve internal slashes
          const paramName = col.substring('Parameters/'.length);
          paramColumns.add(paramName);
        } 
        else if (col.startsWith('Entries/')) {
          // Extract the entry name without the "Entries/" prefix but preserve internal slashes
          const entryName = col.substring('Entries/'.length);
          entryColumns.add(entryName);
        }
        // Skip other entries like "Parameters" or "Entries" or "RowNumbering" which are categories
      });
      
      return {
        entries: Array.from(entryColumns),
        params: Array.from(paramColumns)
      };
    }
    
    // Fallback: if no columnOrdering_, gather from logs (less reliable)
    // This already preserves slashes since it's just accessing object keys directly
    const entryColumns = new Set<string>();
    const paramColumns = new Set<string>();
    
    logs.forEach(log => {
      if (log.entries) {
        Object.keys(log.entries).forEach(key => entryColumns.add(key));
      }
      if (log.params) {
        Object.keys(log.params).forEach(key => paramColumns.add(key));
      }
    });
    
    return {
      entries: Array.from(entryColumns),
      params: Array.from(paramColumns)
    };
  }, [logs, columnOrdering_]);

  /*******************************************************************************
   * Panel Count State
   ******************************************************************************/
  const [panelCount, setPanelCount] = useState(1);

  /*******************************************************************************
   * If no rows selected, just show hints
   ******************************************************************************/
  if (!selectedRowIndices.length) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background rounded-md">
        <SelectionHints />
      </div>
    );
  }

  /*******************************************************************************
   * Main component render
   ******************************************************************************/
  return (
    <div className="flex flex-col w-full h-full overflow-hidden bg-background rounded-md">
      {/* Top bar for panel count control */}
      <div className="p-2 border-b border-muted flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Selected {selectedRowIndices.length} row(s)
        </p>
        <div className="flex items-center gap-2">
          {/* Cycle panel count */}
          <ActionButton
            tooltip={`Cycle panel count (currently: ${panelCount})`}
            icon={<SquareSplitHorizontal className="h-4 w-4" />}
            onClick={() => {
              setPanelCount((prev) => (prev === 2 ? 1 : prev + 1));
            }}
            variant="ghost"
            size="icon"
          />
        </div>
      </div>

      {/* Main content: multiple panels */}
      <div className="flex-1 flex flex-row overflow-hidden">
        {Array.from({ length: panelCount }).map((_, idx) => (
          <React.Fragment key={`panel-fragment-${idx}`}>
            {idx > 0 && <div className="w-px bg-border self-stretch mx-1" />}
            <SelectionPanel
              key={`panel-${idx}`}
              logs={logs}
              sortedLogs={sortedLogs}
              params={params}
              selectedRowIndices={selectedRowIndices}
              columnOrdering={columnOrdering}
              indexToColumns={indexToColumns}
              tableItem={tableItem}
              item={item}
              updateItem={updateItem}
              panelId={idx}
              initialBaseIndex={baseIndex_ ? parseInt(baseIndex_, 10) : 0}
              allPossibleColumns={allPossibleColumns}
            />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}