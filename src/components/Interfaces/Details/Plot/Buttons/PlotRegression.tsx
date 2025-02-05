"use client";

import SettingButton from "@/components/Common/Buttons/Setting";
import { MdLinearScale } from "react-icons/md";

const PlotRegression = ({showRegression, setShowRegression}: {showRegression: string, setShowRegression: (x: string | undefined) => void}) => {
    const tooltip = showRegression ? "Hide line of best fit" : "Show line of best fit" 
    const variant = showRegression === "true" ? "primary" : "outline"
    return (
        <SettingButton
            icon={<MdLinearScale/>}
            tooltip={tooltip}
            onClick={() => setShowRegression(showRegression === "true" ? "false" : "true")}
            variant={variant}
        />
    );
}

export default PlotRegression