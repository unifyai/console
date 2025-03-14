"use client";

import ActionButton from "@/components/Common/Buttons/Action";
import { RefreshCw, Power, Check } from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { ItemType, LogsActions, FieldsActions, TableDataItem, TableDataProps, TileProps } from "@/types/evals/grid";
import { getLogsParameters, GroupedLogProps, LogFieldsProps, LogFieldsResponseProps, LogItemProps, LogsResponseProps } from "@/types/evals/logs";
import { getLogsDetails } from "@/utils/evals/common";
import { ResponseProps } from "@/types/common";
import { LogProps } from "@/types/evals/logs";
import { buildFilterExpression } from "@/utils/evals/filters";

const isGroupedLog = (log: LogProps | GroupedLogProps): log is GroupedLogProps => log.type === "grouped";
const flattenLogs = (logs: (LogProps | GroupedLogProps)[]): LogProps[] => {
    return logs.reduce<LogProps[]>((acc, log) => {
        if (isGroupedLog(log)) {
            return acc.concat(flattenLogs(log.subRows));
        } else {
            return acc.concat(log);
        }
    }, []);
};

const getNewCells = (tableDataItem: TableDataItem, logs: (LogProps | GroupedLogProps)[]): string[] => {
    let newCells: string[] = [];
    const flattenedLogs = flattenLogs(logs);
    if (flattenedLogs.length) {
      const flattenedTableLogs = flattenLogs(tableDataItem.logs)
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

async function updateLogs (
    item: TileProps,
    sortingExpression: string | null,
    groupingExpression: string | null,
    groupSortingExpression: string | null,
    project: string, 
    logsActions: LogsActions, 
    fieldsActions: FieldsActions,
    updateTable: (updateFn: (prev: TableDataProps) => TableDataProps) => void,
    signal?:  AbortSignal
) {
    if (signal?.aborted) return;
    fieldsActions
    .get(project, item.context ?? null)
    .then(async (fields: LogFieldsResponseProps) => {
        const allPrefixes = Object.keys(fields).map(
            key => key.includes("/") ? key.split("/").slice(0, -1).join("/") : null
        ).filter(key => key != null);
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
        logsActions
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
            20, // Hardcoded limit value (20) will need to be passed down from Main
            (item.page_number ? parseInt(item.page_number) : 0) * 20, // Hardcoded limit value (20) will need to be passed down from Main
            groupingExpression ? 0 : null,
            null,
            Date.now().toString()
        )
        .then(async (logsData: LogsResponseProps) => {
            const totalPages = Math.ceil(logsData.count / 16);
            const context = item.context ?? null;
            const column_context = item.column_context ?? null;
            const sorting = item.sorting ?? null;
            const { entriesProperties, paramsProperties, logs, params, metrics, boundaries } = await getLogsDetails(
                item, logsData, fields, context, column_context, project, filterExpression, groupingExpression, item.metric, sorting, undefined, logsActions
            )
            await new Promise<void>(resolve => {
                updateTable(prev => {
                    const newCells = getNewCells(prev[item.i], logs)
                    const newState = {
                        ...prev,
                        [item.i]: {
                            ...prev[item.i],
                            fields,
                            logsData,
                            totalPages,
                            entriesProperties,
                            paramsProperties,
                            logs,
                            params,
                            metrics,
                            boundaries,
                            newCells,
                            columnContexts
                        }
                    };
                    resolve();
                    return newState;
                });
            });
        });
    });
}

const RefreshLogs = ({ item, project, pending, fields, filterExpression, sortingExpression, groupingExpression, groupSortingExpression, hiddenColumns, updateItem, setTableData, logs, logsActions, fieldsActions }: {
    item: TileProps,
    project: string,
    pending: boolean,
    fields: LogFieldsResponseProps,
    filterExpression: string | null,
    sortingExpression: string | null,
    groupingExpression: string | null,
    groupSortingExpression: string | null,
    hiddenColumns: string | undefined,
    updateItem: (item: TileProps, attrName: ItemType) => (newValue: string | undefined) => void,
    setTableData: (updater: (prev: TableDataProps) => TableDataProps) => void,
    logs: LogProps[] | GroupedLogProps[],
    logsActions: LogsActions,
    fieldsActions: FieldsActions
}) => {

    /* Auto refresh */
    // We use timestamp to tag fetch api calls to trigger revalidation every 5 seconds.
    const autoUpdateRef = useRef(item.auto_update === "true");
    const pendingRef = useRef(pending);
    const isMounted = useRef(false);
    const isRunning = useRef(false)
    const abortControllerRef = useRef<AbortController | null>(null);

    // Sync pending and auto update refs 
    useEffect(() => {pendingRef.current = pending}, [pending]);
    useEffect(() => {autoUpdateRef.current = item.auto_update === "true"}, [item.auto_update]);
    
    // Pause auto-update on server action
    useEffect(() => {
        if (item.auto_update === "true") autoUpdateRef.current = false;
    }, [pendingRef.current])

    // Restart streaming after server action ends
    useEffect(() => {
        if (item.auto_update === "true" && !autoUpdateRef.current && !pendingRef.current) autoUpdateRef.current = true;
    }, [autoUpdateRef.current])

    // Track component mount state
    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
            // Abort any ongoing request on unmount
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    // Periodically fetch new logs
    
    // Memoize updateLogs to prevent unnecessary recreations
    const updateLogsCallback = useCallback(async () => {
        if (!isMounted.current || !autoUpdateRef.current || pendingRef.current || isRunning.current) return;

        isRunning.current = true;
        abortControllerRef.current = new AbortController();

        try {
            await updateLogs(
                item,
                sortingExpression,
                groupingExpression,
                groupSortingExpression,
                project,
                logsActions,
                fieldsActions,
                (updateFn) => {
                    if (isMounted.current && autoUpdateRef.current) {
                        setTableData(updateFn);
                    }
                },
                abortControllerRef.current.signal,
            );
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error('Failed to fetch logs:', error);
            }
        } finally {
            isRunning.current = false;
            abortControllerRef.current = null;
        }
    }, [item, project, logsActions, fieldsActions, setTableData, sortingExpression, groupingExpression, groupSortingExpression]);

    // Auto-refresh with recursive timeout
    const fetchWithBackoff = useCallback(async () => {
        if (!isMounted.current || !autoUpdateRef.current) return;
        
        try {
          await updateLogsCallback();
        } finally {
          // Schedule next request only after current completes
          const timeoutId = setTimeout(fetchWithBackoff, 5000);
          return () => clearTimeout(timeoutId);
        }
      }, [updateLogsCallback]);
      
      useEffect(() => {
        if (autoUpdateRef.current) {
          fetchWithBackoff();
        }
    }, [fetchWithBackoff]);

    const onAutoClick = () => updateItem(item, "auto_update")(item.auto_update === "true" ? "false" : "true")
    const autoRefresh =
        <ActionButton
            variant={item.auto_update === "true" ? "primary" : "outline"}
            className="rounded-none rounded-tr-lg rounded-br-lg"
            icon={<Power />}
            tooltip={item.grouping != undefined ? "Auto refresh doesn't work with grouping" : "Auto refresh every 5s"}
            onClick={() => onAutoClick()}
            disabled={item.grouping != undefined}
        />

    /* Manual refresh */

    // Display loader when data updates
    const [refreshClick, setRefreshClick] = useState(false);    // To avoid displaying the check icon when data updates from elsewhere
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const displayLoadCheck = () => {
        setLoading(false);
        setRefreshClick(false);
        setLoaded(true);
        const timeoutId = setTimeout(() => {
            setLoaded(false);
        }, 2000);
        return () => {
            clearTimeout(timeoutId);
        };
    }
    useEffect(() => {
        if (refreshClick) displayLoadCheck();
    }, [logs]);

    // We compare the timestamp string returned from the get latest timestamp endpoint
    // with the timestamp saved last time the refresh button was used, except the first
    // time where we compare with the timestamp set on loading the component
    const [lastUpdated, setLastUpdated] = useState<string>("")

    useEffect(() => { logsActions.getLatest(project, item.context ?? null, item.column_context ?? null, filterExpression, sortingExpression, groupingExpression, groupSortingExpression, null, null, null, null, null, null).then(latest => setLastUpdated(latest)) }, [])

    const onManualClick = () => {
        setLoading(true);
        setRefreshClick(true);
        logsActions.getLatest(project, item.context ?? null, item.column_context ?? null, filterExpression, sortingExpression, groupingExpression, groupSortingExpression, null, null, null, null, null, null).then(latest => {
            const latestTs = new Date(latest).getTime();
            const lastCheckTs = new Date(lastUpdated).getTime();
            if (latestTs > lastCheckTs) {
                updateLogs(item, sortingExpression, groupingExpression, groupSortingExpression, project, logsActions, fieldsActions, setTableData).then(() => {
                    setLastUpdated(latest)
                });
            } else {
                displayLoadCheck();
            }
        });
    }

    const icon = loading || item.auto_update === "true"
    ? <RefreshCw className="animate-spin text-green"/> 
    : loaded
        ?   <Check className="text-green"/>
        :   <RefreshCw/>
    const manualRefresh = <ActionButton 
        variant="outline"
        className="rounded-none rounded-tl-lg rounded-bl-lg h-8"
        icon={icon}
        tooltip={loading ? "Refreshing logs.." : item.grouping != undefined ? "Manual refresh doesn't work with grouping" : item.auto_update === "true" ? "Auto refreshing logs.." : "Refresh logs"}
        onClick={() => onManualClick()}
        disabled={loading || item.grouping != undefined || item.auto_update === "true"}
    />

    return (
        <div className="flex flex-row">
            {manualRefresh}
            {autoRefresh}
        </div>
    );
}

export default RefreshLogs;
