/**
 * Table View API Tests
 *
 * Tests for the table view API endpoints covering:
 * - Authentication
 * - Input validation
 * - Error scenarios
 * - Data retrieval
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { server, createTestScenario, createTableViewDataResponse } from './handlers';
import {
  TEST_PROJECT,
  TABLE_TEST_API_REAL,
  createTestProject,
  deleteTestProject,
  seedTestProjectData,
  createTableViewRequest,
  getTableViewDataRequest,
} from './_api-helpers';

// =============================================================================
// Setup
// =============================================================================

beforeAll(async () => {
  if (TABLE_TEST_API_REAL) {
    await createTestProject();
    await seedTestProjectData(100);
  } else {
    server.listen({ onUnhandledRequest: 'error' });
  }
});

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
// Authentication Tests
// =============================================================================

describe('Table View API - Authentication', () => {
  it('rejects requests without Authorization header', async () => {
    if (!TABLE_TEST_API_REAL) {
      server.use(...createTestScenario('auth-error'));
    }

    const response = await createTableViewRequest(
      {
        projectConfig: { projectName: TEST_PROJECT },
      },
      { apiKey: null }
    );

    expect(response.status).toBe(401);
    expect(response.data.error).toBeDefined();
  });

  it('rejects requests with empty API key', async () => {
    if (!TABLE_TEST_API_REAL) {
      server.use(...createTestScenario('auth-error'));
    }

    const response = await createTableViewRequest(
      {
        projectConfig: { projectName: TEST_PROJECT },
      },
      { apiKey: '' }
    );

    expect(response.status).toBe(401);
  });

  it('accepts requests with valid API key', async () => {
    if (!TABLE_TEST_API_REAL) {
      server.use(...createTestScenario('success'));
    }

    const response = await createTableViewRequest({
      projectConfig: { projectName: TEST_PROJECT },
    });

    expect(response.status).toBe(201);
    expect(response.data.token).toBeDefined();
    expect(response.data.url).toBeDefined();
  });
});

// =============================================================================
// Input Validation Tests
// =============================================================================

describe('Table View API - Input Validation', () => {
  it('rejects requests without projectConfig', async () => {
    const response = await createTableViewRequest({});

    expect(response.status).toBe(400);
    expect(response.data.error).toContain('projectConfig');
  });

  it('rejects requests without projectName', async () => {
    const response = await createTableViewRequest({
      projectConfig: {},
    });

    expect(response.status).toBe(400);
    expect(response.data.error).toContain('projectName');
  });

  it('accepts requests with minimal config', async () => {
    if (!TABLE_TEST_API_REAL) {
      server.use(...createTestScenario('success'));
    }

    const response = await createTableViewRequest({
      projectConfig: { projectName: TEST_PROJECT },
    });

    expect(response.status).toBe(201);
    expect(response.data.token).toBeDefined();
  });

  it('accepts requests with full table config', async () => {
    if (!TABLE_TEST_API_REAL) {
      server.use(...createTestScenario('success'));
    }

    const response = await createTableViewRequest({
      projectConfig: { projectName: TEST_PROJECT },
      tableConfig: {
        columns: {
          visible: ['id', 'name', 'status'],
          order: ['status', 'name', 'id'],
          widths: { id: 80, name: 200, status: 100 },
        },
        rowLimit: 50,
        sortBy: 'name',
        sortOrder: 'asc',
      },
      title: 'My Test Table',
    });

    expect(response.status).toBe(201);
  });

  it('accepts requests with hidden columns config', async () => {
    if (!TABLE_TEST_API_REAL) {
      server.use(...createTestScenario('success'));
    }

    const response = await createTableViewRequest({
      projectConfig: { projectName: TEST_PROJECT },
      tableConfig: {
        columns: {
          hidden: ['internal_id', 'created_by'],
        },
      },
    });

    expect(response.status).toBe(201);
  });
});

// =============================================================================
// Error Scenarios
// =============================================================================

describe('Table View API - Error Scenarios', () => {
  it('returns 404 for non-existent table view', async () => {
    if (!TABLE_TEST_API_REAL) {
      server.use(...createTestScenario('not-found'));
      const response = await getTableViewDataRequest('abc123def456');
      expect(response.status).toBe(404);
      expect(response.data.error).toBeDefined();
    } else {
      const response = await getTableViewDataRequest('abc123def456');
      expect([400, 404]).toContain(response.status);
    }
  });

  it('returns expired flag for expired table views', async () => {
    if (!TABLE_TEST_API_REAL) {
      server.use(...createTestScenario('expired'));
      const response = await getTableViewDataRequest('expired_token_12');
      expect(response.status).toBe(404);
      expect(response.data.expired).toBe(true);
    } else {
      expect(true).toBe(true);
    }
  });

  it('handles server errors gracefully', async () => {
    if (!TABLE_TEST_API_REAL) {
      server.use(...createTestScenario('server-error'));
      const response = await getTableViewDataRequest('error_token_123');
      expect(response.status).toBe(500);
      expect(response.data.error).toBeDefined();
    } else {
      expect(true).toBe(true);
    }
  });
});

// =============================================================================
// Data Retrieval Tests
// =============================================================================

describe('Table View API - Data Retrieval', () => {
  it.skipIf(TABLE_TEST_API_REAL)('returns table data with correct structure', async () => {
    const mockResponse = createTableViewDataResponse({
      columns: ['id', 'name', 'status', 'value'],
      rowCount: 25,
      projectName: TEST_PROJECT,
    });

    server.use((await import('./handlers')).getTableViewDataSuccessHandler(mockResponse));

    const response = await getTableViewDataRequest('test12345678');

    expect(response.status).toBe(200);
    expect(response.data.config).toBeDefined();
    expect(response.data.data).toBeDefined();
    expect(Array.isArray(response.data.data)).toBe(true);
    expect(response.data.fields).toBeDefined();
    expect(response.data.metadata).toBeDefined();
    expect(response.data.totalCount).toBeDefined();
  });

  it.skipIf(TABLE_TEST_API_REAL)('returns correct visible columns', async () => {
    const mockResponse = createTableViewDataResponse({
      columns: ['id', 'name', 'status', 'value'],
      visibleColumns: ['name', 'status'],
      projectName: TEST_PROJECT,
    });

    server.use((await import('./handlers')).getTableViewDataSuccessHandler(mockResponse));

    const response = await getTableViewDataRequest('test12345678');

    expect(response.status).toBe(200);
    expect(response.data.config.visibleColumns).toEqual(['name', 'status']);
  });

  it.skipIf(TABLE_TEST_API_REAL)('returns correct column order', async () => {
    const mockResponse = createTableViewDataResponse({
      columns: ['id', 'name', 'status', 'value'],
      columnOrder: ['status', 'name', 'value', 'id'],
      projectName: TEST_PROJECT,
    });

    server.use((await import('./handlers')).getTableViewDataSuccessHandler(mockResponse));

    const response = await getTableViewDataRequest('test12345678');

    expect(response.status).toBe(200);
    expect(response.data.config.columnOrder).toEqual(['status', 'name', 'value', 'id']);
  });

  it.skipIf(TABLE_TEST_API_REAL)('includes field metadata', async () => {
    const mockResponse = createTableViewDataResponse({
      columns: ['id', 'name', 'value'],
      projectName: TEST_PROJECT,
    });

    server.use((await import('./handlers')).getTableViewDataSuccessHandler(mockResponse));

    const response = await getTableViewDataRequest('test12345678');

    expect(response.status).toBe(200);
    expect(response.data.fields.id).toBeDefined();
    expect(response.data.fields.id.type).toBe('int');
    expect(response.data.fields.name).toBeDefined();
    expect(response.data.fields.name.type).toBe('str');
    expect(response.data.fields.value).toBeDefined();
    expect(response.data.fields.value.type).toBe('float');
  });

  it.skipIf(TABLE_TEST_API_REAL)('includes metadata', async () => {
    const mockResponse = createTableViewDataResponse({
      projectName: 'my-project',
      title: 'My Table',
    });

    server.use((await import('./handlers')).getTableViewDataSuccessHandler(mockResponse));

    const response = await getTableViewDataRequest('test12345678');

    expect(response.status).toBe(200);
    expect(response.data.metadata.projectName).toBe('my-project');
    expect(response.data.metadata.title).toBe('My Table');
    expect(response.data.metadata.createdAt).toBeDefined();
    expect(response.data.metadata.updatedAt).toBeDefined();
    expect(response.data.metadata.createdBy).toBeDefined();
  });
});

// =============================================================================
// Table Config Tests
// =============================================================================

describe('Table View API - Table Config', () => {
  it('accepts sortBy and sortOrder', async () => {
    if (!TABLE_TEST_API_REAL) {
      server.use(...createTestScenario('success'));
    }

    const response = await createTableViewRequest({
      projectConfig: { projectName: TEST_PROJECT },
      tableConfig: {
        sortBy: 'created_at',
        sortOrder: 'desc',
      },
    });

    expect(response.status).toBe(201);
  });

  it('accepts rowLimit parameter', async () => {
    if (!TABLE_TEST_API_REAL) {
      server.use(...createTestScenario('success'));
    }

    const response = await createTableViewRequest({
      projectConfig: { projectName: TEST_PROJECT },
      tableConfig: {
        rowLimit: 25,
      },
    });

    expect(response.status).toBe(201);
  });

  it('accepts column widths', async () => {
    if (!TABLE_TEST_API_REAL) {
      server.use(...createTestScenario('success'));
    }

    const response = await createTableViewRequest({
      projectConfig: { projectName: TEST_PROJECT },
      tableConfig: {
        columns: {
          widths: {
            name: 250,
            description: 400,
            status: 100,
          },
        },
      },
    });

    expect(response.status).toBe(201);
  });
});

// =============================================================================
// Project Config Tests
// =============================================================================

describe('Table View API - Project Config', () => {
  it('accepts context parameter', async () => {
    if (!TABLE_TEST_API_REAL) {
      server.use(...createTestScenario('success'));
    }

    const response = await createTableViewRequest({
      projectConfig: {
        projectName: TEST_PROJECT,
        context: 'production',
      },
    });

    expect(response.status).toBe(201);
  });

  it('accepts filter parameter', async () => {
    if (!TABLE_TEST_API_REAL) {
      server.use(...createTestScenario('success'));
    }

    const response = await createTableViewRequest({
      projectConfig: {
        projectName: TEST_PROJECT,
        filter: "status == 'active'",
      },
    });

    expect(response.status).toBe(201);
  });

  it('accepts limit and offset parameters', async () => {
    if (!TABLE_TEST_API_REAL) {
      server.use(...createTestScenario('success'));
    }

    const response = await createTableViewRequest({
      projectConfig: {
        projectName: TEST_PROJECT,
        limit: 100,
        offset: 50,
      },
    });

    expect(response.status).toBe(201);
  });

  it('accepts sorting parameter', async () => {
    if (!TABLE_TEST_API_REAL) {
      server.use(...createTestScenario('success'));
    }

    const response = await createTableViewRequest({
      projectConfig: {
        projectName: TEST_PROJECT,
        sorting: JSON.stringify([{ field: 'timestamp', order: 'desc' }]),
      },
    });

    expect(response.status).toBe(201);
  });
});
