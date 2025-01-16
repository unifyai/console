"use client";

import BaseDropdown from "@/components/Common/Dropdowns/Base";
import { Space } from "lucide-react";
import SettingButton from "@/components/Common/Buttons/Setting";
import SliderWithValue from "@/components/Common/Sliders/WithValue";

const PlotBins = ({binSize, setBinSize, binSizes}: {
    binSize: number,
    binSizes: number[],
    setBinSize: (binSize: number) => void
}) => {
    const button = <SettingButton icon={<Space/>} tooltip={"Bin size"} variant={"outline"}/>
    return (
        <BaseDropdown button={button} side="left">
            <SliderWithValue value={binSize} setValue={setBinSize} ticks={binSizes}/>
        </BaseDropdown>
    );
}

export default PlotBins;
