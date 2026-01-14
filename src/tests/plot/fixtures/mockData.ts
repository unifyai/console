/**
 * Mock Data Generators for Plot Tests
 *
 * Generates type-aware mock logs and fields based on DataTypeConfig.
 * Supports all 12 data types: float, int, str, bool, datetime, time, date,
 * timedelta, dict, list, set, tuple, Any, image, embedding.
 *
 * Used by:
 * - API tests (mocked responses)
 * - Integration tests (PlotCanvas rendering)
 */

import type { DataTypeConfig } from './configs';

// More flexible scale option type for mock data generation
export interface MockScaleOption {
  name: string;
  count: number;
  skip: boolean;
  timeout: number;
}

// =============================================================================
// Types
// =============================================================================

export type LogEntry = {
  id: string;
  timestamp: string;
  'table1.id': string;
  'table1.entries': Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type FieldDefinition = {
  path: string;
  type: string;
  display_type?: string;
  count?: number;
};

// =============================================================================
// Value Generators by Data Type
// =============================================================================

/**
 * Value generators for random-like data (uses index and seed for reproducibility)
 */
const valueGenerators: Record<string, (index: number, seed?: number) => unknown> = {
  float: (i, seed = 0) => (i + seed) * 1.5 + Math.sin(i) * 10,
  int: (i, seed = 0) => Math.floor((i + seed) * 2.5),
  // Use seed to create independent distributions for different fields
  // X-axis (seed=0): category_0, category_1, category_2, category_3, category_4, category_0, ...
  // Group (seed=200): use different pattern so x and group aren't correlated
  str: (i, seed = 0) => {
    // When seed > 0 (group-by field), use a different modulo cycle
    // This ensures x=0 can have group=0,1,2,3,4 across different logs
    const groupOffset = seed > 0 ? Math.floor(i / 5) : 0;
    return `category_${(i + groupOffset) % 5}`;
  },
  // For bool, alternate by index and use seed to shift the pattern
  bool: (i, seed = 0) => (seed > 0 ? i + 1 : i) % 2 === 0,
  datetime: (i) => new Date(Date.now() - i * 86400000).toISOString(),
  time: (i) => `${String(i % 24).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}:00`,
  date: (i) => new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
  timedelta: (i) => `${i} days, ${i % 24}:00:00`,
  dict: (i) => ({ nested_value: i * 10, nested_label: `item_${i}` }),
  list: (i) => [i, i * 2, i * 3],
  set: (i) => [i, i + 1, i + 2], // JSON doesn't support sets, use array
  tuple: (i) => [i, `tuple_${i}`], // JSON doesn't support tuples, use array
  Any: (i) => (i % 3 === 0 ? i : i % 3 === 1 ? `any_${i}` : { val: i }),
  image: (i) => `https://example.com/image_${i}.png`,
  embedding: (i) => Array.from({ length: 128 }, (_, j) => Math.sin(i + j) * 0.5),
};

/**
 * Deterministic value generators for precise position assertions
 * Returns exact values that can be predicted in tests
 */
const deterministicValueGenerators: Record<string, (index: number, count: number) => unknown> = {
  float: (i, count) => {
    // Generate values evenly spaced between 1 and 100
    // Start from 1 (not 0) to avoid log(0) issues with log scales
    return 1 + (i / Math.max(1, count - 1)) * 99;
  },
  int: (i, count) => {
    // Generate integer values evenly spaced between 1 and 100
    // Start from 1 (not 0) to avoid log(0) issues with log scales
    return Math.max(1, Math.round((i / Math.max(1, count - 1)) * 100));
  },
  str: (i) => `category_${i % 5}`,
  bool: (i) => i % 2 === 0,
  datetime: (i, count) => {
    // Generate dates evenly spaced over 30 days
    const baseTime = new Date('2024-01-01T00:00:00Z').getTime();
    const timeOffset = (i / Math.max(1, count - 1)) * 30 * 24 * 60 * 60 * 1000;
    return new Date(baseTime + timeOffset).toISOString();
  },
  time: (i, count) => {
    const totalSeconds = Math.floor((i / Math.max(1, count - 1)) * 86400);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  },
  date: (i, count) => {
    const baseTime = new Date('2024-01-01T00:00:00Z').getTime();
    const timeOffset = (i / Math.max(1, count - 1)) * 30 * 24 * 60 * 60 * 1000;
    return new Date(baseTime + timeOffset).toISOString().split('T')[0];
  },
  timedelta: (i, count) => {
    // Generate timedeltas evenly spaced from 1 hour to 30 days
    // Start from 1 hour (not 0) to avoid log(0) issues with log scales
    // Format matches Python timedelta string: "X days, HH:MM:SS"
    const minSeconds = 3600; // 1 hour minimum
    const maxSeconds = 30 * 24 * 60 * 60; // 30 days
    const totalSeconds = Math.floor(
      minSeconds + (i / Math.max(1, count - 1)) * (maxSeconds - minSeconds)
    );
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${days} days, ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  },
};

/**
 * Generate a value for a given data type
 */
export function generateValue(type: string, index: number, seed = 0): unknown {
  const generator = valueGenerators[type];
  if (generator) {
    return generator(index, seed);
  }
  // Fallback for unknown types
  return `unknown_${type}_${index}`;
}

// =============================================================================
// Mock Log Generators
// =============================================================================

export interface MockLogOptions {
  dataTypeConfig: DataTypeConfig;
  scale: MockScaleOption;
  includeNulls?: boolean;
  nullPercentage?: number;
  includeEdgeCases?: boolean;
  /**
   * If true, generates deterministic data with predictable values
   * for precise position/dimension assertions
   */
  deterministic?: boolean;
}

/**
 * Create mock logs with type-aware data
 */
export function createMockLogs(options: MockLogOptions): LogEntry[] {
  const {
    dataTypeConfig,
    scale,
    includeNulls = false,
    nullPercentage = 0.05,
    includeEdgeCases = true,
    deterministic = false,
  } = options;

  const count = scale.count;
  const logs: LogEntry[] = [];

  for (let i = 0; i < count; i++) {
    // In deterministic mode, we use fixed null positions instead of random
    const isNullEntry =
      includeNulls &&
      (deterministic ? i % Math.ceil(1 / nullPercentage) === 0 : Math.random() < nullPercentage);

    const log: LogEntry = {
      id: `log_${i}`,
      timestamp: deterministic
        ? new Date(new Date('2024-01-01').getTime() + i * 60000).toISOString()
        : new Date(Date.now() - i * 60000).toISOString(),
      'table1.id': `log_${i}`,
      'table1.entries': {
        // Keys must include table prefix to match API response format
        'table1.x_value': isNullEntry
          ? null
          : deterministic
            ? generateDeterministicValue(dataTypeConfig.xAxisType, i, count)
            : generateValue(dataTypeConfig.xAxisType, i, 0),
        'table1.y_value': isNullEntry
          ? null
          : deterministic
            ? generateDeterministicValue(dataTypeConfig.yAxisType, i, count, 50) // offset by 50 for y
            : generateValue(dataTypeConfig.yAxisType, i, 100),
        'table1.category': generateValue(dataTypeConfig.groupByType, i, 200),
        'table1.status': i % 4 === 0 ? 'error' : i % 2 === 0 ? 'success' : 'pending',
        'table1.value': deterministic
          ? (i / Math.max(1, count - 1)) * 1000
          : generateValue('float', i, 300),
        'table1.count': deterministic ? i : generateValue('int', i, 400),
        'table1.label': `Item ${i}`,
      },
    };

    logs.push(log);
  }

  // Add edge cases at the end (skip in deterministic mode for precise counts)
  if (includeEdgeCases && !deterministic) {
    logs.push(...createEdgeCaseLogs(dataTypeConfig, logs.length));
  }

  return logs;
}

/**
 * Generate deterministic values for precise assertions
 */
function generateDeterministicValue(
  type: string,
  index: number,
  count: number,
  offset = 0
): unknown {
  const generator = deterministicValueGenerators[type];
  if (generator) {
    const value = generator(index, count);
    // For numeric types, add offset
    if (typeof value === 'number' && offset !== 0) {
      return value + offset;
    }
    return value;
  }
  // Fallback to regular generator
  return generateValue(type, index, offset);
}

/**
 * Create deterministic mock logs for precise position assertions
 * Generates exact, predictable values for testing SVG element positions
 */
export function createDeterministicMockLogs(
  dataTypeConfig: DataTypeConfig,
  count: number
): DeterministicLogSet {
  const logs = createMockLogs({
    dataTypeConfig,
    scale: { name: 'custom', count, skip: false, timeout: 5000 },
    includeNulls: false,
    includeEdgeCases: false,
    deterministic: true,
  });

  // Pre-compute expected values for assertions
  const xValues = logs.map((l) => l['table1.entries']['table1.x_value'] as number);
  const yValues = logs.map((l) => l['table1.entries']['table1.y_value'] as number);

  const numericXValues = xValues.filter((v) => typeof v === 'number' && Number.isFinite(v));
  const numericYValues = yValues.filter((v) => typeof v === 'number' && Number.isFinite(v));

  return {
    logs,
    expectedXValues: xValues,
    expectedYValues: yValues,
    xDomain: {
      min: numericXValues.length > 0 ? Math.min(...numericXValues) : 0,
      max: numericXValues.length > 0 ? Math.max(...numericXValues) : 100,
    },
    yDomain: {
      min: numericYValues.length > 0 ? Math.min(...numericYValues) : 0,
      max: numericYValues.length > 0 ? Math.max(...numericYValues) : 100,
    },
    count: logs.length,
  };
}

/**
 * Deterministic log set with pre-computed expected values
 */
export interface DeterministicLogSet {
  logs: LogEntry[];
  expectedXValues: unknown[];
  expectedYValues: unknown[];
  xDomain: { min: number; max: number };
  yDomain: { min: number; max: number };
  count: number;
}

/**
 * Create edge case logs for testing robustness
 */
function createEdgeCaseLogs(dataTypeConfig: DataTypeConfig, startIndex: number): LogEntry[] {
  const edgeCases: LogEntry[] = [];

  // Null values
  edgeCases.push({
    id: `log_edge_null_${startIndex}`,
    timestamp: new Date().toISOString(),
    'table1.id': `log_edge_null_${startIndex}`,
    'table1.entries': {
      'table1.x_value': null,
      'table1.y_value': null,
      'table1.category': null,
      'table1.status': 'success',
      'table1.value': 0,
      'table1.count': 0,
      'table1.label': 'Null edge case',
    },
  });

  // Zero values (for numeric types)
  if (['float', 'int'].includes(dataTypeConfig.xAxisType)) {
    edgeCases.push({
      id: `log_edge_zero_${startIndex + 1}`,
      timestamp: new Date().toISOString(),
      'table1.id': `log_edge_zero_${startIndex + 1}`,
      'table1.entries': {
        'table1.x_value': 0,
        'table1.y_value': 0,
        'table1.category': 'zero_category',
        'table1.status': 'success',
        'table1.value': 0,
        'table1.count': 0,
        'table1.label': 'Zero edge case',
      },
    });
  }

  // Negative values (for numeric types)
  if (['float', 'int'].includes(dataTypeConfig.xAxisType)) {
    edgeCases.push({
      id: `log_edge_negative_${startIndex + 2}`,
      timestamp: new Date().toISOString(),
      'table1.id': `log_edge_negative_${startIndex + 2}`,
      'table1.entries': {
        'table1.x_value': -100,
        'table1.y_value': -50,
        'table1.category': 'negative_category',
        'table1.status': 'error',
        'table1.value': -999,
        'table1.count': -1,
        'table1.label': 'Negative edge case',
      },
    });
  }

  // Very large values (for numeric types)
  if (['float', 'int'].includes(dataTypeConfig.xAxisType)) {
    edgeCases.push({
      id: `log_edge_large_${startIndex + 3}`,
      timestamp: new Date().toISOString(),
      'table1.id': `log_edge_large_${startIndex + 3}`,
      'table1.entries': {
        'table1.x_value': dataTypeConfig.xAxisType === 'float' ? 1e15 : Number.MAX_SAFE_INTEGER,
        'table1.y_value': dataTypeConfig.yAxisType === 'float' ? 1e15 : Number.MAX_SAFE_INTEGER,
        'table1.category': 'large_category',
        'table1.status': 'success',
        'table1.value': 1e10,
        'table1.count': 1000000,
        'table1.label': 'Large value edge case',
      },
    });
  }

  // Empty string (for string types)
  if (dataTypeConfig.xAxisType === 'str') {
    edgeCases.push({
      id: `log_edge_empty_str_${startIndex + 4}`,
      timestamp: new Date().toISOString(),
      'table1.id': `log_edge_empty_str_${startIndex + 4}`,
      'table1.entries': {
        'table1.x_value': '',
        'table1.y_value': 0,
        'table1.category': '',
        'table1.status': 'success',
        'table1.value': 0,
        'table1.count': 0,
        'table1.label': 'Empty string edge case',
      },
    });
  }

  // Extreme datetime (for datetime types)
  if (dataTypeConfig.xAxisType === 'datetime') {
    edgeCases.push({
      id: `log_edge_future_date_${startIndex + 5}`,
      timestamp: new Date().toISOString(),
      'table1.id': `log_edge_future_date_${startIndex + 5}`,
      'table1.entries': {
        'table1.x_value': new Date(Date.now() + 365 * 86400000 * 100).toISOString(),
        'table1.y_value': 9999,
        'table1.category': 'future_category',
        'table1.status': 'pending',
        'table1.value': 0,
        'table1.count': 0,
        'table1.label': 'Future date edge case',
      },
    });
  }

  return edgeCases;
}

// =============================================================================
// Mock Field Generators
// =============================================================================

/**
 * Create mock field definitions in LogFieldsResponseProps format
 * This returns an object with field paths as keys, matching the API response format
 */
export function createMockFields(dataTypeConfig: DataTypeConfig): Record<
  string,
  {
    dataType: string;
    fieldType: 'entry' | 'derived_entry';
    artifacts: string;
    mutable: 'true' | 'false';
    createdAt: string;
    description?: string;
  }
> {
  const now = new Date().toISOString();

  const fieldDefs = [
    { path: 'table1.x_value', type: dataTypeConfig.xAxisType },
    { path: 'table1.y_value', type: dataTypeConfig.yAxisType },
    { path: 'table1.category', type: dataTypeConfig.groupByType },
    { path: 'table1.status', type: 'str' },
    { path: 'table1.value', type: 'float' },
    { path: 'table1.count', type: 'int' },
    { path: 'table1.label', type: 'str' },
    { path: 'timestamp', type: 'datetime' },
    { path: 'id', type: 'str' },
  ];

  const result: Record<
    string,
    {
      dataType: string;
      fieldType: 'entry' | 'derived_entry';
      artifacts: string;
      mutable: 'true' | 'false';
      createdAt: string;
    }
  > = {};

  for (const field of fieldDefs) {
    result[field.path] = {
      dataType: field.type,
      fieldType: 'entry',
      artifacts: '',
      mutable: 'false',
      createdAt: now,
    };
  }

  return result;
}

/**
 * Create mock field definitions as array (legacy format for some tests)
 */
export function createMockFieldsArray(dataTypeConfig: DataTypeConfig): FieldDefinition[] {
  return [
    {
      path: 'table1.x_value',
      type: dataTypeConfig.xAxisType,
      display_type: mapToDisplayType(dataTypeConfig.xAxisType),
      count: 100,
    },
    {
      path: 'table1.y_value',
      type: dataTypeConfig.yAxisType,
      display_type: mapToDisplayType(dataTypeConfig.yAxisType),
      count: 100,
    },
    {
      path: 'table1.category',
      type: dataTypeConfig.groupByType,
      display_type: mapToDisplayType(dataTypeConfig.groupByType),
      count: 5,
    },
    {
      path: 'table1.status',
      type: 'str',
      display_type: 'string',
      count: 3,
    },
    {
      path: 'table1.value',
      type: 'float',
      display_type: 'number',
      count: 100,
    },
    {
      path: 'table1.count',
      type: 'int',
      display_type: 'number',
      count: 100,
    },
    {
      path: 'table1.label',
      type: 'str',
      display_type: 'string',
      count: 100,
    },
    {
      path: 'timestamp',
      type: 'datetime',
      display_type: 'datetime',
      count: 100,
    },
    {
      path: 'id',
      type: 'str',
      display_type: 'string',
      count: 100,
    },
  ];
}

/**
 * Map internal type to display type (used by frontend)
 */
function mapToDisplayType(type: string): string {
  const displayTypeMap: Record<string, string> = {
    float: 'number',
    int: 'number',
    str: 'string',
    bool: 'boolean',
    datetime: 'datetime',
    time: 'time',
    date: 'date',
    timedelta: 'string',
    dict: 'object',
    list: 'array',
    set: 'array',
    tuple: 'array',
    Any: 'unknown',
    image: 'image',
    embedding: 'embedding',
  };

  return displayTypeMap[type] || 'unknown';
}

// =============================================================================
// Aggregate Data Generators (for grouped plots)
// =============================================================================

/**
 * Create pre-aggregated mock data for grouped plots
 */
export function createAggregatedMockData(
  logs: LogEntry[],
  groupBy: string,
  aggregate: 'sum' | 'mean' | 'count' | 'min' | 'max',
  valueField: string
): Array<{ group: string; value: number }> {
  const groups: Record<string, number[]> = {};

  for (const log of logs) {
    const groupValue = getNestedValue(log, groupBy);
    const numericValue = getNestedValue(log, valueField);

    if (groupValue == null || numericValue == null) continue;

    const groupKey = String(groupValue);
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(Number(numericValue));
  }

  return Object.entries(groups).map(([group, values]) => ({
    group,
    value: computeAggregate(values, aggregate),
  }));
}

function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function computeAggregate(
  values: number[],
  aggregate: 'sum' | 'mean' | 'count' | 'min' | 'max'
): number {
  if (values.length === 0) return 0;

  switch (aggregate) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'mean':
      return values.reduce((a, b) => a + b, 0) / values.length;
    case 'count':
      return values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    default:
      return values[0];
  }
}

// =============================================================================
// Test Metadata
// =============================================================================

export interface TestMeta {
  alias: string;
  scenario: string;
  behavior: string;
  dataTypes: DataTypeConfig;
  scale: MockScaleOption;
}

/**
 * Create test metadata object
 */
export function createTestMeta(
  alias: string,
  scenario: string,
  behavior: string,
  dataTypes: DataTypeConfig,
  scale: MockScaleOption
): TestMeta {
  return {
    alias,
    scenario,
    behavior,
    dataTypes,
    scale,
  };
}
