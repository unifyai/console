/**
 * Plot API Matrix Tests
 *
 * Comprehensive matrix tests covering all combinations of:
 * - Plot types: scatter, bar, histogram, line
 * - Plot configs: All valid combinations from configs.ts
 * - Project configs: Combinations of limit, filterExpr, groupBy, sorting
 * - Data types: All combinations from dataTypeOptions
 * - Scales: small (100), medium (1000), large (10000)
 *
 * Run with sharding for parallel execution:
 *   npm run test:node:parallel 8 src/tests/plot/api/
 *
 * Configuration:
 * - PLOT_TEST_SAMPLE_RATE: 1-100, controls config sampling (default: 100)
 * - PLOT_TEST_SCALE: 'small' | 'medium' | 'large' | 'all' (default: 'small')
 * - PLOT_TEST_API_REAL: Use real backend (default: true)
 */

import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import { server } from './handlers';
import { defineNodeMatrixTests } from '@/tests/utils/matrixTestRunnerNode';
import {
  PLOT_TEST_API_REAL,
  createTestProject,
  deleteTestProject,
  seedTestProjectData,
  createPlotRequest,
  getPlotDataRequest,
  assertConfigCorrectness,
  assertDataCorrectness,
  assertDataPreprocessing,
  assertFieldsCorrectness,
  assertMetadataCorrectness,
  buildApiTestMatrix,
  getMockResponse,
  generateTestAliasWithProject,
  ApiMatrixTestContext,
} from './_api-helpers';

// =============================================================================
// Setup/Teardown
// =============================================================================

beforeAll(async () => {
  if (PLOT_TEST_API_REAL) {
    await createTestProject();
    await seedTestProjectData(200);
  } else {
    server.listen({ onUnhandledRequest: 'error' });
  }
}, 30000); // 30s timeout for real API setup

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
// Matrix Tests
// =============================================================================

defineNodeMatrixTests<ApiMatrixTestContext>({
  name: 'Plot API - Matrix Tests',
  concurrent: true,

  getMatrix: buildApiTestMatrix,

  getConfigAlias: (ctx) =>
    generateTestAliasWithProject(
      'api',
      ctx.scaleAdjustedProjectConfig,
      ctx.adjustedPlotConfig,
      ctx.dataTypeConfig,
      ctx.scale
    ),

  defineTests: (ctx, { it, expect }) => {
    // Single test with all assertions to minimize API calls and test overhead
    it('validates config, data, preprocessing, fields, and metadata', async () => {
      if (PLOT_TEST_API_REAL) {
        // Real API: single API call for all assertions
        const createResponse = await createPlotRequest({
          projectConfig: ctx.scaleAdjustedProjectConfig,
          plotConfig: {
            type: ctx.adjustedPlotConfig.type,
            xAxis: ctx.adjustedPlotConfig.xAxis,
            yAxis: ctx.adjustedPlotConfig.yAxis,
            scaleX: ctx.adjustedPlotConfig.scaleX,
            scaleY: ctx.adjustedPlotConfig.scaleY,
            aggregate: ctx.adjustedPlotConfig.aggregate,
            groupBy: ctx.adjustedPlotConfig.groupBy,
            showRegression: ctx.adjustedPlotConfig.showRegression,
            sortBy: ctx.adjustedPlotConfig.sortBy,
            sortOrder: ctx.adjustedPlotConfig.sortOrder,
            binCount: ctx.adjustedPlotConfig.binCount,
          },
        });
        if (createResponse.status !== 201) {
          console.error(`[Matrix Test] Plot creation failed:`, createResponse.data);
        }
        expect(createResponse.status).toBe(201);

        const result = await getPlotDataRequest(createResponse.data.token);
        if (result.status !== 200) {
          console.error(
            `[Matrix Test] Get plot data failed for token ${createResponse.data.token}:`,
            result.data
          );
        }
        expect(result.status).toBe(200);

        // Debug logging
        if (process.env.PLOT_TEST_MATRIX_DEBUG === 'true') {
          if (result.data?.data?.[0]) {
            console.log(
              '[Matrix Test] First data entry:',
              JSON.stringify(result.data.data[0], null, 2)
            );
          }
          console.log('[Matrix Test] Fields keys:', Object.keys(result.data.fields || {}));
        }

        // All assertions on the same response
        assertConfigCorrectness(result.data.config, ctx.adjustedPlotConfig);
        assertDataCorrectness(
          result.data.data,
          ctx.adjustedPlotConfig,
          ctx.dataTypeConfig,
          ctx.scale,
          undefined,
          ctx.scaleAdjustedProjectConfig
        );
        assertDataPreprocessing(
          result.data.data,
          ctx.adjustedPlotConfig,
          ctx.dataTypeConfig,
          ctx.scaleAdjustedProjectConfig
        );
        assertFieldsCorrectness(result.data.fields, ctx.dataTypeConfig);
        assertMetadataCorrectness(result.data.metadata, ctx.scaleAdjustedProjectConfig.projectName);
      } else {
        // Mocked: single mock setup for all assertions
        const mockSetup = getMockResponse(ctx);

        assertConfigCorrectness(mockSetup.response.config, ctx.adjustedPlotConfig);
        assertDataCorrectness(
          mockSetup.response.data,
          ctx.adjustedPlotConfig,
          ctx.dataTypeConfig,
          ctx.scale,
          mockSetup.logs,
          ctx.scaleAdjustedProjectConfig
        );
        assertDataPreprocessing(
          mockSetup.response.data,
          ctx.adjustedPlotConfig,
          ctx.dataTypeConfig,
          ctx.scaleAdjustedProjectConfig
        );
        assertFieldsCorrectness(mockSetup.response.fields, ctx.dataTypeConfig);
        assertMetadataCorrectness(
          mockSetup.response.metadata,
          ctx.scaleAdjustedProjectConfig.projectName
        );
      }
    }, ctx.scale.timeout);
  },
});

