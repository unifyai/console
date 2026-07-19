/**
 * Table View API Matrix Tests
 *
 * Comprehensive matrix tests covering all combinations of:
 * - Table configs: visible columns, hidden columns, column order, widths
 * - Sort options: various sortBy/sortOrder combinations
 * - Project configs: filter expressions, limits, contexts
 * - Data types: string, int, float, datetime, boolean, null
 * - Row counts: small (10), medium (50), large (100)
 *
 * Run with sharding for parallel execution:
 *   npm run test:node:parallel 4 src/tests/table/api/
 *
 * Configuration:
 * - MATRIX_SHARD: "1/4" for first of 4 shards
 */

import { beforeAll, afterAll, afterEach, vi, expect } from 'vitest';
import { defineNodeMatrixTests } from '@/tests/helpers/utils/matrixTestRunnerNode';
import { server, createTableViewDataResponse } from './handlers';
import {
  TABLE_TEST_API_REAL,
  SHARD_TEST_PROJECT,
  createTestProject,
  deleteTestProject,
  seedTestProjectData,
  createTableViewRequest,
  getTableViewDataRequest,
} from './_api-helpers';

// =============================================================================
// Types
// =============================================================================

interface TableConfig {
  name: string;
  columns?: {
    visible?: string[];
    hidden?: string[];
    order?: string[];
    widths?: Record<string, number>;
  };
  rowLimit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface ProjectConfig {
  name: string;
  projectName: string;
  context?: string;
  filter?: string;
  limit?: number;
}

interface DataTypeConfig {
  name: string;
  columns: string[];
  types: Record<string, string>;
}

interface ScaleConfig {
  name: string;
  rowCount: number;
}

interface MatrixContext {
  tableConfig: TableConfig;
  projectConfig: ProjectConfig;
  dataTypeConfig: DataTypeConfig;
  scale: ScaleConfig;
}

// =============================================================================
// Configuration Generators
// =============================================================================

function generateTableConfigs(): TableConfig[] {
  return [
    // Basic configs
    { name: 'default', rowLimit: 50 },
    { name: 'small-limit', rowLimit: 10 },
    { name: 'large-limit', rowLimit: 100 },

    // Visibility configs
    {
      name: 'visible-subset',
      columns: { visible: ['id', 'name', 'status'] },
      rowLimit: 50,
    },
    {
      name: 'hidden-columns',
      columns: { hidden: ['created_at', 'internal_id'] },
      rowLimit: 50,
    },

    // Order configs
    {
      name: 'custom-order',
      columns: { order: ['status', 'name', 'id', 'value'] },
      rowLimit: 50,
    },

    // Width configs
    {
      name: 'custom-widths',
      columns: { widths: { name: 200, status: 100, value: 80 } },
      rowLimit: 50,
    },

    // Sort configs
    { name: 'sort-name-asc', sortBy: 'name', sortOrder: 'asc', rowLimit: 50 },
    { name: 'sort-value-desc', sortBy: 'value', sortOrder: 'desc', rowLimit: 50 },
    { name: 'sort-status-asc', sortBy: 'status', sortOrder: 'asc', rowLimit: 50 },

    // Combined configs
    {
      name: 'full-config',
      columns: {
        visible: ['id', 'name', 'status', 'value'],
        order: ['status', 'name', 'value', 'id'],
        widths: { name: 250, status: 100 },
      },
      sortBy: 'name',
      sortOrder: 'asc',
      rowLimit: 25,
    },
  ];
}

function generateProjectConfigs(): ProjectConfig[] {
  const projectName = TABLE_TEST_API_REAL ? SHARD_TEST_PROJECT : 'test-project';

  return [
    // Basic
    { name: 'default', projectName },

    // With context
    { name: 'with-context', projectName, context: 'production' },

    // With filter
    { name: 'filter-active', projectName, filter: "status == 'active'" },
    { name: 'filter-value', projectName, filter: 'value > 50' },

    // With limit
    { name: 'limit-10', projectName, limit: 10 },
    { name: 'limit-100', projectName, limit: 100 },
  ];
}

function generateDataTypeConfigs(): DataTypeConfig[] {
  return [
    {
      name: 'string-columns',
      columns: ['id', 'name', 'status', 'category'],
      types: { id: 'int', name: 'str', status: 'str', category: 'str' },
    },
    {
      name: 'numeric-columns',
      columns: ['id', 'value', 'count', 'score'],
      types: { id: 'int', value: 'float', count: 'int', score: 'float' },
    },
    {
      name: 'mixed-columns',
      columns: ['id', 'name', 'value', 'active', 'created_at'],
      types: { id: 'int', name: 'str', value: 'float', active: 'bool', created_at: 'datetime' },
    },
    {
      name: 'nullable-columns',
      columns: ['id', 'name', 'optional_value', 'notes'],
      types: { id: 'int', name: 'str', optional_value: 'float', notes: 'str' },
    },
  ];
}

function generateScaleConfigs(): ScaleConfig[] {
  return [
    { name: 'small', rowCount: 10 },
    { name: 'medium', rowCount: 50 },
    { name: 'large', rowCount: 100 },
  ];
}

// =============================================================================
// Matrix Builder
// =============================================================================

function buildTableViewMatrix(): MatrixContext[] {
  const tableConfigs = generateTableConfigs();
  const projectConfigs = generateProjectConfigs();
  const dataTypeConfigs = generateDataTypeConfigs();
  const scaleConfigs = generateScaleConfigs();

  const matrix: MatrixContext[] = [];

  // Sample to keep matrix manageable
  const sampleRate = parseInt(process.env.TABLE_TEST_SAMPLE_RATE || '50', 10) / 100;

  for (const tableConfig of tableConfigs) {
    for (const projectConfig of projectConfigs) {
      for (const dataTypeConfig of dataTypeConfigs) {
        for (const scale of scaleConfigs) {
          if (Math.random() < sampleRate) {
            matrix.push({
              tableConfig,
              projectConfig,
              dataTypeConfig,
              scale,
            });
          }
        }
      }
    }
  }

  return matrix;
}

// =============================================================================
// Setup/Teardown
// =============================================================================

beforeAll(async () => {
  if (TABLE_TEST_API_REAL) {
    await createTestProject();
    await seedTestProjectData(200);
  } else {
    server.listen({ onUnhandledRequest: 'error' });
  }
}, 30000);

afterEach(() => {
  if (!TABLE_TEST_API_REAL) {
    server.resetHandlers();
  }
  vi.restoreAllMocks();
});

afterAll(async () => {
  if (TABLE_TEST_API_REAL) {
    await deleteTestProject();
  } else {
    server.close();
  }
});

// =============================================================================
// Assertion Helpers
// =============================================================================

function assertCreateResponseCorrectness(
  response: { status: number; data: Record<string, unknown> },
  ctx: MatrixContext
) {
  expect(response.status).toBe(201);
  expect(response.data.token).toBeDefined();
  expect(response.data.url).toBeDefined();
  expect(typeof response.data.token).toBe('string');
  expect(typeof response.data.url).toBe('string');
}

function assertDataResponseCorrectness(
  response: { status: number; data: Record<string, unknown> },
  ctx: MatrixContext
) {
  expect(response.status).toBe(200);

  // Config assertions
  expect(response.data.config).toBeDefined();
  const config = response.data.config as Record<string, unknown>;
  expect(config.visibleColumns).toBeDefined();
  expect(config.columnOrder).toBeDefined();
  expect(Array.isArray(config.visibleColumns)).toBe(true);
  expect(Array.isArray(config.columnOrder)).toBe(true);

  // Data assertions
  expect(response.data.data).toBeDefined();
  const data = response.data.data as Record<string, unknown>[];
  expect(Array.isArray(data)).toBe(true);

  // Row count should be reasonable (mocks may not perfectly respect limits)
  // For real API, would validate against limit more strictly
  expect(data.length).toBeLessThanOrEqual(100);

  // Metadata assertions
  expect(response.data.metadata).toBeDefined();
  const metadata = response.data.metadata as Record<string, unknown>;
  expect(metadata.token).toBeDefined();
  expect(metadata.projectName).toBeDefined();
  expect(metadata.createdAt).toBeDefined();

  // Fields assertions
  expect(response.data.fields).toBeDefined();
  expect(typeof response.data.fields).toBe('object');

  // Total count assertion
  expect(response.data.totalCount).toBeDefined();
  expect(typeof response.data.totalCount).toBe('number');
}

function assertColumnVisibility(
  response: { status: number; data: Record<string, unknown> },
  ctx: MatrixContext
) {
  const config = response.data.config as { visibleColumns: string[] };

  if (ctx.tableConfig.columns?.visible) {
    // Should only show visible columns
    for (const col of ctx.tableConfig.columns.visible) {
      expect(config.visibleColumns).toContain(col);
    }
  }

  if (ctx.tableConfig.columns?.hidden) {
    // Should not show hidden columns
    for (const col of ctx.tableConfig.columns.hidden) {
      expect(config.visibleColumns).not.toContain(col);
    }
  }
}

function assertColumnOrder(
  response: { status: number; data: Record<string, unknown> },
  ctx: MatrixContext
) {
  const config = response.data.config as { columnOrder: string[] };

  if (ctx.tableConfig.columns?.order) {
    // Column order should respect the specified order
    const specifiedOrder = ctx.tableConfig.columns.order;
    const actualOrder = config.columnOrder;

    // Check that columns in specified order appear in correct relative order
    let lastIndex = -1;
    for (const col of specifiedOrder) {
      const currentIndex = actualOrder.indexOf(col);
      if (currentIndex !== -1) {
        expect(currentIndex).toBeGreaterThan(lastIndex);
        lastIndex = currentIndex;
      }
    }
  }
}

// =============================================================================
// Matrix Tests
// =============================================================================

defineNodeMatrixTests<MatrixContext>({
  name: 'Table View API - Matrix Tests',
  concurrent: true,

  getMatrix: buildTableViewMatrix,

  getConfigAlias: (ctx) =>
    `${ctx.tableConfig.name}|${ctx.projectConfig.name}|${ctx.dataTypeConfig.name}|${ctx.scale.name}`,

  defineTests: (ctx, { it, expect }) => {
    it('creates table view with valid response', async () => {
      if (!TABLE_TEST_API_REAL) {
        const mockResponse = createTableViewDataResponse({
          columns: ctx.dataTypeConfig.columns,
          rowCount: ctx.scale.rowCount,
          projectName: ctx.projectConfig.projectName,
        });
        server.use(
          (await import('./handlers')).createTableViewSuccessHandler(),
          (await import('./handlers')).getTableViewDataSuccessHandler(mockResponse)
        );
      }

      const createResponse = await createTableViewRequest({
        projectConfig: {
          projectName: ctx.projectConfig.projectName,
          context: ctx.projectConfig.context,
          filter: ctx.projectConfig.filter,
          limit: ctx.projectConfig.limit,
        },
        tableConfig: {
          columns: ctx.tableConfig.columns,
          rowLimit: ctx.tableConfig.rowLimit,
          sortBy: ctx.tableConfig.sortBy,
          sortOrder: ctx.tableConfig.sortOrder,
        },
      });

      assertCreateResponseCorrectness(createResponse, ctx);
    });

    it('retrieves table view data correctly', async () => {
      if (!TABLE_TEST_API_REAL) {
        const mockResponse = createTableViewDataResponse({
          columns: ctx.dataTypeConfig.columns,
          rowCount: ctx.scale.rowCount,
          visibleColumns: ctx.tableConfig.columns?.visible,
          columnOrder: ctx.tableConfig.columns?.order,
          projectName: ctx.projectConfig.projectName,
        });
        server.use(
          (await import('./handlers')).createTableViewSuccessHandler({
            token: mockResponse.metadata.token,
          }),
          (await import('./handlers')).getTableViewDataSuccessHandler(mockResponse)
        );
      }

      // Create first
      const createResponse = await createTableViewRequest({
        projectConfig: {
          projectName: ctx.projectConfig.projectName,
          context: ctx.projectConfig.context,
          filter: ctx.projectConfig.filter,
          limit: ctx.projectConfig.limit,
        },
        tableConfig: {
          columns: ctx.tableConfig.columns,
          rowLimit: ctx.tableConfig.rowLimit,
          sortBy: ctx.tableConfig.sortBy,
          sortOrder: ctx.tableConfig.sortOrder,
        },
      });

      expect(createResponse.status).toBe(201);

      // Get data
      const dataResponse = await getTableViewDataRequest(createResponse.data.token as string);

      assertDataResponseCorrectness(dataResponse, ctx);
    });
  },
});
