"use client";

import SettingButton from "@/components/Common/Buttons/Setting";
import { Sigma, LoaderCircle } from "lucide-react";
import { LogProps } from "@/types/evals/logs";
import { useEffect, useState } from "react";

const PlotAggregate = ({isAggregated, setIsAggregated, logs}: {
    isAggregated: string, 
    setIsAggregated: (x: string | undefined) => void,
    logs: LogProps[] | undefined
}) => {

    /* Display loader when data updates */
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        setLoading(false);
    },[logs])

    /* Main button parts */
    const spinnerColor = isAggregated === "true" ? "text-white" : "text-primary"
    const icon = loading ? <LoaderCircle className={`animate-spin ${spinnerColor}`}/> : <Sigma/> 
    const tooltip = isAggregated === "true" ? "Use raw logs as data points" : "Use reduction metrics as data points" 
    const variant = isAggregated === "true" ? "primary" : "outline"
    const onClick = () => {
        setIsAggregated(isAggregated === "true" ? "false" : "true")
        setLoading(true)
    }

    return (
        <SettingButton icon={icon} tooltip={tooltip} onClick={onClick} variant={variant}/>
    );
}

export default PlotAggregate