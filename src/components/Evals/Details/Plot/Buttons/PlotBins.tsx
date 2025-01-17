"use client";

import BaseDropdown from "@/components/Common/Dropdowns/Base";
import { ChartColumnBig } from "lucide-react";
import SettingButton from "@/components/Common/Buttons/Setting";
import SliderWithValue from "@/components/Common/Sliders/WithValue";

const PlotBins = ({binCount, setBinCount, binCounts}: {
    binCount: number,
    binCounts: number[],
    setBinCount: (binCount: number) => void
}) => {
    const button = <SettingButton icon={<ChartColumnBig/>} tooltip={"Bin count"} variant={"outline"}/>
    return (
        <BaseDropdown button={button} side="left">
            <SliderWithValue label="Bin count" value={binCount} setValue={setBinCount} ticks={binCounts}/>
        </BaseDropdown>
    );
}

export default PlotBins;
