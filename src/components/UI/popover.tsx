'use client';

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';

import { cn } from '@/lib/utils';

// Wrapper to add logging to Popover
const Popover = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Root>
>(({ open, onOpenChange, ...props }, ref) => {
  console.log('[ContextSwitch] Popover rendered', { open });

  const handleOpenChange = React.useCallback(
    (newOpen: boolean) => {
      console.log('[ContextSwitch] Popover onOpenChange called', {
        newOpen,
        currentOpen: open,
      });
      onOpenChange?.(newOpen);
    },
    [open, onOpenChange]
  );

  return <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange} {...props} />;
});
Popover.displayName = 'Popover';

// Wrapper to add logging to PopoverTrigger
const PopoverTrigger = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Trigger>
>(({ onClick, ...props }, ref) => {
  const handleClick = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      console.log('[ContextSwitch] PopoverTrigger clicked', {
        target: e.target,
        currentTarget: e.currentTarget,
        defaultPrevented: e.defaultPrevented,
      });
      onClick?.(e);
    },
    [onClick]
  );

  return <PopoverPrimitive.Trigger ref={ref} onClick={handleClick} {...props} />;
});
PopoverTrigger.displayName = 'PopoverTrigger';

const PopoverAnchor = PopoverPrimitive.Anchor;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'center', sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'bg-background/90 border-border/50 z-50 w-72 rounded-md border p-4 text-popover-foreground shadow-md outline-none backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
