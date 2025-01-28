"use client";

import { Dispatch, SetStateAction } from "react";
import SettingButton from "@/components/Common/Buttons/Setting";
import { ChartLine } from "lucide-react";

const PlotScale = ({scale, setScale, logScaleEnabled}: {scale: string, setScale: (x: string | undefined) => void, logScaleEnabled: boolean}) => {
    const tooltip = logScaleEnabled ? `${scale} scale` : "Log scale invalid for non-positive data"
    return (
        <SettingButton
            icon={<ChartLine/>}
            tooltip={tooltip}
            onClick={() => setScale(scale === "log" ? "linear" : "log")}
            disabled={!logScaleEnabled}
        />
    );
}

export default PlotScale