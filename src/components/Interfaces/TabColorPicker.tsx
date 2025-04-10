"use client";

import ColorPicker from "../Common/Misc/ColorPicker";
import ActionButton from "../Common/Buttons/Action";
import { useTileUI } from "@/contexts/hooks";
import { Palette } from "lucide-react";

const TabColorPicker = ({tileName, tabName, interfaceName}: {
    tileName: string,
    tabName: string,
    interfaceName: string
}) => {

    const {ui: tileUIState, uiActions: tileUIActions} = useTileUI(tileName, tabName, interfaceName);

    return (
        <ColorPicker
            value={tileUIState?.color ?? getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()}
            onChange={(color) => tileUIActions?.setColor(color)}
        >
            <ActionButton 
                className="cursor-pointer hover:z-10"
                icon={<Palette/>} 
                variant="outline" 
                tooltip="Change tile primary color"
            />
        </ColorPicker>
    )
}
export default TabColorPicker;