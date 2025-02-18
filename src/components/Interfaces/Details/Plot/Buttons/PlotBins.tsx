"use client";

import BaseDropdown from "@/components/Common/Dropdowns/Base";
import { ChartColumnBig } from "lucide-react";
import SettingButton from "@/components/Common/Buttons/Setting";
import SliderWithValue from "@/components/Common/Sliders/WithValue";

const PlotBins = ({binCount, setBinCount, binCounts}: {
    binCount: number,
    binCounts: number[],
    setBinCount: (newValue: string | undefined) => void
}) => {
    const button = <SettingButton icon={<ChartColumnBig/>} tooltip={"Bin count"} variant={"outline"}/>
    const setValue = (value: any) => {
        let update;
        if (typeof value === "number") {
            if (value < binCounts[0]) update = binCounts[0]
            else if (value > binCounts[1]) update = binCounts[1]
            else update = value
        } 
        else update = binCounts[0]
        setBinCount(update.toString())
    }
    return (
        <BaseDropdown button={button} side="left">
            <SliderWithValue label="Bin count" value={binCount} setValue={setValue} ticks={binCounts}/>
        </BaseDropdown>
    );
}

export default PlotBins;
