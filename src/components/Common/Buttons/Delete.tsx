import BaseButton from "./Base";
import { LoaderCircle } from "lucide-react";

export default function DeleteButton ({disabled = false, onClick, loading}: {loading?: boolean, disabled?: boolean, onClick?: () => void}) {
    return <BaseButton 
        icon={loading ? <LoaderCircle className="animate-spin text-white"/> : undefined} 
        text="Delete" 
        disabled={disabled || loading} 
        variant="destructive" 
        type="button" 
        onClick={onClick}
    />
}
