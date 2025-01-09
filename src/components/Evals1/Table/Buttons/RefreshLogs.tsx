"use client";

import ActionButton from "@/components/Common/Buttons/Action";
import { RefreshCw, Power } from "lucide-react";
import { useEffect, useState } from "react";
import { useQueryState, parseAsFloat, parseAsBoolean } from "nuqs";
import { BasePopover } from "@/components/Common/Popovers/Base";

const RefreshLogs = ({auto, setAuto, context, setContext, project, filterExpression, sortingExpression, getLatest}: {
    auto: string | undefined,
    setAuto: (auto: string | undefined) => void,
    context: string | null,
    setContext: (context: string | undefined) => void,
    project: string,
    filterExpression: string | null,
    sortingExpression: string | null,
    getLatest: (project: string, context: string | null, filterExpression: string | null, sortingExpression: string | null, limit: number | null, offset: number) => Promise<string>,
}) => {

    /* Auto refresh */
    // We use the context argument to trigger a refresh of the logs.
    // A context that ends with "/" is equivalent to the same context without the final "/"
    // Likewise, a null context is equivalent to an empty string context
    const updateContext = () => {
        if (context === undefined)
            setContext("")
        else if (context === "")
            setContext(undefined)
        else if (context![-1] === "/")
            setContext(context!.slice(0, -1))
        else 
            setContext(context + "/")
    }
    useEffect(() => {
        if ([undefined, "false"].includes(auto)) return;
        const interval = setInterval(() => updateContext(), 100) // Refresh every 100ms
        return () => clearInterval(interval)
    }, [auto])
    const onAutoClick = () => setAuto(auto === "true" ? "false" : "true")
    const autoRefresh = 
        <ActionButton
            variant={auto === "true" ? "primary" : "outline"}
            className="rounded-none rounded-tr-lg rounded-br-lg"
            icon={<Power/>}
            tooltip={"Auto refresh every 100ms"}
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

    useEffect(() => {getLatest(project, context, filterExpression, sortingExpression, null, 0).then(latest => setLastUpdated(latest))}, [])
    
    const onManualClick = () => {
        setIsChecking(true)
        getLatest(project, context, filterExpression, sortingExpression, null, 0).then(latest => {
            const latestTs = new Date(latest).getTime();
            const lastCheckTs = new Date(lastUpdated).getTime()
            if (latestTs > lastCheckTs) {
                updateContext()
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