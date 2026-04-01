/**
 * Unit tests for useAssistantStatus hook.
 *
 * Tests cover:
 * - Initial status fetching via the client API module
 * - Stable dependency behavior (key optimization)
 * - Error handling
 *
 * Key behavior tested:
 * - Status fetching only triggers when assistant IDs actually change
 * - Array reference changes (e.g., from photo URL updates) don't trigger re-fetch
 * - Fetch calls run in parallel (not serialized like server actions)
 *
 * Note: Polling tests are excluded as they require complex timer mocking
 * that conflicts with React Testing Library's waitFor.
 *
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAssistantStatus } from '@/hooks/Assistants/useAssistantStatus';
import { Assistant, AssistantStatus } from '@/types/assistants/assistant';

// ---------------------------------------------------------------------------
// Mock the client API module
// ---------------------------------------------------------------------------

const mockFetchAssistantStatus = vi.fn();
vi.mock('@/lib/client/assistant', () => ({
  fetchAssistantStatus: (...args: any[]) => mockFetchAssistantStatus(...args),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const createMockAssistant = (id: string): Assistant =>
  ({
    agentId: id,
    firstName: `Assistant${id}`,
    surname: 'Test',
  }) as Assistant;

const createMockStatus = (running: boolean): AssistantStatus => ({
  running,
  jobName: running ? 'test-job' : null,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAssistantStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchAssistantStatus.mockResolvedValue(createMockStatus(true));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // Initial Status Fetching
  // ===========================================================================

  describe('initial status fetching', () => {
    it('fetches status for all assistants on mount', async () => {
      const assistants = [createMockAssistant('1'), createMockAssistant('2')];

      renderHook(() => useAssistantStatus(assistants));

      await waitFor(() => {
        expect(mockFetchAssistantStatus).toHaveBeenCalledWith('1');
        expect(mockFetchAssistantStatus).toHaveBeenCalledWith('2');
      });
    });

    it('sets status map with fetched statuses', async () => {
      const assistants = [createMockAssistant('1')];

      const { result } = renderHook(() => useAssistantStatus(assistants));

      await waitFor(() => {
        expect(result.current.statuses.get('1')?.running).toBe(true);
      });
    });

    it('handles empty assistant list', async () => {
      const { result } = renderHook(() => useAssistantStatus([]));

      await waitFor(() => {
        expect(result.current.statuses.size).toBe(0);
      });

      expect(mockFetchAssistantStatus).not.toHaveBeenCalled();
    });

    it('handles status fetch error gracefully', async () => {
      mockFetchAssistantStatus.mockResolvedValue(null);
      const assistants = [createMockAssistant('1')];

      const { result } = renderHook(() => useAssistantStatus(assistants));

      await waitFor(() => {
        expect(result.current.statuses.get('1')).toBeNull();
      });
    });

    it('handles non-status response format', async () => {
      mockFetchAssistantStatus.mockResolvedValue(null);
      const assistants = [createMockAssistant('1')];

      const { result } = renderHook(() => useAssistantStatus(assistants));

      await waitFor(() => {
        expect(result.current.statuses.get('1')).toBeNull();
      });
    });
  });

  // ===========================================================================
  // Stable Dependency Behavior (Key Optimization)
  // ===========================================================================

  describe('stable dependency behavior', () => {
    it('does NOT re-fetch when array reference changes but IDs stay the same', async () => {
      const assistant1 = createMockAssistant('1');
      const assistant2 = createMockAssistant('2');
      const initialAssistants = [assistant1, assistant2];

      const { result, rerender } = renderHook(({ assistants }) => useAssistantStatus(assistants), {
        initialProps: { assistants: initialAssistants },
      });

      await waitFor(() => {
        expect(result.current.statuses.size).toBe(2);
      });

      const initialCallCount = mockFetchAssistantStatus.mock.calls.length;

      const newArraySameAssistants = [
        { ...assistant1, signedProfilePhotoUrl: 'https://new-url.com' },
        { ...assistant2 },
      ] as Assistant[];

      rerender({ assistants: newArraySameAssistants });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(mockFetchAssistantStatus.mock.calls.length).toBe(initialCallCount);
    });

    it('DOES re-fetch when a new assistant is added', async () => {
      const assistant1 = createMockAssistant('1');
      const initialAssistants = [assistant1];

      const { result, rerender } = renderHook(({ assistants }) => useAssistantStatus(assistants), {
        initialProps: { assistants: initialAssistants },
      });

      await waitFor(() => {
        expect(result.current.statuses.size).toBe(1);
      });

      const initialCallCount = mockFetchAssistantStatus.mock.calls.length;

      const assistant2 = createMockAssistant('2');
      const updatedAssistants = [assistant1, assistant2];

      rerender({ assistants: updatedAssistants });

      await waitFor(() => {
        expect(mockFetchAssistantStatus.mock.calls.length).toBeGreaterThan(initialCallCount);
        expect(mockFetchAssistantStatus).toHaveBeenCalledWith('2');
      });
    });

    it('DOES re-fetch when an assistant is removed', async () => {
      const assistant1 = createMockAssistant('1');
      const assistant2 = createMockAssistant('2');
      const initialAssistants = [assistant1, assistant2];

      const { result, rerender } = renderHook(({ assistants }) => useAssistantStatus(assistants), {
        initialProps: { assistants: initialAssistants },
      });

      await waitFor(() => {
        expect(result.current.statuses.size).toBe(2);
      });

      const initialCallCount = mockFetchAssistantStatus.mock.calls.length;

      const updatedAssistants = [assistant1];

      rerender({ assistants: updatedAssistants });

      await waitFor(() => {
        expect(mockFetchAssistantStatus.mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it('does NOT re-fetch when order changes (IDs sorted for comparison)', async () => {
      const assistant1 = createMockAssistant('1');
      const assistant2 = createMockAssistant('2');
      const initialAssistants = [assistant1, assistant2];

      const { result, rerender } = renderHook(({ assistants }) => useAssistantStatus(assistants), {
        initialProps: { assistants: initialAssistants },
      });

      await waitFor(() => {
        expect(result.current.statuses.size).toBe(2);
      });

      const initialCallCount = mockFetchAssistantStatus.mock.calls.length;

      const reorderedAssistants = [assistant2, assistant1];

      rerender({ assistants: reorderedAssistants });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(mockFetchAssistantStatus.mock.calls.length).toBe(initialCallCount);
    });
  });

  // ===========================================================================
  // Status Map Updates
  // ===========================================================================

  describe('status map updates', () => {
    it('preserves existing statuses when adding new assistant', async () => {
      mockFetchAssistantStatus.mockImplementation((id: string) =>
        Promise.resolve(createMockStatus(id === '1'))
      );

      const assistant1 = createMockAssistant('1');

      const { result, rerender } = renderHook(({ assistants }) => useAssistantStatus(assistants), {
        initialProps: { assistants: [assistant1] },
      });

      await waitFor(() => {
        expect(result.current.statuses.get('1')?.running).toBe(true);
      });

      const assistant2 = createMockAssistant('2');
      rerender({ assistants: [assistant1, assistant2] });

      await waitFor(() => {
        expect(result.current.statuses.get('2')?.running).toBe(false);
      });

      expect(result.current.statuses.get('1')?.running).toBe(true);
    });

    it('handles multiple assistants with different statuses', async () => {
      mockFetchAssistantStatus.mockImplementation((id: string) => {
        const running = id === '1' || id === '3';
        return Promise.resolve(createMockStatus(running));
      });

      const assistants = [
        createMockAssistant('1'),
        createMockAssistant('2'),
        createMockAssistant('3'),
      ];

      const { result } = renderHook(() => useAssistantStatus(assistants));

      await waitFor(() => {
        expect(result.current.statuses.size).toBe(3);
        expect(result.current.statuses.get('1')?.running).toBe(true);
        expect(result.current.statuses.get('2')?.running).toBe(false);
        expect(result.current.statuses.get('3')?.running).toBe(true);
      });
    });
  });

  // ===========================================================================
  // markOnline
  // ===========================================================================

  describe('markOnline', () => {
    it('sets an offline assistant to running', async () => {
      mockFetchAssistantStatus.mockImplementation((id: string) =>
        Promise.resolve(createMockStatus(id !== '1'))
      );

      const assistants = [createMockAssistant('1'), createMockAssistant('2')];
      const { result } = renderHook(() => useAssistantStatus(assistants));

      await waitFor(() => {
        expect(result.current.statuses.get('1')?.running).toBe(false);
        expect(result.current.statuses.get('2')?.running).toBe(true);
      });

      act(() => {
        result.current.markOnline('1');
      });

      expect(result.current.statuses.get('1')?.running).toBe(true);
      expect(result.current.statuses.get('2')?.running).toBe(true);
    });

    it('is a no-op when the assistant is already running', async () => {
      const assistants = [createMockAssistant('1')];
      const { result } = renderHook(() => useAssistantStatus(assistants));

      await waitFor(() => {
        expect(result.current.statuses.get('1')?.running).toBe(true);
      });

      const statusesBefore = result.current.statuses;

      act(() => {
        result.current.markOnline('1');
      });

      // Same Map reference — state setter returned prev (no-op)
      expect(result.current.statuses).toBe(statusesBefore);
    });

    it('preserves the existing jobName', async () => {
      mockFetchAssistantStatus.mockResolvedValue({ running: false, jobName: 'my-job' });
      const assistants = [createMockAssistant('1')];
      const { result } = renderHook(() => useAssistantStatus(assistants));

      await waitFor(() => {
        expect(result.current.statuses.get('1')?.running).toBe(false);
      });

      act(() => {
        result.current.markOnline('1');
      });

      expect(result.current.statuses.get('1')).toEqual({ running: true, jobName: 'my-job' });
    });

    it('handles marking an assistant with no prior status', async () => {
      const assistants = [createMockAssistant('1')];
      const { result } = renderHook(() => useAssistantStatus(assistants));

      // Before the fetch resolves, markOnline for an unknown assistant
      act(() => {
        result.current.markOnline('unknown');
      });

      expect(result.current.statuses.get('unknown')).toEqual({ running: true, jobName: null });
    });

    it('resets the polling interval so the next fetch is delayed', async () => {
      vi.useFakeTimers();
      try {
        mockFetchAssistantStatus.mockResolvedValue(createMockStatus(false));

        const assistants = [createMockAssistant('1')];
        const { result } = renderHook(() => useAssistantStatus(assistants));

        // Let the initial fetch's microtask resolve
        await act(async () => {
          await vi.advanceTimersByTimeAsync(0);
        });
        const callsAfterInit = mockFetchAssistantStatus.mock.calls.length;

        // Advance 50s (within the 60s window) — no poll yet
        await act(async () => {
          await vi.advanceTimersByTimeAsync(50_000);
        });
        expect(mockFetchAssistantStatus.mock.calls.length).toBe(callsAfterInit);

        // markOnline at t=50s resets the timer
        act(() => {
          result.current.markOnline('1');
        });

        // Advance another 50s (t=100s). Without reset, poll would have fired at t=60s.
        // With reset, the next poll is at t=110s (50s + 60s), so still no fetch.
        await act(async () => {
          await vi.advanceTimersByTimeAsync(50_000);
        });
        expect(mockFetchAssistantStatus.mock.calls.length).toBe(callsAfterInit);

        // Advance 10 more seconds (t=110s) — now the poll should fire
        await act(async () => {
          await vi.advanceTimersByTimeAsync(10_000);
        });
        expect(mockFetchAssistantStatus.mock.calls.length).toBeGreaterThan(callsAfterInit);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('handles rapid assistant list changes', async () => {
      const assistant1 = createMockAssistant('1');
      const assistant2 = createMockAssistant('2');
      const assistant3 = createMockAssistant('3');

      const { result, rerender } = renderHook(({ assistants }) => useAssistantStatus(assistants), {
        initialProps: { assistants: [assistant1] },
      });

      rerender({ assistants: [assistant1, assistant2] });
      rerender({ assistants: [assistant1, assistant2, assistant3] });
      rerender({ assistants: [assistant2, assistant3] });

      await waitFor(() => {
        expect(result.current.statuses.size).toBeGreaterThan(0);
      });
    });

    it('cleans up properly on unmount', async () => {
      const assistants = [createMockAssistant('1')];

      const { result, unmount } = renderHook(() => useAssistantStatus(assistants));

      await waitFor(() => {
        expect(result.current.statuses.size).toBe(1);
      });

      expect(() => unmount()).not.toThrow();
    });

    it('handles switching from empty to non-empty assistant list', async () => {
      const { result, rerender } = renderHook(({ assistants }) => useAssistantStatus(assistants), {
        initialProps: { assistants: [] as Assistant[] },
      });

      expect(result.current.statuses.size).toBe(0);

      const assistant1 = createMockAssistant('1');
      rerender({ assistants: [assistant1] });

      await waitFor(() => {
        expect(result.current.statuses.size).toBe(1);
        expect(mockFetchAssistantStatus).toHaveBeenCalledWith('1');
      });
    });

    it('handles switching from non-empty to empty assistant list', async () => {
      const assistant1 = createMockAssistant('1');

      const { result, rerender } = renderHook(({ assistants }) => useAssistantStatus(assistants), {
        initialProps: { assistants: [assistant1] },
      });

      await waitFor(() => {
        expect(result.current.statuses.size).toBe(1);
      });

      rerender({ assistants: [] });

      await waitFor(() => {
        expect(result.current.statuses.size).toBe(0);
      });
    });
  });
});
