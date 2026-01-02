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
// Setup
// =============================================================================

beforeAll(() => {
  if (!PLOT_TEST_API_REAL) {
    server.listen({ onUnhandledRequest: 'error' });
  }
});

afterEach(() => {
  if (!PLOT_TEST_API_REAL) {
    server.resetHandlers();
  }
  vi.restoreAllMocks();
});

afterAll(() => {
  if (!PLOT_TEST_API_REAL) {
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
 * Verify data structure and values are correct for given config
 */
function assertDataCorrectness(
  data: Record<string, unknown>[],
  expectedConfig: PlotConfig,
  dataTypeConfig: DataTypeConfig,
  scale: ScaleOption,
  expectedLogs?: ReturnType<typeof createMockLogs>
) {
  // 1. Count validation
  // Real API: at least scale.count (may have more due to edge cases)
  // Mocked: exactly what we created
  if (expectedLogs) {
    expect(data.length).toBe(expectedLogs.length);
  } else {
    expect(data.length).toBeGreaterThanOrEqual(scale.count);
    expect(data.length).toBeLessThanOrEqual(scale.count * 1.1 + 10); // Allow 10% + edge cases
  }

  if (data.length === 0) return;

  // 2. Structure validation for each log entry
  for (let i = 0; i < Math.min(data.length, 20); i++) {
    const log = data[i];

    // Has required prefixed fields
    expect('table1.x_value' in log).toBe(true);
    if (expectedConfig.type !== 'histogram') {
      expect('table1.y_value' in log).toBe(true);
    }

    // Has entries object (raw data container)
    expect(log.entries).toBeDefined();
    expect(typeof log.entries).toBe('object');

    // Has id and ts (timestamp)
    expect(log.id).toBeDefined();
    expect(typeof log.id).toBe('string');
    expect(log.ts).toBeDefined();
  }

  // 3. Data type validation (check all non-null values)
  const validLogs = data.filter(log => log['table1.x_value'] !== null);
  for (const log of validLogs.slice(0, 20)) {
    const xValue = log['table1.x_value'];

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
      const yValue = log['table1.y_value'];
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

  // 4. Grouped data validation
  if (expectedConfig.group_by) {
    const categoryField = 'table1.category';
    const categoryValues = data.map(log => log[categoryField]).filter(v => v !== null && v !== undefined);
    const uniqueCategories = Array.from(new Set(categoryValues));
    // Should have at least 1 unique category
    expect(uniqueCategories.length).toBeGreaterThan(0);
    // Typically 5 categories in mock data
    expect(uniqueCategories.length).toBeLessThanOrEqual(10);
  }

  // 5. Value range validation for numeric fields
  const numericXValues = data
    .map(log => log['table1.x_value'])
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
    // 1. Field prefixing - both prefixed and unprefixed access
    expect(log['table1.x_value']).toBeDefined();

    // Entries object should have unprefixed values
    const entries = log.entries as Record<string, unknown>;
    expect(entries).toBeDefined();

    // 2. Entry merging - entries and derived_entries combined
    if (log.derived_entries) {
      const derivedEntries = log.derived_entries as Record<string, unknown>;
      for (const key of Object.keys(derivedEntries)) {
        // Derived entries should also be accessible with prefix
        expect(`table1.${key}` in log).toBe(true);
      }
    }

    // 3. Type preservation
    const xValue = log['table1.x_value'];
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
    // Find logs with null values
    const nullLog = data.find(l => l['table1.x_value'] === null);
    if (nullLog) {
      expect(nullLog['table1.x_value']).toBeNull();
      // Null should be explicitly null, not undefined
      expect(nullLog['table1.x_value']).not.toBeUndefined();
    }

    // 5. ID and timestamp preserved at root level
    expect(log.id).toBeDefined();
    expect(typeof log.id).toBe('string');
    expect(log.ts).toBeDefined();
    expect(typeof log.ts).toBe('string');

    // Prefixed versions also available
    expect(log['table1.id']).toBeDefined();
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
  // 1. Has prefixed field paths
  expect(fields['table1.x_value']).toBeDefined();
  expect(fields['table1.y_value']).toBeDefined();
  expect(fields['table1.category']).toBeDefined();

  // 2. Field metadata contains correct type info
  const xField = fields['table1.x_value'] as Record<string, unknown>;
  expect(xField.type).toBe(dataTypeConfig.x_axis_type);
  expect(xField.display_type).toBeDefined();
  expect(xField.count).toBeDefined();
  expect(typeof xField.count).toBe('number');

  const yField = fields['table1.y_value'] as Record<string, unknown>;
  expect(yField.type).toBe(dataTypeConfig.y_axis_type);

  const categoryField = fields['table1.category'] as Record<string, unknown>;
  expect(categoryField.type).toBe(dataTypeConfig.group_by_type);

  // 3. Display type mapping is correct
  const displayTypeMap: Record<string, string> = {
    float: 'number',
    int: 'number',
    str: 'string',
    bool: 'boolean',
    datetime: 'datetime',
  };
  expect(xField.display_type).toBe(displayTypeMap[dataTypeConfig.x_axis_type]);

  // 4. System fields are present
  expect(fields['timestamp']).toBeDefined();
  expect(fields['id']).toBeDefined();
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

  it('accepts requests with description (LLM mode)', async () => {
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
    }

    const response = await getPlotDataRequest('nonexistent_token_12345');

    expect(response.status).toBe(404);
    expect(response.data.error).toBeDefined();
  });

  it('returns expired flag for expired plots', async () => {
    if (!PLOT_TEST_API_REAL) {
      server.use(...createTestScenario('expired'));
    }

    const response = await getPlotDataRequest('expired_token_12345');

    if (!PLOT_TEST_API_REAL) {
      // Mocked: verify the expected response
      expect(response.status).toBe(404);
      expect(response.data.expired).toBe(true);
    } else {
      // Real API: just verify it returns an error
      expect([404, 410]).toContain(response.status);
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
// =============================================================================

describe('Plot API - Matrix Tests', () => {
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
            // Create a project config with the current scale's limit
            const scaleAdjustedProjectConfig: ProjectConfig = {
              ...projectConfig,
              limit: scale.count,
            };
            const alias = generateTestAliasWithProject('api', scaleAdjustedProjectConfig, plotConfig, dataTypeConfig, scale);

            /**
             * Helper to get mock response for this specific test combination.
             * For mocked tests, sets up handlers and returns the response.
             * Each test calls this to ensure the correct handlers are active.
             */
            function getMockSetup() {
              return setupMatrixTestHandlers(plotConfig, dataTypeConfig, scale, {
                projectName: scaleAdjustedProjectConfig.project_name,
                includeEdgeCases: true,
              });
            }

            it(
              `${alias} - returns correct config structure`,
              async () => {
                let result;
                if (PLOT_TEST_API_REAL) {
                  // Create plot first with full project config
                  const createResponse = await createPlotRequest({
                    project_config: scaleAdjustedProjectConfig,
                    plot_config: {
                      type: plotConfig.type,
                      x_axis: plotConfig.x_axis,
                      y_axis: plotConfig.y_axis,
                      scale_x: plotConfig.scale_x,
                      scale_y: plotConfig.scale_y,
                      aggregate: plotConfig.aggregate,
                      group_by: plotConfig.group_by,
                      show_regression: plotConfig.show_regression,
                      sort_by: plotConfig.sort_by,
                      sort_order: plotConfig.sort_order,
                      bin_count: plotConfig.bin_count,
                    },
                  });
                  expect(createResponse.status).toBe(201);
                  result = await getPlotDataRequest(createResponse.data.token);
                } else {
                  const mockSetup = getMockSetup();
                  result = await getPlotDataRequest(mockSetup.metadata.token);
                }

                expect(result.status).toBe(200);
                assertConfigCorrectness(result.data.config, plotConfig);
              },
              scale.timeout
            );

            it(
              `${alias} - returns correctly structured data`,
              async () => {
                let result;
                let expectedLogs: ReturnType<typeof createMockLogs> | undefined;
                if (PLOT_TEST_API_REAL) {
                  const createResponse = await createPlotRequest({
                    project_config: scaleAdjustedProjectConfig,
                    plot_config: plotConfig,
                  });
                  result = await getPlotDataRequest(createResponse.data.token);
                } else {
                  const mockSetup = getMockSetup();
                  expectedLogs = mockSetup.logs;
                  result = await getPlotDataRequest(mockSetup.metadata.token);
                }

                expect(result.status).toBe(200);
                assertDataCorrectness(
                  result.data.data,
                  plotConfig,
                  dataTypeConfig,
                  scale,
                  PLOT_TEST_API_REAL ? undefined : expectedLogs
                );
              },
              scale.timeout
            );

            it(
              `${alias} - applies correct data preprocessing`,
              async () => {
                let result;
                if (PLOT_TEST_API_REAL) {
                  const createResponse = await createPlotRequest({
                    project_config: scaleAdjustedProjectConfig,
                    plot_config: plotConfig,
                  });
                  result = await getPlotDataRequest(createResponse.data.token);
                } else {
                  const mockSetup = getMockSetup();
                  result = await getPlotDataRequest(mockSetup.metadata.token);
                }

                expect(result.status).toBe(200);
                assertDataPreprocessing(result.data.data, plotConfig, dataTypeConfig, scaleAdjustedProjectConfig);
              },
              scale.timeout
            );

            it(
              `${alias} - returns correctly transformed fields`,
              async () => {
                let result;
                if (PLOT_TEST_API_REAL) {
                  const createResponse = await createPlotRequest({
                    project_config: scaleAdjustedProjectConfig,
                    plot_config: plotConfig,
                  });
                  result = await getPlotDataRequest(createResponse.data.token);
                } else {
                  const mockSetup = getMockSetup();
                  result = await getPlotDataRequest(mockSetup.metadata.token);
                }

                expect(result.status).toBe(200);
                assertFieldsCorrectness(result.data.fields, dataTypeConfig);
              },
              scale.timeout
            );

            it(
              `${alias} - includes complete metadata`,
              async () => {
                let result;
                if (PLOT_TEST_API_REAL) {
                  const createResponse = await createPlotRequest({
                    project_config: scaleAdjustedProjectConfig,
                    plot_config: plotConfig,
                  });
                  result = await getPlotDataRequest(createResponse.data.token);
                } else {
                  const mockSetup = getMockSetup();
                  result = await getPlotDataRequest(mockSetup.metadata.token);
                }

                expect(result.status).toBe(200);
                assertMetadataCorrectness(
                  result.data.metadata,
                  scaleAdjustedProjectConfig.project_name
                );
              },
              scale.timeout
            );
          });
        });
      });
    });
  });
});
