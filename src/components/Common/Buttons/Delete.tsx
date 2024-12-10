import BaseButton from "./Base";

export default function DeleteButton ({disabled = false, onClick}: {disabled?: boolean, onClick?: () => void}) {
    return <BaseButton text="Delete" disabled={disabled} variant="destructive" type="button" onClick={onClick}/>
}
