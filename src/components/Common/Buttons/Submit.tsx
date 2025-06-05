import { ReactNode } from "react";
import BaseButton from "./Base";
import { LoaderCircle } from "lucide-react";

export default function SubmitButton ({text = "Submit", icon, disabled = false, onClick, loading}: {
    text?: string,
    icon?: ReactNode,
    disabled?: boolean,
    onClick?: () => void,
    loading?: boolean
}) {
    return <BaseButton text={text} disabled={disabled || loading} type="submit" onClick={onClick} icon={loading ? <LoaderCircle className="animate-spin text-white"/> : icon}/>
}
