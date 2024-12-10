import BaseButton from "./Base";
import { ReactNode } from "react";
import Tooltip from "../Misc/Tooltip";
import { MouseEventHandler } from "react";

export default function SettingButton ({tooltip, disabled = false, icon, onClick}: {tooltip: string, disabled?: boolean, icon: ReactNode, onClick?: MouseEventHandler<HTMLButtonElement>}) {
    return (  
        <Tooltip content={tooltip}>
            <BaseButton icon={icon} disabled={disabled}  variant="outline" type="button" onClick={onClick}/>
        </Tooltip>
    );
}
