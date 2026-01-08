/**
 * Real API tests for logsCore fetchLogsCore function.
 *
 * These tests hit the actual Orchestra API to verify log fetching works correctly.
 * Run with: npm run test:integration:real
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { fetchLogsCore, type CoreLogFetchParams } from '@/utils/interfaces/logsCore';
import type { LogsActions } from '@/types/interfaces/grid';
import type { LogProps } from '@/types/interfaces/logs';
import { getLogs, createLogs, deleteLogs } from '@/lib/interfaces/logs';
import {
  projectsApi,
  uniqueName,
  safeDelete,
  realTestOptions,
  realTestOptionsExtended,
} from '@/tests/interfaces/api/fixtures/api-actions';

// Test configuration
const TEST_API_KEY = process.env.VITE_TEST_API_KEY || '';

describe('@real logsCore + getLogs (Real API)', () => {
  let testProjectName: string;
  let createdLogIds: number[] = [];

  beforeAll(async () => {
    if (!TEST_API_KEY) {
      throw new Error('VITE_TEST_API_KEY is not set');
    }

    // Create a test project
    testProjectName = uniqueName('test-logscore');
    await projectsApi.create(testProjectName);

    // Create some test logs
    const createLogsFn = await createLogs(TEST_API_KEY);
    const result = await createLogsFn(
      testProjectName,
      null, // context
      [], // params
      [
        { message: 'Test log 1', level: 'info' },
        { message: 'Test log 2', level: 'warn' },
        { message: 'Test log 3', level: 'error' },
        { message: 'Test log 4', level: 'info' },
        { message: 'Test log 5', level: 'debug' },
      ]
    );

    if (result.ids) {
      createdLogIds = result.ids;
    }
  }, 30000);

  afterAll(async () => {
    // Cleanup logs
    if (createdLogIds.length > 0) {
      try {
        const deleteLogsFn = await deleteLogs(TEST_API_KEY);
        await deleteLogsFn(
          testProjectName,
          null,
          createdLogIds.map((id) => [id, ''] as [number, string])
        );
      } catch {
        // Ignore cleanup errors
      }
    }

    // Cleanup project
    await safeDelete(() => projectsApi.delete(testProjectName), `project: ${testProjectName}`);
  }, 30000);

  it(
    '@real fetchLogsCore fetches real logs and returns correct metadata',
    realTestOptionsExtended,
    async () => {
      const getLogsFn = await getLogs(TEST_API_KEY);

      const logsActions = {
        create: async () => ({ detail: 'not-used' }),
        get: getLogsFn,
        getLatest: async () => '',
        getMetrics: async () => ({}),
        delete: async () => ({ detail: 'not-used' }),
        update: async () => ({ detail: 'not-used' }),
      } as unknown as LogsActions;

      const params: CoreLogFetchParams = {
        projectId: testProjectName,
        context: null,
        columnContext: null,
        filterExpression: null,
        sortingExpression: null,
        groupingExpression: null,
        groupSortingExpression: null,
        limit: 20,
        offset: 0,
        groupLimit: 20,
        groupOffset: 0,
        logsActions,
        headers: { apiKey: TEST_API_KEY },
      };

      const result = await fetchLogsCore(params);

      // Should have fetched real logs
      expect(result.response).toBeDefined();
      expect(result.response.count).toBeGreaterThanOrEqual(0);
      expect(result.totalCount).toBeGreaterThanOrEqual(0);
      expect(result.useGroupPagination).toBe(false);
      expect(result.effectiveLimit).toBe(20);
      expect(result.effectiveOffset).toBe(0);

      // If we have logs, verify they have the correct structure
      if (result.convertedLogs.length > 0) {
        const first = result.convertedLogs[0] as LogProps;
        expect(first.type).toBe('ungrouped');
        expect(first.id).toBeDefined();
        expect(first.ts).toBeDefined();
      }
    }
  );

  it('@real fetchLogsCore handles pagination correctly', realTestOptionsExtended, async () => {
    const getLogsFn = await getLogs(TEST_API_KEY);

    const logsActions = {
      create: async () => ({ detail: 'not-used' }),
      get: getLogsFn,
      getLatest: async () => '',
      getMetrics: async () => ({}),
      delete: async () => ({ detail: 'not-used' }),
      update: async () => ({ detail: 'not-used' }),
    } as unknown as LogsActions;

    // First page with small limit
    const params: CoreLogFetchParams = {
      projectId: testProjectName,
      context: null,
      columnContext: null,
      filterExpression: null,
      sortingExpression: null,
      groupingExpression: null,
      groupSortingExpression: null,
      limit: 2,
      offset: 0,
      groupLimit: 20,
      groupOffset: 0,
      logsActions,
      headers: { apiKey: TEST_API_KEY },
    };

    const result = await fetchLogsCore(params);

    expect(result.effectiveLimit).toBe(2);
    expect(result.effectiveOffset).toBe(0);
    expect(result.currentCount).toBeLessThanOrEqual(2);

    // Check hasMore flag
    if (result.totalCount > 2) {
      expect(result.hasMore).toBe(true);
    }
  });

  it('@real fetchLogsCore handles empty project gracefully', realTestOptions, async () => {
    // Create an empty project
    const emptyProjectName = uniqueName('test-logscore-empty');
    await projectsApi.create(emptyProjectName);

    try {
      const getLogsFn = await getLogs(TEST_API_KEY);

      const logsActions = {
        create: async () => ({ detail: 'not-used' }),
        get: getLogsFn,
        getLatest: async () => '',
        getMetrics: async () => ({}),
        delete: async () => ({ detail: 'not-used' }),
        update: async () => ({ detail: 'not-used' }),
      } as unknown as LogsActions;

      const params: CoreLogFetchParams = {
        projectId: emptyProjectName,
        context: null,
        columnContext: null,
        filterExpression: null,
        sortingExpression: null,
        groupingExpression: null,
        groupSortingExpression: null,
        limit: 20,
        offset: 0,
        groupLimit: 20,
        groupOffset: 0,
        logsActions,
        headers: { apiKey: TEST_API_KEY },
      };

      const result = await fetchLogsCore(params);

      // Empty project should return no logs
      expect(result.response.count).toBe(0);
      expect(result.totalCount).toBe(0);
      expect(result.convertedLogs.length).toBe(0);
      expect(result.hasMore).toBe(false);
    } finally {
      await safeDelete(() => projectsApi.delete(emptyProjectName), `project: ${emptyProjectName}`);
    }
  });
});
