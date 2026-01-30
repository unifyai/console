/**
 * Regression Test for Context Switch entriesProperties Bug
 *
 * BUG (FIXED): When switching contexts with `rebuildTableData: false` optimization,
 * `updateLogs()` only updated the `logs` array but NOT `entriesProperties`.
 * This caused the table to render with empty columns because column definitions
 * were missing.
 *
 * Root Cause: Commit 5bba267bc (Dec 9, 2025) - "Interface robustness (#133)"
 * Changed `rebuildTableData: true` → `rebuildTableData: false` to avoid UI flash.
 * This optimization skipped `fetchAndBuildTableDataItem()` → `extractLogsData()`,
 * so `entriesProperties` was never derived from the new context's `fields`.
 *
 * FIX (Elegant Solution):
 * 1. `updateLogs()` now accepts an optional `entriesProperties` parameter
 * 2. `Table.tsx`'s `enhancedUpdateLogs` wrapper derives `entriesProperties` via `extractLogsData`
 * 3. The derived `entriesProperties` is passed through to `updateLogs` in a single atomic call
 * 4. This avoids race conditions between separate `updateTableDataItem` calls
 *
 * ADDITIONAL FIX (Context Switch with Stale entriesProperties):
 * The original fix only derived `entriesProperties` when it was empty.
 * But when switching contexts, the old context's `entriesProperties` is NOT empty -
 * it contains stale field names from the previous context.
 *
 * Example:
 * - Context A (Content): entriesProperties = ['rowId', 'fileId', 'contentId', ...]
 * - User switches to Context B (August_2025)
 * - Logs are fetched with entries: ['rowId', 'Trip', 'Driver', 'Vehicle', ...]
 * - But entriesProperties still has old fields → empty columns for Trip, Driver, etc.
 *
 * FIX: Track the context for which entriesProperties was derived.
 * When context changes, re-derive entriesProperties even if it's not empty.
 *
 * This test verifies that when `entriesProperties` is passed to `updateLogs()`,
 * it correctly updates the cache. If someone removes the `entriesProperties` parameter
 * handling from `updateLogs()`, this test will FAIL.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useTableDataQueryWithTracking,
  EMPTY_TABLEDATAITEM,
} from '@/hooks/Interfaces/Query/useTableDataQuery';
import type { LogsActions, TableDataItem } from '@/types/interfaces/grid';
import type { LogFieldsResponseProps, LogsResponseProps, LogProps } from '@/types/interfaces/logs';

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
 * Create mock fields for a context - simulates what the /api/logs/fields endpoint returns
 */
function createMockFields(): LogFieldsResponseProps {
  return {
    rowId: {
      dataType: 'str',
      fieldType: 'entry',
      artifacts: '',
      mutable: 'false',
      createdAt: '2026-01-29T00:00:00Z',
    },
    Trip: {
      dataType: 'str',
      fieldType: 'entry',
      artifacts: '',
      mutable: 'false',
      createdAt: '2026-01-29T00:00:00Z',
    },
    Driver: {
      dataType: 'str',
      fieldType: 'entry',
      artifacts: '',
      mutable: 'false',
      createdAt: '2026-01-29T00:00:00Z',
    },
    Vehicle: {
      dataType: 'str',
      fieldType: 'entry',
      artifacts: '',
      mutable: 'false',
      createdAt: '2026-01-29T00:00:00Z',
    },
    Departure: {
      dataType: 'datetime',
      fieldType: 'entry',
      artifacts: '',
      mutable: 'false',
      createdAt: '2026-01-29T00:00:00Z',
    },
    StartLocation: {
      dataType: 'str',
      fieldType: 'entry',
      artifacts: '',
      mutable: 'false',
      createdAt: '2026-01-29T00:00:00Z',
    },
    EndLocation: {
      dataType: 'str',
      fieldType: 'entry',
      artifacts: '',
      mutable: 'false',
      createdAt: '2026-01-29T00:00:00Z',
    },
    Arrival: {
      dataType: 'datetime',
      fieldType: 'entry',
      artifacts: '',
      mutable: 'false',
      createdAt: '2026-01-29T00:00:00Z',
    },
  };
}

/**
 * Create mock logs that have entries matching the fields
 */
function createMockLogs(): LogProps[] {
  return [
    {
      id: 'log-1',
      ts: '2026-01-29T10:00:00Z',
      type: 'ungrouped' as const,
      derivedEntries: {},
      clippedFields: [],
      entries: {
        rowId: '1',
        Trip: 'Trip A',
        Driver: 'John',
        Vehicle: 'Car 1',
        Departure: '2026-01-29T08:00:00Z',
        StartLocation: 'Office',
        EndLocation: 'Client',
        Arrival: '2026-01-29T09:00:00Z',
      },
    },
    {
      id: 'log-2',
      ts: '2026-01-29T11:00:00Z',
      type: 'ungrouped' as const,
      derivedEntries: {},
      clippedFields: [],
      entries: {
        rowId: '2',
        Trip: 'Trip B',
        Driver: 'Jane',
        Vehicle: 'Car 2',
        Departure: '2026-01-29T10:00:00Z',
        StartLocation: 'Home',
        EndLocation: 'Office',
        Arrival: '2026-01-29T10:30:00Z',
      },
    },
  ];
}

/**
 * Create mock LogsResponseProps (what the /api/logs endpoint returns)
 */
function createMockLogsResponse(): LogsResponseProps {
  const logs = createMockLogs();
  return {
    logs,
    count: logs.length,
    groups: {},
  };
}

describe('Context Switch entriesProperties - Regression Test', () => {
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
   * Regression test: updateLogs() must accept and apply entriesProperties parameter.
   *
   * Scenario (simulates Table.tsx's enhancedUpdateLogs):
   * 1. tableDataItem cache has entriesProperties: [] (cleared during context switch)
   * 2. Logs are fetched with entries
   * 3. Caller derives entriesProperties (like enhancedUpdateLogs does via extractLogsData)
   * 4. updateLogs() is called with entriesProperties passed as the last parameter
   * 5. EXPECTED: entriesProperties should be updated in a single atomic call
   *
   * FIX: updateLogs() now accepts entriesProperties as an optional last parameter.
   * If someone removes this parameter handling, this test will FAIL.
   */
  it('updateLogs should accept entriesProperties parameter and update cache (REGRESSION TEST)', async () => {
    const wrapper = createWrapper(queryClient);

    // Step 1: Simulate state AFTER context switch clears the cache
    // This is what useTileSync.wrapContextAndColumnContext does
    const clearedTableDataItem: TableDataItem = {
      ...EMPTY_TABLEDATAITEM,
      isLoading: false, // Fixed from deadlock bug
      logs: [],
      entriesProperties: [], // Empty because cache was cleared
      fields: {}, // Empty because we're fetching fresh
    };
    queryClient.setQueryData(['tableDataItem', 'tile-1'], clearedTableDataItem);

    // Step 2: Get the tableDataQueryWithTracking hook
    const { result } = renderHook(() => useTableDataQueryWithTracking('tile-1', 'tab-1'), {
      wrapper,
    });

    // Wait for initial render
    await waitFor(() => {
      expect(result.current.tableData).toBeDefined();
    });

    // Step 3: Simulate what Table.tsx's enhancedUpdateLogs does:
    // - Fetch logs
    // - Derive entriesProperties from log entries (simulating extractLogsData)
    // - Pass both to updateLogs in a single call
    const mockLogsResponse = createMockLogsResponse();

    // Derive entriesProperties from the first log's entries (what extractLogsData does)
    const logsArray = Array.isArray(mockLogsResponse.logs) ? mockLogsResponse.logs : [];
    const derivedEntriesProperties = Object.keys(logsArray[0]?.entries || {});

    act(() => {
      // Call updateLogs with entriesProperties as the last parameter
      // This simulates what enhancedUpdateLogs does in Table.tsx
      result.current.updateLogs(
        mockLogsResponse,
        'replace',
        null, // targetGroupId
        undefined, // targetGroupFilters
        undefined, // preConvertedLogs
        undefined, // windowConfig
        undefined, // currentOffsets
        derivedEntriesProperties // entriesProperties - THE FIX
      );
    });

    // Wait for the update to propagate
    await waitFor(() => {
      expect(result.current.tableData.logs.length).toBeGreaterThan(0);
    });

    // Step 4: Verify logs were updated
    expect(result.current.tableData.logs).toHaveLength(2);
    expect(result.current.tableData.logs[0].entries).toHaveProperty('Trip');

    // Step 5: Verify entriesProperties was updated (THE FIX)
    // This is the key assertion - if entriesProperties parameter handling is removed,
    // this will FAIL because entriesProperties will remain empty
    expect(
      result.current.tableData.entriesProperties.length,
      'entriesProperties should be updated when passed to updateLogs()'
    ).toBeGreaterThan(0);

    // Verify it contains the expected keys
    expect(result.current.tableData.entriesProperties).toEqual(
      expect.arrayContaining(['rowId', 'Trip', 'Driver', 'Vehicle'])
    );

    // Verify all 8 fields are present
    expect(result.current.tableData.entriesProperties.length).toBe(8);
  });

  /**
   * Regression test: Verify that NOT passing entriesProperties leaves it empty.
   * This documents the original bug behavior - if updateLogs is called without
   * entriesProperties (like a broken enhancedUpdateLogs would), columns won't render.
   */
  it('updateLogs WITHOUT entriesProperties should NOT update entriesProperties (documents bug)', async () => {
    const wrapper = createWrapper(queryClient);

    // Simulate cleared cache state
    const clearedTableDataItem: TableDataItem = {
      ...EMPTY_TABLEDATAITEM,
      isLoading: false,
      logs: [],
      entriesProperties: [], // Empty
      fields: {},
    };
    queryClient.setQueryData(['tableDataItem', 'tile-1'], clearedTableDataItem);

    const { result } = renderHook(() => useTableDataQueryWithTracking('tile-1', 'tab-1'), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.tableData).toBeDefined();
    });

    const mockLogsResponse = createMockLogsResponse();

    // Call updateLogs WITHOUT passing entriesProperties
    act(() => {
      result.current.updateLogs(mockLogsResponse, 'replace');
    });

    await waitFor(() => {
      expect(result.current.tableData.logs.length).toBeGreaterThan(0);
    });

    // Logs are updated
    expect(result.current.tableData.logs).toHaveLength(2);

    // But entriesProperties remains empty - this is the original bug behavior
    // The fix requires the caller (enhancedUpdateLogs) to derive and pass entriesProperties
    expect(
      result.current.tableData.entriesProperties.length,
      'Without passing entriesProperties, it should remain empty (original bug behavior)'
    ).toBe(0);
  });

  /**
   * This test documents the EXPECTED behavior after the fix.
   * It verifies that entriesProperties contains the expected field keys.
   *
   * This is what the behavior SHOULD be after the fix.
   */
  it('EXPECTED: After fix, entriesProperties should match log entry keys', async () => {
    const wrapper = createWrapper(queryClient);

    // Simulate the CORRECT state (what buildTableDataItem produces)
    const mockFields = createMockFields();
    const mockLogs = createMockLogs();

    const correctTableDataItem: TableDataItem = {
      ...EMPTY_TABLEDATAITEM,
      isLoading: false,
      logs: mockLogs,
      fields: mockFields,
      totalCount: mockLogs.length,
      // This is what extractLogsData() produces - the field keys
      entriesProperties: Object.keys(mockFields),
    };
    queryClient.setQueryData(['tableDataItem', 'tile-1'], correctTableDataItem);

    const { result } = renderHook(() => useTableDataQueryWithTracking('tile-1', 'tab-1'), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.tableData.logs.length).toBeGreaterThan(0);
    });

    // With correct entriesProperties, the table can render columns
    expect(result.current.tableData.entriesProperties.length).toBe(8);
    expect(result.current.tableData.entriesProperties).toContain('Trip');
    expect(result.current.tableData.entriesProperties).toContain('Driver');

    // Verify no mismatch between logs entries and entriesProperties
    const logEntriesKeys = Object.keys(result.current.tableData.logs[0].entries || {});
    const missingFromProperties = logEntriesKeys.filter(
      (key) => !result.current.tableData.entriesProperties.includes(key)
    );
    expect(
      missingFromProperties,
      'All log entry keys should be in entriesProperties for columns to render'
    ).toEqual([]);
  });

  /**
   * This test verifies the mismatch that causes empty cells.
   * When logs have entries but entriesProperties is empty, the table shows empty cells.
   */
  it('BUG DEMONSTRATION: logs with data + empty entriesProperties = empty table cells', async () => {
    const wrapper = createWrapper(queryClient);

    // This is the buggy state after context switch
    const mockLogs = createMockLogs();
    const buggyTableDataItem: TableDataItem = {
      ...EMPTY_TABLEDATAITEM,
      isLoading: false,
      logs: mockLogs, // Logs have data
      fields: {},
      totalCount: mockLogs.length,
      entriesProperties: [], // But no column definitions!
    };
    queryClient.setQueryData(['tableDataItem', 'tile-1'], buggyTableDataItem);

    const { result } = renderHook(() => useTableDataQueryWithTracking('tile-1', 'tab-1'), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.tableData.logs.length).toBeGreaterThan(0);
    });

    // Logs have data
    expect(result.current.tableData.logs.length).toBe(2);
    const logEntriesKeys = Object.keys(result.current.tableData.logs[0].entries || {});
    expect(logEntriesKeys.length).toBe(8);

    // But entriesProperties is empty - this causes empty table cells
    expect(result.current.tableData.entriesProperties.length).toBe(0);

    // The mismatch count shows the problem
    const missingColumns = logEntriesKeys.filter(
      (key) => !result.current.tableData.entriesProperties.includes(key)
    );
    expect(
      missingColumns.length,
      'With the bug, all 8 columns are missing from entriesProperties'
    ).toBe(8);
  });

  /**
   * REGRESSION TEST: Context switch with STALE (non-empty) entriesProperties
   *
   * Scenario:
   * 1. User is on Context A with entriesProperties = ['rowId', 'fileId', 'contentId', ...]
   * 2. User switches to Context B
   * 3. New logs have entries = ['rowId', 'Trip', 'Driver', 'Vehicle', ...]
   * 4. BUG: entriesProperties still has old Context A fields
   * 5. RESULT: Columns show old field names, new fields have empty cells
   *
   * The fix: enhancedUpdateLogs tracks the context and re-derives entriesProperties
   * when context changes, even if entriesProperties is not empty.
   */
  it('REGRESSION: Context switch with stale entriesProperties should update columns', async () => {
    const wrapper = createWrapper(queryClient);

    // Step 1: Simulate state from Context A (Content context)
    // entriesProperties has OLD context's fields
    const staleEntriesProperties = ['rowId', 'fileId', 'contentId', 'contentType', 'title'];

    const staleTableDataItem: TableDataItem = {
      ...EMPTY_TABLEDATAITEM,
      isLoading: false,
      logs: [], // Will be replaced by new context's logs
      fields: {},
      totalCount: 0,
      entriesProperties: staleEntriesProperties, // NOT empty - has old context's fields
    };
    queryClient.setQueryData(['tableDataItem', 'tile-1'], staleTableDataItem);

    const { result } = renderHook(() => useTableDataQueryWithTracking('tile-1', 'tab-1'), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.tableData).toBeDefined();
    });

    // Verify initial state has stale entriesProperties
    expect(result.current.tableData.entriesProperties).toEqual(staleEntriesProperties);
    expect(result.current.tableData.entriesProperties).toContain('fileId'); // Old field
    expect(result.current.tableData.entriesProperties).not.toContain('Trip'); // New field not present

    // Step 2: Simulate new context's logs being fetched
    // These logs have DIFFERENT fields than the stale entriesProperties
    const mockLogsResponse = createMockLogsResponse();

    // Step 3: Call updateLogs WITH new entriesProperties
    // This is what enhancedUpdateLogs does when it detects context changed
    const logsArray = Array.isArray(mockLogsResponse.logs) ? mockLogsResponse.logs : [];
    const newEntriesProperties = Object.keys(logsArray[0]?.entries || {});

    act(() => {
      result.current.updateLogs(
        mockLogsResponse,
        'replace',
        null,
        undefined,
        undefined,
        undefined,
        undefined,
        newEntriesProperties // The fix: pass new context's entriesProperties
      );
    });

    await waitFor(() => {
      expect(result.current.tableData.logs.length).toBeGreaterThan(0);
    });

    // Step 4: Verify entriesProperties was REPLACED with new context's fields
    expect(result.current.tableData.entriesProperties).not.toContain('fileId'); // Old field gone
    expect(result.current.tableData.entriesProperties).toContain('Trip'); // New field present
    expect(result.current.tableData.entriesProperties).toContain('Driver'); // New field present
    expect(result.current.tableData.entriesProperties).toContain('Vehicle'); // New field present

    // Verify all new fields are present
    expect(result.current.tableData.entriesProperties.length).toBe(8);
    expect(result.current.tableData.entriesProperties).toEqual(
      expect.arrayContaining([
        'rowId',
        'Trip',
        'Driver',
        'Vehicle',
        'Departure',
        'StartLocation',
        'EndLocation',
        'Arrival',
      ])
    );

    // Verify logs have the correct data
    expect(result.current.tableData.logs[0].entries).toHaveProperty('Trip');
    expect(result.current.tableData.logs[0].entries).toHaveProperty('Driver');
  });

  /**
   * REGRESSION TEST: Demonstrates the bug when entriesProperties is NOT updated on context switch
   *
   * This is what happens when enhancedUpdateLogs doesn't detect context change:
   * - Old entriesProperties is kept (not empty, so original fix doesn't trigger)
   * - New logs have different fields
   * - Table shows old column headers, new data doesn't match → empty cells
   */
  it('BUG DEMONSTRATION: Stale entriesProperties causes empty cells for new fields', async () => {
    const wrapper = createWrapper(queryClient);

    // Simulate the buggy state: logs have new fields, but entriesProperties has old fields
    const mockLogs = createMockLogs(); // Has Trip, Driver, Vehicle, etc.
    const staleEntriesProperties = ['rowId', 'fileId', 'contentId', 'contentType', 'title']; // Old fields

    const buggyTableDataItem: TableDataItem = {
      ...EMPTY_TABLEDATAITEM,
      isLoading: false,
      logs: mockLogs, // New context's logs
      fields: {},
      totalCount: mockLogs.length,
      entriesProperties: staleEntriesProperties, // OLD context's fields
    };
    queryClient.setQueryData(['tableDataItem', 'tile-1'], buggyTableDataItem);

    const { result } = renderHook(() => useTableDataQueryWithTracking('tile-1', 'tab-1'), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.tableData.logs.length).toBeGreaterThan(0);
    });

    // Logs have the new context's data
    expect(result.current.tableData.logs[0].entries).toHaveProperty('Trip');
    expect(result.current.tableData.logs[0].entries).toHaveProperty('Driver');

    // But entriesProperties has old context's fields
    expect(result.current.tableData.entriesProperties).toContain('fileId');
    expect(result.current.tableData.entriesProperties).not.toContain('Trip');

    // Calculate mismatches - these fields exist in logs but not in column definitions
    const logEntriesKeys = Object.keys(result.current.tableData.logs[0].entries || {});
    const missingColumns = logEntriesKeys.filter(
      (key) => !result.current.tableData.entriesProperties.includes(key)
    );

    // 7 out of 8 fields are missing (only 'rowId' exists in both)
    expect(missingColumns.length, 'With stale entriesProperties, most columns are missing').toBe(7);
    expect(missingColumns).toContain('Trip');
    expect(missingColumns).toContain('Driver');
    expect(missingColumns).toContain('Vehicle');
  });

  /**
   * REGRESSION TEST: Multiple updateLogs calls in same render cycle should NOT overwrite
   *
   * BUG (FIXED): Race condition where:
   * 1. First call to updateLogs derives entriesProperties (23 fields) and updates cache
   * 2. Second call runs immediately (same render cycle) with stale props (10 fields)
   * 3. Second call overwrites cache with stale 10 fields
   *
   * FIX: enhancedUpdateLogs now uses a ref (derivedPropertiesRef) to store derived
   * properties immediately. Subsequent calls check the ref value instead of stale props.
   *
   * This test simulates the pattern by calling updateLogs twice:
   * - First with entriesProperties (simulates successful derivation)
   * - Second without entriesProperties (simulates stale props scenario)
   *
   * The second call should preserve the first call's entriesProperties.
   */
  it('REGRESSION: Multiple updateLogs calls should preserve first derivation (race condition fix)', async () => {
    const wrapper = createWrapper(queryClient);

    // Start with empty/cleared state (simulates context switch clearing cache)
    const clearedTableDataItem: TableDataItem = {
      ...EMPTY_TABLEDATAITEM,
      isLoading: false,
      logs: [],
      fields: {},
      totalCount: 0,
      entriesProperties: [], // Empty
    };
    queryClient.setQueryData(['tableDataItem', 'tile-1'], clearedTableDataItem);

    const { result } = renderHook(() => useTableDataQueryWithTracking('tile-1', 'tab-1'), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.tableData).toBeDefined();
    });

    // Verify initial state
    expect(result.current.tableData.entriesProperties.length).toBe(0);

    const mockLogsResponse = createMockLogsResponse();
    const logsArray = Array.isArray(mockLogsResponse.logs) ? mockLogsResponse.logs : [];
    const correctEntriesProperties = Object.keys(logsArray[0]?.entries || {}); // 8 fields

    // Simulate the race condition scenario:
    // First call correctly passes entriesProperties
    act(() => {
      result.current.updateLogs(
        mockLogsResponse,
        'append', // Use append to simulate typical flow
        null,
        undefined,
        undefined,
        undefined,
        undefined,
        correctEntriesProperties // First call has correct properties
      );
    });

    // Wait for first update
    await waitFor(() => {
      expect(result.current.tableData.logs.length).toBeGreaterThan(0);
    });

    // Verify first call set entriesProperties correctly
    expect(result.current.tableData.entriesProperties.length).toBe(8);
    expect(result.current.tableData.entriesProperties).toContain('Trip');

    // Second call WITHOUT entriesProperties (simulates stale props causing skip)
    // In the buggy version, this would overwrite with empty/stale entriesProperties
    act(() => {
      result.current.updateLogs(
        mockLogsResponse,
        'append',
        null,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined // No entriesProperties - simulates stale props scenario
      );
    });

    // Wait for second update
    await waitFor(() => {
      expect(result.current.tableData.logs.length).toBeGreaterThan(0);
    });

    // CRITICAL: entriesProperties should STILL be 8 fields, not overwritten
    // The fix ensures that not passing entriesProperties doesn't clear it
    expect(
      result.current.tableData.entriesProperties.length,
      'Second call should NOT overwrite first call entriesProperties'
    ).toBe(8);
    expect(result.current.tableData.entriesProperties).toContain('Trip');
    expect(result.current.tableData.entriesProperties).toContain('Driver');
    expect(result.current.tableData.entriesProperties).toContain('Vehicle');
  });
});
