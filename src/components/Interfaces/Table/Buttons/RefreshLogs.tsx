"use client";

import ActionButton from "@/components/Common/Buttons/Action";
import { RefreshCw, Power } from "lucide-react";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { BasePopover } from "@/components/Common/Popovers/Base";
import { ItemType, TableDataItem, TableDataProps, TileProps } from "@/types/evals/grid";
import { TableArguments, LogFieldsProps, LogFieldsResponseProps, LogsResponseProps } from "@/types/evals/logs";
import { getLogsDetails } from "@/utils/evals/common";
import { ResponseProps } from "@/types/common";

const RefreshLogs = ({ item, project, pending, fields, filterExpression, sortingExpression, updateItem, setTableDataItem, logsActions }: {
    item: TileProps,
    project: string,
    pending: boolean,
    fields: LogFieldsResponseProps,
    filterExpression: string | null,
    sortingExpression: string | null,
    updateItem: (item: TileProps, attrName: ItemType) => (newValue: string | undefined) => void,
    setTableDataItem: Dispatch<SetStateAction<TableDataItem>>,
    logsActions: {
        get: (
            project: string,
            context: string | null,
            filterExpression: string | null,
            sortingExpression: string | null,
            from_fields: string | null,
            limit: number | null,
            offset: number,
            _timestamp: string | null
        ) => Promise<LogsResponseProps>,
        getLatest: (
            project: string,
            context: string | null,
            filterExpression: string | null,
            sortingExpression: string | null,
            from_fields: string | null,
            limit: number | null,
            offset: number
        ) => Promise<string>,
        getMetrics: (
            project: string,
            filterExpression: string | null,
            metricName: string,
            keyName: string
        ) => Promise<number>;
        delete: (ids_and_fields: LogFieldsProps) => Promise<ResponseProps>,
        derive: (
            project: string, 
            key: string, 
            equation: string, 
            referenced_logs: TableArguments
        ) => Promise<ResponseProps>
    },
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
                    project, item.context ?? null, filterExpression, sortingExpression, null, 16, 0, Date.now().toString()
                ).then(async (logsData: LogsResponseProps) => {
                    const totalPages = Math.ceil(logsData.count / 16);
                    const context = item.context ?? null;
                    const sorting = item.sorting ?? null;
                    const { entriesProperties, paramsProperties, logs, params, metrics, boundaries } = await getLogsDetails(
                        item, logsData, fields, context, project, filterExpression, sorting, logsActions
                    )
                    setTableDataItem((tableDataItem: TableDataItem) => {
                        return {
                            ...tableDataItem,
                            logsData,
                            totalPages,
                            entriesProperties,
                            paramsProperties,
                            logs,
                            params,
                            metrics,
                            boundaries
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

    const [lastUpdated, setLastUpdated] = useState<string>("")
    const [isChecking, setIsChecking] = useState(true);
    const messages = { updated: "New logs were added to the table!", stale: "Table logs are already up to date" }
    const [message, setMessage] = useState("")


    // We compare the timestamp string returned from the get latest timestamp endpoint
    // with the timestamp saved last time the refresh button was used, except the first
    // time where we compare with the timestamp set on loading the component

    useEffect(() => { logsActions.getLatest(project, item.context ?? null, filterExpression, sortingExpression, null, null, 0).then(latest => setLastUpdated(latest)) }, [])

    const onManualClick = () => {
        setIsChecking(true)
        logsActions.getLatest(project, item.context ?? null, filterExpression, sortingExpression, null, null, 0).then(latest => {
            const latestTs = new Date(latest).getTime();
            const lastCheckTs = new Date(lastUpdated).getTime();
            if (latestTs > lastCheckTs) {
                setLastUpdated(latest)
                setMessage(messages.updated)
            } else {
                setMessage(messages.stale)
            }
            setIsChecking(false)
        });
    }

    const button =
        <ActionButton
            variant="outline"
            className="rounded-none rounded-tl-lg rounded-bl-lg h-8"
            icon={<RefreshCw />}
            tooltip="Refresh logs"
            onClick={() => onManualClick()}
        />
    const manualRefresh = <BasePopover button={button}>{isChecking ? "Checking your logs..." : message}</BasePopover>

    return (
        <div className="flex flex-row">
            {manualRefresh}
            {autoRefresh}
        </div>
    );
}

export default RefreshLogs;