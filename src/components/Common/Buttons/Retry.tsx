import BaseButton from "./Base";

export default function RetryButton ({text = "Try Again", disabled = false, onClick}: {
    text?: string
    disabled?: boolean,
    onClick?: () => void
}) {
    return <BaseButton text={text} disabled={disabled} onClick={onClick}/>
}
