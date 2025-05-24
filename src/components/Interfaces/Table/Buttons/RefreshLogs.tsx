"use client";
import ActionButton from "@/components/Common/Buttons/Action";
import { RefreshCw, Power, Check } from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { LogsActions, FieldsActions, ProjectsActions, ContextActions, GranularTileActions } from "@/types/evals/grid";
import { useTableAutoUpdateQuery } from "@/hooks/Query/useTableAutoUpdateQuery";
import { useTileData } from "@/contexts/hooks/tile/useTileData";
import { useTileSync } from "@/contexts/hooks/tile/sync";

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
  const { isFetching, manualRefresh } = useTableAutoUpdateQuery(
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
  const [refreshClick, setRefreshClick] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");
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
    setLoading(false);
    setRefreshClick(false);
    setLoaded(true);
    const timeoutId = setTimeout(() => {
      if (isMounted.current) {
        setLoaded(false);
      }
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, []);

  // Effect to show checkmark after manual refresh
  useEffect(() => {
    if (refreshClick && !loading) {
      const cleanup = displayLoadCheck();
      return cleanup;
    }
  }, [refreshClick, loading, displayLoadCheck]);

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
        null, null, null, null, null, null, null
      )
      .then(latest => {
        if (isMounted.current) setLastUpdated(latest);
      })
      .catch(err => console.error("Failed to get initial latest timestamp:", err));
  }, [projectId, tileDataState?.context, tileDataState?.column_context, filterExpression, sortingExpression, groupingExpression, groupSortingExpression, logsActions]);

  // Auto-update toggle
  const onAutoClick = () => {
    const nextValue = tileDataState?.auto_update === "true" ? "false" : "true";
    syncedTileDataActions?.setAutoUpdate(nextValue);
  };

  // Manual refresh with timestamp checking
  const onManualClick = () => {
    if (loading || isFetching || tileDataState?.auto_update === "true") return;

    setLoading(true);
    setRefreshClick(true);

    if (!tileDataState) {
      setLoading(false);
      return;
    }

    logsActions.getLatest(
      projectId, 
      tileDataState.context || null, 
      tileDataState.column_context || null, 
      filterExpression, 
      sortingExpression, 
      groupingExpression, 
      groupSortingExpression, 
      null, null, null, null, null, null, null
    )
    .then(latest => {
      const latestTs = new Date(latest).getTime();
      const lastCheckTs = lastUpdated ? new Date(lastUpdated).getTime() : 0;

      if (latestTs > lastCheckTs) {
        // Data has changed, perform the actual refresh
        return manualRefresh().then(() => {
          if (isMounted.current) setLastUpdated(latest);
        });
      } else {
        // No new data, just show the checkmark
        return Promise.resolve();
      }
    })
    .catch(error => {
      console.error("Failed to check latest timestamp or update:", error);
    })
    .finally(() => {
      if (isMounted.current) {
        setLoading(false);
      }
    });
  };

  const icon = loading || isFetching || tileDataState?.auto_update === "true"
    ? <RefreshCw className="animate-spin text-green"/> 
    : loaded
    ? <Check className="text-green"/>
    : <RefreshCw/>;

  const manualRefreshButton = (
    <ActionButton 
      variant="outline"
      className="rounded-none rounded-tl-lg rounded-bl-lg h-8"
      icon={icon}
      tooltip={loading || isFetching ? "Refreshing logs.." : tileDataState?.auto_update === "true" ? "Auto refreshing logs.." : "Refresh logs"}
      onClick={onManualClick}
      disabled={loading || isFetching || tileDataState?.auto_update === "true"}
    />
  );

  const autoRefresh = (
    <ActionButton 
      variant={tileDataState?.auto_update === "true" ? "primary" : "outline"} 
      className="rounded-none rounded-tr-lg rounded-br-lg" 
      icon={<Power />} 
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