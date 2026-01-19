export type DataPoint = [number, number];

export type DataLabel = [string, number];

export type GroupedDataPoint = [string, DataPoint[]];

export type GroupedDataLabel = [string, DataLabel];

export type GroupingColors = { key: string; color: string }[];

export type DataRange = number[];

export type GroupedDataRange = [string, number[]][];

export interface GroupedBin extends d3.Bin<number, number> {
  group: string;
}

export type InfoCardData = {
  x: { name: string; value: string | number };
  y: { name: string; value: number };
  group?: { name: string; value: string | number };
  aggregate?: { name: string };
};

export type InfoCardPosition = { x: number; y: number };

/**
 * Highlight target for bidirectional hover highlighting between plot and drawer.
 */
export type HighlightTarget =
  | { type: 'none' }
  | { type: 'group'; groupKey: string }
  | { type: 'datapoint'; datapointId: string };

/**
 * Axis customization options for plots.
 * Allows customizing labels and tick formatters.
 */
export interface AxisCustomization {
  // Whether to show axis labels
  showXAxisLabel?: boolean;
  showYAxisLabel?: boolean;
  // Custom labels for axis AND tooltip (overrides field name)
  xAxisLabel?: string;
  yAxisLabel?: string;
  // Custom tick formatters
  xTickFormatter?: (value: unknown) => string;
  yTickFormatter?: (value: unknown) => string;
  // Custom labels for group by and aggregate
  groupByLabel?: string;
  aggregateLabel?: string;
  // Callbacks for external drawer integration
  onGroupsChange?: (groups: Array<{ key: string; color: string }>) => void;
  onDatapointPin?: (datapoint: {
    id: string;
    x: { label: string; value: string | number };
    y: { label: string; value: string | number };
    group?: { label: string; value: string };
  }) => void;
  // Highlight target for bidirectional hover highlighting
  highlightTarget?: HighlightTarget;
}
