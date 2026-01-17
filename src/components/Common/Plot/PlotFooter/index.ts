/**
 * PlotFooter module exports
 *
 * Provides modular, testable components for plot footer and details drawer.
 */

// Main components
export { PlotFooter } from './PlotFooter';
export { PlotDetailsDrawer } from './PlotDetailsDrawer';

// Drawer sections (can be used independently for testing)
export { DrawerGroupsSection } from './DrawerGroupsSection';
export { DrawerPinnedSection } from './DrawerPinnedSection';
export { DrawerAxesSection } from './DrawerAxesSection';

// Hooks - re-exported from centralized location
export { usePlotDetails } from '@/hooks/Interfaces/Plot/usePlotDetails';
export type {
  PlotDetailsHandle,
  UsePlotDetailsProps,
  UsePlotDetailsReturn,
} from '@/hooks/Interfaces/Plot/usePlotDetails';

// Types - re-exported from centralized locations
export type {
  PlotFooterProps,
  PlotDetailsDrawerProps,
  PlotGroup,
  PinnedDatapoint,
  PlotAxesInfo,
  DrawerGroupsSectionProps,
  DrawerPinnedSectionProps,
  DrawerAxesSectionProps,
  OnHighlightRequest,
} from '@/types/interfaces/plot-details';

export type { HighlightTarget } from '@/types/interfaces/plot';
