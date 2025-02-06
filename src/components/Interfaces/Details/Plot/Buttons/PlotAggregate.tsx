"use client";

import SettingButton from "@/components/Common/Buttons/Setting";
import { Group, Ungroup } from "lucide-react";

const PlotAggregate = ({isAggregated, setIsAggregated}: {
    isAggregated: string | undefined, 
    setIsAggregated: (value: string | undefined) => void
}) => {
    return (
        <SettingButton
            icon={isAggregated === "true" ? <Ungroup/> : <Group/>}
            tooltip={`${isAggregated === "true" ? "Split data" : "Aggregate data"}`}
            onClick={() => setIsAggregated(isAggregated === "true" ? "false" : "true")}
        />
    );
}

export default PlotAggregate