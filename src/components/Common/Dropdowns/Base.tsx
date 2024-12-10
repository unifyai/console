import { DropdownMenu, DropdownMenuContent,  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/UI/dropdown-menu"  
import { ReactNode } from "react";

export default function BaseDropdown ({button, label, children}: {
    button: ReactNode,
    label?: string,
    children: ReactNode
}) {
    return (    
    <DropdownMenu>
        <DropdownMenuTrigger>
            {button}
        </DropdownMenuTrigger>
        <DropdownMenuContent>
            {label &&
            <>
                <DropdownMenuLabel>{label}</DropdownMenuLabel>
                <DropdownMenuSeparator />
            </>
            }
            {children}
        </DropdownMenuContent>
    </DropdownMenu>
    );
}
