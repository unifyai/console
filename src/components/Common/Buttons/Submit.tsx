import { ReactNode } from "react";
import BaseButton from "./Base";

export default function SubmitButton ({text = "Submit", icon, disabled = false, onClick}: {
    text?: string,
    icon?: ReactNode,
    disabled?: boolean,
    onClick?: () => void
}) {
    return <BaseButton text={text} disabled={disabled} type="submit" onClick={onClick} icon={icon}/>
}
