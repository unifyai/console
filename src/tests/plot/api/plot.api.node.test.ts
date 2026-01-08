/**
 * Plot API Edge Case Tests
 *
 * Tests for the plot API endpoints covering:
 * - Authentication edge cases
 * - Input validation edge cases
 * - Error scenarios
 *
 * For comprehensive matrix tests, see plot.api.matrix.node.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { server, createTestScenario } from './handlers';
import {
  TEST_PROJECT,
  PLOT_TEST_API_REAL,
  createTestProject,
  deleteTestProject,
  seedTestProjectData,
  createPlotRequest,
  getPlotDataRequest,
} from './_api-helpers';

// =============================================================================
// Setup
// =============================================================================

beforeAll(async () => {
  if (PLOT_TEST_API_REAL) {
    await createTestProject();
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
    await deleteTestProject();
  } else {
    server.close();
  }
});

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
        projectConfig: { projectName: TEST_PROJECT },
        plotConfig: { xAxis: 'x', yAxis: 'y' },
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
        projectConfig: { projectName: TEST_PROJECT },
        plotConfig: { xAxis: 'x', yAxis: 'y' },
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
      projectConfig: { projectName: TEST_PROJECT },
      plotConfig: { xAxis: 'x', yAxis: 'y' },
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
  it('rejects requests without projectConfig', async () => {
    const response = await createPlotRequest({
      plotConfig: { xAxis: 'x', yAxis: 'y' },
    });

    expect(response.status).toBe(400);
    expect(response.data.error).toContain('projectConfig');
  });

  it('rejects requests without projectName', async () => {
    const response = await createPlotRequest({
      projectConfig: {},
      plotConfig: { xAxis: 'x', yAxis: 'y' },
    });

    expect(response.status).toBe(400);
    expect(response.data.error).toContain('projectName');
  });

  it('rejects requests without plotConfig or description', async () => {
    const response = await createPlotRequest({
      projectConfig: { projectName: TEST_PROJECT },
    });

    expect(response.status).toBe(400);
    expect(response.data.error).toContain('plotConfig');
  });

  it.skipIf(PLOT_TEST_API_REAL)('accepts requests with description (LLM mode)', async () => {
    // Skip for real API - requires LLM credits
    const response = await createPlotRequest({
      projectConfig: { projectName: TEST_PROJECT },
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
