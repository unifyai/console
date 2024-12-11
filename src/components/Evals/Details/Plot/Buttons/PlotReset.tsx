"use client";

import SettingButton from "@/components/Common/Buttons/Setting";
import { RefreshCcw } from "lucide-react";
import { Dispatch, SetStateAction } from "react";

const PlotReset = ({setSelectedXAxisProperty, setSelectedYAxisProperty, setGroupByProperty}: {
    setSelectedXAxisProperty: (x: string | null) => void,
    setSelectedYAxisProperty: (x: string | null) => void,
    setGroupByProperty: (x: string | null) => void
}) => {
    const onClick = () => {
        setSelectedXAxisProperty(null);
        setSelectedYAxisProperty(null);
        setGroupByProperty(null);
      };
    return (
        <SettingButton
            icon={<RefreshCcw/>}
            tooltip="Reset settings"
            onClick={onClick}
        />
    )
}

export default PlotReset;
