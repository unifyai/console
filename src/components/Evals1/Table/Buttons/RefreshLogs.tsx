"use client";

import ActionButton from "@/components/Common/Buttons/Action";
import { RefreshCw, ChevronDown } from "lucide-react";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import { DropdownMenuItem } from "@/components/UI/dropdown-menu";
import { useEffect } from "react";
import { useQueryState, parseAsFloat } from "nuqs";

const RefreshLogs = () => {
    
    /* Auto refresh */

    // Handle intervals 
    const [auto, setAuto] = useQueryState("auto_refresh", parseAsFloat.withDefault(0))
    const intervals = [0, 5, 30, 60] // Minutes
    const MINUTE_MS = auto * 60000;

    useEffect(() => {
        if (MINUTE_MS === 0) return;
        const interval = setInterval(() => window.location.reload(), MINUTE_MS)
        return () => clearInterval(interval)
    }, [MINUTE_MS])

    // Subcomponents
    const button = <ActionButton
        className="rounded-none rounded-tr-lg rounded-br-lg"
        variant="outline"
        icon={<ChevronDown/>}
        aria-label="Options"
        tooltip="Auto refresh"
    />
    const label = "Set up auto refresh interval"
    const choice = (interval: number) => interval === 0 ? "Disable auto refresh" : `Every ${interval} minutes`
    const autoRefresh = 
    <BaseDropdown 
        button={button} 
        label={label}
    >
        {intervals.map((interval, index) => 
            <DropdownMenuItem key={index} onClick={() => setAuto(interval)}>
                {choice(interval)}
            </DropdownMenuItem>
        )}
    </BaseDropdown>

    /* Manual refresh */
    const manualRefresh = 
    <ActionButton 
        variant={auto != 0 ? "primary" : "outline"}
        className="rounded-none rounded-tl-lg rounded-bl-lg h-8"
        icon={<RefreshCw/>}
        tooltip="Refresh logs"
        onClick={() => window.location.reload()}
    />

    return (
        <div className="flex flex-row">
            {manualRefresh}        
            {autoRefresh}
        </div>
    );
}

export default RefreshLogs;