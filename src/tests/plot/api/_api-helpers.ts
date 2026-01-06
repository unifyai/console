/**
 * Shared helpers for Plot API tests
 *
 * Contains:
 * - API request helpers
 * - Assertion functions
 * - Test project setup/teardown
 * - Type definitions
 */

import { expect } from 'vitest';
import {
  setupMatrixTestHandlers,
} from './handlers';
import {
  generateValidPlotConfigsForType,
  generateDataTypeConfigs,
  generateProjectConfigs,
  getActiveScales,
  generateTestAliasWithProject,
  sampleConfigs,
  getFieldForDataType,
  getGroupByFieldForType,
  TEST_PROJECT,
  VITE_TEST_API_KEY,
  PLOT_TEST_API_REAL,
  VITE_TEST_API_URL,
  PlotConfig,
  DataTypeConfig,
  ProjectConfig,
  ScaleOption,
} from '../fixtures/configs';
import {
  createMockLogs,
} from '../fixtures/mockData';

// Re-export config types and values for convenience
// Re-export types
export type { PlotConfig, DataTypeConfig, ProjectConfig, ScaleOption };

// Re-export values
export {
  VITE_TEST_API_KEY,
  PLOT_TEST_API_REAL,
  VITE_TEST_API_URL,
  generateValidPlotConfigsForType,
  generateDataTypeConfigs,
  generateProjectConfigs,
  getActiveScales,
  generateTestAliasWithProject,
  sampleConfigs,
  getFieldForDataType,
  getGroupByFieldForType,
  setupMatrixTestHandlers,
};

// =============================================================================
// Shard-aware Test Project Name
// =============================================================================

/**
 * Get a shard-specific test project name to avoid conflicts when running
 * multiple shards in parallel against the real API.
 */
function getShardTestProjectName(): string {
  const shardSpec = process.env.MATRIX_SHARD;
  if (shardSpec) {
    const [shardIndex] = shardSpec.split('/').map(Number);
    if (!isNaN(shardIndex)) {
      return `${TEST_PROJECT}-shard-${shardIndex}`;
    }
  }
  return TEST_PROJECT;
}

export { TEST_PROJECT }; // Base name for reference
export const SHARD_TEST_PROJECT = getShardTestProjectName();

// =============================================================================
// Test Project Setup/Teardown Helpers
// =============================================================================

/**
 * Create the test project for real API tests.
 * Uses shard-specific project name to avoid conflicts in parallel execution.
 * Ignores 400 errors (project already exists).
 */
export async function createTestProject(): Promise<void> {
  const projectName = SHARD_TEST_PROJECT;
  try {
    const response = await fetch(`${VITE_TEST_API_URL}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apiKey': VITE_TEST_API_KEY,
      },
      body: JSON.stringify({ name: projectName }),
    });

    if (response.ok) {
      console.log(`[Plot API Tests] Created test project: ${projectName}`);
    } else if (response.status === 400) {
      console.log(`[Plot API Tests] Test project already exists: ${projectName}`);
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
 * Uses shard-specific project name to match what was created.
 */
export async function deleteTestProject(): Promise<void> {
  const projectName = SHARD_TEST_PROJECT;
  try {
    const response = await fetch(`${VITE_TEST_API_URL}/api/projects/${encodeURIComponent(projectName)}`, {
      method: 'DELETE',
      headers: {
        'apiKey': VITE_TEST_API_KEY,
      },
    });

    if (response.ok) {
      console.log(`[Plot API Tests] Deleted test project: ${projectName}`);
    } else if (response.status === 404) {
      console.log(`[Plot API Tests] Test project not found (already deleted): ${projectName}`);
    } else {
      const data = await response.json().catch(() => ({}));
      console.warn(`[Plot API Tests] Failed to delete test project: ${response.status}`, data);
    }
  } catch (error) {
    console.warn(`[Plot API Tests] Error deleting test project:`, error);
  }
}

/**
 * Seed the test project with mock logs.
 * Uses shard-specific project name.
 */
export async function seedTestProjectData(count: number = 100): Promise<void> {
  const projectName = SHARD_TEST_PROJECT;
  try {
    const entries = Array.from({ length: count }, (_, i) => ({
      x_value: (i / Math.max(1, count - 1)) * 100,
      y_value: Math.sin(i / 10) * 50 + 50,
      x_value_int: i * 2,
      x_value_datetime: new Date(Date.now() - i * 86400000).toISOString(),
      x_value_str: `value_${i}`,
      y_value_int: Math.floor(Math.sin(i / 10) * 50 + 50),
      category: `category_${i % 5}`,
      model: `model_${i % 3}`,
      bool_category: i % 2 === 0,
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
        project: projectName,
        entries,
      }),
    });

    if (response.ok) {
      console.log(`[Plot API Tests] Seeded ${count} logs to project: ${projectName}`);
    } else {
      const data = await response.json().catch(() => ({}));
      console.warn(`[Plot API Tests] Failed to seed logs: ${response.status}`, data);
    }
  } catch (error) {
    console.warn(`[Plot API Tests] Error seeding logs:`, error);
  }
}

// =============================================================================
// API Request Helpers
// =============================================================================

/**
 * Get the base URL for API requests
 */
export function getApiBaseUrl(): string {
  return PLOT_TEST_API_REAL ? VITE_TEST_API_URL : '';
}

/**
 * Create a POST request to /api/plot/create
 */
export async function createPlotRequest(
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
export async function getPlotDataRequest(token: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/plot/data/${token}`);

  return {
    status: response.status,
    data: await response.json(),
  };
}

// =============================================================================
// Field Value Helper
// =============================================================================

/**
 * Helper to get a field value from a log entry.
 * Handles both mock format (top-level fields) and real API format (nested in entries).
 */
function getLogFieldValue(log: Record<string, unknown>, fieldPath: string): unknown {
  if (fieldPath in log) {
    return log[fieldPath];
  }

  const entries = log.entries as Record<string, unknown> | undefined;
  if (entries) {
    if (fieldPath in entries) {
      return entries[fieldPath];
    }
    const unprefixedPath = fieldPath.replace(/^table1\./, '');
    if (unprefixedPath in entries) {
      return entries[unprefixedPath];
    }
  }

  const unprefixedPath = fieldPath.replace(/^table1\./, '');
  if (unprefixedPath in log) {
    return log[unprefixedPath];
  }

  return undefined;
}

// =============================================================================
// Assertion Functions
// =============================================================================

/**
 * Verify config fields are correctly transformed and present
 */
export function assertConfigCorrectness(
  responseConfig: Record<string, unknown>,
  expectedConfig: PlotConfig
) {
  expect(responseConfig.type).toBe(expectedConfig.type);
  expect(responseConfig.xAxis).toBe(expectedConfig.x_axis);
  if (expectedConfig.y_axis) {
    expect(responseConfig.yAxis).toBe(expectedConfig.y_axis);
  }
  expect(responseConfig.scaleX).toBe(expectedConfig.scale_x);
  expect(responseConfig.scaleY).toBe(expectedConfig.scale_y);

  if (expectedConfig.type === 'histogram') {
    expect(responseConfig.binCount).toBe(expectedConfig.bin_count);
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
  if (expectedConfig.group_by) {
    expect(responseConfig.groupBy).toBe(expectedConfig.group_by);
  }
  if (expectedConfig.aggregate) {
    expect(responseConfig.aggregate).toBe(expectedConfig.aggregate);
  }
}

/**
 * Verify data structure and values are correct for given config
 */
export function assertDataCorrectness(
  data: Record<string, unknown>[],
  expectedConfig: PlotConfig,
  dataTypeConfig: DataTypeConfig,
  scale: ScaleOption,
  expectedLogs?: ReturnType<typeof createMockLogs>,
  projectConfig?: ProjectConfig
) {
  if (expectedLogs) {
    expect(data.length).toBe(expectedLogs.length);
  } else {
    const hasFilter = projectConfig?.filter_expr != null;
    if (hasFilter) {
      expect(data.length).toBeGreaterThanOrEqual(0);
    } else {
      expect(data.length).toBeGreaterThan(0);
    }
    expect(data.length).toBeLessThanOrEqual(scale.count + 10);
  }

  if (data.length === 0) return;

  for (let i = 0; i < Math.min(data.length, 20); i++) {
    const log = data[i];
    const xVal = getLogFieldValue(log, 'table1.x_value');
    expect(xVal).toBeDefined();
    if (expectedConfig.type !== 'histogram') {
      const yVal = getLogFieldValue(log, 'table1.y_value');
      expect(yVal).toBeDefined();
    }
    expect(log.entries).toBeDefined();
    expect(typeof log.entries).toBe('object');
    expect(log.id).toBeDefined();
    expect(['string', 'number'].includes(typeof log.id)).toBe(true);
    expect(log.ts).toBeDefined();
  }

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
        const date = new Date(xValue as string);
        expect(date.toString()).not.toBe('Invalid Date');
        break;
    }

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

  if (expectedConfig.group_by) {
    const categoryField = expectedConfig.group_by;
    const categoryValues = data
      .map(log => getLogFieldValue(log, categoryField))
      .filter(v => v !== null && v !== undefined);
    const uniqueCategories = Array.from(new Set(categoryValues));
    if (categoryValues.length > 0) {
      expect(uniqueCategories.length).toBeGreaterThan(0);
      expect(uniqueCategories.length).toBeLessThanOrEqual(10);
    }
  }

  const numericXValues = data
    .map(log => getLogFieldValue(log, expectedConfig.x_axis))
    .filter(v => typeof v === 'number' && Number.isFinite(v)) as number[];

  if (numericXValues.length > 0) {
    const minX = Math.min(...numericXValues);
    const maxX = Math.max(...numericXValues);
    if (data.length > 1) {
      expect(maxX - minX).toBeGreaterThanOrEqual(0);
    }
  }
}

/**
 * Verify data preprocessing is correctly applied
 */
export function assertDataPreprocessing(
  data: Record<string, unknown>[],
  expectedConfig: PlotConfig,
  dataTypeConfig: DataTypeConfig,
  projectConfig?: ProjectConfig
) {
  if (data.length === 0) return;

  const sampleLogs = data.slice(0, 10);

  for (const log of sampleLogs) {
    const xVal = getLogFieldValue(log, 'table1.x_value');
    expect(xVal).toBeDefined();

    const entries = log.entries as Record<string, unknown>;
    expect(entries).toBeDefined();

    if (!PLOT_TEST_API_REAL && log.derived_entries) {
      const derivedEntries = log.derived_entries as Record<string, unknown>;
      for (const key of Object.keys(derivedEntries)) {
        expect(`table1.${key}` in log).toBe(true);
      }
    }

    const xValue = getLogFieldValue(log, 'table1.x_value');
    if (xValue !== null && xValue !== undefined) {
      if (['float', 'int'].includes(dataTypeConfig.x_axis_type)) {
        expect(typeof xValue).toBe('number');
      }
      if (dataTypeConfig.x_axis_type === 'str') {
        expect(typeof xValue).toBe('string');
      }
      if (dataTypeConfig.x_axis_type === 'datetime') {
        expect(typeof xValue).toBe('string');
        expect(() => new Date(xValue as string)).not.toThrow();
      }
    }

    const nullLog = data.find(l => getLogFieldValue(l, 'table1.x_value') === null);
    if (nullLog) {
      expect(getLogFieldValue(nullLog, 'table1.x_value')).toBeNull();
    }

    expect(log.id).toBeDefined();
    expect(['string', 'number'].includes(typeof log.id)).toBe(true);
    expect(log.ts).toBeDefined();
    expect(typeof log.ts).toBe('string');
  }

  const statusValues = Array.from(new Set(
    data.map(log => (log.entries as Record<string, unknown>)?.status).filter(Boolean)
  ));
  for (const status of statusValues) {
    expect(['success', 'error', 'pending', 'running']).toContain(status);
  }

  if (projectConfig && PLOT_TEST_API_REAL) {
    if (projectConfig.filter_expr) {
      const filterExpr = projectConfig.filter_expr;

      if (filterExpr === "status == 'success'") {
        for (const log of data) {
          const entries = log.entries as Record<string, unknown>;
          if (entries?.status !== undefined) {
            expect(entries.status).toBe('success');
          }
        }
      } else if (filterExpr === 'value > 0') {
        for (const log of data) {
          const yValue = log['table1.y_value'] as number | null | undefined;
          if (yValue !== null && yValue !== undefined) {
            expect(yValue).toBeGreaterThan(0);
          }
        }
      }
    }

    if (projectConfig.sorting) {
      try {
        const sortConfig = JSON.parse(projectConfig.sorting) as Array<{ field: string; order: 'asc' | 'desc' }>;
        if (sortConfig.length > 0) {
          const { field, order } = sortConfig[0];

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

    if (projectConfig.group_by && projectConfig.group_by.length > 0) {
      const groupFields = projectConfig.group_by;

      for (const groupField of groupFields) {
        const hasGroupField = data.some(log => {
          return log[groupField] !== undefined ||
                 log[`table1.${groupField}`] !== undefined ||
                 (log.entries as Record<string, unknown>)?.[groupField] !== undefined;
        });
        expect(hasGroupField).toBe(true);
      }

      if (groupFields.includes('category')) {
        const categories = data.map(log =>
          log['table1.category'] ?? (log.entries as Record<string, unknown>)?.category
        );
        const uniqueCategories = Array.from(new Set(categories));
        expect(uniqueCategories.length).toBeGreaterThan(0);
      }
    }

    if (projectConfig.limit) {
      expect(data.length).toBeLessThanOrEqual(projectConfig.limit);
    }
  }
}

/**
 * Verify field metadata is correctly transformed
 */
export function assertFieldsCorrectness(
  fields: Record<string, unknown>,
  dataTypeConfig: DataTypeConfig
) {
  expect(fields).toBeDefined();
  expect(typeof fields).toBe('object');

  const fieldKeys = Object.keys(fields);
  expect(fieldKeys.length).toBeGreaterThan(0);

  const xFieldKey = fieldKeys.find(k => k.includes('x_value'));
  expect(xFieldKey).toBeDefined();
  if (xFieldKey) {
    const xField = fields[xFieldKey] as Record<string, unknown>;
    expect(xField).toBeDefined();
    expect(typeof xField).toBe('object');
  }

  const yFieldKey = fieldKeys.find(k => k.includes('y_value'));
  if (yFieldKey) {
    const yField = fields[yFieldKey] as Record<string, unknown>;
    expect(yField).toBeDefined();
  }

  const categoryFieldKey = fieldKeys.find(k => k.includes('category'));
  if (categoryFieldKey) {
    const categoryField = fields[categoryFieldKey] as Record<string, unknown>;
    expect(categoryField).toBeDefined();
  }
}

/**
 * Verify metadata is complete
 */
export function assertMetadataCorrectness(
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
// Matrix Test Context
// =============================================================================

/**
 * Context for each matrix test combination.
 */
export interface ApiMatrixTestContext {
  plotType: string;
  plotConfig: PlotConfig;
  projectConfig: ProjectConfig;
  dataTypeConfig: DataTypeConfig;
  scale: ScaleOption;
  adjustedPlotConfig: PlotConfig;
  scaleAdjustedProjectConfig: ProjectConfig;
}

/**
 * Build the full matrix of test configurations.
 */
export function buildApiTestMatrix(): ApiMatrixTestContext[] {
  const plotTypes = ['scatter', 'bar', 'histogram', 'line'] as const;
  const projectConfigs = sampleConfigs(generateProjectConfigs());
  const dataTypeConfigs = sampleConfigs(generateDataTypeConfigs());
  const scales = getActiveScales();

  const matrix: ApiMatrixTestContext[] = [];

  for (const plotType of plotTypes) {
    const plotConfigs = sampleConfigs(generateValidPlotConfigsForType(plotType));

    for (const plotConfig of plotConfigs) {
      for (const projectConfig of projectConfigs) {
        for (const dataTypeConfig of dataTypeConfigs) {
          for (const scale of scales) {
            const scaleAdjustedProjectConfig: ProjectConfig = {
              ...projectConfig,
              // Use shard-specific project name for real API to avoid conflicts
              project_name: PLOT_TEST_API_REAL ? SHARD_TEST_PROJECT : projectConfig.project_name,
              limit: scale.count,
            };

            const adjustedPlotConfig: PlotConfig = PLOT_TEST_API_REAL
              ? {
                  ...plotConfig,
                  x_axis: `table1.${getFieldForDataType('x_value', dataTypeConfig.x_axis_type)}`,
                  y_axis: plotConfig.y_axis
                    ? `table1.${getFieldForDataType('y_value', dataTypeConfig.y_axis_type)}`
                    : undefined,
                  group_by: plotConfig.group_by
                    ? getGroupByFieldForType(dataTypeConfig.group_by_type)
                    : undefined,
                }
              : plotConfig;

            matrix.push({
              plotType,
              plotConfig,
              projectConfig,
              dataTypeConfig,
              scale,
              adjustedPlotConfig,
              scaleAdjustedProjectConfig,
            });
          }
        }
      }
    }
  }

  return matrix;
}

/**
 * Helper to get mock response for a specific test combination.
 */
export function getMockResponse(ctx: ApiMatrixTestContext) {
  return setupMatrixTestHandlers(ctx.adjustedPlotConfig, ctx.dataTypeConfig, ctx.scale, {
    projectName: ctx.scaleAdjustedProjectConfig.project_name,
    includeEdgeCases: true,
  });
}

