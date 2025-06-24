"use client";

import ActionButton from "@/components/Common/Buttons/Action";
import { RefreshCw, Timer, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { useQueryState, parseAsBoolean } from "nuqs";
import { GroupedLogProps, LogProps } from "@/types/evals/logs";

const RefreshLogs = ({context, project, filterExpression, sortingExpression, getLatest, logs}: {
    context: string | null,
    project: string,
    filterExpression: string | null,
    sortingExpression: string | null,
    getLatest: (project: string, context: string | null, filterExpression: string | null, sortingExpression: string | null, from_fields: string | null, exclude_fields: string | null, limit: number | null, offset: number) => Promise<string>,
    logs: LogProps[] | GroupedLogProps[]
}) => {

    /* Auto refresh */

    const [auto, setAuto] = useQueryState("auto_refresh", parseAsBoolean.withDefault(false))
    const [_timestamp, setTimestamp] = useQueryState("_timestamp", { shallow: false })

    // We use timestamp to tag fetch api calls to trigger revalidation every two seconds
    useEffect(() => {
        if (!auto) return;
        const interval = setInterval(() => setTimestamp(Date.now().toString()), 2000) // Refresh every 2000ms
        return () => clearInterval(interval)
    }, [auto, setTimestamp])
    const onAutoClick = () => setAuto(!auto)
    const autoRefresh = 
        <ActionButton
            variant={auto ? "primary" : "outline"}
            className="rounded-none rounded-tr-lg rounded-br-lg"
            icon={<Timer/>}
            tooltip={"Auto refresh every 2 seconds"}
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
    }, [logs, refreshClick]);

    // We compare the timestamp string returned from the get latest timestamp endpoint
    // with the timestamp saved last time the refresh button was used, except the first
    // time where we compare with the timestamp set on loading the component
    
    const [lastUpdated, setLastUpdated] = useState<string>("")

    useEffect(() => {getLatest(project, context, filterExpression, sortingExpression, null, null, null, 0).then(latest => setLastUpdated(latest))}, [project, context, filterExpression, sortingExpression, getLatest])
    
    const onManualClick = () => {
        setLoading(true)
        setRefreshClick(true);
        getLatest(project, context, filterExpression, sortingExpression, null, null, null, 0).then(latest => {
            const latestTs = new Date(latest).getTime();
            const lastCheckTs = new Date(lastUpdated).getTime()
            if (latestTs > lastCheckTs) {
                setTimestamp(Date.now().toString())
                setLastUpdated(latest)
            } else {
                displayLoadCheck();
            }
        }
    )}
    
    const icon = loading 
        ? <RefreshCw className="animate-spin text-green"/> 
        : loaded
            ?   <Check className="text-green"/>
            :   <RefreshCw/>
    const manualRefresh = <ActionButton 
        variant="outline"
        className="rounded-none rounded-tl-lg rounded-bl-lg h-8"
        icon={icon}
        tooltip="Refresh logs"
        onClick={() => onManualClick()}
        disabled={loading}
    />

    return (
        <div className="flex flex-row">
            {manualRefresh}        
            {autoRefresh}
        </div>
    );
}

export default RefreshLogs;