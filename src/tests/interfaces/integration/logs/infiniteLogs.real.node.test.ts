/**
 * Real API tests for infinite logs pagination functionality.
 *
 * These tests hit the actual Orchestra API to verify log pagination works correctly.
 * Run with: npm run test:integration:real
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { fetchLogsCore, type CoreLogFetchParams } from '@/utils/interfaces/logsCore';
import type { LogsActions } from '@/types/interfaces/grid';
import { getLogs, createLogs, deleteLogs } from '@/lib/interfaces/logs';
import {
  projectsApi,
  uniqueName,
  safeDelete,
  realTestOptionsExtended,
} from '@/tests/interfaces/api/fixtures/api-actions';

// Test configuration
const TEST_API_KEY = process.env.VITE_TEST_API_KEY || '';
const TEST_HEADERS = { apiKey: TEST_API_KEY };

describe('@real Infinite Logs Pagination (Real API)', () => {
  let testProjectName: string;
  let createdLogIds: number[] = [];

  beforeAll(async () => {
    if (!TEST_API_KEY) {
      throw new Error('VITE_TEST_API_KEY is not set');
    }

    // Create a test project
    testProjectName = uniqueName('test-infinite-logs');
    await projectsApi.create(testProjectName);

    // Create multiple test logs for pagination testing
    const createLogsFn = await createLogs(TEST_API_KEY);
    const logs = Array.from({ length: 15 }, (_, i) => ({
      message: `Test log ${i + 1}`,
      index: String(i + 1),
    }));

    const result = await createLogsFn(testProjectName, null, [], logs);

    if (result.ids) {
      createdLogIds = result.ids;
    }
  }, 45000);

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

  it('@real fetches first page with correct limit', realTestOptionsExtended, async () => {
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
      limit: 5,
      offset: 0,
      groupLimit: 5,
      groupOffset: 0,
      logsActions,
      headers: TEST_HEADERS,
    };

    const result = await fetchLogsCore(params);

    // Should return at most 5 logs
    expect(result.currentCount).toBeLessThanOrEqual(5);
    expect(result.effectiveLimit).toBe(5);
    expect(result.effectiveOffset).toBe(0);

    // If we have more than 5 total logs, hasMore should be true
    if (result.totalCount > 5) {
      expect(result.hasMore).toBe(true);
    }
  });

  it('@real fetches second page with correct offset', realTestOptionsExtended, async () => {
    const getLogsFn = await getLogs(TEST_API_KEY);

    const logsActions = {
      create: async () => ({ detail: 'not-used' }),
      get: getLogsFn,
      getLatest: async () => '',
      getMetrics: async () => ({}),
      delete: async () => ({ detail: 'not-used' }),
      update: async () => ({ detail: 'not-used' }),
    } as unknown as LogsActions;

    // Fetch first page
    const firstPageParams: CoreLogFetchParams = {
      projectId: testProjectName,
      context: null,
      columnContext: null,
      filterExpression: null,
      sortingExpression: null,
      groupingExpression: null,
      groupSortingExpression: null,
      limit: 5,
      offset: 0,
      groupLimit: 5,
      groupOffset: 0,
      logsActions,
      headers: TEST_HEADERS,
    };

    const firstPage = await fetchLogsCore(firstPageParams);

    // Skip if not enough logs for pagination
    if (firstPage.totalCount <= 5) {
      return;
    }

    // Fetch second page
    const secondPageParams: CoreLogFetchParams = {
      ...firstPageParams,
      offset: 5,
    };

    const secondPage = await fetchLogsCore(secondPageParams);

    expect(secondPage.effectiveOffset).toBe(5);

    // Second page should have different logs
    if (firstPage.convertedLogs.length > 0 && secondPage.convertedLogs.length > 0) {
      const firstPageIds = firstPage.convertedLogs.map((l) => l.id);
      const secondPageIds = secondPage.convertedLogs.map((l) => l.id);

      // No overlap between pages
      const overlap = firstPageIds.filter((id) => secondPageIds.includes(id));
      expect(overlap.length).toBe(0);
    }
  });

  it('@real handles fetching beyond available logs', realTestOptionsExtended, async () => {
    const getLogsFn = await getLogs(TEST_API_KEY);

    const logsActions = {
      create: async () => ({ detail: 'not-used' }),
      get: getLogsFn,
      getLatest: async () => '',
      getMetrics: async () => ({}),
      delete: async () => ({ detail: 'not-used' }),
      update: async () => ({ detail: 'not-used' }),
    } as unknown as LogsActions;

    // Fetch with high offset
    const params: CoreLogFetchParams = {
      projectId: testProjectName,
      context: null,
      columnContext: null,
      filterExpression: null,
      sortingExpression: null,
      groupingExpression: null,
      groupSortingExpression: null,
      limit: 10,
      offset: 1000,
      groupLimit: 10,
      groupOffset: 0,
      logsActions,
      headers: TEST_HEADERS,
    };

    const result = await fetchLogsCore(params);

    // Should return no actual logs when offset is beyond total
    expect(result.convertedLogs.length).toBe(0);
    expect(result.hasMore).toBe(false);
  });

  it('@real totalCount remains consistent across pages', realTestOptionsExtended, async () => {
    const getLogsFn = await getLogs(TEST_API_KEY);

    const logsActions = {
      create: async () => ({ detail: 'not-used' }),
      get: getLogsFn,
      getLatest: async () => '',
      getMetrics: async () => ({}),
      delete: async () => ({ detail: 'not-used' }),
      update: async () => ({ detail: 'not-used' }),
    } as unknown as LogsActions;

    // Fetch first page
    const firstParams: CoreLogFetchParams = {
      projectId: testProjectName,
      context: null,
      columnContext: null,
      filterExpression: null,
      sortingExpression: null,
      groupingExpression: null,
      groupSortingExpression: null,
      limit: 3,
      offset: 0,
      groupLimit: 3,
      groupOffset: 0,
      logsActions,
      headers: TEST_HEADERS,
    };

    const firstResult = await fetchLogsCore(firstParams);
    const totalFromFirst = firstResult.totalCount;

    // Skip if not enough logs
    if (totalFromFirst <= 3) {
      return;
    }

    // Fetch second page
    const secondParams: CoreLogFetchParams = {
      ...firstParams,
      offset: 3,
    };

    const secondResult = await fetchLogsCore(secondParams);

    // Total count should be the same across pages
    expect(secondResult.totalCount).toBe(totalFromFirst);
  });
});
