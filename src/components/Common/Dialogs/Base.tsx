
import { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/UI/dialog";

export default function BaseDialog ({button, title, description, body, footer, open, setOpen}: {
    button: ReactNode, 
    title: string, 
    body: ReactNode, 
    footer?: ReactNode
    description?: string, 
    open?: boolean,
    setOpen?: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>

      <DialogTrigger>
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
