import BaseButton from "./Base";
import { LoaderCircle } from "lucide-react";

export default function DeleteButton ({disabled = false, onClick, loading, deleteText = "Delete"}: {loading?: boolean, disabled?: boolean, onClick?: () => void, deleteText?: string}) {
    return <BaseButton 
        icon={loading ? <LoaderCircle className="animate-spin text-destructive-foreground"/> : undefined} 
        text={deleteText} 
        disabled={disabled || loading} 
        variant="destructive" 
        type="button" 
        onClick={onClick}
    />
}