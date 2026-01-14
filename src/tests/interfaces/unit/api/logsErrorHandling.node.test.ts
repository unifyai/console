/**
 * Tests for error handling in logs API functions
 *
 * Covers:
 * - 404 handling for missing/deleted contexts
 * - Network error handling
 * - Graceful degradation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Logs API Error Handling', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  describe('getLogFields - 404 handling', () => {
    it('should return empty object when context returns 404', async () => {
      // Mock fetch to return 404
      global.fetch = vi.fn().mockResolvedValue({
        status: 404,
        ok: false,
        json: () => Promise.resolve({ detail: 'Context not found' }),
      });

      // Import dynamically to get fresh module with mocked fetch
      const { getLogFields } = await import('@/lib/interfaces/logs');
      const getFields = await getLogFields('test-api-key');
      const result = await getFields('test-project', 'deleted-context');

      expect(result).toEqual({});
    });

    it('should return empty object on network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const { getLogFields } = await import('@/lib/interfaces/logs');
      const getFields = await getLogFields('test-api-key');
      const result = await getFields('test-project', 'any-context');

      expect(result).toEqual({});
    });

    it('should return empty object on non-200 response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 500,
        ok: false,
        json: () => Promise.resolve({ detail: 'Internal server error' }),
      });

      const { getLogFields } = await import('@/lib/interfaces/logs');
      const getFields = await getLogFields('test-api-key');
      const result = await getFields('test-project', 'any-context');

      expect(result).toEqual({});
    });

    it('should return fields on successful response', async () => {
      const mockFields = {
        field1: { dataType: 'str', fieldType: 'entry' },
        field2: { dataType: 'int', fieldType: 'entry' },
      };

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: () => Promise.resolve(mockFields),
      });

      const { getLogFields } = await import('@/lib/interfaces/logs');
      const getFields = await getLogFields('test-api-key');
      const result = await getFields('test-project', 'valid-context');

      expect(result).toEqual(mockFields);
    });
  });

  describe('getLogs - 404 handling', () => {
    it('should return empty logs array when context returns 404', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 404,
        ok: false,
        json: () => Promise.resolve({ detail: 'Context not found' }),
      });

      const { getLogs } = await import('@/lib/interfaces/logs');
      const getLogsFunc = await getLogs('test-api-key');
      const result = await getLogsFunc(
        'test-project',
        'deleted-context',
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        20,
        0,
        null,
        null,
        null,
        null,
        null,
        null
      );

      expect(result).toEqual({
        logs: [],
        count: 0,
        groups: [],
        contextNotFound: true,
      });
    });

    it('should return empty logs on network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const { getLogs } = await import('@/lib/interfaces/logs');
      const getLogsFunc = await getLogs('test-api-key');
      const result = await getLogsFunc(
        'test-project',
        'any-context',
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        20,
        0,
        null,
        null,
        null,
        null,
        null,
        null
      );

      expect(result).toEqual({
        logs: [],
        count: 0,
        groups: [],
      });
    });

    it('should return logs on successful response', async () => {
      const mockLogs = {
        params: { param1: 'value1' },
        logs: [{ id: 1, entries: { field1: 'data' } }],
        count: 1,
        groups: [],
      };

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: () => Promise.resolve(mockLogs),
      });

      const { getLogs } = await import('@/lib/interfaces/logs');
      const getLogsFunc = await getLogs('test-api-key');
      const result = await getLogsFunc(
        'test-project',
        'valid-context',
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        20,
        0,
        null,
        null,
        null,
        null,
        null,
        null
      );

      expect(result).toEqual(mockLogs);
    });
  });
});
