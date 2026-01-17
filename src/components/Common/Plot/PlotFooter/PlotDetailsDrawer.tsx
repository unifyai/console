/**
 * PlotDetailsDrawer - Bottom drawer for plot details
 *
 * A slide-up drawer that displays:
 * - Groups legend
 * - Pinned datapoints
 * - Axes information
 *
 * This drawer pushes the plot up instead of overlaying it.
 * Supports bidirectional hover highlighting with the plot.
 *
 * Note: The drawer has no header - closing is handled by clicking the footer toggle.
 */

'use client';

import { PlotDetailsDrawerProps } from '@/types/interfaces/plot-details';
import { DrawerGroupsSection } from './DrawerGroupsSection';
import { DrawerPinnedSection } from './DrawerPinnedSection';
import { DrawerAxesSection } from './DrawerAxesSection';

/**
 * PlotDetailsDrawer Component
 *
 * A drawer that pushes the plot container up when opened.
 * Closing is handled by the PlotFooter toggle button.
 */
export function PlotDetailsDrawer({
  isOpen,
  groups,
  pinnedDatapoints,
  axesInfo,
  onUnpinDatapoint,
  onCopyValue,
  onHighlight,
}: Omit<PlotDetailsDrawerProps, 'onClose'>) {
  const hasContent = groups.length > 0 || pinnedDatapoints.length > 0 || axesInfo.x.field;

  // Don't render anything when closed (saves space)
  if (!isOpen) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Plot details"
      className="flex-shrink-0 border-t border-border bg-background"
    >
      {/* Drawer content - limited height with scroll */}
      <div className="max-h-[200px] overflow-y-auto p-4">
        {hasContent ? (
          <div className="flex flex-col gap-4">
            {/* Axes Section */}
            <DrawerAxesSection axesInfo={axesInfo} />

            {/* Groups Section - with highlight callback */}
            {groups.length > 0 && <DrawerGroupsSection groups={groups} onHighlight={onHighlight} />}

            {/* Pinned Section - with highlight callback */}
            {pinnedDatapoints.length > 0 && (
              <DrawerPinnedSection
                pinnedDatapoints={pinnedDatapoints}
                onUnpin={onUnpinDatapoint}
                onCopy={onCopyValue}
                onHighlight={onHighlight}
              />
            )}
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground">No details available</p>
        )}
      </div>
    </div>
  );
}

export default PlotDetailsDrawer;
