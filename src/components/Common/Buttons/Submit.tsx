import { ReactNode } from "react";
import BaseButton from "./Base";
import { LoaderCircle } from "lucide-react";

export default function SubmitButton ({text = "Submit", icon, disabled = false, onClick, loading, className}: {
    text?: string,
    icon?: ReactNode,
    disabled?: boolean,
    onClick?: () => void,
    loading?: boolean,
    className?: string
}) {
    return <BaseButton text={text} disabled={disabled || loading} type="submit" onClick={onClick} icon={loading ? <LoaderCircle className={`${className} animate-spin text-primary-foreground`}/> : icon}/>
}
