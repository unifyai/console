"use client";

import ActionButton from "@/components/Common/Buttons/Action";
import { RefreshCw, Power, Check } from "lucide-react";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { ItemType, LogsActions, FieldsActions, TableDataItem, TableDataProps, TileProps } from "@/types/evals/grid";
import { getLogsParameters, GroupedLogProps, LogFieldsProps, LogFieldsResponseProps, LogItemProps, LogsResponseProps } from "@/types/evals/logs";
import { getLogsDetails } from "@/utils/evals/common";
import { ResponseProps } from "@/types/common";
import { LogProps } from "@/types/evals/logs";


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
    filterExpression: string | null,
    sortingExpression: string | null,
    groupingExpression: string | null,
    project: string, 
    logsActions: LogsActions, 
    fieldsActions: FieldsActions,
    setTableData: (updater: (prev: TableDataProps) => TableDataProps) => void,
) {
    fieldsActions
    .get(project, item.context ?? null)
    .then(async (fields: LogFieldsResponseProps) => {
        logsActions
        .get(
            project, 
            item.context ?? null, 
            item.column_context ?? null, 
            filterExpression, 
            sortingExpression, 
            groupingExpression, 
            null, 
            null, 
            100, // Hardcoded limit value (100) will need to be passed down from Main
            (item.page_number ? parseInt(item.page_number) : 0) * 100, // Hardcoded limit value (100) will need to be passed down from Main
            groupingExpression ? 0 : null,
            Date.now().toString()
        )
        .then(async (logsData: LogsResponseProps) => {
            const totalPages = Math.ceil(logsData.count / 16);
            const context = item.context ?? null;
            const sorting = item.sorting ?? null;
            const { entriesProperties, paramsProperties, logs, params, metrics, boundaries } = await getLogsDetails(
                item, logsData, fields, context, project, filterExpression, sorting, undefined, logsActions
            )
            await new Promise<void>(resolve => {
                setTableData(prev => {
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
                            newCells
                        }
                    };
                    resolve();
                    return newState;
                });
            });
        });
    });
}

const RefreshLogs = ({ item, project, pending, fields, filterExpression, sortingExpression, groupingExpression, hiddenColumns, updateItem, setTableData, logs, logsActions, fieldsActions }: {
    item: TileProps,
    project: string,
    pending: boolean,
    fields: LogFieldsResponseProps,
    filterExpression: string | null,
    sortingExpression: string | null,
    groupingExpression: string | null,
    hiddenColumns: string | undefined,
    updateItem: (item: TileProps, attrName: ItemType) => (newValue: string | undefined) => void,
    setTableData: (updater: (prev: TableDataProps) => TableDataProps) => void,
    logs: LogProps[] | GroupedLogProps[],
    logsActions: LogsActions,
    fieldsActions: FieldsActions
}) => {

    /* Auto refresh */
    // We use timestamp to tag fetch api calls to trigger revalidation every 5 seconds.
    // We pause the auto refresh whenever a server action is triggered.
    const [pauseRefresh, setPauseRefresh] = useState(false);
    useEffect(() => {
      if (item.auto_update === "true") setPauseRefresh(true)
    }, [item.filters, item.common_filter, item.grouping, item.context, item.page_number, item.sorting, item.freeze])
    useEffect(() => {
      if (pauseRefresh) setTimeout(() => setPauseRefresh(false), 20000) // Pausing for 20 sec, leaving ample time for reload-refetch-rerender cycle
    }, [pauseRefresh])
    let running = false
    useEffect(() => {
        if (!item.auto_update || item.auto_update == "false" || pauseRefresh) return;
        const interval = setInterval(() => {
            if (!running && !pending) {
                running = true;
                updateLogs(item, filterExpression, sortingExpression, groupingExpression, project, logsActions, fieldsActions, setTableData).then(() => {
                    running = false;
                });
            }
        }, 5000);
        return () => clearInterval(interval)
    }, [item.auto_update, pauseRefresh, item.context, filterExpression, sortingExpression, groupingExpression]);

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

    useEffect(() => { logsActions.getLatest(project, item.context ?? null, item.column_context ?? null, filterExpression, sortingExpression, null, null, null, 0).then(latest => setLastUpdated(latest)) }, [])

    const onManualClick = () => {
        setLoading(true);
        setRefreshClick(true);
        logsActions.getLatest(project, item.context ?? null, item.column_context ?? null, filterExpression, sortingExpression, null, null, null, 0).then(latest => {
            const latestTs = new Date(latest).getTime();
            const lastCheckTs = new Date(lastUpdated).getTime();
            if (latestTs > lastCheckTs) {
                updateLogs(item, filterExpression, sortingExpression, groupingExpression, project, logsActions, fieldsActions, setTableData).then(() => {
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