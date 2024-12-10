import BaseButton from "./Base";

export default function SubmitButton ({text = "Submit", disabled = false, onClick}: {
    text?: string
    disabled?: boolean,
    onClick?: () => void
}) {
    return <BaseButton text={text} disabled={disabled} type="submit" onClick={onClick}/>
}
