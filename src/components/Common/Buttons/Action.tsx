import { ReactNode } from "react";
import BaseButton from "./Base";
import Tooltip from "../Misc/Tooltip";
import { MouseEventHandler } from "react";

export default function ActionButton ({tooltip, text, icon, variant, onClick, className}: {
    tooltip: string,
    text?: string,
    icon?: ReactNode,
    variant?: "secondary" | "destructive" | "outline" | "ghost" | "link",
    onClick?: MouseEventHandler<HTMLButtonElement>,
    className?: string
}) {
    return <Tooltip content={tooltip}>
        <BaseButton variant={variant ? variant : "ghost"} icon={icon} text={text} onClick={onClick} className={className}/>
    </Tooltip>
}
