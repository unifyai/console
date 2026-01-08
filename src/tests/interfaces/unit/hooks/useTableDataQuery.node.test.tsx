import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTableDataQueryWithTracking } from '@/hooks/Interfaces/Query/useTableDataQuery';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTileMeta } from '@/contexts/hooks/tile';

// Mock dependencies
vi.mock('@/contexts/hooks/tile', () => ({
  useTileMeta: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
};

describe('useTableDataQueryWithTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useTileMeta as any).mockReturnValue({ tileId: 'tile-1' });
  });

  it('initializes with empty data item', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTableDataQueryWithTracking('tile-1', 'tab-1'), {
      wrapper,
    });

    expect(result.current.tableData.logs).toEqual([]);
    expect(result.current.tableData.isLoading).toBe(true);
  });

  it('mergeUpdatesIntoTableDataItem merges fields efficiently', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTableDataQueryWithTracking('tile-1', 'tab-1'), {
      wrapper,
    });

    // Initial state is empty.
    // We need to seed data or just update. Since updateTableDataItemWithTracking uses setQueryData on 'tableDataItem',
    // we can start interacting.

    // Act
    act(() => {
      result.current.mergeUpdatesIntoTableDataItem({
        totalCount: 100,
        logs: [{ id: '1' } as any],
      });
    });

    await waitFor(() => {
      expect(result.current.tableData.totalCount).toBe(100);
      expect(result.current.tableData.logs).toHaveLength(1);
    });

    // Act 2: Merge partial
    act(() => {
      result.current.mergeUpdatesIntoTableDataItem({
        totalCount: 101,
        // Should keep logs if we don't overwrite them?
        // Actually the implementation iterates keys. If key not present, it keeps original.
      });
    });

    await waitFor(() => {
      expect(result.current.tableData.totalCount).toBe(101);
      expect(result.current.tableData.logs).toHaveLength(1); // Preserved
    });
  });

  it('updateLogsByRowIds updates specific log entries', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTableDataQueryWithTracking('tile-1', 'tab-1'), {
      wrapper,
    });

    // Seed data
    act(() => {
      result.current.updateTableDataItem({
        logs: [
          { id: '1', entries: { val: 10 } },
          { id: '2', entries: { val: 20 } },
        ] as any,
        isLoading: false,
      });
    });

    await waitFor(() => expect(result.current.tableData.logs).toHaveLength(2));

    // Act: Update row 1
    act(() => {
      result.current.updateLogsByRowIds(['1'], {
        source: 'entries',
        path: ['val'],
        newValue: 999,
      });
    });

    await waitFor(() => {
      const log1 = result.current.tableData.logs.find((l: any) => l.id === '1') as any;
      const log2 = result.current.tableData.logs.find((l: any) => l.id === '2') as any;
      expect(log1?.entries?.val).toBe(999);
      expect(log2?.entries?.val).toBe(20); // Unchanged
    });
  });

  it('updateLogs replaces logs in replace mode (ungrouped)', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTableDataQueryWithTracking('tile-1', 'tab-1'), {
      wrapper,
    });

    // Seed
    act(() => {
      result.current.updateTableDataItem({
        logs: [{ id: 'old' }] as any,
      });
    });

    // Act: updateLogs
    act(() => {
      result.current.updateLogs(
        {
          logs: [{ id: 'new' }] as any,
          params: {},
          count: 1,
          groups: {},
        },
        'replace'
      );
    });

    await waitFor(() => {
      expect(result.current.tableData.logs).toHaveLength(1);
      expect(result.current.tableData.logs[0].id).toBe('new');
    });
  });
});
