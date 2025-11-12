"use client";
import ActionButton from "@/components/Common/Buttons/Action";
import { RefreshCw, Timer, Check } from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { LogsActions, FieldsActions, ProjectsActions, ContextActions, GranularTileActions } from "@/types/interfaces/grid";
import { useTableAutoUpdateQuery } from "@/hooks/Interfaces/Query/useTableAutoUpdateQuery";
import { useTileData } from "@/contexts/hooks/tile/useTileData";
import { useTileSync } from "@/contexts/hooks/tile/sync";
import { showErrorToast, showSuccessToast, withLoadingToastFn } from "@/components/Common/Toasts/notifications";

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

  // Helper: fetch latest timestamp via client API route (avoids server-action POST /interfaces)
  const fetchLatestTimestamp = useCallback(async (): Promise<string> => {
    if (!tileDataState) return "";
    const params = new URLSearchParams();
    params.set('project', projectId);
    if (tileDataState.context) params.set('context', tileDataState.context);
    if (tileDataState.column_context) params.set('column_context', tileDataState.column_context);
    if (filterExpression) params.set('filter_expr', filterExpression);
    if (sortingExpression) params.set('sorting', sortingExpression);
    if (groupingExpression) {
      groupingExpression.split(',').forEach(expr => params.append('group_by', expr.trim()));
    }
    if (groupSortingExpression) params.set('group_sorting', groupSortingExpression);

    const res = await fetch(`/api/logs/latest_timestamp?${params.toString()}`, { method: 'GET', cache: 'no-store' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ detail: `Latest timestamp ${res.status}` }));
      throw new Error(data.detail || `Failed to get latest timestamp: ${res.status}`);
    }
    return res.text();
  }, [projectId, tileDataState, filterExpression, sortingExpression, groupingExpression, groupSortingExpression]);

  // Fetch initial timestamp on mount ONLY when auto-update is enabled
  const didInitLatestRef = useRef(false);
  useEffect(() => {
    if (!tileDataState) return;
    if (tileDataState.auto_update !== "true") return; // gate behind live mode
    if (didInitLatestRef.current) return; // avoid Strict Mode double-run
    didInitLatestRef.current = true;
    fetchLatestTimestamp()
      .then((latest) => {
        if (isMounted.current && latest && !(latest as any).detail) {
          setLastUpdated(latest);
        }
      })
      .catch(err => {
        if ((err as any)?.name !== 'AbortError') {
          showErrorToast(err, "Failed to get initial latest timestamp.");
        }
      });
  }, [fetchLatestTimestamp, tileDataState]);

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
      await withLoadingToastFn(
        async () => {
          // Get latest timestamp first
          let latest: string;
          try {
            latest = await fetchLatestTimestamp();
          } catch (err: any) {
            const message = (err && typeof err === 'object' && 'message' in err) ? (err as Error).message : String(err);
            if (/Context '.*' not found/i.test(message) || /context .* not found/i.test(message)) {
              if (syncedTileDataActions) {
                showSuccessToast("Context not found", "Opening table without context.");
                await syncedTileDataActions.setContext(undefined);
              }
              return;
            }
            throw err;
          }

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
          loadingMessage: "Refreshing logs...",
          successMessage: "Logs refreshed successfully!",
          errorMessage: "Failed to refresh logs."
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

  const isAutoUpdating = tileDataState?.auto_update === "true";
  const isManualSpinning = isFetching || isManualFetching;

  const getIcon = () => {
    if (isAutoUpdating) {
      return <RefreshCw className="animate-spin text-green" />;
    }
    if (isManualSpinning) {
      return <RefreshCw className="animate-spin text-green" />;
    }
    if (loaded) {
      return <Check className="text-green" />;
    }
    return <RefreshCw />;
  };
  
  const icon = getIcon();

  const manualRefreshButton = (
    <ActionButton 
      variant="outline"
      className="rounded-lg h-8"
      icon={icon}
      tooltip={isAutoUpdating ? "Auto-refreshing..." : isManualSpinning ? "Refreshing logs..." : "Refresh logs"}
      onClick={onManualClick}
      disabled={isAutoUpdating}
    />
  );

  const autoRefresh = (
    <ActionButton 
      variant={isAutoUpdating ? "primary" : "outline"} 
      className="rounded-lg" 
      icon={<Timer />} 
      tooltip={"Auto refresh every 5s"} 
      onClick={onAutoClick} 
    />
  );

  return (
    <div className="flex flex-row gap-2">
      {manualRefreshButton}
      {autoRefresh}
    </div>
  );
};

export default RefreshLogs;