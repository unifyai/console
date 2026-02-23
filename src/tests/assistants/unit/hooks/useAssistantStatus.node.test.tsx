/**
 * Unit tests for useAssistantStatus hook.
 *
 * Tests cover:
 * - Initial status fetching
 * - Stable dependency behavior (key optimization)
 * - Error handling
 *
 * Key behavior tested:
 * - Status fetching only triggers when assistant IDs actually change
 * - Array reference changes (e.g., from photo URL updates) don't trigger re-fetch
 *
 * Note: Polling tests are excluded as they require complex timer mocking
 * that conflicts with React Testing Library's waitFor.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAssistantStatus } from '@/hooks/Assistants/useAssistantStatus';
import { Assistant, AssistantStatus } from '@/types/assistants/assistant';
import { ResponseProps } from '@/types/common';

// Create stable mock function at module level
const mockGetStatusAction = vi.fn();

// Create mock assistant data
const createMockAssistant = (id: string): Assistant =>
  ({
    agentId: id,
    firstName: `Assistant${id}`,
    surname: 'Test',
  }) as Assistant;

// Create mock status data
const createMockStatus = (running: boolean): AssistantStatus => ({
  running,
  uptimeSeconds: 0,
  processId: null,
  assistantId: '1',
  shutdownReason: null,
  inactivityTimeoutMinutes: 30,
  message: null,
});

describe('useAssistantStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStatusAction.mockResolvedValue(createMockStatus(true));
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

      renderHook(() => useAssistantStatus(assistants, mockGetStatusAction));

      await waitFor(() => {
        expect(mockGetStatusAction).toHaveBeenCalledWith('1');
        expect(mockGetStatusAction).toHaveBeenCalledWith('2');
      });
    });

    it('sets status map with fetched statuses', async () => {
      const assistants = [createMockAssistant('1')];
      mockGetStatusAction.mockResolvedValue(createMockStatus(true));

      const { result } = renderHook(() => useAssistantStatus(assistants, mockGetStatusAction));

      await waitFor(() => {
        expect(result.current.statuses.get('1')?.running).toBe(true);
      });
    });

    it('handles empty assistant list', async () => {
      const { result } = renderHook(() => useAssistantStatus([], mockGetStatusAction));

      await waitFor(() => {
        expect(result.current.statuses.size).toBe(0);
      });

      expect(mockGetStatusAction).not.toHaveBeenCalled();
    });

    it('handles status fetch error gracefully', async () => {
      const assistants = [createMockAssistant('1')];
      mockGetStatusAction.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useAssistantStatus(assistants, mockGetStatusAction));

      await waitFor(() => {
        // Should set null status for failed fetch
        expect(result.current.statuses.get('1')).toBeNull();
      });
    });

    it('handles non-status response format', async () => {
      const assistants = [createMockAssistant('1')];
      mockGetStatusAction.mockResolvedValue({ detail: 'Error message' } as ResponseProps);

      const { result } = renderHook(() => useAssistantStatus(assistants, mockGetStatusAction));

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

      const { result, rerender } = renderHook(
        ({ assistants }) => useAssistantStatus(assistants, mockGetStatusAction),
        { initialProps: { assistants: initialAssistants } }
      );

      // Wait for initial fetch to complete
      await waitFor(() => {
        expect(result.current.statuses.size).toBe(2);
      });

      const initialCallCount = mockGetStatusAction.mock.calls.length;

      // Create a new array with the same assistants (simulating what happens when
      // useAssistants updates signed URLs - new array reference, same content)
      const newArraySameAssistants = [
        { ...assistant1, signedProfilePhotoUrl: 'https://new-url.com' },
        { ...assistant2 },
      ] as Assistant[];

      rerender({ assistants: newArraySameAssistants });

      // Wait a tick to allow any effects to run
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Should NOT have re-fetched since IDs are the same
      expect(mockGetStatusAction.mock.calls.length).toBe(initialCallCount);
    });

    it('DOES re-fetch when a new assistant is added', async () => {
      const assistant1 = createMockAssistant('1');
      const initialAssistants = [assistant1];

      const { result, rerender } = renderHook(
        ({ assistants }) => useAssistantStatus(assistants, mockGetStatusAction),
        { initialProps: { assistants: initialAssistants } }
      );

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.statuses.size).toBe(1);
      });

      const initialCallCount = mockGetStatusAction.mock.calls.length;

      // Add a new assistant
      const assistant2 = createMockAssistant('2');
      const updatedAssistants = [assistant1, assistant2];

      rerender({ assistants: updatedAssistants });

      // Should fetch status for both assistants since list changed
      await waitFor(() => {
        expect(mockGetStatusAction.mock.calls.length).toBeGreaterThan(initialCallCount);
        expect(mockGetStatusAction).toHaveBeenCalledWith('2');
      });
    });

    it('DOES re-fetch when an assistant is removed', async () => {
      const assistant1 = createMockAssistant('1');
      const assistant2 = createMockAssistant('2');
      const initialAssistants = [assistant1, assistant2];

      const { result, rerender } = renderHook(
        ({ assistants }) => useAssistantStatus(assistants, mockGetStatusAction),
        { initialProps: { assistants: initialAssistants } }
      );

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.statuses.size).toBe(2);
      });

      const initialCallCount = mockGetStatusAction.mock.calls.length;

      // Remove assistant2
      const updatedAssistants = [assistant1];

      rerender({ assistants: updatedAssistants });

      // Should fetch again since list changed
      await waitFor(() => {
        expect(mockGetStatusAction.mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it('does NOT re-fetch when order changes (IDs sorted for comparison)', async () => {
      const assistant1 = createMockAssistant('1');
      const assistant2 = createMockAssistant('2');
      const initialAssistants = [assistant1, assistant2];

      const { result, rerender } = renderHook(
        ({ assistants }) => useAssistantStatus(assistants, mockGetStatusAction),
        { initialProps: { assistants: initialAssistants } }
      );

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.statuses.size).toBe(2);
      });

      const initialCallCount = mockGetStatusAction.mock.calls.length;

      // Same assistants, different order
      const reorderedAssistants = [assistant2, assistant1];

      rerender({ assistants: reorderedAssistants });

      // Wait a tick to allow any effects to run
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Should NOT have re-fetched since the sorted ID key is the same
      expect(mockGetStatusAction.mock.calls.length).toBe(initialCallCount);
    });
  });

  // ===========================================================================
  // Status Map Updates
  // ===========================================================================

  describe('status map updates', () => {
    it('preserves existing statuses when adding new assistant', async () => {
      const assistant1 = createMockAssistant('1');

      mockGetStatusAction.mockImplementation((id: string) =>
        Promise.resolve(createMockStatus(id === '1'))
      );

      const { result, rerender } = renderHook(
        ({ assistants }) => useAssistantStatus(assistants, mockGetStatusAction),
        { initialProps: { assistants: [assistant1] } }
      );

      await waitFor(() => {
        expect(result.current.statuses.get('1')?.running).toBe(true);
      });

      // Add second assistant
      const assistant2 = createMockAssistant('2');
      rerender({ assistants: [assistant1, assistant2] });

      await waitFor(() => {
        expect(result.current.statuses.get('2')?.running).toBe(false);
      });

      // First assistant's status should still be there
      expect(result.current.statuses.get('1')?.running).toBe(true);
    });

    it('handles multiple assistants with different statuses', async () => {
      const assistants = [
        createMockAssistant('1'),
        createMockAssistant('2'),
        createMockAssistant('3'),
      ];

      mockGetStatusAction.mockImplementation((id: string) => {
        const running = id === '1' || id === '3';
        return Promise.resolve(createMockStatus(running));
      });

      const { result } = renderHook(() => useAssistantStatus(assistants, mockGetStatusAction));

      await waitFor(() => {
        expect(result.current.statuses.size).toBe(3);
        expect(result.current.statuses.get('1')?.running).toBe(true);
        expect(result.current.statuses.get('2')?.running).toBe(false);
        expect(result.current.statuses.get('3')?.running).toBe(true);
      });
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

      const { result, rerender } = renderHook(
        ({ assistants }) => useAssistantStatus(assistants, mockGetStatusAction),
        { initialProps: { assistants: [assistant1] } }
      );

      // Rapid changes
      rerender({ assistants: [assistant1, assistant2] });
      rerender({ assistants: [assistant1, assistant2, assistant3] });
      rerender({ assistants: [assistant2, assistant3] });

      // Final state should have statuses for assistant2 and assistant3
      await waitFor(() => {
        expect(result.current.statuses.size).toBeGreaterThan(0);
      });
    });

    it('cleans up properly on unmount', async () => {
      const assistants = [createMockAssistant('1')];

      const { result, unmount } = renderHook(() =>
        useAssistantStatus(assistants, mockGetStatusAction)
      );

      await waitFor(() => {
        expect(result.current.statuses.size).toBe(1);
      });

      // Should not throw when unmounting
      expect(() => unmount()).not.toThrow();
    });

    it('handles switching from empty to non-empty assistant list', async () => {
      const { result, rerender } = renderHook(
        ({ assistants }) => useAssistantStatus(assistants, mockGetStatusAction),
        { initialProps: { assistants: [] as Assistant[] } }
      );

      // Initially empty
      expect(result.current.statuses.size).toBe(0);

      // Add assistants
      const assistant1 = createMockAssistant('1');
      rerender({ assistants: [assistant1] });

      await waitFor(() => {
        expect(result.current.statuses.size).toBe(1);
        expect(mockGetStatusAction).toHaveBeenCalledWith('1');
      });
    });

    it('handles switching from non-empty to empty assistant list', async () => {
      const assistant1 = createMockAssistant('1');

      const { result, rerender } = renderHook(
        ({ assistants }) => useAssistantStatus(assistants, mockGetStatusAction),
        { initialProps: { assistants: [assistant1] } }
      );

      await waitFor(() => {
        expect(result.current.statuses.size).toBe(1);
      });

      // Remove all assistants
      rerender({ assistants: [] });

      await waitFor(() => {
        expect(result.current.statuses.size).toBe(0);
      });
    });
  });
});
