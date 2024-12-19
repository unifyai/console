import BaseButton from "./Base";
import { ReactNode } from "react";
import Tooltip from "../Misc/Tooltip";
import { MouseEventHandler } from "react";

export default function SettingButton ({tooltip, disabled = false, icon, onClick, variant = "outline"}: {
    tooltip: string, 
    disabled?: boolean, 
    icon: ReactNode, 
    onClick?: MouseEventHandler<HTMLButtonElement>, 
    variant?: "default" | "primary" | "secondary" | "destructive" | "outline" | "ghost" | "link";
}) {
    return (  
        <Tooltip content={tooltip}>
            <BaseButton icon={icon} disabled={disabled}  variant={variant} type="button" onClick={onClick}/>
        </Tooltip>
    );
}
