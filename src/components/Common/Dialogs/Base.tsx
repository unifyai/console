
import { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/UI/dialog";

export default function BaseDialog ({button, title, description, body, footer, open, setOpen, onOpen, disabled, triggerClassName}: {
    button: ReactNode, 
    title: string, 
    body: ReactNode, 
    footer?: ReactNode
    description?: string, 
    open?: boolean,
    disabled?: boolean,
    triggerClassName?: string,
    setOpen?: (open: boolean) => void,
    onOpen?: () => void,
}) {
  const onOpenChange = (o: boolean) => {
    if (onOpen && o) onOpen()
    if (setOpen) setOpen(o)
  }
  return (
    <Dialog open={open} onOpenChange={(o) => onOpenChange(o)}>

      <DialogTrigger disabled={disabled} className={triggerClassName}>
        {button}
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[600px]">
        
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && 
            <DialogDescription>
              {description}
            </DialogDescription>
          }
        </DialogHeader>
        
        {body}
        
        {footer && 
          <DialogFooter>
            {footer}
          </DialogFooter>
        }
      
      </DialogContent>
    </Dialog>
  )
}
