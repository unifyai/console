"use client";

import SettingButton from "@/components/Common/Buttons/Action";
import { X } from "lucide-react";

const CloseProject = ({onClick, variant="outline"}: {onClick: () => void, variant?: "outline" | "ghost"}) => {
    const icon = <X/>
    const tooltip = "Close project"
    return <SettingButton icon={icon} tooltip={tooltip} onClick={onClick} variant={variant}/>
}

export default CloseProject;