"use client";

import SettingButton from "@/components/Common/Buttons/Setting";
import { RefreshCcw } from "lucide-react";
import { Dispatch, SetStateAction } from "react";

const PlotReset = ({setSelectedXAxisProperty, setSelectedYAxisProperty, setGroupByProperty}: {
    setSelectedXAxisProperty: (x: string | undefined) => void,
    setSelectedYAxisProperty: (x: string | undefined) => void,
    setGroupByProperty: (x: string | undefined) => void
}) => {
    const onClick = () => {
        setSelectedXAxisProperty(undefined);
        setSelectedYAxisProperty(undefined);
        setGroupByProperty(undefined);
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
