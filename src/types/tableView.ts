/**
 * Shared types for Table View API
 *
 * These types are used across:
 * - API routes (create, data)
 * - Page components
 * - TableViewer component
 * - Tests
 */

// =============================================================================
// Column Configuration
// =============================================================================

/**
 * Configuration for column visibility, ordering, and sizing
 */
export interface ColumnConfig {
  /** Columns to show (null = all columns visible) */
  visible?: string[];
  /** Columns to hide (alternative to visible) */
  hidden?: string[];
  /** Column display order */
  order?: string[];
  /** Column widths in pixels: {column_name: width} */
  widths?: Record<string, number>;
}

// =============================================================================
// Table View Configuration
// =============================================================================

/**
 * Configuration for table display settings
 */
export interface TableConfig {
  columns?: ColumnConfig;
  /** Maximum rows to display (1-10000) */
  rowLimit?: number;
  /** Column to sort by initially */
  sortBy?: string;
  /** Sort order: asc or desc */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Extended table config with computed visibility/order
 * Returned by the data endpoint after processing
 */
export interface TableViewConfig extends TableConfig {
  /** Computed list of visible column names */
  visibleColumns: string[];
  /** Computed column display order */
  columnOrder: string[];
}

// =============================================================================
// Project Configuration
// =============================================================================

/**
 * Configuration for data source (project/logs)
 */
export interface ProjectConfig {
  /** Project name (required) */
  projectName: string;
  /** Context filter */
  context?: string;
  /** Filter expression */
  filterExpr?: string;
  /** Fields to include */
  fromFields?: string;
  /** Fields to exclude */
  excludeFields?: string;
  /** Maximum rows to fetch */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Sorting configuration */
  sorting?: string;
}

// =============================================================================
// Field Metadata
// =============================================================================

/**
 * Metadata about a field/column in the data
 */
export interface FieldMetadata {
  /** Data type: int, str, float, bool, datetime, etc. */
  type: string;
  /** Number of non-null values */
  count?: number;
  /** Sample value */
  sample?: unknown;
}

// =============================================================================
// Table View Metadata
// =============================================================================

/**
 * Metadata about a table view
 */
export interface TableViewMetadata {
  /** Unique token for this table view */
  token: string;
  /** Display title */
  title?: string;
  /** Project name */
  projectName: string;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
  /** User ID who created this view */
  createdBy: string;
}

// =============================================================================
// API Request/Response Types
// =============================================================================

/**
 * Request body for creating a table view
 */
export interface CreateTableViewRequest {
  /** Display title */
  title?: string;
  /** Table display configuration */
  tableConfig?: TableConfig;
  /** Project/data source configuration (required) */
  projectConfig: ProjectConfig;
}

/**
 * Response from creating a table view
 */
export interface CreateTableViewResponse {
  /** Full URL to view the table */
  url: string;
  /** Unique token for this table view */
  token: string;
}

/**
 * Pagination info returned from server
 */
export interface PaginationInfo {
  /** Current page number (1-indexed) */
  page: number;
  /** Items per page */
  pageSize: number;
  /** Total items available */
  totalCount: number;
  /** Total pages available */
  totalPages: number;
  /** Whether there's a next page */
  hasNextPage: boolean;
  /** Whether there's a previous page */
  hasPreviousPage: boolean;
}

/**
 * Full response from the data endpoint
 */
export interface TableDataResponse {
  /** Processed table configuration */
  config: TableViewConfig;
  /** Row data for current page */
  data: Record<string, unknown>[];
  /** Field metadata */
  fields: Record<string, FieldMetadata>;
  /** Table view metadata */
  metadata: TableViewMetadata;
  /** Server-side pagination info */
  pagination: PaginationInfo;
}

/**
 * Error response structure
 */
export interface TableDataError {
  error: string;
  expired?: boolean;
}

// =============================================================================
// Admin API Types (Internal)
// =============================================================================

/**
 * Response from admin table view endpoint
 */
export interface AdminTableViewResponse {
  userId: string;
  organizationId: number | null;
  config: TableConfig;
  projectConfig: Record<string, unknown>;
  metadata: TableViewMetadata;
}

/**
 * User organization info from admin endpoint
 */
export interface UserOrganization {
  id: number;
  name: string;
  roleId: number;
  roleName: string;
  apiKey: string;
}

/**
 * Response from admin user endpoint
 */
export interface AdminUserResponse {
  id: string;
  apiKey: string;
  organizations: UserOrganization[];
}

// =============================================================================
// Log Entry Types
// =============================================================================

/**
 * Raw log entry from Orchestra
 */
export interface LogEntry {
  id: number;
  ts: string;
  entries?: Record<string, unknown>;
  derivedEntries?: Record<string, unknown>;
}

/**
 * Response from logs endpoint
 */
export interface LogsResponse {
  logs: LogEntry[];
  count?: number;
}
