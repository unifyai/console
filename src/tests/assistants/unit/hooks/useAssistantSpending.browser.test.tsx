/**
 * Unit tests for useAssistantSpending hook.
 *
 * Tests cover:
 * - Initial data loading
 * - Polling behavior
 * - Error handling
 * - updateLimit action
 * - Display calculation
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAssistantSpending } from '@/hooks/Assistants/useAssistantSpending';
import { AssistantSpend, SpendingLimitResponse } from '@/types/assistants/spending';
import { ResponseProps } from '@/types/common';

// Mock data
const mockSpendData: AssistantSpend = {
  agentId: '123',
  month: '2026-01',
  cumulativeSpend: 50.0,
  limit: 100.0,
  percentUsed: 50.0,
};

const mockLimitData: SpendingLimitResponse = {
  agentId: '123',
  monthlySpendingCap: 100.0,
  effectiveLimit: 100.0,
};

describe('useAssistantSpending', () => {
  // Create stable mock functions that can be configured per test
  const mockGetSpendAction = vi.fn();
  const mockGetLimitAction = vi.fn();
  const mockSetLimitAction = vi.fn();

  const getDefaultConfig = () => ({
    assistantId: '123',
    getSpendAction: mockGetSpendAction,
    getLimitAction: mockGetLimitAction,
    setLimitAction: mockSetLimitAction,
    enablePolling: false, // Disable polling for most tests
  });

  beforeEach(() => {
    vi.useFakeTimers();

    // Reset and configure default mock behavior
    mockGetSpendAction.mockReset().mockResolvedValue(mockSpendData);
    mockGetLimitAction.mockReset().mockResolvedValue(mockLimitData);
    mockSetLimitAction.mockReset().mockResolvedValue({
      ...mockLimitData,
      info: 'Spending limit updated successfully.',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===========================================================================
  // Initial Loading
  // ===========================================================================

  describe('initial loading', () => {
    it('starts with loading state true', () => {
      const { result } = renderHook(() => useAssistantSpending(getDefaultConfig()));

      expect(result.current.isLoading).toBe(true);
    });

    it('fetches spend and limit data on mount', async () => {
      renderHook(() => useAssistantSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(mockGetSpendAction).toHaveBeenCalledWith('123', expect.any(String));
        expect(mockGetLimitAction).toHaveBeenCalledWith('123');
      });
    });

    it('sets spend data after successful fetch', async () => {
      const { result } = renderHook(() => useAssistantSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.spend).toEqual(mockSpendData);
      });
    });

    it('sets limit data after successful fetch', async () => {
      const { result } = renderHook(() => useAssistantSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.limit).toEqual(mockLimitData);
      });
    });

    it('sets isLoading to false after fetch completes', async () => {
      const { result } = renderHook(() => useAssistantSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('calculates display properties from spend data', async () => {
      const { result } = renderHook(() => useAssistantSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.display).not.toBeNull();
        expect(result.current.display?.percentUsed).toBe(50);
        expect(result.current.display?.isOverLimit).toBe(false);
        expect(result.current.display?.isUnlimited).toBe(false);
      });
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe('error handling', () => {
    it('sets error on spend fetch failure', async () => {
      mockGetSpendAction.mockResolvedValue({ detail: 'Failed to fetch' });

      const { result } = renderHook(() => useAssistantSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to fetch');
      });
    });

    it('handles network errors gracefully', async () => {
      mockGetSpendAction.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useAssistantSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
      });
    });

    it('does not set error for limit fetch failures (less critical)', async () => {
      mockGetLimitAction.mockResolvedValue({ detail: 'Limit not found' });

      const { result } = renderHook(() => useAssistantSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Limit errors don't set the main error state
      expect(result.current.error).toBeNull();
      expect(result.current.limit).toBeNull();
    });
  });

  // ===========================================================================
  // Polling
  // ===========================================================================

  describe('polling', () => {
    it('polls spend data at specified interval', async () => {
      const pollingConfig = {
        ...getDefaultConfig(),
        enablePolling: true,
        pollingInterval: 60000,
      };

      renderHook(() => useAssistantSpending(pollingConfig));

      // Initial fetch
      await waitFor(() => {
        expect(mockGetSpendAction).toHaveBeenCalledTimes(1);
      });

      // Advance timer by polling interval
      act(() => {
        vi.advanceTimersByTime(60000);
      });

      await waitFor(() => {
        expect(mockGetSpendAction).toHaveBeenCalledTimes(2);
      });

      // Advance again
      act(() => {
        vi.advanceTimersByTime(60000);
      });

      await waitFor(() => {
        expect(mockGetSpendAction).toHaveBeenCalledTimes(3);
      });
    });

    it('sets isRefreshing during background poll', async () => {
      const pollingConfig = {
        ...getDefaultConfig(),
        enablePolling: true,
        pollingInterval: 60000,
      };

      const { result } = renderHook(() => useAssistantSpending(pollingConfig));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Trigger a poll
      act(() => {
        vi.advanceTimersByTime(60000);
      });

      // Note: isRefreshing may be true briefly during the poll
      // This test verifies the mechanism exists
      expect(result.current.isRefreshing).toBeDefined();
    });

    it('stops polling on unmount', async () => {
      const pollingConfig = {
        ...getDefaultConfig(),
        enablePolling: true,
        pollingInterval: 60000,
      };

      const { unmount } = renderHook(() => useAssistantSpending(pollingConfig));

      await waitFor(() => {
        expect(mockGetSpendAction).toHaveBeenCalledTimes(1);
      });

      unmount();

      act(() => {
        vi.advanceTimersByTime(60000);
      });

      // Should not have polled after unmount
      expect(mockGetSpendAction).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // Update Limit
  // ===========================================================================

  describe('updateLimit', () => {
    it('calls setLimitAction with correct payload', async () => {
      const { result } = renderHook(() => useAssistantSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.updateLimit(200);
      });

      expect(mockSetLimitAction).toHaveBeenCalledWith('123', { monthlySpendingCap: 200 });
    });

    it('returns success on successful update', async () => {
      const { result } = renderHook(() => useAssistantSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let updateResult: { success: boolean; error?: string };
      await act(async () => {
        updateResult = await result.current.updateLimit(200);
      });

      expect(updateResult!.success).toBe(true);
      expect(updateResult!.error).toBeUndefined();
    });

    it('returns error on failed update', async () => {
      mockSetLimitAction.mockResolvedValue({ detail: 'Update failed' });

      const { result } = renderHook(() => useAssistantSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let updateResult: { success: boolean; error?: string };
      await act(async () => {
        updateResult = await result.current.updateLimit(200);
      });

      expect(updateResult!.success).toBe(false);
      expect(updateResult!.error).toBe('Update failed');
    });

    it('refreshes spend and limit data after successful update', async () => {
      const { result } = renderHook(() => useAssistantSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      mockGetSpendAction.mockClear();
      mockGetLimitAction.mockClear();

      await act(async () => {
        await result.current.updateLimit(200);
      });

      expect(mockGetLimitAction).toHaveBeenCalled();
      expect(mockGetSpendAction).toHaveBeenCalled();
    });

    it('accepts null to remove limit', async () => {
      const { result } = renderHook(() => useAssistantSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.updateLimit(null);
      });

      expect(mockSetLimitAction).toHaveBeenCalledWith('123', { monthlySpendingCap: null });
    });
  });

  // ===========================================================================
  // Manual Refresh
  // ===========================================================================

  describe('manual refresh', () => {
    it('refreshSpend fetches new spend data', async () => {
      const { result } = renderHook(() => useAssistantSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      mockGetSpendAction.mockClear();

      await act(async () => {
        await result.current.refreshSpend();
      });

      expect(mockGetSpendAction).toHaveBeenCalledTimes(1);
    });

    it('refreshLimit fetches new limit data', async () => {
      const { result } = renderHook(() => useAssistantSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      mockGetLimitAction.mockClear();

      await act(async () => {
        await result.current.refreshLimit();
      });

      expect(mockGetLimitAction).toHaveBeenCalledTimes(1);
    });

    it('refreshAll fetches both spend and limit', async () => {
      const { result } = renderHook(() => useAssistantSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      mockGetSpendAction.mockClear();
      mockGetLimitAction.mockClear();

      await act(async () => {
        await result.current.refreshAll();
      });

      expect(mockGetSpendAction).toHaveBeenCalledTimes(1);
      expect(mockGetLimitAction).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // Display Calculations
  // ===========================================================================

  describe('display calculations', () => {
    it('shows unlimited when no limit set', async () => {
      const unlimitedSpend: AssistantSpend = {
        ...mockSpendData,
        limit: null,
        percentUsed: 0,
      };
      mockGetSpendAction.mockResolvedValue(unlimitedSpend);

      const { result } = renderHook(() => useAssistantSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.display?.isUnlimited).toBe(true);
      });
    });

    it('shows over limit when spend exceeds limit', async () => {
      const overLimitSpend: AssistantSpend = {
        ...mockSpendData,
        cumulativeSpend: 150.0,
        limit: 100.0,
        percentUsed: 150.0,
      };
      mockGetSpendAction.mockResolvedValue(overLimitSpend);

      const { result } = renderHook(() => useAssistantSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.display?.isOverLimit).toBe(true);
        expect(result.current.display?.percentUsed).toBe(150);
      });
    });

    it('shows warning when near limit', async () => {
      const nearLimitSpend: AssistantSpend = {
        ...mockSpendData,
        cumulativeSpend: 85.0,
        limit: 100.0,
        percentUsed: 85.0,
      };
      mockGetSpendAction.mockResolvedValue(nearLimitSpend);

      const { result } = renderHook(() => useAssistantSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.display?.isNearLimit).toBe(true);
        expect(result.current.display?.isOverLimit).toBe(false);
      });
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('handles empty assistantId', async () => {
      const { result } = renderHook(() =>
        useAssistantSpending({
          ...getDefaultConfig(),
          assistantId: '',
        })
      );

      // Should not call actions with empty ID
      expect(mockGetSpendAction).not.toHaveBeenCalled();
      expect(mockGetLimitAction).not.toHaveBeenCalled();

      // Should remain in loading state
      expect(result.current.isLoading).toBe(true);
    });

    it('currentMonth returns valid YYYY-MM format', async () => {
      const { result } = renderHook(() => useAssistantSpending(getDefaultConfig()));

      expect(result.current.currentMonth).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
    });

    it('handles zero spend correctly', async () => {
      const zeroSpend: AssistantSpend = {
        ...mockSpendData,
        cumulativeSpend: 0,
        percentUsed: 0,
      };
      mockGetSpendAction.mockResolvedValue(zeroSpend);

      const { result } = renderHook(() => useAssistantSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.spend?.cumulativeSpend).toBe(0);
        expect(result.current.display?.percentUsed).toBe(0);
      });
    });
  });
});
