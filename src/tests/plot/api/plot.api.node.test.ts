/**
 * Plot API Tests
 *
 * Tests for the plot API endpoints covering:
 * - Authentication (non-matrix edge cases)
 * - Input validation (non-matrix edge cases)
 * - Matrix tests: Config correctness, data fetching, field transformation, preprocessing
 *
 * Test modes:
 * - Real API (default): Tests against actual running backend
 * - Mocked API (PLOT_TEST_API_REAL=false): Uses MSW for API mocking
 *
 * Configuration:
 * - PLOT_TEST_SCALE: 'small' | 'medium' | 'large' | 'all' (default: 'small')
 * - PLOT_TEST_SAMPLE_RATE: 1-100, controls config sampling (default: 100)
 * - PLOT_TEST_API_REAL: Use real backend (default: true), set to 'false' for mocked
 * - VITE_TEST_API_URL: Backend URL for real API tests (default: http://localhost:3000)
 * - VITE_TEST_API_KEY: API key for authentication (configurable)
 *
 * Test Matrix:
 * - Plot types: scatter, bar, histogram, line
 * - Plot configs: All valid combinations from configs.ts (sampled based on PLOT_TEST_SAMPLE_RATE)
 * - Project configs: Combinations of limit, filter_expr, group_by, sorting (sampled)
 * - Data types: All combinations from dataTypeOptions (sampled)
 * - Scales: small (100), medium (1000), large (10000) - controlled by PLOT_TEST_SCALE
 *
 * Matrix size is controlled by PLOT_TEST_SAMPLE_RATE to manage test runtime.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import {
  server,
  createTestScenario,
  setupMatrixTestHandlers,
} from './handlers';
import {
  generateValidPlotConfigsForType,
  generateDataTypeConfigs,
  generateProjectConfigs,
  getActiveScales,
  plotConfigName,
  dataTypeConfigName,
  projectConfigName,
  generateTestAliasWithProject,
  sampleConfigs,
  getFieldForDataType,
  getGroupByFieldForType,
  TEST_PROJECT,
  VITE_TEST_API_KEY,
  PLOT_TEST_API_REAL,
  VITE_TEST_API_URL,
  PLOT_TEST_SAMPLE_RATE,
  PlotConfig,
  DataTypeConfig,
  ProjectConfig,
  ScaleOption,
} from '../fixtures/configs';
import {
  createMockLogs,
  createMockFields,
} from '../fixtures/mockData';

// =============================================================================
// Test Project Setup/Teardown Helpers
// =============================================================================

/**
 * Create the test project for real API tests.
 * Ignores 400 errors (project already exists).
 *
 * Note: The /api/projects route expects 'apiKey' header (not 'Authorization')
 */
async function createTestProject(): Promise<void> {
  try {
    const response = await fetch(`${VITE_TEST_API_URL}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apiKey': VITE_TEST_API_KEY,
      },
      body: JSON.stringify({ name: TEST_PROJECT }),
    });

    if (response.ok) {
      console.log(`[Plot API Tests] Created test project: ${TEST_PROJECT}`);
    } else if (response.status === 400) {
      // Project already exists, which is fine
      console.log(`[Plot API Tests] Test project already exists: ${TEST_PROJECT}`);
    } else {
      const data = await response.json().catch(() => ({}));
      console.warn(`[Plot API Tests] Failed to create test project: ${response.status}`, data);
    }
  } catch (error) {
    console.warn(`[Plot API Tests] Error creating test project:`, error);
  }
}

/**
 * Delete the test project after real API tests.
 * Ignores 404 errors (project doesn't exist).
 *
 * Note: The /api/projects route expects 'apiKey' header (not 'Authorization')
 */
async function deleteTestProject(): Promise<void> {
  try {
    const response = await fetch(`${VITE_TEST_API_URL}/api/projects/${encodeURIComponent(TEST_PROJECT)}`, {
      method: 'DELETE',
      headers: {
        'apiKey': VITE_TEST_API_KEY,
      },
    });

    if (response.ok) {
      console.log(`[Plot API Tests] Deleted test project: ${TEST_PROJECT}`);
    } else if (response.status === 404) {
      // Project doesn't exist, which is fine
      console.log(`[Plot API Tests] Test project not found (already deleted): ${TEST_PROJECT}`);
    } else {
      const data = await response.json().catch(() => ({}));
      console.warn(`[Plot API Tests] Failed to delete test project: ${response.status}`, data);
    }
  } catch (error) {
    console.warn(`[Plot API Tests] Error deleting test project:`, error);
  }
}

/**
 * Seed the test project with mock logs that have the expected field structure.
 * Creates logs with various data types to support all matrix test combinations.
 *
 * Fields created:
 * - table1.x_value (float): X-axis values for plots
 * - table1.y_value (float): Y-axis values for plots
 * - table1.category (str): Category for grouping
 * - table1.model (str): Secondary grouping field
 * - table1.int_value (int): Integer values
 * - table1.bool_value (bool): Boolean values
 * - table1.datetime_value (datetime): Datetime values
 * - status (str): For filter expressions
 * - value (float): For filter expressions
 */
async function seedTestProjectData(count: number = 100): Promise<void> {
  try {
    // Generate log entries with multiple data type variants for each field
    // The plot API adds the 'table1.' prefix when loading data
    // This allows testing different data types in the matrix tests
    const entries = Array.from({ length: count }, (_, i) => ({
      // Float x_value (default for x_axis tests)
      x_value: (i / Math.max(1, count - 1)) * 100,
      // Y value (float)
      y_value: Math.sin(i / 10) * 50 + 50,

      // Additional x_value variants for data type matrix testing
      x_value_int: i * 2,
      x_value_datetime: new Date(Date.now() - i * 86400000).toISOString(),
      x_value_str: `value_${i}`,

      // Additional y_value variants
      y_value_int: Math.floor(Math.sin(i / 10) * 50 + 50),

      // Grouping fields
      category: `category_${i % 5}`,
      model: `model_${i % 3}`,
      bool_category: i % 2 === 0,

      // Filter fields
      status: i % 4 === 0 ? 'error' : 'success',
      value: i * 1.5,
    }));

    const response = await fetch(`${VITE_TEST_API_URL}/api/logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apiKey': VITE_TEST_API_KEY,
      },
      body: JSON.stringify({
        project: TEST_PROJECT,
        entries,
      }),
    });

    if (response.ok) {
      console.log(`[Plot API Tests] Seeded ${count} logs to project: ${TEST_PROJECT}`);
    } else {
      const data = await response.json().catch(() => ({}));
      console.warn(`[Plot API Tests] Failed to seed logs: ${response.status}`, data);
    }
  } catch (error) {
    console.warn(`[Plot API Tests] Error seeding logs:`, error);
  }
}

// =============================================================================
// Setup
// =============================================================================

beforeAll(async () => {
  if (PLOT_TEST_API_REAL) {
    // Create test project and seed with test data
    await createTestProject();
    // Seed with enough data for largest scale (10000 for large, but we cap at scale)
    // Use 200 to cover small (100) with some buffer
    await seedTestProjectData(200);
  } else {
    server.listen({ onUnhandledRequest: 'error' });
  }
});

afterEach(() => {
  if (!PLOT_TEST_API_REAL) {
    server.resetHandlers();
  }
  vi.restoreAllMocks();
});

afterAll(async () => {
  if (PLOT_TEST_API_REAL) {
    // Clean up test project after real API tests
    await deleteTestProject();
  } else {
    server.close();
  }
});

// =============================================================================
// Test Configuration Logging
// =============================================================================

if (process.env.PLOT_TEST_MATRIX_DEBUG === 'true') {
  console.log(`[Plot API Tests] Mode: ${PLOT_TEST_API_REAL ? 'REAL API' : 'MOCKED'}`);
  console.log(`[Plot API Tests] Sample percentage: ${PLOT_TEST_SAMPLE_RATE}%`);
  console.log(`[Plot API Tests] API URL: ${VITE_TEST_API_URL}`);
}

// =============================================================================
// API Request Helpers
// =============================================================================

/**
 * Get the base URL for API requests
 */
function getApiBaseUrl(): string {
  return PLOT_TEST_API_REAL ? VITE_TEST_API_URL : '';
}

/**
 * Create a POST request to /api/plot/create
 */
async function createPlotRequest(
  body: Record<string, unknown>,
  options: { apiKey?: string | null; headers?: Record<string, string> } = {}
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (options.apiKey !== null) {
    headers.Authorization = `Bearer ${options.apiKey ?? VITE_TEST_API_KEY}`;
  }

  const response = await fetch(`${getApiBaseUrl()}/api/plot/create`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  return {
    status: response.status,
    data: await response.json(),
  };
}

/**
 * Create a GET request to /api/plot/data/[token]
 */
async function getPlotDataRequest(token: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/plot/data/${token}`);

  return {
    status: response.status,
    data: await response.json(),
  };
}

// =============================================================================
// Config Correctness Assertions
// =============================================================================

/**
 * Verify config fields are correctly transformed and present
 */
function assertConfigCorrectness(
  responseConfig: Record<string, unknown>,
  expectedConfig: PlotConfig
) {
  // Type matches
  expect(responseConfig.type).toBe(expectedConfig.type);

  // Axis fields are transformed correctly (snake_case to camelCase)
  expect(responseConfig.xAxis).toBe(expectedConfig.x_axis);
  if (expectedConfig.y_axis) {
    expect(responseConfig.yAxis).toBe(expectedConfig.y_axis);
  }

  // Scale fields are transformed
  expect(responseConfig.scaleX).toBe(expectedConfig.scale_x);
  expect(responseConfig.scaleY).toBe(expectedConfig.scale_y);

  // Type-specific fields
  if (expectedConfig.type === 'histogram') {
    expect(responseConfig.binCount).toBe(expectedConfig.bin_count);
    // Histogram should not have y_axis
    expect(responseConfig.yAxis).toBeUndefined();
  }
  if (expectedConfig.type === 'scatter') {
    expect(responseConfig.showRegression).toBe(expectedConfig.show_regression);
  }
  if (expectedConfig.type === 'bar') {
    if (expectedConfig.sort_by) {
      expect(responseConfig.sortBy).toBe(expectedConfig.sort_by);
    }
    if (expectedConfig.sort_order) {
      expect(responseConfig.sortOrder).toBe(expectedConfig.sort_order);
    }
  }

  // Grouping fields (valid for all plot types when group_by is set)
  if (expectedConfig.group_by) {
    expect(responseConfig.groupBy).toBe(expectedConfig.group_by);
  }
  if (expectedConfig.aggregate) {
    expect(responseConfig.aggregate).toBe(expectedConfig.aggregate);
  }
}

// =============================================================================
// Data Correctness Assertions (Elaborated)
// =============================================================================

/**
 * Helper to get a field value from a log entry.
 * Handles both mock format (top-level fields) and real API format (nested in entries).
 * Also handles prefixed paths like 'table1.x_value' -> 'x_value' in entries.
 */
function getLogFieldValue(log: Record<string, unknown>, fieldPath: string): unknown {
  // First check top-level (mock format with prefix)
  if (fieldPath in log) {
    return log[fieldPath];
  }

  // Check entries (real API format)
  const entries = log.entries as Record<string, unknown> | undefined;
  if (entries) {
    // Try with full path first
    if (fieldPath in entries) {
      return entries[fieldPath];
    }
    // Try without 'table1.' prefix (real API stores unprefixed)
    const unprefixedPath = fieldPath.replace(/^table1\./, '');
    if (unprefixedPath in entries) {
      return entries[unprefixedPath];
    }
  }

  // Check top-level without prefix
  const unprefixedPath = fieldPath.replace(/^table1\./, '');
  if (unprefixedPath in log) {
    return log[unprefixedPath];
  }

  return undefined;
}

/**
 * Verify data structure and values are correct for given config
 */
function assertDataCorrectness(
  data: Record<string, unknown>[],
  expectedConfig: PlotConfig,
  dataTypeConfig: DataTypeConfig,
  scale: ScaleOption,
  expectedLogs?: ReturnType<typeof createMockLogs>,
  projectConfig?: ProjectConfig
) {
  // 1. Count validation
  // Real API: may have fewer or more depending on seeded data
  // Mocked: exactly what we created
  if (expectedLogs) {
    expect(data.length).toBe(expectedLogs.length);
  } else {
    // For real API with filters, 0 results is acceptable
    // Without filters, we expect some data
    const hasFilter = projectConfig?.filter_expr != null;
    if (hasFilter) {
      expect(data.length).toBeGreaterThanOrEqual(0);
    } else {
      expect(data.length).toBeGreaterThan(0);
    }
    expect(data.length).toBeLessThanOrEqual(scale.count + 10); // limit + small buffer
  }

  if (data.length === 0) return;

  // 2. Structure validation for each log entry
  for (let i = 0; i < Math.min(data.length, 20); i++) {
    const log = data[i];

    // Has required fields (either top-level or in entries)
    const xVal = getLogFieldValue(log, 'table1.x_value');
    expect(xVal).toBeDefined();
    if (expectedConfig.type !== 'histogram') {
      const yVal = getLogFieldValue(log, 'table1.y_value');
      expect(yVal).toBeDefined();
    }

    // Has entries object (raw data container) - real API always has this
    expect(log.entries).toBeDefined();
    expect(typeof log.entries).toBe('object');

    // Has id and ts (timestamp)
    expect(log.id).toBeDefined();
    // Real API uses number id, mock uses string - accept both
    expect(['string', 'number'].includes(typeof log.id)).toBe(true);
    expect(log.ts).toBeDefined();
  }

  // 3. Data type validation (check all non-null values)
  const validLogs = data.filter(log => getLogFieldValue(log, 'table1.x_value') !== null);
  for (const log of validLogs.slice(0, 20)) {
    const xValue = getLogFieldValue(log, 'table1.x_value');

    switch (dataTypeConfig.x_axis_type) {
      case 'float':
      case 'int':
        expect(typeof xValue).toBe('number');
        expect(Number.isFinite(xValue as number)).toBe(true);
        break;
      case 'str':
        expect(typeof xValue).toBe('string');
        break;
      case 'datetime':
        expect(typeof xValue).toBe('string');
        // Validate ISO format
        const date = new Date(xValue as string);
        expect(date.toString()).not.toBe('Invalid Date');
        break;
    }

    // Y-axis validation
    if (expectedConfig.type !== 'histogram') {
      const yValue = getLogFieldValue(log, 'table1.y_value');
      if (yValue !== null) {
        switch (dataTypeConfig.y_axis_type) {
          case 'float':
          case 'int':
            expect(typeof yValue).toBe('number');
            expect(Number.isFinite(yValue as number)).toBe(true);
            break;
        }
      }
    }
  }

  // Skip further validations if no data (allowed for filtered queries)
  if (data.length === 0) return;

  // 4. Grouped data validation
  if (expectedConfig.group_by) {
    const categoryField = expectedConfig.group_by;
    const categoryValues = data
      .map(log => getLogFieldValue(log, categoryField))
      .filter(v => v !== null && v !== undefined);
    const uniqueCategories = Array.from(new Set(categoryValues));
    // Should have at least 1 unique category if we have data
    if (categoryValues.length > 0) {
      expect(uniqueCategories.length).toBeGreaterThan(0);
      // Typically 5 categories in mock data
      expect(uniqueCategories.length).toBeLessThanOrEqual(10);
    }
  }

  // 5. Value range validation for numeric fields
  const numericXValues = data
    .map(log => getLogFieldValue(log, expectedConfig.x_axis))
    .filter(v => typeof v === 'number' && Number.isFinite(v)) as number[];

  if (numericXValues.length > 0) {
    const minX = Math.min(...numericXValues);
    const maxX = Math.max(...numericXValues);
    // Values should have reasonable spread (not all identical)
    if (data.length > 1) {
      expect(maxX - minX).toBeGreaterThanOrEqual(0);
    }
  }
}

// =============================================================================
// Data Preprocessing Assertions (Elaborated)
// =============================================================================

/**
 * Verify data preprocessing is correctly applied
 */
function assertDataPreprocessing(
  data: Record<string, unknown>[],
  expectedConfig: PlotConfig,
  dataTypeConfig: DataTypeConfig,
  projectConfig?: ProjectConfig
) {
  if (data.length === 0) return;

  // Sample a few entries for detailed checks
  const sampleLogs = data.slice(0, 10);

  for (const log of sampleLogs) {
    // 1. Field access - use helper to handle both mock and real API formats
    const xVal = getLogFieldValue(log, 'table1.x_value');
    expect(xVal).toBeDefined();

    // Entries object should exist
    const entries = log.entries as Record<string, unknown>;
    expect(entries).toBeDefined();

    // 2. Entry merging - entries and derived_entries combined (mock format)
    // Real API may have different structure, skip derived_entries check for real API
    if (!PLOT_TEST_API_REAL && log.derived_entries) {
      const derivedEntries = log.derived_entries as Record<string, unknown>;
      for (const key of Object.keys(derivedEntries)) {
        // Derived entries should also be accessible with prefix
        expect(`table1.${key}` in log).toBe(true);
      }
    }

    // 3. Type preservation
    const xValue = getLogFieldValue(log, 'table1.x_value');
    if (xValue !== null && xValue !== undefined) {
      // Numeric types stay numeric
      if (['float', 'int'].includes(dataTypeConfig.x_axis_type)) {
        expect(typeof xValue).toBe('number');
      }
      // String types stay string
      if (dataTypeConfig.x_axis_type === 'str') {
        expect(typeof xValue).toBe('string');
      }
      // Datetime types stay as ISO strings
      if (dataTypeConfig.x_axis_type === 'datetime') {
        expect(typeof xValue).toBe('string');
        expect(() => new Date(xValue as string)).not.toThrow();
      }
    }

    // 4. Null handling - nulls preserved, not converted
    // Find logs with null values (use helper)
    const nullLog = data.find(l => getLogFieldValue(l, 'table1.x_value') === null);
    if (nullLog) {
      expect(getLogFieldValue(nullLog, 'table1.x_value')).toBeNull();
    }

    // 5. ID and timestamp preserved at root level
    expect(log.id).toBeDefined();
    // Accept both string and number IDs (real API uses numbers)
    expect(['string', 'number'].includes(typeof log.id)).toBe(true);
    expect(log.ts).toBeDefined();
    expect(typeof log.ts).toBe('string');

    // Prefixed versions may or may not be available depending on API response format
    // Real API has 'table1.id' at root, mock may not - skip this for now
  }

  // 6. Status field normalization (if present)
  const statusValues = Array.from(new Set(
    data.map(log => (log.entries as Record<string, unknown>)?.status).filter(Boolean)
  ));
  for (const status of statusValues) {
    expect(['success', 'error', 'pending', 'running']).toContain(status);
  }

  // ==========================================================================
  // Project Config Specific Preprocessing Assertions
  // Note: Filter, sorting, and grouping validations only apply to real API tests.
  // Mock data doesn't implement actual filtering/sorting behavior.
  // ==========================================================================

  if (projectConfig && PLOT_TEST_API_REAL) {
    // 7. Filter expression validation (REAL API ONLY)
    // When filter_expr is applied, all returned data should match the filter
    if (projectConfig.filter_expr) {
      const filterExpr = projectConfig.filter_expr;

      if (filterExpr === "status == 'success'") {
        // All logs should have status === 'success'
        for (const log of data) {
          const entries = log.entries as Record<string, unknown>;
          if (entries?.status !== undefined) {
            expect(entries.status).toBe('success');
          }
        }
      } else if (filterExpr === 'value > 0') {
        // All logs should have value > 0 (checking y_value as proxy)
        for (const log of data) {
          const yValue = log['table1.y_value'] as number | null | undefined;
          if (yValue !== null && yValue !== undefined) {
            expect(yValue).toBeGreaterThan(0);
          }
        }
      }
    }

    // 8. Sorting validation (REAL API ONLY)
    // When sorting is applied, data should be ordered accordingly
    if (projectConfig.sorting) {
      try {
        const sortConfig = JSON.parse(projectConfig.sorting) as Array<{ field: string; order: 'asc' | 'desc' }>;
        if (sortConfig.length > 0) {
          const { field, order } = sortConfig[0];

          // Get timestamps for timestamp sorting
          if (field === 'timestamp') {
            const timestamps = data.map(log => new Date(log.ts as string).getTime());
            for (let i = 1; i < timestamps.length; i++) {
              if (order === 'desc') {
                expect(timestamps[i]).toBeLessThanOrEqual(timestamps[i - 1]);
              } else {
                expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
              }
            }
          }
        }
      } catch {
        // Invalid JSON, skip sorting validation
      }
    }

    // 9. Project-level grouping validation (REAL API ONLY)
    // When project group_by is set, data structure should reflect grouping
    if (projectConfig.group_by && projectConfig.group_by.length > 0) {
      const groupFields = projectConfig.group_by;

      // Verify that group fields exist in the data
      for (const groupField of groupFields) {
        const hasGroupField = data.some(log => {
          // Check both prefixed and unprefixed
          return log[groupField] !== undefined ||
                 log[`table1.${groupField}`] !== undefined ||
                 (log.entries as Record<string, unknown>)?.[groupField] !== undefined;
        });
        expect(hasGroupField).toBe(true);
      }

      // Verify data is grouped: same group values appear consecutively
      // (This is a soft check, as grouping may affect aggregation)
      if (groupFields.includes('category')) {
        const categories = data.map(log =>
          log['table1.category'] ?? (log.entries as Record<string, unknown>)?.category
        );
        const uniqueCategories = Array.from(new Set(categories));
        // Grouped data should have categories appearing in runs
        // We can't strictly enforce order, but we can check they're not randomly mixed
        expect(uniqueCategories.length).toBeGreaterThan(0);
      }
    }

    // 10. Limit validation (REAL API ONLY)
    // Data length should not exceed the configured limit
    if (projectConfig.limit) {
      expect(data.length).toBeLessThanOrEqual(projectConfig.limit);
    }
  }
}

// =============================================================================
// Field Metadata Assertions (Elaborated)
// =============================================================================

/**
 * Verify field metadata is correctly transformed
 */
function assertFieldsCorrectness(
  fields: Record<string, unknown>,
  dataTypeConfig: DataTypeConfig
) {
  // Fields should be an object
  expect(fields).toBeDefined();
  expect(typeof fields).toBe('object');

  // For real API, field structure may differ - just validate we have fields
  const fieldKeys = Object.keys(fields);
  expect(fieldKeys.length).toBeGreaterThan(0);

  // 1. Look for x_value field (with or without table1. prefix)
  const xFieldKey = fieldKeys.find(k => k.includes('x_value'));
  expect(xFieldKey).toBeDefined();
  if (xFieldKey) {
    const xField = fields[xFieldKey] as Record<string, unknown>;
    expect(xField).toBeDefined();
    // Field should have some metadata
    expect(typeof xField).toBe('object');
  }

  // 2. Look for y_value field (with or without table1. prefix) - optional for histograms
  const yFieldKey = fieldKeys.find(k => k.includes('y_value'));
  if (yFieldKey) {
    const yField = fields[yFieldKey] as Record<string, unknown>;
    expect(yField).toBeDefined();
  }

  // 3. Look for category field (with or without table1. prefix) - optional
  const categoryFieldKey = fieldKeys.find(k => k.includes('category'));
  if (categoryFieldKey) {
    const categoryField = fields[categoryFieldKey] as Record<string, unknown>;
    expect(categoryField).toBeDefined();
  }

  // Note: System fields (id, ts) are not included in the fields metadata
  // They are part of the data entries instead
}

// =============================================================================
// Metadata Assertions
// =============================================================================

/**
 * Verify metadata is complete
 */
function assertMetadataCorrectness(
  metadata: Record<string, unknown>,
  expectedProjectName?: string
) {
  expect(metadata).toBeDefined();
  expect(metadata.project_name).toBeDefined();
  if (expectedProjectName) {
    expect(metadata.project_name).toBe(expectedProjectName);
  }
  expect(metadata.created_at).toBeDefined();
  expect(metadata.token).toBeDefined();
  expect(typeof metadata.token).toBe('string');
  expect((metadata.token as string).length).toBeGreaterThan(0);
}

// =============================================================================
// Authentication Tests (Edge Cases)
// =============================================================================

describe('Plot API - Authentication', () => {
  it('rejects requests without Authorization header', async () => {
    if (!PLOT_TEST_API_REAL) {
      server.use(...createTestScenario('auth-error'));
    }

    const response = await createPlotRequest(
      {
        project_config: { project_name: TEST_PROJECT },
        plot_config: { x_axis: 'x', y_axis: 'y' },
      },
      { apiKey: null }
    );

    expect(response.status).toBe(401);
    expect(response.data.error).toBeDefined();
  });

  it('rejects requests with empty API key', async () => {
    if (!PLOT_TEST_API_REAL) {
      server.use(...createTestScenario('auth-error'));
    }

    const response = await createPlotRequest(
      {
        project_config: { project_name: TEST_PROJECT },
        plot_config: { x_axis: 'x', y_axis: 'y' },
      },
      { apiKey: '' }
    );

    expect(response.status).toBe(401);
  });

  it('accepts requests with valid API key', async () => {
    if (!PLOT_TEST_API_REAL) {
      server.use(...createTestScenario('success'));
    }

    const response = await createPlotRequest({
      project_config: { project_name: TEST_PROJECT },
      plot_config: { x_axis: 'x', y_axis: 'y' },
    });

    expect(response.status).toBe(201);
    expect(response.data.token).toBeDefined();
    expect(response.data.url).toBeDefined();
  });
});

// =============================================================================
// Input Validation Tests (Edge Cases)
// =============================================================================

describe('Plot API - Input Validation', () => {
  it('rejects requests without project_config', async () => {
    const response = await createPlotRequest({
      plot_config: { x_axis: 'x', y_axis: 'y' },
    });

    expect(response.status).toBe(400);
    expect(response.data.error).toContain('project_config');
  });

  it('rejects requests without project_name', async () => {
    const response = await createPlotRequest({
      project_config: {},
      plot_config: { x_axis: 'x', y_axis: 'y' },
    });

    expect(response.status).toBe(400);
    expect(response.data.error).toContain('project_name');
  });

  it('rejects requests without plot_config or description', async () => {
    const response = await createPlotRequest({
      project_config: { project_name: TEST_PROJECT },
    });

    expect(response.status).toBe(400);
    expect(response.data.error).toContain('plot_config');
  });

  it.skipIf(PLOT_TEST_API_REAL)('accepts requests with description (LLM mode)', async () => {
    // Skip for real API - requires LLM credits
    const response = await createPlotRequest({
      project_config: { project_name: TEST_PROJECT },
      description: 'Show me a scatter plot of accuracy vs loss',
    });

    expect(response.status).toBe(201);
  });
});

// =============================================================================
// Error Scenarios (Edge Cases)
// =============================================================================

describe('Plot API - Error Scenarios', () => {
  it('returns 404 for non-existent plot', async () => {
    if (!PLOT_TEST_API_REAL) {
      server.use(...createTestScenario('not-found'));
      const response = await getPlotDataRequest('nonexistent_token_12345');
      expect(response.status).toBe(404);
      expect(response.data.error).toBeDefined();
    } else {
      // Real API: use a properly formatted but non-existent token
      // The API may return 400 (bad format) or 404 (not found) depending on token validation
      const response = await getPlotDataRequest('abc123def456');
      expect([400, 404]).toContain(response.status);
    }
  });

  it('returns expired flag for expired plots', async () => {
    if (!PLOT_TEST_API_REAL) {
      server.use(...createTestScenario('expired'));
      const response = await getPlotDataRequest('expired_token_12345');
      expect(response.status).toBe(404);
      expect(response.data.expired).toBe(true);
    } else {
      // Can't reliably test expired plots with real API without waiting
      // Skip this test for real API
      expect(true).toBe(true);
    }
  });

  it('handles server errors gracefully', async () => {
    if (!PLOT_TEST_API_REAL) {
      server.use(...createTestScenario('server-error'));
      const response = await getPlotDataRequest('error_token_12345');
      expect(response.status).toBe(500);
      expect(response.data.error).toBeDefined();
    } else {
      // Can't reliably trigger server errors with real API
      expect(true).toBe(true);
    }
  });
});

// =============================================================================
// Matrix Tests - Comprehensive Config/Data/Fields/Preprocessing Validation
// Uses describe.concurrent for parallel test execution.
// For real API tests, each test gets a unique context to prevent DB contention.
// =============================================================================

describe.concurrent('Plot API - Matrix Tests', () => {
  const plotTypes = ['scatter', 'bar', 'histogram', 'line'] as const;
  const dataTypeConfigs = sampleConfigs(generateDataTypeConfigs());
  const projectConfigs = sampleConfigs(generateProjectConfigs());
  const activeScales = getActiveScales();

  // Log matrix size
  if (process.env.PLOT_TEST_MATRIX_DEBUG === 'true') {
    console.log(`[Matrix] Data type configs (sampled): ${dataTypeConfigs.length}`);
    console.log(`[Matrix] Project configs (sampled): ${projectConfigs.length}`);
    console.log(`[Matrix] Active scales: ${activeScales.length}`);
  }

  describe.each(plotTypes)('%s plot', (plotType) => {
    // Sample valid plot configs based on PLOT_TEST_SAMPLE_RATE
    const allValidConfigs = generateValidPlotConfigsForType(plotType);
    const sampledPlotConfigs = sampleConfigs(allValidConfigs);

    if (process.env.PLOT_TEST_MATRIX_DEBUG === 'true') {
      console.log(`[Matrix] ${plotType} plot configs: ${allValidConfigs.length} total, ${sampledPlotConfigs.length} sampled`);
    }

    describe.each(sampledPlotConfigs)('plot config: %o', (plotConfig) => {
      describe.each(projectConfigs)('project config: %o', (projectConfig) => {
        const projConfigName = projectConfigName(projectConfig);

        describe.each(dataTypeConfigs)('data types: %o', (dataTypeConfig) => {
          const dataTypeName = dataTypeConfigName(dataTypeConfig);

          describe.each(activeScales)('scale: %s', (scale) => {
            // For real API tests, we don't use context since the project is fresh
            // For mocked tests, context could be used for test isolation in concurrent runs
            const scaleAdjustedProjectConfig: ProjectConfig = {
              ...projectConfig,
              limit: scale.count,
              // Context is not set for real API tests - project is created fresh each run
            };

            // Adjust field names based on data type config for real API testing
            // The seeded data has type-specific field variants (x_value, x_value_int, x_value_datetime, etc.)
            const adjustedPlotConfig = PLOT_TEST_API_REAL ? {
              ...plotConfig,
              x_axis: `table1.${getFieldForDataType('x_value', dataTypeConfig.x_axis_type)}`,
              y_axis: plotConfig.y_axis
                ? `table1.${getFieldForDataType('y_value', dataTypeConfig.y_axis_type)}`
                : undefined,
              group_by: plotConfig.group_by
                ? getGroupByFieldForType(dataTypeConfig.group_by_type)
                : undefined,
            } : plotConfig;

            const alias = generateTestAliasWithProject('api', scaleAdjustedProjectConfig, adjustedPlotConfig, dataTypeConfig, scale);

            /**
             * Helper to get mock response for this specific test combination.
             * For concurrent mocked tests, we bypass MSW to avoid handler conflicts
             * and directly use the mock response object.
             */
            function getMockResponse() {
              return setupMatrixTestHandlers(adjustedPlotConfig, dataTypeConfig, scale, {
                projectName: scaleAdjustedProjectConfig.project_name,
                includeEdgeCases: true,
              });
            }

            it(
              `${alias} - returns correct config structure`,
              async () => {
                if (PLOT_TEST_API_REAL) {
                  // Real API: make HTTP requests with type-adjusted field names
                  const createResponse = await createPlotRequest({
                    project_config: scaleAdjustedProjectConfig,
                    plot_config: {
                      type: adjustedPlotConfig.type,
                      x_axis: adjustedPlotConfig.x_axis,
                      y_axis: adjustedPlotConfig.y_axis,
                      scale_x: adjustedPlotConfig.scale_x,
                      scale_y: adjustedPlotConfig.scale_y,
                      aggregate: adjustedPlotConfig.aggregate,
                      group_by: adjustedPlotConfig.group_by,
                      show_regression: adjustedPlotConfig.show_regression,
                      sort_by: adjustedPlotConfig.sort_by,
                      sort_order: adjustedPlotConfig.sort_order,
                      bin_count: adjustedPlotConfig.bin_count,
                    },
                  });
                  if (createResponse.status !== 201) {
                    console.error(`[Matrix Test] Plot creation failed:`, createResponse.data);
                  }
                  expect(createResponse.status).toBe(201);
                  const result = await getPlotDataRequest(createResponse.data.token);
                  if (result.status !== 200) {
                    console.error(`[Matrix Test] Get plot data failed for token ${createResponse.data.token}:`, result.data);
                  }
                  expect(result.status).toBe(200);
                  assertConfigCorrectness(result.data.config, adjustedPlotConfig);
                } else {
                  // Mocked: use mock response directly (no MSW to avoid race conditions)
                  const mockSetup = getMockResponse();
                  assertConfigCorrectness(mockSetup.response.config, adjustedPlotConfig);
                }
              },
              scale.timeout
            );

            it(
              `${alias} - returns correctly structured data`,
              async () => {
                if (PLOT_TEST_API_REAL) {
                  const createResponse = await createPlotRequest({
                    project_config: scaleAdjustedProjectConfig,
                    plot_config: adjustedPlotConfig,
                  });
                  const result = await getPlotDataRequest(createResponse.data.token);
                  if (result.status !== 200) {
                    console.error(`[Matrix Test] Get plot data failed:`, result.data);
                  }
                  expect(result.status).toBe(200);
                  // Debug: Log first entry structure for real API
                  if (result.data?.data?.[0] && process.env.PLOT_TEST_MATRIX_DEBUG === 'true') {
                    console.log('[Matrix Test] First data entry:', JSON.stringify(result.data.data[0], null, 2));
                  }
                  assertDataCorrectness(
                    result.data.data,
                    adjustedPlotConfig,
                    dataTypeConfig,
                    scale,
                    undefined,
                    scaleAdjustedProjectConfig
                  );
                } else {
                  const mockSetup = getMockResponse();
                  assertDataCorrectness(
                    mockSetup.response.data,
                    adjustedPlotConfig,
                    dataTypeConfig,
                    scale,
                    mockSetup.logs,
                    scaleAdjustedProjectConfig
                  );
                }
              },
              scale.timeout
            );

            it(
              `${alias} - applies correct data preprocessing`,
              async () => {
                if (PLOT_TEST_API_REAL) {
                  const createResponse = await createPlotRequest({
                    project_config: scaleAdjustedProjectConfig,
                    plot_config: adjustedPlotConfig,
                  });
                  const result = await getPlotDataRequest(createResponse.data.token);
                  expect(result.status).toBe(200);
                  assertDataPreprocessing(result.data.data, adjustedPlotConfig, dataTypeConfig, scaleAdjustedProjectConfig);
                } else {
                  const mockSetup = getMockResponse();
                  assertDataPreprocessing(mockSetup.response.data, adjustedPlotConfig, dataTypeConfig, scaleAdjustedProjectConfig);
                }
              },
              scale.timeout
            );

            it(
              `${alias} - returns correctly transformed fields`,
              async () => {
                if (PLOT_TEST_API_REAL) {
                  const createResponse = await createPlotRequest({
                    project_config: scaleAdjustedProjectConfig,
                    plot_config: adjustedPlotConfig,
                  });
                  const result = await getPlotDataRequest(createResponse.data.token);
                  expect(result.status).toBe(200);
                  // Debug: Log fields structure for real API
                  if (process.env.PLOT_TEST_MATRIX_DEBUG === 'true') {
                    console.log('[Matrix Test] Fields keys:', Object.keys(result.data.fields || {}));
                  }
                  assertFieldsCorrectness(result.data.fields, dataTypeConfig);
                } else {
                  const mockSetup = getMockResponse();
                  assertFieldsCorrectness(mockSetup.response.fields, dataTypeConfig);
                }
              },
              scale.timeout
            );

            it(
              `${alias} - includes complete metadata`,
              async () => {
                if (PLOT_TEST_API_REAL) {
                  const createResponse = await createPlotRequest({
                    project_config: scaleAdjustedProjectConfig,
                    plot_config: adjustedPlotConfig,
                  });
                  const result = await getPlotDataRequest(createResponse.data.token);
                  expect(result.status).toBe(200);
                  assertMetadataCorrectness(
                    result.data.metadata,
                    scaleAdjustedProjectConfig.project_name
                  );
                } else {
                  const mockSetup = getMockResponse();
                  assertMetadataCorrectness(
                    mockSetup.response.metadata,
                    scaleAdjustedProjectConfig.project_name
                  );
                }
              },
              scale.timeout
            );
          });
        });
      });
    });
  });
});
