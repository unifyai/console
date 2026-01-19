/**
 * Types for plot details drawer and footer components.
 *
 * These types define the data structures passed between the plot rendering
 * logic (D3) and the React UI components (footer/drawer).
 */

import { HighlightTarget } from './plot';

/**
 * Represents a single group in the plot legend
 */
export interface PlotGroup {
  /** Display name/key for the group */
  key: string;
  /** Color assigned to this group */
  color: string;
}

/**
 * Represents a single pinned datapoint
 */
export interface PinnedDatapoint {
  /** Unique identifier for this pinned point */
  id: string;
  /** X-axis value */
  x: {
    label: string;
    value: string | number;
  };
  /** Y-axis value */
  y: {
    label: string;
    value: string | number;
  };
  /** Optional group value (for grouped plots) */
  group?: {
    label: string;
    value: string;
  };
  /** Optional aggregate label */
  aggregate?: {
    label: string;
  };
}

/**
 * Axes information for the plot
 */
export interface PlotAxesInfo {
  /** X-axis configuration */
  x: {
    field: string;
    label?: string;
    scale?: string;
  };
  /** Y-axis configuration */
  y?: {
    field: string;
    label?: string;
    scale?: string;
    metric?: string;
  };
  /** Group by field (if any) */
  groupBy?: {
    field: string;
    label?: string;
  };
}

/**
 * Callback for requesting a highlight on the plot
 */
export type OnHighlightRequest = (target: HighlightTarget) => void;

/**
 * Props for the PlotFooter component
 */
export interface PlotFooterProps {
  /** Number of groups in the plot (0 if not grouped) */
  groupCount: number;
  /** Number of pinned datapoints */
  pinnedCount: number;
  /** Whether the drawer is currently open */
  isOpen: boolean;
  /** Callback to toggle the drawer open/closed */
  onToggle: () => void;
}

/**
 * Props for the PlotDetailsDrawer component
 */
export interface PlotDetailsDrawerProps {
  /** Whether the drawer is open */
  isOpen: boolean;
  /** Groups data for the legend section */
  groups: PlotGroup[];
  /** Pinned datapoints */
  pinnedDatapoints: PinnedDatapoint[];
  /** Axes information */
  axesInfo: PlotAxesInfo;
  /** Callback to unpin a datapoint */
  onUnpinDatapoint?: (id: string) => void;
  /** Callback to copy a value */
  onCopyValue?: (value: string | number) => void;
  /** Callback to highlight an element on the plot */
  onHighlight?: OnHighlightRequest;
}

/**
 * Props for DrawerGroupsSection
 */
export interface DrawerGroupsSectionProps {
  groups: PlotGroup[];
  /** Callback to highlight a group on the plot */
  onHighlight?: OnHighlightRequest;
}

/**
 * Props for DrawerPinnedSection
 */
export interface DrawerPinnedSectionProps {
  pinnedDatapoints: PinnedDatapoint[];
  onUnpin?: (id: string) => void;
  onCopy?: (value: string | number) => void;
  /** Callback to highlight a datapoint on the plot */
  onHighlight?: OnHighlightRequest;
}

/**
 * Props for DrawerAxesSection
 */
export interface DrawerAxesSectionProps {
  axesInfo: PlotAxesInfo;
}
