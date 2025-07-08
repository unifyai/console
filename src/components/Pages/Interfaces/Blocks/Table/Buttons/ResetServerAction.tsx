"use client";

import { useState, useEffect } from "react";
import ActionButton from "@/components/Common/Buttons/Action";
import { LoaderCircle, ListX, FilterX, X } from "lucide-react";
import { LogProps, GroupedLogProps } from "@/types/interfaces/logs";

const UngroupX = () => {
    return (
        <svg 
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            className="lucide lucide-ungroup-x"
        >
            <g transform="translate(-2, 1)">
                <rect width="8" height="6" x="5" y="4" rx="1"/>
                <rect width="8" height="6" x="11" y="14" rx="1"/>
            </g> 
            <g transform="translate(0,-8) scale(1.2)">
                <path d="m19 10-4 4"/>
                <path d="m15 10 4 4"/>
            </g>
        </svg>
    )
}

const ResetServerAction = ({interactive, setterFunction, logs, type, condition}: {
    interactive: boolean,
    setterFunction: () => void,
    logs: LogProps[] | GroupedLogProps[],
    type: string,
    condition: boolean
}) => {
    
    /* Display loader when data updates */
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        setLoading(false);
    },[logs])

    /* Filter reset button */
    const icons = {"grouping": <UngroupX/>, "filters": <FilterX/>, "sorting": <ListX/>}
    const resetIcon = loading ? <LoaderCircle className="animate-spin text-primary"/> : icons[type as keyof typeof icons] ?? <X/>
    const resetTooltip = `Reset all ${type}`
    const resetVariant = "warning_outline" 
    const onClick = () => {
        setterFunction()
        setLoading(true);
    }
    const resetDisabled = !interactive || loading 
    const button = <ActionButton icon={resetIcon} tooltip={resetTooltip} variant={resetVariant} onClick={onClick} disabled={resetDisabled}/>
    return (loading || condition) ? button : null

}

export default ResetServerAction