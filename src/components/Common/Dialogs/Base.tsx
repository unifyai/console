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
    /** When true, the dialog cannot be closed via ESC key, outside click or the ✕ button */
    disableClose?: boolean;
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
    disableClose,
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
        {title && <DialogTitle className="text-h3">{title}</DialogTitle>}
        {description &&
            <DialogDescription className="text-body">
                {description}
            </DialogDescription>
        }
      </DialogHeader>

      {body}

      {footer &&
          <DialogFooter className="w-full">
              {footer}
          </DialogFooter>
      }
    </>
    const interactionHandlers = disableClose ? {
        onInteractOutside: (e: any) => e.preventDefault(),
        onEscapeKeyDown: (e: any) => e.preventDefault()
    } : {};

    const extraProps = { ...interactionHandlers, hideClose: disableClose } as any;
    const dialogContent = (context === "tile")
    ? <TileDialogContent {...restContentProps} {...extraProps}>{dialogContentChildren}</TileDialogContent> 
    : <DialogContent {...restContentProps} {...extraProps}>{dialogContentChildren}</DialogContent>
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogTrigger disabled={disabled} className={triggerClassName}>
              {button}
          </DialogTrigger>
          {dialogContent}
        </Dialog>
    );
}