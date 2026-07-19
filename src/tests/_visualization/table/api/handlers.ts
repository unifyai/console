/**
 * MSW Handlers for Table View API Tests
 *
 * Mock Service Worker handlers for intercepting table view API requests during tests.
 * Provides configurable responses for different test scenarios.
 *
 * Endpoints covered:
 * - POST /api/table/create - Table view creation
 * - GET /api/table/data/[token] - Table view data retrieval
 */

import { http, HttpResponse, delay } from 'msw';
import { setupServer } from 'msw/node';

// =============================================================================
// Types
// =============================================================================

export interface CreateTableViewRequest {
  tableConfig?: {
    columns?: {
      visible?: string[];
      hidden?: string[];
      order?: string[];
      widths?: Record<string, number>;
    };
    rowLimit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  };
  projectConfig: {
    projectName: string;
    context?: string;
    filter?: string;
    fromFields?: string;
    excludeFields?: string;
    limit?: number;
    offset?: number;
    sorting?: string;
  };
  title?: string;
}

export interface CreateTableViewResponse {
  url: string;
  token: string;
}

export interface TableViewDataResponse {
  config: {
    columns?: {
      visible?: string[];
      hidden?: string[];
      order?: string[];
      widths?: Record<string, number>;
    };
    visibleColumns: string[];
    columnOrder: string[];
    rowLimit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  };
  data: Record<string, unknown>[];
  fields: Record<string, { type: string; count?: number }>;
  metadata: {
    token: string;
    title?: string;
    projectName: string;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
  };
  totalCount: number;
}

// =============================================================================
// Mock Data Generators
// =============================================================================

let tokenCounter = 0;

/**
 * Generate a unique test token (12 hex characters to match Orchestra format)
 */
export function generateTestToken(): string {
  tokenCounter++;
  // Generate a 12-char hex string similar to uuid.uuid4().hex[:12]
  const hex = tokenCounter.toString(16).padStart(12, '0');
  return hex.slice(-12);
}

/**
 * Generate mock table data
 */
export function generateMockTableData(
  count: number = 50,
  columns: string[] = ['id', 'name', 'status', 'value', 'created_at']
): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, i) => {
    const row: Record<string, unknown> = {
      _id: i + 1,
      _ts: new Date(Date.now() - i * 86400000).toISOString(),
    };

    for (const col of columns) {
      switch (col) {
        case 'id':
          row[col] = i + 1;
          break;
        case 'name':
          row[col] = `Item ${i + 1}`;
          break;
        case 'status':
          row[col] = i % 3 === 0 ? 'active' : i % 3 === 1 ? 'pending' : 'completed';
          break;
        case 'value':
          row[col] = Math.round(Math.random() * 1000) / 10;
          break;
        case 'created_at':
          row[col] = new Date(Date.now() - i * 86400000).toISOString();
          break;
        default:
          row[col] = `${col}_${i}`;
      }
    }

    return row;
  });
}

/**
 * Generate mock field metadata
 */
export function generateMockFields(
  columns: string[] = ['id', 'name', 'status', 'value', 'created_at']
): Record<string, { type: string; count?: number }> {
  const fields: Record<string, { type: string; count?: number }> = {};

  for (const col of columns) {
    switch (col) {
      case 'id':
        fields[col] = { type: 'int', count: 100 };
        break;
      case 'value':
        fields[col] = { type: 'float', count: 100 };
        break;
      case 'created_at':
        fields[col] = { type: 'datetime', count: 100 };
        break;
      default:
        fields[col] = { type: 'str', count: 100 };
    }
  }

  return fields;
}

// =============================================================================
// Response Factories
// =============================================================================

/**
 * Create a successful table view creation response
 */
export function createTableViewCreateResponse(
  options: Partial<CreateTableViewResponse> = {}
): CreateTableViewResponse {
  const token = options.token ?? generateTestToken();
  return {
    url: `http://localhost:3000/table/view/${token}`,
    token,
    ...options,
  };
}

/**
 * Create a table view data response
 */
export function createTableViewDataResponse(
  options: {
    columns?: string[];
    rowCount?: number;
    visibleColumns?: string[];
    columnOrder?: string[];
    projectName?: string;
    title?: string;
  } = {}
): TableViewDataResponse {
  const columns = options.columns ?? ['id', 'name', 'status', 'value', 'created_at'];
  const visibleColumns = options.visibleColumns ?? columns;
  const columnOrder = options.columnOrder ?? visibleColumns;
  const data = generateMockTableData(options.rowCount ?? 50, columns);
  const fields = generateMockFields(columns);

  return {
    config: {
      visibleColumns,
      columnOrder,
      rowLimit: 100,
      sortBy: undefined,
      sortOrder: undefined,
    },
    data,
    fields,
    metadata: {
      token: generateTestToken(),
      title: options.title,
      projectName: options.projectName ?? 'test-project',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'test-user',
    },
    totalCount: data.length,
  };
}

// =============================================================================
// Handler Factories
// =============================================================================

export interface HandlerConfig {
  delay?: number;
  token?: string;
}

/**
 * Create table view creation success handler
 */
export function createTableViewSuccessHandler(
  response?: Partial<CreateTableViewResponse>,
  config?: HandlerConfig
) {
  return http.post('/api/table/create', async ({ request }) => {
    if (config?.delay) {
      await delay(config.delay);
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    const body = (await request.json()) as CreateTableViewRequest;

    if (!body.projectConfig?.projectName) {
      return HttpResponse.json({ error: 'Missing projectConfig.projectName' }, { status: 400 });
    }

    return HttpResponse.json(createTableViewCreateResponse(response), { status: 201 });
  });
}

/**
 * Create table view creation error handler
 */
export function createTableViewErrorHandler(
  error: { status: number; message?: string },
  config?: HandlerConfig
) {
  return http.post('/api/table/create', async () => {
    if (config?.delay) {
      await delay(config.delay);
    }

    return HttpResponse.json(
      { error: error.message ?? 'Table view creation failed' },
      { status: error.status }
    );
  });
}

/**
 * Get table view data success handler
 */
export function getTableViewDataSuccessHandler(
  response: TableViewDataResponse,
  config?: HandlerConfig
) {
  const tokenPattern = config?.token ?? ':token';
  return http.get(`/api/table/data/${tokenPattern}`, async () => {
    if (config?.delay) {
      await delay(config.delay);
    }

    return HttpResponse.json(response);
  });
}

/**
 * Get table view data error handler
 */
export function getTableViewDataErrorHandler(
  error: { status: number; message?: string; expired?: boolean },
  config?: HandlerConfig
) {
  const tokenPattern = config?.token ?? ':token';
  return http.get(`/api/table/data/${tokenPattern}`, async () => {
    if (config?.delay) {
      await delay(config.delay);
    }

    return HttpResponse.json(
      { error: error.message ?? 'Failed to load table view', expired: error.expired },
      { status: error.status }
    );
  });
}

// =============================================================================
// Default Handlers
// =============================================================================

export const defaultHandlers = [
  createTableViewSuccessHandler(),
  getTableViewDataSuccessHandler(createTableViewDataResponse()),
];

// =============================================================================
// Test Server Setup
// =============================================================================

export const server = setupServer(...defaultHandlers);

// =============================================================================
// Handler Utilities
// =============================================================================

export const handlers = {
  createTableViewSuccess: createTableViewSuccessHandler,
  createTableViewError: createTableViewErrorHandler,
  getTableViewDataSuccess: getTableViewDataSuccessHandler,
  getTableViewDataError: getTableViewDataErrorHandler,
  reset: () => server.resetHandlers(),
  use: (...customHandlers: ReturnType<typeof http.get | typeof http.post>[]) =>
    server.use(...customHandlers),
};

// =============================================================================
// Test Scenario Factory
// =============================================================================

/**
 * Create a scenario-specific handler setup for API tests
 */
export function createTestScenario(
  scenario: 'success' | 'auth-error' | 'validation-error' | 'not-found' | 'expired' | 'server-error'
) {
  switch (scenario) {
    case 'success':
      return defaultHandlers;

    case 'auth-error':
      return [
        createTableViewErrorHandler({ status: 401, message: 'Invalid API key' }),
        getTableViewDataErrorHandler({ status: 401, message: 'Unauthorized' }),
      ];

    case 'validation-error':
      return [
        createTableViewErrorHandler({ status: 400, message: 'Invalid request' }),
        getTableViewDataErrorHandler({ status: 400, message: 'Invalid token format' }),
      ];

    case 'not-found':
      return [
        getTableViewDataErrorHandler({
          status: 404,
          message: 'Table view not found',
          expired: false,
        }),
      ];

    case 'expired':
      return [
        getTableViewDataErrorHandler({
          status: 404,
          message: 'Table view not found or expired',
          expired: true,
        }),
      ];

    case 'server-error':
      return [
        createTableViewErrorHandler({ status: 500, message: 'Internal server error' }),
        getTableViewDataErrorHandler({ status: 500, message: 'Failed to load table view' }),
      ];

    default:
      return defaultHandlers;
  }
}
