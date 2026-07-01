import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex h-auto shrink-0 items-center self-center whitespace-nowrap rounded-md border px-1.5 py-0.5 text-caption text-strong transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-border bg-[var(--surface)] text-muted-foreground',
        primary:
          'border-transparent bg-primary text-primary-foreground shadow-[0_1px_0_var(--role-green-deep)] hover:bg-primary',
        secondary:
          'border-border bg-secondary text-secondary-foreground hover:bg-[var(--surface-hover)]',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
        outline: 'border-border bg-transparent text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />;
  }
);
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
