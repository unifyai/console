"use client";

import BaseDropdown from "@/components/Common/Dropdowns/Base";
import { ChartColumnBig } from "lucide-react";
import SettingButton from "@/components/Common/Buttons/Setting";
import SliderWithValue from "@/components/Common/Sliders/WithValue";

const PlotBins = ({binCount, setBinCount, binCounts}: {
    binCount: number,
    binCounts: number[],
    setBinCount: (binCount: string) => void
}) => {
    const ticks = [binCounts[0], Math.min(binCounts[1], 200)]
    const button = <SettingButton icon={<ChartColumnBig/>} tooltip={"Bin count"} variant={"outline"}/>
    const setValue = (value: any) => {
        let update;
        if (typeof value === "number") {
            if (value < ticks[0]) update = ticks[0]
            else if (value > ticks[1]) update = ticks[1]
            else update = value
        } 
        else update = ticks[0]
        setBinCount(update.toString())
    }
    return (
        <BaseDropdown button={button} side="left">
            <SliderWithValue label="Bin count" value={binCount} setValue={setValue} ticks={ticks}/>
        </BaseDropdown>
    );
}

export default PlotBins;
