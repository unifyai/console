import { Tooltip as TooltipMenu, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip"
import { ReactNode } from "react";

export default function Tooltip ({children, content}: {children: ReactNode, content: string}) {
  return (
    <TooltipProvider>
      <TooltipMenu>
        <TooltipTrigger>
          {children}
        </TooltipTrigger>
        <TooltipContent>
          <p>{content}</p>
        </TooltipContent>
      </TooltipMenu>
    </TooltipProvider>
  )
}
