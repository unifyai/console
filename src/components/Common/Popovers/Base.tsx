import { Popover, PopoverContent, PopoverTrigger } from "@/components/UI/popover"
import { ReactNode } from "react"

export function BasePopover({button, children}: {button: ReactNode, children: ReactNode}) {
  return (
    <Popover>
      <PopoverTrigger>
        {button}
      </PopoverTrigger>
      <PopoverContent className="w-fit px-[50px]">
        {children}
      </PopoverContent>
    </Popover>
  )
}
