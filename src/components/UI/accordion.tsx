'use client';

import * as React from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

type AccordionDensity = 'default' | 'compact';

const AccordionDensityContext = React.createContext<AccordionDensity>('default');

/** Scopes Accordion + nest-view chrome to a tighter LogGrid-style density. */
export function AccordionDensityProvider({
  density,
  className,
  children,
}: {
  density: AccordionDensity;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <AccordionDensityContext.Provider value={density}>
      <div
        data-accordion-density={density}
        className={cn(
          density === 'compact' && [
            'font-mono text-[11px] leading-snug',
            // Leaf views still use Interface tokens (text-title / text-body / p-2).
            '[&_.text-title]:font-mono [&_.text-title]:text-[11px] [&_.text-title]:font-normal [&_.text-title]:leading-snug',
            '[&_.text-body]:font-mono [&_.text-body]:text-[11px] [&_.text-body]:leading-snug',
            '[&_.text-caption]:text-[10px]',
            '[&_svg]:h-3 [&_svg]:w-3',
            // Expand/collapse-all ActionButtons (absolute right cluster), not AccordionTrigger.
            '[&_.absolute.right-5_button]:h-5 [&_.absolute.right-5_button]:min-h-0 [&_.absolute.right-5_button]:w-5 [&_.absolute.right-5_button]:p-0',
            // DictionaryView / ListView separators + content indent.
            '[&_.border-b.border-muted]:mb-0 [&_.border-b.border-muted]:pb-0',
            '[&_.border-l.border-l-muted]:ml-2 [&_.border-l.border-l-muted]:pl-1.5',
            '[&_.rounded.border.p-2]:p-1',
            '[&_.space-y-4]:space-y-1',
            '[&_.space-y-3]:space-y-1',
            '[&_.space-y-2]:space-y-0.5',
            '[&_.gap-2]:gap-1',
          ],
          className
        )}
      >
        {children}
      </div>
    </AccordionDensityContext.Provider>
  );
}

function useAccordionDensity(): AccordionDensity {
  return React.useContext(AccordionDensityContext);
}

const Accordion = AccordionPrimitive.Root;

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => {
  const density = useAccordionDensity();
  return (
    <AccordionPrimitive.Item
      ref={ref}
      className={cn(
        density !== 'compact' && 'border-b',
        className,
        // Win over DictionaryView/ListView separator padding (pb-2 mb-2).
        density === 'compact' && 'border-border/40 mb-0 border-b pb-0 last:border-b-0'
      )}
      {...props}
    />
  );
});
AccordionItem.displayName = 'AccordionItem';

interface AccordionTriggerProps extends React.ComponentPropsWithoutRef<
  typeof AccordionPrimitive.Trigger
> {
  hideChevron?: boolean;
}
const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  AccordionTriggerProps
>(({ className, children, hideChevron = false, ...props }, ref) => {
  const density = useAccordionDensity();
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        ref={ref}
        className={cn(
          'group flex flex-1 items-center justify-between transition-all',
          density === 'compact'
            ? 'py-0.5 font-mono text-[11px] font-normal leading-snug hover:no-underline'
            : 'text-title py-4 hover:underline',
          className
        )}
        {...props}
      >
        {children}
        {!hideChevron && (
          <ChevronRight
            className={cn(
              'shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-90',
              density === 'compact' ? 'h-3 w-3' : 'h-4 w-4'
            )}
          />
        )}
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
});
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

type ContentProps = React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content> & {
  outerClassName?: string;
};
const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  ContentProps
>(({ className, outerClassName, children, ...props }, ref) => {
  const density = useAccordionDensity();
  return (
    <AccordionPrimitive.Content
      ref={ref}
      className={cn(
        'data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden transition-all',
        density === 'compact' ? 'font-mono text-[11px] leading-snug' : 'text-body',
        outerClassName
      )}
      {...props}
    >
      <div className={cn(density === 'compact' ? 'pb-0.5 pt-0' : 'pb-4 pt-0', className)}>
        {children}
      </div>
    </AccordionPrimitive.Content>
  );
});
AccordionContent.displayName = AccordionPrimitive.Content.displayName;

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent, useAccordionDensity };
