import { ReactNode, ComponentPropsWithoutRef, CSSProperties } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/UI/dialog";
import TileDialogContent from "./TileDialogContent";

type ForwardedDialogContentProps = Omit<ComponentPropsWithoutRef<typeof DialogContent>, 'children' | 'style'>;
interface BaseDialogOwnProps {
    button: ReactNode;
    body: ReactNode;
    title?: string;
    footer?: ReactNode;
    description?: string;
    open?: boolean;
    disabled?: boolean;
    triggerClassName?: string;
    context?: string;
    setOpen?: (open: boolean) => void;
    onOpen?: () => void;
    style?: CSSProperties;
}
type BaseDialogProps = BaseDialogOwnProps & ForwardedDialogContentProps;

export default function BaseDialog({
    button,
    title,
    description,
    body,
    footer,
    open,
    disabled,
    triggerClassName,
    context,
    setOpen,
    onOpen,
    style: incomingStyle,
    ...restContentProps
}: BaseDialogProps) {
    const onOpenChange = (o: boolean) => {
        if (onOpen && o) onOpen();
        if (setOpen) setOpen(o);
    };
    const dialogContentChildren = 
    <>
      <DialogHeader>
        {title && <DialogTitle>{title}</DialogTitle>}
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
    </>
    const dialogContent = (context === "tile")
    ? <TileDialogContent {...restContentProps}>{dialogContentChildren}</TileDialogContent> 
    : <DialogContent {...restContentProps}>{dialogContentChildren}</DialogContent>
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogTrigger disabled={disabled} className={triggerClassName}>
              {button}
          </DialogTrigger>
          {dialogContent}
        </Dialog>
    );
}