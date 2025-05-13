"use client";
import ActionButton from "@/components/Common/Buttons/Action";
import { RefreshCw, Power, Check } from "lucide-react";
import { Dispatch, SetStateAction, useEffect, useState, useRef, useCallback, useMemo } from "react";
import { TileProps, LogsActions, FieldsActions, PlotDataItem } from "@/types/evals/grid";
import { PlotsArguments, LogFieldsResponseProps, LogsResponseProps, GroupedMetrics, LogProps } from "@/types/evals/logs"; // Added LogProps
import { replaceParamsIndicesWithValues, convertMetricsToLogs } from "@/utils/evals/common";
import { processContext } from "@/utils/evals/columnOperations";
import { buildFilterExpression } from "@/utils/evals/filters";
import { useTileItem } from "@/contexts/hooks/tile/useTileItem";
import { useTab } from "@/contexts/hooks/tab/useTab";
import { useTiles } from "@/contexts/hooks/useStore";
import { useTile } from "@/contexts/hooks/tile/useTile";

function fetchLatestTimestamps(tables: string[], args: PlotsArguments, project: string, logsActions: LogsActions, signal?: AbortSignal): Promise<string> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
        const promises = tables.map(table => {
            const tableArgs = args[table];
            const tableContext = tableArgs?.["context"] ?? null;
            const tableColumnContext = tableArgs?.["column_context"] ?? null;
            const tableFilters = tableArgs?.["filters"] ?? null;
            const tableSubset = tableArgs?.["subset"] ?? null;
            return logsActions.getLatest(project, tableContext, tableColumnContext, tableFilters, null, null, null, tableSubset, null, null, null, null, null);
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

const mergePlotData = (plotData_: {[x: string]: { plotLogs: LogProps[] }}) => {
    let mergedPlotData : {plotLogs: LogProps[]} = {plotLogs: []}
    if (plotData_ && Object.values(plotData_).length && Object.values(plotData_)[0]?.plotLogs) {
        const logArrays = Object.values(plotData_).map(data => data.plotLogs || []);
        if (logArrays.every(arr => arr.length > 0)) {
             const minLogLength = Math.min(...logArrays.map(data => data.length));
             if (minLogLength > 0) {
                 const plotLogs = Array.from({ length: minLogLength }).map((_, i) => {
                     return Object.entries(plotData_).reduce((acc, [tableId, data]) => {
                         const logEntry = data.plotLogs?.[i];
                         if (!logEntry) return acc; // Skip if log entry missing for this index
                         const prefixedLog = Object.fromEntries(
                             Object.entries(logEntry).map(([key, value]) => [
                                 `${tableId}.${key}`,
                                 (["params", "entries", "derived_entries"].includes(key) && value)
                                     ? Object.fromEntries(Object.entries(value).map(([k, v]) => [`${tableId}.${k}`, v]))
                                     : value
                             ])
                         );
                         return { ...acc, ...prefixedLog };
                     }, {}) as LogProps;
                 });
                 mergedPlotData = { plotLogs };
             }
        }
    }
    return mergedPlotData;
}

function fetchAndMergeFields (tables: string[], args: PlotsArguments, project: string, fieldsActions: FieldsActions, signal?: AbortSignal): Promise<LogFieldsResponseProps> {
     return new Promise((resolve, reject) => {
         if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
         const fieldPromises = tables.map(table => {
             const tableArgs = args[table];
             const tableContext = tableArgs?.["context"] ?? null;
             return fieldsActions
                .get(project, tableContext)
                .then(fields => {
                    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
                    const tableColumnContext = tableArgs?.["column_context"] ?? null;
                    const newFields = Object.fromEntries(
                        Object
                            .entries(fields)
                            .filter(([name, _]) => tableColumnContext ? name.startsWith(tableColumnContext) : name)
                            .map(([name, { data_type, field_type, artifacts }]) => {
                                const newName = tableColumnContext ? processContext("split", tableColumnContext, name) : name;
                                return [`${table}.${newName}`, { data_type, field_type, artifacts }];
                            })
                    );
                    return newFields; // Return processed fields for this table
                });
        });
        Promise.all(fieldPromises)
            .then(plotFieldsArray => {
                if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
                const plotFields = plotFieldsArray.reduce((acc, curr) => ({ ...acc, ...curr }), {});
                resolve(plotFields);
            })
            .catch(error => {
                if (error.name !== 'AbortError') {
                    console.error("Error fetching and merging fields:", error);
                }
                reject(error);
            });
     });
}

function fetchAndMergeLogs (tables: string[], item: TileProps | undefined, args: PlotsArguments, project: string, logsActions: LogsActions, plotFields: LogFieldsResponseProps, signal?: AbortSignal): Promise<LogProps[]> {
     return new Promise((resolve, reject) => {
         if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
         const dataPromises = tables.map(table => {
             const tableArgs = args[table];
             const tableContext = tableArgs?.["context"] ?? null;
             const tableColumnContext = tableArgs?.["column_context"] ?? null;
             const tableFields = Object.fromEntries(Object.entries(plotFields).filter(([field, _]) => field.startsWith(table)).map(([field, attributes]) => [field.split(".").slice(1).join("."), attributes]));
             const tableFilters = tableArgs ? buildFilterExpression(tableArgs["column_filters"], tableArgs["common_filter"], tableArgs["column_context"], tableArgs["freeze"], tableFields) : null;
             const tableSubset = tableArgs?.["subset"] ?? null;
             const tableGrouping = tableArgs?.["grouping"] ?? null;
             const tableMetric = tableArgs?.["metric"] ?? "mean";

             let fetchDataPromise: Promise<LogProps[]>;

             const aggregatePath = item?.plot_aggregate?.split(".");
             if (
                (aggregatePath && aggregatePath.length > 1) 
                && aggregatePath[0] === table 
                && tableGrouping 
                && tableSubset
            ) {
                 const groupFieldsArray = tableGrouping.split(",");
                 const aggregateFieldIndex = groupFieldsArray.indexOf(aggregatePath[1]);
                 if (aggregateFieldIndex !== -1) {
                     const groupFields = groupFieldsArray.slice(0, aggregateFieldIndex + 1).join(",");
                     fetchDataPromise = logsActions
                        .getMetrics(project, tableContext, tableFilters, groupFields, tableMetric, tableSubset.split("&"))
                        .then(metrics => {
                            if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
                            return convertMetricsToLogs(groupFields.split(","), tableMetric, tableFields, metrics as GroupedMetrics);
                        });
                 } else {
                     fetchDataPromise = logsActions
                        .get(project, tableContext, tableColumnContext, tableFilters, null, null, null, tableSubset, null, null, null, null, null, Date.now().toString())
                        .then(rawData => {
                            if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
                            return replaceParamsIndicesWithValues(rawData).logs as LogProps[];
                        });
                 }
            } else {
                 fetchDataPromise = logsActions
                    .get(project, tableContext, tableColumnContext, tableFilters, null, null, null, tableSubset, null, null, null, null, null, Date.now().toString())
                    .then(rawData => {
                        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
                        return replaceParamsIndicesWithValues(rawData).logs as LogProps[];
                    });
            }

             // Return a promise that resolves to { table: string, plotLogs: LogProps[] }
             return fetchDataPromise.then(tableLogs => ({ table, plotLogs: tableLogs }));
        });
        Promise.all(dataPromises)
            .then(results => {
                if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
                const data: {[table: string]: {plotLogs: LogProps[]}} = {};
                results.forEach(result => {
                    data[result.table] = { plotLogs: result.plotLogs };
                });
                const logs = mergePlotData(data).plotLogs;
                resolve(logs);
            })
            .catch(error => {
                if (error.name !== 'AbortError') {
                    console.error("Error fetching and merging logs:", error);
                }
                reject(error);
            });
    });
}


function updatePlotLogs(
    tables: string[],
    args: PlotsArguments,
    project: string,
    logsActions: LogsActions,
    fieldsActions: FieldsActions,
    item: TileProps | undefined,
    updatePlot: (updateFn: (prev: PlotDataItem) => PlotDataItem) => void,
    signal?: AbortSignal
): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            return reject(new DOMException('Aborted', 'AbortError'));
        }
        fetchAndMergeFields(tables, args, project, fieldsActions, signal)
            .then(plotFields => {
                if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
                return fetchAndMergeLogs(tables, item, args, project, logsActions, plotFields, signal).then(logs => ({ plotFields, logs })); // Pass both results down
            })
            .then(({ plotFields, logs }) => {
                if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
                // Update state directly
                updatePlot((prevPlotDataItem: PlotDataItem) => ({...prevPlotDataItem, plotLogs: logs as LogProps[], plotFields}));
                resolve(); // Resolve the main promise after state update is queued
            })
            .catch(error => {
                if (error.name !== 'AbortError') {
                    console.error('Failed to update plot data:', error);
                }
                reject(error); // Reject the main promise
            });
    });
}

const PlotRefresh = ({tileId, tabId, interfaceId, projectId, pending, args, setPlotDataItem, logs, logsActions, fieldsActions}: {
    tileId: string,
    tabId: string,
    interfaceId: string,
    projectId: string,
    pending: boolean,
    args: PlotsArguments,
    setPlotDataItem: Dispatch<SetStateAction<PlotDataItem>>,
    logs: LogProps[] | undefined,
    logsActions: LogsActions,
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

    const { itemActions } = useTileItem(tileId, tabId);
    const item = useMemo(() => itemActions?.asTileItem(), [itemActions]);
    const { dataActions: tileDataActions } = useTile(tileId, tabId);

    /* Auto refresh */
    const autoUpdateRef = useRef(item?.auto_update === "true");
    const pendingRef = useRef(pending);
    const isMounted = useRef(false);
    const isRunning = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const argsRef = useRef(args);
    const tablesRef = useRef(tables);
    const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);

    // Sync pending, auto updaten, args and tables refs 
    useEffect(() => { pendingRef.current = pending }, [pending]);
    useEffect(() => { autoUpdateRef.current = item?.auto_update === "true" }, [item?.auto_update]);
    useEffect(() => { argsRef.current = args }, [args]);
    useEffect(() => { tablesRef.current = tables }, [tables]);

    // Pause/manage auto-update on server action (pending state)
     useEffect(() => {
         if (pendingRef.current && item?.auto_update === "true") {
             // Stop running fetch if any
             if (abortControllerRef.current) {
                 abortControllerRef.current.abort();
                 abortControllerRef.current = null;
             }
             // Clear scheduled timeout
             if (timeoutIdRef.current) {
                 clearTimeout(timeoutIdRef.current);
                 timeoutIdRef.current = null;
             }
             isRunning.current = false; // Ensure running state is reset
         }
         // Restarting is handled by the main fetch loop effect when pending becomes false
     }, [pendingRef.current, item?.auto_update]);

    // Mount/Unmount cleanup
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

    // Periodically fetch logs
    const runFetch = useCallback(() => {
        if (!isMounted.current || !autoUpdateRef.current || pendingRef.current || isRunning.current) return;

        isRunning.current = true;
        abortControllerRef.current = new AbortController();
        const currentSignal = abortControllerRef.current.signal;

        updatePlotLogs(
            tablesRef.current,
            argsRef.current,
            projectId,
            logsActions,
            fieldsActions,
            item,
            (updateFn) => {
                if (isMounted.current && autoUpdateRef.current && !currentSignal.aborted) {
                    setPlotDataItem(updateFn);
                }
            },
            currentSignal
        )
        .catch(error => {
            if (error.name !== 'AbortError') {
                console.error("Plot fetch run failed:", error);
            }
        })
        .finally(() => {
             isRunning.current = false;
             abortControllerRef.current = null;

             // Schedule the next fetch *only if* still mounted and auto-update is on and not pending
             if (isMounted.current && autoUpdateRef.current && !pendingRef.current) {
                 // Clear previous timeout just in case
                 if (timeoutIdRef.current) {
                    clearTimeout(timeoutIdRef.current);
                 }
                 timeoutIdRef.current = setTimeout(runFetch, 5000);
             }
        });

    }, [projectId, logsActions, fieldsActions, item, setPlotDataItem]);


    // Effect to manage the fetch loop (start/stop)
    useEffect(() => {
        if (autoUpdateRef.current && !pendingRef.current && isMounted.current) {
            runFetch();
        } 
        else {
            // Auto-update off, pending, or component unmounted: Stop the loop
            if (timeoutIdRef.current) {
                clearTimeout(timeoutIdRef.current);
                timeoutIdRef.current = null;
            }
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
                isRunning.current = false; // Ensure running state reset
            }
        }

        // Cleanup for dependency changes (redundant with mount cleanup but safe)
        return () => {
            if (timeoutIdRef.current) {
                clearTimeout(timeoutIdRef.current);
            }
        };
    }, [autoUpdateRef.current, pendingRef.current, runFetch]);

    const onAutoClick = () => {
        const nextValue = item?.auto_update === "true" ? "false" : "true";
        tileDataActions?.setAutoUpdate(nextValue);
    }
    const autoRefresh = 
        <ActionButton 
            variant={item?.auto_update === "true" ? "primary" : "ghost"}
            className="rounded-sm"
            icon={<Power />}
            tooltip={"Auto refresh every 5s"}
            onClick={onAutoClick}
        />;

    /* Manual refresh */
    // Display loader when data updates
    const [refreshClick, setRefreshClick] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<string>("");

    const displayLoadCheck = useCallback(() => {
        setRefreshClick(false);
        setLoaded(true);
        const timeoutId = setTimeout(() => {
            if (isMounted.current) {
                 setLoaded(false);
             }
        }, 2000);
        return () => clearTimeout(timeoutId);
    }, []);

    // Effect to show checkmark *after* loading finishes
    useEffect(() => {
        let cleanup: (() => void) | undefined;
        if (refreshClick && !loading) {
            cleanup = displayLoadCheck();
        }
        return cleanup;
    }, [refreshClick, loading, displayLoadCheck]);


    // Fetch initial timestamp on mount
    useEffect(() => {
        if (tables.length > 0) {
            fetchLatestTimestamps(tables, args, projectId, logsActions)
                .then(latestTimestamp => {
                    if (isMounted.current) setLastUpdated(latestTimestamp);
                })
                .catch(err => console.error("Failed to get initial latest plot timestamp:", err));
        }
    }, [tables, args, projectId, logsActions]);

    const onManualClick = () => {
        if (loading || item?.auto_update === "true" || tables.length === 0) return;

        setLoading(true);
        setRefreshClick(true);

        const manualAbortController = new AbortController();

        fetchLatestTimestamps(tablesRef.current, argsRef.current, projectId, logsActions, manualAbortController.signal)
            .then(latestTimestamp => {
                if (manualAbortController.signal.aborted) throw new DOMException('Aborted', 'AbortError');
                const latestTs = latestTimestamp ? new Date(latestTimestamp).getTime() : 0;
                const lastCheckTs = lastUpdated ? new Date(lastUpdated).getTime() : 0;
                if (latestTs > lastCheckTs) {
                    return updatePlotLogs(tablesRef.current, argsRef.current, projectId, logsActions, fieldsActions, item,setPlotDataItem,manualAbortController.signal)
                    .then(() => {
                         // Update last checked timestamp only on successful fetch
                         if (isMounted.current && !manualAbortController.signal.aborted) {
                             setLastUpdated(latestTimestamp);
                         }
                     });
                     // Catch inside updatePlotLogs handles logging errors
                     // Finally block below handles setting loading state
                } else {
                    return Promise.resolve(); // Resolve immediately
                }
            })
            .catch(error => {
                if (error.name !== 'AbortError') {
                    console.error("Manual plot refresh failed:", error);
                }
            })
            .finally(() => {
                // Ensure loading state is reset regardless of outcome (unless aborted mid-check)
                if (isMounted.current && !manualAbortController.signal.aborted) {
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
        className="rounded-sm h-8"
        icon={icon}
        tooltip={loading ? "Refreshing plot logs.." : item?.auto_update === "true" ? "Auto refreshing plot logs.." : "Refresh plot logs"}
        onClick={() => onManualClick()}
        disabled={loading || item?.auto_update === "true"}
    />

    return (
        <div className="flex flex-col">
            {manualRefresh}
            {autoRefresh}
        </div>
    );
}

export default PlotRefresh;