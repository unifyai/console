"use client";

import SettingButton from "@/components/Common/Buttons/Action";
import { X } from "lucide-react";

const CloseProject = ({onClick}: {onClick: () => void}) => {
    const icon = <X/>
    const tooltip = "Close project"
    return <SettingButton icon={icon} tooltip={tooltip} onClick={onClick} variant="outline"/>
}

export default CloseProject;