/**
 * MSW Handlers for Plot API Tests
 *
 * Mock Service Worker handlers for intercepting plot API requests during tests.
 * Provides configurable responses for different test scenarios.
 *
 * Endpoints covered:
 * - POST /api/plot/create - Plot creation
 * - GET /api/plot/data/[token] - Plot data retrieval
 *
 * Usage:
 * ```typescript
 * import { server, handlers, createPlotDataResponse } from './handlers';
 *
 * beforeAll(() => server.listen());
 * afterEach(() => server.resetHandlers());
 * afterAll(() => server.close());
 *
 * // Override for specific test
 * server.use(handlers.createPlotError({ status: 401 }));
 * ```
 */

import { http, HttpResponse, delay } from 'msw';
import { setupServer } from 'msw/node';
import type { LogEntry, FieldDefinition } from '../fixtures/mockData';
import type { DataTypeConfig, ScaleOption, PlotConfig, ProjectConfig } from '../fixtures/configs';
import { createMockLogs, createMockFields } from '../fixtures/mockData';

// =============================================================================
// Types
// =============================================================================

export interface CreatePlotRequest {
  plotConfig?: {
    type?: string;
    xAxis: string;
    yAxis?: string;
    groupBy?: string;
    aggregate?: string;
    scaleX?: string;
    scaleY?: string;
    metric?: string;
    binCount?: number;
    showRegression?: boolean;
    colors?: Record<string, string>;
    sortBy?: string;
    sortOrder?: string;
    title?: string;
  };
  description?: string;
  projectConfig: {
    projectName: string;
    filterExpr?: string;
    limit?: number;
    offset?: number;
    groupBy?: string[];
    sorting?: string;
  };
  title?: string;
}

export interface CreatePlotResponse {
  url: string;
  token: string;
  inferred_config?: {
    type: string;
    xAxis: string;
    yAxis?: string;
    groupBy?: string;
    confidence: number;
    reasoning: string;
  };
}

export interface PlotDataResponse {
  config: {
    type: string;
    xAxis: string;
    yAxis?: string;
    groupBy?: string;
    aggregate?: string;
    scaleX: string;
    scaleY: string;
    metric: string;
    binCount: number;
    showRegression: boolean;
    sortBy?: string;
    sortOrder?: string;
    title?: string;
    xLabel?: string;
    yLabel?: string;
    colors?: Record<string, string>;
  };
  data: Record<string, unknown>[];
  fields: Record<string, unknown>;
  metadata: {
    token: string;
    title?: string;
    projectName: string;
    createdAt: string;
    createdBy: string;
  };
  preAggregatedBarData?: [string, number][] | [string, [string, number]][];
  isGroupedBarChart?: boolean;
}

// =============================================================================
// Response Factories
// =============================================================================

let tokenCounter = 0;

/**
 * Generate a unique test token
 */
export function generateTestToken(): string {
  tokenCounter++;
  return `test${String(tokenCounter).padStart(8, '0')}`;
}

/**
 * Create a successful plot creation response
 */
export function createPlotCreateResponse(
  options: Partial<CreatePlotResponse> = {}
): CreatePlotResponse {
  const token = options.token ?? generateTestToken();
  return {
    url: `http://localhost:3000/plot/view/${token}`,
    token,
    ...options,
  };
}

/**
 * Create a plot data response from mock data
 */
export function createPlotDataResponse(
  plotConfig: PlotConfig,
  dataTypeConfig: DataTypeConfig,
  scale: ScaleOption,
  options: {
    projectName?: string;
    title?: string;
    includeNulls?: boolean;
    includeEdgeCases?: boolean;
  } = {}
): PlotDataResponse {
  const logs = createMockLogs({
    dataTypeConfig,
    scale,
    includeNulls: options.includeNulls,
    includeEdgeCases: options.includeEdgeCases,
  });

  const fields = createMockFields(dataTypeConfig);

  // Transform logs to frontend format
  // LogEntry has 'table1.entries' with the actual data
  const transformedLogs = logs.map((log) => ({
    type: 'ungrouped',
    id: log.id,
    ts: log.timestamp,
    'table1.id': log['table1.id'],
    'table1.ts': log.timestamp,
    // Spread entries with table1. prefix (for PlotCanvas compatibility)
    ...Object.fromEntries(
      Object.entries(log['table1.entries']).map(([key, value]) => [key, value])
    ),
    'table1.entries': log['table1.entries'],
    // Also include 'entries' for API test compatibility (real API returns this)
    entries: log['table1.entries'],
    params: {},
  }));

  // Fields are already in the correct format (Record<string, {...}>)
  const transformedFields: Record<string, unknown> = {};
  for (const [path, fieldDef] of Object.entries(fields)) {
    transformedFields[path] = {
      type: fieldDef.dataType,
      displayType: fieldDef.dataType,
      count: 100,
    };
  }

  return {
    config: {
      type: plotConfig.type,
      xAxis: plotConfig.xAxis,
      yAxis: plotConfig.yAxis,
      groupBy: plotConfig.groupBy,
      aggregate: plotConfig.aggregate,
      scaleX: plotConfig.scaleX,
      scaleY: plotConfig.scaleY,
      metric: 'mean',
      binCount: plotConfig.binCount,
      showRegression: plotConfig.showRegression,
      sortBy: plotConfig.sortBy,
      sortOrder: plotConfig.sortOrder,
    },
    data: transformedLogs,
    fields: transformedFields,
    metadata: {
      token: generateTestToken(),
      title: options.title,
      projectName: options.projectName ?? 'test-project',
      createdAt: new Date().toISOString(),
      createdBy: 'test-user',
    },
  };
}

// =============================================================================
// Handler Factories
// =============================================================================

export interface HandlerConfig {
  /** Response delay in ms (default: 0) */
  delay?: number;
  /** Token for plot data requests */
  token?: string;
}

/**
 * Create plot creation success handler
 */
export function createPlotSuccessHandler(
  response?: Partial<CreatePlotResponse>,
  config?: HandlerConfig
) {
  return http.post('/api/plot/create', async ({ request }) => {
    if (config?.delay) {
      await delay(config.delay);
    }

    // Validate auth header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    // Parse body and validate
    const body = (await request.json()) as CreatePlotRequest;

    if (!body.projectConfig?.projectName) {
      return HttpResponse.json({ error: 'Missing projectConfig.projectName' }, { status: 400 });
    }

    if (!body.plotConfig && !body.description) {
      return HttpResponse.json(
        { error: 'Either plotConfig or description is required' },
        { status: 400 }
      );
    }

    return HttpResponse.json(createPlotCreateResponse(response), { status: 201 });
  });
}

/**
 * Create plot creation error handler
 */
export function createPlotErrorHandler(
  error: { status: number; message?: string },
  config?: HandlerConfig
) {
  return http.post('/api/plot/create', async () => {
    if (config?.delay) {
      await delay(config.delay);
    }

    return HttpResponse.json(
      { error: error.message ?? 'Plot creation failed' },
      { status: error.status }
    );
  });
}

/**
 * Create plot data success handler
 */
export function getPlotDataSuccessHandler(response: PlotDataResponse, config?: HandlerConfig) {
  const tokenPattern = config?.token ?? ':token';
  return http.get(`/api/plot/data/${tokenPattern}`, async ({ params }) => {
    if (config?.delay) {
      await delay(config.delay);
    }

    const token = params.token as string;

    // Validate token format
    if (token && !/^[a-f0-9]{12}$|^test\d{8}$/.test(token)) {
      return HttpResponse.json({ error: 'Invalid token format' }, { status: 400 });
    }

    return HttpResponse.json(response);
  });
}

/**
 * Create plot data error handler
 */
export function getPlotDataErrorHandler(
  error: { status: number; message?: string; expired?: boolean },
  config?: HandlerConfig
) {
  const tokenPattern = config?.token ?? ':token';
  return http.get(`/api/plot/data/${tokenPattern}`, async () => {
    if (config?.delay) {
      await delay(config.delay);
    }

    return HttpResponse.json(
      { error: error.message ?? 'Failed to load plot', expired: error.expired },
      { status: error.status }
    );
  });
}

// =============================================================================
// Default Handlers
// =============================================================================

const defaultPlotConfig: PlotConfig = {
  type: 'scatter',
  xAxis: 'table1.x_value',
  yAxis: 'table1.y_value',
  scaleX: 'linear',
  scaleY: 'linear',
  showRegression: false,
  binCount: 10,
};

const defaultDataTypeConfig: DataTypeConfig = {
  xAxisType: 'float',
  yAxisType: 'float',
  groupByType: 'str',
};

const defaultScale: ScaleOption = {
  name: 'small',
  count: 100,
  skip: false,
  timeout: 5000,
};

export const defaultHandlers = [
  createPlotSuccessHandler(),
  getPlotDataSuccessHandler(
    createPlotDataResponse(defaultPlotConfig, defaultDataTypeConfig, defaultScale)
  ),
];

// =============================================================================
// Test Server Setup
// =============================================================================

export const server = setupServer(...defaultHandlers);

// =============================================================================
// Handler Utilities Object
// =============================================================================

export const handlers = {
  /** Create plot - success */
  createPlotSuccess: createPlotSuccessHandler,

  /** Create plot - error */
  createPlotError: createPlotErrorHandler,

  /** Get plot data - success */
  getPlotDataSuccess: getPlotDataSuccessHandler,

  /** Get plot data - error */
  getPlotDataError: getPlotDataErrorHandler,

  /** Reset to default handlers */
  reset: () => server.resetHandlers(),

  /** Override with custom handlers */
  use: (...customHandlers: ReturnType<typeof http.get | typeof http.post>[]) =>
    server.use(...customHandlers),
};

// =============================================================================
// Test Helper Functions
// =============================================================================

export interface MatrixTestSetup {
  response: PlotDataResponse;
  metadata: PlotDataResponse['metadata'];
  logs: LogEntry[];
  fields: Record<
    string,
    {
      dataType: string;
      fieldType: 'entry' | 'param' | 'derived_entry';
      artifacts: string;
      mutable: 'true' | 'false';
      createdAt: string;
      description?: string;
    }
  >;
}

/**
 * Set up handlers for a specific matrix test combination
 * Returns the response plus the original mock data for validation
 */
export function setupMatrixTestHandlers(
  plotConfig: PlotConfig,
  dataTypeConfig: DataTypeConfig,
  scale: ScaleOption,
  options?: {
    projectName?: string;
    includeNulls?: boolean;
    includeEdgeCases?: boolean;
  }
): MatrixTestSetup {
  const logs = createMockLogs({
    dataTypeConfig,
    scale,
    includeNulls: options?.includeNulls,
    includeEdgeCases: options?.includeEdgeCases,
  });

  const fields = createMockFields(dataTypeConfig);

  const response = createPlotDataResponse(plotConfig, dataTypeConfig, scale, options);

  server.use(
    createPlotSuccessHandler({ token: response.metadata.token }),
    getPlotDataSuccessHandler(response)
  );

  return {
    response,
    metadata: response.metadata,
    logs,
    fields,
  };
}

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
        createPlotErrorHandler({ status: 401, message: 'Invalid API key' }),
        getPlotDataErrorHandler({ status: 401, message: 'Unauthorized' }),
      ];

    case 'validation-error':
      return [
        createPlotErrorHandler({ status: 400, message: 'Invalid request' }),
        getPlotDataErrorHandler({
          status: 400,
          message: 'Invalid token format',
        }),
      ];

    case 'not-found':
      return [
        getPlotDataErrorHandler({
          status: 404,
          message: 'Plot not found',
          expired: false,
        }),
      ];

    case 'expired':
      return [
        getPlotDataErrorHandler({
          status: 404,
          message: 'Plot not found or expired',
          expired: true,
        }),
      ];

    case 'server-error':
      return [
        createPlotErrorHandler({ status: 500, message: 'Internal server error' }),
        getPlotDataErrorHandler({
          status: 500,
          message: 'Failed to load plot',
        }),
      ];

    default:
      return defaultHandlers;
  }
}
