"use client";

import ActionButton from "@/components/Common/Buttons/Action";
import { RefreshCw, Power, Check } from "lucide-react";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { ItemType, LogsActions, FieldsActions, TableDataItem, TableDataProps, TileProps } from "@/types/evals/grid";
import { getLogsParameters, GroupedLogProps, LogFieldsProps, LogFieldsResponseProps, LogItemProps, LogsResponseProps } from "@/types/evals/logs";
import { getLogsDetails } from "@/utils/evals/common";
import { ResponseProps } from "@/types/common";
import { LogProps } from "@/types/evals/logs";

async function updateLogs (
    item: TileProps,
    filterExpression: string | null,
    sortingExpression: string | null,
    groupingExpression: string | null,
    project: string, 
    logsActions: LogsActions, 
    fieldsActions: FieldsActions,
    setTableDataItem: Dispatch<SetStateAction<TableDataItem>>
) {
    fieldsActions
    .get(project)
    .then(async (fields: LogFieldsResponseProps) => {
        logsActions
        .get(project, item.context ?? null, filterExpression, sortingExpression, groupingExpression, null, null, 16, 0, null, Date.now().toString())
        .then(async (logsData: LogsResponseProps) => {
            const totalPages = Math.ceil(logsData.count / 16);
            const context = item.context ?? null;
            const sorting = item.sorting ?? null;
            const { entriesProperties, paramsProperties, logs, params, metrics, boundaries } = await getLogsDetails(
                item, logsData, fields, context, project, filterExpression, sorting, undefined, logsActions
            )
            setTableDataItem((tableDataItem: TableDataItem) => {
                let newCells : string[] = [];
                if (logs.length) {
                    const previousCells = tableDataItem.logs.flatMap(log => {
                        const entryCells = Object.keys(log.entries as LogItemProps).map(key => `${log.id}_${key}`)
                        const paramCells = Object.keys(log.params as LogItemProps).map(key => `${log.id}_${key}`)
                        return entryCells.concat(paramCells)
                    });
                    newCells = logs.flatMap(log => {
                        const entryCells = Object.keys(log.entries as LogItemProps).map(key => `${log.id}_${key}`)
                        const paramCells = Object.keys(log.params as LogItemProps).map(key => `${log.id}_${key}`)
                        return entryCells.concat(paramCells)
                      }
                    );
                    newCells = newCells.filter(id => !previousCells.includes(id))    
                }
                return {
                    ...tableDataItem,
                    fields,
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
        });
    });
}

const RefreshLogs = ({ item, project, pending, fields, filterExpression, sortingExpression, groupingExpression, hiddenColumns, updateItem, setTableDataItem, logs, logsActions, fieldsActions }: {
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
    logsActions: LogsActions,
    fieldsActions: FieldsActions
}) => {
    /* Auto refresh */
    // We use timestamp to tag fetch api calls to trigger revalidation every eight seconds
    useEffect(() => {
        if (!item.auto_update || item.auto_update == "false") return;
        let isMounted = true;
        let running = false;
        const interval = setInterval(() => {
          if (!isMounted || running || pending) return;
          running = true;
          updateLogs(item, filterExpression, sortingExpression, groupingExpression, project, logsActions, fieldsActions, setTableDataItem).finally(() => {
            running = false;
          });
        }, 5000);      
        return () => {
          clearInterval(interval);
          isMounted = false;
        };
    }, [item.auto_update, filterExpression, sortingExpression, groupingExpression]); 
    const onAutoClick = () => updateItem(item, "auto_update")(item.auto_update === "true" ? "false" : "true")
    const autoRefresh =
        <ActionButton
            variant={item.auto_update === "true" ? "primary" : "outline"}
            className="rounded-none rounded-tr-lg rounded-br-lg"
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

    useEffect(() => { logsActions.getLatest(project, item.context ?? null, filterExpression, sortingExpression, null, null, null, 0).then(latest => setLastUpdated(latest)) }, [])

    const onManualClick = () => {
        setLoading(true);
        setRefreshClick(true);
        logsActions.getLatest(project, item.context ?? null, filterExpression, sortingExpression, null, null, null, 0).then(latest => {
            const latestTs = new Date(latest).getTime();
            const lastCheckTs = new Date(lastUpdated).getTime();
            if (latestTs > lastCheckTs) {
                updateLogs(item, filterExpression, sortingExpression, groupingExpression, project, logsActions, fieldsActions, setTableDataItem).then(() => {
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