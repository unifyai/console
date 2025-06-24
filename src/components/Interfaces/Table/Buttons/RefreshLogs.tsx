"use client";
import ActionButton from "@/components/Common/Buttons/Action";
import { RefreshCw, Timer, Check } from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { LogsActions, FieldsActions, ProjectsActions, ContextActions, GranularTileActions } from "@/types/evals/grid";
import { useTableAutoUpdateQuery } from "@/hooks/Query/useTableAutoUpdateQuery";
import { useTileData } from "@/contexts/hooks/tile/useTileData";
import { useTileSync } from "@/contexts/hooks/tile/sync";
import { showErrorToast, showSuccessToast } from "@/components/notifications";
import { withLoadingToast } from "@/components/notifications";

const RefreshLogs = ({ 
  tileId, 
  tabId, 
  projectId,
  pending,
  filterExpression,
  sortingExpression,
  groupingExpression,
  groupSortingExpression,
  tileActions,
  logsActions, 
  projectsActions,
  contextActions,
  fieldsActions 
}: {
  tileId: string,
  tabId: string,
  projectId: string,
  pending: boolean,
  filterExpression: string | null,
  sortingExpression: string | null,
  groupingExpression: string | null,
  groupSortingExpression: string | null,
  tileActions: GranularTileActions,
  logsActions: LogsActions,
  projectsActions: ProjectsActions,
  contextActions: ContextActions,
  fieldsActions: FieldsActions
}) => {
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

  const pendingRef = useRef(pending);

  // Sync pending ref 
  useEffect(() => { pendingRef.current = pending }, [pending]);
  
  // Use the new auto-update hook
  const { isFetching, manualRefresh, stop, isManualRefresh } = useTableAutoUpdateQuery(
    tileId,
    tabId,
    projectId,
    pendingRef.current,
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
    if (!tileDataState) return;

    logsActions
      .getLatest(
        projectId, 
        tileDataState.context || null, 
        tileDataState.column_context || null, 
        filterExpression, 
        sortingExpression, 
        groupingExpression, 
        groupSortingExpression,
        null, null, null, null, null, null, null, null, null
      )
      .then(latest => {
        if (isMounted.current) setLastUpdated(latest);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          showErrorToast(err, "Failed to get initial latest timestamp.");
        }
      });
  }, [projectId, tileDataState, filterExpression, sortingExpression, groupingExpression, groupSortingExpression, logsActions]);

  // Auto-update toggle
  const onAutoClick = () => {
    const nextValue = tileDataState?.auto_update === "true" ? "false" : "true";
    if (nextValue === "false") {
        stop();
    }
    syncedTileDataActions?.setAutoUpdate(nextValue);
    showSuccessToast(
      "Auto-Refresh",
      `Table will ${nextValue === "true" ? "now" : "no longer"} auto-refresh.`
    );
  };

  // Simplified manual refresh
  const onManualClick = async () => {
    // If already fetching, show message
    if (isFetching || isManualFetching) {
      showSuccessToast("Already Refreshing", "A refresh is already in progress.");
      return;
    }

    setIsManualFetching(true);
    
    try {
      await withLoadingToast(
        async () => {
          // Get latest timestamp first
          const latest = await logsActions.getLatest(
            projectId,
            tileDataState?.context || null,
            tileDataState?.column_context || null,
            filterExpression,
            sortingExpression,
            groupingExpression,
            groupSortingExpression,
            null, null, null, null, null, null, null, null, null
          );

          const latestTs = new Date(latest).getTime();
          const lastCheckTs = lastUpdated ? new Date(lastUpdated).getTime() : 0;

          if (latestTs >= lastCheckTs) {
            // Do the actual refresh
            const result = await manualRefresh();
            
            if (isMounted.current) {
              setLastUpdated(latest);
              displayLoadCheck();
            }
            
            return result;
          } else {
            // Data is already up to date
            return Promise.resolve();
          }
        },
        {
          loading: "Refreshing logs...",
          success: "Logs refreshed successfully!",
          error: "Failed to refresh logs."
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
  const icon = isRefreshing ? <RefreshCw className="animate-spin text-green"/> 
    : loaded
    ? <Check className="text-green"/>
    : <RefreshCw/>;

  const manualRefreshButton = (
    <ActionButton 
      variant="outline"
      className="rounded-none rounded-tl-lg rounded-bl-lg h-8"
      icon={icon}
      tooltip={isRefreshing ? "Refreshing logs.." : "Refresh logs"}
      onClick={onManualClick}
      disabled={tileDataState?.auto_update === "true"}
    />
  );

  const autoRefresh = (
    <ActionButton 
      variant={tileDataState?.auto_update === "true" ? "primary" : "outline"} 
      className="rounded-none rounded-tr-lg rounded-br-lg" 
      icon={<Timer />} 
      tooltip={"Auto refresh every 5s"} 
      onClick={onAutoClick} 
    />
  );

  return (
    <div className="flex flex-row">
      {manualRefreshButton}
      {autoRefresh}
    </div>
  );
};

export default RefreshLogs;