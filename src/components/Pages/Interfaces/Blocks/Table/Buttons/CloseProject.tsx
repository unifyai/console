"use client";

import SettingButton from "@/components/Common/Buttons/Action";
import { X } from "lucide-react";

const CloseProject = ({onClick, text, variant="outline"}: {onClick: () => void, text?: string, variant?: "outline" | "ghost"}) => {
    const icon = <X/>
    const tooltip = "Close project"
    return <SettingButton icon={icon} tooltip={tooltip} onClick={onClick} variant={variant} text={text}/>
}

export default CloseProject;