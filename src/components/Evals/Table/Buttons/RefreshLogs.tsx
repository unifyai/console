"use client";

import ActionButton from "@/components/Common/Buttons/Action";
import { RefreshCw, Power } from "lucide-react";
import { useEffect, useState } from "react";
import { useQueryState, parseAsBoolean } from "nuqs";
import { BasePopover } from "@/components/Common/Popovers/Base";

const RefreshLogs = ({context, project, filterExpression, sortingExpression, getLatest}: {
    context: string | null,
    project: string,
    filterExpression: string | null,
    sortingExpression: string | null,
    getLatest: (project: string, context: string | null, filterExpression: string | null, sortingExpression: string | null, from_fields: string | null, limit: number | null, offset: number) => Promise<string>,
}) => {

    /* Auto refresh */

    const [auto, setAuto] = useQueryState("auto_refresh", parseAsBoolean.withDefault(false))
    const [_timestamp, setTimestamp] = useQueryState("_timestamp", { shallow: false })

    // We use timestamp to tag fetch api calls to trigger revalidation every two seconds
    useEffect(() => {
        if (!auto) return;
        const interval = setInterval(() => setTimestamp(Date.now().toString()), 2000) // Refresh every 2000ms
        return () => clearInterval(interval)
    }, [auto])
    const onAutoClick = () => setAuto(!auto)
    const autoRefresh = 
        <ActionButton
            variant={auto ? "primary" : "outline"}
            className="rounded-none rounded-tr-lg rounded-br-lg"
            icon={<Power/>}
            tooltip={"Auto refresh every 2 seconds"}
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

    useEffect(() => {getLatest(project, context, filterExpression, sortingExpression, null, null, 0).then(latest => setLastUpdated(latest))}, [])
    
    const onManualClick = () => {
        setIsChecking(true)
        getLatest(project, context, filterExpression, sortingExpression, null, null, 0).then(latest => {
            const latestTs = new Date(latest).getTime();
            const lastCheckTs = new Date(lastUpdated).getTime()
            if (latestTs > lastCheckTs) {
                setTimestamp(Date.now().toString())
                setLastUpdated(latest)
                setMessage(messages.updated)
            } else {
                setMessage(messages.stale)
            }
            setIsChecking(false)
        }
    )}
    
    const button = 
        <ActionButton 
            variant="outline"
            className="rounded-none rounded-tl-lg rounded-bl-lg h-8"
            icon={<RefreshCw/>}
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