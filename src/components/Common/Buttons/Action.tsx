import { ReactNode } from "react";
import BaseButton from "./Base";
import Tooltip from "../Misc/Tooltip";
import { MouseEventHandler } from "react";

export default function ActionButton ({tooltip, text, icon, variant, size, disabled = false, onClick, className}: {
    tooltip: string,
    text?: string,
    icon?: ReactNode,
    size?: "icon" | "default" | "sm" | "lg" | null | undefined,
    variant?: "primary" | "secondary" | "destructive" | "outline" | "ghost" | "link",
    disabled?: boolean,
    onClick?: MouseEventHandler<HTMLButtonElement>,
    className?: string
}) {
    return <Tooltip content={tooltip}>
        <BaseButton
            variant={variant ? variant : "ghost"}
            size={size}
            disabled={disabled}
            icon={icon}
            text={text}
            onClick={onClick}
            className={className}
        />
    </Tooltip>
}
