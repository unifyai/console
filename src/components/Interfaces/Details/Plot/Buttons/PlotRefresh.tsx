"use client";
import ActionButton from "@/components/Common/Buttons/Action";
import { RefreshCw, Timer, Check } from "lucide-react";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { LogsActions, FieldsActions, PlotDataItem, ProjectsActions, ContextActions, GranularTileActions } from "@/types/evals/grid";
import { PlotArguments } from "@/types/evals/logs";
import { useTab } from "@/contexts/hooks/tab/useTab";
import { useTiles } from "@/contexts/hooks/useStore";
import { usePlotAutoUpdateQuery } from "@/hooks/Query/usePlotAutoUpdateQuery";
import { useTileSync } from "@/contexts/hooks/tile/sync";
import { useQueryClient } from "@tanstack/react-query";
import { useTileData } from "@/contexts/hooks/tile/useTileData";
import { showLoadingToast, showSuccessToast, showErrorToast } from "@/components/notifications";
import { withLoadingToast } from "@/components/notifications";

// Helper function to fetch latest timestamps for plot tables
function fetchLatestTimestamps(
  tables: string[], 
  args: PlotArguments, 
  project: string, 
  logsActions: LogsActions, 
  signal?: AbortSignal
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const promises = tables.map(table => {
      const tableArgs = args[table];
      const tableContext = tableArgs?.["context"] ?? null;
      const tableColumnContext = tableArgs?.["column_context"] ?? null;
      const tableFilters = tableArgs?.["filters"] ?? null;
      const tableSubset = tableArgs?.["subset"] ?? null;
      return logsActions.getLatest(project, tableContext, tableColumnContext, tableFilters, null, null, null, null, tableSubset, null, null, null, null, null, null, null, signal);
    });
    Promise.all(promises)
      .then(latestDates => {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const validTimestamps = latestDates.map(t => new Date(t).getTime()).filter(t => !isNaN(t));
        if (validTimestamps.length === 0) {
          resolve(""); // Resolve with empty if no valid dates
          return;
        }
        const latestTimestamp = new Date(Math.max(...validTimestamps));
        const latest = latestTimestamp.toString() === "Invalid Date" ? "" : latestTimestamp.toISOString();
        resolve(latest);
      })
      .catch(error => {
        if (error.name !== 'AbortError') {
          console.error("Error fetching latest timestamps:", error);
        }
        reject(error); // Propagate the error
      });
  });
}

const PlotRefresh = ({
  tileId, 
  tabId, 
  interfaceId, 
  projectId, 
  pending, 
  tileActions,
  logsActions, 
  projectsActions,
  contextActions,
  fieldsActions
}: {
  tileId: string,
  tabId: string,
  interfaceId: string,
  projectId: string,
  pending: boolean,
  tileActions: GranularTileActions,
  logsActions: LogsActions,
  projectsActions: ProjectsActions,
  contextActions: ContextActions,
  fieldsActions: FieldsActions
}) => {
  // Get access to the tab context and actions with granular access
  const { data: tabDataState } = useTab(tabId, interfaceId);
  
  // Get tileIds from tab data properly
  const tileIds = useMemo(() => tabDataState?.tileIds || [], [tabDataState?.tileIds]);
  // Only subscribe to a subset of the tiles objects to incl. name, type and tableTile only
  const tiles = useTiles(tileIds, ["name", "type"]);
  const tables = useMemo(() => {
    // Only return table names for table tiles
    // Return should be an array of strings only
    return tiles
      .filter(tile => tile.type === "Table")
      .map(tile => tile.name)
      .filter(Boolean) as string[];
  }, [tiles]);

  const { data: tileDataState } = useTileData(tileId, tabId);
  
  const { actions: syncedTileActions } = useTileSync(
    tileId,
    tabId,
    tileActions,
    projectsActions,
    contextActions,
    logsActions,
    fieldsActions
  );
  const syncedTileDataActions = syncedTileActions?.data ?? null;

  const queryClient = useQueryClient();

  // Use the new auto-update hook
  const {
    data: plotDataItem,
    isFetching,
    manualRefresh,
    stop,
    isManualRefresh
  } = usePlotAutoUpdateQuery(
    tileId,
    tabId,
    projectId,
    pending,
    logsActions,
    projectsActions,
    contextActions,
    fieldsActions,
  );

  // Manual refresh UI states (keep the checkmark feedback)
  const [loaded, setLoaded] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [isManualFetching, setIsManualFetching] = useState(false);
  const isMounted = useRef(false);

  // Mount tracking for cleanup
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Show checkmark after manual refresh completes
  const displayLoadCheck = useCallback(() => {
    setLoaded(true);
    const timeoutId = setTimeout(() => {
      if (isMounted.current) {
        setLoaded(false);
      }
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, []);

  // Fetch initial timestamp on mount
  useEffect(() => {
    if (tables.length > 0) {
      // Get plot arguments from cache
      const plotArguments = queryClient.getQueryData<PlotArguments>(["plotArguments", tabId]) || {} as PlotArguments;
      
      fetchLatestTimestamps(tables, plotArguments, projectId, logsActions)
        .then(latestTimestamp => {
          if (isMounted.current) setLastUpdated(latestTimestamp);
        })
        .catch(err => console.error("Failed to get initial latest plot timestamp:", err));
    }
  }, [tables, tabId, projectId, logsActions, queryClient]);

  // Auto-update toggle
  const onAutoClick = () => {
    const nextValue = tileDataState?.auto_update === "true" ? "false" : "true";
    if (nextValue === "false") {
        stop();
    }
    syncedTileDataActions?.setAutoUpdate(nextValue);
    showSuccessToast(
      "Auto-Refresh",
      `Auto-refresh has been ${nextValue === "true" ? "enabled" : "disabled"}.`
    );
  };

  // Simplified manual refresh
  const onManualClick = async () => {
    // If already fetching, show message
    if (isFetching || isManualFetching) {
      showSuccessToast("Already Refreshing", "A refresh is already in progress.");
      return;
    }
    if (tileDataState?.auto_update === "true" || tables.length === 0) return;

    setIsManualFetching(true);

    try {
      await withLoadingToast(
        async () => {
          // Get current plot arguments from cache
          const plotArguments = queryClient.getQueryData<PlotArguments>(["plotArguments", tabId]) || {} as PlotArguments;

          const latestTimestamp = await fetchLatestTimestamps(tables, plotArguments, projectId, logsActions);
          const latestTs = latestTimestamp ? new Date(latestTimestamp).getTime() : 0;
          const lastCheckTs = lastUpdated ? new Date(lastUpdated).getTime() : 0;
          
          if (latestTs > lastCheckTs) {
            // Data has changed, perform the actual refresh
            const result = await manualRefresh();
            if (isMounted.current) {
              setLastUpdated(latestTimestamp);
              displayLoadCheck(); // Show checkmark after successful refresh
            }
            return result;
          } else {
            // Data is already up to date
            return Promise.resolve();
          }
        },
        {
          loading: "Refreshing plot data...",
          success: "Plot data refreshed successfully!",
          error: "Failed to refresh plot data."
        }
      );
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error("Manual refresh error:", error);
      }
    } finally {
      if (isMounted.current) {
        setIsManualFetching(false);
      }
    }
  };

  const isRefreshing = isFetching || isManualFetching;
  const icon = isRefreshing
    ? <RefreshCw className="animate-spin text-green"/> 
    : loaded
    ? <Check className="text-green"/>
    : <RefreshCw/>;

  const manualRefreshButton = (
    <ActionButton 
      className="rounded-sm h-8"
      icon={icon}
      tooltip={isRefreshing ? "Refreshing plot logs.." : tileDataState?.auto_update === "true" ? "Auto refreshing plot logs.." : "Refresh plot logs"}
      onClick={onManualClick}
      disabled={tileDataState?.auto_update === "true"}
    />
  );

  const autoRefresh = (
    <ActionButton 
      variant={tileDataState?.auto_update === "true" ? "primary" : "ghost"}
      className="rounded-sm"
      icon={<Timer />}
      tooltip={"Auto refresh every 5s"}
      onClick={onAutoClick}
    />
  );

  return (
    <div className="flex flex-col">
      {manualRefreshButton}
      {autoRefresh}
    </div>
  );
};

export default PlotRefresh;