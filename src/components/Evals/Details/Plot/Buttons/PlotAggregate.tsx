"use client";

import SettingButton from "@/components/Common/Buttons/Setting";
import { Group, Ungroup } from "lucide-react";
import { Dispatch, SetStateAction } from "react";

const PlotAggregate = ({isAggregated, setIsAggregated}: {
    isAggregated: string | null, 
    setIsAggregated: Dispatch<SetStateAction<string | null>>
}) => {
    return (
        <SettingButton
            icon={isAggregated === "true" ? <Ungroup/> : <Group/>}
            tooltip={`${Boolean(isAggregated) ? "Split data" : "Aggregate data"}`}
            onClick={() => setIsAggregated(aggregated  => aggregated === "true" ? "false" : "true")}
        />
    );
}

export default PlotAggregate