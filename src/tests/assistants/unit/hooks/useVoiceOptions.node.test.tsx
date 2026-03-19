/**
 * Tests for useVoiceOptions hook - Lazy Loading Behavior
 *
 * These tests verify that voice data is loaded lazily (only when needed)
 * rather than eagerly on component mount.
 *
 * Key behaviors tested:
 * 1. Voices are NOT fetched when enabled=false
 * 2. Voices ARE fetched when enabled=true
 * 3. Voices are fetched only once when enabled toggles true multiple times
 * 4. Manual refetch is always available regardless of enabled state
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useVoiceOptions } from '@/hooks/Assistants/useVoiceOptions';
import { AssistantActions, Voice } from '@/types/assistants/assistant';

// Mock voice data
const mockUserVoices: Voice[] = [
  {
    voiceId: 'user-voice-1',
    name: 'Custom Voice 1',
    description: 'A custom cloned voice',
    provider: 'elevenlabs',
    language: 'en',
    gender: 'female',
  },
  {
    voiceId: 'user-voice-2',
    name: 'Custom Voice 2',
    description: 'Another custom voice',
    provider: 'elevenlabs',
    language: 'es',
    gender: 'male',
  },
];

// Mock the client fetch module
const mockFetchVoices = vi.fn().mockResolvedValue(mockUserVoices);
vi.mock('@/lib/client/voice', () => ({
  fetchVoices: (...args: any[]) => mockFetchVoices(...args),
}));

const createMockVoiceActions = () => ({
  register: vi.fn(),
  delete: vi.fn().mockResolvedValue({ info: 'Deleted' }),
  clone: vi.fn(),
  generate: vi.fn(),
  preview: vi.fn(),
  design: vi.fn(),
});

describe('useVoiceOptions - Lazy Loading', () => {
  let mockVoiceActions: ReturnType<typeof createMockVoiceActions>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchVoices.mockResolvedValue(mockUserVoices);
    mockVoiceActions = createMockVoiceActions();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Lazy Loading Behavior', () => {
    it(
      'should NOT fetch voices when enabled is false',
      {
        meta: {
          alias: 'VoiceOptions-LazyDisabled',
          scenario: 'Hook initialized with enabled=false',
          behavior: 'Should not call list() API',
        },
      },
      async () => {
        // Arrange & Act
        const { result } = renderHook(() =>
          useVoiceOptions(mockVoiceActions as AssistantActions['voice'], { enabled: false })
        );

        // Wait a tick to ensure no async calls are made
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
        });

        // Assert - list should NOT have been called
        expect(mockFetchVoices).not.toHaveBeenCalled();
        expect(result.current.isLoadingUserVoices).toBe(false);
        expect(result.current.hasFetchedOnce).toBe(false);
      }
    );

    it(
      'should fetch voices when enabled is true',
      {
        meta: {
          alias: 'VoiceOptions-LazyEnabled',
          scenario: 'Hook initialized with enabled=true',
          behavior: 'Should call list() API immediately',
        },
      },
      async () => {
        // Arrange & Act
        const { result } = renderHook(() =>
          useVoiceOptions(mockVoiceActions as AssistantActions['voice'], { enabled: true })
        );

        // Assert - list should be called
        await waitFor(() => {
          expect(mockFetchVoices).toHaveBeenCalledTimes(1);
        });

        await waitFor(() => {
          expect(result.current.allDisplayableVoices.length).toBeGreaterThan(0);
          expect(result.current.hasFetchedOnce).toBe(true);
        });
      }
    );

    it(
      'should fetch voices when enabled changes from false to true',
      {
        meta: {
          alias: 'VoiceOptions-LazyToggle',
          scenario: 'Hook starts disabled, then becomes enabled',
          behavior: 'Should fetch voices only when enabled becomes true',
        },
      },
      async () => {
        // Arrange - start with enabled=false
        const { result, rerender } = renderHook(
          ({ enabled }) =>
            useVoiceOptions(mockVoiceActions as AssistantActions['voice'], { enabled }),
          { initialProps: { enabled: false } }
        );

        // Verify no fetch yet
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
        });
        expect(mockFetchVoices).not.toHaveBeenCalled();
        expect(result.current.hasFetchedOnce).toBe(false);

        // Act - enable the hook
        rerender({ enabled: true });

        // Assert - should now fetch
        await waitFor(() => {
          expect(mockFetchVoices).toHaveBeenCalledTimes(1);
          expect(result.current.hasFetchedOnce).toBe(true);
        });
      }
    );

    it(
      'should NOT re-fetch when enabled toggles true multiple times',
      {
        meta: {
          alias: 'VoiceOptions-LazyCache',
          scenario: 'Hook enabled multiple times (e.g., dialog opens/closes multiple times)',
          behavior: 'Should only fetch once, cache subsequent requests',
        },
      },
      async () => {
        // Arrange
        const { result, rerender } = renderHook(
          ({ enabled }) =>
            useVoiceOptions(mockVoiceActions as AssistantActions['voice'], { enabled }),
          { initialProps: { enabled: false } }
        );

        // First enable - should fetch
        rerender({ enabled: true });
        await waitFor(() => {
          expect(mockFetchVoices).toHaveBeenCalledTimes(1);
        });

        // Disable
        rerender({ enabled: false });

        // Enable again - should NOT fetch again (cached)
        rerender({ enabled: true });

        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
        });

        // Assert - still only one fetch
        expect(mockFetchVoices).toHaveBeenCalledTimes(1);
        expect(result.current.hasFetchedOnce).toBe(true);
      }
    );

    it(
      'should allow manual refetch regardless of enabled state',
      {
        meta: {
          alias: 'VoiceOptions-ManualRefetch',
          scenario: 'Manual fetchUserVoices called while enabled=false',
          behavior: 'Should still perform the fetch when explicitly requested',
        },
      },
      async () => {
        // Arrange - start disabled
        const { result } = renderHook(() =>
          useVoiceOptions(mockVoiceActions as AssistantActions['voice'], { enabled: false })
        );

        // Verify no automatic fetch
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
        });
        expect(mockFetchVoices).not.toHaveBeenCalled();

        // Act - manually trigger fetch
        await act(async () => {
          await result.current.fetchUserVoices();
        });

        // Assert - should have fetched
        expect(mockFetchVoices).toHaveBeenCalledTimes(1);
        expect(result.current.hasFetchedOnce).toBe(true);
      }
    );

    it(
      'should support force refetch even after cached',
      {
        meta: {
          alias: 'VoiceOptions-ForceRefetch',
          scenario: 'User creates new voice, needs to refresh list',
          behavior: 'fetchUserVoices should always refetch when called manually',
        },
      },
      async () => {
        // Arrange - fetch once
        const { result } = renderHook(() =>
          useVoiceOptions(mockVoiceActions as AssistantActions['voice'], { enabled: true })
        );

        await waitFor(() => {
          expect(mockFetchVoices).toHaveBeenCalledTimes(1);
        });

        // Act - manually refetch
        await act(async () => {
          await result.current.fetchUserVoices();
        });

        // Assert - should have fetched twice
        expect(mockFetchVoices).toHaveBeenCalledTimes(2);
      }
    );
  });

  describe('Backward Compatibility', () => {
    it(
      'should default to enabled=true for backward compatibility when no options provided',
      {
        meta: {
          alias: 'VoiceOptions-BackwardCompat',
          scenario: 'Hook called without options parameter',
          behavior: 'Should fetch immediately (existing behavior)',
        },
      },
      async () => {
        // Arrange & Act - call without options (simulating old usage)
        const { result } = renderHook(() =>
          useVoiceOptions(mockVoiceActions as AssistantActions['voice'])
        );

        // Assert - should fetch immediately for backward compatibility
        await waitFor(() => {
          expect(mockFetchVoices).toHaveBeenCalledTimes(1);
        });
      }
    );
  });

  describe('Loading States', () => {
    it(
      'should track loading state correctly during fetch',
      {
        meta: {
          alias: 'VoiceOptions-LoadingState',
          scenario: 'Fetch in progress',
          behavior: 'isLoadingUserVoices should be true during fetch, false after',
        },
      },
      async () => {
        // Arrange - create a delayed response
        let resolveList: (value: Voice[]) => void;
        const delayedList = new Promise<Voice[]>((resolve) => {
          resolveList = resolve;
        });
        mockFetchVoices.mockReturnValue(delayedList);

        // Act
        const { result } = renderHook(() =>
          useVoiceOptions(mockVoiceActions as AssistantActions['voice'], { enabled: true })
        );

        // Assert - should be loading
        await waitFor(() => {
          expect(result.current.isLoadingUserVoices).toBe(true);
        });

        // Resolve the fetch
        await act(async () => {
          resolveList!(mockUserVoices);
        });

        // Assert - should no longer be loading
        await waitFor(() => {
          expect(result.current.isLoadingUserVoices).toBe(false);
        });
      }
    );
  });

  describe('Error Handling', () => {
    it(
      'should handle API errors gracefully',
      {
        meta: {
          alias: 'VoiceOptions-ErrorHandling',
          scenario: 'API returns error',
          behavior: 'Should set empty voices array and not throw',
        },
      },
      async () => {
        // Arrange
        mockFetchVoices.mockResolvedValue({ detail: 'API Error' });

        // Act
        const { result } = renderHook(() =>
          useVoiceOptions(mockVoiceActions as AssistantActions['voice'], { enabled: true })
        );

        // Assert - should handle error gracefully
        await waitFor(() => {
          expect(result.current.isLoadingUserVoices).toBe(false);
        });

        // User voices should be empty, but preset voices should still be available
        expect(result.current.allDisplayableVoices.length).toBeGreaterThan(0); // Presets still loaded
      }
    );

    it(
      'should handle network errors gracefully',
      {
        meta: {
          alias: 'VoiceOptions-NetworkError',
          scenario: 'Network failure during fetch',
          behavior: 'Should catch error, set empty voices, and not crash',
        },
      },
      async () => {
        // Arrange
        mockFetchVoices.mockRejectedValue(new Error('Network error'));

        // Act
        const { result } = renderHook(() =>
          useVoiceOptions(mockVoiceActions as AssistantActions['voice'], { enabled: true })
        );

        // Assert - should handle error gracefully without crashing
        await waitFor(() => {
          expect(result.current.isLoadingUserVoices).toBe(false);
        });
      }
    );
  });
});
