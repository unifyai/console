import { DropdownMenu, DropdownMenuContent,  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/UI/dropdown-menu"  
import { Dispatch, ReactNode, SetStateAction } from "react";

export default function BaseDropdown ({button, open, setOpen, side = "bottom", children}: {
    button: ReactNode,
    open?: boolean,
    setOpen?: Dispatch<SetStateAction<boolean>>
    side?: "top" | "bottom" | "left" | "right",
    children: ReactNode
}) {
    return (    
    <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger>
            {button}
        </DropdownMenuTrigger>
        <DropdownMenuContent side={side}>
            {children}
        </DropdownMenuContent>
    </DropdownMenu>
    );
}
