"use client";

import ActionButton from "@/components/Common/Buttons/Action";
import { RefreshCw, Power, Check } from "lucide-react";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { ItemType, LogsActions, FieldsActions, PlotDataItem, TileProps } from "@/types/evals/grid";
import { PlotArguments, LogFieldsResponseProps, LogsResponseProps } from "@/types/evals/logs";
import { getLogsDetails } from "@/utils/evals/common";
import { LogProps } from "@/types/evals/logs";

const fetchLatestTimestamps = async (tables: string[], args: PlotArguments, project: string, logsActions: LogsActions) => {
    const latestDates = await Promise.all(
        tables.map(async (table) => {
            const tableArgs = args[table];
            const tableContext = tableArgs ? tableArgs["context"] : null;
            const tableColumnContext = tableArgs ? tableArgs["column_context"] : null;
            const tableFilters = tableArgs ? tableArgs["filter_expr"] : null;
            const tableSubset = tableArgs ? tableArgs["subset"] : null;
            return logsActions.getLatest(project, tableContext, tableColumnContext, tableFilters, null, tableSubset, null, null, 0);
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
        const fields : LogFieldsResponseProps = await fieldsActions.get(project, tableContext);
        const newFields = Object.fromEntries(
            Object
                .entries(fields)
                .filter(([name, { data_type, field_type, artifacts }]) => tableContext ? name.startsWith(tableContext) : name)
                .map(([name, { data_type, field_type, artifacts }]) => {
                    const newName = tableContext ? name.replace(tableContext, "") : name;
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
            const tableData = await logsActions.get(project, tableContext, tableColumnContext, tableFilters, null, null, tableSubset, null, 0, null, null, Date.now().toString())
            const tableLogs = tableData.logs as LogProps[]
            data[table] = {plotLogs: tableLogs}
        })
    );
    const logs = mergePlotData(data).plotLogs
    return logs
};

async function updatePlotLogs (tables: string[], args: PlotArguments, project: string, logsActions: LogsActions, fieldsActions: FieldsActions, setPlotDataItem: Dispatch<SetStateAction<PlotDataItem>>) {
    fetchAndMergeFields(tables, args, project, fieldsActions).then(async (plotFields: LogFieldsResponseProps) => 
        fetchAndMergeLogs(tables, args, project, logsActions).then(async (logs) => {
            setPlotDataItem((plotDataItem: PlotDataItem) => ({...plotDataItem, plotLogs: logs as LogProps[], plotFields}));
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
    // We use timestamp to tag fetch api calls to trigger revalidation every eight seconds
    let running = false
    useEffect(() => {
        if (!item.auto_update || item.auto_update == "false") return;
        const interval = setInterval(() => {
            if (!running && !pending) {
                running = true;
                updatePlotLogs(tables, args, project, logsActions, fieldsActions, setPlotDataItem).then(() => {
                    running = false;
                });
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