'use client';

import { cn } from '@/lib/utils';
import { categoryStyle } from './workflowCategories';
import type { WorkflowCategory } from '@/types/workflows';

/**
 * The approved workflow tile-icon language (direction 01 — "orbit medallion",
 * minus the orbiting star): a 1.5-weight line glyph in a category-tinted plate.
 *
 * These are deliberately NOT lucide glyphs — the line-icon set is distinctive and
 * signed off. Add new workflows by adding a glyph here, not by substituting lucide.
 * Every path is drawn on a 24×24 viewBox with round caps and joins.
 */
export const WORKFLOW_TILE_ICONS: Record<string, JSX.Element> = {
  briefing: (
    <>
      <ellipse cx="12" cy="12.5" rx="9" ry="3.2" transform="rotate(-22 12 12.5)" />
      <circle cx="12" cy="12.5" r="4.2" />
      <circle cx="20" cy="6.6" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  comet: (
    <>
      <circle cx="16.5" cy="7.5" r="3" />
      <path d="M14 10L5 19" />
      <path d="M9.2 8.6L4.7 13.1" />
      <path d="M13.4 13.4L8.9 17.9" />
      <circle cx="20.3" cy="3.7" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  signal: (
    <>
      <circle cx="6" cy="18" r="1.8" fill="currentColor" stroke="none" />
      <path d="M6 13a5 5 0 0 1 5 5" />
      <path d="M6 9a9 9 0 0 1 9 9" />
      <path d="M6 5a13 13 0 0 1 13 13" />
    </>
  ),
  radar: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 12l6.2-5.2" />
      <circle cx="17.8" cy="6.6" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  beam: (
    <>
      <ellipse cx="12" cy="5.4" rx="5" ry="2" />
      <path d="M7.6 6.7L4.8 18.5h14.4L16.4 6.7" />
      <circle cx="12" cy="14.6" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  scope: (
    <>
      <path d="M4 16.2l10.6-4.8 1.7 3.7-10.6 4.8z" />
      <path d="M14.6 11.4l1.9-3.4 3.3 1.6-1.7 3.5z" />
      <path d="M7.3 17.6L6 21.4M11.4 15.8l1 3.9" />
      <circle cx="19.4" cy="4.6" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  scales: (
    <>
      <path d="M12 6v12.5" />
      <path d="M6 9h12" />
      <path d="M9 18.5h6" />
      <path d="M6 9l-2.4 4.7h4.8z" />
      <path d="M18 9l-2.4 4.7h4.8z" />
      <circle cx="12" cy="4.3" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  report: (
    <>
      <rect x="5.5" y="3.5" width="13" height="17" rx="1.6" />
      <path d="M9 14.5v3M12 11.5v6M15 13v4.5" />
      <circle cx="15.8" cy="6.4" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  funnel: (
    <>
      <path d="M4 5.6h16l-6.2 7.3v5.6l-3.6 1.8v-7.4z" />
      <circle cx="8" cy="3" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="2.6" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="16" cy="3" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  rocket: (
    <>
      <path d="M12 3.4c2.4 1.9 3.7 4.7 3.7 7.9 0 1.8-.4 3.4-1.1 4.7H9.4C8.7 14.7 8.3 13.1 8.3 11.3c0-3.2 1.3-6 3.7-7.9z" />
      <circle cx="12" cy="10" r="1.5" />
      <path d="M9.4 16.2l-2 2.7M14.6 16.2l2 2.7M12 16.5v3.1" />
    </>
  ),
  pulsar: (
    <>
      <circle cx="12" cy="12" r="2.3" fill="currentColor" stroke="none" />
      <path d="M12 3v3.2M12 17.8V21M3 12h3.2M17.8 12H21M5.6 5.6l2.2 2.2M16.2 16.2l2.2 2.2M16.2 7.8l2.2-2.2M5.6 18.4l2.2-2.2" />
    </>
  ),
  notes: (
    <>
      <path d="M5 6.5h9M5 10.5h11M5 14.5h6.5" />
      <path
        d="M17.6 15.6l1 2.7 2.7 1-2.7 1-1 2.7-1-2.7-2.7-1 2.7-1z"
        fill="currentColor"
        stroke="none"
      />
    </>
  ),
};

const PLATE_SIZE = {
  sm: { box: 'h-[30px] w-[30px] rounded-[10px]', glyph: 17 },
  md: { box: 'h-10 w-10 rounded-xl', glyph: 22 },
  lg: { box: 'h-12 w-12 rounded-xl', glyph: 26 },
} as const;

export function WorkflowTileIcon({
  iconId,
  category,
  size = 'md',
  className,
}: {
  iconId: string;
  category: WorkflowCategory;
  size?: keyof typeof PLATE_SIZE;
  className?: string;
}) {
  // An icon id this build does not know must still draw a tile — the
  // catalogue evolves ahead of the icon set, and an empty plate reads as
  // a rendering bug rather than a new workflow.
  const glyph = WORKFLOW_TILE_ICONS[iconId] ?? WORKFLOW_TILE_ICONS.briefing;
  const dimensions = PLATE_SIZE[size];
  return (
    <span
      style={categoryStyle(category)}
      className={cn(
        'flex shrink-0 items-center justify-center border',
        'border-[color-mix(in_srgb,var(--wf-cat)_26%,transparent)]',
        'bg-[color-mix(in_srgb,var(--wf-cat)_13%,transparent)]',
        'text-[color:var(--wf-cat)]',
        dimensions.box,
        className
      )}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        width={dimensions.glyph}
        height={dimensions.glyph}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {glyph}
      </svg>
    </span>
  );
}
