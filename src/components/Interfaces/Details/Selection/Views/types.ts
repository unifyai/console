export interface LogComparisonProps {
  value: any;                         // The "base" value for this component.
  comparables: any[];                 // Other values to compare with (same shape).
  version?: string;                   // Optional: for storing param version
  comparableVersions?: string[];      // Optional: for storing param versions
  baseLogIndex: number;               // The table row index of the base value.
  comparisonLogsIndex: number[];      // The table row indices for each item in comparables.
  propertyName?: string;              // Optional: for labeling UI (like accordion trigger).
  nestingLevel?: number;              // How "deep" we are in recursion (for indenting).
  prefix?: string;                    // Optional: for path prefixing (e.g. "entries" or "params")
  diffMode?: "none" | "lines" | "words" | "characters";
  splitView?: boolean;
  displayMode?: "text" | "markdown"
}