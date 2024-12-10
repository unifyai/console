import BaseButton from "./Base";

export default function CancelButton ({disabled = false, text = "Cancel", onClick}: {
    disabled?: boolean, 
    text?: string
    onClick?: () => void
}) {
    return <BaseButton
        text={text}
        disabled={disabled}
        variant="secondary"
        type="reset"
        onClick={onClick}
    />
}
