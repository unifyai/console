import BaseButton from "./Base";
import { ReactNode } from "react";
import Tooltip from "../Misc/Tooltip";
import { MouseEventHandler } from "react";

export default function SettingButton ({tooltip, disabled = false, icon, onClick, text, variant = "outline"}: {
    tooltip: string, 
    disabled?: boolean, 
    icon: ReactNode, 
    onClick?: MouseEventHandler<HTMLButtonElement>,
    text?: string,
    variant?: "default" | "primary" | "secondary" | "destructive" | "outline" | "ghost" | "link";
}) {
    return (  
        <Tooltip content={tooltip}>
            <BaseButton icon={icon} disabled={disabled} text={text} variant={variant} type="button" onClick={onClick}/>
        </Tooltip>
    );
}
