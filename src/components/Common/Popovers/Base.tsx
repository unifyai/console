import { Popover, PopoverContent, PopoverTrigger } from "@/components/UI/popover"
import { Dispatch, ReactNode, SetStateAction } from "react"

export function BasePopover({button, open, setOpen, className, children}: {
  button: ReactNode, 
  open?: boolean,
  setOpen?: Dispatch<SetStateAction<boolean>>,
  className?: string,
  children: ReactNode
}) {
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        {button}
      </PopoverTrigger>
      <PopoverContent className={`${className ? className : "w-fit px-[50px]"}`}>
        {children}
      </PopoverContent>
    </Popover>
  )
}
