import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type BrandStatusTone = 'neutral' | 'accent' | 'danger';

const toneClasses: Record<BrandStatusTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  accent: 'bg-accent-soft text-accent-soft-foreground',
  danger: 'bg-[color:var(--status-danger-bg)] text-destructive',
};

export interface BrandStatusCardProps {
  eyebrow: string;
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  tone?: BrandStatusTone;
  className?: string;
  children?: ReactNode;
}

export function BrandStatusCard({
  eyebrow,
  title,
  description,
  icon,
  tone = 'accent',
  className,
  children,
}: BrandStatusCardProps) {
  return (
    <div
      className={cn(
        'bg-card/95 flex w-full max-w-sm flex-col items-center gap-3 rounded-xl border border-border p-6 text-center text-muted-foreground shadow-pop backdrop-blur-sm',
        className
      )}
    >
      {icon && (
        <div
          className={cn(
            'grid h-12 w-12 place-items-center rounded-xl border border-border',
            toneClasses[tone]
          )}
        >
          {icon}
        </div>
      )}
      <p className="text-label uppercase tracking-[0.16em] text-muted-foreground">{eyebrow}</p>
      {title && <h1 className="text-h2 font-display text-foreground">{title}</h1>}
      {description && <p className="text-body-muted">{description}</p>}
      {children}
    </div>
  );
}
