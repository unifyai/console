/**
 * DrawerGroupsSection - Displays the group legend in the drawer
 *
 * Shows a list of groups with their associated colors.
 * Supports bidirectional hover highlighting with the plot.
 */

'use client';

import { DrawerGroupsSectionProps } from '@/types/interfaces/plot-details';

/**
 * DrawerGroupsSection Component
 *
 * Renders the groups/legend section of the PlotDetailsDrawer.
 * Hovering on a group highlights corresponding bars in the plot.
 */
export function DrawerGroupsSection({ groups, onHighlight }: DrawerGroupsSectionProps) {
  if (groups.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-label text-semibold uppercase tracking-wide text-muted-foreground">
        Groups ({groups.length})
      </h3>
      <div className="flex flex-wrap gap-2">
        {groups.map((group) => (
          <div
            key={group.key}
            className="bg-muted/30 hover:bg-muted/60 flex cursor-pointer items-center gap-2 rounded-md border border-border px-2 py-1 transition-colors"
            onMouseEnter={() => onHighlight?.({ type: 'group', groupKey: group.key })}
            onMouseLeave={() => onHighlight?.({ type: 'none' })}
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: group.color }}
              aria-hidden="true"
            />
            <span className="text-body text-foreground">{group.key || 'null'}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default DrawerGroupsSection;
