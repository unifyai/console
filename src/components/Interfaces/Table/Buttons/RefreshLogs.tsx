"use client";
import ActionButton from "@/components/Common/Buttons/Action";
import { RefreshCw, Power, Check } from "lucide-react";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { LogsActions, FieldsActions, TableDataItem, TileProps } from "@/types/evals/grid";
import { GroupedLogProps, LogFieldsResponseProps, LogItemProps, LogsResponseProps } from "@/types/evals/logs";
import { getLogsDetails } from "@/utils/evals/common";
import { LogProps } from "@/types/evals/logs";
import { buildFilterExpression } from "@/utils/evals/filters";
import { useTileItem } from "@/contexts/hooks/tile/useTileItem";
import { useTile } from "@/contexts/hooks/tile/useTile";
import { maybeFlattenGroupedLogs } from "@/utils/evals/grouping";

const getNewCells = (tableDataItem: TableDataItem, logs: LogProps[] | GroupedLogProps[]): string[] => {
    let newCells: string[] = [];
    const flattenedLogs = maybeFlattenGroupedLogs(logs);
    if (flattenedLogs.length) {
        const flattenedTableLogs = maybeFlattenGroupedLogs(tableDataItem.logs)
        const previousCells = flattenedTableLogs.flatMap(log => {
            const entryCells = Object.keys(log.entries as LogItemProps).map(key => `${log.id}_${key}`);
            const paramCells = Object.keys(log.params as LogItemProps).map(key => `${log.id}_${key}`);
            return entryCells.concat(paramCells);
        });
        newCells = flattenedLogs.flatMap(log => {
            const entryCells = Object.keys(log.entries as LogItemProps).map(key => `${log.id}_${key}`);
            const paramCells = Object.keys(log.params as LogItemProps).map(key => `${log.id}_${key}`);
            return entryCells.concat(paramCells);
        });
        newCells = newCells.filter(id => !previousCells.includes(id));
    }
    return newCells;
};

function updateLogs(
    item: TileProps,
    sortingExpression: string | null,
    groupingExpression: string | null,
    groupSortingExpression: string | null,
    limit: number,
    offset: number,
    project: string,
    logsActions: LogsActions,
    fieldsActions: FieldsActions,
    updateTableDataItem: (updater?: (prev: TableDataItem) => TableDataItem, partialUpdates?: Partial<TableDataItem>, merge?: boolean) => void,
    signal?: AbortSignal
): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
        fieldsActions
            .get(project, item.context ?? null)
            .then(fields => {
                if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
                const allPrefixes = Object.keys(fields).map(key => key.includes("/") ? key.split("/").slice(0, -1).join("/") : null).filter(key => key != null);
                const columnContexts = Array.from(
                    new Set(allPrefixes.map(prefix => {
                        const parts = prefix.split("/");
                        let context = "";
                        return parts.map(part => {
                            context += part + "/";
                            return context;
                        });
                    }).flat().sort())
                );
                const filterExpression = buildFilterExpression(item.filters, item.common_filter, item.column_context, item.freeze, fields)
                return logsActions
                .get(
                    project,
                    item.context ?? null,
                    item.column_context ?? null,
                    filterExpression,
                    sortingExpression,
                    groupingExpression,
                    groupSortingExpression,
                    null,
                    null,
                    limit,
                    offset,
                    groupingExpression ? 0 : null,
                    null,
                    Date.now().toString()
                ).then(logsData => ({ 
                    fields, 
                    logsData, 
                    columnContexts, 
                    filterExpression 
                }));
            })
            .then(({ fields, logsData, columnContexts, filterExpression }) => {
                if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
                const context = item.context ?? null;
                const column_context = item.column_context ?? null;
                const sorting = item.sorting ?? null;
                return getLogsDetails(item, logsData, fields, context, column_context, project, filterExpression, groupingExpression, item.metric, sorting, undefined, logsActions).then(details => ({ ...details, fields, logsData, columnContexts })); // Pass details and previous data
            })
            .then(({ entriesProperties, paramsProperties, logs, params, metrics, boundaries, fields, logsData, columnContexts }) => {
                if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
                return new Promise<void>(resolveUpdate => {
                    updateTableDataItem((prev: TableDataItem) => {
                        const newCells = getNewCells(prev, logs)
                        const newState = {
                            ...prev,
                            fields,
                            logsData,
                            totalPages: Math.ceil(logsData.count / limit),
                            entriesProperties,
                            paramsProperties,
                            logs,
                            params,
                            metrics,
                            boundaries,
                            newCells,
                            columnContexts
                        };
                        resolveUpdate(); // Resolve the inner promise once state update is queued
                        return newState;
                    });
                });
            })
            .then(resolve) // Resolve the main promise when everything is done
            .catch(error => {
                if (error.name !== 'AbortError') {
                    console.error('Failed to update logs:', error);
                }
                reject(error); // Reject the main promise
            });
    });
}

const RefreshLogs = ({ tileId, tabId, interfaceId, projectId, pending, fields, filterExpression, sortingExpression, groupingExpression, groupSortingExpression, hiddenColumns, updateTableDataItem, logs, logsActions, fieldsActions }: {
    tileId: string,
    tabId: string,
    interfaceId: string,
    projectId: string,
    pending: boolean,
    fields: LogFieldsResponseProps,
    filterExpression: string | null,
    sortingExpression: string | null,
    groupingExpression: string | null,
    groupSortingExpression: string | null,
    hiddenColumns: string | undefined,
    updateTableDataItem: (updater?: (prev: TableDataItem) => TableDataItem, partialUpdates?: Partial<TableDataItem>, merge?: boolean) => void,
    logs: LogProps[] | GroupedLogProps[],
    logsActions: LogsActions,
    fieldsActions: FieldsActions
}) => {
    const { itemActions } = useTileItem(tileId, tabId, interfaceId);
    const item = useMemo(() => itemActions?.asTileItem(), [itemActions]);
    const { tableTile: tableTileState, dataActions: tileDataActions } = useTile(tileId, tabId, interfaceId, projectId);
    const limit = tableTileState?.limit as number;
    const offset = tableTileState?.offset as number;

    /* Auto refresh */
    const autoUpdateRef = useRef(item?.auto_update === "true");
    const pendingRef = useRef(pending);
    const isMounted = useRef(false);
    const isRunning = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const timeoutIdRef = useRef<NodeJS.Timeout | null>(null); // Ref to store timeout ID

    // Sync pending and auto update refs 
    useEffect(() => { pendingRef.current = pending }, [pending]);
    useEffect(() => { autoUpdateRef.current = item?.auto_update === "true" }, [item?.auto_update]);

    // Pause auto-update on server action
    useEffect(() => {
        if (pendingRef.current && item?.auto_update === "true") {
            // If a fetch was running, abort it
             if (abortControllerRef.current) {
                 abortControllerRef.current.abort();
                 abortControllerRef.current = null; // Clear the ref
             }
             // Clear any scheduled timeout
             if (timeoutIdRef.current) {
                 clearTimeout(timeoutIdRef.current);
                 timeoutIdRef.current = null;
             }
        }
    }, [pendingRef.current, item?.auto_update]);


    // Track component mount state and cleanup
    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            if (timeoutIdRef.current) {
                clearTimeout(timeoutIdRef.current);
            }
        };
    }, []);

    // Periodically fetch new logs
    const runFetch = useCallback(() => {
        if (!isMounted.current || !autoUpdateRef.current || pendingRef.current || isRunning.current) return; // Don't fetch if not mounted, auto-update off, pending, or already running

        isRunning.current = true;
        abortControllerRef.current = new AbortController();
        const currentSignal = abortControllerRef.current.signal;

        updateLogs(
            item as TileProps,
            sortingExpression,
            groupingExpression,
            groupSortingExpression,
            limit,
            offset,
            projectId,
            logsActions,
            fieldsActions,
            (updateFn, partialUpdates, merge) => { 
                if (isMounted.current && autoUpdateRef.current && !currentSignal.aborted) {
                    updateTableDataItem(updateFn, partialUpdates, merge);
                 }
            },
            currentSignal
        )
        .catch(error => {
            // Error is already logged in updateLogs, handle AbortError silently
            if (error.name !== 'AbortError') {
                console.error("Fetch run failed:", error);
            }
        })
        .finally(() => {
             isRunning.current = false;
             abortControllerRef.current = null; // Clear controller ref

             // Schedule the next fetch *only if* still mounted and auto-update is on
             if (isMounted.current && autoUpdateRef.current && !pendingRef.current) {
                 // Clear previous timeout just in case (belt and suspenders)
                 if (timeoutIdRef.current) {
                     clearTimeout(timeoutIdRef.current);
                 }
                 // Schedule next run
                 timeoutIdRef.current = setTimeout(runFetch, 5000);
             }
        });

    }, [item, projectId, logsActions, fieldsActions, updateTableDataItem, sortingExpression, groupingExpression, groupSortingExpression, limit, offset]); // Dependencies for the fetch logic

    // Effect to start/stop the fetching loop
    useEffect(() => {
        if (autoUpdateRef.current && !pendingRef.current && isMounted.current) {
            // Start the fetch loop if auto-update is on and not pending
            runFetch();
        } else {
             // If auto-update turned off or component unmounted, clear any pending timeout
             if (timeoutIdRef.current) {
                 clearTimeout(timeoutIdRef.current);
                 timeoutIdRef.current = null;
             }
             // If a fetch was running, abort it
             if (abortControllerRef.current) {
                 abortControllerRef.current.abort();
                 abortControllerRef.current = null; // Clear the ref
                 isRunning.current = false; // Ensure running state is reset
             }
        }

        // Cleanup function for this effect: clear timeout when dependencies change
        // or component unmounts (redundant with mount cleanup, but safe)
        return () => {
            if (timeoutIdRef.current) {
                clearTimeout(timeoutIdRef.current);
            }
             // Don't abort here if just dependencies change, only if autoUpdate turns off
             // The main cleanup handles unmount.
        };
    }, [autoUpdateRef.current, pendingRef.current, runFetch]); // Rerun effect if autoUpdate, pending state, or the fetch function changes


    const onAutoClick = () => {
        const nextValue = item?.auto_update === "true" ? "false" : "true";
        tileDataActions?.setAutoUpdate(nextValue);
    }

    const autoRefresh = <ActionButton variant={item?.auto_update === "true" ? "primary" : "outline"} className="rounded-none rounded-tr-lg rounded-br-lg" icon={<Power />} tooltip={"Auto refresh every 5s"} onClick={onAutoClick} />;

    /* Manual refresh */
    const [refreshClick, setRefreshClick] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<string>("");
    const displayLoadCheck = useCallback(() => {
        setLoading(false);
        setRefreshClick(false);
        setLoaded(true);
        const timeoutId = setTimeout(() => {
            if (isMounted.current) { // Check mount status before setting state
                 setLoaded(false);
             }
        }, 2000);
        return () => clearTimeout(timeoutId);
    }, []);


    useEffect(() => {
        if (refreshClick && !loading) { // Trigger checkmark only when loading finishes
            const cleanup = displayLoadCheck();
            return cleanup;
         }
    }, [refreshClick, loading, displayLoadCheck]); // Depend on loading state change

    // Fetch initial timestamp
    useEffect(() => {
        logsActions
            .getLatest(projectId, item?.context ?? null, item?.column_context ?? null, filterExpression, sortingExpression, groupingExpression, groupSortingExpression, null, null, null, null, null, null)
            .then(latest => {
                if (isMounted.current) setLastUpdated(latest);
            })
            .catch(err => console.error("Failed to get initial latest timestamp:", err));
    }, [projectId, item?.context, item?.column_context, filterExpression, sortingExpression, groupingExpression, groupSortingExpression, logsActions]); // Dependencies for initial fetch


    const onManualClick = () => {
        if (loading || item?.auto_update === "true") return; // Prevent multiple clicks or clicking while auto-refreshing

        setLoading(true);
        setRefreshClick(true); // Indicate manual refresh was initiated

        logsActions.getLatest(projectId, item?.context ?? null, item?.column_context ?? null, filterExpression, sortingExpression, groupingExpression, groupSortingExpression, null, null, null, null, null, null)
            .then(latest => {
                const latestTs = new Date(latest).getTime();
                const lastCheckTs = lastUpdated ? new Date(lastUpdated).getTime() : 0; // Handle initial empty state

                if (latestTs > lastCheckTs) {
                    // Data has changed, perform the update
                    // Use a dedicated AbortController for manual refresh
                    const manualAbortController = new AbortController();
                    return updateLogs(item as TileProps, sortingExpression, groupingExpression, groupSortingExpression, limit, offset, projectId, logsActions, fieldsActions, updateTableDataItem, manualAbortController.signal)
                    .then(() => {
                        if (isMounted.current) setLastUpdated(latest); // Update timestamp on successful fetch
                    })
                    .catch(error => {
                         if (error.name !== 'AbortError') {
                             console.error("Manual refresh update failed:", error);
                         }
                     })
                    .finally(() => {
                        if (isMounted.current) {
                          //  setLoading(false); // Set loading false, which triggers the useEffect for the checkmark displayLoadCheck will handle the rest
                         }
                    });
                } else {
                    // No new data, just show the checkmark sequence immediately
                    if (isMounted.current) {
                        // setLoading(false); // Set loading false to trigger checkmark effect displayLoadCheck will handle the rest
                     }
                    return Promise.resolve(); // Return a resolved promise
                }
            })
             .catch(error => {
                 console.error("Failed to check latest timestamp or update:", error);
                 if (isMounted.current) {
                    // setLoading(false); // Ensure loading is false on error
                 }
             })
             .finally(() => {
                // This ensures loading is set to false regardless of whether
                // data was fetched or an error occurred (except AbortError which is handled)
                // Setting loading to false will trigger the useEffect for displayLoadCheck
                if (isMounted.current) {
                    setLoading(false);
                }
             });
    }

    const icon = loading || item?.auto_update === "true"
    ? <RefreshCw className="animate-spin text-green"/> 
    : loaded
        ?   <Check className="text-green"/>
        :   <RefreshCw/>
    const manualRefresh = <ActionButton 
        variant="outline"
        className="rounded-none rounded-tl-lg rounded-bl-lg h-8"
        icon={icon}
        tooltip={loading ? "Refreshing logs.." : item?.auto_update === "true" ? "Auto refreshing logs.." : "Refresh logs"}
        onClick={() => onManualClick()}
        disabled={loading || item?.auto_update === "true"}
    />

    return (
        <div className="flex flex-row">
            {manualRefresh}
            {autoRefresh}
        </div>
    );
}

export default RefreshLogs;