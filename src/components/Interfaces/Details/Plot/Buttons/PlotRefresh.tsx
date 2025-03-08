"use client";

import ActionButton from "@/components/Common/Buttons/Action";
import { RefreshCw, Power, Check } from "lucide-react";
import { Dispatch, SetStateAction, useEffect, useState, useRef } from "react";
import { ItemType, LogsActions, FieldsActions, PlotDataItem, TileProps } from "@/types/evals/grid";
import { PlotArguments, LogFieldsResponseProps, LogsResponseProps } from "@/types/evals/logs";
import { processContext } from "@/utils/evals/columnOperations";
import { LogProps } from "@/types/evals/logs";

const fetchLatestTimestamps = async (tables: string[], args: PlotArguments, project: string, logsActions: LogsActions) => {
    const latestDates = await Promise.all(
        tables.map(async (table) => {
            const tableArgs = args[table];
            const tableContext = tableArgs ? tableArgs["context"] : null;
            const tableColumnContext = tableArgs ? tableArgs["column_context"] : null;
            const tableFilters = tableArgs ? tableArgs["filter_expr"] : null;
            const tableSubset = tableArgs ? tableArgs["subset"] : null;
            return logsActions.getLatest(project, tableContext, tableColumnContext, tableFilters, null, null, null, tableSubset, null, null, null, null, null);
        })
    );
    const latestTimestamp = new Date(Math.max(...latestDates.map(t => new Date(t).getTime())))
    const latest = latestTimestamp.toISOString()
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

const fetchAndMergeLogs = async (tables: string[], args: PlotArguments, project: string, logsActions: LogsActions) => {
    const data : {[table: string]: {plotLogs: LogProps[]}}= {};
    await Promise.all(
        tables.map(async (table) => {
            const tableArgs = args[table];
            const tableContext = tableArgs ? tableArgs["context"] : null;
            const tableColumnContext = tableArgs ? tableArgs["column_context"] : null;
            const tableFilters = tableArgs ? tableArgs["filter_expr"] : null;
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
    updatePlot: (updateFn: (prev: PlotDataItem) => PlotDataItem) => void
) {
    fetchAndMergeFields(tables, args, project, fieldsActions).then(async (plotFields: LogFieldsResponseProps) => 
        fetchAndMergeLogs(tables, args, project, logsActions).then(async (logs) => {
            updatePlot((plotDataItem: PlotDataItem) => ({...plotDataItem, plotLogs: logs as LogProps[], plotFields}));
        })
    )
} 

const PlotRefresh = ({ tables, item, project, pending, args, updateItem, setPlotDataItem, logs, logsActions, fieldsActions }: {
    tables: string[]
    item: TileProps,
    project: string,
    pending: boolean,
    args: PlotArguments,
    updateItem: (item: TileProps, attrName: ItemType) => (newValue: string | undefined) => void,
    setPlotDataItem: Dispatch<SetStateAction<PlotDataItem>>,
    logs: LogProps[] | undefined,
    logsActions: LogsActions,
    fieldsActions: FieldsActions
}) => {

    /* Auto refresh */
    // We use timestamp to tag fetch api calls to trigger revalidation every 5 seconds
    const autoUpdateRef = useRef(item.auto_update === "true");
    const pendingRef = useRef(pending);
    const isMounted = useRef(false);
    const isRunning = useRef(false)

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
        };
    }, [])

    // Periodically fetch new logs
    useEffect(() => {
        if (!autoUpdateRef.current) return;
        const interval = setInterval(async () => {
            if (!isRunning.current && !pendingRef.current && isMounted.current) {
                isRunning.current = true;
                try {
                    await updatePlotLogs(
                      tables,
                      args,
                      project,
                      logsActions,
                      fieldsActions,
                      (updateFn) => {
                        if (autoUpdateRef.current && isMounted.current) {
                          setPlotDataItem(updateFn);
                        }
                      }
                    );
                  } finally {
                    isRunning.current = false;
                }
            }
        }, 5000);
        return () => clearInterval(interval)
    }, [item.auto_update, tables, args]);
    const onAutoClick = () => updateItem(item, "auto_update")(item.auto_update === "true" ? "false" : "true")
    const autoRefresh =
        <ActionButton
            variant={item.auto_update === "true" ? "primary" : "outline"}
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
        fetchLatestTimestamps(tables, args, project, logsActions).then(latestTimestamp => setLastUpdated(latestTimestamp));
    }, [])

    const onManualClick = () => {
        setLoading(true);
        setRefreshClick(true);
        fetchLatestTimestamps(tables, args, project, logsActions).then(latestTimestamp => {
            const latestTs = new Date(latestTimestamp).getTime();
            const lastCheckTs = new Date(lastUpdated).getTime();
            if (latestTs > lastCheckTs) {
                updatePlotLogs(tables, args, project, logsActions, fieldsActions, setPlotDataItem).then(() => {
                    setLastUpdated(latestTimestamp)
                }) 
            } else {
                displayLoadCheck();
            }
        })
    }

    const icon = loading || item.auto_update === "true"
    ? <RefreshCw className="animate-spin text-green"/> 
    : loaded
        ?   <Check className="text-green"/>
        :   <RefreshCw/>
    const manualRefresh = <ActionButton 
        variant="outline"
        className="rounded-none rounded-tr-lg rounded-tl-lg h-8"
        icon={icon}
        tooltip={loading ? "Refreshing plot logs.." : item.auto_update === "true" ? "Auto refreshing plot logs.." : "Refresh plot logs"}
        onClick={() => onManualClick()}
        disabled={loading || item.auto_update === "true"}
    />

    return (
        <div className="flex flex-col">
            {manualRefresh}
            {autoRefresh}
        </div>
    );
}

export default PlotRefresh;