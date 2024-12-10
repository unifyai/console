"use client";

import { Dispatch, SetStateAction } from "react";
import SettingButton from "@/components/Common/Buttons/Setting";
import { ChartLine } from "lucide-react";

const PlotScale = ({scale, setScale}: {scale: string, setScale: (x: string | null) => void}) => {
    return (
        <SettingButton
            icon={<ChartLine/>}
            tooltip={`${scale} scale`}
            onClick={() => setScale(scale === "log" ? "linear" : "log")}
        />
    );
}

export default PlotScale