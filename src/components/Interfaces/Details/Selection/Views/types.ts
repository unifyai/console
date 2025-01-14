export interface LogComparisonProps {
    value: any;                         // The "base" value for this component.
    comparables: any[];                 // Other values to compare with (same shape).
    baseLogIndex: number;               // The table row index of the base value.
    comparisonLogsIndex: number[];      // The table row indices for each item in comparables.
    propertyName?: string;              // Optional: for labeling UI (like accordion trigger).
    nestingLevel?: number;              // How “deep” we are in recursion (for indenting).
  }