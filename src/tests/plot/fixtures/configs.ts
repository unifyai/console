/**
 * Plot Test Configuration Factories
 *
 * Defines atomic config options and generates all valid combinations
 * via full cartesian product with validity filtering.
 *
 * Used by:
 * - API tests (plot.api.node.test.ts)
 * - Integration tests (scatter/bar/histogram/line.browser.test.tsx)
 */

// =============================================================================
// Environment Variables for Plot Test Configuration
// =============================================================================

/**
 * Scale selection - which data scales to run tests for
 * Options: 'small' | 'medium' | 'large' | 'all' (default: 'small')
 *
 * Examples:
 *   PLOT_TEST_SCALE=small npm test   # Only run small scale tests (100 items) - default
 *   PLOT_TEST_SCALE=medium npm test  # Only run medium scale tests (1000 items)
 *   PLOT_TEST_SCALE=large npm test   # Only run large scale tests (10000 items)
 *   PLOT_TEST_SCALE=all npm test     # Run all scales
 */
const VALID_SCALES = ['small', 'medium', 'large', 'all'] as const;
type ValidScale = (typeof VALID_SCALES)[number];

// Use import.meta.env for browser tests (Vite injects these at compile time)
// Fallback to process.env for Node.js tests
const rawScaleEnv = typeof import.meta !== 'undefined' && (import.meta as any).env?.PLOT_TEST_SCALE
  ? String((import.meta as any).env.PLOT_TEST_SCALE)
  : process.env.PLOT_TEST_SCALE;
const rawScale = (rawScaleEnv ?? 'small').toLowerCase();
const isValidScale = (s: string): s is ValidScale => VALID_SCALES.includes(s as ValidScale);

// Warn if invalid scale provided
if (rawScale && !isValidScale(rawScale)) {
  console.warn(`[Plot Tests] Invalid PLOT_TEST_SCALE="${rawScale}", using "small". Valid options: ${VALID_SCALES.join(', ')}`);
}

export const PLOT_TEST_SCALE: ValidScale = isValidScale(rawScale) ? rawScale : 'small';

// Derive skip flags from PLOT_TEST_SCALE
const shouldRunScale = (scaleName: string): boolean => {
  if (PLOT_TEST_SCALE === 'all') return true;
  return PLOT_TEST_SCALE === scaleName;
};

/**
 * Sampling percentage (1-100, default 100 = no sampling)
 * Use lower values for faster CI runs
 *
 * Example:
 *   PLOT_TEST_SAMPLE_RATE=25 npm test  # Test 25% of config combinations
 */
// Use import.meta.env for browser tests (Vite injects these at compile time)
// Fallback to process.env for Node.js tests
const rawSampleRate = typeof import.meta !== 'undefined' && (import.meta as any).env?.PLOT_TEST_SAMPLE_RATE
  ? String((import.meta as any).env.PLOT_TEST_SAMPLE_RATE)
  : process.env.PLOT_TEST_SAMPLE_RATE;
export const PLOT_TEST_SAMPLE_RATE = Math.max(1, Math.min(100,
  parseInt(rawSampleRate ?? '100', 10)
));

/**
 * Use real API instead of mocked (default: true, requires running backend)
 * Set to 'false' to use MSW mocked responses instead
 *
 * Example:
 *   PLOT_TEST_API_REAL=false npm test  # Use mocked API responses
 *   PLOT_TEST_API_REAL=true VITE_TEST_API_URL=http://localhost:8000 npm test
 */
export const PLOT_TEST_API_REAL = process.env.PLOT_TEST_API_REAL !== 'false';
export const VITE_TEST_API_URL = process.env.VITE_TEST_API_URL ?? 'http://localhost:3000';

/**
 * API key for plot API tests (configurable via environment variable)
 */
export const VITE_TEST_API_KEY = process.env.VITE_TEST_API_KEY ?? 'test-api-key-12345';

// =============================================================================
// Constants
// =============================================================================

export const TEST_PROJECT = 'test-plot-api';

// =============================================================================
// Atomic Config Options (PlotConfigInput from schema.py)
// =============================================================================

export const plotConfigOptions = {
  type: ['scatter', 'bar', 'histogram', 'line'] as const,
  scale_x: ['linear', 'log'] as const,
  scale_y: ['linear', 'log'] as const,
  aggregate: [undefined, 'sum', 'mean', 'count', 'min', 'max'] as const,
  group_by: [undefined, 'category'] as const,
  show_regression: [false, true] as const,
  sort_by: [undefined, 'x', 'y', 'value', 'name'] as const,
  sort_order: [undefined, 'asc', 'desc'] as const,
  bin_count: [10, 1, 50, 100] as const,
};

export const projectConfigOptions = {
  limit: [100, 1000, 10000] as const,
  filter_expr: [undefined, "status == 'success'", 'value > 0'] as const,
  group_by: [undefined, ['category'], ['category', 'model']] as const,
  // Sorting format: {"field_name": "ascending" | "descending"}
  sorting: [
    undefined,
    JSON.stringify({ timestamp: 'descending' }),
  ] as const,
};

export const dataTypeOptions = {
  x_axis_type: ['float', 'int', 'datetime', 'str'] as const,
  y_axis_type: ['float', 'int'] as const,
  group_by_type: ['str', 'bool'] as const,
};

/**
 * Get the field name suffix for a given data type.
 * Maps data types to their seeded field variants.
 */
export function getFieldForDataType(baseField: string, dataType: string): string {
  // float is the default, no suffix needed
  if (dataType === 'float') return baseField;
  
  // Other types have suffixed field names
  return `${baseField}_${dataType}`;
}

/**
 * Get the grouping field for a given group_by type.
 */
export function getGroupByFieldForType(groupByType: string): string {
  if (groupByType === 'bool') return 'table1.bool_category';
  return 'table1.category'; // default str
}

// Timeouts are higher when using real API to account for network latency
const baseTimeouts = PLOT_TEST_API_REAL
  ? { small: 20000, medium: 60000, large: 120000 }
  : { small: 5000, medium: 15000, large: 30000 };

export const scaleOptions = [
  { name: 'small' as const, count: 100, skip: !shouldRunScale('small'), timeout: baseTimeouts.small },
  { name: 'medium' as const, count: 1000, skip: !shouldRunScale('medium'), timeout: baseTimeouts.medium },
  { name: 'large' as const, count: 10000, skip: !shouldRunScale('large'), timeout: baseTimeouts.large },
];

// =============================================================================
// Types
// =============================================================================

export type PlotType = (typeof plotConfigOptions.type)[number];
export type ScaleType = (typeof plotConfigOptions.scale_x)[number];
export type AggregateType = (typeof plotConfigOptions.aggregate)[number];
export type SortByType = (typeof plotConfigOptions.sort_by)[number];
export type SortOrderType = (typeof plotConfigOptions.sort_order)[number];

export type PlotConfig = {
  type: PlotType;
  x_axis: string;
  y_axis?: string;
  scale_x: ScaleType;
  scale_y: ScaleType;
  aggregate?: AggregateType;
  group_by?: string;
  show_regression: boolean;
  sort_by?: SortByType;
  sort_order?: SortOrderType;
  bin_count: number;
};

export type ProjectConfig = {
  project_name: string;
  context?: string;
  limit: number;
  filter_expr?: string;
  group_by?: string[];
  sorting?: string;
};

export type DataTypeConfig = {
  x_axis_type: (typeof dataTypeOptions.x_axis_type)[number];
  y_axis_type: (typeof dataTypeOptions.y_axis_type)[number];
  group_by_type: (typeof dataTypeOptions.group_by_type)[number];
};

export type ScaleOption = (typeof scaleOptions)[number];

// =============================================================================
// Scale Helpers
// =============================================================================

/**
 * Get active (non-skipped) scale options based on PLOT_TEST_SCALE
 */
export function getActiveScales(): ScaleOption[] {
  return scaleOptions.filter((s) => !s.skip);
}

// =============================================================================
// Sampling Utilities
// =============================================================================

/**
 * Sample an array based on configured percentage (PLOT_TEST_SAMPLE_RATE)
 * Uses evenly distributed sampling rather than just taking first N elements
 *
 * @param items Array to sample from
 * @param overridePercentage Optional override for the sampling percentage
 * @returns Sampled array
 */
export function sampleConfigs<T>(items: T[], overridePercentage?: number): T[] {
  const percentage = overridePercentage ?? PLOT_TEST_SAMPLE_RATE;

  if (percentage >= 100) return items;
  if (percentage <= 0 || items.length === 0) return [];

  const sampleCount = Math.max(1, Math.ceil(items.length * percentage / 100));

  // Evenly distributed sampling
  const step = items.length / sampleCount;
  return Array.from({ length: sampleCount }, (_, i) =>
    items[Math.floor(i * step)]
  );
}

/**
 * Sample configs with a specific count (alternative to percentage)
 */
export function sampleConfigsCount<T>(items: T[], maxCount: number): T[] {
  if (items.length <= maxCount) return items;

  const step = items.length / maxCount;
  return Array.from({ length: maxCount }, (_, i) =>
    items[Math.floor(i * step)]
  );
}

// =============================================================================
// Combination Generators
// =============================================================================

/**
 * Generate all PlotConfig combinations (cartesian product)
 */
export function generateAllPlotConfigs(): PlotConfig[] {
  const configs: PlotConfig[] = [];

  for (const type of plotConfigOptions.type) {
    for (const scale_x of plotConfigOptions.scale_x) {
      for (const scale_y of plotConfigOptions.scale_y) {
        for (const aggregate of plotConfigOptions.aggregate) {
          for (const group_by of plotConfigOptions.group_by) {
            for (const show_regression of plotConfigOptions.show_regression) {
              for (const sort_by of plotConfigOptions.sort_by) {
                for (const sort_order of plotConfigOptions.sort_order) {
                  for (const bin_count of plotConfigOptions.bin_count) {
                    configs.push({
                      type,
                      x_axis: 'table1.x_value',
                      y_axis: type === 'histogram' ? undefined : 'table1.y_value',
                      scale_x,
                      scale_y,
                      aggregate,
                      group_by: group_by ? 'table1.category' : undefined,
                      show_regression,
                      sort_by,
                      sort_order,
                      bin_count,
                    });
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return configs;
}

/**
 * Filter to valid combinations only
 *
 * Rules:
 * - show_regression: scatter-only
 * - bin_count (non-default): histogram-only
 * - sort_by/sort_order: bar-only
 * - aggregate: requires group_by (valid for ALL plot types)
 * - y_axis: required for non-histogram
 * - log scales: histograms always use linear (scale params ignored)
 */
export function filterValidPlotConfigs(configs: PlotConfig[]): PlotConfig[] {
  return configs.filter((config) => {
    // Regression: scatter-only
    if (config.show_regression && config.type !== 'scatter') return false;

    // Bin count (non-default): histogram-only
    if (config.type !== 'histogram' && config.bin_count !== 10) return false;

    // Sort: bar-only
    if (config.type !== 'bar' && (config.sort_by || config.sort_order))
      return false;

    // If sort_order is set, sort_by must be set
    if (config.sort_order && !config.sort_by) return false;

    // Aggregate: requires grouping (valid for ALL plot types)
    if (config.aggregate && !config.group_by) return false;

    // y_axis: required for non-histogram
    if (config.type !== 'histogram' && !config.y_axis) return false;

    // Histograms always use linear scales (component ignores scale_x/scale_y)
    // Only test histograms with linear scales to match actual behavior
    if (config.type === 'histogram' && (config.scale_x === 'log' || config.scale_y === 'log')) {
      return false;
    }

    return true;
  });
}

/**
 * Generate all valid PlotConfig combinations
 */
export function generateValidPlotConfigs(): PlotConfig[] {
  return filterValidPlotConfigs(generateAllPlotConfigs());
}

/**
 * Generate valid PlotConfig combinations filtered by plot type
 */
export function generateValidPlotConfigsForType(
  plotType: PlotType
): PlotConfig[] {
  return generateValidPlotConfigs().filter((config) => config.type === plotType);
}

/**
 * Generate all ProjectConfig combinations
 *
 * Note: Currently not used in matrix tests. Available for future expansion
 * when testing project-level filtering, sorting, and grouping behaviors.
 */
export function generateProjectConfigs(): ProjectConfig[] {
  const configs: ProjectConfig[] = [];

  for (const limit of projectConfigOptions.limit) {
    for (const filter_expr of projectConfigOptions.filter_expr) {
      for (const group_by of projectConfigOptions.group_by) {
        for (const sorting of projectConfigOptions.sorting) {
          configs.push({
            project_name: TEST_PROJECT,
            limit,
            filter_expr,
            group_by: group_by ? [...group_by] : undefined, // Convert readonly to mutable
            sorting,
          });
        }
      }
    }
  }

  return configs;
}

/**
 * Generate all DataTypeConfig combinations
 */
export function generateDataTypeConfigs(): DataTypeConfig[] {
  const configs: DataTypeConfig[] = [];

  for (const x_axis_type of dataTypeOptions.x_axis_type) {
    for (const y_axis_type of dataTypeOptions.y_axis_type) {
      for (const group_by_type of dataTypeOptions.group_by_type) {
        configs.push({ x_axis_type, y_axis_type, group_by_type });
      }
    }
  }

  return configs;
}

// =============================================================================
// Naming Utilities
// =============================================================================

/**
 * Generate a unique, descriptive name for a PlotConfig
 */
export function plotConfigName(config: PlotConfig): string {
  const parts: string[] = [config.type];
  if (config.group_by) parts.push('grouped');
  if (config.aggregate) parts.push(config.aggregate);
  if (config.scale_x === 'log') parts.push('logX');
  if (config.scale_y === 'log') parts.push('logY');
  if (config.show_regression) parts.push('regression');
  if (config.sort_by) parts.push(`sort-${config.sort_by}`);
  if (config.sort_order) parts.push(config.sort_order);
  if (config.type === 'histogram' && config.bin_count !== 10)
    parts.push(`bins-${config.bin_count}`);
  return parts.join('-');
}

/**
 * Generate a unique name for a DataTypeConfig
 */
export function dataTypeConfigName(config: DataTypeConfig): string {
  return `x-${config.x_axis_type}_y-${config.y_axis_type}_g-${config.group_by_type}`;
}

/**
 * Generate a unique name for a ProjectConfig
 */
export function projectConfigName(config: ProjectConfig): string {
  const parts: string[] = [];
  if (config.filter_expr) parts.push(`filter:${config.filter_expr.slice(0, 10)}`);
  if (config.group_by && config.group_by.length > 0) parts.push(`grp:${config.group_by.join(',')}`);
  if (config.sorting) parts.push('sorted');
  return parts.length > 0 ? parts.join('-') : 'default';
}

/**
 * Generate a full test alias (without project config)
 */
export function generateTestAlias(
  testType: string,
  plotConfig: PlotConfig,
  dataTypes: DataTypeConfig,
  scale: ScaleOption
): string {
  return `${testType}-${plotConfigName(plotConfig)}-${dataTypeConfigName(dataTypes)}-${scale.name}`;
}

/**
 * Generate a full test alias with project config
 */
export function generateTestAliasWithProject(
  testType: string,
  projectConfig: ProjectConfig,
  plotConfig: PlotConfig,
  dataTypes: DataTypeConfig,
  scale: ScaleOption
): string {
  return `${testType}-${projectConfigName(projectConfig)}-${plotConfigName(plotConfig)}-${dataTypeConfigName(dataTypes)}-${scale.name}`;
}

/**
 * Generate a deterministic test context for concurrent API test isolation.
 * Uses a hash-like format based on test parameters to ensure unique,
 * reproducible contexts that prevent database contention.
 *
 * Format: test-{plotType}-{configHash}-{dataTypeHash}-{scale}
 */
export function generateTestContext(
  plotConfig: PlotConfig,
  projectConfig: ProjectConfig,
  dataTypes: DataTypeConfig,
  scale: ScaleOption
): string {
  // Create a short, deterministic identifier for each dimension
  const plotHash = `${plotConfig.type[0]}${plotConfig.scale_x[0]}${plotConfig.scale_y[0]}${plotConfig.aggregate?.[0] ?? 'n'}${plotConfig.group_by ? 'g' : 'u'}`;
  const projHash = `${projectConfig.filter_expr ? 'f' : 'n'}${projectConfig.group_by?.length ?? 0}${projectConfig.sorting ? 's' : 'n'}`;
  const dataHash = `${dataTypes.x_axis_type[0]}${dataTypes.y_axis_type[0]}${dataTypes.group_by_type[0]}`;

  return `test-${plotHash}-${projHash}-${dataHash}-${scale.name}`;
}

// =============================================================================
// Pre-generated Combinations (for import)
// =============================================================================

export const validPlotConfigs = generateValidPlotConfigs();
export const validDataTypeConfigs = generateDataTypeConfigs();
export const validProjectConfigs = generateProjectConfigs();

// Log counts for debugging
if (process.env.PLOT_TEST_MATRIX_DEBUG === 'true') {
  console.log(`[Plot Test Matrix] Scale: ${PLOT_TEST_SCALE}`);
  console.log(`[Plot Test Matrix] Sample %: ${PLOT_TEST_SAMPLE_RATE}%`);
  console.log(`[Plot Test Matrix] Real API: ${PLOT_TEST_API_REAL}`);
  console.log(`[Plot Test Matrix] Plot configs: ${validPlotConfigs.length}`);
  console.log(`[Plot Test Matrix] Data type configs: ${validDataTypeConfigs.length}`);
  console.log(`[Plot Test Matrix] Project configs: ${validProjectConfigs.length}`);
  console.log(`[Plot Test Matrix] Active scales: ${getActiveScales().map(s => s.name).join(', ') || 'none'}`);
}


