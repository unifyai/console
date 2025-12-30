"use client";

import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef
} from "react";
import SelectionHints from "./Hints";
import { TileProps, LogsActions  } from "@/types/interfaces/grid";
import { getDeep, setDeep } from "@/utils/objectPath";
import { LogItemProps } from "@/types/interfaces/logs";

import {
  buildIndexToColumnsMapFromId,
  buildRowIndicesInSelectionOrder,
  PythonType,
  castToPythonType
} from "@/components/Pages/Interfaces/Blocks/Selection/SelectionUtils";

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
  viewTracesAsDict: false,
  cellEditMode: false,
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
  viewTracesAsDict: false,
  cellEditMode: false,
};

import SelectionPanel from "@/components/Pages/Interfaces/Blocks/Selection/SelectionPanel";
import { showErrorToast } from "@/components/Common/Toasts/notifications";

import { useTile, useTileItem } from "@/contexts/hooks/tile";
import { useTab } from "@/contexts/hooks/tab";
import { useStoreContext } from "@/contexts/providers/StoreProvider";
import { maybeFlattenGroupedLogs } from "@/utils/interfaces/table/grouping";
import { useTableDataQueryWithTracking } from "@/hooks/Interfaces/Query/useTableDataQuery";

// Focus pane and tab UI hooks (must be before any early returns)
const useFocusHelpers = (tabId: string) => {
  const { ui: tabUIState, uiActions: tabUIActions } = useTab(tabId);
  const setFocusPaneOpen = useStoreContext(state => state.setFocusPaneOpen);
  return { tabUIState, tabUIActions, setFocusPaneOpen };
};

/*******************************************************************************
 * Main "Selection" Component
 *   - Merged logic from old & new code
 ******************************************************************************/
export default function Selection({
  tileId,
  tabId,
  projectId,
  logsActions,
}: {
  tileId: string;
  tabId: string;
  projectId: string;
  logsActions: LogsActions;
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
    tableData: tableDataItem,
    isLoading: isTableDataLoading,
    isError: isTableDataError,
    error: tableDataError,
    mergeUpdatesIntoTableDataItem,
    updateLogsByRowIds
  } = useTableDataQueryWithTracking(item?.table || null, tabId || null);

  // Get table fields
  const fields = useMemo(() => tableDataItem?.fields || [], [tableDataItem]);

  // Create equivalent references to match the old pattern
  const tableItem = useMemo(() => tileItemActionsWithTable?.asTileItem() || 
    { name: item?.table, x: -1, y: -1, w: -1, h: -1 } as TileProps, [tileItemActionsWithTable, item?.table]);
  const relevantItem = useMemo(() => tileItemActionsWithTable?.asTileItem() || undefined, [tileItemActionsWithTable]);

  // Get table context
  const context = useMemo(() => tableItem.context ?? null, [tableItem.context]);

  // Create a generic updateItem function that checks property existence
  const updateItem = useCallback((item: TileProps, propName: string) => (value: any) => {
    if (tileActionsWithId && item.name == tileMetaStateWithId?.name) {
      tileActionsWithId.updateTile({ [propName]: value });
    }
    else if (tileActionsWithTable && item.table == tileMetaStateWithTable?.name) {
      tileActionsWithTable.updateTile({ [propName]: value });
    }
  }, [tileActionsWithId, tileActionsWithTable, tileMetaStateWithId, tileMetaStateWithTable]);

  const params = useMemo(() => tableDataItem?.params || {}, [tableDataItem]);
  const logs = useMemo(() => maybeFlattenGroupedLogs(tableDataItem?.logs || []), [tableDataItem]);
  const selection_ = useMemo(() => relevantItem?.selected || undefined, [relevantItem?.selected]);
  const columnOrdering_ = useMemo(() => relevantItem?.column_order || undefined, [relevantItem?.column_order]);
  const baseIndex_ = useMemo(() => relevantItem?.base_index || undefined, [relevantItem?.base_index]);

  const sortedLogs = useMemo(() => [...logs], [logs]);

  const { tabUIState, tabUIActions, setFocusPaneOpen } = useFocusHelpers(tabId);

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

  // Ref to keep the latest in-flight PATCH so we can abort outdated ones
  const bulkPatchAbortRef = useRef<AbortController | null>(null);

  // Helper to rollback optimistic change when network fails
  const rollbackLogs = useCallback((prevLogs: any[] | undefined) => {
    if (!prevLogs) return;
    mergeUpdatesIntoTableDataItem({ logs: prevLogs });
  }, [mergeUpdatesIntoTableDataItem]);
  
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
        ...(prev[panelId] ?? { ...defaultPanelState }), // Use default if panel doesn't exist yet
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
   * Save-many handler – optimistic update + backend PUT
   ******************************************************************************/
  const handleSaveMany = useCallback(
    async (
      rowIds: string[],
      desc: { source: "entries" | "params"; path: (string | number)[]; newValue: any }
    ) => {

      if (!tableDataItem) {
        console.warn("[DEBUG] handleSaveMany] Missing tableDataItem – optimistic update skipped");
        return;
      }
      if (!rowIds.length) return;

      // Snapshot previous logs for potential rollback
      const prevLogs = tableDataItem?.logs;

      // --- Casting logic for null/undefined original values ---
      const prevLogForOriginalValue = prevLogs?.find(log => String(log.id) === rowIds[0]); // Use first rowId for type checking if multiple are updated
      if (prevLogForOriginalValue) {
        const originalValueAtPath = getDeep(prevLogForOriginalValue[desc.source] ?? {}, desc.path);
        // Check if original was null/undefined and the new value is a string
        if ((originalValueAtPath === null || originalValueAtPath === undefined) && typeof desc.newValue === 'string') {
          if (desc.path.length > 0) { // Ensure path is not empty
            const topLevelFieldName = String(desc.path[0]);
            // Use the corresponding field to get the type
            const fieldInfo = fields[topLevelFieldName]; 
            if (fieldInfo && fieldInfo.data_type) {
              const pyType = fieldInfo.data_type as PythonType; // e.g., "int", "str", "list"
              const castedResult = castToPythonType(desc.newValue, pyType);
              if (castedResult && typeof castedResult === 'object' && 'error' in castedResult) {
                // If casting fails, show a warning. desc.newValue remains the user-provided string.
                // toast.warning(`Could not cast "${desc.newValue}" to type "${pyType}". Saving as string. Error: ${castedResult.error}`);
              } else {
                // Casting was successful, update desc.newValue
                desc.newValue = castedResult;
              }
            } else {
              console.warn(`Field info or data_type for '${topLevelFieldName}' not found. Saving as string.`);
            }
          }
        }
      }

      // Manually construct the *full* updated field for the backend
      // Find the relevant log in the *previous* state (before optimistic update) to correctly build the patch
      const prevLogForUpdate = prevLogs?.find(log => String(log.id) === rowIds[0]); 

      if (!prevLogForUpdate) {
        console.error("Could not find the log in the previous state to construct update payload.");
        if (tableDataItem) rollbackLogs(prevLogs);
                    showErrorToast("Failed to update log: Inconsistent log data.");
        return;
      }

      let entriesUpdate: LogItemProps = {};
      let paramsUpdate: LogItemProps = {};

      if (desc.source === 'entries') {
        if (desc.path.length > 0) {
          const topLevelKey = desc.path[0] as string;
          const originalTopLevelValue = getDeep(prevLogForUpdate.entries ?? {}, [topLevelKey]);
          const updatedValueContainer = setDeep(originalTopLevelValue, desc.path.slice(1), desc.newValue);
          entriesUpdate = { [topLevelKey as string]: updatedValueContainer };
        } else {
          // This case (empty path) should ideally not happen for field updates.
          console.warn("Attempting to update 'entries' with an empty path. New value:", desc.newValue);
          if (typeof desc.newValue === 'object' && desc.newValue !== null) {
             entriesUpdate = desc.newValue as LogItemProps;
          } else {
            return;
          }
        }
      } else {
        if (desc.path.length > 0) {
          const topLevelKey = desc.path[0] as string;
          const originalTopLevelValue = getDeep(prevLogForUpdate.params ?? {}, [topLevelKey]);
          const updatedValueContainer = setDeep(originalTopLevelValue, desc.path.slice(1), desc.newValue);
          paramsUpdate = { [topLevelKey as string]: updatedValueContainer };
        } else {
          console.warn("Attempting to update 'params' with an empty path. New value:", desc.newValue);
          if (typeof desc.newValue === 'object' && desc.newValue !== null) {
            paramsUpdate = desc.newValue as LogItemProps;
          } else {
            return;
          }
        }
      }

      try {
        const entriesKeys = Object.keys(entriesUpdate || {});
        const paramsKeys = Object.keys(paramsUpdate || {});
        if ((!entriesKeys.length) && (!paramsKeys.length)) return;
      } catch (_) {}

      // Build affected logs for contact sync
      const affectedLogs = rowIds
        .map(id => {
          const log = prevLogs?.find((l: any) => String(l.id) === String(id));
          if (!log) return null;
          return { id: Number(log.id), entries: (log.entries || {}) as Record<string, any> };
        })
        .filter((x): x is { id: number; entries: Record<string, any> } => x !== null);

      try {
        const response = await logsActions.update(
          projectId,
          context,
          rowIds.map(id => parseInt(id, 10)),
          entriesUpdate,
          paramsUpdate,
          true,
          affectedLogs
        );
        if (response.detail) {
          console.error("[DEBUG] handleSaveMany – error", response.detail);
          showErrorToast(`Failed to update log entry`);
          return;
        }
      } catch (err: any) {
        console.error("[DEBUG] handleSaveMany – backend error", err);
        showErrorToast(`Failed to update log entry`);
        return;
      }

      // Optimistic local state update provided the endpoint call is successful
      if (updateLogsByRowIds) {
        updateLogsByRowIds(rowIds, desc);
      }

    },
    [projectId, context, updateLogsByRowIds, rollbackLogs, logsActions, fields, tableDataItem]
  );

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
  // hooks already retrieved above
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
          if (panelState.cellEditMode === undefined) panelState.cellEditMode = false; // Initialize if missing
          
          return (
            <React.Fragment key={`panel-fragment-${idx}`}>
              {idx > 0 && <div className="w-px bg-border self-stretch mx-1" />}
              <SelectionPanel
                key={`panel-${idx}`}
                panelId={idx}
                // Pass panel state and updater function
                panelState={panelState}
                onPanelStateChange={(updates) => updatePanelState(idx, updates as PanelState)}
                fields={fields}
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
                selectedRowCount={selectedRowIndices.length}
                currentPanelCount={panelCount}
                onPanelCountChange={setPanelCount}
                onSaveMany={handleSaveMany}
                logsActions={logsActions}
                updateLogsByRowIds={updateLogsByRowIds}
                context={context}
                tabUIState={tabUIState}
                tabUIActions={tabUIActions}
                setFocusPaneOpen={setFocusPaneOpen}
              />
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}