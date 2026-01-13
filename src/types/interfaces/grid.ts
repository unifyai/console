import { ResponseProps } from '../common';
import {
  GetLogsParameters,
  LogFieldsProps,
  LogFieldsResponseProps,
  LogItemProps,
  LogProps,
  LogsResponseProps,
  GroupedLogProps,
  PlotArguments,
} from './logs';
import { SyncableLogEntry } from '../assistants/contact-sync';

export interface TileProps {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  moved?: boolean;
  static?: boolean;
  visible?: boolean;
  color?: string;
  tab?: string;
  table?: string;
  tableType?: string;
  context?: string;
  columnContext?: string;
  prevContext?: string;
  autoUpdate?: string;
  freeze?: string;
  filters?: string;
  commonFilter?: string;
  pageNumber?: string;
  metric?: string;
  columnOrder?: string;
  hiddenColumns?: string;
  defaultHiddenColumns?: boolean;
  sorting?: string;
  grouping?: string;
  groupSorting?: string;
  columnsPinLeft?: string;
  columnsPinRight?: string;
  selected?: string;
  baseIndex?: string;
  plotType?: string;
  plotScaleX?: string;
  plotScaleY?: string;
  plotAggregate?: string;
  xAxis?: string;
  yAxis?: string;
  plotGroupBy?: string;
  plotGroupByColors?: string;
  binCount?: string;
  regressionLine?: string;
  fileName?: string;
  fileType?: string;
  content?: string;
  shellType?: string;
}

export interface TableMetrics {
  [key: string]: number | string;
}

export interface TableGroupedMetrics {
  [key: string]: { [key: string]: { [key: string]: { [key: string]: number | string } } };
}

export interface TableBoundaries {
  minimums: { [key: string]: number };
  maximums: { [key: string]: number };
}

export interface TableDataItem {
  columnContexts: string[];
  fields: LogFieldsResponseProps;
  totalCount: number;
  entriesProperties: string[];
  paramsProperties: string[];
  logs: LogProps[] | GroupedLogProps[];
  params: LogItemProps;
  error: string | undefined;
  isLoading: boolean; // Flag to indicate the table data is loading/being built. Might remove this later.
  newCells?: string[];
  contextNotFound?: boolean; // Set when the context returns 404 (deleted/doesn't exist)
}

export interface PlotDataItem {
  plotLogs: LogProps[];
  plotFields: LogFieldsResponseProps;
  error?: string;
  isLoading?: boolean;
  /** Pre-aggregated bar chart data from backend metrics endpoint */
  preAggregatedBarData?: [string, number][] | [string, [string, number]][];
  /** Whether bar chart data uses secondary grouping */
  isGroupedBarChart?: boolean;
}

export interface TableDataProps {
  [key: string]: TableDataItem;
}

export interface PlotDataProps {
  [key: string]: PlotDataItem;
}

export type ItemType =
  | 'tab'
  | 'binCount'
  | 'regressionLine'
  | 'plotType'
  | 'plotScaleX'
  | 'plotScaleY'
  | 'plotAggregate'
  | 'xAxis'
  | 'yAxis'
  | 'plotGroupBy'
  | 'plotGroupByColors'
  | 'selected'
  | 'baseIndex'
  | 'metric'
  | 'filters'
  | 'commonFilter'
  | 'pageNumber'
  | 'columnOrder'
  | 'hiddenColumns'
  | 'defaultHiddenColumns'
  | 'sorting'
  | 'grouping'
  | 'groupSorting'
  | 'columnsPinLeft'
  | 'columnsPinRight'
  | 'table'
  | 'context'
  | 'columnContext'
  | 'prevContext'
  | 'autoUpdate'
  | 'freeze'
  | 'visible'
  | 'color'
  | 'tableType'
  | 'fileName'
  | 'fileType'
  | 'content'
  | 'shellType';

export interface Context {
  name: string;
  description: string;
}

export interface TabProps {
  name: string;
  project: string;
  context: string | undefined;
  items: TileProps[];
  newCounter: number;
  color: string | undefined;
}

export interface TabsDataProps {
  [key: string]: {
    name: string;
    items: TileProps[];
    globalContext: string | undefined;
    tableTiles: TileProps[];
    plotTiles: TileProps[];
    viewTiles: TileProps[];
    tabCreated: boolean;
    tempTabCreated: boolean;
    savedTab: TabProps | null;
  };
}

// ===== TEMPLATE SCHEMAS =====

// Base Schema interface
export interface BaseSchema {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  isCheckpoint?: boolean;
}

// Template Position for tiles in templates
export interface TilePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Specialized tile schemas (shared between template and non-template)
export interface TableTileData {
  id?: string;
  tileId?: string;
  tableType?: string;
  limit?: number;
  offset?: number;
  groupLimit?: number;
  groupOffset?: number;
  pageNumber?: string;
  columnOrder?: string;
  hiddenColumns?: string;
  defaultHiddenColumns?: boolean;
  sorting?: string;
  groupSorting?: string;
  columnsPinLeft?: string;
  columnsPinRight?: string;
  selected?: string;
}

export interface PlotTileData {
  id?: string;
  tileId?: string;
  plotType?: string;
  plotScaleX?: string;
  plotScaleY?: string;
  plotAggregate?: string;
  xAxis?: string;
  yAxis?: string;
  plotGroupBy?: string;
  plotGroupByColors?: string;
  binCount?: string;
  regressionLine?: string;
}

export interface ViewTileData {
  id?: string;
  tileId?: string;
  baseIndex?: string;
}

// Base template schema for tiles with common fields
export interface BaseTileTemplateSchema {
  name: string;
  position: TilePosition;
  type?: string;
  minW?: number;
  minH?: number;
  visible?: boolean;
  locked?: boolean;
  moved?: boolean;
  static?: boolean;
  color?: string;
  context?: string;
  table?: string;
  autoUpdate?: string;
  freeze?: string;
  filters?: string;
  commonFilter?: string;
  metric?: string;
  columnContext?: string;
  grouping?: string;
  // Type-specific template data
  tableTile?: TableTileData;
  plotTile?: PlotTileData;
  viewTile?: ViewTileData;
}

// Template schema for a detached tile - inherits all fields from base
export interface TileTemplateSchema extends BaseTileTemplateSchema {
  // Template-specific metadata
  templateVersion?: string;
  description?: string;
  createdBy?: string;
  tags?: string[];
}

// Base tile schema with common fields - extends template base with IDs and timestamps
export interface BaseTileSchema extends BaseTileTemplateSchema {
  id?: string;
  tabId?: string;
  createdAt?: string;
  updatedAt?: string;
  isCheckpoint?: boolean;
}

// Complete Tile schema with type-specific properties - now inherits from base
export interface TileData extends BaseTileSchema {}

// Base template schema for tabs with common fields
export interface BaseTabTemplateSchema {
  name: string;
  visible?: boolean;
  active?: boolean;
  order?: number;
  context?: string;
  color?: string;
}

// Template schema for a detached tab
export interface TabTemplateSchema extends BaseTabTemplateSchema {
  tiles?: TileTemplateSchema[];
  // Template-specific metadata
  templateVersion?: string;
  description?: string;
  createdBy?: string;
  tags?: string[];
}

// Base tab schema with common fields - extends template base with IDs and timestamps
export interface BaseTabSchema extends BaseTabTemplateSchema {
  id?: string;
  interfaceId?: string;
  createdAt?: string;
  updatedAt?: string;
  isCheckpoint?: boolean;
}

// Complete Tab schema - now inherits from base
export interface TabData extends BaseTabSchema {
  tiles?: TileData[];
}

// Base template schema for interfaces with common fields
export interface BaseInterfaceTemplateSchema {
  name: string;
  color?: string;
  context?: string;
}

// Template schema for a detached interface
export interface InterfaceTemplateSchema extends BaseInterfaceTemplateSchema {
  tabs?: TabTemplateSchema[];
  activeTabName?: string; // Use name instead of ID for templates
  // Template-specific metadata
  templateVersion?: string;
  description?: string;
  createdBy?: string;
  tags?: string[];
}

// Base interface schema with common fields - extends template base with IDs and timestamps
export interface BaseInterfaceSchema extends BaseInterfaceTemplateSchema {
  id?: string;
  projectId?: string;
  createdAt?: string;
  updatedAt?: string;
  isCheckpoint?: boolean;
}

// Complete Interface schema - now inherits from base
export interface InterfaceData extends BaseInterfaceSchema {
  tabs?: TabData[];
  activeTabId?: string;
  context?: string;
}

// Template schema for multiple interfaces from a project
export interface ProjectTemplateSchema {
  interfaces?: InterfaceTemplateSchema[];
  // Template-specific metadata
  templateVersion?: string;
  description?: string;
  createdBy?: string;
  tags?: string[];
}

// Request/response schemas for creating/updating
export interface CreateTileRequest extends BaseTileTemplateSchema {
  tileId?: string;
  tabId: string;
}

export interface UpdateTileRequest {
  name?: string;
  position?: TilePosition;
  type?: string;
  minW?: number;
  minH?: number;
  visible?: boolean;
  locked?: boolean;
  moved?: boolean;
  static?: boolean;
  color?: string;
  context?: string;
  table?: string;
  autoUpdate?: string;
  freeze?: string;
  filters?: string;
  commonFilter?: string;
  metric?: string;
  columnContext?: string;
  grouping?: string;
  // Type-specific fields
  tableTile?: TableTileData;
  plotTile?: PlotTileData;
  viewTile?: ViewTileData;
}

export interface CreateTabRequest extends BaseTabTemplateSchema {
  tabId?: string;
  interfaceId: string;
}

export interface UpdateTabRequest {
  name?: string;
  visible?: boolean;
  active?: boolean;
  order?: number;
  context?: string;
  color?: string;
  icon?: string;
}

export interface CreateInterfaceRequest extends BaseInterfaceTemplateSchema {
  interfaceId?: string;
  project: string;
}

export interface UpdateInterfaceRequest {
  name?: string;
  activeTabId?: string;
  color?: string;
  icon?: string;
  context?: string;
}

// Validation schemas
export interface ValidationIssue {
  level: string; // "error", "warning", "info"
  component: string; // "interface", "tab", "tile", "tableTile", etc.
  componentName: string;
  issueType: string; // "missing_context", "missing_table", "missing_column", etc.
  message: string;
  suggestedFix?: string;
}

export interface ValidationResultSchema {
  isValid: boolean;
  issues?: ValidationIssue[];
  canSanitize?: boolean;
  sanitizedTemplate?:
    | ProjectTemplateSchema
    | InterfaceTemplateSchema
    | TabTemplateSchema
    | TileTemplateSchema;
}

// Template export/import request schemas
export interface ExportTemplateRequest {
  includeMetadata?: boolean;
  description?: string;
  tags?: string[];
  templateName?: string;
}

export interface ImportTemplateRequest {
  projectName: string;
  validateFirst?: boolean;
  autoSanitize?: boolean;
  overwriteExisting?: boolean;
}

// Specialized export request types
export interface ExportProjectTemplateRequest extends ExportTemplateRequest {
  projectName: string;
  interfaceNames?: string[];
  checkpoint?: boolean;
}

export interface ExportInterfaceTemplateRequest extends ExportTemplateRequest {
  interfaceId?: string;
  projectName?: string;
  interfaceName?: string;
  checkpoint?: boolean;
}

export interface ExportTabTemplateRequest extends ExportTemplateRequest {
  tabId?: string;
  interfaceId?: string;
  tabName?: string;
  checkpoint?: boolean;
}

export interface ExportTileTemplateRequest extends ExportTemplateRequest {
  tileId?: string;
  tabId?: string;
  tileName?: string;
  checkpoint?: boolean;
}

// Specialized import request types
export interface ImportProjectTemplateRequest extends ImportTemplateRequest {
  template: ProjectTemplateSchema;
  interfaceNamePrefix?: string;
}

export interface ImportInterfaceTemplateRequest extends ImportTemplateRequest {
  template: InterfaceTemplateSchema;
  newInterfaceName?: string;
}

export interface ImportTabTemplateRequest extends ImportTemplateRequest {
  template: TabTemplateSchema;
  interfaceId?: string;
  interfaceName?: string;
  newTabName?: string;
}

export interface ImportTileTemplateRequest extends ImportTemplateRequest {
  template: TileTemplateSchema;
  tabId?: string;
  interfaceId?: string;
  tabName?: string;
  newTileName?: string;
}

// Template response schemas
export interface TemplateExportResponse<T> {
  template: T;
  metadata?: {
    exportedAt?: string;
    exportedBy?: string;
    sourceProject?: string;
    version?: string;
  };
  exportStats?: {
    interfaces?: number;
    tabs?: number;
    tiles?: number;
  };
}

export interface TemplateImportResponse {
  success: boolean;
  validationResult?: ValidationResultSchema;
  importStats?: Record<string, any>;
  createdIds?: Record<string, any>;
  warnings?: string[];
  error?: string;
}

export interface TileLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  moved?: boolean;
  static?: boolean;
}

export interface ProjectsActions {
  get: () => Promise<string[]>;
  create: (name: string) => Promise<ResponseProps>;
  rename: (name: string, newName: string) => Promise<ResponseProps>;
  update: (name: string, data: { icon?: string }) => Promise<ResponseProps>;
  delete: (name: string) => Promise<ResponseProps>;
  exportTemplate: (
    params: Omit<
      ExportProjectTemplateRequest,
      'checkpoint' | 'includeMetadata' | 'description' | 'tags' | 'templateName'
    >,
    options?: Pick<
      ExportProjectTemplateRequest,
      'checkpoint' | 'includeMetadata' | 'description' | 'tags' | 'templateName'
    >
  ) => Promise<TemplateExportResponse<ProjectTemplateSchema> | { error: string }>;
  importTemplate: (
    template: ProjectTemplateSchema,
    options: Omit<ImportProjectTemplateRequest, 'template'>
  ) => Promise<TemplateImportResponse | { error: string }>;
  getProject: (name: string) => Promise<any>;
  transferToOrg: (projectId: number, organizationId: number) => Promise<any>;
  transferToPersonal: (projectId: number) => Promise<any>;
}

export interface LogsActions {
  create: (
    project: string,
    context: string | null,
    params: { [param: string]: string }[],
    entries: { [entry: string]: string }[]
  ) => Promise<ResponseProps>;
  get: (
    project: string,
    context: string | null,
    columnContext: string | null,
    filterExpression: string | null,
    sortingExpression: string | null,
    groupingExpression: string | null,
    groupSortingExpression: string | null,
    fromIds: string | null,
    fromFields: string | null,
    excludeFields: string | null,
    limit: number | null,
    offset: number | null,
    groupLimit: number | null,
    groupOffset: number | null,
    groupDepth: number | null,
    returnIdsOnly: string | null,
    randomize: string | null,
    _timestamp: string | null,
    signal?: AbortSignal
  ) => Promise<LogsResponseProps>;
  getLatest: (
    project: string,
    context: string | null,
    columnContext: string | null,
    filterExpression: string | null,
    sortingExpression: string | null,
    groupingExpression: string | null,
    groupSortingExpression: string | null,
    fromIds: string | null,
    fromFields: string | null,
    excludeFields: string | null,
    limit: number | null,
    offset: number | null,
    groupDepth: number | null,
    returnIdsOnly: string | null,
    randomize: string | null,
    _timestamp: string | null,
    signal?: AbortSignal
  ) => Promise<string>;
  getMetrics: (
    project: string,
    context: string | null,
    filterExpression: string | null,
    groupingExpression: string | null,
    metricName: string,
    keyNames: string[]
  ) => Promise<
    { [key: string]: number } | { [key: string]: { [key: string]: { [key: string]: number } } }
  >;
  delete: (
    project: string,
    context: string | null,
    idsAndFields: LogFieldsProps
  ) => Promise<ResponseProps>;
  update: (
    project: string,
    context: string | null,
    logs: number[],
    entries: LogItemProps,
    params: LogItemProps,
    overwrite?: boolean,
    affectedLogs?: SyncableLogEntry[]
  ) => Promise<ResponseProps>;
}

export interface DerivedEntryActions {
  create: (
    project: string,
    context: string | undefined,
    key: string,
    equation: string,
    referencedLogs: { [table_name: string]: GetLogsParameters }
  ) => Promise<ResponseProps>;
  update: (
    project: string,
    context: string | undefined,
    key: string,
    equation: string | null,
    targetDerivedLogs: { [table_name: string]: GetLogsParameters }
  ) => Promise<ResponseProps>;
}

export interface FieldsActions {
  get: (
    project: string,
    context: string | null,
    signal?: AbortSignal
  ) => Promise<LogFieldsResponseProps>;
  rename: (
    project: string,
    context: string | null,
    oldFieldName: string,
    newFieldName: string
  ) => Promise<ResponseProps>;
}

export interface ContextActions {
  get: (project: string) => Promise<Context[]>;
  create: (name: string, project: string) => Promise<ResponseProps>;
  delete: (project: string, context: string) => Promise<ResponseProps>;
  rename: (project: string, currentName: string, newName: string) => Promise<ResponseProps>;
}

export interface TabActions {
  get: (project: string, temporary: boolean) => Promise<TabProps[]>;
  create: (
    name: string,
    project: string,
    context: string | undefined,
    items: TileProps[],
    newCounter: number,
    temporary: boolean,
    color: string | undefined
  ) => Promise<ResponseProps>;
  update: (
    name: string,
    project: string,
    context: string | undefined,
    items: TileProps[],
    newCounter: number,
    newName: string | undefined,
    temporary: boolean,
    color: string | undefined
  ) => Promise<ResponseProps>;
  delete: (name: string, project: string, temporary: boolean) => Promise<ResponseProps>;
}

export interface CodeActions {
  run: (
    project: string,
    filePath: string,
    env?: { [key: string]: string } | { key: string; value: string }[]
  ) => Promise<ResponseProps>;
  get: (filePath: string) => Promise<{ output: string; done: boolean }>;
  createTerminal: (shell?: string, cwd?: string) => Promise<{ sessionId: string }>;
  runTerminal: (sessionId: string, cmd: string) => Promise<{ output: string }>;
  getTerminalOutput: (sessionId: string) => Promise<{ output: string }>;
  stopTerminal: (sessionId: string) => Promise<void>;
}

export interface DevboxActions {
  get: () => Promise<ResponseProps>;
  create: () => Promise<ResponseProps>;
}

export interface GranularInterfaceActions {
  // Get interface by name (hierarchical path)
  getByName: (
    projectId: string,
    name: string,
    checkpoint?: boolean
  ) => Promise<InterfaceData | null>;
  // Get interface by direct ID
  getById: (interfaceId: string, checkpoint?: boolean) => Promise<InterfaceData | null>;
  // Unified get method
  get: (params: {
    interfaceId?: string;
    projectId?: string;
    name?: string;
    checkpoint?: boolean;
  }) => Promise<InterfaceData | null>;

  // Create interface (no change, always needs projectId) - reuses CreateInterfaceRequest
  create: (projectId: string, name: string, color?: string) => Promise<InterfaceData>;

  // Update methods - reuse UpdateInterfaceRequest
  updateByName: (
    projectId: string,
    name: string,
    data: UpdateInterfaceRequest,
    checkpoint?: boolean
  ) => Promise<InterfaceData>;
  updateById: (
    interfaceId: string,
    data: UpdateInterfaceRequest,
    checkpoint?: boolean
  ) => Promise<InterfaceData>;
  update: (params: {
    interfaceId?: string;
    projectId?: string;
    name?: string;
    data: UpdateInterfaceRequest;
    checkpoint?: boolean;
  }) => Promise<InterfaceData>;

  // Delete methods
  deleteByName: (projectId: string, name: string) => Promise<ResponseProps>;
  deleteById: (interfaceId: string) => Promise<ResponseProps>;
  delete: (params: {
    interfaceId?: string;
    projectId?: string;
    name?: string;
  }) => Promise<ResponseProps>;

  // List interfaces (no change needed)
  list: (projectId: string, checkpoint?: boolean) => Promise<InterfaceData[]>;

  // Checkpoint methods
  checkpointByName: (
    projectId: string,
    name: string,
    description: string
  ) => Promise<ResponseProps>;
  checkpointById: (interfaceId: string, description: string) => Promise<ResponseProps>;
  checkpoint: (params: {
    interfaceId?: string;
    projectId?: string;
    name?: string;
    description: string;
  }) => Promise<ResponseProps>;

  // Checkpoint retrieval methods (read)
  getCheckpointByName: (projectId: string, name: string) => Promise<InterfaceData>;
  getCheckpointById: (interfaceId: string) => Promise<InterfaceData>;
  getCheckpoint: (params: {
    interfaceId?: string;
    projectId?: string;
    name?: string;
  }) => Promise<InterfaceData | null>;

  // Template methods - reuse template request/response schemas
  exportTemplate: (
    params: Omit<
      ExportInterfaceTemplateRequest,
      'checkpoint' | 'includeMetadata' | 'description' | 'tags' | 'templateName'
    >,
    options?: Pick<
      ExportInterfaceTemplateRequest,
      'checkpoint' | 'includeMetadata' | 'description' | 'tags' | 'templateName'
    >
  ) => Promise<TemplateExportResponse<InterfaceTemplateSchema> | { error: string }>;
  importTemplate: (
    template: InterfaceTemplateSchema,
    options?: Omit<ImportInterfaceTemplateRequest, 'template'>
  ) => Promise<TemplateImportResponse | { error: string }>;
}

export interface GranularTabActions {
  // Get tab by name (hierarchical path)
  getByName: (interfaceId: string, name: string, checkpoint?: boolean) => Promise<TabData | null>;
  // Get tab by direct ID
  getById: (id: string, checkpoint?: boolean) => Promise<TabData | null>;
  // Unified get method
  get: (params: {
    id?: string;
    interfaceId?: string;
    name?: string;
    checkpoint?: boolean;
  }) => Promise<TabData | null>;

  // Get tab with tiles - same pattern
  getTabWithTilesByName: (
    interfaceId: string,
    name: string,
    checkpoint?: boolean
  ) => Promise<TabData | null>;
  getTabWithTilesById: (id: string, checkpoint?: boolean) => Promise<TabData | null>;
  getTabWithTiles: (params: {
    id?: string;
    interfaceId?: string;
    name?: string;
    checkpoint?: boolean;
  }) => Promise<TabData | null>;

  // Create tab (parent id + name pattern) - reuses CreateTabRequest fields
  create: (
    interfaceId: string,
    name: string,
    data: Omit<CreateTabRequest, 'tabId' | 'interfaceId' | 'name'>,
    tabId?: string
  ) => Promise<TabData>;

  // Update methods - reuse UpdateTabRequest
  updateByName: (
    interfaceId: string,
    name: string,
    data: UpdateTabRequest,
    checkpoint?: boolean
  ) => Promise<TabData>;
  updateById: (id: string, data: UpdateTabRequest, checkpoint?: boolean) => Promise<TabData>;
  update: (params: {
    id?: string;
    interfaceId?: string;
    name?: string;
    data: UpdateTabRequest;
    checkpoint?: boolean;
  }) => Promise<TabData>;

  // Delete methods
  deleteByName: (interfaceId: string, name: string) => Promise<ResponseProps>;
  deleteById: (id: string) => Promise<ResponseProps>;
  delete: (params: { id?: string; interfaceId?: string; name?: string }) => Promise<ResponseProps>;

  // List tabs in an interface
  list: (interfaceId: string, checkpoint?: boolean) => Promise<TabData[]>;

  // Checkpoint methods
  checkpointByName: (
    interfaceId: string,
    name: string,
    description: string
  ) => Promise<ResponseProps>;
  checkpointById: (id: string, description: string) => Promise<ResponseProps>;
  checkpoint: (params: {
    id?: string;
    interfaceId?: string;
    name?: string;
    description: string;
  }) => Promise<ResponseProps>;

  // Checkpoint retrieval methods (read)
  getCheckpointByName: (interfaceId: string, name: string) => Promise<TabData>;
  getCheckpointById: (id: string) => Promise<TabData>;
  getCheckpoint: (params: {
    id?: string;
    interfaceId?: string;
    name?: string;
  }) => Promise<TabData | null>;

  // Template methods - reuse template request/response schemas
  exportTemplate: (
    params: Omit<
      ExportTabTemplateRequest,
      'checkpoint' | 'includeMetadata' | 'description' | 'tags' | 'templateName'
    >,
    options?: Pick<
      ExportTabTemplateRequest,
      'checkpoint' | 'includeMetadata' | 'description' | 'tags' | 'templateName'
    >
  ) => Promise<TemplateExportResponse<TabTemplateSchema> | { error: string }>;
  importTemplate: (
    template: TabTemplateSchema,
    params: Pick<ImportTabTemplateRequest, 'interfaceId' | 'interfaceName'>,
    options?: Omit<ImportTabTemplateRequest, 'template' | 'interfaceId' | 'interfaceName'>
  ) => Promise<TemplateImportResponse | { error: string }>;
}

export interface GranularTileActions {
  // Get tile by name (hierarchical path)
  getByName: (tabId: string, tileName: string, checkpoint?: boolean) => Promise<TileData | null>;
  // Get tile by direct ID
  getById: (id: string, checkpoint?: boolean) => Promise<TileData | null>;
  // Unified get method that accepts either ID or tabId+name
  get: (params: {
    id?: string;
    tabId?: string;
    name?: string;
    checkpoint?: boolean;
  }) => Promise<TileData | null>;

  // Create tile (single parent id + name pattern) - reuses CreateTileRequest fields
  create: (
    tabId: string,
    name: string,
    position: TilePosition,
    data: Omit<CreateTileRequest, 'tileId' | 'tabId' | 'name' | 'position'>,
    tileId?: string,
    type?: string
  ) => Promise<TileData>;

  // Update methods - reuse UpdateTileRequest
  updateByName: (
    tabId: string,
    name: string,
    data: UpdateTileRequest,
    checkpoint?: boolean
  ) => Promise<TileData>;
  updateById: (id: string, data: UpdateTileRequest, checkpoint?: boolean) => Promise<TileData>;
  update: (params: {
    id?: string;
    tabId?: string;
    name?: string;
    data: UpdateTileRequest;
    checkpoint?: boolean;
  }) => Promise<TileData>;

  // Patch methods - reuse UpdateTileRequest
  patchByName: (
    tabId: string,
    name: string,
    updateData: Partial<UpdateTileRequest>,
    checkpoint?: boolean
  ) => Promise<TileData>;
  patchById: (
    id: string,
    updateData: Partial<UpdateTileRequest>,
    checkpoint?: boolean
  ) => Promise<TileData>;
  patch: (params: {
    id?: string;
    tabId?: string;
    name?: string;
    updateData: Partial<UpdateTileRequest>;
    checkpoint?: boolean;
  }) => Promise<TileData>;

  // Specialized patch methods follow the same pattern
  patchSpecializedByName: (
    tabId: string,
    name: string,
    tileType: 'Table' | 'Plot' | 'View',
    updateData: Record<string, any>,
    checkpoint?: boolean
  ) => Promise<TileData>;

  patchSpecializedById: (
    id: string,
    tileType: 'Table' | 'Plot' | 'View',
    updateData: Record<string, any>,
    checkpoint?: boolean
  ) => Promise<TileData>;

  patchSpecialized: (params: {
    id?: string;
    tabId?: string;
    name?: string;
    tileType: 'Table' | 'Plot' | 'View';
    updateData: Record<string, any>;
    checkpoint?: boolean;
  }) => Promise<TileData>;

  // Delete methods
  deleteByName: (tabId: string, name: string) => Promise<ResponseProps>;
  deleteById: (id: string) => Promise<ResponseProps>;
  delete: (params: { id?: string; tabId?: string; name?: string }) => Promise<ResponseProps>;

  // List tiles in a tab
  list: (tabId: string, type?: string, checkpoint?: boolean) => Promise<TileData[]>;

  // Checkpoint methods
  checkpointByName: (tabId: string, name: string, description: string) => Promise<ResponseProps>;
  checkpointById: (id: string, description: string) => Promise<ResponseProps>;
  checkpoint: (params: {
    id?: string;
    tabId?: string;
    name?: string;
    description: string;
  }) => Promise<ResponseProps>;

  // Checkpoint retrieval methods (read)
  getCheckpointByName: (tabId: string, name: string) => Promise<TileData>;
  getCheckpointById: (id: string) => Promise<TileData>;
  getCheckpoint: (params: {
    id?: string;
    tabId?: string;
    name?: string;
  }) => Promise<TileData | null>;

  // Template methods - reuse template request/response schemas
  exportTemplate: (
    params: Omit<
      ExportTileTemplateRequest,
      'checkpoint' | 'includeMetadata' | 'description' | 'tags' | 'templateName'
    >,
    options?: Pick<
      ExportTileTemplateRequest,
      'checkpoint' | 'includeMetadata' | 'description' | 'tags' | 'templateName'
    >
  ) => Promise<TemplateExportResponse<TileTemplateSchema> | { error: string }>;
  importTemplate: (
    template: TileTemplateSchema,
    params: Pick<ImportTileTemplateRequest, 'tabId' | 'interfaceId' | 'tabName'>,
    options?: Omit<ImportTileTemplateRequest, 'template' | 'tabId' | 'interfaceId' | 'tabName'>
  ) => Promise<TemplateImportResponse | { error: string }>;
}

export interface FileEntry {
  name: string;
  type: string;
  isSymlink?: boolean;
}

export interface FileActions {
  // Retrieve list of file entries in the given project directory.
  // Depending on the backend, this may return the array directly or under a `files` key.
  list: (project: string) => Promise<{ files: FileEntry[] } | FileEntry[]>;
  // Write/overwrite multiple files in the project directory (path -> content)
  write: (project: string, files: Record<string, string>) => Promise<any>;
  // Read the contents of a single file
  read: (project: string, path: string) => Promise<{ content: string }>;
  // Delete a single file from the project directory
  delete: (project: string, path: string, isDirectory?: boolean) => Promise<any>;
  // Rename file or directory
  rename: (project: string, oldPath: string, newPath: string) => Promise<any>;
}

export interface Favourite {
  id: number;
  projectName: string;
  icon: string;
  position: number;
}

export interface FavouritesActions {
  create: (projectName: string, icon: string, position: number) => Promise<Favourite>;
  delete: (id: number) => Promise<boolean>;
}
