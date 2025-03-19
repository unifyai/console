import { DropdownMenu, DropdownMenuContent,  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/UI/dropdown-menu"  
import { Dispatch, ReactNode, SetStateAction, useEffect } from "react";

export default function BaseDropdown ({button, open, defaultOpen, setOpen, side = "bottom", children}: {
    button: ReactNode,
    open?: boolean,
    defaultOpen?: boolean,
    setOpen?: Dispatch<SetStateAction<boolean>>
    side?: "top" | "bottom" | "left" | "right",
    children: ReactNode
}) {
    useEffect(() => {
        if (defaultOpen && setOpen)
            setOpen(true);
    }, [defaultOpen]);

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
