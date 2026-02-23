/**
 * Unit tests for useOrgSpending hook.
 *
 * Tests cover:
 * - Initial data loading
 * - Error handling
 * - updateLimit action
 * - Display calculation
 * - Manual refresh
 *
 * Note: Polling tests are excluded as they require complex timer mocking
 * that conflicts with React Testing Library's waitFor.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useOrgSpending } from '@/hooks/Organizations/useOrgSpending';
import { OrgSpend, OrgSpendingLimitResponse } from '@/types/organization';

// Mock data
const mockSpendData: OrgSpend = {
  orgId: 123,
  month: '2026-01',
  cumulativeSpend: 2500.0,
  limit: 5000.0,
  percentUsed: 50.0,
};

const mockLimitData: OrgSpendingLimitResponse = {
  orgId: 123,
  monthlySpendingCap: 5000.0,
};

describe('useOrgSpending', () => {
  // Create stable mock functions
  const mockGetSpendAction = vi.fn();
  const mockGetLimitAction = vi.fn();
  const mockSetLimitAction = vi.fn();

  const getDefaultConfig = () => ({
    orgId: 123,
    getSpendAction: mockGetSpendAction,
    getLimitAction: mockGetLimitAction,
    setLimitAction: mockSetLimitAction,
    enablePolling: false, // Disable polling for tests
  });

  beforeEach(() => {
    // Reset and configure default mock behavior
    mockGetSpendAction.mockReset().mockResolvedValue(mockSpendData);
    mockGetLimitAction.mockReset().mockResolvedValue(mockLimitData);
    mockSetLimitAction.mockReset().mockResolvedValue({
      ...mockLimitData,
      info: 'Organization spending limit updated successfully.',
    });
  });

  // ===========================================================================
  // Initial Loading
  // ===========================================================================

  describe('initial loading', () => {
    it('starts with loading state true', () => {
      const { result } = renderHook(() => useOrgSpending(getDefaultConfig()));
      expect(result.current.isLoading).toBe(true);
    });

    it('fetches spend and limit data on mount', async () => {
      renderHook(() => useOrgSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(mockGetSpendAction).toHaveBeenCalledWith(123, expect.any(String));
        expect(mockGetLimitAction).toHaveBeenCalledWith(123);
      });
    });

    it('sets spend data after successful fetch', async () => {
      const { result } = renderHook(() => useOrgSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.spend).toEqual(mockSpendData);
      });
    });

    it('sets limit data after successful fetch', async () => {
      const { result } = renderHook(() => useOrgSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.limit).toEqual(mockLimitData);
      });
    });

    it('sets isLoading to false after fetch completes', async () => {
      const { result } = renderHook(() => useOrgSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('calculates display properties from spend data', async () => {
      const { result } = renderHook(() => useOrgSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.display).not.toBeNull();
        expect(result.current.display?.percentUsed).toBe(50);
        expect(result.current.display?.isOverLimit).toBe(false);
        expect(result.current.display?.isUnlimited).toBe(false);
      });
    });

    it('provides current month', async () => {
      const { result } = renderHook(() => useOrgSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.currentMonth).toMatch(/^\d{4}-\d{2}$/);
      });
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe('error handling', () => {
    it('sets error on spend fetch failure', async () => {
      mockGetSpendAction.mockResolvedValue({ detail: 'Organization not found' });

      const { result } = renderHook(() => useOrgSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.error).toBe('Organization not found');
      });
    });

    it('handles exception during spend fetch', async () => {
      mockGetSpendAction.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useOrgSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
      });
    });

    it('logs warning but does not set error on limit fetch failure', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockGetLimitAction.mockResolvedValue({ detail: 'Permission denied' });

      const { result } = renderHook(() => useOrgSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.error).toBeNull(); // No error for limit failures
        expect(warnSpy).toHaveBeenCalled();
      });

      warnSpy.mockRestore();
    });
  });

  // ===========================================================================
  // Display Calculation
  // ===========================================================================

  describe('display calculation', () => {
    it('returns null display when no spend data', () => {
      mockGetSpendAction.mockResolvedValue({ detail: 'Not found' });

      const { result } = renderHook(() => useOrgSpending(getDefaultConfig()));

      // Before data loads, display should be null
      expect(result.current.display).toBeNull();
    });

    it('calculates isNearLimit correctly', async () => {
      const nearLimitSpend: OrgSpend = {
        ...mockSpendData,
        cumulativeSpend: 4200.0,
        percentUsed: 84.0,
      };
      mockGetSpendAction.mockResolvedValue(nearLimitSpend);

      const { result } = renderHook(() => useOrgSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.display?.isNearLimit).toBe(true);
        expect(result.current.display?.isOverLimit).toBe(false);
      });
    });

    it('calculates isOverLimit correctly', async () => {
      const overLimitSpend: OrgSpend = {
        ...mockSpendData,
        cumulativeSpend: 5500.0,
        percentUsed: 110.0,
      };
      mockGetSpendAction.mockResolvedValue(overLimitSpend);

      const { result } = renderHook(() => useOrgSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.display?.isOverLimit).toBe(true);
        expect(result.current.display?.isNearLimit).toBe(false);
      });
    });

    it('calculates isUnlimited correctly', async () => {
      const unlimitedSpend: OrgSpend = {
        ...mockSpendData,
        limit: null,
        percentUsed: 0,
      };
      mockGetSpendAction.mockResolvedValue(unlimitedSpend);

      const { result } = renderHook(() => useOrgSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.display?.isUnlimited).toBe(true);
        expect(result.current.display?.isOverLimit).toBe(false);
        expect(result.current.display?.isNearLimit).toBe(false);
      });
    });
  });

  // ===========================================================================
  // Update Limit Action
  // ===========================================================================

  describe('updateLimit', () => {
    it('calls setLimitAction with correct parameters', async () => {
      const { result } = renderHook(() => useOrgSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.updateLimit(10000);
      });

      expect(mockSetLimitAction).toHaveBeenCalledWith(123, { monthlySpendingCap: 10000 });
    });

    it('returns success on successful update', async () => {
      const { result } = renderHook(() => useOrgSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let updateResult: { success: boolean; error?: string };
      await act(async () => {
        updateResult = await result.current.updateLimit(10000);
      });

      expect(updateResult!.success).toBe(true);
      expect(updateResult!.error).toBeUndefined();
    });

    it('returns error on failed update', async () => {
      mockSetLimitAction.mockResolvedValue({ detail: 'Permission denied' });

      const { result } = renderHook(() => useOrgSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let updateResult: { success: boolean; error?: string };
      await act(async () => {
        updateResult = await result.current.updateLimit(10000);
      });

      expect(updateResult!.success).toBe(false);
      expect(updateResult!.error).toBe('Permission denied');
    });

    it('refreshes data after successful update', async () => {
      const { result } = renderHook(() => useOrgSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Clear mock call history
      mockGetSpendAction.mockClear();
      mockGetLimitAction.mockClear();

      await act(async () => {
        await result.current.updateLimit(10000);
      });

      // Should refresh both spend and limit after update
      expect(mockGetLimitAction).toHaveBeenCalled();
      expect(mockGetSpendAction).toHaveBeenCalled();
    });

    it('handles null limit (remove limit)', async () => {
      const { result } = renderHook(() => useOrgSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.updateLimit(null);
      });

      expect(mockSetLimitAction).toHaveBeenCalledWith(123, { monthlySpendingCap: null });
    });
  });

  // ===========================================================================
  // Manual Refresh
  // ===========================================================================

  describe('manual refresh', () => {
    it('refreshSpend calls getSpendAction', async () => {
      const { result } = renderHook(() => useOrgSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      mockGetSpendAction.mockClear();

      await act(async () => {
        await result.current.refreshSpend();
      });

      expect(mockGetSpendAction).toHaveBeenCalledWith(123, expect.any(String));
    });

    it('refreshLimit calls getLimitAction', async () => {
      const { result } = renderHook(() => useOrgSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      mockGetLimitAction.mockClear();

      await act(async () => {
        await result.current.refreshLimit();
      });

      expect(mockGetLimitAction).toHaveBeenCalledWith(123);
    });

    it('refreshAll calls both actions', async () => {
      const { result } = renderHook(() => useOrgSpending(getDefaultConfig()));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      mockGetSpendAction.mockClear();
      mockGetLimitAction.mockClear();

      await act(async () => {
        await result.current.refreshAll();
      });

      expect(mockGetSpendAction).toHaveBeenCalled();
      expect(mockGetLimitAction).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // OrgId handling
  // ===========================================================================

  describe('orgId handling', () => {
    it('uses orgId (number) in action calls', async () => {
      const { result } = renderHook(() =>
        useOrgSpending({
          ...getDefaultConfig(),
          orgId: 456,
        })
      );

      await waitFor(() => {
        expect(mockGetSpendAction).toHaveBeenCalledWith(456, expect.any(String));
        expect(mockGetLimitAction).toHaveBeenCalledWith(456);
      });
    });
  });
});
