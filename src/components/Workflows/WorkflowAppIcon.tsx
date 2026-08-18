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
      ? 'h-[34px] w-[34px] rounded-lg'
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
        // Brand marks carry their own colour through currentColor — inherit the
        // foreground rather than muting them, matching ProviderIcon.
        <requirement.iconComponent className={cn('shrink-0 text-foreground', glyph)} />
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
  isResolving = false,
}: {
  requirements: WorkflowRequirement[];
  max?: number;
  /**
   * True until the integrations catalogue has answered for these apps.
   *
   * A requirement carries no `iconUrl` until then, so the icon falls back
   * to a grey plate with the app's initial — which is indistinguishable
   * from an app that genuinely has no mark, and turns into the real logo
   * seconds later. A placeholder that reads as loading is honest; a grey
   * letter that reads as an answer is not.
   */
  isResolving?: boolean;
}) {
  const shown = requirements.slice(0, max);
  const overflow = requirements.length - shown.length;
  return (
    <span className="flex items-center gap-1.5">
      {shown.map((requirement) =>
        isResolving ? (
          <span
            key={requirement.canonicalSlug}
            className="bg-muted/50 h-[26px] w-[26px] shrink-0 animate-pulse rounded-lg"
          />
        ) : (
          <WorkflowAppIcon key={requirement.canonicalSlug} requirement={requirement} />
        )
      )}
      {overflow > 0 && <span className="text-caption">+{overflow}</span>}
    </span>
  );
}
