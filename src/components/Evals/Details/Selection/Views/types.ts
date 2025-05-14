export interface LogComparisonProps {
  value: any;                         // The "base" value for this component.
  comparables: any[];                 // Other values to compare with (same shape).
  version?: string;                   // Optional: for storing param version
  comparableVersions?: string[];      // Optional: for storing param versions
  baseLogIndex: number;               // The table row index of the base value.
  comparisonLogsIndex: number[];      // The table row indices for each item in comparables.
  propertyName?: string;              // Optional: for labeling UI (like accordion trigger).
  nestingLevel?: number;              // How “deep” we are in recursion (for indenting).
  displayMode?: "text" | "markdown" | "raw";
  diffMode?: "none" | "lines" | "words" | "characters";
  splitView?: boolean;
  prefix?: string;                    // Optional: for path prefixing (e.g. "entries" or "params")
  cellEditMode?: boolean;
  onSaveEdit?: (desc: { source: "entries" | "params"; path: (string | number)[]; newValue: any }) => void;
  path?: (string | number)[];         // Path to this value within its container for editing
  editable?: boolean;                 // alias for cellEditMode when used directly in leaf views
}