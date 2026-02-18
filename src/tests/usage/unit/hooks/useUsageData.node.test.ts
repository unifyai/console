/**
 * useUsageData Hook Tests
 *
 * Tests for the data fetching hook.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { useUsageData } from '@/hooks/Usage/useUsageData';
import { UsageActions } from '@/lib/usage/actions';
import { SAMPLE_WEEK_RESPONSE } from '@/tests/usage/mocks/data';

// Generic error message that the hook uses
const GENERIC_ERROR_MESSAGE = 'Unable to load usage data. Please try again later.';

// Set up MSW server
const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

/**
 * Create mock usage actions that call the real API endpoint
 */
function createMockUsageActions(): UsageActions {
  return {
    getMetrics: async (context, groupBy, filterExpr) => {
      const params = new URLSearchParams({
        projectName: 'Assistants',
        context,
        key: 'billed_cost',
        groupBy,
        filterExpr,
      });

      const response = await fetch(`http://localhost/api/logs/sum?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        return { detail: data.detail || 'Failed to fetch' };
      }

      return data;
    },
    getUserSpendingLimit: async () => ({ type: 'user', limit: 100, label: 'My Limit' }),
    getOrgSpendingLimit: async () => ({ type: 'org', limit: 500, label: 'Org Limit' }),
    getMemberSpendingLimit: async () => ({ type: 'member', limit: 200, label: 'Member Limit' }),
    getAssistantSpendingLimit: async () => ({
      type: 'assistant',
      limit: 50,
      label: 'Assistant Limit',
    }),
    setUserSpendingLimit: async () => ({ type: 'user', limit: 100, label: 'My Limit' }),
    setOrgSpendingLimit: async () => ({ type: 'org', limit: 500, label: 'Org Limit' }),
    setMemberSpendingLimit: async () => ({ type: 'member', limit: 200, label: 'Member Limit' }),
    setAssistantSpendingLimit: async () => ({
      type: 'assistant',
      limit: 50,
      label: 'Assistant Limit',
    }),
  };
}

describe('useUsageData', () => {
  const defaultProps = {
    usageActions: createMockUsageActions(),
    contextPath: 'TestUser/All/Events/LLM',
    granularity: 'time_day' as const,
    filterExpression: "event_timestamp >= '2026-01-13' and event_timestamp < '2026-01-20'",
    enabled: true,
  };

  describe('successful data fetching', () => {
    it('fetches and transforms data', async () => {
      server.use(
        http.get('*/api/logs/sum', () => {
          return HttpResponse.json(SAMPLE_WEEK_RESPONSE);
        })
      );

      const { result } = renderHook(() => useUsageData(defaultProps));

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toHaveLength(7);
      expect(result.current.error).toBeNull();
      expect(result.current.hasInitiallyLoaded).toBe(true);
    });

    it('provides raw data in response', async () => {
      server.use(
        http.get('*/api/logs/sum', () => {
          return HttpResponse.json(SAMPLE_WEEK_RESPONSE);
        })
      );

      const { result } = renderHook(() => useUsageData(defaultProps));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.rawData).toEqual(SAMPLE_WEEK_RESPONSE);
    });

    it('sorts data by timestamp', async () => {
      const unsortedResponse = {
        '2026-01-15': { sum: 2.0 },
        '2026-01-13': { sum: 1.0 },
        '2026-01-14': { sum: 1.5 },
      };

      server.use(
        http.get('*/api/logs/sum', () => {
          return HttpResponse.json(unsortedResponse);
        })
      );

      const { result } = renderHook(() => useUsageData(defaultProps));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data[0].timestamp).toBe('2026-01-13');
      expect(result.current.data[1].timestamp).toBe('2026-01-14');
      expect(result.current.data[2].timestamp).toBe('2026-01-15');
    });
  });

  describe('error handling', () => {
    it('shows generic error for API errors (obfuscates backend details)', async () => {
      server.use(
        http.get('*/api/logs/sum', () => {
          return HttpResponse.json(
            { detail: 'Internal database connection failed' },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(() => useUsageData(defaultProps));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should show generic error, not the actual backend error
      expect(result.current.error).toBe(GENERIC_ERROR_MESSAGE);
      expect(result.current.data).toEqual([]);
    });

    it('shows generic error for network errors', async () => {
      server.use(
        http.get('*/api/logs/sum', () => {
          return HttpResponse.error();
        })
      );

      const { result } = renderHook(() => useUsageData(defaultProps));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should show generic error for network errors too
      expect(result.current.error).toBe(GENERIC_ERROR_MESSAGE);
      expect(result.current.data).toEqual([]);
    });

    it('clears error on successful retry', async () => {
      let callCount = 0;

      server.use(
        http.get('*/api/logs/sum', () => {
          callCount++;
          if (callCount === 1) {
            return HttpResponse.json({ detail: 'First call fails' }, { status: 500 });
          }
          return HttpResponse.json(SAMPLE_WEEK_RESPONSE);
        })
      );

      const { result } = renderHook(() => useUsageData(defaultProps));

      await waitFor(() => {
        expect(result.current.error).toBe(GENERIC_ERROR_MESSAGE);
      });

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.data).toHaveLength(7);
    });
  });

  describe('enabled flag', () => {
    it('does not fetch when disabled', async () => {
      let fetchCount = 0;

      server.use(
        http.get('*/api/logs/sum', () => {
          fetchCount++;
          return HttpResponse.json(SAMPLE_WEEK_RESPONSE);
        })
      );

      const { result } = renderHook(() => useUsageData({ ...defaultProps, enabled: false }));

      // Wait a bit to ensure no fetch happens
      await new Promise((r) => setTimeout(r, 100));

      expect(fetchCount).toBe(0);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toEqual([]);
    });

    it('fetches when enabled changes to true', async () => {
      server.use(
        http.get('*/api/logs/sum', () => {
          return HttpResponse.json(SAMPLE_WEEK_RESPONSE);
        })
      );

      const { result, rerender } = renderHook(
        ({ enabled }) => useUsageData({ ...defaultProps, enabled }),
        { initialProps: { enabled: false } }
      );

      expect(result.current.data).toEqual([]);

      rerender({ enabled: true });

      await waitFor(() => {
        expect(result.current.data).toHaveLength(7);
      });
    });
  });

  describe('refetch', () => {
    it('allows manual refetch', async () => {
      let callCount = 0;

      server.use(
        http.get('*/api/logs/sum', () => {
          callCount++;
          return HttpResponse.json({
            '2026-01-15': { sum: callCount * 10 },
          });
        })
      );

      const { result } = renderHook(() => useUsageData(defaultProps));

      await waitFor(() => {
        expect(result.current.data).toHaveLength(1);
      });

      expect(result.current.data[0].billedCost).toBe(10);

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.data[0].billedCost).toBe(20);
    });

    it('sets loading state during refetch', async () => {
      server.use(
        http.get('*/api/logs/sum', async () => {
          await new Promise((r) => setTimeout(r, 50));
          return HttpResponse.json(SAMPLE_WEEK_RESPONSE);
        })
      );

      const { result } = renderHook(() => useUsageData(defaultProps));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.refetch();
      });

      // Loading should be true during refetch
      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('dependency changes', () => {
    it('refetches when contextPath changes', async () => {
      let capturedContext: string | null = null;

      server.use(
        http.get('*/api/logs/sum', ({ request }) => {
          const url = new URL(request.url);
          capturedContext = url.searchParams.get('context');
          return HttpResponse.json(SAMPLE_WEEK_RESPONSE);
        })
      );

      const { result, rerender } = renderHook(
        ({ contextPath }) => useUsageData({ ...defaultProps, contextPath }),
        { initialProps: { contextPath: 'UserA/All/Events/LLM' } }
      );

      await waitFor(() => {
        expect(capturedContext).toBe('UserA/All/Events/LLM');
      });

      rerender({ contextPath: 'UserB/All/Events/LLM' });

      await waitFor(() => {
        expect(capturedContext).toBe('UserB/All/Events/LLM');
      });
    });

    it('refetches when granularity changes', async () => {
      let capturedGroupBy: string | null = null;

      server.use(
        http.get('*/api/logs/sum', ({ request }) => {
          const url = new URL(request.url);
          capturedGroupBy = url.searchParams.get('groupBy');
          return HttpResponse.json(SAMPLE_WEEK_RESPONSE);
        })
      );

      const { rerender } = renderHook(
        (props: { granularity: 'time_day' | 'time_hour' }) =>
          useUsageData({ ...defaultProps, granularity: props.granularity }),
        { initialProps: { granularity: 'time_day' as 'time_day' | 'time_hour' } }
      );

      await waitFor(() => {
        expect(capturedGroupBy).toBe('time_day');
      });

      rerender({ granularity: 'time_hour' });

      await waitFor(() => {
        expect(capturedGroupBy).toBe('time_hour');
      });
    });
  });

  describe('empty data handling', () => {
    it('handles empty response', async () => {
      server.use(
        http.get('*/api/logs/sum', () => {
          return HttpResponse.json({});
        })
      );

      const { result } = renderHook(() => useUsageData(defaultProps));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });
});
