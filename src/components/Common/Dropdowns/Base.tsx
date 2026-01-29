import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from '@/components/UI/dropdown-menu';
import { Dispatch, ReactNode, SetStateAction, useEffect, ComponentPropsWithoutRef } from 'react';
import TileDropdownContent from './TileDropdownContent';

type DropdownContentProps = Omit<ComponentPropsWithoutRef<typeof DropdownMenuContent>, 'children'>;
interface BaseDropdownOwnProps {
  button: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  setOpen?: Dispatch<SetStateAction<boolean>>;
  context?: string;
  children: ReactNode;
}
type BaseDropdownProps = BaseDropdownOwnProps & DropdownContentProps;

export default function BaseDropdown({
  button,
  open,
  defaultOpen,
  setOpen,
  context,
  children,
  side = 'bottom',
  ...restContentProps
}: BaseDropdownProps) {
  console.log('[ContextSwitch] BaseDropdown rendered', {
    open,
    defaultOpen,
    context,
    hasSetOpen: !!setOpen,
  });

  useEffect(() => {
    if (defaultOpen && setOpen) {
      console.log('[ContextSwitch] BaseDropdown useEffect - setting open to true (defaultOpen)');
      setOpen(true);
    }
  }, [defaultOpen, setOpen]);

  const dropdownMenuContent =
    context === 'tile' ? (
      <TileDropdownContent side={side} {...restContentProps}>
        {children}
      </TileDropdownContent>
    ) : (
      <DropdownMenuContent side={side} {...restContentProps}>
        {children}
      </DropdownMenuContent>
    );

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(newOpen) => {
        console.log('[ContextSwitch] BaseDropdown DropdownMenu onOpenChange', {
          newOpen,
          currentOpen: open,
          context,
        });
        setOpen?.(newOpen);
      }}
    >
      <DropdownMenuTrigger>{button}</DropdownMenuTrigger>
      <DropdownMenuPortal>{dropdownMenuContent}</DropdownMenuPortal>
    </DropdownMenu>
  );
}
