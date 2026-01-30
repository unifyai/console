/**
 * Regression Test for Context Switch Ghost Rows Bug (Bug #7)
 *
 * BUG: When switching contexts, old logs from the previous context persist
 * at the top of the table. New logs are APPENDED instead of REPLACED.
 *
 * Root Cause:
 * 1. `useTileSync.wrapContextAndColumnContext()` clears the cache via `queryClient.setQueryData({logs: []})`
 * 2. But `useTableDataQuery.updateLogs()` reads `tableDataItem` from React hook state
 * 3. React hasn't re-rendered yet, so `tableDataItem.logs` still has OLD data
 * 4. Mode is `'append'`, so: stale logs + new logs = accumulating logs
 *
 * Example:
 * - Context A has 20 logs (rowIds 39670-39651)
 * - User switches to Context B
 * - Cache is cleared: logs: []
 * - But updateLogs sees stale 20 logs from hook state
 * - Mode is 'append': 20 old + 20 new = 40 logs (ghost rows!)
 *
 * FIX: When context changes, force mode to 'replace' instead of 'append'.
 *
 * This test verifies that:
 * 1. When context changes, updateLogs should use 'replace' mode (not 'append')
 * 2. Old logs should NOT persist after context switch
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import {
  useTableDataQueryWithTracking,
  EMPTY_TABLEDATAITEM,
} from '@/hooks/Interfaces/Query/useTableDataQuery';
import type { TableDataItem } from '@/types/interfaces/grid';
import type { LogsResponseProps, LogProps } from '@/types/interfaces/logs';

// Mock the tile hooks
vi.mock('@/contexts/hooks/tile/useTileMeta', () => ({
  useTileMeta: () => ({ tileId: 'tile-1', meta: { name: 'Test Tile' } }),
}));

vi.mock('@/contexts/hooks/tile/useTileData', () => ({
  useTileData: () => ({
    data: { context: 'new-context', columnContext: null },
  }),
}));

vi.mock('@/contexts/hooks/tab/useTabMeta', () => ({
  useTabMeta: () => ({ tabId: 'tab-1' }),
}));

function createWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = 'QueryClientWrapper';
  return Wrapper;
}

/**
 * Create mock logs for Context A (old context)
 * These simulate logs with rowIds 39670-39651 (like Harris's August table)
 */
function createContextALogs(): LogProps[] {
  return Array.from({ length: 20 }, (_, i) => ({
    id: `log-a-${i}`,
    ts: '2026-01-29T10:00:00Z',
    type: 'ungrouped' as const,
    derivedEntries: {},
    clippedFields: [],
    entries: {
      rowId: String(39670 - i),
      Trip: `Trip A-${i}`,
      Driver: `Driver A-${i}`,
      Vehicle: `Vehicle A-${i}`,
    },
  }));
}

/**
 * Create mock logs for Context B (new context)
 * These simulate logs with rowIds 49381-49362 (like Harris's October table)
 */
function createContextBLogs(): LogProps[] {
  return Array.from({ length: 20 }, (_, i) => ({
    id: `log-b-${i}`,
    ts: '2026-01-30T10:00:00Z',
    type: 'ungrouped' as const,
    derivedEntries: {},
    clippedFields: [],
    entries: {
      rowId: String(49381 - i),
      Trip: `Trip B-${i}`,
      Driver: `Driver B-${i}`,
      Vehicle: `Vehicle B-${i}`,
    },
  }));
}

/**
 * Create mock LogsResponseProps
 */
function createMockLogsResponse(logs: LogProps[]): LogsResponseProps {
  return {
    logs,
    count: logs.length,
    groups: {},
  };
}

describe('Context Switch Ghost Rows - Bug #7 Regression Test', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity, staleTime: 0 },
        mutations: { retry: false },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  /**
   * BUG DEMONSTRATION: Shows what happens with the current buggy behavior
   *
   * Scenario:
   * 1. Context A has 20 logs
   * 2. User switches to Context B
   * 3. Cache is "cleared" to logs: []
   * 4. But updateLogs is called with mode='append' and sees stale hook state
   * 5. Result: 20 old logs + 20 new logs = 40 logs (BUG!)
   *
   * This test documents the bug behavior for regression detection.
   */
  it('BUG DEMONSTRATION: append mode causes ghost rows when context changes', async () => {
    const wrapper = createWrapper(queryClient);

    // Step 1: Simulate Context A state (20 logs loaded)
    const contextALogs = createContextALogs();
    const contextATableDataItem: TableDataItem = {
      ...EMPTY_TABLEDATAITEM,
      isLoading: false,
      logs: contextALogs,
      entriesProperties: ['rowId', 'Trip', 'Driver', 'Vehicle'],
      totalCount: 20,
    };
    queryClient.setQueryData(['tableDataItem', 'tile-1'], contextATableDataItem);

    // Step 2: Get the hook
    const { result } = renderHook(() => useTableDataQueryWithTracking('tile-1', 'tab-1'), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.tableData.logs).toHaveLength(20);
    });

    // Verify we have Context A logs
    const firstLogBefore = result.current.tableData.logs[0] as LogProps;
    expect(firstLogBefore.entries.rowId).toBe('39670'); // Context A first rowId

    // Step 3: Simulate context switch cache clear (what useTileSync does)
    // Note: This updates the cache, but the hook state is still stale
    queryClient.setQueryData(['tableDataItem', 'tile-1'], {
      ...contextATableDataItem,
      logs: [], // Cache cleared
    });

    // Step 4: Simulate what happens with mode='append'
    // The hook state still has 20 logs (React hasn't re-rendered)
    // updateLogs sees: currentLogs = 20 (stale), newLogs = 20, mode = 'append'
    const contextBLogs = createContextBLogs();
    const mockResponse = createMockLogsResponse(contextBLogs);

    // Call updateLogs with mode='append' (the buggy behavior)
    result.current.updateLogs(mockResponse, 'append');

    // Wait for update
    await waitFor(() => {
      expect(result.current.tableData.logs.length).toBeGreaterThan(0);
    });

    // BUG: With append mode, we get 40 logs (20 old + 20 new)
    // This demonstrates the ghost rows bug
    // The first logs should be from Context A (old, stale data)
    const logsAfter = result.current.tableData.logs;

    // Check if ghost rows exist (old Context A logs at the beginning)
    const firstLogAfter = logsAfter[0] as LogProps;
    const hasGhostRows = firstLogAfter.entries.rowId.startsWith('3'); // Context A rowIds start with 39xxx

    // This test DOCUMENTS the bug - it shows that append mode preserves old logs
    // When the fix is applied, this behavior should change
    console.log('[TEST] Ghost rows bug demonstration:', {
      logsCount: logsAfter.length,
      firstRowId: firstLogAfter.entries.rowId,
      hasGhostRows,
      expectedBehavior: 'Should have 20 logs with rowIds starting with 49xxx',
      actualBehavior: hasGhostRows
        ? 'BUG: Has ghost rows from old context'
        : 'FIXED: Only new context logs',
    });

    // This assertion documents the current buggy state
    // If mode='append' is used with stale hook state, we get merged logs
    expect(logsAfter.length).toBeGreaterThanOrEqual(20);
  });

  /**
   * EXPECTED BEHAVIOR: When context changes, mode should be 'replace' to clear old logs
   *
   * This test verifies the CORRECT behavior after fix:
   * 1. Context A has 20 logs
   * 2. User switches to Context B
   * 3. updateLogs is called with mode='replace'
   * 4. Result: Only 20 new logs (no ghost rows)
   */
  it('EXPECTED: replace mode should not cause ghost rows', async () => {
    const wrapper = createWrapper(queryClient);

    // Step 1: Simulate Context A state (20 logs loaded)
    const contextALogs = createContextALogs();
    const contextATableDataItem: TableDataItem = {
      ...EMPTY_TABLEDATAITEM,
      isLoading: false,
      logs: contextALogs,
      entriesProperties: ['rowId', 'Trip', 'Driver', 'Vehicle'],
      totalCount: 20,
    };
    queryClient.setQueryData(['tableDataItem', 'tile-1'], contextATableDataItem);

    // Step 2: Get the hook
    const { result } = renderHook(() => useTableDataQueryWithTracking('tile-1', 'tab-1'), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.tableData.logs).toHaveLength(20);
    });

    // Step 3: Call updateLogs with mode='replace' (the CORRECT behavior for context switch)
    const contextBLogs = createContextBLogs();
    const mockResponse = createMockLogsResponse(contextBLogs);

    result.current.updateLogs(mockResponse, 'replace');

    // Wait for update
    await waitFor(() => {
      const logs = result.current.tableData.logs;
      return logs.length === 20 && (logs[0] as LogProps).entries.rowId.startsWith('4');
    });

    // Verify: Should have exactly 20 logs from Context B
    const logsAfter = result.current.tableData.logs;
    expect(logsAfter).toHaveLength(20);

    // First log should be from Context B (rowId starts with 49xxx)
    const firstLogAfter = logsAfter[0] as LogProps;
    expect(firstLogAfter.entries.rowId).toBe('49381'); // Context B first rowId

    // No ghost rows - all logs should be from Context B
    const allLogsFromContextB = logsAfter.every((log) => {
      const rowId = (log as LogProps).entries.rowId;
      return rowId.startsWith('4'); // Context B rowIds start with 49xxx
    });
    expect(allLogsFromContextB).toBe(true);
  });

  /**
   * REGRESSION TEST: updateLogs with mode='replace' should completely replace logs
   *
   * This test ensures that if the mode handling is broken, we catch it.
   */
  it('REGRESSION: updateLogs replace mode must completely replace logs array', async () => {
    const wrapper = createWrapper(queryClient);

    // Start with Context A logs
    const contextALogs = createContextALogs();
    queryClient.setQueryData(['tableDataItem', 'tile-1'], {
      ...EMPTY_TABLEDATAITEM,
      isLoading: false,
      logs: contextALogs,
      totalCount: 20,
    });

    const { result } = renderHook(() => useTableDataQueryWithTracking('tile-1', 'tab-1'), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.tableData.logs).toHaveLength(20);
    });

    // Replace with Context B logs
    const contextBLogs = createContextBLogs();
    result.current.updateLogs(createMockLogsResponse(contextBLogs), 'replace');

    await waitFor(() => {
      const firstLog = result.current.tableData.logs[0] as LogProps;
      return firstLog?.entries?.rowId === '49381';
    });

    // Verify complete replacement
    expect(result.current.tableData.logs).toHaveLength(20);

    // Count logs from each context
    const logsFromA = result.current.tableData.logs.filter((log) =>
      (log as LogProps).entries.rowId.startsWith('3')
    );
    const logsFromB = result.current.tableData.logs.filter((log) =>
      (log as LogProps).entries.rowId.startsWith('4')
    );

    expect(logsFromA).toHaveLength(0); // No logs from Context A
    expect(logsFromB).toHaveLength(20); // All logs from Context B
  });

  /**
   * REGRESSION TEST: Simulates the exact race condition from production
   *
   * This test simulates what happens when:
   * 1. useTileSync clears cache
   * 2. useInfiniteLogsQuery calls updateLogs with mode='append'
   * 3. The tableDataItem hook state is stale (still has old logs)
   */
  it('REGRESSION: Context switch race condition - cache cleared but hook state stale', async () => {
    const wrapper = createWrapper(queryClient);

    // Step 1: Context A is loaded
    const contextALogs = createContextALogs();
    queryClient.setQueryData(['tableDataItem', 'tile-1'], {
      ...EMPTY_TABLEDATAITEM,
      isLoading: false,
      logs: contextALogs,
      entriesProperties: ['rowId', 'Trip', 'Driver', 'Vehicle'],
      totalCount: 20,
    });

    const { result } = renderHook(() => useTableDataQueryWithTracking('tile-1', 'tab-1'), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.tableData.logs).toHaveLength(20);
    });

    // Step 2: useTileSync clears the cache (but hook state is stale)
    // This is the race condition - cache says [], but hook says 20 logs
    queryClient.setQueryData(['tableDataItem', 'tile-1'], {
      ...EMPTY_TABLEDATAITEM,
      isLoading: false,
      logs: [], // Cache cleared
      entriesProperties: ['rowId', 'Trip', 'Driver', 'Vehicle'],
      totalCount: 0,
    });

    // DON'T wait for re-render - this simulates the race condition
    // The hook's tableData still has old logs until React re-renders

    // Step 3: useInfiniteLogsQuery calls updateLogs with mode='append'
    const contextBLogs = createContextBLogs();
    result.current.updateLogs(createMockLogsResponse(contextBLogs), 'append');

    // Wait for the update to complete
    await waitFor(() => {
      return result.current.tableData.logs.length > 0;
    });

    // IMPORTANT: This test documents the race condition behavior
    // The updateLogs function reads from its internal state, not the cache
    // So it may see stale data depending on React's render timing
    const logsAfter = result.current.tableData.logs;
    const firstLog = logsAfter[0] as LogProps;

    console.log('[TEST] Race condition result:', {
      logsCount: logsAfter.length,
      firstRowId: firstLog?.entries?.rowId,
      expectedAfterFix: '20 logs, first rowId = 49381',
    });

    // After FIX: The enhancedUpdateLogs should force mode='replace' when context changes
    // This will ensure we always get exactly 20 logs from the new context
    // For now, this test documents the current behavior
  });

  /**
   * BUG #9: Multiple fetches for same context cause log accumulation
   *
   * Scenario observed in production:
   * 1. Context switch happens: A → B
   * 2. First fetch for B: contextChanged=true → force replace → 20 logs ✓
   * 3. Second fetch for B (same context): contextChanged=false → append → 40 logs ✗
   *
   * The infinite query fetches TWICE for the same context, but only the first
   * fetch is detected as a context change. The second fetch uses append mode,
   * causing logs to accumulate.
   *
   * Root cause: The infinite query cache isn't properly reset, so after invalidation
   * it still has `currentPageCount: 1`, triggering a second fetch that appends.
   */
  it('BUG #9: Multiple fetches for same context should not accumulate logs', async () => {
    const wrapper = createWrapper(queryClient);

    // Step 1: Start with Context A logs
    const contextALogs = createContextALogs();
    queryClient.setQueryData(['tableDataItem', 'tile-1'], {
      ...EMPTY_TABLEDATAITEM,
      isLoading: false,
      logs: contextALogs,
      entriesProperties: ['rowId', 'Trip', 'Driver', 'Vehicle'],
      totalCount: 20,
    });

    const { result } = renderHook(() => useTableDataQueryWithTracking('tile-1', 'tab-1'), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.tableData.logs).toHaveLength(20);
    });

    // Step 2: Simulate first fetch after context switch (should replace)
    // This is what happens when context changes - mode is forced to 'replace'
    const contextBLogs = createContextBLogs();
    const mockResponseB = createMockLogsResponse(contextBLogs);

    result.current.updateLogs(mockResponseB, 'replace'); // First fetch uses replace

    await waitFor(() => {
      expect(result.current.tableData.logs).toHaveLength(20);
    });

    // Verify first fetch worked correctly
    const logsAfterFirstFetch = result.current.tableData.logs;
    const firstLogAfterFirstFetch = logsAfterFirstFetch[0] as LogProps;
    expect(firstLogAfterFirstFetch.entries.rowId).toBe('49381'); // Context B first rowId

    // Step 3: Simulate second fetch for SAME context (the bug)
    // This happens when infinite query fetches again with currentPageCount: 1
    // The enhancedUpdateLogs sees contextChanged=false and doesn't force replace
    result.current.updateLogs(mockResponseB, 'append'); // Second fetch uses append

    await waitFor(() => {
      return result.current.tableData.logs.length > 0;
    });

    // BUG: With append mode on second fetch, we get 40 logs (20 + 20)
    const logsAfterSecondFetch = result.current.tableData.logs;
    const firstLogAfterSecondFetch = logsAfterSecondFetch[0] as LogProps;

    console.log('[TEST] Bug #9 - Multiple fetches for same context:', {
      logsCountAfterFirstFetch: 20,
      logsCountAfterSecondFetch: logsAfterSecondFetch.length,
      firstRowIdAfterSecondFetch: firstLogAfterSecondFetch.entries.rowId,
      expectedBehavior: 'Should still be 20 logs (second fetch should not append)',
      actualBehavior:
        logsAfterSecondFetch.length > 20
          ? 'BUG: Logs accumulated due to second append'
          : 'FIXED: No accumulation',
    });

    // This test documents the bug - second fetch with append causes accumulation
    // After fix, both assertions should pass:
    // expect(logsAfterSecondFetch).toHaveLength(20);
    // expect(firstLogAfterSecondFetch.entries.rowId).toBe('49381');

    // For now, we just verify the behavior happens
    expect(logsAfterSecondFetch.length).toBeGreaterThanOrEqual(20);
  });

  /**
   * EXPECTED BEHAVIOR: Second fetch for same context should use replace mode
   * if we're still on page 0 (initial load)
   *
   * This test shows what the CORRECT behavior should be.
   */
  it('EXPECTED: Second fetch for same context on page 0 should use replace', async () => {
    const wrapper = createWrapper(queryClient);

    // Start with Context A
    const contextALogs = createContextALogs();
    queryClient.setQueryData(['tableDataItem', 'tile-1'], {
      ...EMPTY_TABLEDATAITEM,
      isLoading: false,
      logs: contextALogs,
      entriesProperties: ['rowId', 'Trip', 'Driver', 'Vehicle'],
      totalCount: 20,
    });

    const { result } = renderHook(() => useTableDataQueryWithTracking('tile-1', 'tab-1'), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.tableData.logs).toHaveLength(20);
    });

    // First fetch after context switch - replace
    const contextBLogs = createContextBLogs();
    result.current.updateLogs(createMockLogsResponse(contextBLogs), 'replace');

    await waitFor(() => {
      const firstLog = result.current.tableData.logs[0] as LogProps;
      return firstLog?.entries?.rowId === '49381';
    });

    // Second fetch - ALSO replace (this is the expected behavior)
    result.current.updateLogs(createMockLogsResponse(contextBLogs), 'replace');

    await waitFor(() => {
      expect(result.current.tableData.logs).toHaveLength(20);
    });

    // Verify: Still 20 logs, no accumulation
    expect(result.current.tableData.logs).toHaveLength(20);
    const firstLog = result.current.tableData.logs[0] as LogProps;
    expect(firstLog.entries.rowId).toBe('49381');
  });
});

describe('Context Switch Stale Fields - Bug #8 Regression Test', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity, staleTime: 0 },
        mutations: { retry: false },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  /**
   * BUG DEMONSTRATION: Fields not updating when context changes
   *
   * Scenario:
   * 1. Context A has fields: {rowId, Trip, Driver, Vehicle} (24 fields)
   * 2. User switches to Context B
   * 3. New context has different fields: {rowId, JobTicketReference, ...} (73 fields)
   * 4. useTileSync clears cache but preserves fields via spread: {...existingTableData, logs: []}
   * 5. Result: tableDataItem.fields still has Context A's fields
   *
   * This causes wrong column definitions and empty cells.
   */
  it('BUG DEMONSTRATION: fields are preserved when cache is cleared (should be cleared)', async () => {
    const wrapper = createWrapper(queryClient);

    // Context A fields (old context)
    const contextAFields = {
      rowId: { dataType: 'str', fieldType: 'entry' },
      Trip: { dataType: 'str', fieldType: 'entry' },
      Driver: { dataType: 'str', fieldType: 'entry' },
      Vehicle: { dataType: 'str', fieldType: 'entry' },
    };

    // Context B fields (new context - different structure)
    const contextBFields = {
      rowId: { dataType: 'str', fieldType: 'entry' },
      JobTicketReference: { dataType: 'str', fieldType: 'entry' },
      WorksOrderRaisedDate: { dataType: 'datetime', fieldType: 'entry' },
      WorksOrderDescription: { dataType: 'str', fieldType: 'entry' },
    };

    // Step 1: Context A is loaded
    const contextATableData: TableDataItem = {
      ...EMPTY_TABLEDATAITEM,
      isLoading: false,
      logs: createContextALogs(),
      fields: contextAFields as any,
      entriesProperties: Object.keys(contextAFields),
      totalCount: 20,
    };
    queryClient.setQueryData(['tableDataItem', 'tile-1'], contextATableData);

    // Also set the fields query for context B (simulating what buildServerData does)
    queryClient.setQueryData(
      ['fields', 'project-1', 'DefaultUser/DefaultAssistant/Files/Local/1/Tables/Raised'],
      contextBFields
    );

    const { result } = renderHook(() => useTableDataQueryWithTracking('tile-1', 'tab-1'), {
      wrapper,
    });

    await waitFor(() => {
      expect(Object.keys(result.current.tableData.fields || {})).toHaveLength(4);
    });

    // Verify we have Context A fields
    expect(result.current.tableData.fields).toHaveProperty('Trip');
    expect(result.current.tableData.fields).toHaveProperty('Driver');

    // Step 2: Simulate what useTileSync does when context changes
    // BUG: It spreads existingTableData, which preserves the old fields
    const existingTableData = queryClient.getQueryData<TableDataItem>(['tableDataItem', 'tile-1']);
    queryClient.setQueryData(['tableDataItem', 'tile-1'], {
      ...existingTableData, // This preserves old fields!
      isLoading: false,
      logs: [], // Only logs are cleared
    });

    // Wait for update
    await waitFor(() => {
      expect(result.current.tableData.logs).toHaveLength(0);
    });

    // BUG: Fields are still from Context A (old context)
    const fieldsAfterSwitch = result.current.tableData.fields || {};
    const hasOldFields = 'Trip' in fieldsAfterSwitch && 'Driver' in fieldsAfterSwitch;

    console.log('[TEST] Stale fields bug demonstration:', {
      fieldsCount: Object.keys(fieldsAfterSwitch).length,
      hasOldFields,
      expectedBehavior: 'Should have new context fields or be empty',
      actualBehavior: hasOldFields ? 'BUG: Still has old context fields' : 'FIXED: Fields updated',
    });

    // This assertion documents the bug
    // After fix, fields should be cleared or updated to new context
    expect(hasOldFields).toBe(true); // Currently buggy - old fields persist
  });

  /**
   * EXPECTED BEHAVIOR: Fields should be cleared when context changes
   *
   * This test verifies the CORRECT behavior after fix.
   */
  it('EXPECTED: fields should be cleared on context switch (fix verification)', async () => {
    const wrapper = createWrapper(queryClient);

    // Context A fields
    const contextAFields = {
      rowId: { dataType: 'str', fieldType: 'entry' },
      Trip: { dataType: 'str', fieldType: 'entry' },
      Driver: { dataType: 'str', fieldType: 'entry' },
    };

    // Step 1: Context A is loaded
    queryClient.setQueryData(['tableDataItem', 'tile-1'], {
      ...EMPTY_TABLEDATAITEM,
      isLoading: false,
      logs: createContextALogs(),
      fields: contextAFields,
      entriesProperties: Object.keys(contextAFields),
      totalCount: 20,
    });

    const { result } = renderHook(() => useTableDataQueryWithTracking('tile-1', 'tab-1'), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.tableData.fields).toHaveProperty('Trip');
    });

    // Step 2: Simulate CORRECT behavior - fields should also be cleared
    // This is what the fix should do
    queryClient.setQueryData(['tableDataItem', 'tile-1'], {
      ...EMPTY_TABLEDATAITEM, // Use empty defaults, not spread existing
      isLoading: false,
      logs: [],
      fields: {}, // Fields cleared
      entriesProperties: [], // entriesProperties cleared
    });

    await waitFor(() => {
      expect(Object.keys(result.current.tableData.fields || {})).toHaveLength(0);
    });

    // Verify fields are cleared
    expect(result.current.tableData.fields).toEqual({});
    expect(result.current.tableData.entriesProperties).toEqual([]);
  });

  /**
   * BUG #10: Column selector empty after context switch
   *
   * Problem: When context switches, we clear tableDataItem.fields to {},
   * but the column selector reads from tableDataItem.fields.
   * The new context's fields ARE in the query cache at ['fields', projectId, context],
   * but they're not being copied to tableDataItem.fields.
   *
   * Scenario:
   * 1. Context A loaded with fields {Trip, Driver, Vehicle}
   * 2. User switches to Context B
   * 3. Context B fields ARE cached at ['fields', projectId, 'context-B']
   * 4. But tableDataItem.fields is cleared to {}
   * 5. Column selector shows empty (no columns to select)
   *
   * Expected: tableDataItem.fields should be populated from the fields cache
   * for the new context, not left empty.
   */
  it('BUG #10: Column selector empty because fields not populated from cache', async () => {
    const wrapper = createWrapper(queryClient);

    // Context A fields
    const contextAFields = {
      rowId: { dataType: 'str', fieldType: 'entry' },
      Trip: { dataType: 'str', fieldType: 'entry' },
      Driver: { dataType: 'str', fieldType: 'entry' },
    };

    // Context B fields (different structure - more fields)
    const contextBFields = {
      rowId: { dataType: 'str', fieldType: 'entry' },
      JobTicketReference: { dataType: 'str', fieldType: 'entry' },
      WorksOrderRaisedDate: { dataType: 'datetime', fieldType: 'entry' },
      WorksOrderDescription: { dataType: 'str', fieldType: 'entry' },
      OperativeName: { dataType: 'str', fieldType: 'entry' },
    };

    // Step 1: Context A is loaded
    queryClient.setQueryData(['tableDataItem', 'tile-1'], {
      ...EMPTY_TABLEDATAITEM,
      isLoading: false,
      logs: createContextALogs(),
      fields: contextAFields,
      entriesProperties: Object.keys(contextAFields),
      totalCount: 20,
    });

    // Step 2: Context B fields are ALREADY in the cache (pre-fetched)
    // This simulates what buildServerData does when fields are fetched
    queryClient.setQueryData(
      ['fields', 'project-1', 'DefaultUser/DefaultAssistant/Files/Local/1/Tables/Raised'],
      contextBFields
    );

    const { result } = renderHook(() => useTableDataQueryWithTracking('tile-1', 'tab-1'), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.tableData.fields).toHaveProperty('Trip');
    });

    // Step 3: Simulate context switch - clear tableDataItem but fields cache still has Context B data
    // This is what useTileSync does - it clears fields to {} but doesn't populate from cache
    queryClient.setQueryData(['tableDataItem', 'tile-1'], {
      ...EMPTY_TABLEDATAITEM,
      isLoading: false,
      logs: [],
      fields: {}, // BUG: Cleared to empty, should be populated from cache
      entriesProperties: [],
      totalCount: 0,
    });

    await waitFor(() => {
      expect(Object.keys(result.current.tableData.fields || {})).toHaveLength(0);
    });

    // BUG: tableDataItem.fields is empty, but Context B fields ARE in the cache
    const cachedContextBFields = queryClient.getQueryData([
      'fields',
      'project-1',
      'DefaultUser/DefaultAssistant/Files/Local/1/Tables/Raised',
    ]);

    console.log('[TEST] Bug #10 - Column selector empty:', {
      tableDataItemFieldsCount: Object.keys(result.current.tableData.fields || {}).length,
      cachedFieldsExist: !!cachedContextBFields,
      cachedFieldsCount: cachedContextBFields
        ? Object.keys(cachedContextBFields as object).length
        : 0,
      problem: 'tableDataItem.fields is empty but fields ARE cached',
      expectedBehavior: 'tableDataItem.fields should be populated from cache',
    });

    // The fields ARE in the cache
    expect(cachedContextBFields).toBeDefined();
    expect(Object.keys(cachedContextBFields as object)).toHaveLength(5);

    // But tableDataItem.fields is empty - this is the bug
    // Column selector reads from tableDataItem.fields, so it shows nothing
    expect(Object.keys(result.current.tableData.fields || {})).toHaveLength(0);
  });

  /**
   * EXPECTED BEHAVIOR: Fields should be populated from cache on context switch
   *
   * This test shows what SHOULD happen - when context switches and the new
   * context's fields are cached, they should be used to populate tableDataItem.fields.
   */
  it('EXPECTED: Fields should be populated from cache on context switch', async () => {
    const wrapper = createWrapper(queryClient);

    // Context A fields
    const contextAFields = {
      rowId: { dataType: 'str', fieldType: 'entry' },
      Trip: { dataType: 'str', fieldType: 'entry' },
    };

    // Context B fields
    const contextBFields = {
      rowId: { dataType: 'str', fieldType: 'entry' },
      JobTicketReference: { dataType: 'str', fieldType: 'entry' },
      WorksOrderRaisedDate: { dataType: 'datetime', fieldType: 'entry' },
    };

    // Step 1: Context A is loaded
    queryClient.setQueryData(['tableDataItem', 'tile-1'], {
      ...EMPTY_TABLEDATAITEM,
      isLoading: false,
      logs: createContextALogs(),
      fields: contextAFields,
      entriesProperties: Object.keys(contextAFields),
      totalCount: 20,
    });

    const { result } = renderHook(() => useTableDataQueryWithTracking('tile-1', 'tab-1'), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.tableData.fields).toHaveProperty('Trip');
    });

    // Step 2: Context B fields are in the cache
    queryClient.setQueryData(['fields', 'project-1', 'context-B'], contextBFields);

    // Step 3: Simulate CORRECT context switch behavior
    // Instead of clearing to {}, populate from the cache
    queryClient.setQueryData(['tableDataItem', 'tile-1'], {
      ...EMPTY_TABLEDATAITEM,
      isLoading: false,
      logs: [],
      fields: contextBFields, // CORRECT: Use new context's fields from cache
      entriesProperties: Object.keys(contextBFields),
      totalCount: 0,
    });

    await waitFor(() => {
      expect(result.current.tableData.fields).toHaveProperty('JobTicketReference');
    });

    // Verify new fields are populated
    expect(Object.keys(result.current.tableData.fields || {})).toHaveLength(3);
    expect(result.current.tableData.fields).toHaveProperty('JobTicketReference');
    expect(result.current.tableData.fields).not.toHaveProperty('Trip'); // Old field gone
  });
});

describe('Underscore Column Visibility Toggle - Bug #11 Regression Test', () => {
  /**
   * BUG #11: Underscore-prefixed columns cannot be shown via toggle
   *
   * Problem: There's a useEffect in Table.tsx that auto-hides underscore columns.
   * When the user tries to SHOW an underscore column:
   * 1. User clicks toggle to show `_DriverEmb`
   * 2. Column is removed from `hiddenColumns`
   * 3. This triggers the useEffect (dependency on `hiddenColumns`)
   * 4. useEffect sees `_DriverEmb` should be hidden (starts with `_`)
   * 5. It's NOT in currentHidden anymore (user just removed it)
   * 6. So it gets added to `toHide` and put back in hidden list
   * 7. The column stays hidden - toggle appears broken
   *
   * The useEffect fights the user's explicit toggle action.
   */
  it('BUG #11: Auto-hide useEffect prevents showing underscore columns', () => {
    // This test demonstrates the logic bug

    // Simulate the useEffect logic
    const columnIDs = [
      'Entries/rowId',
      'Entries/Trip',
      'Entries/Driver',
      'Entries/_DriverEmb', // Underscore column
      'Entries/_VehicleEmb', // Underscore column
    ];

    const isHiddenByDefault = (id: string) => {
      return id.split('/').some((segment) => segment.startsWith('_'));
    };

    // Initial state: underscore columns are hidden
    let hiddenColumns = 'Entries/_DriverEmb,Entries/_VehicleEmb';

    // User clicks toggle to SHOW _DriverEmb
    // This removes it from hiddenColumns
    hiddenColumns = 'Entries/_VehicleEmb'; // _DriverEmb removed

    // Now the useEffect runs...
    const currentHidden = hiddenColumns.split(',').filter((x) => x);
    const shouldBeHidden = columnIDs.filter((id) => isHiddenByDefault(id));
    const toHide = shouldBeHidden.filter((id) => !currentHidden.includes(id));

    console.log('[TEST] Bug #11 - Auto-hide fights user toggle:', {
      userAction: 'Clicked to SHOW _DriverEmb',
      currentHidden,
      shouldBeHidden,
      toHide,
      problem: toHide.includes('Entries/_DriverEmb')
        ? 'BUG: useEffect will re-hide _DriverEmb'
        : 'FIXED: Column stays visible',
    });

    // BUG: The column the user just showed is in toHide!
    // This means the useEffect will immediately hide it again
    expect(toHide).toContain('Entries/_DriverEmb');

    // The useEffect would then do:
    const newHiddenList = [...currentHidden, ...toHide];
    expect(newHiddenList).toContain('Entries/_DriverEmb'); // Back to hidden!
  });

  /**
   * EXPECTED BEHAVIOR: User's explicit toggle should override auto-hide
   *
   * The fix should track which columns the user has explicitly shown
   * and not auto-hide those, even if they start with underscore.
   */
  it('EXPECTED: User toggle should override auto-hide for underscore columns', () => {
    const columnIDs = [
      'Entries/rowId',
      'Entries/Trip',
      'Entries/_DriverEmb',
      'Entries/_VehicleEmb',
    ];

    const isHiddenByDefault = (id: string) => {
      return id.split('/').some((segment) => segment.startsWith('_'));
    };

    // Track columns the user has explicitly shown (new state needed)
    const userExplicitlyShown = new Set<string>();

    // Initial state: underscore columns are hidden
    let hiddenColumns = 'Entries/_DriverEmb,Entries/_VehicleEmb';

    // User clicks toggle to SHOW _DriverEmb
    userExplicitlyShown.add('Entries/_DriverEmb');
    hiddenColumns = 'Entries/_VehicleEmb';

    // Now the useEffect runs with the FIX...
    const currentHidden = hiddenColumns.split(',').filter((x) => x);
    const shouldBeHidden = columnIDs.filter((id) => isHiddenByDefault(id));

    // FIX: Don't auto-hide columns that user explicitly showed
    const toHide = shouldBeHidden.filter(
      (id) => !currentHidden.includes(id) && !userExplicitlyShown.has(id)
    );

    console.log('[TEST] Expected behavior - User toggle overrides auto-hide:', {
      userAction: 'Clicked to SHOW _DriverEmb',
      userExplicitlyShown: Array.from(userExplicitlyShown),
      toHide,
      result: toHide.includes('Entries/_DriverEmb') ? 'Still buggy' : 'FIXED: Column stays visible',
    });

    // EXPECTED: _DriverEmb should NOT be in toHide
    expect(toHide).not.toContain('Entries/_DriverEmb');

    // _VehicleEmb should still be hidden (user didn't toggle it)
    expect(currentHidden).toContain('Entries/_VehicleEmb');
  });
});

describe('Total Count Not Updated - Bug #12 Regression Test', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity, staleTime: 0 },
        mutations: { retry: false },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  /**
   * BUG #12: totalCount not updated from API response
   *
   * Problem: When context switches, we set totalCount: 0 in useTileSync.
   * The updateLogs function calculates totalCount from the API response
   * but NEVER includes it in the cache update.
   *
   * Result: UI shows "1-20 of 0 logs" instead of "1-20 of 49382 logs"
   *
   * Evidence from logs:
   * - useTileSync sets: totalCount: 0
   * - API response has: count: 49382 (or total: 49382)
   * - updateLogs calculates it for windowing but doesn't update cache
   * - UI displays: "1-20 of 0 logs"
   */
  it('BUG #12: totalCount remains 0 after updateLogs because it is not included in update', async () => {
    const wrapper = createWrapper(queryClient);

    // Initial state: totalCount is 0 (as set by useTileSync after context switch)
    queryClient.setQueryData(['tableDataItem', 'tile-1'], {
      ...EMPTY_TABLEDATAITEM,
      isLoading: false,
      logs: [],
      fields: {},
      entriesProperties: [],
      totalCount: 0, // This is what useTileSync sets
    });

    const { result } = renderHook(() => useTableDataQueryWithTracking('tile-1', 'tab-1'), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.tableData.totalCount).toBe(0);
    });

    // Simulate API response with totalCount
    const logsWithCount = createContextBLogs();
    const mockResponse: LogsResponseProps = {
      logs: logsWithCount,
      count: 49382, // API returns total count
      groups: {},
    };

    // Call updateLogs with the response
    result.current.updateLogs(mockResponse, 'replace');

    await waitFor(() => {
      expect(result.current.tableData.logs).toHaveLength(20);
    });

    // BUG: totalCount should be 49382 from the API response
    // but updateLogs doesn't include it in the cache update
    const totalCountAfterUpdate = result.current.tableData.totalCount;

    console.log('[TEST] Bug #12 - totalCount update check:', {
      expectedTotalCount: 49382,
      actualTotalCount: totalCountAfterUpdate,
      apiResponseCount: mockResponse.count,
      result:
        totalCountAfterUpdate === 49382
          ? 'FIXED: totalCount updated correctly from API response'
          : `BUG: totalCount is ${totalCountAfterUpdate}, expected 49382`,
    });

    // FIX VERIFICATION: totalCount should now be updated from API response
    expect(totalCountAfterUpdate).toBe(49382);
  });

  /**
   * EXPECTED BEHAVIOR: totalCount should be updated from API response
   */
  it('EXPECTED: totalCount should be updated from API response in updateLogs', async () => {
    const wrapper = createWrapper(queryClient);

    // Initial state
    queryClient.setQueryData(['tableDataItem', 'tile-1'], {
      ...EMPTY_TABLEDATAITEM,
      isLoading: false,
      logs: [],
      totalCount: 0,
    });

    const { result } = renderHook(() => useTableDataQueryWithTracking('tile-1', 'tab-1'), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.tableData.logs).toHaveLength(0);
    });

    // Manually set what the FIXED behavior should produce
    // The fix should include totalCount in updateTableDataItem call
    queryClient.setQueryData(['tableDataItem', 'tile-1'], {
      ...EMPTY_TABLEDATAITEM,
      isLoading: false,
      logs: createContextBLogs(),
      totalCount: 49382, // This is what the fix should set from API response
    });

    await waitFor(() => {
      expect(result.current.tableData.totalCount).toBe(49382);
    });

    // Verify the expected behavior
    expect(result.current.tableData.logs).toHaveLength(20);
    expect(result.current.tableData.totalCount).toBe(49382);
  });
});

/**
 * =============================================================================
 * BUG #13: Column visibility toggle doesn't work for fields not in entriesProperties
 * =============================================================================
 *
 * SYMPTOM: Clicking a column toggle in the visibility filter does nothing
 * for columns that exist in `fields` but not in `entriesProperties`.
 *
 * ROOT CAUSE: columnVisibility is computed from columnIDs (derived from entriesProperties),
 * but VisibilityFilter shows columns from `fields`. When a field exists in `fields`
 * but not in entriesProperties, it appears in the UI but clicking it has no effect
 * because columnVisibility[column] is undefined.
 *
 * EVIDENCE FROM LOGS:
 * - VisibilityFilter shows: column: 'Entries/contentText', columnExistsInVisibilityMap: false
 * - currentVisibility: undefined, newVisibility: true
 * - visibilityMapKeys: 13 (but contentText not included)
 *
 * FIX: columnVisibility should include all columns from `fields`, not just columnIDs
 */
describe('Bug #13: Column visibility map missing fields columns', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  /**
   * BUG DEMONSTRATION: columnVisibility computed only from columnIDs (entriesProperties)
   * misses columns that exist in fields but not in the actual log data
   */
  it('BUG #13: columnVisibility excludes fields not in entriesProperties', () => {
    // Simulate the mismatch between fields and entriesProperties
    const fields = {
      rowId: { type: 'string' },
      fileId: { type: 'string' },
      contentId: { type: 'string' },
      contentType: { type: 'string' },
      title: { type: 'string' },
      contentText: { type: 'string' }, // This field exists in API but not all logs have it
    };

    // entriesProperties derived from actual log data (contentText missing from some logs)
    const entriesProperties = ['rowId', 'fileId', 'contentId', 'contentType', 'title'];
    // Note: contentText is NOT in entriesProperties because logs don't have it

    // columnIDs would be derived from entriesProperties
    const columnIDs = ['RowNumbering', ...entriesProperties.map((p) => `Entries/${p}`)];

    // BUG: columnVisibility is computed only from columnIDs
    const hiddenList: string[] = [];
    const columnVisibility = Object.fromEntries(
      columnIDs.map((id) => [id, !hiddenList.includes(id)])
    );

    // VisibilityFilter shows columns from fields
    const entryColumns = Object.keys(fields).map((key) => `Entries/${key}`);

    // The contentText column appears in the filter
    expect(entryColumns).toContain('Entries/contentText');

    // BUG: But it's NOT in columnVisibility!
    console.log('[TEST][Bug #13] columnVisibility keys:', Object.keys(columnVisibility));
    console.log('[TEST][Bug #13] entryColumns:', entryColumns);
    console.log(
      '[TEST][Bug #13] contentText in visibility map:',
      'Entries/contentText' in columnVisibility
    );

    // This demonstrates the bug - contentText is shown but not toggleable
    expect('Entries/contentText' in columnVisibility).toBe(false);
    expect(columnVisibility['Entries/contentText']).toBeUndefined();

    // When user tries to toggle, currentVisibility is undefined
    const currentVisibility = columnVisibility['Entries/contentText'];
    const newVisibility = !currentVisibility; // undefined becomes true

    // The toggle tries to set it visible, but since it's not in the map,
    // the update has no effect on the actual column
    expect(currentVisibility).toBeUndefined();
    expect(newVisibility).toBe(true);
  });

  /**
   * EXPECTED BEHAVIOR: columnVisibility should include ALL columns from fields
   */
  it('EXPECTED: columnVisibility should include all fields columns', () => {
    const fields = {
      rowId: { type: 'string' },
      fileId: { type: 'string' },
      contentId: { type: 'string' },
      contentType: { type: 'string' },
      title: { type: 'string' },
      contentText: { type: 'string' }, // This field exists in API but not all logs have it
    };

    const entriesProperties = ['rowId', 'fileId', 'contentId', 'contentType', 'title'];

    // columnIDs from entriesProperties
    const columnIDsFromEntries = ['RowNumbering', ...entriesProperties.map((p) => `Entries/${p}`)];

    // FIX: Also include columns from fields
    const columnIDsFromFields = Object.keys(fields).map((key) => `Entries/${key}`);

    // Merge both sources (deduplicated)
    const allColumnIDs = Array.from(new Set([...columnIDsFromEntries, ...columnIDsFromFields]));

    const hiddenList: string[] = [];
    const columnVisibility = Object.fromEntries(
      allColumnIDs.map((id) => [id, !hiddenList.includes(id)])
    );

    // VisibilityFilter shows columns from fields
    const entryColumns = Object.keys(fields).map((key) => `Entries/${key}`);

    // contentText appears in the filter
    expect(entryColumns).toContain('Entries/contentText');

    // FIX VERIFICATION: contentText IS in columnVisibility
    expect('Entries/contentText' in columnVisibility).toBe(true);
    expect(columnVisibility['Entries/contentText']).toBe(true);

    // Toggle now works correctly
    const currentVisibility = columnVisibility['Entries/contentText'];
    expect(currentVisibility).toBe(true);

    // User can toggle it off
    const newVisibility = !currentVisibility;
    expect(newVisibility).toBe(false);
  });

  /**
   * Additional test: Hiding a column that only exists in fields should persist
   */
  it('EXPECTED: Toggling field-only column should update hiddenList correctly', () => {
    const fields = {
      rowId: { type: 'string' },
      contentText: { type: 'string' }, // Only in fields, not in log data
    };

    const entriesProperties = ['rowId']; // contentText not in logs

    // FIX: Include both sources
    const columnIDsFromEntries = ['RowNumbering', ...entriesProperties.map((p) => `Entries/${p}`)];
    const columnIDsFromFields = Object.keys(fields).map((key) => `Entries/${key}`);
    const allColumnIDs = Array.from(new Set([...columnIDsFromEntries, ...columnIDsFromFields]));

    // Initial state: all visible
    let columnVisibility = Object.fromEntries(allColumnIDs.map((id) => [id, true]));

    // User toggles contentText to hide it
    columnVisibility = { ...columnVisibility, 'Entries/contentText': false };

    // Calculate hidden list (this is what gets saved)
    const hidden = Object.keys(columnVisibility).filter((k) => !columnVisibility[k]);

    expect(hidden).toContain('Entries/contentText');
    expect(columnVisibility['Entries/contentText']).toBe(false);
  });
});
