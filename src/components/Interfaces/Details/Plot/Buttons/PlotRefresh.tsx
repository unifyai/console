"use client";

import ActionButton from "@/components/Common/Buttons/Action";
import { RefreshCw, Power, Check } from "lucide-react";
import { Dispatch, SetStateAction, useEffect, useState, useRef, useCallback, useMemo } from "react";
import { LogsActions, FieldsActions, PlotDataItem } from "@/types/evals/grid";
import { PlotArguments, LogFieldsResponseProps } from "@/types/evals/logs";
import { processContext } from "@/utils/evals/columnOperations";
import { LogProps } from "@/types/evals/logs";
import { buildFilterExpression } from "@/utils/evals/filters";
import { useTileItem } from "@/contexts/hooks/tile/useTileItem";
import { useTab } from "@/contexts/hooks/tab/useTab";
import { useTiles } from "@/contexts/hooks/useStore";
import { useTile } from "@/contexts/hooks/tile/useTile";

const fetchLatestTimestamps = async (tables: string[], args: PlotArguments, project: string, logsActions: LogsActions) => {
    const latestDates = await Promise.all(
        tables.map(async (table) => {
            const tableArgs = args[table];
            const tableContext = tableArgs ? tableArgs["context"] : null;
            const tableColumnContext = tableArgs ? tableArgs["column_context"] : null;
            const tableFilters = tableArgs ? tableArgs["filters"] : null;
            const tableSubset = tableArgs ? tableArgs["subset"] : null;
            return logsActions.getLatest(project, tableContext, tableColumnContext, tableFilters, null, null, null, tableSubset, null, null, null, null, null);
        })
    );
    const latestTimestamp = new Date(Math.max(...latestDates.map(t => new Date(t).getTime())))
    const latest = latestTimestamp.toString() == "Invalid Date" ? "" : latestTimestamp.toISOString()
    return latest
};

const mergePlotData = (plotData_: {[x: string]: { plotLogs: LogProps[] }}) => {
    let mergedPlotData : {plotLogs: LogProps[]} = {plotLogs: []} 
    if (plotData_ && Object.values(plotData_).length && Object.values(plotData_)[0].plotLogs) {
        const minLogLength = Math.min(...Object.values(plotData_).map(data => data.plotLogs.length));
        if (minLogLength > 0) {
            const plotLogs = Object.values(plotData_)[0].plotLogs.slice(0, minLogLength).map((_, i) => {
                return Object.entries(plotData_).reduce((acc, [tableId, data]) => {
                    const prefixedLog = Object.fromEntries(
                        Object.entries(data.plotLogs[i] || {}).map(([key, value]) => [
                            `${tableId}.${key}`,
                            (["params", "entries", "derived_entries"].includes(key) && value) 
                                ? Object.fromEntries(Object.entries(value).map(([k,v]) => [`${tableId}.${k}`, v])) 
                                : value
                        ])
                    );
                    return { ...acc, ...prefixedLog };
                }, {}) as LogProps;
            })
            mergedPlotData = {plotLogs}
        }
    }
    return mergedPlotData
}

const fetchAndMergeFields = async (tables: string[], args: PlotArguments, project: string, fieldsActions: FieldsActions) => {
    const plotFieldsArray : LogFieldsResponseProps[] = await Promise.all(tables.flatMap(async (table) => {
        const tableArgs = args[table];
        const tableContext = tableArgs ? tableArgs["context"] : null;
        const tableColumnContext = tableArgs ? tableArgs["column_context"] : null;
        const fields : LogFieldsResponseProps = await fieldsActions.get(project, tableContext);
        const newFields = Object.fromEntries(
            Object
                .entries(fields)
                .filter(([name, { data_type, field_type, artifacts }]) => tableColumnContext ? name.startsWith(tableColumnContext) : name)
                .map(([name, { data_type, field_type, artifacts }]) => {
                    const newName = tableColumnContext ? processContext("split", tableColumnContext, name) : name
                    const newFields = [`${table}.${newName}`, { data_type, field_type, artifacts }]
                    return newFields;
                })
        )
        return newFields
    }))
    const plotFields = plotFieldsArray.reduce((acc, curr) => ({ ...acc, ...curr }), {});
    return plotFields
}

const fetchAndMergeLogs = async (tables: string[], args: PlotArguments, project: string, logsActions: LogsActions, plotFields: LogFieldsResponseProps) => {
    const data : {[table: string]: {plotLogs: LogProps[]}}= {};
    await Promise.all(
        tables.map(async (table) => {
            const tableArgs = args[table];
            const tableContext = tableArgs ? tableArgs["context"] : null;
            const tableColumnContext = tableArgs ? tableArgs["column_context"] : null;
            const tableFields = Object.fromEntries(Object.entries(plotFields).filter(([field, _]) => field.startsWith(table)).map(([field, attributes]) => [field.split(".").slice(1).join("."), attributes]))
            const tableFilters = tableArgs ? buildFilterExpression(tableArgs["column_filters"], tableArgs["common_filter"], tableArgs["column_context"], tableArgs["freeze"], tableFields) : null;
            const tableSubset = tableArgs ? tableArgs["subset"] : null;
            const tableData = await logsActions.get(project, tableContext, tableColumnContext, tableFilters, null, null, null, tableSubset, null, 0, null, null, null, Date.now().toString())
            const tableLogs = tableData.logs as LogProps[]
            data[table] = {plotLogs: tableLogs}
        })
    );
    const logs = mergePlotData(data).plotLogs
    return logs
};

async function updatePlotLogs (
    tables: string[], 
    args: PlotArguments, 
    project: string, 
    logsActions: LogsActions, 
    fieldsActions: FieldsActions, 
    updatePlot: (updateFn: (prev: PlotDataItem) => PlotDataItem) => void,
    signal?:  AbortSignal
) {
    if (signal?.aborted) return;
    fetchAndMergeFields(tables, args, project, fieldsActions).then(async (plotFields: LogFieldsResponseProps) => 
        fetchAndMergeLogs(tables, args, project, logsActions, plotFields).then(async (logs) => {
            updatePlot((plotDataItem: PlotDataItem) => ({...plotDataItem, plotLogs: logs as LogProps[], plotFields}));
        })
    )
} 

const PlotRefresh = ({ tileId, tabId, interfaceId, projectId, pending, args, setPlotDataItem, logs, logsActions, fieldsActions }: {
    tileId: string,
    tabId: string,
    interfaceId: string,
    projectId: string,
    pending: boolean,
    args: PlotArguments,
    setPlotDataItem: Dispatch<SetStateAction<PlotDataItem>>,
    logs: LogProps[] | undefined,
    logsActions: LogsActions,
    fieldsActions: FieldsActions
}) => {

    // Get access to the tab context and actions with granular access
    const { data: tabDataState } = useTab(tabId, interfaceId, projectId);
    
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

    // Get the item representation for the current tile
    const { itemActions } = useTileItem(tileId, tabId, interfaceId);
    const item = useMemo(() => itemActions?.asTileItem(), [itemActions]);

    // Get the overarching tile data actions
    const { dataActions: tileDataActions } = useTile(tileId, tabId, interfaceId, projectId);

    /* Auto refresh */
    // We use timestamp to tag fetch api calls to trigger revalidation every 5 seconds
    const autoUpdateRef = useRef(item?.auto_update === "true");
    const pendingRef = useRef(pending);
    const isMounted = useRef(false);
    const isRunning = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const argsRef = useRef(args);
    const tablesRef = useRef(tables);

    // Sync pending, auto updaten, args and tables refs 
    useEffect(() => {pendingRef.current = pending}, [pending]);
    useEffect(() => {autoUpdateRef.current = item?.auto_update === "true"}, [item?.auto_update]);
    useEffect(() => {argsRef.current = args}, [args]);
    useEffect(() => {tablesRef.current = tables}, [tables]);

    // Pause auto-update on server action
    useEffect(() => {
        if (item?.auto_update === "true") autoUpdateRef.current = false;
    }, [pendingRef.current])

    // Restart streaming after server action ends
    useEffect(() => {
        if (item?.auto_update === "true" && !autoUpdateRef.current && !pendingRef.current) autoUpdateRef.current = true;
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
    }, [])

    // Memoize updatePlotLogs to prevent unnecessary recreations
    const updateLogsCallback = useCallback(async () => {
        if (!isMounted.current || !autoUpdateRef.current || pendingRef.current || isRunning.current) return;
        
        isRunning.current = true;
        abortControllerRef.current = new AbortController();

        try {
            await updatePlotLogs(
                tablesRef.current,
                argsRef.current,
                projectId,
                logsActions,
                fieldsActions,
                (updateFn) => {
                    if (isMounted.current && autoUpdateRef.current) {
                        setPlotDataItem(updateFn);
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
    }, [item?.auto_update]);

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

    const onAutoClick = () => tileDataActions?.setAutoUpdate(item?.auto_update === "true" ? "false" : "true")
    const autoRefresh =
        <ActionButton
            variant={item?.auto_update === "true" ? "primary" : "outline"}
            className="rounded-none rounded-bl-lg rounded-br-lg"
            icon={<Power />}
            tooltip={"Auto refresh every 5s"}
            onClick={() => onAutoClick()}
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
    
    useEffect(() => {
        fetchLatestTimestamps(tables, args, projectId, logsActions).then(latestTimestamp => setLastUpdated(latestTimestamp));
    }, [])

    const onManualClick = () => {
        setLoading(true);
        setRefreshClick(true);
        fetchLatestTimestamps(tables, args, projectId, logsActions).then(latestTimestamp => {
            const latestTs = new Date(latestTimestamp).getTime();
            const lastCheckTs = new Date(lastUpdated).getTime();
            if (latestTs > lastCheckTs) {
                updatePlotLogs(tables, args, projectId, logsActions, fieldsActions, setPlotDataItem).then(() => {
                    setLastUpdated(latestTimestamp)
                }) 
            } else {
                displayLoadCheck();
            }
        })
    }

    const icon = loading || item?.auto_update === "true"
    ? <RefreshCw className="animate-spin text-green"/> 
    : loaded
        ?   <Check className="text-green"/>
        :   <RefreshCw/>
    const manualRefresh = <ActionButton 
        variant="outline"
        className="rounded-none rounded-tr-lg rounded-tl-lg h-8"
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