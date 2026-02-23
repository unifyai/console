/**
 * Table View API Real Integration Tests
 *
 * These tests make REAL HTTP requests to the running Console server.
 * They require:
 * - Console server running (npm run dev)
 * - Orchestra backend running
 * - Valid API key in VITE_TEST_API_KEY
 *
 * Run with: VITE_TEST_API_REAL=true npm run test:real
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  VITE_TEST_API_URL,
  VITE_TEST_API_KEY,
  TABLE_TEST_API_REAL,
  SHARD_TEST_PROJECT,
  createTestProject,
  deleteTestProject,
  seedTestProjectData,
} from './_api-helpers';

// Skip all tests if not running in real mode
const describeReal = TABLE_TEST_API_REAL ? describe : describe.skip;

// =============================================================================
// Test Helpers
// =============================================================================

async function createTableView(config: {
  projectName: string;
  title?: string;
  tableConfig?: Record<string, unknown>;
}) {
  const response = await fetch(`${VITE_TEST_API_URL}/api/table/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${VITE_TEST_API_KEY}`,
    },
    body: JSON.stringify({
      projectConfig: {
        projectName: config.projectName,
      },
      tableConfig: config.tableConfig,
      title: config.title,
    }),
  });

  return {
    status: response.status,
    data: await response.json(),
  };
}

async function getTableData(token: string) {
  const response = await fetch(`${VITE_TEST_API_URL}/api/table/data/${token}`);

  return {
    status: response.status,
    data: await response.json(),
  };
}

// =============================================================================
// Setup / Teardown
// =============================================================================

beforeAll(async () => {
  if (TABLE_TEST_API_REAL) {
    console.log('[Real Tests] Setting up test project...');
    await createTestProject();
    await seedTestProjectData(50);
    console.log('[Real Tests] Test project ready');
  }
}, 60000);

afterAll(async () => {
  if (TABLE_TEST_API_REAL) {
    console.log('[Real Tests] Cleaning up test project...');
    await deleteTestProject();
  }
}, 30000);

// =============================================================================
// Real Integration Tests - POST /api/table/create
// =============================================================================

describeReal('POST /api/table/create - Real Integration', () => {
  it('creates a table view and returns token', async () => {
    const result = await createTableView({
      projectName: SHARD_TEST_PROJECT,
      title: 'Real Test Table',
    });

    expect(result.status).toBe(201);
    expect(result.data.token).toBeDefined();
    expect(result.data.token).toMatch(/^[a-f0-9]{12}$/);
    expect(result.data.url).toContain(result.data.token);
  });

  it('creates table view with column visibility config', async () => {
    const result = await createTableView({
      projectName: SHARD_TEST_PROJECT,
      tableConfig: {
        columns: {
          visible: ['id', 'name', 'status'],
        },
        rowLimit: 25,
      },
    });

    expect(result.status).toBe(201);
    expect(result.data.token).toBeDefined();
  });

  it('creates table view with sort config', async () => {
    const result = await createTableView({
      projectName: SHARD_TEST_PROJECT,
      tableConfig: {
        sortBy: 'id',
        sortOrder: 'desc',
        rowLimit: 50,
      },
    });

    expect(result.status).toBe(201);
    expect(result.data.token).toBeDefined();
  });

  it('rejects request without auth header', async () => {
    const response = await fetch(`${VITE_TEST_API_URL}/api/table/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectConfig: { projectName: SHARD_TEST_PROJECT },
      }),
    });

    expect(response.status).toBe(401);
  });

  it('rejects request without projectName', async () => {
    const response = await fetch(`${VITE_TEST_API_URL}/api/table/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${VITE_TEST_API_KEY}`,
      },
      body: JSON.stringify({
        projectConfig: {},
      }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('projectName');
  });

  it('rejects request for non-existent project', async () => {
    const response = await fetch(`${VITE_TEST_API_URL}/api/table/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${VITE_TEST_API_KEY}`,
      },
      body: JSON.stringify({
        projectConfig: { projectName: 'non-existent-project-xyz-123' },
      }),
    });

    // Orchestra should return 404 or 403
    expect([403, 404]).toContain(response.status);
  });
});

// =============================================================================
// Real Integration Tests - GET /api/table/data/[token]
// =============================================================================

describeReal('GET /api/table/data/[token] - Real Integration', () => {
  let createdToken: string;

  beforeAll(async () => {
    // Create a table view to test data retrieval
    const result = await createTableView({
      projectName: SHARD_TEST_PROJECT,
      title: 'Data Test Table',
      tableConfig: {
        rowLimit: 10,
      },
    });

    if (result.status === 201) {
      createdToken = result.data.token;
    }
  });

  it('returns table data for valid token', async () => {
    expect(createdToken).toBeDefined();

    const result = await getTableData(createdToken);

    expect(result.status).toBe(200);
    expect(result.data.config).toBeDefined();
    expect(result.data.data).toBeDefined();
    expect(Array.isArray(result.data.data)).toBe(true);
    expect(result.data.metadata).toBeDefined();
    expect(result.data.pagination).toBeDefined();
    expect(result.data.pagination.totalCount).toBeDefined();
  });

  it('returns correct metadata', async () => {
    expect(createdToken).toBeDefined();

    const result = await getTableData(createdToken);

    expect(result.status).toBe(200);
    expect(result.data.metadata.token).toBe(createdToken);
    expect(result.data.metadata.title).toBe('Data Test Table');
    expect(result.data.metadata.projectName).toBe(SHARD_TEST_PROJECT);
    expect(result.data.metadata.createdAt).toBeDefined();
    expect(result.data.metadata.updatedAt).toBeDefined();
  });

  it('returns computed visible columns and order', async () => {
    expect(createdToken).toBeDefined();

    const result = await getTableData(createdToken);

    expect(result.status).toBe(200);
    expect(result.data.config.visibleColumns).toBeDefined();
    expect(Array.isArray(result.data.config.visibleColumns)).toBe(true);
    expect(result.data.config.columnOrder).toBeDefined();
    expect(Array.isArray(result.data.config.columnOrder)).toBe(true);
  });

  it('returns field metadata', async () => {
    expect(createdToken).toBeDefined();

    const result = await getTableData(createdToken);

    expect(result.status).toBe(200);
    expect(result.data.fields).toBeDefined();
    expect(typeof result.data.fields).toBe('object');
  });

  it('returns 400 for invalid token format', async () => {
    const result = await getTableData('invalid');

    expect(result.status).toBe(400);
    expect(result.data.error).toContain('Invalid token');
  });

  it('returns 400 for token with wrong length', async () => {
    const result = await getTableData('abc123');

    expect(result.status).toBe(400);
  });

  it('returns 404 for non-existent token', async () => {
    const result = await getTableData('000000000000');

    expect(result.status).toBe(404);
    expect(result.data.expired).toBe(true);
  });

  it('normalizes uppercase tokens', async () => {
    expect(createdToken).toBeDefined();

    // Request with uppercase token
    const uppercaseToken = createdToken.toUpperCase();
    const result = await getTableData(uppercaseToken);

    // Should still work (normalized to lowercase)
    expect(result.status).toBe(200);
  });
});

// =============================================================================
// Real Integration Tests - Column Visibility
// =============================================================================

describeReal('Column Visibility - Real Integration', () => {
  it('respects visible columns config', async () => {
    // Create with specific visible columns
    const createResult = await createTableView({
      projectName: SHARD_TEST_PROJECT,
      tableConfig: {
        columns: {
          visible: ['id', 'name'],
        },
      },
    });

    expect(createResult.status).toBe(201);

    const dataResult = await getTableData(createResult.data.token);

    expect(dataResult.status).toBe(200);
    // Visible columns should only include requested columns (that exist in data)
    const visibleColumns = dataResult.data.config.visibleColumns;
    expect(visibleColumns).toContain('id');
    expect(visibleColumns).toContain('name');
  });

  it('respects hidden columns config', async () => {
    // Create with hidden columns
    const createResult = await createTableView({
      projectName: SHARD_TEST_PROJECT,
      tableConfig: {
        columns: {
          hidden: ['_id', '_ts'],
        },
      },
    });

    expect(createResult.status).toBe(201);

    const dataResult = await getTableData(createResult.data.token);

    expect(dataResult.status).toBe(200);
    // Hidden columns should not be in visible list
    const visibleColumns = dataResult.data.config.visibleColumns;
    expect(visibleColumns).not.toContain('_id');
    expect(visibleColumns).not.toContain('_ts');
  });

  it('respects column order config', async () => {
    // Create with specific column order
    const createResult = await createTableView({
      projectName: SHARD_TEST_PROJECT,
      tableConfig: {
        columns: {
          visible: ['status', 'name', 'id'],
          order: ['status', 'name', 'id'],
        },
      },
    });

    expect(createResult.status).toBe(201);

    const dataResult = await getTableData(createResult.data.token);

    expect(dataResult.status).toBe(200);
    const columnOrder = dataResult.data.config.columnOrder;

    // Find indices of columns in order
    const statusIdx = columnOrder.indexOf('status');
    const nameIdx = columnOrder.indexOf('name');
    const idIdx = columnOrder.indexOf('id');

    // Status should come before name, name before id
    if (statusIdx !== -1 && nameIdx !== -1) {
      expect(statusIdx).toBeLessThan(nameIdx);
    }
    if (nameIdx !== -1 && idIdx !== -1) {
      expect(nameIdx).toBeLessThan(idIdx);
    }
  });
});

// =============================================================================
// Real Integration Tests - Row Limit
// =============================================================================

describeReal('Row Limit - Real Integration', () => {
  it('respects rowLimit config', async () => {
    const createResult = await createTableView({
      projectName: SHARD_TEST_PROJECT,
      tableConfig: {
        rowLimit: 5,
      },
    });

    expect(createResult.status).toBe(201);

    const dataResult = await getTableData(createResult.data.token);

    expect(dataResult.status).toBe(200);
    // Data should have at most 5 rows
    expect(dataResult.data.data.length).toBeLessThanOrEqual(5);
  });
});
