"use client";

import { useState, useEffect } from "react";
import ActionButton from "@/components/Common/Buttons/Action";
import { LoaderCircle } from "lucide-react";
import { LogProps, GroupedLogProps } from "@/types/evals/logs";

const ResetServerAction = ({interactive, setterFunction, logs, icon, type, condition}: {
    interactive: boolean,
    setterFunction: () => void,
    logs: LogProps[] | GroupedLogProps[],
    icon: JSX.Element,
    type: string,
    condition: boolean
}) => {
    
    /* Display loader when data updates */
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        setLoading(false);
    },[logs])

    /* Filter reset button */
    const resetIcon = loading ? <LoaderCircle className="animate-spin text-primary"/> : icon
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