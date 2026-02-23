/**
 * Unit tests for useMemberSpending hook
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useMemberSpending } from '@/hooks/Organizations/useMemberSpending';
import { MemberSpend, MemberSpendingLimitResponse } from '@/types/organization';

describe('useMemberSpending', () => {
  // Mock actions
  const mockGetSpendAction = vi.fn();
  const mockGetLimitAction = vi.fn();
  const mockSetLimitAction = vi.fn();

  const defaultConfig = {
    orgId: 1,
    userId: 'user-123',
    getSpendAction: mockGetSpendAction,
    getLimitAction: mockGetLimitAction,
    setLimitAction: mockSetLimitAction,
    enablePolling: false, // Disable polling for tests
  };

  const mockSpendData: MemberSpend = {
    orgId: 1,
    userId: 'user-123',
    month: '2026-01',
    cumulativeSpend: 45.5,
    limit: 100,
    percentUsed: 45.5,
  };

  const mockLimitData: MemberSpendingLimitResponse = {
    orgId: 1,
    userId: 'user-123',
    monthlySpendingCap: 100,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSpendAction.mockResolvedValue(mockSpendData);
    mockGetLimitAction.mockResolvedValue(mockLimitData);
  });

  it('fetches spend and limit data on mount', async () => {
    const { result } = renderHook(() => useMemberSpending(defaultConfig));

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGetSpendAction).toHaveBeenCalledWith(1, 'user-123', expect.any(String));
    expect(mockGetLimitAction).toHaveBeenCalledWith(1, 'user-123');
    expect(result.current.spend).toEqual(mockSpendData);
    expect(result.current.limit).toEqual(mockLimitData);
  });

  it('calculates display properties from spend data', async () => {
    const { result } = renderHook(() => useMemberSpending(defaultConfig));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.display).not.toBeNull();
    expect(result.current.display?.currentSpend).toBe(45.5);
    expect(result.current.display?.limit).toBe(100);
    expect(result.current.display?.percentUsed).toBe(45.5);
    expect(result.current.display?.isOverLimit).toBe(false);
    expect(result.current.display?.isNearLimit).toBe(false);
  });

  it('handles near limit state', async () => {
    mockGetSpendAction.mockResolvedValue({
      ...mockSpendData,
      cumulativeSpend: 85,
      percentUsed: 85,
    });

    const { result } = renderHook(() => useMemberSpending(defaultConfig));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.display?.isNearLimit).toBe(true);
    expect(result.current.display?.isOverLimit).toBe(false);
  });

  it('handles over limit state', async () => {
    mockGetSpendAction.mockResolvedValue({
      ...mockSpendData,
      cumulativeSpend: 110,
      percentUsed: 110,
    });

    const { result } = renderHook(() => useMemberSpending(defaultConfig));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.display?.isOverLimit).toBe(true);
  });

  it('handles unlimited state', async () => {
    mockGetSpendAction.mockResolvedValue({
      ...mockSpendData,
      limit: null,
      percentUsed: 0,
    });

    const { result } = renderHook(() => useMemberSpending(defaultConfig));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.display?.isUnlimited).toBe(true);
  });

  it('handles fetch errors', async () => {
    mockGetSpendAction.mockResolvedValue({ detail: 'Access denied' });

    const { result } = renderHook(() => useMemberSpending(defaultConfig));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Access denied');
    expect(result.current.spend).toBeNull();
  });

  it('updates limit successfully', async () => {
    mockSetLimitAction.mockResolvedValue({
      ...mockLimitData,
      monthlySpendingCap: 150,
      info: 'Updated',
    });

    const { result } = renderHook(() => useMemberSpending(defaultConfig));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const updateResult = await act(async () => {
      return result.current.updateLimit(150);
    });

    expect(updateResult.success).toBe(true);
    expect(mockSetLimitAction).toHaveBeenCalledWith(1, 'user-123', { monthlySpendingCap: 150 });
  });

  it('handles update limit errors', async () => {
    mockSetLimitAction.mockResolvedValue({
      detail: 'Member limit cannot exceed org limit',
    });

    const { result } = renderHook(() => useMemberSpending(defaultConfig));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const updateResult = await act(async () => {
      return result.current.updateLimit(500);
    });

    expect(updateResult.success).toBe(false);
    expect(updateResult.error).toContain('exceed org limit');
  });

  it('refreshes spend data manually', async () => {
    const { result } = renderHook(() => useMemberSpending(defaultConfig));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Clear mock to track new calls
    mockGetSpendAction.mockClear();

    await act(async () => {
      await result.current.refreshSpend();
    });

    expect(mockGetSpendAction).toHaveBeenCalledTimes(1);
  });

  it('refreshes all data', async () => {
    const { result } = renderHook(() => useMemberSpending(defaultConfig));

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

  it('provides current month', async () => {
    const { result } = renderHook(() => useMemberSpending(defaultConfig));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.currentMonth).toMatch(/^\d{4}-\d{2}$/);
  });
});
