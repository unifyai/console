"use client";

import ActionButton from "@/components/Common/Buttons/Action";
import { RefreshCw, Power, Check } from "lucide-react";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { ItemType, LogsActions, TableDataItem, TableDataProps, TileProps } from "@/types/evals/grid";
import { getLogsParameters, GroupedLogProps, LogFieldsProps, LogFieldsResponseProps, LogsResponseProps } from "@/types/evals/logs";
import { getLogsDetails } from "@/utils/evals/common";
import { ResponseProps } from "@/types/common";
import { LogProps } from "@/types/evals/logs";

const RefreshLogs = ({ item, project, pending, fields, filterExpression, sortingExpression, groupingExpression, hiddenColumns, updateItem, setTableDataItem, logs, logsActions }: {
    item: TileProps,
    project: string,
    pending: boolean,
    fields: LogFieldsResponseProps,
    filterExpression: string | null,
    sortingExpression: string | null,
    groupingExpression: string | null,
    hiddenColumns: string | undefined,
    updateItem: (item: TileProps, attrName: ItemType) => (newValue: string | undefined) => void,
    setTableDataItem: Dispatch<SetStateAction<TableDataItem>>,
    logs: LogProps[] | GroupedLogProps[],
    logsActions: LogsActions
}) => {

    /* Auto refresh */
    // We use timestamp to tag fetch api calls to trigger revalidation every eight seconds
    let running = false;
    useEffect(() => {
        if (!item.auto_update || item.auto_update == "false") return;
        const interval = setInterval(() => {
            if (!running && !pending) {
                running = true;
                logsActions.get(
                    project, item.context ?? null, filterExpression, sortingExpression, groupingExpression, null, null, 16, 0, null, Date.now().toString()
                ).then(async (logsData: LogsResponseProps) => {
                    const totalPages = Math.ceil(logsData.count / 16);
                    const context = item.context ?? null;
                    const sorting = item.sorting ?? null;
                    const { entriesProperties, paramsProperties, logs, params, metrics, boundaries } = await getLogsDetails(
                        item, logsData, fields, context, project, filterExpression, sorting, undefined, logsActions
                    )
                    setTableDataItem((tableDataItem: TableDataItem) => {
                        const previousCells = tableDataItem.logs.flatMap(log => {
                            const entryCells = Object.keys(log.entries).map(key => `${log.id}_${key}`)
                            const paramCells = Object.keys(log.params).map(key => `${log.id}_${key}`)
                            return entryCells.concat(paramCells)
                          }
                        );
                        let newCells = logs.flatMap(log => {
                            const entryCells = Object.keys(log.entries).map(key => `${log.id}_${key}`)
                            const paramCells = Object.keys(log.params).map(key => `${log.id}_${key}`)
                            return entryCells.concat(paramCells)
                          }
                        );
                        newCells = newCells.filter(id => !previousCells.includes(id))
                        return {
                            ...tableDataItem,
                            logsData,
                            totalPages,
                            entriesProperties,
                            paramsProperties,
                            logs,
                            params,
                            metrics,
                            boundaries,
                            newCells
                        };
                    });
                    running = false;
                });
            }
        }, 10000); // Refresh every 10000ms
        return () => clearInterval(interval)
    }, [item.auto_update])
    const onAutoClick = () => updateItem(item, "auto_update")(item.auto_update === "true" ? "false" : "true")
    const autoRefresh =
        <ActionButton
            variant={item.auto_update === "true" ? "primary" : "outline"}
            className="rounded-none rounded-tr-lg rounded-br-lg"
            icon={<Power />}
            tooltip={"Auto refresh every 10000ms"}
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

    useEffect(() => { logsActions.getLatest(project, item.context ?? null, filterExpression, sortingExpression, null, null, null, 0).then(latest => setLastUpdated(latest)) }, [])

    const onManualClick = () => {
        setLoading(true);
        setRefreshClick(true);
        logsActions.getLatest(project, item.context ?? null, filterExpression, sortingExpression, null, null, null, 0).then(latest => {
            const latestTs = new Date(latest).getTime();
            const lastCheckTs = new Date(lastUpdated).getTime();
            if (latestTs > lastCheckTs) {
                setLastUpdated(latest)
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
        tooltip={loading ? "Refreshing logs.." : item.auto_update === "true" ? "Auto refreshing logs.." : "Refresh logs"}
        onClick={() => onManualClick()}
        disabled={loading || item.auto_update === "true"}
    />

    return (
        <div className="flex flex-row">
            {manualRefresh}
            {autoRefresh}
        </div>
    );
}

export default RefreshLogs;