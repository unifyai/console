import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/popover';
import { Dispatch, ReactNode, SetStateAction, ComponentPropsWithoutRef } from 'react';
import TilePopoverContent from './TilePopoverContent';

type PopoverContentProps = Omit<
  ComponentPropsWithoutRef<typeof PopoverContent>,
  'children' | 'className'
>;
interface BasePopoverOwnProps {
  button: ReactNode;
  open?: boolean;
  setOpen?: Dispatch<SetStateAction<boolean>>;
  className?: string;
  context?: string;
  children: ReactNode;
}
type BasePopoverProps = BasePopoverOwnProps & PopoverContentProps;

export function BasePopover({
  button,
  open,
  setOpen,
  className,
  context,
  children,
  ...restContentProps
}: BasePopoverProps) {
  const finalClassName = `${className ? className : 'w-fit px-[20px]'}`;

  const popoverContent =
    context === 'tile' ? (
      <TilePopoverContent className={finalClassName} {...restContentProps}>
        {children}
      </TilePopoverContent>
    ) : (
      <PopoverContent className={finalClassName} {...restContentProps}>
        {children}
      </PopoverContent>
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>{button}</PopoverTrigger>
      {popoverContent}
    </Popover>
  );
}
