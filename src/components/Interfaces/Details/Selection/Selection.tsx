"use client";

import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
} from "react";
import SelectionHints from "./Hints";
import ActionButton from "@/components/Common/Buttons/Action";
import { SquareSplitHorizontal } from "lucide-react";
import { TileProps, TableDataItem  } from "@/types/evals/grid";

import {
  buildIndexToColumnsMapFromId,
  buildRowIndicesInSelectionOrder,
} from "./SelectionUtils";

// Define the PanelState interface to store panel-specific settings
interface PanelState {
  displayMode: "markdown" | "text" | "raw";
  diffModeIdx: number;
  splitView: boolean;
  editMode: boolean;
  entriesFilter: Record<string, boolean>;
  paramsFilter: Record<string, boolean>;
  entryOrderings: { [key: string]: string[] };
  paramOrderings: { [key: string]: string[] };
  entryOrder: string[];
  paramOrder: string[];
  localOpenKeys: Set<string>;
  savedOpenKeys: Set<string>;
  viewTracesAsDict: boolean;  // New state for trace view mode
}

// Default values for a new panel
const defaultPanelState: PanelState = {
  displayMode: "text",
  diffModeIdx: 0,
  splitView: false,
  editMode: false,
  entriesFilter: {},
  paramsFilter: {},
  entryOrderings: {},
  paramOrderings: {},
  entryOrder: [],
  paramOrder: [],
  localOpenKeys: new Set<string>(),
  savedOpenKeys: new Set<string>(),
  viewTracesAsDict: false,  // Default to standard TraceView
};

import SelectionPanel from "./SelectionPanel";

import { useTile, useTileItem } from "@/contexts/hooks/tile";
import { maybeFlattenGroupedLogs } from "@/utils/evals/grouping";
import { useTableDataQuery } from "@/hooks/Query/useTableDataQuery";

/*******************************************************************************
 * Main "Selection" Component
 *   - Merged logic from old & new code
 ******************************************************************************/
export default function Selection({
  tileId,
  tabId,
}: {
  tileId: string;
  tabId: string;
}) {
  /******************************************************************************
   * Prepare sorted logs & selection data
   ******************************************************************************/
  const { meta: tileMetaStateWithId, actions: tileActionsWithId } = useTile(tileId, tabId);
  const { itemActions: tileItemActionsWithId } = useTileItem(tileId, tabId);

  const item = useMemo(() => tileItemActionsWithId?.asTileItem(), [tileItemActionsWithId]);

  // Get the table tile this selection references
  const { meta: tileMetaStateWithTable, tableTile: tableTileStateWithTable, actions: tileActionsWithTable } = useTile(
    item?.table || "", 
    tabId,
  );
  const { itemActions: tileItemActionsWithTable } = useTileItem(item?.table || "", tabId);

  // Use React Query to access tableDataItem
  const { 
    data: tableDataItem,
    isLoading: isTableDataLoading,
    isError: isTableDataError,
    error: tableDataError
  } = useTableDataQuery(tileId || null, tabId || null);

  // Create equivalent references to match the old pattern
  const tableItem = useMemo(() => tileItemActionsWithTable?.asTileItem() || 
    { name: item?.table, x: -1, y: -1, w: -1, h: -1 } as TileProps, [tileItemActionsWithTable, item?.table]);
  const relevantItem = useMemo(() => tileItemActionsWithTable?.asTileItem() || undefined, [tileItemActionsWithTable]);

  // Create a generic updateItem function that checks property existence
  const updateItem = useCallback((item: TileProps, propName: string) => (value: any) => {
    if (tileActionsWithId && item.name == tileMetaStateWithId?.name) {
      tileActionsWithId.updateTile({ [propName]: value });
    }
    else if (tileActionsWithTable && item.table == tileMetaStateWithTable?.name) {
      tileActionsWithTable.updateTile({ [propName]: value });
    }
  }, [tileActionsWithId, tileActionsWithTable, tileMetaStateWithId, tileMetaStateWithTable]);

  const params = useMemo(() => tableDataItem?.params || {}, [tableDataItem, item?.table]);
  const logs = useMemo(() => maybeFlattenGroupedLogs(tableDataItem?.logs || []), [tableDataItem, item?.table]);
  const selection_ = useMemo(() => relevantItem?.selected || undefined, [relevantItem?.selected]);
  const columnOrdering_ = useMemo(() => relevantItem?.column_order || undefined, [relevantItem?.column_order]);
  const baseIndex_ = useMemo(() => relevantItem?.base_index || undefined, [relevantItem?.base_index]);

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
   * Panel States - Keep track of each panel's state
   ******************************************************************************/
  const [panelStates, setPanelStates] = useState<Record<number, PanelState>>({
    0: { ...defaultPanelState },
  });

  // Function to update a specific panel's state
  const updatePanelState = useCallback((panelId: number, updates: Partial<PanelState>) => {
    setPanelStates(prev => ({
      ...prev,
      [panelId]: {
        ...prev[panelId],
        ...updates
      }
    }));
  }, []);
  
  // Keep panelStates in sync with panelCount
  useEffect(() => {
    setPanelStates(prev => {
      const newStates = {...prev};
      // Add any missing panel states
      for (let i = 0; i < panelCount; i++) {
        if (!newStates[i]) {
          newStates[i] = {...defaultPanelState};
        }
      }
      return newStates;
    });
  }, [panelCount]);

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
      {/* Main content: multiple panels */}
      <div className="flex-1 flex flex-row overflow-hidden">
        {Array.from({ length: panelCount }).map((_, idx) => {
          // Get the panel state or use default if not found
          // Use nullish coalescing instead of || to only use default when truly missing
          const panelState = panelStates[idx] ?? { ...defaultPanelState };
          
          // Ensure all properties that should be objects are initialized
          if (!panelState.localOpenKeys) panelState.localOpenKeys = new Set<string>();
          if (!panelState.savedOpenKeys) panelState.savedOpenKeys = new Set<string>();
          if (!panelState.entriesFilter) panelState.entriesFilter = {};
          if (!panelState.paramsFilter) panelState.paramsFilter = {};
          if (!panelState.entryOrderings) panelState.entryOrderings = {};
          if (!panelState.paramOrderings) panelState.paramOrderings = {};
          if (!panelState.entryOrder) panelState.entryOrder = [];
          if (!panelState.paramOrder) panelState.paramOrder = [];
          if (panelState.viewTracesAsDict === undefined) panelState.viewTracesAsDict = false; // Initialize if missing
          
          return (
            <React.Fragment key={`panel-fragment-${idx}`}>
              {idx > 0 && <div className="w-px bg-border self-stretch mx-1" />}
              <SelectionPanel
                key={`panel-${idx}`}
                panelId={idx}
                // Pass panel state and updater function
                panelState={panelState}
                onPanelStateChange={(updates) => updatePanelState(idx, updates)}
                logs={logs}
                sortedLogs={sortedLogs}
                params={params}
                selectedRowIndices={selectedRowIndices}
                columnOrdering={columnOrdering}
                indexToColumns={indexToColumns}
                tableItem={tableItem}
                item={item as TileProps}
                updateItem={updateItem}
                initialBaseIndex={baseIndex_ ? parseInt(baseIndex_, 10) : 0}
                allPossibleColumns={allPossibleColumns}
                // Pass down selection/panel info
                selectedRowCount={selectedRowIndices.length}
                currentPanelCount={panelCount}
                onPanelCountChange={setPanelCount}
              />
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}