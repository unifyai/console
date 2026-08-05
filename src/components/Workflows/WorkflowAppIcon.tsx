'use client';

import { cn } from '@/lib/utils';
import type { WorkflowRequirement } from '@/types/workflows';

/**
 * A required app's vendor mark inside a hairline plate. Resolution order
 * mirrors the integrations gallery: the catalog feed's iconUrl, then a
 * client-side react-icons mark (static config and mock data), then the
 * app's initial. Never redraw or recolour a vendor mark.
 */
export function WorkflowAppIcon({
  requirement,
  size = 'sm',
  className,
}: {
  requirement: Pick<WorkflowRequirement, 'displayName' | 'iconUrl' | 'iconComponent'>;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}) {
  const box =
    size === 'md'
      ? 'h-[34px] w-[34px] rounded-[10px]'
      : size === 'sm'
        ? 'h-[26px] w-[26px] rounded-lg'
        : 'h-[18px] w-[18px] rounded';
  const glyph =
    size === 'md' ? 'h-[19px] w-[19px]' : size === 'sm' ? 'h-[15px] w-[15px]' : 'h-[11px] w-[11px]';
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden border bg-card-2',
        box,
        className
      )}
      title={requirement.displayName}
    >
      {requirement.iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- vendor marks are static SVGs
        <img
          src={requirement.iconUrl}
          alt=""
          loading="lazy"
          className={cn('object-contain', glyph)}
        />
      ) : requirement.iconComponent ? (
        <requirement.iconComponent className={cn('shrink-0 text-muted-foreground', glyph)} />
      ) : (
        <span className="font-display text-[11px] font-bold text-muted-foreground">
          {requirement.displayName.charAt(0)}
        </span>
      )}
    </span>
  );
}

export function WorkflowAppIconStack({
  requirements,
  max = 4,
}: {
  requirements: WorkflowRequirement[];
  max?: number;
}) {
  const shown = requirements.slice(0, max);
  const overflow = requirements.length - shown.length;
  return (
    <span className="flex items-center gap-1.5">
      {shown.map((requirement) => (
        <WorkflowAppIcon key={requirement.canonicalSlug} requirement={requirement} />
      ))}
      {overflow > 0 && <span className="text-caption">+{overflow}</span>}
    </span>
  );
}
