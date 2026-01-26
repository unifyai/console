/**
 * DrawerAxesSection - Displays axes configuration in the drawer
 *
 * Shows the X-axis, Y-axis, and optional group-by field information.
 */

'use client';

import { DrawerAxesSectionProps } from '@/types/interfaces/plot-details';

/**
 * DrawerAxesSection Component
 *
 * Renders the axes information section of the PlotDetailsDrawer.
 */
export function DrawerAxesSection({ axesInfo }: DrawerAxesSectionProps) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-label text-semibold uppercase tracking-wide text-muted-foreground">
        Axes
      </h3>
      <div className="text-body flex flex-wrap gap-4">
        {/* X-Axis */}
        <div className="flex items-center gap-2">
          <span className="font-medium text-muted-foreground">X:</span>
          <span className="text-foreground">{axesInfo.x.label || axesInfo.x.field}</span>
          {axesInfo.x.scale && axesInfo.x.scale !== 'linear' && (
            <span className="text-caption rounded bg-muted px-1.5 py-0.5">{axesInfo.x.scale}</span>
          )}
        </div>

        {/* Y-Axis */}
        {axesInfo.y && (
          <div className="flex items-center gap-2">
            <span className="font-medium text-muted-foreground">Y:</span>
            <span className="text-foreground">
              {axesInfo.y.label || axesInfo.y.field}
              {axesInfo.y.metric && ` (${axesInfo.y.metric})`}
            </span>
            {axesInfo.y.scale && axesInfo.y.scale !== 'linear' && (
              <span className="text-caption rounded bg-muted px-1.5 py-0.5">
                {axesInfo.y.scale}
              </span>
            )}
          </div>
        )}

        {/* Group By */}
        {axesInfo.groupBy && (
          <div className="flex items-center gap-2">
            <span className="font-medium text-muted-foreground">Group:</span>
            <span className="text-foreground">
              {axesInfo.groupBy.label || axesInfo.groupBy.field}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

export default DrawerAxesSection;
