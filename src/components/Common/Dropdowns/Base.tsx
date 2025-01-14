import { DropdownMenu, DropdownMenuContent,  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/UI/dropdown-menu"  
import { Dispatch, ReactNode, SetStateAction } from "react";

export default function BaseDropdown ({button, open, setOpen, label, children}: {
    button: ReactNode,
    open?: boolean,
    setOpen?: Dispatch<SetStateAction<boolean>>
    label?: string,
    children: ReactNode
}) {
    return (    
    <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger>
            {button}
        </DropdownMenuTrigger>
        <DropdownMenuContent>
            {children}
        </DropdownMenuContent>
    </DropdownMenu>
    );
}
